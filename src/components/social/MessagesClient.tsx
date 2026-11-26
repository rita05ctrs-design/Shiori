"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Send,
  Search,
  UserPlus,
  ExternalLink,
  Check,
  CheckCheck,
  Radio,
  ArrowLeft,
  Lock,
  Smile,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn, formatRelativeTime } from "@/lib/utils";
import type {
  ContentLanguage,
  DirectMessageItem,
  PublicUserProfile,
} from "@/types/media";

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
const QUICK_EMOJIS = [
  "🔥",
  "❤️",
  "😂",
  "😭",
  "✨",
  "👀",
  "👍",
  "🙌",
  "🎬",
  "🌸",
  "🍿",
  "💯",
];

interface MsgCopy {
  eyebrow: string;
  realtimeLive: string;
  realtimePoll: string;
  title: string;
  newChat: string;
  closeList: string;
  searchMembers: string;
  searchChats: string;
  noMembers: string;
  friendBadge: string;
  conversations: string;
  emptyInbox: string;
  startChatPrefix: string;
  selectConvTitle: string;
  selectConvSub: string;
  backToChats: string;
  viewProfile: string;
  profileShort: string;
  emptyThreadPrefix: string;
  emptyThreadSuffix: string;
  placeholderPrefix: string;
  send: string;
  sending: string;
  sent: string;
  read: string;
  today: string;
  yesterday: string;
  youPrefix: string;
  jumpToLatest: string;
  sendFailedTitle: string;
  sendFailedDesc: string;
  guestTitle: string;
  guestSub: string;
  signIn: string;
  signUp: string;
  icebreakers: [string, string, string];
  emojiLabel: string;
}

const MSG_COPY: Record<ContentLanguage, MsgCopy> = {
  fr: {
    eyebrow: "Messagerie Privée",
    realtimeLive: "En direct",
    realtimePoll: "Temps réel (3s)",
    title: "Messages privés",
    newChat: "Nouvelle discussion",
    closeList: "Fermer",
    searchMembers: "Chercher un ami ou un membre...",
    searchChats: "Rechercher une conversation...",
    noMembers: "Aucun membre trouvé.",
    friendBadge: "Ami",
    conversations: "Conversations",
    emptyInbox:
      "Aucune conversation pour le moment. Appuyez sur « Nouvelle discussion » pour écrire à un membre !",
    startChatPrefix: "Démarrer avec @",
    selectConvTitle: "Sélectionnez une conversation",
    selectConvSub:
      "Ou ouvrez n'importe quel profil membre pour envoyer un message privé.",
    backToChats: "Conversations",
    viewProfile: "Voir profil",
    profileShort: "Profil",
    emptyThreadPrefix: "Début de votre discussion avec",
    emptyThreadSuffix: "Dites bonjour !",
    placeholderPrefix: "Message à",
    send: "Envoyer",
    sending: "Envoi...",
    sent: "Envoyé",
    read: "Lu",
    today: "Aujourd'hui",
    yesterday: "Hier",
    youPrefix: "Vous : ",
    jumpToLatest: "Derniers messages",
    sendFailedTitle: "Envoi impossible",
    sendFailedDesc: "Impossible d'envoyer ce message.",
    guestTitle: "Messagerie privée réservée aux membres",
    guestSub:
      "Connectez-vous ou créez un compte gratuit Shiori pour discuter en privé avec vos amis et la communauté en toute sécurité.",
    signIn: "Se connecter",
    signUp: "Créer un compte",
    icebreakers: [
      "Salut ! 👋",
      "Tu regardes quoi en ce moment ? 🎬",
      "Un anime à me recommander ? ✨",
    ],
    emojiLabel: "Emojis rapides",
  },
  en: {
    eyebrow: "Private Messages",
    realtimeLive: "Live",
    realtimePoll: "Live sync (3s)",
    title: "Messages",
    newChat: "New chat",
    closeList: "Close",
    searchMembers: "Find a friend or member...",
    searchChats: "Search conversations...",
    noMembers: "No members found.",
    friendBadge: "Friend",
    conversations: "Conversations",
    emptyInbox:
      "No conversations yet. Tap \"New chat\" to message a friend or community member!",
    startChatPrefix: "Start chatting with @",
    selectConvTitle: "Select a conversation",
    selectConvSub: "Or open any member profile to send a direct message.",
    backToChats: "Chats",
    viewProfile: "View profile",
    profileShort: "Profile",
    emptyThreadPrefix: "Start of your chat with",
    emptyThreadSuffix: "Say hello!",
    placeholderPrefix: "Message",
    send: "Send",
    sending: "Sending...",
    sent: "Sent",
    read: "Read",
    today: "Today",
    yesterday: "Yesterday",
    youPrefix: "You: ",
    jumpToLatest: "Latest messages",
    sendFailedTitle: "Could not send",
    sendFailedDesc: "Unable to send this message.",
    guestTitle: "Private messaging is for members",
    guestSub:
      "Sign in or create a free Shiori account to chat privately with friends and the community.",
    signIn: "Sign in",
    signUp: "Create account",
    icebreakers: [
      "Hey! 👋",
      "What are you watching lately? 🎬",
      "Any anime recommendations? ✨",
    ],
    emojiLabel: "Quick emojis",
  },
  es: {
    eyebrow: "Mensajes Privados",
    realtimeLive: "En vivo",
    realtimePoll: "Tiempo real (3s)",
    title: "Mensajes privados",
    newChat: "Nuevo chat",
    closeList: "Cerrar",
    searchMembers: "Buscar un amigo o miembro...",
    searchChats: "Buscar conversación...",
    noMembers: "No se encontraron miembros.",
    friendBadge: "Amigo",
    conversations: "Conversaciones",
    emptyInbox:
      "Aún no hay conversaciones. Pulsa « Nuevo chat » para escribir a un miembro.",
    startChatPrefix: "Empezar con @",
    selectConvTitle: "Selecciona una conversación",
    selectConvSub: "O abre cualquier perfil para enviar un mensaje privado.",
    backToChats: "Chats",
    viewProfile: "Ver perfil",
    profileShort: "Perfil",
    emptyThreadPrefix: "Inicio de tu chat con",
    emptyThreadSuffix: "¡Di hola!",
    placeholderPrefix: "Mensaje para",
    send: "Enviar",
    sending: "Enviando...",
    sent: "Enviado",
    read: "Leído",
    today: "Hoy",
    yesterday: "Ayer",
    youPrefix: "Tú: ",
    jumpToLatest: "Últimos mensajes",
    sendFailedTitle: "Error al enviar",
    sendFailedDesc: "No se pudo enviar este mensaje.",
    guestTitle: "Mensajería privada para miembros",
    guestSub:
      "Inicia sesión o crea una cuenta gratuita de Shiori para chatear en privado con tus amigos.",
    signIn: "Iniciar sesión",
    signUp: "Crear cuenta",
    icebreakers: [
      "¡Hola! 👋",
      "¿Qué anime estás viendo ahora? 🎬",
      "¿Me recomiendas algún anime? ✨",
    ],
    emojiLabel: "Emojis rápidos",
  },
  de: {
    eyebrow: "Private Nachrichten",
    realtimeLive: "Live",
    realtimePoll: "Echtzeit (3s)",
    title: "Nachrichten",
    newChat: "Neuer Chat",
    closeList: "Schließen",
    searchMembers: "Freund oder Mitglied suchen...",
    searchChats: "Unterhaltungen durchsuchen...",
    noMembers: "Keine Mitglieder gefunden.",
    friendBadge: "Freund",
    conversations: "Unterhaltungen",
    emptyInbox:
      "Noch keine Unterhaltungen. Tippe auf „Neuer Chat“, um jemandem zu schreiben!",
    startChatPrefix: "Chat starten mit @",
    selectConvTitle: "Unterhaltung auswählen",
    selectConvSub:
      "Oder öffne ein beliebiges Profil, um eine private Nachricht zu senden.",
    backToChats: "Chats",
    viewProfile: "Profil ansehen",
    profileShort: "Profil",
    emptyThreadPrefix: "Beginn deines Chats mit",
    emptyThreadSuffix: "Sag hallo!",
    placeholderPrefix: "Nachricht an",
    send: "Senden",
    sending: "Senden...",
    sent: "Gesendet",
    read: "Gelesen",
    today: "Heute",
    yesterday: "Gestern",
    youPrefix: "Du: ",
    jumpToLatest: "Neueste Nachrichten",
    sendFailedTitle: "Senden fehlgeschlagen",
    sendFailedDesc: "Nachricht konnte nicht gesendet werden.",
    guestTitle: "Private Nachrichten nur für Mitglieder",
    guestSub:
      "Melde dich an oder erstelle ein kostenloses Shiori-Konto, um privat mit Freunden zu chatten.",
    signIn: "Anmelden",
    signUp: "Konto erstellen",
    icebreakers: [
      "Hey! 👋",
      "Was schaust du gerade? 🎬",
      "Hast du eine Anime-Empfehlung? ✨",
    ],
    emojiLabel: "Schnell-Emojis",
  },
  it: {
    eyebrow: "Messaggi Privati",
    realtimeLive: "In diretta",
    realtimePoll: "Tempo reale (3s)",
    title: "Messaggi privati",
    newChat: "Nuova chat",
    closeList: "Chiudi",
    searchMembers: "Cerca un amico o membro...",
    searchChats: "Cerca conversazione...",
    noMembers: "Nessun membro trovato.",
    friendBadge: "Amico",
    conversations: "Conversazioni",
    emptyInbox:
      "Nessuna conversazione ancora. Tocca « Nuova chat » per scrivere a un membro!",
    startChatPrefix: "Inizia con @",
    selectConvTitle: "Seleziona una conversazione",
    selectConvSub: "Oppure apri qualsiasi profilo per inviare un messaggio privato.",
    backToChats: "Chat",
    viewProfile: "Vedi profilo",
    profileShort: "Profilo",
    emptyThreadPrefix: "Inizio della chat con",
    emptyThreadSuffix: "Saluta!",
    placeholderPrefix: "Messaggio a",
    send: "Invia",
    sending: "Invio...",
    sent: "Inviato",
    read: "Letto",
    today: "Oggi",
    yesterday: "Ieri",
    youPrefix: "Tu: ",
    jumpToLatest: "Ultimi messaggi",
    sendFailedTitle: "Invio fallito",
    sendFailedDesc: "Impossibile inviare il messaggio.",
    guestTitle: "Messaggi privati riservati ai membri",
    guestSub:
      "Accedi o crea un account Shiori gratuito per chattare in privato con amici e community.",
    signIn: "Accedi",
    signUp: "Crea account",
    icebreakers: [
      "Ciao! 👋",
      "Cosa stai guardando adesso? 🎬",
      "Mi consigli un anime? ✨",
    ],
    emojiLabel: "Emoji rapide",
  },
  pt: {
    eyebrow: "Mensagens Privadas",
    realtimeLive: "Ao vivo",
    realtimePoll: "Tempo real (3s)",
    title: "Mensagens privadas",
    newChat: "Nova conversa",
    closeList: "Fechar",
    searchMembers: "Procurar amigo ou membro...",
    searchChats: "Buscar conversa...",
    noMembers: "Nenhum membro encontrado.",
    friendBadge: "Amigo",
    conversations: "Conversas",
    emptyInbox:
      "Nenhuma conversa ainda. Toque em « Nova conversa » para enviar uma mensagem!",
    startChatPrefix: "Conversar com @",
    selectConvTitle: "Selecione uma conversa",
    selectConvSub: "Ou abra qualquer perfil para enviar uma mensagem privada.",
    backToChats: "Conversas",
    viewProfile: "Ver perfil",
    profileShort: "Perfil",
    emptyThreadPrefix: "Início da conversa com",
    emptyThreadSuffix: "Diga olá!",
    placeholderPrefix: "Mensagem para",
    send: "Enviar",
    sending: "Enviando...",
    sent: "Enviado",
    read: "Lido",
    today: "Hoje",
    yesterday: "Ontem",
    youPrefix: "Você: ",
    jumpToLatest: "Últimas mensagens",
    sendFailedTitle: "Erro ao enviar",
    sendFailedDesc: "Não foi possível enviar esta mensagem.",
    guestTitle: "Mensagens privadas para membros",
    guestSub:
      "Entre ou crie uma conta Shiori gratuita para conversar em privado com seus amigos.",
    signIn: "Entrar",
    signUp: "Criar conta",
    icebreakers: [
      "Oi! 👋",
      "O que você está assistindo agora? 🎬",
      "Alguma recomendação de anime? ✨",
    ],
    emojiLabel: "Emojis rápidos",
  },
  ja: {
    eyebrow: "ダイレクトメッセージ",
    realtimeLive: "リアルタイム",
    realtimePoll: "同期中 (3秒)",
    title: "メッセージ",
    newChat: "新しいチャット",
    closeList: "閉じる",
    searchMembers: "フレンドやメンバーを検索...",
    searchChats: "トークを検索...",
    noMembers: "メンバーが見つかりません。",
    friendBadge: "フレンド",
    conversations: "トーク一覧",
    emptyInbox:
      "まだメッセージはありません。「新しいチャット」から話しかけてみましょう！",
    startChatPrefix: "@",
    selectConvTitle: "トークを選択",
    selectConvSub: "またはメンバーのプロフィールからメッセージを送れます。",
    backToChats: "トーク",
    viewProfile: "プロフィール",
    profileShort: "プロフィール",
    emptyThreadPrefix: "トーク開始：",
    emptyThreadSuffix: "あいさつしてみましょう！",
    placeholderPrefix: "メッセージ：",
    send: "送信",
    sending: "送信中...",
    sent: "送信済",
    read: "既読",
    today: "今日",
    yesterday: "昨日",
    youPrefix: "あなた：",
    jumpToLatest: "最新のメッセージへ",
    sendFailedTitle: "送信できませんでした",
    sendFailedDesc: "メッセージの送信に失敗しました。",
    guestTitle: "メンバー限定のメッセージ機能",
    guestSub:
      "ログインまたは無料アカウントを作成して、フレンドやコミュニティとチャットしましょう。",
    signIn: "ログイン",
    signUp: "新規登録",
    icebreakers: [
      "こんにちは！👋",
      "今期は何を見ていますか？🎬",
      "おすすめのアニメありますか？✨",
    ],
    emojiLabel: "クイック絵文字",
  },
};

function getDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayDivider(iso: string, locale: string, copy: MsgCopy): string {
  const d = new Date(iso);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startToday - startTarget) / 86400000);
  if (diffDays === 0) return copy.today;
  if (diffDays === 1) return copy.yesterday;
  return d.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatBubbleTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function MessagesClient() {
  const {
    profile,
    isAuthenticated,
    openAuthModal,
    friends,
    refreshUnreadMessages,
    contentLanguage,
    toast,
    isUserBlocked,
  } = useShiori();
  const { locale } = useTranslation();
  const copy = MSG_COPY[contentLanguage] ?? MSG_COPY.fr;

  const [serverActorId, setServerActorId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessageItem[]>([]);
  const [members, setMembers] = useState<PublicUserProfile[]>([]);
  const [partnerProfiles, setPartnerProfiles] = useState<PublicUserProfile[]>([]);
  // Strictly track the active conversation by unique user ID (never username/displayName!)
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  // On mobile (< md), toggle between full-width conversations list and full-screen native chat thread
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [pendingToParam, setPendingToParam] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sendingCount, setSendingCount] = useState(0);
  const [searchMember, setSearchMember] = useState("");
  const [searchChats, setSearchChats] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [emojiBarOpen, setEmojiBarOpen] = useState(false);
  const [realtimeLive, setRealtimeLive] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const newChatPickerRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setShowScrollBottom(false);
  }, []);

  // Auto-resize pill textarea smoothly (1 line up to ~4.5 lines)
  const resizeComposer = useCallback(() => {
    const ta = composerRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const clamped = Math.min(Math.max(ta.scrollHeight, 40), 124);
    ta.style.height = `${clamped}px`;
  }, []);

  useEffect(() => {
    resizeComposer();
  }, [draft, resizeComposer]);

  // Hide mobile bottom dock while full-screen mobile chat is open (restores cleanly on Back / unmount)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const isFullScreenMobileChat = isAuthenticated && mobileView === "chat" && Boolean(activePartnerId);
    document.body.classList.toggle("shiori-mobile-chat-open", isFullScreenMobileChat);
    return () => {
      document.body.classList.remove("shiori-mobile-chat-open");
    };
  }, [isAuthenticated, mobileView, activePartnerId]);

  // Keep latest message visible when iOS / Android virtual keyboard resizes the viewport
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    if (mobileView !== "chat") return;
    const vv = window.visualViewport;
    const onResize = () => {
      const el = messagesContainerRef.current;
      if (!el) return;
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distFromBottom < 220) {
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
        });
      }
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [mobileView]);

  // Close floating "Nouvelle discussion" picker on outside click / Escape
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
    setMobileView("chat");
    setNewChatOpen(false);
    setEmojiBarOpen(false);
    setShowScrollBottom(false);
    // Avoid force-popping keyboard on small touch screens when merely opening a conversation to read
    const isDesktop =
      typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop) {
      requestAnimationFrame(() => {
        composerRef.current?.focus({ preventScroll: true });
      });
    }
  }, []);

  const currentUserId = serverActorId || profile.id;

  const loadInbox = useCallback(async () => {
    if (!isAuthenticated || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const [msgRes, memRes] = await Promise.all([
        fetch("/api/messages", { cache: "no-store" }),
        fetch("/api/community/profiles", { cache: "no-store" }),
      ]);
      if (msgRes.ok) {
        const d = await msgRes.json();
        if (typeof d?.actorId === "string" && d.actorId) {
          setServerActorId(d.actorId);
        }
        if (Array.isArray(d?.messages)) {
          setMessages((prev) => {
            // Preserve any in-flight optimistic messages so background polls never flicker them away
            const pendingOptimistic = prev.filter((m) => m.id.startsWith("opt-"));
            if (pendingOptimistic.length === 0) return d.messages;
            const serverMsgs = d.messages as DirectMessageItem[];
            return [...serverMsgs, ...pendingOptimistic];
          });
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
  }, [isAuthenticated]);

  // Initial load
  useEffect(() => {
    if (!isAuthenticated) {
      setMessages([]);
      setPartnerProfiles([]);
      return;
    }
    void loadInbox();
  }, [isAuthenticated, loadInbox]);

  // Read ?to=<username_or_id> on initial mount so "Envoyer un message" opens that user's thread
  useEffect(() => {
    if (typeof window === "undefined") return;
    const to = new URLSearchParams(window.location.search).get("to");
    if (to && to.trim()) {
      setPendingToParam(to.trim().replace(/^@+/, ""));
    }
  }, []);

  // Unified live profile index strictly keyed by unique user ID
  const memberById = useMemo(() => {
    const map = new Map<string, PublicUserProfile>();
    for (const m of members) {
      map.set(m.id, m);
    }
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
          setMobileView("chat");
        }
        setPendingToParam(null);
        return;
      }
    }
  }, [pendingToParam, memberById, currentUserId]);

  // 1) Supabase Realtime subscription to INSERT & UPDATE on `public.direct_messages`
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

  // 2) Fallback live polling every 3 seconds while /messages is visible
  useEffect(() => {
    if (!isAuthenticated) return;
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
  }, [isAuthenticated, loadInbox, refreshUnreadMessages]);

  // Group conversations strictly by partner UUID
  const conversations = useMemo<ConversationThread[]>(() => {
    const map = new Map<string, ConversationThread>();

    for (const msg of messages) {
      const iAmSender = msg.senderId === currentUserId;
      const otherUserId = iAmSender ? msg.recipientId : msg.senderId;
      if (!otherUserId || otherUserId === currentUserId) continue;
      if (isUserBlocked(otherUserId)) continue;

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

    if (
      activePartnerId &&
      activePartnerId !== currentUserId &&
      !isUserBlocked(activePartnerId) &&
      !map.has(activePartnerId)
    ) {
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
  }, [messages, memberById, currentUserId, activePartnerId, isUserBlocked]);

  const filteredConversations = useMemo(() => {
    const q = searchChats.trim().replace(/^@+/, "").toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.partnerDisplayName.toLowerCase().includes(q) ||
        c.partnerUsername.toLowerCase().includes(q) ||
        (c.lastMessage?.body.toLowerCase().includes(q) ?? false)
    );
  }, [conversations, searchChats]);

  // Auto-select first conversation on desktop if none selected (keep mobile cleanly on list unless ?to=)
  useEffect(() => {
    if (!activePartnerId && !pendingToParam && conversations.length > 0) {
      setActivePartnerId(conversations[0].partnerId);
    }
  }, [activePartnerId, pendingToParam, conversations]);

  const activeThread = useMemo(
    () => conversations.find((c) => c.partnerId === activePartnerId) ?? null,
    [conversations, activePartnerId]
  );

  const otherThreadsUnreadCount = useMemo(
    () =>
      conversations.reduce(
        (sum, c) => (c.partnerId === activePartnerId ? sum : sum + c.unreadCount),
        0
      ),
    [conversations, activePartnerId]
  );

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

  // Auto-mark unread messages from active partner as read
  useEffect(() => {
    if (!activeThread || activeThread.unreadCount === 0) return;
    // On mobile, only mark as read once the user actually opened the chat view!
    const isMobile =
      typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    if (isMobile && mobileView !== "chat") return;

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
  }, [activeThread, mobileView, currentUserId, profile.username, refreshUnreadMessages]);

  // Smooth auto-scroll on new messages / thread open
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Always scroll when switching partner or if user is already near bottom
    if (distFromBottom < 260 || threadMessages.length <= 2) {
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    }
  }, [threadMessages.length, activePartnerId, mobileView]);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(dist > 180);
  };

  // Instant optimistic send (feels native & 0ms latency on mobile!)
  const sendTextMessage = useCallback(
    async (rawBody: string) => {
      const cleaned = rawBody.trim();
      if (!cleaned || !activeThread) return;

      const optimisticId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const optimisticMsg: DirectMessageItem = {
        id: optimisticId,
        senderId: currentUserId,
        recipientId: activeThread.partnerId,
        senderUsername: profile.username,
        senderDisplayName: profile.displayName,
        senderAvatarUrl: profile.avatarUrl ?? null,
        recipientUsername: activeThread.partnerUsername,
        recipientDisplayName: activeThread.partnerDisplayName,
        recipientAvatarUrl: activeThread.partnerAvatarUrl,
        body: cleaned,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setDraft("");
      setEmojiBarOpen(false);
      setSendingCount((c) => c + 1);
      requestAnimationFrame(() => {
        resizeComposer();
        scrollToBottom("smooth");
        composerRef.current?.focus({ preventScroll: true });
      });

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
          // Roll back optimistic bubble and restore text so nothing is lost
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          setDraft((prev) => (prev ? prev : cleaned));
          toast({
            title: copy.sendFailedTitle,
            description: data?.error || copy.sendFailedDesc,
            variant: "warning",
          });
          return;
        }
        const created = data.message as DirectMessageItem;
        setMessages((prev) => {
          const withoutOpt = prev.filter((m) => m.id !== optimisticId);
          if (withoutOpt.some((m) => m.id === created.id)) return withoutOpt;
          return [...withoutOpt, created];
        });
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setDraft((prev) => (prev ? prev : cleaned));
        toast({
          title: copy.sendFailedTitle,
          description: copy.sendFailedDesc,
          variant: "warning",
        });
      } finally {
        setSendingCount((c) => Math.max(0, c - 1));
      }
    },
    [
      activeThread,
      currentUserId,
      profile.id,
      profile.username,
      profile.displayName,
      profile.avatarUrl,
      resizeComposer,
      scrollToBottom,
      toast,
      copy.sendFailedTitle,
      copy.sendFailedDesc,
    ]
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    void sendTextMessage(draft);
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // On desktop keyboards, Enter sends and Shift+Enter inserts a newline.
    // On touch phones (< 768px / coarse pointer), Enter inserts a newline comfortably and the thumb Send button submits!
    if (e.key === "Enter" && !e.shiftKey) {
      const isTouchMobile =
        typeof window !== "undefined" &&
        (window.matchMedia("(max-width: 767px)").matches ||
          window.matchMedia("(pointer: coarse)").matches);
      if (!isTouchMobile) {
        e.preventDefault();
        if (draft.trim()) {
          void sendTextMessage(draft);
        }
      }
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    const ta = composerRef.current;
    if (!ta) {
      setDraft((prev) => `${prev}${emoji}`);
      return;
    }
    const start = ta.selectionStart ?? draft.length;
    const end = ta.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`;
    setDraft(next);
    requestAnimationFrame(() => {
      ta.focus({ preventScroll: true });
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  // Gentle iOS-style left-edge swipe right to return to Conversations list on mobile
  const handleChatTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    if (t.clientX <= 42) {
      swipeStartRef.current = { x: t.clientX, y: t.clientY };
    } else {
      swipeStartRef.current = null;
    }
  };

  const handleChatTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || e.changedTouches.length !== 1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = Math.abs(t.clientY - start.y);
    if (dx > 72 && dy < 54) {
      setMobileView("list");
    }
  };

  const friendIds = useMemo(() => new Set(friends.map((f) => f.id)), [friends]);

  const selectableMembers = useMemo(() => {
    const q = searchMember.trim().replace(/^@+/, "").toLowerCase();
    return Array.from(memberById.values())
      .filter((m) => {
        if (m.id === currentUserId) return false;
        if (isUserBlocked(m.id)) return false;
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
  }, [memberById, currentUserId, searchMember, friendIds, isUserBlocked]);

  if (!isAuthenticated) {
    return (
      <div className="pt-[calc(4.75rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-12 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl card-surface border border-white/[0.08] p-7 sm:p-10 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-accent" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {copy.guestTitle}
            </h1>
            <p className="text-sm text-[#9EA4B8] leading-relaxed">
              {copy.guestSub}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => openAuthModal("signin")}
              className="h-11 px-6 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold shadow-accent transition-colors cursor-pointer"
            >
              {copy.signIn}
            </button>
            <button
              type="button"
              onClick={() => openAuthModal("signup")}
              className="h-11 px-5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white text-sm font-medium transition-colors cursor-pointer"
            >
              {copy.signUp}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const canSend = draft.trim().length > 0;
  const isSending = sendingCount > 0;

  return (
    <div className="pt-[calc(4.5rem+env(safe-area-inset-top))] sm:pt-24 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-12 max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 space-y-3.5 sm:space-y-5 [overflow-anchor:none]">
      {/* Page Header — hidden on mobile when inside full-screen chat */}
      <div
        className={cn(
          "flex items-center sm:items-end justify-between gap-3",
          mobileView === "chat" && activeThread && "hidden md:flex"
        )}
      >
        <div className="min-w-0">
          <p className="text-[10.5px] sm:text-[11px] font-mono uppercase tracking-[0.18em] text-accent mb-0.5 sm:mb-1 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {copy.eyebrow} · {realtimeLive ? copy.realtimeLive : copy.realtimePoll}
            </span>
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-editorial">
            {copy.title}
          </h1>
        </div>

        {/* "Nouvelle discussion" Trigger + Desktop Popover / Mobile Bottom Sheet */}
        <div ref={newChatPickerRef} className="relative shrink-0">
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => setNewChatOpen((v) => !v)}
            className="h-10 px-3.5 sm:px-4 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent inline-flex items-center gap-1.5 cursor-pointer"
          >
            {newChatOpen ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <UserPlus className="w-3.5 h-3.5" />
            )}
            <span className="hidden xs:inline sm:inline">
              {newChatOpen ? copy.closeList : copy.newChat}
            </span>
            <span className="xs:hidden sm:hidden">
              {newChatOpen ? copy.closeList : "+"}
            </span>
          </motion.button>

          <AnimatePresence>
            {newChatOpen && (
              <>
                {/* Mobile Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setNewChatOpen(false)}
                  className="sm:hidden fixed inset-0 z-[68] bg-black/70 backdrop-blur-sm"
                />

                {/* Mobile Native Bottom Sheet / Desktop Floating Popover */}
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 sm:rounded-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:z-40 sm:w-[400px] bg-surface-solid/98 backdrop-blur-2xl border-t sm:border border-accent/35 shadow-[0_24px_64px_rgba(0,0,0,0.88)] p-4 space-y-3"
                >
                  {/* Mobile Bottom Sheet Drag Handle */}
                  <div className="sm:hidden w-10 h-1 rounded-full bg-white/20 mx-auto mb-1" />

                  <div className="flex items-center justify-between sm:hidden">
                    <p className="text-sm font-semibold text-white">{copy.newChat}</p>
                    <button
                      type="button"
                      onClick={() => setNewChatOpen(false)}
                      className="w-8 h-8 rounded-full bg-white/[0.07] flex items-center justify-center text-[#9A9EAE]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-[#7D8296] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchMember}
                      onChange={(e) => setSearchMember(e.target.value)}
                      placeholder={copy.searchMembers}
                      className="w-full h-10 pl-9.5 pr-3 rounded-xl bg-obsidian/90 border border-white/[0.1] text-sm sm:text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 max-h-[52dvh] sm:max-h-60 overflow-y-auto overscroll-contain pr-0.5">
                    {selectableMembers.length === 0 ? (
                      <p className="text-xs text-[#858A9E] py-4 text-center w-full">
                        {copy.noMembers}
                      </p>
                    ) : (
                      selectableMembers.map((m) => {
                        const isFriend = friendIds.has(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => selectPartner(m.id)}
                            className={cn(
                              "w-full sm:w-auto px-3 py-2.5 sm:py-1.5 rounded-xl bg-obsidian/85 hover:bg-accent/20 border flex items-center justify-between sm:justify-start gap-2.5 text-xs text-white transition-colors cursor-pointer active:scale-[0.98]",
                              isFriend
                                ? "border-emerald-400/40"
                                : "border-white/[0.09] hover:border-accent/45"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserAvatar
                                avatarUrl={m.avatarUrl}
                                initials={m.avatarInitials}
                                accentColor={m.accentColor}
                                size="sm"
                              />
                              <div className="min-w-0 text-left">
                                <p className="font-semibold text-white truncate">
                                  {m.displayName}
                                </p>
                                <p className="font-mono text-[10.5px] text-[#858A9E] truncate">
                                  @{m.username}
                                </p>
                              </div>
                            </div>
                            {isFriend && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold shrink-0">
                                {copy.friendBadge}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Two-Pane Inbox: Native mobile list + Full-screen mobile chat sheet; Split pane on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-12 rounded-2xl sm:rounded-3xl card-surface border border-white/[0.09] overflow-hidden min-h-[calc(100dvh-13.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:min-h-0 md:h-[clamp(480px,calc(100dvh-13.5rem),660px)]">
        {/* LEFT: Conversations List */}
        <aside
          className={cn(
            "md:col-span-4 md:border-r border-white/[0.08] bg-obsidian/55 flex-col min-h-0",
            mobileView === "chat" && activeThread ? "hidden md:flex" : "flex"
          )}
        >
          <div className="p-3.5 sm:p-4 border-b border-white/[0.07] space-y-2.5 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-white">
                {copy.conversations} ({conversations.length})
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {realtimeLive ? copy.realtimeLive : copy.realtimePoll}
              </span>
            </div>

            {conversations.length > 2 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#757A8F] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchChats}
                  onChange={(e) => setSearchChats(e.target.value)}
                  placeholder={copy.searchChats}
                  className="w-full h-9 pl-8.5 pr-7 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent/60"
                />
                {searchChats && (
                  <button
                    type="button"
                    onClick={() => setSearchChats("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7D8296] hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-white/[0.05]">
            {filteredConversations.length === 0 ? (
              <div className="p-7 text-center text-xs text-[#858A9E] leading-relaxed space-y-3">
                <MessageSquare className="w-7 h-7 text-accent/60 mx-auto" />
                <p>{copy.emptyInbox}</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const selected = activeThread?.partnerId === conv.partnerId;
                const lastIsMine = conv.lastMessage?.senderId === currentUserId;
                const hasUnread = conv.unreadCount > 0;
                return (
                  <button
                    key={conv.partnerId}
                    type="button"
                    onClick={() => selectPartner(conv.partnerId)}
                    className={cn(
                      "w-full px-4 py-3.5 sm:p-3.5 text-left transition-all flex items-center gap-3 cursor-pointer active:bg-white/[0.07]",
                      selected
                        ? "md:bg-accent/14 md:border-l-2 md:border-accent bg-white/[0.03]"
                        : "hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="relative shrink-0">
                      <UserAvatar
                        avatarUrl={conv.partnerAvatarUrl}
                        initials={conv.partnerDisplayName.slice(0, 2)}
                        accentColor={conv.partnerAccentColor}
                        alt={conv.partnerDisplayName}
                        size="md"
                      />
                      {hasUnread && (
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent ring-2 ring-obsidian" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-[13.5px] sm:text-xs truncate",
                            hasUnread ? "font-bold text-white" : "font-semibold text-[#F4F3EE]"
                          )}
                        >
                          {conv.partnerDisplayName}
                        </span>
                        {conv.lastMessage && (
                          <span
                            className={cn(
                              "text-[10.5px] sm:text-[10px] shrink-0",
                              hasUnread ? "text-accent-soft font-semibold" : "text-[#7D8296]"
                            )}
                          >
                            {formatRelativeTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          "text-xs sm:text-[11px] truncate mt-0.5",
                          hasUnread ? "text-[#E6E8F2] font-medium" : "text-[#8E93A6]"
                        )}
                      >
                        {conv.lastMessage
                          ? `${lastIsMine ? copy.youPrefix : ""}${conv.lastMessage.body}`
                          : `${copy.startChatPrefix}${conv.partnerUsername}`}
                      </p>
                    </div>
                    {hasUnread ? (
                      <span className="min-w-[22px] h-5.5 px-1.5 rounded-full bg-accent text-accent-fg font-mono text-[10.5px] font-bold flex items-center justify-center shrink-0 shadow-accent">
                        {conv.unreadCount}
                      </span>
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#5A5F73] md:hidden shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* RIGHT: Active Chat Thread — Full-screen 100dvh native sheet on mobile, embedded pane on desktop */}
        <div
          onTouchStart={handleChatTouchStart}
          onTouchEnd={handleChatTouchEnd}
          className={cn(
            "md:col-span-8 flex-col min-h-0",
            mobileView === "list" || !activeThread
              ? "hidden md:flex md:bg-surface/40"
              : "fixed inset-0 z-[60] flex bg-obsidian md:static md:inset-auto md:z-auto md:bg-surface/40"
          )}
        >
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-10 text-center space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-accent" />
              </div>
              <p className="text-sm font-semibold text-white">
                {copy.selectConvTitle}
              </p>
              <p className="text-xs text-[#858A9E] max-w-xs">
                {copy.selectConvSub}
              </p>
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className="md:hidden mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.07] border border-white/[0.12] text-xs font-semibold text-white cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{copy.backToChats}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Unified Native Glass Chat Header (single crisp row on mobile & desktop!) */}
              <div className="px-2.5 sm:px-5 pt-[calc(0.6rem+env(safe-area-inset-top))] pb-2.5 md:py-3.5 border-b border-white/[0.09] bg-surface-solid-header/95 backdrop-blur-2xl flex items-center justify-between gap-2 shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
                <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
                  {/* Thumb-friendly Back button on mobile with badge if other chats have unreads */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setMobileView("list")}
                    aria-label={copy.backToChats}
                    className="md:hidden relative w-10 h-10 rounded-full hover:bg-white/[0.08] active:bg-white/[0.12] flex items-center justify-center text-white shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    {otherThreadsUnreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-fg font-mono text-[9.5px] font-bold flex items-center justify-center">
                        {otherThreadsUnreadCount > 9 ? "9+" : otherThreadsUnreadCount}
                      </span>
                    )}
                  </motion.button>

                  <Link
                    href={`/profile/${encodeURIComponent(activeThread.partnerUsername)}`}
                    className="flex items-center gap-2.5 sm:gap-3 group min-w-0 flex-1"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar
                        avatarUrl={activeThread.partnerAvatarUrl}
                        initials={activeThread.partnerDisplayName.slice(0, 2)}
                        accentColor={activeThread.partnerAccentColor}
                        alt={activeThread.partnerDisplayName}
                        size="sm"
                      />
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-surface-solid-header",
                          realtimeLive ? "bg-emerald-400" : "bg-sky-400"
                        )}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14.5px] sm:text-sm font-semibold text-white group-hover:text-accent-hover transition-colors truncate leading-tight">
                        {activeThread.partnerDisplayName}
                      </p>
                      <p className="text-[11px] font-mono text-[#858A9E] truncate mt-0.5">
                        @{activeThread.partnerUsername}
                      </p>
                    </div>
                  </Link>
                </div>

                <Link
                  href={`/profile/${encodeURIComponent(activeThread.partnerUsername)}`}
                  aria-label={copy.viewProfile}
                  className="h-9 px-2.5 sm:px-3 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.09] text-xs text-[#C8CCE0] hover:text-white inline-flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  <span className="hidden sm:inline">{copy.viewProfile}</span>
                  <span className="sm:hidden">{copy.profileShort}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Messages Stream */}
              <div className="relative flex-1 min-h-0 flex flex-col">
                <div
                  ref={messagesContainerRef}
                  onScroll={handleMessagesScroll}
                  className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-5 py-4 space-y-1.5"
                >
                  {threadMessages.length === 0 ? (
                    <div className="py-10 px-4 text-center space-y-4 max-w-sm mx-auto">
                      <UserAvatar
                        avatarUrl={activeThread.partnerAvatarUrl}
                        initials={activeThread.partnerDisplayName.slice(0, 2)}
                        accentColor={activeThread.partnerAccentColor}
                        alt={activeThread.partnerDisplayName}
                        size="lg"
                        className="mx-auto ring-2 ring-white/10"
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">
                          {copy.emptyThreadPrefix} {activeThread.partnerDisplayName}
                        </p>
                        <p className="text-xs text-[#858A9E]">{copy.emptyThreadSuffix}</p>
                      </div>
                      {/* 1-tap Icebreakers to start chatting effortlessly on mobile */}
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        {copy.icebreakers.map((starter) => (
                          <motion.button
                            key={starter}
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => void sendTextMessage(starter)}
                            className="px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-accent/20 border border-white/[0.1] hover:border-accent/45 text-xs font-medium text-[#ECEBE6] hover:text-white transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3 h-3 text-accent-soft shrink-0" />
                            <span>{starter}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    threadMessages.map((m, idx) => {
                      const isMine = m.senderId === currentUserId;
                      const isOptimistic = m.id.startsWith("opt-");
                      const prev = idx > 0 ? threadMessages[idx - 1] : null;
                      const next = idx < threadMessages.length - 1 ? threadMessages[idx + 1] : null;

                      const showDayDivider =
                        !prev || getDayKey(prev.createdAt) !== getDayKey(m.createdAt);

                      const groupedWithPrev =
                        !showDayDivider &&
                        Boolean(prev) &&
                        prev!.senderId === m.senderId &&
                        new Date(m.createdAt).getTime() -
                          new Date(prev!.createdAt).getTime() <
                          3 * 60 * 1000;

                      const groupedWithNext =
                        Boolean(next) &&
                        getDayKey(next!.createdAt) === getDayKey(m.createdAt) &&
                        next!.senderId === m.senderId &&
                        new Date(next!.createdAt).getTime() -
                          new Date(m.createdAt).getTime() <
                          3 * 60 * 1000;

                      const bubbleRadius = isMine
                        ? cn(
                            "rounded-2xl",
                            groupedWithPrev && "rounded-tr-md",
                            groupedWithNext ? "rounded-br-md" : "rounded-br-sm"
                          )
                        : cn(
                            "rounded-2xl",
                            groupedWithPrev && "rounded-tl-md",
                            groupedWithNext ? "rounded-bl-md" : "rounded-bl-sm"
                          );

                      return (
                        <React.Fragment key={m.id}>
                          {showDayDivider && (
                            <div className="flex justify-center py-2.5">
                              <span className="px-3 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10.5px] font-medium text-[#9A9EAE]">
                                {formatDayDivider(m.createdAt, locale, copy)}
                              </span>
                            </div>
                          )}

                          <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.16 }}
                            className={cn(
                              "flex",
                              isMine ? "justify-end" : "justify-start",
                              groupedWithPrev ? "mt-0.5" : "mt-2.5"
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[84%] sm:max-w-[75%] px-3.5 py-2 text-[14.5px] sm:text-[13.5px] leading-relaxed transition-opacity",
                                bubbleRadius,
                                isMine
                                  ? "bg-gradient-to-br from-accent to-accent-deep text-accent-fg shadow-[0_6px_20px_rgb(var(--shiori-accent-rgb)/0.28)]"
                                  : "bg-surface-solid border border-white/[0.09] text-[#F1F0EC]",
                                isOptimistic && "opacity-75"
                              )}
                            >
                              <p className="whitespace-pre-wrap break-words">{m.body}</p>
                              <div
                                className={cn(
                                  "flex items-center justify-end gap-1 text-[10px] mt-0.5 select-none",
                                  isMine ? "opacity-80" : "text-[#7D8296]"
                                )}
                              >
                                <span>{formatBubbleTime(m.createdAt, locale)}</span>
                                {isMine &&
                                  (isOptimistic ? (
                                    <span title={copy.sending} className="inline-flex items-center">
                                      <Clock className="w-2.5 h-2.5" />
                                    </span>
                                  ) : m.isRead ? (
                                    <span
                                      title={copy.read}
                                      className="inline-flex items-center text-sky-200 font-medium"
                                    >
                                      <CheckCheck className="w-3.5 h-3.5" />
                                    </span>
                                  ) : (
                                    <span
                                      title={copy.sent}
                                      className="inline-flex items-center opacity-75"
                                    >
                                      <Check className="w-3 h-3" />
                                    </span>
                                  ))}
                              </div>
                            </div>
                          </motion.div>
                        </React.Fragment>
                      );
                    })
                  )}
                </div>

                {/* Floating Scroll-to-Latest Pill when user scrolled up in history */}
                <AnimatePresence>
                  {showScrollBottom && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.9 }}
                      onClick={() => scrollToBottom("smooth")}
                      aria-label={copy.jumpToLatest}
                      className="absolute bottom-3 right-3.5 sm:right-5 z-20 h-9 px-3 rounded-full bg-surface-solid/95 backdrop-blur-xl border border-white/[0.15] shadow-[0_10px_28px_rgba(0,0,0,0.65)] text-xs font-semibold text-white inline-flex items-center gap-1 cursor-pointer hover:border-accent/55"
                    >
                      <ChevronDown className="w-4 h-4 text-accent-soft" />
                      <span className="hidden sm:inline">{copy.jumpToLatest}</span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Ultra-Pleasant Auto-Growing Pill Composer + Quick Emoji Strip */}
              <div className="border-t border-white/[0.08] bg-surface-solid-header/95 backdrop-blur-2xl shrink-0 pb-[calc(0.6rem+env(safe-area-inset-bottom))] md:pb-3">
                {/* Toggleable Quick Emoji Strip (1-tap anime/chat reactions) */}
                <AnimatePresence initial={false}>
                  {emojiBarOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.16 }}
                      className="overflow-hidden border-b border-white/[0.06]"
                    >
                      <div className="flex items-center gap-1 overflow-x-auto touch-rail no-scrollbar px-3 py-2">
                        {QUICK_EMOJIS.map((emoji) => (
                          <motion.button
                            key={emoji}
                            type="button"
                            whileTap={{ scale: 0.84 }}
                            onClick={() => handleInsertEmoji(emoji)}
                            className="w-9 h-9 rounded-full hover:bg-white/[0.1] active:bg-accent/25 flex items-center justify-center text-lg shrink-0 transition-colors cursor-pointer"
                          >
                            {emoji}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form
                  onSubmit={handleSend}
                  className="px-2.5 pt-2.5 sm:px-3.5 sm:pt-3 flex items-end gap-2"
                >
                  {/* Unified Frosted Input Pill (Emoji Button + Auto-Grow Textarea) */}
                  <div className="min-w-0 flex-1 flex items-end gap-1 rounded-[24px] bg-obsidian/90 border border-white/[0.12] focus-within:border-accent/65 focus-within:ring-2 focus-within:ring-accent/20 px-1.5 py-1 transition-all">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.88 }}
                      onClick={() => setEmojiBarOpen((v) => !v)}
                      aria-label={copy.emojiLabel}
                      aria-expanded={emojiBarOpen}
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                        emojiBarOpen
                          ? "bg-accent/20 text-accent-soft"
                          : "text-[#8E93A6] hover:text-white hover:bg-white/[0.06]"
                      )}
                    >
                      <Smile className="w-5 h-5" />
                    </motion.button>

                    <textarea
                      ref={composerRef}
                      rows={1}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleComposerKeyDown}
                      placeholder={`${copy.placeholderPrefix} ${activeThread.partnerDisplayName}...`}
                      maxLength={2000}
                      className="min-w-0 flex-1 bg-transparent py-2 pr-2.5 text-[16px] md:text-sm leading-snug text-white placeholder:text-[#686D82] focus:outline-none resize-none max-h-[124px] overflow-y-auto"
                    />
                  </div>

                  {/* Tactile Glowing Circular Send Button (big 44px thumb target on mobile) */}
                  <motion.button
                    type="submit"
                    disabled={!canSend}
                    whileTap={{ scale: 0.88 }}
                    aria-label={copy.send}
                    className={cn(
                      "w-11 h-11 md:w-auto md:h-10 md:px-4 rounded-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold shrink-0 transition-all cursor-pointer",
                      canSend
                        ? "bg-accent hover:bg-accent-hover text-accent-fg shadow-[0_8px_22px_rgb(var(--shiori-accent-rgb)/0.45)]"
                        : "bg-white/[0.07] text-[#6B7085] cursor-not-allowed"
                    )}
                  >
                    <Send
                      className={cn(
                        "w-4 h-4 transition-transform",
                        canSend && "translate-x-[0.5px] -translate-y-[0.5px]",
                        isSending && "animate-pulse"
                      )}
                    />
                    <span className="hidden md:inline">{copy.send}</span>
                  </motion.button>
                </form>

                {draft.length > 1600 && (
                  <p className="px-4 pt-1 text-right text-[10px] font-mono text-amber-300">
                    {draft.length} / 2000
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
