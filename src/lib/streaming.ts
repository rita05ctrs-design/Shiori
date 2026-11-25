import type { MediaType, StreamingLink } from "@/types/media";

interface RawExternalLink {
  id?: number | null;
  url?: string | null;
  site?: string | null;
  type?: string | null;
  icon?: string | null;
  color?: string | null;
  language?: string | null;
  notes?: string | null;
  isDisabled?: boolean | null;
}

interface RawStreamingEpisode {
  site?: string | null;
  url?: string | null;
}

interface PlatformMeta {
  priority: number;
  shortName?: string;
  fallbackColor: string;
}

const PLATFORM_DIRECTORY: Record<string, PlatformMeta> = {
  crunchyroll: { priority: 1, shortName: "Crunchyroll", fallbackColor: "#F88B24" },
  "animation digital network": { priority: 2, shortName: "ADN", fallbackColor: "#0066FF" },
  adn: { priority: 2, shortName: "ADN", fallbackColor: "#0066FF" },
  netflix: { priority: 3, shortName: "Netflix", fallbackColor: "#E50914" },
  "amazon prime video": { priority: 4, shortName: "Prime Video", fallbackColor: "#00A8E1" },
  "prime video": { priority: 4, shortName: "Prime Video", fallbackColor: "#00A8E1" },
  amazon: { priority: 4, shortName: "Prime Video", fallbackColor: "#00A8E1" },
  "disney plus": { priority: 5, shortName: "Disney+", fallbackColor: "#1D4ED8" },
  "disney+": { priority: 5, shortName: "Disney+", fallbackColor: "#1D4ED8" },
  "apple tv": { priority: 6, shortName: "Apple TV", fallbackColor: "#A1A1AA" },
  hidive: { priority: 7, shortName: "HIDIVE", fallbackColor: "#00BAFF" },
  hulu: { priority: 8, shortName: "Hulu", fallbackColor: "#1CE783" },
  youtube: { priority: 9, shortName: "YouTube", fallbackColor: "#FF0000" },
  "manga plus": { priority: 10, shortName: "MANGA Plus", fallbackColor: "#E50914" },
  "mangaplus": { priority: 10, shortName: "MANGA Plus", fallbackColor: "#E50914" },
  "canal+": { priority: 11, shortName: "Canal+", fallbackColor: "#E4E4E7" },
  wakanim: { priority: 12, shortName: "Wakanim", fallbackColor: "#E50914" },
  "bilibili tv": { priority: 15, shortName: "Bilibili", fallbackColor: "#00A1D6" },
  bilibili: { priority: 15, shortName: "Bilibili", fallbackColor: "#00A1D6" },
  "k manga": { priority: 16, shortName: "K MANGA", fallbackColor: "#2563EB" },
  viz: { priority: 17, shortName: "VIZ", fallbackColor: "#E50914" },
  "webtoons": { priority: 18, shortName: "WEBTOON", fallbackColor: "#00D564" },
  "piccoma": { priority: 19, shortName: "Piccoma", fallbackColor: "#FEC107" },
  "tubi tv": { priority: 20, shortName: "Tubi", fallbackColor: "#FA382F" },
  "max": { priority: 21, shortName: "Max", fallbackColor: "#002BE7" },
};

const UPGRADE_HTTPS_HOSTS = new Set([
  "www.crunchyroll.com",
  "crunchyroll.com",
  "www.hulu.com",
  "hulu.com",
  "www.netflix.com",
  "netflix.com",
  "www.hidive.com",
  "hidive.com",
  "www.primevideo.com",
  "primevideo.com",
  "www.youtube.com",
  "youtube.com",
]);

export function sanitizeStreamingUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (parsed.protocol === "http:" && UPGRADE_HTTPS_HOSTS.has(parsed.hostname.toLowerCase())) {
      parsed.protocol = "https:";
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getStreamingPlatformMeta(site: string): PlatformMeta {
  const key = site.trim().toLowerCase();
  return (
    PLATFORM_DIRECTORY[key] ?? {
      priority: 50,
      shortName: site.trim(),
      fallbackColor: "#E5484D",
    }
  );
}

export function formatStreamingDisplayName(site: string): string {
  return getStreamingPlatformMeta(site).shortName ?? site.trim();
}

export function formatStreamingLanguageTag(
  language: string | null | undefined,
  notes: string | null | undefined
): string | null {
  const lang = (language ?? "").trim().toLowerCase();
  const note = (notes ?? "").trim();

  if (lang === "french" || lang === "fr") return "FR";
  if (lang === "english" || lang === "en") return "EN";
  if (lang === "japanese" || lang === "jp") return "JP";
  if (lang === "spanish" || lang === "es") return "ES";
  if (lang === "german" || lang === "de") return "DE";
  if (lang === "italian" || lang === "it") return "IT";
  if (lang === "korean" || lang === "ko") return "KO";
  if (note && note.length <= 18) return note;
  return null;
}

/**
 * Normalizes, validates, deduplicates, and smart-sorts official AniList streaming links
 * so major & French-relevant platforms (Crunchyroll, ADN, Netflix, Prime Video, Disney+) appear first.
 */
export function normalizeStreamingLinks(
  rawExternalLinks?: RawExternalLink[] | null,
  rawStreamingEpisodes?: RawStreamingEpisode[] | null
): StreamingLink[] {
  const collected: StreamingLink[] = [];
  const seenUrl = new Set<string>();
  const seenSiteKey = new Set<string>();

  for (const item of rawExternalLinks ?? []) {
    if (!item || item.isDisabled) continue;
    if (item.type !== "STREAMING") continue;

    const site = typeof item.site === "string" ? item.site.trim() : "";
    const url = sanitizeStreamingUrl(item.url);
    if (!site || !url) continue;

    const urlKey = url.toLowerCase();
    if (seenUrl.has(urlKey)) continue;
    seenUrl.add(urlKey);

    const meta = getStreamingPlatformMeta(site);
    const langTag = formatStreamingLanguageTag(item.language, item.notes);
    // Keep at most one link per platform unless it explicitly distinguishes a language/region (e.g. FR vs JP)
    const dedupeKey = `${site.toLowerCase()}::${langTag ?? "default"}`;
    if (seenSiteKey.has(dedupeKey)) continue;
    seenSiteKey.add(dedupeKey);

    collected.push({
      id: typeof item.id === "number" && Number.isFinite(item.id) ? item.id : collected.length + 1,
      site,
      url,
      icon: typeof item.icon === "string" && item.icon.startsWith("https://") ? item.icon : null,
      color:
        typeof item.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(item.color.trim())
          ? item.color.trim()
          : meta.fallbackColor,
      language: typeof item.language === "string" && item.language.trim() ? item.language.trim() : null,
      notes: typeof item.notes === "string" && item.notes.trim() ? item.notes.trim() : null,
    });
  }

  // Merge any official site detected via streamingEpisodes if not already present in externalLinks
  for (const ep of rawStreamingEpisodes ?? []) {
    if (!ep?.site || !ep?.url) continue;
    const site = ep.site.trim();
    const url = sanitizeStreamingUrl(ep.url);
    if (!site || !url) continue;
    const alreadyHasSite = collected.some((c) => c.site.toLowerCase() === site.toLowerCase());
    if (alreadyHasSite) continue;

    const meta = getStreamingPlatformMeta(site);
    collected.push({
      id: 900_000 + collected.length,
      site,
      url,
      icon: null,
      color: meta.fallbackColor,
      language: null,
      notes: null,
    });
  }

  // Sort: French-tagged links first among same priority, then major platforms first
  collected.sort((a, b) => {
    const prioA = getStreamingPlatformMeta(a.site).priority;
    const prioB = getStreamingPlatformMeta(b.site).priority;
    if (prioA !== prioB) return prioA - prioB;

    const frA = (a.language ?? "").toLowerCase() === "french" ? 0 : 1;
    const frB = (b.language ?? "").toLowerCase() === "french" ? 0 : 1;
    if (frA !== frB) return frA - frB;

    return a.site.localeCompare(b.site);
  });

  // Keep max 1 entry per site when duplicates only differ by minor notes (preferring FR or default)
  const finalBySite = new Map<string, StreamingLink>();
  for (const link of collected) {
    const k = formatStreamingDisplayName(link.site).toLowerCase();
    if (!finalBySite.has(k)) {
      finalBySite.set(k, link);
    }
  }

  return Array.from(finalBySite.values());
}

export interface RegionalSearchShortcut {
  id: string;
  label: string;
  color: string;
  url: string;
}

/**
 * Generates transparent, clearly-labeled France search shortcuts so viewers can verify
 * regional availability (e.g. ADN, Crunchyroll FR, JustWatch FR) without fabricating links.
 */
export function buildRegionalSearchLinks(
  title: string,
  type: MediaType
): RegionalSearchShortcut[] {
  const q = encodeURIComponent(title.trim());
  if (type === "MANGA") {
    return [
      {
        id: "mangaplus",
        label: "MANGA Plus",
        color: "#E50914",
        url: `https://mangaplus.shueisha.co.jp/search_result?keyword=${q}`,
      },
      {
        id: "izneo",
        label: "Izneo",
        color: "#F97316",
        url: `https://www.izneo.com/fr/search?query=${q}`,
      },
    ];
  }

  return [
    {
      id: "justwatch-fr",
      label: "JustWatch FR",
      color: "#F0B95B",
      url: `https://www.justwatch.com/fr/recherche?q=${q}`,
    },
    {
      id: "crunchyroll-search",
      label: "Crunchyroll",
      color: "#F88B24",
      url: `https://www.crunchyroll.com/fr/search?q=${q}`,
    },
    {
      id: "adn-search",
      label: "ADN",
      color: "#0066FF",
      url: `https://animationdigitalnetwork.com/video?search=${q}`,
    },
  ];
}
