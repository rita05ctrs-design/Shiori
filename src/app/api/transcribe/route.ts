import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // 12 MB (~several minutes of voice)

const DEFAULT_TRANSCRIBE_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.8-flash",
  "gemini-2.5-flash",
] as const;

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/aac",
  "audio/flac",
]);

function sanitizeApiKey(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

function redactSecret(text: string, secret: string): string {
  if (!secret || !text) return text;
  return text.split(secret).join("[REDACTED]");
}

function getTranscribeModelCandidates(): string[] {
  const custom = process.env.GEMINI_MODEL?.trim();
  const ordered = custom
    ? [custom, ...DEFAULT_TRANSCRIBE_MODELS]
    : [...DEFAULT_TRANSCRIBE_MODELS];
  return Array.from(new Set(ordered));
}

function normalizeAudioMimeType(rawType: string | undefined, fileName?: string): string {
  const base = (rawType ?? "").split(";")[0].trim().toLowerCase();
  if (ALLOWED_AUDIO_MIME_TYPES.has(base)) {
    if (base === "audio/x-wav") return "audio/wav";
    if (base === "audio/mp3") return "audio/mpeg";
    if (base === "audio/x-m4a" || base === "audio/m4a") return "audio/mp4";
    return base;
  }

  const lowerName = (fileName ?? "").toLowerCase();
  if (lowerName.endsWith(".mp4") || lowerName.endsWith(".m4a")) return "audio/mp4";
  if (lowerName.endsWith(".ogg") || lowerName.endsWith(".oga")) return "audio/ogg";
  if (lowerName.endsWith(".wav")) return "audio/wav";
  if (lowerName.endsWith(".mp3")) return "audio/mpeg";
  return "audio/webm";
}

function cleanTranscriptionOutput(raw: string): string {
  const trimmed = raw
    .replace(/^```[\w-]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
    .replace(/^["«“]+|["»”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!trimmed) return "";
  if (
    /^[\[\(]?\s*(silence|inaudible|aucun\s+son|rien|vide|no\s+speech|empty|bruit\s+de\s+fond)\s*[\]\)]?\.?$/i.test(
      trimmed
    )
  ) {
    return "";
  }
  return trimmed;
}

type TranscribeDiagnostic = {
  status: number | null;
  shortReason: string;
  rawMessage: string;
  isFatalKeyError: boolean;
  priority: number;
};

function classifyTranscribeError(err: unknown, apiKey: string): TranscribeDiagnostic {
  const status =
    typeof (err as { status?: unknown })?.status === "number"
      ? (err as { status: number }).status
      : null;
  const raw = redactSecret(
    err instanceof Error ? err.message : String(err ?? "Erreur inconnue"),
    apiKey
  );
  const lower = raw.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    /api_key_invalid|api key not valid|permission_denied|unauthenticated/i.test(lower)
  ) {
    return {
      status,
      shortReason: "Clé API Gemini invalide ou refusée (vérifiez GEMINI_API_KEY).",
      rawMessage: raw,
      isFatalKeyError: true,
      priority: 100,
    };
  }

  if (status === 429 || /resource_exhausted|quota|rate limit/i.test(lower)) {
    return {
      status,
      shortReason: "Quota Gemini temporairement dépassé. Réessayez dans quelques secondes.",
      rawMessage: raw,
      isFatalKeyError: false,
      priority: 80,
    };
  }

  if (status === 503 || /high demand|overloaded|service unavailable/i.test(lower)) {
    return {
      status,
      shortReason: "Serveurs Google Gemini momentanément surchargés (503). Réessayez.",
      rawMessage: raw,
      isFatalKeyError: false,
      priority: 70,
    };
  }

  if (status === 400 || /invalid_argument|unsupported/i.test(lower)) {
    return {
      status,
      shortReason: "Format audio refusé par Gemini. Essayez d'enregistrer un peu plus longtemps.",
      rawMessage: raw,
      isFatalKeyError: false,
      priority: 60,
    };
  }

  if (status === 404 || /not_found|is not found|no longer available/i.test(lower)) {
    return {
      status,
      shortReason: "Modèle de transcription Gemini introuvable (404).",
      rawMessage: raw,
      isFatalKeyError: false,
      priority: 20,
    };
  }

  return {
    status,
    shortReason: "Erreur lors de la transcription audio Gemini. Réessayez.",
    rawMessage: raw,
    isFatalKeyError: false,
    priority: 40,
  };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`transcribe:${ip}`, 25, 60_000);
  if (!rl.allowed) {
    return rateLimitResponse(rl.retryAfterSec);
  }

  const geminiKey = sanitizeApiKey(process.env.GEMINI_API_KEY);
  if (!geminiKey) {
    return NextResponse.json(
      { error: "Clé GEMINI_API_KEY manquante côté serveur pour la transcription vocale." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Requête audio invalide (FormData attendu)." },
      { status: 400 }
    );
  }

  const fileField = formData.get("audio") ?? formData.get("file");
  if (!fileField || typeof fileField === "string") {
    return NextResponse.json(
      { error: "Aucun fichier audio reçu pour la transcription." },
      { status: 400 }
    );
  }

  const audioSize = fileField.size;
  if (audioSize < 120) {
    return NextResponse.json(
      { error: "Enregistrement trop court. Maintenez la parole au moins une seconde." },
      { status: 400 }
    );
  }
  if (audioSize > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Fichier audio trop volumineux (maximum 12 Mo)." },
      { status: 413 }
    );
  }

  const rawLang = typeof formData.get("lang") === "string" ? String(formData.get("lang")).trim() : "fr";
  const fileName = "name" in fileField && typeof fileField.name === "string" ? fileField.name : "voice.webm";
  const mimeType = normalizeAudioMimeType(fileField.type, fileName);

  const arrayBuffer = await fileField.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString("base64");

  const instructionPrompt = [
    "Transcris exactement et fidèlement ce qui est dit dans cet enregistrement audio.",
    `Langue attendue principale : ${rawLang.startsWith("en") ? "anglais" : rawLang.startsWith("es") ? "espagnol" : rawLang.startsWith("it") ? "italien" : "français"} (garde la langue réellement parlée, français ou anglais, ainsi que les titres d'animés/mangas prononcés).`,
    "Consignes strictes :",
    "- Renvoie UNIQUEMENT le texte transcrit exact.",
    "- N'ajoute aucun commentaire, aucune explication, aucun guillemet, aucune balise markdown ni ponctuation superflue.",
    "- N'invente JAMAIS de mots : si l'enregistrement ne contient que du silence, du souffle ou du bruit de fond sans voix humaine claire, réponds EXACTEMENT par : [SILENCE]",
  ].join("\n");

  const genAI = new GoogleGenerativeAI(geminiKey);
  const candidateModels = getTranscribeModelCandidates();
  const diagnostics: TranscribeDiagnostic[] = [];

  const attemptModel = async (modelName: string): Promise<{ ok: true; text: string } | { ok: false }> => {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 512,
        },
      });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: base64Audio,
          },
        },
        { text: instructionPrompt },
      ]);

      const rawText = result.response.text() ?? "";
      return { ok: true, text: cleanTranscriptionOutput(rawText) };
    } catch (err) {
      const diag = classifyTranscribeError(err, geminiKey);
      diagnostics.push(diag);
      console.error("[/api/transcribe] Échec transcription Gemini :", {
        model: modelName,
        mimeType,
        audioSize,
        status: diag.status,
        reason: diag.shortReason,
        detail: diag.rawMessage,
      });
      return { ok: false };
    }
  };

  for (const modelName of candidateModels) {
    const res = await attemptModel(modelName);
    if (res.ok) {
      return NextResponse.json({ text: res.text });
    }
    if (diagnostics[diagnostics.length - 1]?.isFatalKeyError) {
      break;
    }
  }

  // Brief retry on primary model if failures were transient 503 spikes
  if (
    candidateModels.length > 0 &&
    diagnostics.some((d) => d.status === 503) &&
    !diagnostics.some((d) => d.isFatalKeyError)
  ) {
    await new Promise((r) => setTimeout(r, 600));
    const retry = await attemptModel(candidateModels[0]);
    if (retry.ok) {
      return NextResponse.json({ text: retry.text });
    }
  }

  const primary =
    diagnostics.length > 0
      ? [...diagnostics].sort((a, b) => b.priority - a.priority)[0]
      : { shortReason: "Transcription audio indisponible pour le moment.", status: 502 };

  return NextResponse.json(
    { error: primary.shortReason },
    { status: primary.status === 401 || primary.status === 403 ? 502 : primary.status ?? 502 }
  );
}
