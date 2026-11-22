"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  Search,
  UserPlus,
  ExternalLink,
  CheckCheck,
  Radio,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { DirectMessageItem, PublicUserProfile } from "@/types/media";

interface ConversationThread {
  partnerId: string;
  partnerUsername: string;
  partnerDisplayName: string;
  partnerAvatarUrl: string | null;
  partnerAccentColor: string;
  lastMessage: DirectMessageItem | null;
  unreadCount: number;
}

export function MessagesClient() {
  const { profile, friends, refreshUnreadMessages, toast } = useShiori();
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [members, setMembers] = useState<PublicUserProfile[]>([]);
  const [activePartnerUsername, setActivePartnerUsername] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [searchMember, setSearchMember] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [realtimeLive, setRealtimeLive] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loadInbox = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        userId: profile.id,
        username: profile.username,
      });
      const [msgRes, memRes] = await Promise.all([
        fetch(`/api/messages?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/community/profiles", { cache: "no-store" }),
      ]);
      if (msgRes.ok) {
        const d = await msgRes.json();
        if (Array.isArray(d?.messages)) setMessages(d.messages);
      }
      if (memRes.ok) {
        const d = await memRes.json();
        if (Array.isArray(d?.profiles)) setMembers(d.profiles);
      }
    } catch {
      // ignore transient errors
    }
  }, [profile.id, profile.username]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  // Read ?to=<username> on initial mount so "Envoyer un message" from a profile opens that thread!
  useEffect(() => {
    if (typeof window === "undefined") return;
    const to = new URLSearchParams(window.location.search).get("to");
    if (to && to.trim()) {
      setActivePartnerUsername(to.trim().replace(/^@/, ""));
    }
  }, []);

  // Subscribe to Supabase Realtime for live incoming direct_messages!
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || profile.mode !== "supabase") return;

    const channel = supabase
      .channel(`shiori-dm-inbox-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        () => {
          void loadInbox();
          void refreshUnreadMessages();
        }
      )
      .subscribe((status) => setRealtimeLive(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile.id, profile.mode, loadInbox, refreshUnreadMessages]);

  const meLower = profile.username.toLowerCase();

  // Build conversations list
  const conversations = useMemo<ConversationThread[]>(() => {
    const map = new Map<string, ConversationThread>();
    const memberByUsername = new Map<string, PublicUserProfile>();
    for (const m of members) {
      memberByUsername.set(m.username.toLowerCase(), m);
    }

    for (const msg of messages) {
      const iAmSender =
        msg.senderId === profile.id || msg.senderUsername.toLowerCase() === meLower;
      const partnerId = iAmSender ? msg.recipientId : msg.senderId;
      const partnerUsername = iAmSender ? msg.recipientUsername : msg.senderUsername;
      const partnerDisplayName = iAmSender ? msg.recipientDisplayName : msg.senderDisplayName;
      const partnerAvatarUrl = iAmSender ? msg.recipientAvatarUrl : msg.senderAvatarUrl;
      const key = partnerUsername.toLowerCase();
      if (key === meLower) continue;

      const memMeta = memberByUsername.get(key);
      const existing = map.get(key) ?? {
        partnerId: memMeta?.id ?? partnerId,
        partnerUsername: memMeta?.username ?? partnerUsername,
        partnerDisplayName: memMeta?.displayName ?? partnerDisplayName,
        partnerAvatarUrl: memMeta?.avatarUrl ?? partnerAvatarUrl,
        partnerAccentColor: memMeta?.accentColor ?? "#E5484D",
        lastMessage: null,
        unreadCount: 0,
      };

      existing.lastMessage = msg;
      if (!iAmSender && !msg.isRead) {
        existing.unreadCount += 1;
      }
      map.set(key, existing);
    }

    // Ensure ?to= partner appears in conversation list even before first message is sent
    if (activePartnerUsername && activePartnerUsername.toLowerCase() !== meLower) {
      const k = activePartnerUsername.toLowerCase();
      if (!map.has(k)) {
        const mem = memberByUsername.get(k);
        if (mem) {
          map.set(k, {
            partnerId: mem.id,
            partnerUsername: mem.username,
            partnerDisplayName: mem.displayName,
            partnerAvatarUrl: mem.avatarUrl,
            partnerAccentColor: mem.accentColor,
            lastMessage: null,
            unreadCount: 0,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : Date.now();
      const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : Date.now();
      return tb - ta;
    });
  }, [messages, members, profile.id, meLower, activePartnerUsername]);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!activePartnerUsername && conversations.length > 0) {
      setActivePartnerUsername(conversations[0].partnerUsername);
    }
  }, [activePartnerUsername, conversations]);

  const activeThread = useMemo(
    () =>
      conversations.find(
        (c) => c.partnerUsername.toLowerCase() === (activePartnerUsername ?? "").toLowerCase()
      ) ?? null,
    [conversations, activePartnerUsername]
  );

  const threadMessages = useMemo(() => {
    if (!activeThread) return [];
    const targetLower = activeThread.partnerUsername.toLowerCase();
    return messages.filter(
      (m) =>
        m.senderUsername.toLowerCase() === targetLower ||
        m.recipientUsername.toLowerCase() === targetLower ||
        m.senderId === activeThread.partnerId ||
        m.recipientId === activeThread.partnerId
    );
  }, [messages, activeThread]);

  // Auto-mark unread messages from active partner as read
  useEffect(() => {
    if (!activeThread || activeThread.unreadCount === 0) return;
    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId: activeThread.partnerId,
        partnerUsername: activeThread.partnerUsername,
        userId: profile.id,
        username: profile.username,
      }),
    })
      .then(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderUsername.toLowerCase() === activeThread.partnerUsername.toLowerCase()
              ? { ...m, isRead: true }
              : m
          )
        );
        void refreshUnreadMessages();
      })
      .catch(() => {});
  }, [activeThread, profile.id, profile.username, refreshUnreadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned || !activeThread || sending) return;

    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: profile.id,
          senderUsername: profile.username,
          senderDisplayName: profile.displayName,
          senderAvatarUrl: profile.avatarUrl ?? null,
          recipientId: activeThread.partnerId,
          recipientUsername: activeThread.partnerUsername,
          recipientDisplayName: activeThread.partnerDisplayName,
          recipientAvatarUrl: activeThread.partnerAvatarUrl,
          body: cleaned,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.message) {
        toast({
          title: "Envoi impossible",
          description: data?.error || "Impossible d'envoyer ce message.",
          variant: "warning",
        });
        return;
      }
      setMessages((prev) => [...prev, data.message as DirectMessageItem]);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  const friendUsernames = useMemo(
    () => new Set(friends.map((f) => f.username.toLowerCase())),
    [friends]
  );

  const selectableMembers = useMemo(() => {
    const q = searchMember.trim().replace(/^@+/, "").toLowerCase();
    return members
      .filter((m) => {
        if (m.username.toLowerCase() === meLower) return false;
        if (!q) return true;
        return (
          m.username.toLowerCase().includes(q) ||
          m.displayName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aFriend = friendUsernames.has(a.username.toLowerCase()) ? 1 : 0;
        const bFriend = friendUsernames.has(b.username.toLowerCase()) ? 1 : 0;
        return bFriend - aFriend;
      });
  }, [members, meLower, searchMember, friendUsernames]);

  return (
    <div className="pt-24 pb-16 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent mb-1 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            <span>
              Messagerie Privée · {realtimeLive ? "Supabase Realtime actif" : "Chiffrement session"}
            </span>
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-gradient-editorial">
            Messages privés
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setNewChatOpen((v) => !v)}
          className="h-9 px-4 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>{newChatOpen ? "Fermer la liste" : "Nouvelle discussion"}</span>
        </button>
      </div>

      {/* New Chat Member Picker Drawer */}
      {newChatOpen && (
        <div className="rounded-2xl card-surface border border-accent/30 p-4 space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#7D8296] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchMember}
              onChange={(e) => setSearchMember(e.target.value)}
              placeholder="Choisir un membre à qui écrire..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-obsidian/80 border border-white/[0.09] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {selectableMembers.map((m) => {
              const isFriend = friendUsernames.has(m.username.toLowerCase());
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setActivePartnerUsername(m.username);
                    setNewChatOpen(false);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl bg-obsidian/80 hover:bg-accent/20 border flex items-center gap-2 text-xs text-white transition-colors cursor-pointer",
                    isFriend
                      ? "border-emerald-400/40"
                      : "border-white/[0.09] hover:border-accent/45"
                  )}
                >
                  <UserAvatar
                    avatarUrl={m.avatarUrl}
                    initials={m.avatarInitials}
                    accentColor={m.accentColor}
                    size="xs"
                  />
                  <span className="font-medium">{m.displayName}</span>
                  <span className="font-mono text-[10.5px] text-[#858A9E]">@{m.username}</span>
                  {isFriend && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9.5px] font-semibold">
                      Ami
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Two-Pane Inbox */}
      <div className="grid grid-cols-1 md:grid-cols-12 rounded-3xl card-surface border border-white/[0.09] overflow-hidden min-h-[540px]">
        {/* LEFT: Conversations List */}
        <aside className="md:col-span-4 border-b md:border-b-0 md:border-r border-white/[0.08] bg-obsidian/55 flex flex-col">
          <div className="p-4 border-b border-white/[0.07]">
            <p className="text-xs font-semibold text-white">
              Conversations ({conversations.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.05]">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#858A9E]">
                Aucune conversation pour le moment. Cliquez sur « Nouvelle discussion » pour
                écrire à un membre !
              </div>
            ) : (
              conversations.map((conv) => {
                const selected =
                  activeThread?.partnerUsername.toLowerCase() ===
                  conv.partnerUsername.toLowerCase();
                return (
                  <button
                    key={conv.partnerUsername}
                    type="button"
                    onClick={() => setActivePartnerUsername(conv.partnerUsername)}
                    className={cn(
                      "w-full p-3.5 text-left transition-colors flex items-center gap-3 cursor-pointer",
                      selected ? "bg-accent/14 border-l-2 border-accent" : "hover:bg-white/[0.04]"
                    )}
                  >
                    <UserAvatar
                      avatarUrl={conv.partnerAvatarUrl}
                      initials={conv.partnerDisplayName.slice(0, 2)}
                      accentColor={conv.partnerAccentColor}
                      alt={conv.partnerDisplayName}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white truncate">
                          {conv.partnerDisplayName}
                        </span>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-[#7D8296] shrink-0">
                            {formatRelativeTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8E93A6] truncate mt-0.5">
                        {conv.lastMessage
                          ? conv.lastMessage.body
                          : `Démarrer une discussion avec @${conv.partnerUsername}`}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-accent-fg font-mono text-[10.5px] font-bold flex items-center justify-center shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT: Active Chat Thread */}
        <div className="md:col-span-8 flex flex-col bg-surface/40">
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-2">
              <MessageSquare className="w-8 h-8 text-accent opacity-80" />
              <p className="text-sm font-semibold text-white">
                Sélectionnez une conversation
              </p>
              <p className="text-xs text-[#858A9E]">
                Ou ouvrez n&apos;importe quel profil membre pour envoyer un message privé.
              </p>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="px-5 py-3.5 border-b border-white/[0.08] bg-surface-solid-header flex items-center justify-between gap-3">
                <Link
                  href={`/profile/${encodeURIComponent(activeThread.partnerUsername)}`}
                  className="flex items-center gap-3 group min-w-0"
                >
                  <UserAvatar
                    avatarUrl={activeThread.partnerAvatarUrl}
                    initials={activeThread.partnerDisplayName.slice(0, 2)}
                    accentColor={activeThread.partnerAccentColor}
                    alt={activeThread.partnerDisplayName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-accent-hover transition-colors truncate">
                      {activeThread.partnerDisplayName}
                    </p>
                    <p className="text-[11px] font-mono text-[#858A9E] truncate">
                      @{activeThread.partnerUsername}
                    </p>
                  </div>
                </Link>

                <Link
                  href={`/profile/${encodeURIComponent(activeThread.partnerUsername)}`}
                  className="text-xs text-[#A6AAB8] hover:text-white inline-flex items-center gap-1 shrink-0"
                >
                  <span>Voir profil</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-5 space-y-3 max-h-[420px]">
                {threadMessages.length === 0 ? (
                  <p className="text-center text-xs text-[#858A9E] py-10">
                    Aucun message encore avec {activeThread.partnerDisplayName}. Dites bonjour !
                  </p>
                ) : (
                  threadMessages.map((m) => {
                    const isMine =
                      m.senderId === profile.id ||
                      m.senderUsername.toLowerCase() === meLower;
                    return (
                      <div
                        key={m.id}
                        className={cn("flex", isMine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-[13px] leading-relaxed space-y-1",
                            isMine
                              ? "bg-accent text-accent-fg rounded-br-sm shadow-accent"
                              : "bg-surface-solid border border-white/[0.09] text-[#ECEBE6] rounded-bl-sm"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <div
                            className={cn(
                              "flex items-center justify-end gap-1 text-[10px]",
                              isMine ? "opacity-80" : "text-[#7D8296]"
                            )}
                          >
                            <span>{formatRelativeTime(m.createdAt)}</span>
                            {isMine && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={endRef} />
              </div>

              {/* Composer */}
              <form
                onSubmit={handleSend}
                className="p-3.5 border-t border-white/[0.08] bg-obsidian/70 flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Écrire un message privé à ${activeThread.partnerDisplayName}...`}
                  maxLength={2000}
                  className="flex-1 h-10 px-4 rounded-xl bg-surface border border-white/[0.1] text-sm text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="h-10 px-4 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-45 text-accent-fg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
