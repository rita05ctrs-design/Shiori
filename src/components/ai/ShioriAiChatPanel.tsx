"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowUp,
  RotateCcw,
  Star,
  Plus,
  Check,
  Bot,
  User as UserIcon,
  Loader2,
  Tv,
  ExternalLink,
  Maximize2,
  X,
  Copy,
  Bookmark,
  BookmarkCheck,
  History,
  Trash2,
  MessageSquarePlus,
  Mic,
  MicOff,
  Square,
  Volume2,
  VolumeX,
  AlertCircle,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { cn, formatScore, getDisplayTitle } from "@/lib/utils";
import { formatStreamingDisplayName } from "@/lib/streaming";
import {
  AI_CHATS_SYNC_EVENT,
  clearActiveAiChat,
  deleteSavedAiChat,
  readActiveAiChat,
  readSavedAiChats,
  sanitizeMessagesForStorage,
  upsertSavedAiChat,
  writeActiveAiChat,
  writeSavedAiChats,
  type SavedAiChat,
} from "@/lib/ai-chat-storage";
import {
  formatRecordingDuration,
  getAudioFileExtension,
  isMediaRecorderSupported,
  isSpeechSynthesisSupported,
  mapMediaDeviceErrorToFrench,
  mergeTranscriptWithDraft,
  pickPreferredSpeechVoice,
  pickSupportedAudioMimeType,
  readVoiceAutoSpeakPref,
  resolveSpeechLocale,
  sanitizeTextForSpeech,
  writeVoiceAutoSpeakPref,
  type VoiceInputStatus,
} from "@/lib/ai-voice";
import type { AiResolvedRecommendation } from "@/lib/ai-recommend";

export interface ChatBubbleMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  recommendations?: AiResolvedRecommendation[];
  streaming?: boolean;
}

interface ChatMetaInfo {
  source: "supabase" | "anilist" | "account" | "local" | "discovery";
  totalSeen: number;
  favoritesCount: number;
  topGenres: string[];
  geminiConfigured: boolean;
}

/**
 * Safely renders simple inline markdown (**bold**, *italic*, `code`) as React nodes.
 */
function renderInlineMarkdown(line: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(line.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      tokens.push(
        <strong key={key++} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      tokens.push(
        <em key={key++} className="italic text-[#D8DBE8]">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      tokens.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-white/[0.08] border border-white/[0.1] font-mono text-[11px] text-kinpaku"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    tokens.push(line.slice(lastIndex));
  }
  return tokens;
}

function FormattedChatText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed text-[#D8DBE8]">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} className="h-1" />;

        if (/^[-•*]\s+/.test(line)) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
              <p className="flex-1">{renderInlineMarkdown(line.replace(/^[-•*]\s+/, ""))}</p>
            </div>
          );
        }

        if (/^\d+\.\s+/.test(line)) {
          const numMatch = /^(\d+\.)\s+(.*)$/.exec(line);
          if (numMatch) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-0.5">
                <span className="font-mono text-xs font-bold text-kinpaku shrink-0 mt-0.5">
                  {numMatch[1]}
                </span>
                <p className="flex-1">{renderInlineMarkdown(numMatch[2])}</p>
              </div>
            );
          }
        }

        return <p key={idx}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

interface ShioriAiChatPanelProps {
  compact?: boolean;
  onClose?: () => void;
  onNavigate?: () => void;
}

export function ShioriAiChatPanel({
  compact = false,
  onClose,
  onNavigate,
}: ShioriAiChatPanelProps) {
  const { library, orderedFavorites, getEntry, quickAdd, toast, contentLanguage } = useShiori();
  const { t, tr, tRelativeTime } = useTranslation();
  const starterPrompts = useMemo(
    () => [t("ai.starter1"), t("ai.starter2"), t("ai.starter3"), t("ai.starter4")],
    [t]
  );
  const [messages, setMessages] = useState<ChatBubbleMessage[]>([]);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [savedChats, setSavedChats] = useState<SavedAiChat[]>([]);
  const [savedDrawerOpen, setSavedDrawerOpen] = useState(false);
  const [hydratedStorage, setHydratedStorage] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [meta, setMeta] = useState<ChatMetaInfo | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Universal voice recording (MediaRecorder + Gemini /api/transcribe) & Read-aloud state
  const [voiceInputSupported, setVoiceInputSupported] = useState(false);
  const [speechOutputSupported, setSpeechOutputSupported] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceInputStatus>("idle");
  const [voiceErrorMsg, setVoiceErrorMsg] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceAutoSpeak, setVoiceAutoSpeak] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const isRecording = voiceStatus === "recording";
  const isRequestingMic = voiceStatus === "requesting";
  const isTranscribing = voiceStatus === "transcribing";

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcribeAbortRef = useRef<AbortController | null>(null);
  const voiceDraftBaseRef = useRef<string>("");
  const voiceCancelledRef = useRef<boolean>(false);
  const voiceAutoSpeakRef = useRef<boolean>(false);
  const lastSpokenAutoMsgIdRef = useRef<string | null>(null);
  const sendMessageRef = useRef<(rawPrompt: string) => Promise<void>>(async () => {});

  const speechLocale = useMemo(
    () => resolveSpeechLocale(contentLanguage),
    [contentLanguage]
  );

  useEffect(() => {
    voiceAutoSpeakRef.current = voiceAutoSpeak;
  }, [voiceAutoSpeak]);

  // Hydrate saved chats, active conversation & browser voice capabilities on mount
  useEffect(() => {
    setVoiceInputSupported(isMediaRecorderSupported());
    setSpeechOutputSupported(isSpeechSynthesisSupported());
    setVoiceAutoSpeak(readVoiceAutoSpeakPref());

    setSavedChats(readSavedAiChats());
    const active = readActiveAiChat();
    if (active && active.messages.length > 0) {
      setMessages(active.messages);
      setActiveSavedId(active.savedChatId);
    }
    setHydratedStorage(true);

    const onSync = () => setSavedChats(readSavedAiChats());
    window.addEventListener(AI_CHATS_SYNC_EVENT, onSync);
    window.addEventListener("storage", onSync);
    return () => {
      window.removeEventListener(AI_CHATS_SYNC_EVENT, onSync);
      window.removeEventListener("storage", onSync);
    };
  }, []);

  // Auto-persist active conversation whenever messages settle (so closing AI or browsing an anime keeps your chat!)
  useEffect(() => {
    if (!hydratedStorage || sending) return;
    const hasStreaming = messages.some((m) => m.streaming);
    if (hasStreaming) return;

    if (messages.length === 0) {
      clearActiveAiChat();
      return;
    }

    const clean = sanitizeMessagesForStorage(messages);
    writeActiveAiChat({
      savedChatId: activeSavedId,
      messages: clean,
      updatedAt: new Date().toISOString(),
    });

    // If this conversation is already saved, keep the saved entry updated automatically
    if (activeSavedId) {
      const currentSaved = readSavedAiChats();
      if (currentSaved.some((c) => c.id === activeSavedId)) {
        const { list } = upsertSavedAiChat(currentSaved, {
          id: activeSavedId,
          messages: clean,
        });
        setSavedChats(list);
        writeSavedAiChats(list);
      }
    }
  }, [hydratedStorage, messages, sending, activeSavedId]);

  // Auto-resize composer textarea cleanly when typing or pasting multi-line text
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const handleCopyMessage = useCallback(async (id: string, text: string) => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for restricted clipboard contexts
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
  }, []);

  const animeSeenCount = useMemo(
    () => library.filter((e) => e.type === "ANIME").length,
    [library]
  );

  // Compact sanitized client snapshot for local/guest mode fallback
  const clientLibraryPayload = useMemo(
    () =>
      library.slice(0, 260).map((e) => ({
        mediaId: e.mediaId,
        type: e.type,
        title: e.title,
        status: e.status,
        score: e.score,
        isFavorite: e.isFavorite,
        genres: e.genres.slice(0, 5),
      })),
    [library]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore browser synth errors
      }
    }
    setSpeakingMsgId(null);
  }, []);

  const speakMessage = useCallback(
    (msgId: string, rawText: string) => {
      if (!isSpeechSynthesisSupported()) {
        toast({
          title: "Lecture vocale indisponible",
          description: "Votre navigateur ne prend pas en charge la synthèse vocale.",
          variant: "info",
        });
        return;
      }

      if (speakingMsgId === msgId) {
        stopSpeaking();
        return;
      }

      const cleanText = sanitizeTextForSpeech(rawText);
      if (!cleanText) return;

      try {
        const synth = window.speechSynthesis;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = speechLocale;
        utterance.rate = 1.03;
        const preferred = pickPreferredSpeechVoice(synth.getVoices(), speechLocale);
        if (preferred) {
          utterance.voice = preferred;
        }
        utterance.onend = () => {
          setSpeakingMsgId((curr) => (curr === msgId ? null : curr));
        };
        utterance.onerror = () => {
          setSpeakingMsgId((curr) => (curr === msgId ? null : curr));
        };
        setSpeakingMsgId(msgId);
        synth.speak(utterance);
      } catch {
        setSpeakingMsgId(null);
      }
    },
    [speakingMsgId, speechLocale, stopSpeaking, toast]
  );

  const toggleVoiceAutoSpeak = useCallback(() => {
    if (!speechOutputSupported) {
      toast({
        title: "Synthèse vocale indisponible",
        description: "Votre navigateur ne prend pas en charge la lecture à voix haute.",
        variant: "info",
      });
      return;
    }
    setVoiceAutoSpeak((prev) => {
      const next = !prev;
      writeVoiceAutoSpeakPref(next);
      if (!next) {
        stopSpeaking();
      }
      toast({
        title: next ? "Réponse vocale activée" : "Réponse vocale désactivée",
        description: next
          ? "Shiori IA lira ses réponses à voix haute."
          : "Vous pouvez toujours cliquer sur Écouter sous chaque réponse.",
        variant: "info",
        durationMs: 3200,
      });
      return next;
    });
  }, [speechOutputSupported, stopSpeaking, toast]);

  const releaseAudioResources = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setRecordingSeconds(0);
  }, []);

  const cancelVoiceInput = useCallback(() => {
    voiceCancelledRef.current = true;
    transcribeAbortRef.current?.abort();
    transcribeAbortRef.current = null;

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore already-stopped recorder
      }
    }
    audioChunksRef.current = [];
    releaseAudioResources();
    setVoiceStatus("idle");
    setVoiceErrorMsg(null);
  }, [releaseAudioResources]);

  const stopVoiceInput = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      releaseAudioResources();
      setVoiceStatus("idle");
      return;
    }
    voiceCancelledRef.current = false;
    try {
      recorder.stop();
    } catch {
      releaseAudioResources();
      setVoiceStatus("idle");
    }
  }, [releaseAudioResources]);

  const startVoiceInput = useCallback(async () => {
    if (sending || voiceStatus === "requesting" || voiceStatus === "transcribing") return;

    // 1. Verify universal MediaRecorder + getUserMedia support (works on Opera GX, Brave, Chrome, Safari, Edge, Firefox)
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      const msg =
        typeof window !== "undefined" && !window.isSecureContext
          ? "L'accès au microphone nécessite une connexion sécurisée (HTTPS ou localhost)."
          : "Votre navigateur ne prend pas en charge l'enregistrement vocal (MediaRecorder indisponible).";
      setVoiceStatus("error");
      setVoiceErrorMsg(msg);
      toast({
        title: "Microphone indisponible",
        description: msg,
        variant: "warning",
        durationMs: 4500,
      });
      return;
    }

    stopSpeaking();
    setVoiceErrorMsg(null);
    setErrorMsg(null);
    voiceDraftBaseRef.current = input;
    voiceCancelledRef.current = false;
    audioChunksRef.current = [];

    // 2. Explicitly call navigator.mediaDevices.getUserMedia({ audio: true }) inside onClick
    //    so the browser always displays the microphone permission popup.
    setVoiceStatus("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg = mapMediaDeviceErrorToFrench(err);
      setVoiceStatus("error");
      setVoiceErrorMsg(msg);
      toast({
        title: "Autorisation microphone requise",
        description: msg,
        variant: "warning",
        durationMs: 5000,
      });
      return;
    }

    // If user clicked Annuler while the browser permission popup was open, release mic cleanly
    if (voiceCancelledRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      setVoiceStatus("idle");
      return;
    }

    // 3. Start universal MediaRecorder (audio/webm or audio/mp4 depending on browser support)
    try {
      const preferredMime = pickSupportedAudioMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        audioChunksRef.current = [];
        releaseAudioResources();
        const msg = "Erreur pendant l'enregistrement audio. Réessayez.";
        setVoiceStatus("error");
        setVoiceErrorMsg(msg);
      };

      recorder.onstop = async () => {
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        const finalMime = recorder.mimeType || preferredMime || "audio/webm";
        releaseAudioResources();

        if (voiceCancelledRef.current) {
          setVoiceStatus("idle");
          return;
        }

        const audioBlob = new Blob(chunks, { type: finalMime });
        if (audioBlob.size < 120) {
          const msg =
            "Enregistrement trop court. Parlez au moins une seconde puis cliquez pour envoyer.";
          setVoiceStatus("error");
          setVoiceErrorMsg(msg);
          return;
        }

        // Send recorded Blob via FormData to universal Gemini /api/transcribe route
        setVoiceStatus("transcribing");
        const controller = new AbortController();
        transcribeAbortRef.current = controller;

        try {
          const formData = new FormData();
          const ext = getAudioFileExtension(finalMime);
          formData.append("audio", audioBlob, `shiori-voice.${ext}`);
          formData.append("lang", contentLanguage);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });

          const data = (await res.json().catch(() => ({}))) as {
            text?: string;
            error?: string;
          };

          if (voiceCancelledRef.current) {
            setVoiceStatus("idle");
            return;
          }

          if (!res.ok) {
            const msg = data?.error || `Erreur lors de la transcription (HTTP ${res.status}).`;
            setVoiceStatus("error");
            setVoiceErrorMsg(msg);
            toast({
              title: "Transcription impossible",
              description: msg,
              variant: "warning",
              durationMs: 4500,
            });
            return;
          }

          const transcribed = typeof data?.text === "string" ? data.text.trim() : "";
          if (!transcribed) {
            const msg =
              "Aucune parole détectée dans l'enregistrement. Réessayez en parlant près du micro.";
            setVoiceStatus("error");
            setVoiceErrorMsg(msg);
            return;
          }

          const combinedPrompt = mergeTranscriptWithDraft(
            voiceDraftBaseRef.current,
            transcribed
          );
          setVoiceErrorMsg(null);
          setErrorMsg(null);
          setVoiceStatus("idle");
          setInput(combinedPrompt);
          void sendMessageRef.current(combinedPrompt);
        } catch (err) {
          if ((err as { name?: string })?.name === "AbortError") {
            setVoiceStatus("idle");
            return;
          }
          const msg = "Erreur réseau lors de l'envoi de l'audio pour transcription.";
          setVoiceStatus("error");
          setVoiceErrorMsg(msg);
        } finally {
          transcribeAbortRef.current = null;
        }
      };

      recorder.start(250);
      setRecordingSeconds(0);
      setVoiceStatus("recording");
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          // Auto-stop at 90s to avoid runaway recordings
          if (next >= 90 && mediaRecorderRef.current?.state === "recording") {
            try {
              mediaRecorderRef.current.stop();
            } catch {
              // ignore
            }
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      stream.getTracks().forEach((track) => track.stop());
      releaseAudioResources();
      const msg = mapMediaDeviceErrorToFrench(err);
      setVoiceStatus("error");
      setVoiceErrorMsg(msg);
      toast({
        title: "Impossible de démarrer l'enregistrement",
        description: msg,
        variant: "warning",
      });
    }
  }, [contentLanguage, input, releaseAudioResources, sending, stopSpeaking, toast, voiceStatus]);

  const toggleVoiceInput = useCallback(() => {
    if (voiceStatus === "requesting" || voiceStatus === "transcribing") {
      cancelVoiceInput();
      return;
    }
    if (voiceStatus === "recording") {
      stopVoiceInput();
      return;
    }
    void startVoiceInput();
  }, [cancelVoiceInput, startVoiceInput, stopVoiceInput, voiceStatus]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      transcribeAbortRef.current?.abort();
      voiceCancelledRef.current = true;
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const sendMessage = useCallback(
    async (rawPrompt: string) => {
      const prompt = rawPrompt.trim();
      if (!prompt || sending) return;

      setErrorMsg(null);
      setInput("");
      setSending(true);

      const userMsgId = `u-${Date.now()}`;
      const assistantMsgId = `a-${Date.now() + 1}`;

      const nextHistory = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: prompt },
      ];

      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: prompt },
        { id: assistantMsgId, role: "assistant", content: "", streaming: true },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;
      let accumulatedReplyText = "";

      try {
        const res = await fetch("/api/recommend-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextHistory,
            clientLibrary: clientLibraryPayload,
            language: contentLanguage,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData?.error || `Impossible de contacter l'assistant (HTTP ${res.status}).`
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleSseBlock = (block: string) => {
          const lines = block.split("\n");
          let eventName = "message";
          const dataLines: string[] = [];

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5).trim());
            }
          }

          if (dataLines.length === 0) return;
          const rawJson = dataLines.join("\n");
          try {
            const payload = JSON.parse(rawJson);
            if (eventName === "meta") {
              setMeta(payload as ChatMetaInfo);
            } else if (eventName === "delta" && typeof payload?.text === "string") {
              accumulatedReplyText += payload.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + payload.text }
                    : m
                )
              );
            } else if (eventName === "recommendations" && Array.isArray(payload?.items)) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, recommendations: payload.items as AiResolvedRecommendation[] }
                    : m
                )
              );
            } else if (eventName === "done") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, streaming: false } : m
                )
              );
            }
          } catch {
            // ignore malformed SSE chunk
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            if (block.trim()) handleSseBlock(block);
          }
        }

        if (buffer.trim()) {
          handleSseBlock(buffer);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, streaming: false } : m
          )
        );

        if (
          voiceAutoSpeakRef.current &&
          accumulatedReplyText.trim() &&
          lastSpokenAutoMsgIdRef.current !== assistantMsgId
        ) {
          lastSpokenAutoMsgIdRef.current = assistantMsgId;
          speakMessage(assistantMsgId, accumulatedReplyText);
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        const msg =
          err instanceof Error
            ? err.message
            : "Erreur réseau lors de la recommandation.";
        setErrorMsg(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    m.content ||
                    "Désolé, je n'ai pas pu générer de réponse pour le moment. Réessayez dans un instant.",
                  streaming: false,
                }
              : m
          )
        );
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    [messages, sending, clientLibraryPayload, contentLanguage, speakMessage]
  );

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const isCurrentChatSaved = useMemo(
    () => Boolean(activeSavedId && savedChats.some((c) => c.id === activeSavedId)),
    [activeSavedId, savedChats]
  );

  const handleSaveCurrentChat = () => {
    const clean = sanitizeMessagesForStorage(messages);
    if (clean.length === 0 || sending) return;
    const { saved, list } = upsertSavedAiChat(savedChats, {
      id: activeSavedId,
      messages: clean,
    });
    setActiveSavedId(saved.id);
    setSavedChats(list);
    writeSavedAiChats(list);
    writeActiveAiChat({
      savedChatId: saved.id,
      messages: clean,
      updatedAt: saved.updatedAt,
    });
    toast({
      title: isCurrentChatSaved ? tr("Chat mis à jour") : tr("Chat enregistré"),
      description:
        saved.recommendedCount > 0
          ? tr("{n} animés conseillés sauvegardés", { n: saved.recommendedCount })
          : saved.title,
      variant: "success",
    });
  };

  const handleLoadSavedChat = (chat: SavedAiChat) => {
    abortRef.current?.abort();
    stopSpeaking();
    if (isRecording || isRequestingMic || isTranscribing) {
      cancelVoiceInput();
    } else {
      setVoiceStatus("idle");
      setVoiceErrorMsg(null);
    }
    setSending(false);
    setErrorMsg(null);
    setMessages(chat.messages);
    setActiveSavedId(chat.id);
    setSavedDrawerOpen(false);
    writeActiveAiChat({
      savedChatId: chat.id,
      messages: chat.messages,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteSavedChat = (chat: SavedAiChat) => {
    const previousList = savedChats;
    const nextList = deleteSavedAiChat(savedChats, chat.id);
    setSavedChats(nextList);
    writeSavedAiChats(nextList);

    const wasActive = activeSavedId === chat.id;
    if (wasActive) {
      setActiveSavedId(null);
    }

    toast({
      title: tr("Conversation supprimée"),
      description: chat.title,
      variant: "info",
      durationMs: 5500,
      action: {
        label: t("common.cancel"),
        onClick: () => {
          setSavedChats(previousList);
          writeSavedAiChats(previousList);
          if (wasActive) setActiveSavedId(chat.id);
        },
      },
    });
  };

  const handleNewChat = () => {
    abortRef.current?.abort();
    stopSpeaking();
    if (isRecording || isRequestingMic || isTranscribing) {
      cancelVoiceInput();
    } else {
      setVoiceStatus("idle");
      setVoiceErrorMsg(null);
    }
    const prevMessages = messages;
    const prevSavedId = activeSavedId;
    setMessages([]);
    setActiveSavedId(null);
    setErrorMsg(null);
    setSending(false);
    setSavedDrawerOpen(false);
    clearActiveAiChat();

    if (prevMessages.length > 0 && !prevSavedId) {
      toast({
        title: tr("Conversation effacée"),
        description: tr("Vous pouvez la restaurer ou démarrer un nouveau chat."),
        variant: "default",
        durationMs: 5000,
        action: {
          label: t("common.cancel"),
          onClick: () => {
            setMessages(prevMessages);
            setActiveSavedId(prevSavedId);
          },
        },
      });
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden bg-surface-solid border border-white/[0.11]",
        compact
          ? "h-full rounded-2xl shadow-[0_28px_80px_rgba(0,0,0,0.88)]"
          : "rounded-2xl sm:rounded-3xl min-h-[340px] sm:min-h-[450px] h-[calc(100dvh-16.5rem)] sm:h-[calc(100dvh-16rem)] max-h-[760px] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
      )}
    >
      {/* Header */}
      <div className="px-3 sm:px-4 py-3.5 border-b border-white/[0.08] bg-gradient-to-r from-[#141724] via-[#11131E] to-[#191118] flex items-center justify-between gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent-deep border border-white/20 flex items-center justify-center shadow-[0_0_20px_rgba(229,72,77,0.45)] shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#F4F3EE] truncate">
                {t("ai.pageTitle")}
              </h2>
              <span className="px-1.5 py-0.5 rounded-md bg-kinpaku/15 border border-kinpaku/35 font-mono text-[9.5px] font-bold text-kinpaku uppercase tracking-wider">
                Gemini
              </span>
            </div>
            <p className="text-[11px] text-[#8E93A6] truncate">
              {meta
                ? tr("{seen} vus exclus · {favs} favoris analysés", {
                    seen: meta.totalSeen,
                    favs: meta.favoritesCount,
                  })
                : tr("{seen} animés exclus · {favs} favoris pris en compte", {
                    seen: animeSeenCount,
                    favs: orderedFavorites.length,
                  })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Auto Read-Aloud Toggle (Réponse vocale) */}
          <button
            type="button"
            onClick={toggleVoiceAutoSpeak}
            title={
              voiceAutoSpeak
                ? tr("Réponse vocale automatique activée (cliquer pour couper)")
                : tr("Activer la lecture vocale automatique des réponses")
            }
            aria-label={
              voiceAutoSpeak
                ? tr("Désactiver la réponse vocale automatique")
                : tr("Activer la réponse vocale automatique")
            }
            aria-pressed={voiceAutoSpeak}
            className={cn(
              "w-8 h-8 rounded-xl border flex items-center justify-center transition-colors cursor-pointer shrink-0",
              voiceAutoSpeak
                ? "bg-kinpaku/16 border-kinpaku/45 text-kinpaku"
                : "bg-white/[0.05] hover:bg-white/[0.12] border-white/[0.08] text-[#A5A9BB] hover:text-white"
            )}
          >
            {voiceAutoSpeak ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Save Current Chat Button */}
          {messages.length > 0 && !sending && (
            <button
              type="button"
              onClick={handleSaveCurrentChat}
              title={
                isCurrentChatSaved
                  ? tr("Conversation enregistrée (cliquer pour mettre à jour)")
                  : tr("Enregistrer cette conversation et ses animés conseillés")
              }
              aria-label={tr("Enregistrer cette conversation")}
              className={cn(
                "h-8 px-2.5 rounded-xl border text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer",
                isCurrentChatSaved
                  ? "bg-kinpaku/16 border-kinpaku/45 text-kinpaku"
                  : "bg-white/[0.05] hover:bg-kinpaku/15 border-white/[0.09] hover:border-kinpaku/40 text-[#CFD3E2] hover:text-kinpaku"
              )}
            >
              {isCurrentChatSaved ? (
                <BookmarkCheck className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Bookmark className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="hidden sm:inline">
                {isCurrentChatSaved ? t("common.saved") : t("common.save")}
              </span>
            </button>
          )}

          {/* Saved Conversations Drawer Toggle */}
          <button
            type="button"
            onClick={() => setSavedDrawerOpen((v) => !v)}
            title={t("ai.savedChats")}
            aria-label={t("ai.savedChats")}
            aria-expanded={savedDrawerOpen}
            className={cn(
              "h-8 px-2 rounded-xl border text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer",
              savedDrawerOpen
                ? "bg-accent/20 border-accent/50 text-white"
                : "bg-white/[0.05] hover:bg-white/[0.12] border-white/[0.08] text-[#B8BCCB] hover:text-white"
            )}
          >
            <History className="w-3.5 h-3.5 shrink-0" />
            {savedChats.length > 0 && (
              <span className="font-mono text-[10px] px-1 rounded bg-white/[0.1] text-white">
                {savedChats.length}
              </span>
            )}
          </button>

          {/* Clear / Start New Conversation */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleNewChat}
              title={tr("Effacer et démarrer une nouvelle conversation")}
              aria-label={tr("Nouvelle conversation")}
              className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-[#A5A9BB] hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          {compact && (
            <Link
              href="/assistant"
              onClick={onClose}
              title={tr("Ouvrir en plein écran")}
              aria-label={tr("Ouvrir en plein écran")}
              className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-[#A5A9BB] hover:text-white transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </Link>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.close")}
              className="w-8 h-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-[#A5A9BB] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Saved Conversations Panel (Load or Delete saved AI chats & their recommended anime) */}
      <AnimatePresence initial={false}>
        {savedDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-b border-white/[0.08] bg-[#0B0D16] shrink-0"
          >
            <div className="p-3 space-y-2.5 max-h-[250px] overflow-y-auto overscroll-contain">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-kinpaku flex items-center gap-1.5">
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>
                    {t("ai.savedChats")} ({savedChats.length})
                  </span>
                </p>
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-accent text-[11px] font-semibold text-white transition-colors cursor-pointer"
                >
                  <MessageSquarePlus className="w-3 h-3" />
                  <span>{t("common.new")}</span>
                </button>
              </div>

              {savedChats.length === 0 ? (
                <p className="text-xs text-[#8A8FA4] py-3 text-center">
                  {t("ai.noSavedChats")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {savedChats.map((chat) => {
                    const isActive = chat.id === activeSavedId;
                    return (
                      <div
                        key={chat.id}
                        className={cn(
                          "rounded-xl p-2 border transition-colors flex items-center gap-2.5",
                          isActive
                            ? "bg-accent/14 border-accent/45"
                            : "bg-surface/80 border-white/[0.07] hover:border-white/[0.16]"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleLoadSavedChat(chat)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          {/* Mini poster preview stack of recommended anime */}
                          {chat.previewCovers.length > 0 && (
                            <div className="flex -space-x-2 shrink-0">
                              {chat.previewCovers.map((src, i) => (
                                <img
                                  key={`${chat.id}-cov-${i}`}
                                  src={src}
                                  alt=""
                                  loading="lazy"
                                  className="w-7 h-10 rounded-md object-cover border border-[#0B0D16] shadow"
                                />
                              ))}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-[#F4F3EE] truncate">
                                {chat.title}
                              </p>
                              {isActive && (
                                <span className="px-1.5 py-0.2 rounded bg-accent text-accent-fg text-[9.5px] font-bold uppercase shrink-0">
                                  {tr("Ouvert")}
                                </span>
                              )}
                            </div>
                            <p className="text-[10.5px] font-mono text-[#8A8FA4] truncate mt-0.5">
                              {chat.recommendedCount > 0
                                ? tr("{n} animés conseillés", { n: chat.recommendedCount })
                                : tr("{n} messages", { n: chat.messages.length })}
                              {" · "}
                              {tRelativeTime(chat.updatedAt)}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSavedChat(chat)}
                          title={tr("Supprimer cette conversation")}
                          aria-label={tr("Supprimer cette conversation")}
                          className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-rose-500/20 border border-white/[0.07] hover:border-rose-400/40 flex items-center justify-center text-[#8A8FA4] hover:text-rose-300 transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 bg-obsidian/55"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-between gap-5 py-2">
            <div className="space-y-3 text-center max-w-md mx-auto my-auto">
              <div className="w-12 h-12 rounded-2xl bg-accent/14 border border-accent/35 mx-auto flex items-center justify-center">
                <Bot className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-base font-semibold text-[#F4F3EE]">
                  {t("ai.welcomeTitle")}
                </p>
                <p className="text-xs text-[#8E93A6] mt-1 leading-relaxed">
                  {t("ai.welcomeSub")}
                </p>
              </div>

              {/* Quick Starter Prompt Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-left">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="p-2.5 rounded-xl bg-white/[0.035] hover:bg-accent/14 border border-white/[0.08] hover:border-accent/40 text-xs text-[#D6D9E6] hover:text-white transition-all cursor-pointer leading-snug"
                  >
                    <Sparkles className="w-3 h-3 text-kinpaku inline mr-1.5 -mt-0.5" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-accent/18 border border-accent/35 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "min-w-0 space-y-3",
                      isUser ? "max-w-[85%]" : "flex-1 max-w-[92%]"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 select-text cursor-text",
                        isUser
                          ? "bg-accent text-accent-fg font-medium text-[13px] rounded-tr-sm shadow-[0_8px_24px_rgba(229,72,77,0.28)]"
                          : "bg-surface border border-white/[0.09] rounded-tl-sm"
                      )}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed select-text">
                          {msg.content}
                        </p>
                      ) : msg.content ? (
                        <div className="select-text">
                          <FormattedChatText text={msg.content} />
                          {msg.streaming && (
                            <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-accent animate-pulse rounded-sm" />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-[#9A9EAE] py-0.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                          <span>{t("ai.analyzing")}</span>
                        </div>
                      )}
                    </div>

                    {/* 1-Click Copy & Listen Actions on every completed message */}
                    {msg.content && !msg.streaming && (
                      <div
                        className={cn(
                          "flex items-center gap-1.5 flex-wrap",
                          isUser ? "justify-end" : "justify-start"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => void handleCopyMessage(msg.id, msg.content)}
                          aria-label="Copier le message"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-medium text-[#8A8FA4] hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-300">{t("common.copied")}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>{t("common.copy")}</span>
                            </>
                          )}
                        </button>

                        {!isUser && speechOutputSupported && (
                          <button
                            type="button"
                            onClick={() => speakMessage(msg.id, msg.content)}
                            aria-label={
                              speakingMsgId === msg.id
                                ? t("common.stop")
                                : t("common.listen")
                            }
                            aria-pressed={speakingMsgId === msg.id}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-medium transition-colors cursor-pointer",
                              speakingMsgId === msg.id
                                ? "bg-kinpaku/15 text-kinpaku border border-kinpaku/35"
                                : "text-[#8A8FA4] hover:text-kinpaku hover:bg-white/[0.07]"
                            )}
                          >
                            {speakingMsgId === msg.id ? (
                              <>
                                <Square className="w-2.5 h-2.5 fill-current animate-pulse" />
                                <span>{t("common.stop")}</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3 h-3" />
                                <span>{t("common.listen")}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Structured Clickable Anime Recommendations */}
                    {!isUser && msg.recommendations && msg.recommendations.length > 0 && (
                      <div
                        className={cn(
                          "grid gap-2.5",
                          compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
                        )}
                      >
                        {msg.recommendations.map((rec) => {
                          const m = rec.media;
                          const title = getDisplayTitle(m);
                          const entry = getEntry(m.id);
                          const primaryStream = m.streamingLinks?.[0] ?? null;

                          return (
                            <div
                              key={m.id}
                              className="group rounded-2xl p-2.5 bg-surface border border-white/[0.09] hover:border-accent/45 transition-all flex items-start gap-3"
                            >
                              <Link
                                href={`/media/${m.id}`}
                                onClick={onNavigate}
                                className="relative w-14 aspect-[2/3] rounded-xl overflow-hidden shrink-0 border border-white/12 bg-[#121521]"
                              >
                                <img
                                  src={m.coverImage.large || m.coverImage.extraLarge}
                                  alt={title}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              </Link>

                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <Link
                                    href={`/media/${m.id}`}
                                    onClick={onNavigate}
                                    className="text-xs font-semibold text-[#F4F3EE] hover:text-accent-hover transition-colors line-clamp-1"
                                  >
                                    {title}
                                  </Link>
                                  {m.averageScore && (
                                    <span className="inline-flex items-center gap-0.5 font-mono text-[10.5px] font-bold text-kinpaku shrink-0">
                                      <Star className="w-2.5 h-2.5 fill-current" />
                                      {formatScore(m.averageScore)}
                                    </span>
                                  )}
                                </div>

                                <p className="text-[11px] text-[#9A9EAE] line-clamp-2 leading-snug">
                                  {rec.reason}
                                </p>

                                <div className="flex items-center justify-between gap-1.5 pt-1 flex-wrap">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {rec.matchTag && (
                                      <span className="px-1.5 py-0.5 rounded bg-kinpaku/12 border border-kinpaku/30 text-[10px] font-medium text-kinpaku">
                                        {rec.matchTag}
                                      </span>
                                    )}
                                    {primaryStream && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.09] text-[10px] text-[#CFD3E2]">
                                        <Tv className="w-2.5 h-2.5 text-accent-soft" />
                                        {formatStreamingDisplayName(primaryStream.site)}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!entry) quickAdd(m, "PLAN_TO_WATCH");
                                      }}
                                      className={cn(
                                        "h-6.5 px-2 rounded-lg text-[10.5px] font-semibold inline-flex items-center gap-1 border transition-colors cursor-pointer",
                                        entry
                                          ? "bg-emerald-500/18 border-emerald-400/40 text-emerald-300"
                                          : "bg-accent/18 hover:bg-accent border-accent/40 text-accent-soft hover:text-accent-fg"
                                      )}
                                    >
                                      {entry ? (
                                        <>
                                          <Check className="w-3 h-3" />
                                          <span>{t("common.added")}</span>
                                        </>
                                      ) : (
                                        <>
                                          <Plus className="w-3 h-3" />
                                          <span>{t("ai.toWatchBtn")}</span>
                                        </>
                                      )}
                                    </button>
                                    <Link
                                      href={`/media/${m.id}`}
                                      onClick={onNavigate}
                                      aria-label={`Ouvrir ${title}`}
                                      className="w-6.5 h-6.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-[#B8BCCB] hover:text-white transition-colors"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </Link>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-lg bg-white/[0.08] border border-white/[0.12] flex items-center justify-center shrink-0 mt-0.5">
                      <UserIcon className="w-3.5 h-3.5 text-[#D8DBE8]" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {errorMsg && (
          <div className="px-3 py-2 rounded-xl bg-rose-500/12 border border-rose-500/30 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Refined Floating Glass Input Composer (Text + Universal Voice Recording via Gemini) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isRecording) {
            stopVoiceInput();
            return;
          }
          if (isRequestingMic || isTranscribing) {
            cancelVoiceInput();
          }
          setVoiceErrorMsg(null);
          void sendMessage(input);
        }}
        className="p-2.5 sm:p-3.5 border-t border-white/[0.07] bg-gradient-to-t from-[#090B12] via-[#0D101B] to-[#0F121E]/95 shrink-0 space-y-2"
      >
        <AnimatePresence initial={false} mode="wait">
          {isRequestingMic && (
            <motion.div
              key="voice-requesting"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16 }}
              role="status"
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-kinpaku/14 border border-kinpaku/45 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-kinpaku shrink-0" />
                <span className="text-[#F4F3EE] font-medium truncate">
                  {t("ai.requestingBanner")}
                </span>
              </div>
              <button
                type="button"
                onClick={cancelVoiceInput}
                aria-label={t("common.cancel")}
                className="px-2 py-0.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] text-[#D4D7E4] hover:text-white text-[11px] font-medium transition-colors cursor-pointer shrink-0"
              >
                {t("common.cancel")}
              </button>
            </motion.div>
          )}

          {isRecording && (
            <motion.div
              key="voice-recording"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16 }}
              role="status"
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-accent/14 border border-accent/45 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex items-end gap-0.5 h-3.5 shrink-0" aria-hidden="true">
                  <span className="w-0.5 h-2 rounded-full bg-accent animate-pulse" />
                  <span
                    className="w-0.5 h-3.5 rounded-full bg-kinpaku animate-pulse"
                    style={{ animationDelay: "120ms" }}
                  />
                  <span
                    className="w-0.5 h-2.5 rounded-full bg-accent animate-pulse"
                    style={{ animationDelay: "240ms" }}
                  />
                </span>
                <span className="text-[#F4F3EE] font-medium truncate">
                  {t("ai.listeningBanner")}
                </span>
                <span className="font-mono text-[11px] text-kinpaku font-semibold shrink-0">
                  {formatRecordingDuration(recordingSeconds)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={stopVoiceInput}
                  className="px-2.5 py-0.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {t("common.send")}
                </button>
                <button
                  type="button"
                  onClick={cancelVoiceInput}
                  aria-label={t("common.cancel")}
                  className="px-2 py-0.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] text-[#D4D7E4] hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </motion.div>
          )}

          {isTranscribing && (
            <motion.div
              key="voice-transcribing"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16 }}
              role="status"
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-kinpaku/14 border border-kinpaku/45 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-kinpaku shrink-0" />
                <span className="text-[#F4F3EE] font-medium truncate">
                  {t("ai.transcribingBanner")}
                </span>
              </div>
              <button
                type="button"
                onClick={cancelVoiceInput}
                aria-label={t("common.cancel")}
                className="px-2 py-0.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.14] text-[#D4D7E4] hover:text-white text-[11px] font-medium transition-colors cursor-pointer shrink-0"
              >
                {t("common.cancel")}
              </button>
            </motion.div>
          )}

          {voiceStatus === "error" && voiceErrorMsg && (
            <motion.div
              key="voice-error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16 }}
              role="alert"
              className="flex items-start justify-between gap-2 px-3 py-2 rounded-xl bg-rose-500/14 border border-rose-500/40 text-xs text-rose-100"
            >
              <div className="flex items-start gap-2 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{voiceErrorMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVoiceStatus("idle");
                  setVoiceErrorMsg(null);
                }}
                aria-label="Fermer le message d'erreur micro"
                className="w-5 h-5 rounded-md bg-white/[0.07] hover:bg-white/[0.15] flex items-center justify-center text-rose-200 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={cn(
            "group flex items-center gap-1.5 sm:gap-2 rounded-2xl bg-[#07080C]/95 border px-2 sm:px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_28px_rgba(0,0,0,0.45)] transition-all",
            isRecording
              ? "border-accent/80 ring-2 ring-accent/25"
              : isRequestingMic || isTranscribing
                ? "border-kinpaku/75 ring-2 ring-kinpaku/25"
                : voiceStatus === "error"
                  ? "border-rose-500/55 ring-1 ring-rose-500/20"
                  : "border-white/[0.12] hover:border-white/[0.2] focus-within:border-accent/70 focus-within:ring-2 focus-within:ring-accent/20"
          )}
        >
          <span
            aria-hidden="true"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-accent/18 to-kinpaku/12 border border-white/[0.08] flex items-center justify-center shrink-0 transition-transform group-focus-within:scale-105"
          >
            <Sparkles className="w-3.5 h-3.5 text-kinpaku" />
          </span>

          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (voiceStatus === "error") {
                setVoiceStatus("idle");
                setVoiceErrorMsg(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && (isRecording || isRequestingMic || isTranscribing)) {
                e.preventDefault();
                cancelVoiceInput();
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (isRecording) {
                  stopVoiceInput();
                  return;
                }
                if (isRequestingMic || isTranscribing) {
                  cancelVoiceInput();
                }
                setVoiceErrorMsg(null);
                void sendMessage(input);
              }
            }}
            placeholder={
              isRequestingMic
                ? t("ai.placeholderRequesting")
                : isRecording
                  ? t("ai.placeholderRecording")
                  : isTranscribing
                    ? t("ai.placeholderTranscribing")
                    : t("ai.placeholder")
            }
            aria-label="Écrire ou dicter un message à Shiori IA"
            className="flex-1 min-w-0 resize-none bg-transparent py-2 px-1 max-h-[120px] overflow-y-auto text-[16px] sm:text-sm text-[#F4F3EE] placeholder:text-[#7E849C] focus:outline-none leading-snug select-text touch-manipulation"
          />

          {/* Universal Voice Recording Microphone Button (MediaRecorder -> Gemini /api/transcribe) */}
          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={sending}
            data-voice-status={voiceStatus}
            title={
              isRequestingMic
                ? "Demande d'autorisation du microphone en cours…"
                : isRecording
                  ? "Arrêter l'enregistrement et envoyer à Shiori IA"
                  : isTranscribing
                    ? "Transcription Gemini en cours…"
                    : voiceStatus === "error"
                      ? "Réessayer l'enregistrement vocal"
                      : voiceInputSupported
                        ? "Parler à Shiori IA (enregistrement vocal universel)"
                        : "Enregistrement vocal (microphone requis)"
            }
            aria-label={
              isRequestingMic
                ? "Annuler la demande d'autorisation du microphone"
                : isRecording
                  ? "Arrêter et envoyer le message vocal"
                  : isTranscribing
                    ? "Annuler la transcription vocale"
                    : "Parler à Shiori IA avec le micro"
            }
            aria-pressed={isRecording}
            className={cn(
              "relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 disabled:opacity-35",
              isRecording
                ? "bg-accent border-accent text-white shadow-[0_0_20px_rgba(229,72,77,0.65)]"
                : isRequestingMic || isTranscribing
                  ? "bg-kinpaku/20 border-kinpaku/65 text-kinpaku shadow-[0_0_16px_rgba(240,185,91,0.35)]"
                  : voiceStatus === "error"
                    ? "bg-rose-500/18 hover:bg-rose-500/28 border-rose-500/55 text-rose-200 hover:text-white"
                    : voiceInputSupported
                      ? "bg-white/[0.05] hover:bg-accent/18 border-white/[0.1] hover:border-accent/45 text-[#CFD3E2] hover:text-white"
                      : "bg-white/[0.03] border-white/[0.07] text-[#6E7389] hover:text-[#B8BCCB]"
            )}
          >
            {isRecording && (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-xl border border-accent animate-ping opacity-55 pointer-events-none"
              />
            )}
            {isRequestingMic || isTranscribing ? (
              <Loader2 className="w-4 h-4 animate-spin relative z-10" />
            ) : isRecording ? (
              <Square className="w-3.5 h-3.5 fill-current relative z-10" />
            ) : voiceStatus === "error" ? (
              <MicOff className="w-4 h-4 relative z-10" />
            ) : (
              <Mic className="w-4 h-4 relative z-10" />
            )}
          </button>

          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Envoyer le message"
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent-deep hover:brightness-110 disabled:opacity-35 disabled:from-white/10 disabled:to-white/10 text-white flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-[0_6px_18px_rgba(229,72,77,0.38)] disabled:shadow-none active:scale-95"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
