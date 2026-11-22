"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  Search,
  UserPlus,
  ExternalLink,
  Check,
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

const POLL_INTERVAL_MS = 3000;

export function MessagesClient() {
  const { profile, friends, refreshUnreadMessages, toast } = useShiori();
  const [serverActorId, setServerActorId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [members, setMembers] = useState<PublicUserProfile[]>([]);
  const [partnerProfiles, setPartnerProfiles] = useState<PublicUserProfile[]>([]);
  // Strictly track the active conversation by unique user ID (never username/displayName!)
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const [pendingToParam, setPendingToParam] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [searchMember, setSearchMember] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [realtimeLive, setRealtimeLive] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLInputElement>(null);
  const newChatPickerRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);

  // Close floating "Nouvelle discussion" popover on outside click / Escape
  useEffect(() => {
    if (!newChatOpen) return;
    const onDown = (e: MouseEvent) => {
      if (newChatPickerRef.current && !newChatPickerRef.current.contains(e.target as Node)) {
        setNewChatOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNewChatOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [newChatOpen]);

  const selectPartner = useCallback((partnerId: string) => {
    setActivePartnerId(partnerId);
    setNewChatOpen(false);
    requestAnimationFrame(() => {
      composerInputRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const currentUserId = serverActorId || profile.id;

  const loadInbox = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
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
        if (typeof d?.actorId === "string" && d.actorId) {
          setServerActorId(d.actorId);
        }
        if (Array.isArray(d?.messages)) {
          setMessages(d.messages);
        }
        if (Array.isArray(d?.partnerProfiles)) {
          setPartnerProfiles(d.partnerProfiles);
        }
      }
      if (memRes.ok) {
        const d = await memRes.json();
        if (Array.isArray(d?.profiles)) {
          setMembers(d.profiles);
        }
      }
    } catch {
      // ignore transient errors
    } finally {
      inFlightRef.current = false;
    }
  }, [profile.id, profile.username]);

  // Initial load
  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  // Read ?to=<username_or_id> on initial mount so "Envoyer un message" opens that user's thread
  useEffect(() => {
    if (typeof window === "undefined") return;
    const to = new URLSearchParams(window.location.search).get("to");
    if (to && to.trim()) {
      setPendingToParam(to.trim().replace(/^@+/, ""));
    }
  }, []);

  // Build unified live profile index strictly keyed by unique user ID (from public_profiles + community directory)
  const memberById = useMemo(() => {
    const map = new Map<string, PublicUserProfile>();
    for (const m of members) {
      map.set(m.id, m);
    }
    // `partnerProfiles` comes directly from `public.public_profiles` by ID in GET /api/messages
    for (const p of partnerProfiles) {
      map.set(p.id, p);
    }
    for (const f of friends) {
      if (!map.has(f.id)) map.set(f.id, f);
    }
    return map;
  }, [members, partnerProfiles, friends]);

  const memberByIdRef = useRef(memberById);
  useEffect(() => {
    memberByIdRef.current = memberById;
  }, [memberById]);

  // Resolve ?to=<username_or_id> to canonical partnerId once profiles/messages load
  useEffect(() => {
    if (!pendingToParam) return;
    const lower = pendingToParam.toLowerCase();
    for (const p of memberById.values()) {
      if (p.id === pendingToParam || p.username.toLowerCase() === lower) {
        if (p.id !== currentUserId) {
          setActivePartnerId(p.id);
        }
        setPendingToParam(null);
        return;
      }
    }
  }, [pendingToParam, memberById, currentUserId]);

  // 1) Supabase Realtime subscription to INSERT & UPDATE on `public.direct_messages`
  //    for instant 0ms message arrival & live read/unread status updates!
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || profile.mode !== "supabase") {
      setRealtimeLive(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapRealtimeRow = (row: any): DirectMessageItem => {
      const senderId = String(row.sender_id);
      const recipientId = String(row.recipient_id);
      const liveSender = memberByIdRef.current.get(senderId);
      const liveRecipient = memberByIdRef.current.get(recipientId);
      return {
        id: String(row.id),
        senderId,
        recipientId,
        senderUsername: liveSender?.username ?? String(row.sender_username ?? ""),
        senderDisplayName:
          liveSender?.displayName ?? String(row.sender_display_name ?? row.sender_username ?? ""),
        senderAvatarUrl:
          liveSender !== undefined ? liveSender.avatarUrl : (row.sender_avatar_url ?? null),
        recipientUsername: liveRecipient?.username ?? String(row.recipient_username ?? ""),
        recipientDisplayName:
          liveRecipient?.displayName ??
          String(row.recipient_display_name ?? row.recipient_username ?? ""),
        recipientAvatarUrl:
          liveRecipient !== undefined
            ? liveRecipient.avatarUrl
            : (row.recipient_avatar_url ?? null),
        body: String(row.body ?? ""),
        isRead: Boolean(row.is_read),
        createdAt: String(row.created_at ?? new Date().toISOString()),
      };
    };

    const channel = supabase
      .channel(`shiori-dm-realtime-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any;
          if (!row?.id) return;
          if (row.sender_id !== currentUserId && row.recipient_id !== currentUserId) return;

          const incoming = mapRealtimeRow(row);
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
          });
          // Sync latest profile snapshot & navbar unread badge
          void loadInbox();
          void refreshUnreadMessages();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages" },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = payload.new as any;
          if (!row?.id) return;
          if (row.sender_id !== currentUserId && row.recipient_id !== currentUserId) return;

          const updatedId = String(row.id);
          const nextIsRead = Boolean(row.is_read);
          const nextBody = typeof row.body === "string" ? row.body : undefined;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updatedId
                ? { ...m, isRead: nextIsRead, ...(nextBody !== undefined ? { body: nextBody } : {}) }
                : m
            )
          );
          void refreshUnreadMessages();
        }
      )
      .subscribe((status) => {
        setRealtimeLive(status === "SUBSCRIBED");
      });

    return () => {
      setRealtimeLive(false);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, profile.mode, loadInbox, refreshUnreadMessages]);

  // 2) Fallback live polling every 3 seconds while /messages is open (pauses when tab is hidden)
  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void loadInbox();
      void refreshUnreadMessages();
    };

    const interval = setInterval(tick, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadInbox, refreshUnreadMessages]);

  // Group ALL conversations strictly by the other user's unique ID (`otherUserId`)
  // and always display their current name, @username & avatar from `public.public_profiles`!
  const conversations = useMemo<ConversationThread[]>(() => {
    const map = new Map<string, ConversationThread>();

    for (const msg of messages) {
      const iAmSender = msg.senderId === currentUserId;
      const otherUserId = iAmSender ? msg.recipientId : msg.senderId;
      if (!otherUserId || otherUserId === currentUserId) continue;

      const liveProfile = memberById.get(otherUserId);
      const fallbackUsername = iAmSender ? msg.recipientUsername : msg.senderUsername;
      const fallbackDisplayName = iAmSender ? msg.recipientDisplayName : msg.senderDisplayName;
      const fallbackAvatarUrl = iAmSender ? msg.recipientAvatarUrl : msg.senderAvatarUrl;

      const existing = map.get(otherUserId) ?? {
        partnerId: otherUserId,
        partnerUsername: liveProfile?.username || fallbackUsername || "membre",
        partnerDisplayName:
          liveProfile?.displayName || fallbackDisplayName || fallbackUsername || "Membre Shiori",
        partnerAvatarUrl:
          liveProfile !== undefined ? liveProfile.avatarUrl : fallbackAvatarUrl,
        partnerAccentColor: liveProfile?.accentColor ?? "#E5484D",
        lastMessage: null,
        unreadCount: 0,
      };

      // Always keep current live profile metadata up to date
      if (liveProfile) {
        existing.partnerUsername = liveProfile.username;
        existing.partnerDisplayName = liveProfile.displayName;
        existing.partnerAvatarUrl = liveProfile.avatarUrl;
        existing.partnerAccentColor = liveProfile.accentColor;
      }

      if (
        !existing.lastMessage ||
        new Date(msg.createdAt).getTime() >=
          new Date(existing.lastMessage.createdAt).getTime()
      ) {
        existing.lastMessage = msg;
      }
      if (!iAmSender && !msg.isRead) {
        existing.unreadCount += 1;
      }
      map.set(otherUserId, existing);
    }

    // Ensure selected partner (e.g. from ?to= or "Nouvelle discussion") appears even before first message
    if (activePartnerId && activePartnerId !== currentUserId && !map.has(activePartnerId)) {
      const mem = memberById.get(activePartnerId);
      if (mem) {
        map.set(activePartnerId, {
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

    return Array.from(map.values()).sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : Date.now();
      const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : Date.now();
      return tb - ta;
    });
  }, [messages, memberById, currentUserId, activePartnerId]);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!activePartnerId && !pendingToParam && conversations.length > 0) {
      setActivePartnerId(conversations[0].partnerId);
    }
  }, [activePartnerId, pendingToParam, conversations]);

  const activeThread = useMemo(
    () => conversations.find((c) => c.partnerId === activePartnerId) ?? null,
    [conversations, activePartnerId]
  );

  // Filter active thread messages strictly by user UUIDs (never username!)
  const threadMessages = useMemo(() => {
    if (!activeThread) return [];
    const meId = currentUserId;
    const otherId = activeThread.partnerId;
    return messages.filter(
      (m) =>
        (m.senderId === meId && m.recipientId === otherId) ||
        (m.senderId === otherId && m.recipientId === meId)
    );
  }, [messages, activeThread, currentUserId]);

  // Auto-mark unread messages from active partner as read (strictly by partnerId)
  useEffect(() => {
    if (!activeThread || activeThread.unreadCount === 0) return;
    const partnerId = activeThread.partnerId;

    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId,
        userId: currentUserId,
        username: profile.username,
      }),
    })
      .then(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === partnerId && m.recipientId === currentUserId
              ? { ...m, isRead: true }
              : m
          )
        );
        void refreshUnreadMessages();
      })
      .catch(() => {});
  }, [activeThread, currentUserId, profile.username, refreshUnreadMessages]);

  // Scroll ONLY the internal chat box to the newest message (never scroll the window/page!)
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [threadMessages.length, activePartnerId]);

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
      const created = data.message as DirectMessageItem;
      setMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev;
        return [...prev, created];
      });
      setDraft("");
      requestAnimationFrame(() => {
        composerInputRef.current?.focus({ preventScroll: true });
      });
    } finally {
      setSending(false);
    }
  };

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  const selectableMembers = useMemo(() => {
    const q = searchMember.trim().replace(/^@+/, "").toLowerCase();
    return Array.from(memberById.values())
      .filter((m) => {
        if (m.id === currentUserId) return false;
        if (!q) return true;
        return (
          m.username.toLowerCase().includes(q) ||
          m.displayName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aFriend = friendIds.has(a.id) ? 1 : 0;
        const bFriend = friendIds.has(b.id) ? 1 : 0;
        return bFriend - aFriend;
      });
  }, [memberById, currentUserId, searchMember, friendIds]);

  return (
    <div className="pt-24 pb-12 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5 [overflow-anchor:none]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent mb-1 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            <span>
              Messagerie Privée ·{" "}
              {realtimeLive
                ? "Supabase Realtime en direct"
                : "Synchronisation temps réel (3s)"}
            </span>
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-gradient-editorial">
            Messages privés
          </h1>
        </div>

        {/* Floating "Nouvelle discussion" Picker (0px vertical layout shift!) */}
        <div ref={newChatPickerRef} className="relative self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setNewChatOpen((v) => !v)}
            className="h-9 px-4 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent inline-flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{newChatOpen ? "Fermer la liste" : "Nouvelle discussion"}</span>
          </button>

          {newChatOpen && (
            <div className="absolute right-0 top-full mt-2 z-40 w-[min(92vw,420px)] rounded-2xl bg-[#0D101A]/98 border border-accent/35 shadow-[0_24px_60px_rgba(0,0,0,0.8)] p-4 space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#7D8296] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchMember}
                  onChange={(e) => setSearchMember(e.target.value)}
                  placeholder="Choisir un ami ou membre à qui écrire..."
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-obsidian/90 border border-white/[0.1] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto overscroll-contain pr-0.5">
                {selectableMembers.length === 0 ? (
                  <p className="text-xs text-[#858A9E] py-2">Aucun membre trouvé.</p>
                ) : (
                  selectableMembers.map((m) => {
                    const isFriend = friendIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectPartner(m.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl bg-obsidian/85 hover:bg-accent/20 border flex items-center gap-2 text-xs text-white transition-colors cursor-pointer",
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
                        <span className="font-mono text-[10.5px] text-[#858A9E]">
                          @{m.username}
                        </span>
                        {isFriend && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9.5px] font-semibold">
                            Ami
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Two-Pane Inbox (viewport-fitted so header + composer stay visible with zero page jump) */}
      <div className="grid grid-cols-1 md:grid-cols-12 rounded-3xl card-surface border border-white/[0.09] overflow-hidden md:h-[clamp(440px,calc(100dvh-13.5rem),600px)] min-h-[440px]">
        {/* LEFT: Conversations List (strictly 1 row per unique partnerId) */}
        <aside className="md:col-span-4 border-b md:border-b-0 md:border-r border-white/[0.08] bg-obsidian/55 flex flex-col min-h-0">
          <div className="p-4 border-b border-white/[0.07] flex items-center justify-between gap-2 shrink-0">
            <p className="text-xs font-semibold text-white">
              Conversations ({conversations.length})
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {realtimeLive ? "Live" : "Sync 3s"}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-white/[0.05]">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#858A9E]">
                Aucune conversation pour le moment. Cliquez sur « Nouvelle discussion » pour
                écrire à un membre !
              </div>
            ) : (
              conversations.map((conv) => {
                const selected = activeThread?.partnerId === conv.partnerId;
                return (
                  <button
                    key={conv.partnerId}
                    type="button"
                    onClick={() => selectPartner(conv.partnerId)}
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
        <div className="md:col-span-8 flex flex-col bg-surface/40 min-h-0">
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
              <div
                ref={messagesContainerRef}
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-3"
              >
                {threadMessages.length === 0 ? (
                  <p className="text-center text-xs text-[#858A9E] py-10">
                    Aucun message encore avec {activeThread.partnerDisplayName}. Dites bonjour !
                  </p>
                ) : (
                  threadMessages.map((m) => {
                    const isMine = m.senderId === currentUserId;
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
                              isMine ? "opacity-85" : "text-[#7D8296]"
                            )}
                          >
                            <span>{formatRelativeTime(m.createdAt)}</span>
                            {isMine &&
                              (m.isRead ? (
                                <span
                                  title="Lu"
                                  className="inline-flex items-center gap-0.5 text-sky-200 font-medium"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <span title="Envoyé" className="inline-flex items-center opacity-70">
                                  <Check className="w-3 h-3" />
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Composer */}
              <form
                onSubmit={handleSend}
                className="p-3.5 border-t border-white/[0.08] bg-obsidian/70 flex items-center gap-2.5"
              >
                <input
                  ref={composerInputRef}
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
