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

export interface NormalizeStreamingOptions {
  title?: string | null;
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
  "canal+": { priority: 6, shortName: "Canal+", fallbackColor: "#E4E4E7" },
  "apple tv": { priority: 7, shortName: "Apple TV", fallbackColor: "#A1A1AA" },
  "apple tv+": { priority: 7, shortName: "Apple TV", fallbackColor: "#A1A1AA" },
  max: { priority: 8, shortName: "Max", fallbackColor: "#002BE7" },
  "paramount+": { priority: 9, shortName: "Paramount+", fallbackColor: "#0064FF" },
  youtube: { priority: 10, shortName: "YouTube", fallbackColor: "#FF0000" },
  "manga plus": { priority: 11, shortName: "MANGA Plus", fallbackColor: "#E50914" },
  mangaplus: { priority: 11, shortName: "MANGA Plus", fallbackColor: "#E50914" },
  "mangas.io": { priority: 12, shortName: "Mangas.io", fallbackColor: "#F97316" },
  "k manga": { priority: 13, shortName: "K MANGA", fallbackColor: "#2563EB" },
  viz: { priority: 14, shortName: "VIZ", fallbackColor: "#E50914" },
  webtoons: { priority: 15, shortName: "WEBTOON", fallbackColor: "#00D564" },
  webtoon: { priority: 15, shortName: "WEBTOON", fallbackColor: "#00D564" },
};

/**
 * Shut-down services or platforms strictly geo-blocked outside France/Europe
 * (they redirect to GDPR block screens, unrelated homepages, US library logins, or 404s).
 */
const BLOCKED_PLATFORMS = new Set([
  // Defunct / shut-down services
  "funimation",
  "wakanim",
  "vrv",
  "animelab",
  "piccoma",
  "daisuki",
  "viewster",
  "animax",
  "anime network",
  // US / Asia / Non-EU geo-locked platforms
  "hulu",
  "tubi",
  "tubi tv",
  "hoopla",
  "adult swim",
  "hidive",
  "peacock",
  "star+",
  "starz",
  "vudu",
  "retrocrush",
  "midnight pulp",
  "pluto tv",
  "iq",
  "iqiyi",
  "bilibili",
  "bilibili tv",
  "wetv",
  "viu",
  "bahamut",
  "bahamut anime crazy",
  "abema",
  "abema video",
  "niconico",
  "niconico video",
  "muse asia",
  "ani-one asia",
  "mewatch",
  "trueid",
  "catchplay",
  "shahid",
  "disney+ hotstar",
  "laftel",
  "naver",
  "kakaopage",
  "line tv",
  "tver",
  "u-next",
  "unext",
  "d-anime store",
  "dmm tv",
  "fod",
  "lemino",
  "bandai channel",
  "telasa",
]);

const BLOCKED_HOSTS = [
  "wakanim.tv",
  "funimation.com",
  "vrv.co",
  "animelab.com",
  "piccoma.com",
  "hulu.com",
  "tubitv.com",
  "gdpr.tubi.tv",
  "hoopladigital.com",
  "adultswim.com",
  "hidive.com",
  "peacocktv.com",
  "retrocrush.tv",
  "iq.com",
  "iqiyi.com",
  "bilibili.tv",
  "bilibili.com",
  "wetv.vip",
  "viu.com",
  "nicovideo.jp",
  "abema.tv",
  "ani.gamer.com.tw",
  "mewatch.sg",
];

/**
 * Notes indicating a link is region-locked outside France/Europe or merely a promo channel.
 */
const NON_EU_NOTE_EXACT_RE =
  /^(in|us|usa|jp|jpn|sea|asia|latam|kr|tw|hk|ph|th|id|my|sg|au|nz|uk|gb|ca|mx|br|de|it|es|ru|cn|tr|sa|ae|eg|mena)$/i;
const NON_EU_NOTE_SUBSTR_RE =
  /\b(ani-one|muse\s*asia|viz\s*media|b-station|bilibili|asia\s*only|us\s*only|india\s*only|japan\s*only|north\s*america|latin\s*america)\b/i;

const UPGRADE_HTTPS_HOSTS = new Set([
  "www.crunchyroll.com",
  "crunchyroll.com",
  "www.netflix.com",
  "netflix.com",
  "www.primevideo.com",
  "primevideo.com",
  "www.amazon.com",
  "amazon.com",
  "www.disneyplus.com",
  "disneyplus.com",
  "www.youtube.com",
  "youtube.com",
  "animationdigitalnetwork.com",
  "www.animationdigitalnetwork.com",
  "animedigitalnetwork.fr",
  "www.animedigitalnetwork.fr",
]);

function hostMatches(hostname: string, domain: string): boolean {
  const h = hostname.toLowerCase();
  return h === domain || h.endsWith(`.${domain}`);
}

function isBlockedPlatformOrHost(site: string, hostname: string): boolean {
  const siteKey = site.trim().toLowerCase();
  if (BLOCKED_PLATFORMS.has(siteKey)) return true;
  return BLOCKED_HOSTS.some((d) => hostMatches(hostname, d));
}

function isRegionLockedOutsideEurope(notes?: string | null, language?: string | null): boolean {
  const cleanNotes = (notes ?? "").trim();
  if (cleanNotes) {
    if (NON_EU_NOTE_EXACT_RE.test(cleanNotes)) return true;
    if (NON_EU_NOTE_SUBSTR_RE.test(cleanNotes)) return true;
  }
  const cleanLang = (language ?? "").trim().toLowerCase();
  // Keep French, English, or unspecified global links; filter JP/KR/ZH-only regional streams
  if (
    cleanLang &&
    !["french", "fr", "english", "en", "multi", "international"].includes(cleanLang)
  ) {
    return true;
  }
  return false;
}

function isYouTubeNonWatchableLink(parsed: URL, notes?: string | null): boolean {
  const path = parsed.pathname.toLowerCase();
  // Promo/official channels are not watchable anime episode pages
  if (
    path.startsWith("/@") ||
    path.startsWith("/channel/") ||
    path.startsWith("/c/") ||
    path.startsWith("/user/")
  ) {
    return true;
  }
  const note = (notes ?? "").trim().toLowerCase();
  if (["channel", "trailer", "pv", "opening", "ending", "jp", "en"].includes(note)) {
    return true;
  }
  return false;
}

function humanizeSlug(rawSlug: string): string {
  return decodeURIComponent(rawSlug)
    .replace(/[-_](dubs?|sub|vostfr|vf|tv|season-\d+)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

/**
 * Repairs legacy or region-broken streaming URLs from AniList so clicking a
 * platform never dumps the user onto a 404 or "unavailable in your region" page.
 */
export function repairStreamingUrl(
  site: string,
  rawUrl: string,
  title?: string | null
): { url: string; isSearchFallback: boolean } | null {
  const sanitized = sanitizeStreamingUrl(rawUrl);
  if (!sanitized) return null;

  let parsed: URL;
  try {
    parsed = new URL(sanitized);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  // 1. Crunchyroll: keep modern `/series/<ID>` and `/watch/<ID>`, repair legacy single-slug URLs (often 404)
  if (hostMatches(host, "crunchyroll.com")) {
    parsed.protocol = "https:";
    parsed.hostname = "www.crunchyroll.com";

    const modernMatch =
      /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(series|watch)\/([A-Za-z0-9]{6,})(?:\/.*)?$/i.exec(
        parsed.pathname
      );
    if (modernMatch) {
      return { url: parsed.toString(), isSearchFallback: false };
    }

    if (/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?search$/i.test(parsed.pathname)) {
      return { url: parsed.toString(), isSearchFallback: true };
    }

    // Legacy slug URL (e.g. /attack-on-titan, /steinsgate, /solo-leveling, /death-note/episode-1-...)
    const firstSeg = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    const queryTerm = (title?.trim() || humanizeSlug(firstSeg)).trim();
    if (!queryTerm) return null;

    return {
      url: `https://www.crunchyroll.com/fr/search?q=${encodeURIComponent(queryTerm)}`,
      isSearchFallback: true,
    };
  }

  // 2. Netflix: normalize `/watch/<id>` (often 404 or auth-wall) to `/title/<id>`
  if (hostMatches(host, "netflix.com")) {
    parsed.protocol = "https:";
    parsed.hostname = "www.netflix.com";

    const watchMatch = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watch\/(\d+)/i.exec(parsed.pathname);
    if (watchMatch) {
      return {
        url: `https://www.netflix.com/title/${watchMatch[1]}`,
        isSearchFallback: false,
      };
    }

    const titleMatch = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(\d+)/i.exec(parsed.pathname);
    if (titleMatch) {
      return {
        url: `https://www.netflix.com/title/${titleMatch[1]}`,
        isSearchFallback: false,
      };
    }

    return null;
  }

  // 3. Amazon US (`amazon.com/...`) -> redirect cleanly to global/EU Prime Video search
  if (hostMatches(host, "amazon.com")) {
    const queryTerm = title?.trim();
    if (!queryTerm) return null;
    return {
      url: `https://www.primevideo.com/search?phrase=${encodeURIComponent(queryTerm)}`,
      isSearchFallback: true,
    };
  }

  // 4. Prime Video: ensure https://www.primevideo.com
  if (hostMatches(host, "primevideo.com")) {
    parsed.protocol = "https:";
    parsed.hostname = "www.primevideo.com";
    return {
      url: parsed.toString(),
      isSearchFallback: parsed.pathname.toLowerCase().includes("/search"),
    };
  }

  // 5. ADN: migrate old animedigitalnetwork.fr domain to animationdigitalnetwork.com
  if (hostMatches(host, "animedigitalnetwork.fr") || hostMatches(host, "animationdigitalnetwork.com")) {
    parsed.protocol = "https:";
    parsed.hostname = "animationdigitalnetwork.com";
    return {
      url: parsed.toString(),
      isSearchFallback: parsed.searchParams.has("search"),
    };
  }

  // Default: keep sanitized HTTPS/HTTP URL as-is
  void site;
  return { url: parsed.toString(), isSearchFallback: false };
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
  if (note && note.length <= 18 && !NON_EU_NOTE_EXACT_RE.test(note)) return note;
  return null;
}

/**
 * Normalizes, validates, repairs legacy URLs, filters dead/non-EU platforms,
 * deduplicates, and smart-sorts official AniList streaming links so France/EU-relevant
 * working platforms (Crunchyroll, ADN, Netflix, Prime Video, Disney+) appear first.
 */
export function normalizeStreamingLinks(
  rawExternalLinks?: RawExternalLink[] | null,
  rawStreamingEpisodes?: RawStreamingEpisode[] | null,
  options?: NormalizeStreamingOptions
): StreamingLink[] {
  const titleHint = options?.title?.trim() || null;
  const collected: StreamingLink[] = [];
  const seenUrl = new Set<string>();

  for (const item of rawExternalLinks ?? []) {
    if (!item || item.isDisabled) continue;
    if (item.type !== "STREAMING") continue;

    const site = typeof item.site === "string" ? item.site.trim() : "";
    const initialUrl = sanitizeStreamingUrl(item.url);
    if (!site || !initialUrl) continue;

    let parsedInitial: URL;
    try {
      parsedInitial = new URL(initialUrl);
    } catch {
      continue;
    }

    // Filter dead services, non-EU geo-locked platforms, and promo-only YouTube channels
    if (isBlockedPlatformOrHost(site, parsedInitial.hostname)) continue;
    if (isRegionLockedOutsideEurope(item.notes, item.language)) continue;
    if (
      hostMatches(parsedInitial.hostname, "youtube.com") ||
      hostMatches(parsedInitial.hostname, "youtu.be")
    ) {
      if (isYouTubeNonWatchableLink(parsedInitial, item.notes)) continue;
    }

    const repaired = repairStreamingUrl(site, initialUrl, titleHint);
    if (!repaired) continue;

    const urlKey = repaired.url.toLowerCase();
    if (seenUrl.has(urlKey)) continue;
    seenUrl.add(urlKey);

    const meta = getStreamingPlatformMeta(site);
    collected.push({
      id: typeof item.id === "number" && Number.isFinite(item.id) ? item.id : collected.length + 1,
      site,
      url: repaired.url,
      icon: typeof item.icon === "string" && item.icon.startsWith("https://") ? item.icon : null,
      color:
        typeof item.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(item.color.trim())
          ? item.color.trim()
          : meta.fallbackColor,
      language: typeof item.language === "string" && item.language.trim() ? item.language.trim() : null,
      notes: typeof item.notes === "string" && item.notes.trim() ? item.notes.trim() : null,
      isSearchFallback: repaired.isSearchFallback || undefined,
    });
  }

  // Merge any official site detected via streamingEpisodes if not already present in externalLinks
  for (const ep of rawStreamingEpisodes ?? []) {
    if (!ep?.site || !ep?.url) continue;
    const site = ep.site.trim();
    const initialUrl = sanitizeStreamingUrl(ep.url);
    if (!site || !initialUrl) continue;

    let parsedInitial: URL;
    try {
      parsedInitial = new URL(initialUrl);
    } catch {
      continue;
    }

    if (isBlockedPlatformOrHost(site, parsedInitial.hostname)) continue;

    const alreadyHasSite = collected.some(
      (c) =>
        formatStreamingDisplayName(c.site).toLowerCase() ===
        formatStreamingDisplayName(site).toLowerCase()
    );
    if (alreadyHasSite) continue;

    const repaired = repairStreamingUrl(site, initialUrl, titleHint);
    if (!repaired) continue;

    const meta = getStreamingPlatformMeta(site);
    collected.push({
      id: 900_000 + collected.length,
      site,
      url: repaired.url,
      icon: null,
      color: meta.fallbackColor,
      language: null,
      notes: null,
      isSearchFallback: repaired.isSearchFallback || undefined,
    });
  }

  // Sort: major platforms first, direct verified links before search fallbacks, FR-tagged first
  collected.sort((a, b) => {
    const prioA = getStreamingPlatformMeta(a.site).priority;
    const prioB = getStreamingPlatformMeta(b.site).priority;
    if (prioA !== prioB) return prioA - prioB;

    const directA = a.isSearchFallback ? 1 : 0;
    const directB = b.isSearchFallback ? 1 : 0;
    if (directA !== directB) return directA - directB;

    const frA = (a.language ?? "").toLowerCase() === "french" ? 0 : 1;
    const frB = (b.language ?? "").toLowerCase() === "french" ? 0 : 1;
    if (frA !== frB) return frA - frB;

    return a.site.localeCompare(b.site);
  });

  // Keep max 1 best entry per platform (preferring direct /series or /title links over search fallbacks)
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
 * Generates transparent, HTTP-verified France search shortcuts so viewers can verify
 * exact current regional availability without hitting broken or dead search URLs.
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
        id: "mangas-io",
        label: "Mangas.io",
        color: "#F97316",
        url: `https://www.mangas.io/catalogue?q=${q}`,
      },
      {
        id: "fnac-manga",
        label: "Fnac",
        color: "#F0B95B",
        url: `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${q}+manga`,
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
    {
      id: "primevideo-search",
      label: "Prime Video",
      color: "#00A8E1",
      url: `https://www.primevideo.com/search?phrase=${q}`,
    },
  ];
}
