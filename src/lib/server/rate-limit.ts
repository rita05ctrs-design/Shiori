import { NextRequest, NextResponse } from "next/server";

interface RateBucket {
  count: number;
  resetAt: number;
}

const MAX_BUCKETS = 4000;
const globalRateStore = globalThis as unknown as {
  __shioriRateLimitMap?: Map<string, RateBucket>;
};

function getStore(): Map<string, RateBucket> {
  if (!globalRateStore.__shioriRateLimitMap) {
    globalRateStore.__shioriRateLimitMap = new Map<string, RateBucket>();
  }
  return globalRateStore.__shioriRateLimitMap;
}

export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local";
}

/**
 * Bounded in-memory fixed-window rate limiter to protect auth, messaging,
 * comments, reports, friend requests, and translation endpoints against abuse.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const store = getStore();

  if (store.size >= MAX_BUCKETS) {
    for (const [k, b] of store.entries()) {
      if (b.resetAt <= now) store.delete(k);
    }
    if (store.size >= MAX_BUCKETS) {
      const oldest = store.keys().next().value;
      if (oldest) store.delete(oldest);
    }
  }

  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return {
      ok: true,
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSec: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export function rateLimitResponse(retryAfterSec: number, message?: string): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error:
        message ||
        `Trop de requêtes effectuées. Veuillez patienter ${retryAfterSec} seconde${retryAfterSec > 1 ? "s" : ""} avant de réessayer.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}

/**
 * Strictly validates image URLs (avatars, banners) so untrusted strings can never
 * inject `javascript:`, `data:text/html`, `data:image/svg+xml`, or malformed URIs.
 */
export function sanitizeSafeImageUrl(
  raw: unknown,
  options?: { allowDataImage?: boolean; maxLength?: number }
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:")) {
    if (!options?.allowDataImage) return null;
    // Allow strictly safe raster data URIs (never SVG or HTML) up to 95KB
    if (
      /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(trimmed) &&
      trimmed.length <= 95_000
    ) {
      return trimmed;
    }
    return null;
  }

  const maxLen = options?.maxLength ?? 2048;
  if (trimmed.length > maxLen) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
