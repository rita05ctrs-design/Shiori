import type {
  SuggestionCategory,
  SuggestionStatus,
  UserSuggestionRecord,
} from "../types/media.ts";

export const VALID_SUGGESTION_CATEGORIES: readonly SuggestionCategory[] = [
  "feature",
  "improvement",
  "bug",
  "other",
] as const;

export const VALID_SUGGESTION_STATUSES: readonly SuggestionStatus[] = [
  "new",
  "planned",
  "done",
  "archived",
] as const;

export interface SuggestionModerationMeta {
  statusById: Record<string, { status: SuggestionStatus; updatedAt: string }>;
  deletedIds: string[];
  updatedAt: string;
}

export const EMPTY_SUGGESTION_META: SuggestionModerationMeta = {
  statusById: {},
  deletedIds: [],
  updatedAt: new Date(0).toISOString(),
};

export function normalizeSuggestionCategory(raw: unknown): SuggestionCategory {
  if (
    raw === "feature" ||
    raw === "improvement" ||
    raw === "bug" ||
    raw === "other"
  ) {
    return raw;
  }
  return "feature";
}

export function normalizeSuggestionStatus(raw: unknown): SuggestionStatus {
  if (
    raw === "new" ||
    raw === "planned" ||
    raw === "done" ||
    raw === "archived"
  ) {
    return raw;
  }
  return "new";
}

export function sanitizeSuggestionInput(raw: {
  category?: unknown;
  title?: unknown;
  message?: unknown;
  device?: unknown;
  pagePath?: unknown;
}):
  | {
      ok: true;
      category: SuggestionCategory;
      title: string;
      message: string;
      device: "mobile" | "desktop";
      pagePath: string | null;
    }
  | { ok: false; error: string } {
  const category = normalizeSuggestionCategory(raw.category);
  const title =
    typeof raw.title === "string"
      ? raw.title.replace(/\s+/g, " ").trim().slice(0, 100)
      : "";
  const message =
    typeof raw.message === "string"
      ? raw.message.replace(/\r\n/g, "\n").trim().slice(0, 1200)
      : "";

  if (message.length < 8) {
    return {
      ok: false,
      error: "Votre suggestion doit contenir au moins 8 caractères.",
    };
  }

  const device = raw.device === "mobile" ? "mobile" : "desktop";
  let pagePath: string | null = null;
  if (typeof raw.pagePath === "string") {
    const cleaned = raw.pagePath.trim().slice(0, 120);
    if (cleaned.startsWith("/") && !cleaned.startsWith("//")) {
      pagePath = cleaned;
    }
  }

  return {
    ok: true,
    category,
    title,
    message,
    device,
    pagePath,
  };
}

export function sanitizeStoredSuggestion(raw: unknown): UserSuggestionRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === "string" ? obj.id.trim().slice(0, 80) : "";
  const message = typeof obj.message === "string" ? obj.message.trim().slice(0, 1200) : "";
  if (!id || !message) return null;

  const createdAt =
    typeof obj.createdAt === "string" && obj.createdAt
      ? obj.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof obj.updatedAt === "string" && obj.updatedAt ? obj.updatedAt : createdAt;

  return {
    id,
    userId: typeof obj.userId === "string" && obj.userId.trim() ? obj.userId.trim() : null,
    username:
      typeof obj.username === "string" && obj.username.trim()
        ? obj.username.trim().slice(0, 48)
        : null,
    displayName:
      typeof obj.displayName === "string" && obj.displayName.trim()
        ? obj.displayName.trim().slice(0, 60)
        : "Invité",
    avatarUrl:
      typeof obj.avatarUrl === "string" && obj.avatarUrl.trim()
        ? obj.avatarUrl.trim().slice(0, 500)
        : null,
    accentColor:
      typeof obj.accentColor === "string" && obj.accentColor.trim()
        ? obj.accentColor.trim().slice(0, 32)
        : null,
    category: normalizeSuggestionCategory(obj.category),
    title: typeof obj.title === "string" ? obj.title.trim().slice(0, 100) : "",
    message,
    device: obj.device === "mobile" ? "mobile" : "desktop",
    pagePath:
      typeof obj.pagePath === "string" && obj.pagePath.startsWith("/")
        ? obj.pagePath.slice(0, 120)
        : null,
    status: normalizeSuggestionStatus(obj.status),
    createdAt,
    updatedAt,
  };
}

export function sanitizeSuggestionMeta(raw: unknown): SuggestionModerationMeta {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SUGGESTION_META };
  const obj = raw as Record<string, unknown>;
  const statusById: SuggestionModerationMeta["statusById"] = {};
  if (obj.statusById && typeof obj.statusById === "object") {
    for (const [id, entry] of Object.entries(obj.statusById as Record<string, unknown>)) {
      if (!id || !entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      statusById[id] = {
        status: normalizeSuggestionStatus(e.status),
        updatedAt:
          typeof e.updatedAt === "string" && e.updatedAt
            ? e.updatedAt
            : new Date(0).toISOString(),
      };
    }
  }
  const deletedIds = Array.isArray(obj.deletedIds)
    ? Array.from(
        new Set(
          obj.deletedIds
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim())
            .filter(Boolean)
        )
      )
    : [];

  return {
    statusById,
    deletedIds,
    updatedAt:
      typeof obj.updatedAt === "string" && obj.updatedAt
        ? obj.updatedAt
        : EMPTY_SUGGESTION_META.updatedAt,
  };
}

export function mergeSuggestionMeta(
  ...metas: SuggestionModerationMeta[]
): SuggestionModerationMeta {
  const statusById: SuggestionModerationMeta["statusById"] = {};
  const deletedSet = new Set<string>();
  let updatedAt = EMPTY_SUGGESTION_META.updatedAt;

  for (const m of metas) {
    if (m.updatedAt > updatedAt) updatedAt = m.updatedAt;
    for (const id of m.deletedIds) deletedSet.add(id);
    for (const [id, entry] of Object.entries(m.statusById)) {
      const existing = statusById[id];
      if (!existing || entry.updatedAt >= existing.updatedAt) {
        statusById[id] = entry;
      }
    }
  }

  return {
    statusById,
    deletedIds: Array.from(deletedSet),
    updatedAt,
  };
}

/**
 * Merges suggestions from multiple sources (local disk, site_settings, user profiles),
 * deduplicates by ID, applies Creator status overrides & deletions, and sorts newest first.
 */
export function mergeAndOverlaySuggestions(
  sources: UserSuggestionRecord[][],
  meta: SuggestionModerationMeta
): UserSuggestionRecord[] {
  const deleted = new Set(meta.deletedIds);
  const byId = new Map<string, UserSuggestionRecord>();

  for (const list of sources) {
    for (const item of list) {
      if (!item || deleted.has(item.id)) continue;
      const existing = byId.get(item.id);
      if (!existing || item.updatedAt >= existing.updatedAt) {
        byId.set(item.id, item);
      }
    }
  }

  const out: UserSuggestionRecord[] = [];
  for (const item of byId.values()) {
    const override = meta.statusById[item.id];
    if (override && override.updatedAt >= item.updatedAt) {
      out.push({
        ...item,
        status: override.status,
        updatedAt: override.updatedAt,
      });
    } else {
      out.push(item);
    }
  }

  out.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return out;
}
