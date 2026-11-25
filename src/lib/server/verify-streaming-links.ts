import type { StreamingLink } from "@/types/media";

interface VerificationCacheEntry {
  alive: boolean;
  expiresAt: number;
}

const VERIFY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_CACHE_SIZE = 800;
const REQUEST_TIMEOUT_MS = 2500;

const urlHealthCache = new Map<string, VerificationCacheEntry>();

/**
 * Hosts behind strict Cloudflare / anti-bot WAFs that always return HTTP 403 to
 * server-side fetch even on valid pages (repaired statically in streaming.ts instead).
 */
const SKIP_SERVER_PROBE_HOSTS = [
  "crunchyroll.com",
  "manga-news.com",
  "mangas.io",
];

const ERROR_REDIRECT_HOSTS = [
  "gdpr.tubi.tv",
  "wakanim.tv",
  "funimation.com",
];

function hostMatches(hostname: string, domain: string): boolean {
  const h = hostname.toLowerCase();
  return h === domain || h.endsWith(`.${domain}`);
}

function getCachedHealth(url: string): boolean | null {
  const entry = urlHealthCache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    urlHealthCache.delete(url);
    return null;
  }
  return entry.alive;
}

function setCachedHealth(url: string, alive: boolean): void {
  if (urlHealthCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = urlHealthCache.keys().next().value;
    if (oldestKey) urlHealthCache.delete(oldestKey);
  }
  urlHealthCache.set(url, { alive, expiresAt: Date.now() + VERIFY_TTL_MS });
}

function isBareHomepagePath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, "").toLowerCase();
  return clean === "" || /^\/[a-z]{2}(?:-[a-z]{2})?$/.test(clean);
}

/**
 * Checks whether a single direct streaming URL actually resolves to a live title page
 * (not 404/410/451, not a GDPR block page, and not redirected to a bare homepage).
 */
async function probeSingleStreamingUrl(url: string): Promise<boolean> {
  const cached = getCachedHealth(url);
  if (cached !== null) return cached;

  let parsedInitial: URL;
  try {
    parsedInitial = new URL(url);
  } catch {
    return false;
  }

  if (SKIP_SERVER_PROBE_HOSTS.some((d) => hostMatches(parsedInitial.hostname, d))) {
    return true;
  }

  const hadDeepPath = parsedInitial.pathname.split("/").filter(Boolean).length >= 2;

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    // Release socket immediately without downloading full HTML body
    void res.body?.cancel().catch(() => {});

    if (res.status === 404 || res.status === 410 || res.status === 451) {
      setCachedHealth(url, false);
      return false;
    }

    // Inspect final redirected URL for known error/geo-block screens or bare homepage fallbacks
    try {
      const finalUrl = new URL(res.url || url);
      if (ERROR_REDIRECT_HOSTS.some((d) => hostMatches(finalUrl.hostname, d))) {
        setCachedHealth(url, false);
        return false;
      }
      if (hadDeepPath && isBareHomepagePath(finalUrl.pathname)) {
        setCachedHealth(url, false);
        return false;
      }
    } catch {
      // ignore URL parse error on response url
    }

    setCachedHealth(url, true);
    return true;
  } catch {
    // On network timeout or transient error, don't cache failure or falsely drop a valid site
    return true;
  }
}

/**
 * Verifies official streaming links in parallel on the server for /media/[id] pages,
 * automatically filtering out expired 404 links (e.g. removed Netflix or ADN catalog titles)
 * while preserving valid direct links and safe search fallbacks.
 */
export async function verifyStreamingLinksServer(
  links: StreamingLink[] | undefined
): Promise<StreamingLink[]> {
  if (!links || links.length === 0) return [];

  const results = await Promise.all(
    links.map(async (link) => {
      if (link.isSearchFallback) return link;
      const alive = await probeSingleStreamingUrl(link.url);
      return alive ? link : null;
    })
  );

  return results.filter((item): item is StreamingLink => item !== null);
}
