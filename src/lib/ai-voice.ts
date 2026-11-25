/**
 * Universal voice recording (MediaRecorder + Gemini /api/transcribe) &
 * speech synthesis helpers for Shiori IA.
 * Works reliably across Opera GX, Brave, Chrome, Edge, Safari, and Firefox
 * without depending on Google's proprietary browser webkitSpeechRecognition endpoint.
 */

export type VoiceInputStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "transcribing"
  | "error";

const VOICE_AUTOSPEAK_STORAGE_KEY = "shiori_ai_voice_autospeak_v1";

const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

export function isMediaRecorderSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * Picks the best MediaRecorder audio MIME type supported by the current browser
 * (audio/webm on Chromium/Opera GX/Brave/Firefox, audio/mp4 on Safari/iOS).
 */
export function pickSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  for (const mime of PREFERRED_AUDIO_MIME_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    } catch {
      // ignore unsupported query
    }
  }
  return "";
}

export function getAudioFileExtension(mimeType: string): string {
  const lower = (mimeType ?? "").toLowerCase();
  if (lower.includes("mp4") || lower.includes("m4a")) return "mp4";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("wav")) return "wav";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "mp3";
  return "webm";
}

export function formatRecordingDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function isSpeechSynthesisSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

/**
 * Maps Shiori's content language code to a BCP-47 speech locale.
 */
export function resolveSpeechLocale(lang?: string | null): string {
  const clean = (lang ?? "fr").trim().toLowerCase();
  if (clean.startsWith("en")) return "en-US";
  if (clean.startsWith("es")) return "es-ES";
  if (clean.startsWith("de")) return "de-DE";
  if (clean.startsWith("it")) return "it-IT";
  if (clean.startsWith("pt")) return "pt-BR";
  if (clean.startsWith("ja")) return "ja-JP";
  return "fr-FR";
}

/**
 * Cleanly combines any pre-existing composer draft with newly transcribed text.
 */
export function mergeTranscriptWithDraft(existingDraft: string, spoken: string): string {
  const base = existingDraft.trim();
  const addition = spoken.replace(/\s+/g, " ").trim();
  if (!addition) return base;
  if (!base) return addition;
  return `${base} ${addition}`;
}

/**
 * Cleans markdown, code fences, emojis, URLs, and recommendation markers
 * so Web Speech synthesis reads Shiori IA's responses naturally aloud.
 */
export function sanitizeTextForSpeech(rawText: string): string {
  if (!rawText) return "";
  return rawText
    .replace(/<{1,4}\s*SHIORI_RECS[\s\S]*$/i, "")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-•*]\s+/gm, "")
    .replace(/[⚠️💡✨🎬⭐🔥📌]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ", ")
    .replace(/\.\s*\./g, ".")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Translates navigator.mediaDevices.getUserMedia DOMExceptions into clear French guidance.
 */
export function mapMediaDeviceErrorToFrench(err: unknown): string {
  const name =
    typeof (err as { name?: unknown })?.name === "string"
      ? (err as { name: string }).name
      : "";
  const message =
    typeof (err as { message?: unknown })?.message === "string"
      ? (err as { message: string }).message
      : "";

  if (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    /permission denied|not allowed/i.test(message)
  ) {
    return "Accès au microphone refusé ou bloqué. Autorisez le micro via l'icône de cadenas dans la barre d'adresse puis réessayez.";
  }

  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    /requested device not found|no audio/i.test(message)
  ) {
    return "Aucun microphone détecté sur cet appareil. Vérifiez qu'un micro est branché ou activé.";
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Le microphone est déjà utilisé par une autre application ou momentanément inaccessible.";
  }

  if (name === "SecurityError") {
    return "L'accès au microphone nécessite une connexion sécurisée (HTTPS ou localhost).";
  }

  if (name === "AbortError") {
    return "La demande d'accès au microphone a été annulée. Cliquez à nouveau sur le micro pour réessayer.";
  }

  if (message.trim()) {
    return message.trim();
  }

  return "Impossible d'accéder au microphone pour le moment.";
}

/**
 * Selects the clearest available speech synthesis voice matching the desired locale.
 */
export function pickPreferredSpeechVoice(
  voices: readonly SpeechSynthesisVoice[],
  locale: string
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;
  const target = locale.toLowerCase();
  const shortLang = target.split("-")[0];

  const matching = voices.filter(
    (v) =>
      v.lang.toLowerCase() === target ||
      v.lang.toLowerCase().startsWith(`${shortLang}-`) ||
      v.lang.toLowerCase() === shortLang
  );
  if (matching.length === 0) return null;

  const preferred = matching.find((v) =>
    /(natural|neural|google|thomas|amelie|amélie|audrey|denise|henri|hortense|samantha)/i.test(
      v.name
    )
  );
  return preferred ?? matching.find((v) => v.default) ?? matching[0];
}

export function readVoiceAutoSpeakPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(VOICE_AUTOSPEAK_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeVoiceAutoSpeakPref(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VOICE_AUTOSPEAK_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore private browsing quota errors
  }
}
