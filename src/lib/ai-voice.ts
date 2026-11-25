/**
 * Web Speech API helpers (voice dictation + speech synthesis) for Shiori IA.
 * Zero external dependencies — works natively on modern desktop & mobile browsers
 * with graceful French fallbacks when unsupported or denied.
 */

export interface BrowserSpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface BrowserSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

export interface BrowserSpeechRecognitionResultList {
  readonly length: number;
  [index: number]: BrowserSpeechRecognitionResult;
}

export interface BrowserSpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: BrowserSpeechRecognitionResultList;
}

export interface BrowserSpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message?: string;
}

export interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((this: BrowserSpeechRecognition, ev: Event) => void) | null;
  onend: ((this: BrowserSpeechRecognition, ev: Event) => void) | null;
  onerror:
    | ((this: BrowserSpeechRecognition, ev: BrowserSpeechRecognitionErrorEvent) => void)
    | null;
  onresult:
    | ((this: BrowserSpeechRecognition, ev: BrowserSpeechRecognitionEvent) => void)
    | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export type VoiceInputStatus = "idle" | "requesting" | "listening" | "error";

const VOICE_AUTOSPEAK_STORAGE_KEY = "shiori_ai_voice_autospeak_v1";

/**
 * Returns the native SpeechRecognition constructor if available in this browser.
 */
export function getSpeechRecognitionConstructor(): BrowserSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/**
 * Maps Shiori's content language code to a BCP-47 speech locale.
 */
export function resolveSpeechLocale(lang?: string | null): string {
  const clean = (lang ?? "fr").trim().toLowerCase();
  if (clean.startsWith("en")) return "en-US";
  if (clean.startsWith("es")) return "es-ES";
  if (clean.startsWith("it")) return "it-IT";
  return "fr-FR";
}

/**
 * Cleanly combines any pre-existing composer draft with newly spoken text.
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
    // Strip any internal recommendation block residue
    .replace(/<{1,4}\s*SHIORI_RECS[\s\S]*$/i, "")
    // Convert markdown links [Label](https://...) to just Label
    .replace(/\[([^\]]+)\]\((?:https?:\/\/|\/)[^)]+\)/g, "$1")
    // Strip bare URLs
    .replace(/https?:\/\/\S+/g, "")
    // Strip markdown code fences & inline formatting markers
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    // Turn markdown bullets into gentle pauses
    .replace(/^\s*[-•*]\s+/gm, "")
    // Remove common UI symbols/emojis that read awkwardly aloud
    .replace(/[⚠️💡✨🎬⭐🔥📌]/g, "")
    // Convert line breaks to sentence pauses
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ", ")
    // Clean duplicate punctuation & extra whitespace
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
 * Translates Web Speech API error codes into clear French messages for the UI.
 */
export function mapSpeechErrorToFrench(errorCode: string): string {
  switch (errorCode) {
    case "not-allowed":
    case "service-not-allowed":
      return "Accès au microphone refusé ou bloqué. Autorisez le micro dans la barre d'adresse de votre navigateur puis réessayez.";
    case "no-speech":
      return "Aucune voix détectée. Parlez plus près du micro et réessayez.";
    case "audio-capture":
      return "Aucun microphone détecté sur cet appareil.";
    case "network":
      return "La reconnaissance vocale nécessite une connexion internet active.";
    case "language-not-supported":
      return "Langue vocale non prise en charge par ce navigateur.";
    case "aborted":
      return "";
    default:
      return "Impossible d'utiliser la dictée vocale pour le moment.";
  }
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

  // Prefer natural / neural / Google / Apple / Microsoft online voices over basic robotic ones
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
