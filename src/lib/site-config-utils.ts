import type {
  FeaturedHeroConfig,
  MediaItem,
  SiteAnnouncement,
  SiteConfig,
} from "@/types/media";

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  announcement: {
    enabled: false,
    message: "",
    ctaLabel: "",
    ctaHref: "",
    tone: "gold",
  },
  featuredHero: {
    enabled: false,
    mediaId: null,
    customTagline: "",
    media: null,
  },
  updatedAt: new Date(0).toISOString(),
  updatedBy: null,
};

export function sanitizeCtaHref(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim().slice(0, 300);
  if (!trimmed) return "";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    // invalid URL
  }
  return "";
}

function sanitizeTone(raw: unknown): SiteAnnouncement["tone"] {
  if (raw === "crimson" || raw === "info" || raw === "gold") return raw;
  return "gold";
}

export function sanitizeSiteConfigInput(
  patch: {
    announcement?: Partial<SiteAnnouncement>;
    featuredHero?: Partial<FeaturedHeroConfig>;
  },
  current: SiteConfig = DEFAULT_SITE_CONFIG,
  resolvedMedia?: MediaItem | null
): SiteConfig {
  const nextAnnouncement: SiteAnnouncement = {
    enabled:
      typeof patch.announcement?.enabled === "boolean"
        ? patch.announcement.enabled
        : current.announcement.enabled,
    message:
      typeof patch.announcement?.message === "string"
        ? patch.announcement.message.trim().slice(0, 220)
        : current.announcement.message,
    ctaLabel:
      typeof patch.announcement?.ctaLabel === "string"
        ? patch.announcement.ctaLabel.trim().slice(0, 40)
        : current.announcement.ctaLabel,
    ctaHref:
      patch.announcement?.ctaHref !== undefined
        ? sanitizeCtaHref(patch.announcement.ctaHref)
        : current.announcement.ctaHref,
    tone:
      patch.announcement?.tone !== undefined
        ? sanitizeTone(patch.announcement.tone)
        : current.announcement.tone,
  };

  if (!nextAnnouncement.message) {
    nextAnnouncement.enabled = false;
  }

  let nextMediaId = current.featuredHero.mediaId;
  if (patch.featuredHero && "mediaId" in patch.featuredHero) {
    const rawId = patch.featuredHero.mediaId;
    if (rawId === null || rawId === undefined || rawId === 0) {
      nextMediaId = null;
    } else if (typeof rawId === "number" && Number.isInteger(rawId) && rawId > 0) {
      nextMediaId = rawId;
    }
  }

  const nextMedia =
    nextMediaId === null
      ? null
      : resolvedMedia !== undefined
      ? resolvedMedia
      : current.featuredHero.media?.id === nextMediaId
      ? current.featuredHero.media
      : null;

  const nextHeroEnabled =
    typeof patch.featuredHero?.enabled === "boolean"
      ? patch.featuredHero.enabled && Boolean(nextMediaId && nextMedia)
      : current.featuredHero.enabled && Boolean(nextMediaId && nextMedia);

  const nextFeaturedHero: FeaturedHeroConfig = {
    enabled: nextHeroEnabled,
    mediaId: nextMediaId,
    customTagline:
      typeof patch.featuredHero?.customTagline === "string"
        ? patch.featuredHero.customTagline.trim().slice(0, 140)
        : current.featuredHero.customTagline,
    media: nextMedia,
  };

  return {
    announcement: nextAnnouncement,
    featuredHero: nextFeaturedHero,
    updatedAt: new Date().toISOString(),
    updatedBy: current.updatedBy ?? null,
  };
}
