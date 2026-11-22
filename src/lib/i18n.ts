import type { ContentLanguage } from "@/types/media";

export interface ContentLanguageOption {
  id: ContentLanguage;
  code: string;
  label: string;
  shortLabel: string;
  description: string;
  isAutoTranslated: boolean;
}

export const CONTENT_LANGUAGES: ContentLanguageOption[] = [
  {
    id: "fr",
    code: "FR",
    label: "Français (Auto)",
    shortLabel: "Français",
    description: "Traduction automatique en français avec cache partagé.",
    isAutoTranslated: true,
  },
  {
    id: "en",
    code: "EN",
    label: "English (Original)",
    shortLabel: "English",
    description: "Texte original d'AniList sans traduction.",
    isAutoTranslated: false,
  },
  {
    id: "es",
    code: "ES",
    label: "Español (Auto)",
    shortLabel: "Español",
    description: "Traduction automatique en espagnol avec cache partagé.",
    isAutoTranslated: true,
  },
  {
    id: "it",
    code: "IT",
    label: "Italiano (Auto)",
    shortLabel: "Italiano",
    description: "Traduction automatique en italien avec cache partagé.",
    isAutoTranslated: true,
  },
];

export const CONTENT_LANGUAGE_MAP = new Map<ContentLanguage, ContentLanguageOption>(
  CONTENT_LANGUAGES.map((l) => [l.id, l])
);

export const DEFAULT_CONTENT_LANGUAGE: ContentLanguage = "fr";

export function normalizeContentLanguage(value: unknown): ContentLanguage {
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    if (clean === "fr" || clean === "en" || clean === "es" || clean === "it") {
      return clean;
    }
  }
  return DEFAULT_CONTENT_LANGUAGE;
}

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = Number(code);
      return Number.isFinite(n) && n > 0 && n < 0x10ffff
        ? String.fromCodePoint(n)
        : "";
    });
}

/**
 * Sanitizes AniList / translated synopsis HTML strictly allowing only safe inline
 * formatting tags (`<br>`, `<i>`, `<b>`, `<em>`, `<strong>`) with zero attributes.
 */
export function sanitizeSynopsisHtml(raw: string | null | undefined): string {
  if (!raw) return "";

  // 1) Normalize <br> variations & strip any unwanted tags while preserving basic inline tags
  const placeholders: string[] = [];
  const hold = (safeTag: string) => {
    const idx = placeholders.length;
    placeholders.push(safeTag);
    return `\uE000TAG${idx}\uE001`;
  };

  let working = raw
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, () => hold("<br />"))
    .replace(/<\s*i\s*>/gi, () => hold("<i>"))
    .replace(/<\s*\/\s*i\s*>/gi, () => hold("</i>"))
    .replace(/<\s*em\s*>/gi, () => hold("<em>"))
    .replace(/<\s*\/\s*em\s*>/gi, () => hold("</em>"))
    .replace(/<\s*b\s*>/gi, () => hold("<b>"))
    .replace(/<\s*\/\s*b\s*>/gi, () => hold("</b>"))
    .replace(/<\s*strong\s*>/gi, () => hold("<strong>"))
    .replace(/<\s*\/\s*strong\s*>/gi, () => hold("</strong>"));

  // Strip any remaining unknown HTML tags cleanly
  working = working.replace(/<[^>]*>/g, "");

  // Decode entities then re-escape angle brackets so user/external text can never inject HTML
  working = decodeHtmlEntities(working)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Convert raw newlines into <br /> and collapse excessive breaks
  working = working.replace(/\n/g, () => hold("<br />"));

  // Restore safe tags
  working = working.replace(/\uE000TAG(\d+)\uE001/g, (_m, idx) => {
    return placeholders[Number(idx)] ?? "";
  });

  // Tidy excessive consecutive <br /> tags (> 2) and leading/trailing breaks
  working = working
    .replace(/(<br \/>\s*){3,}/g, "<br /><br />")
    .replace(/^(<br \/>\s*)+/, "")
    .replace(/(<br \/>\s*)+$/, "")
    .trim();

  return working;
}

/**
 * Strips all HTML tags (including `<br>` and `<i>`) to produce crisp plain text for previews.
 */
export function synopsisHtmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}
