import type { UserRole } from "@/types/media";

/**
 * Canonical normalized handles of Shiori's official creator account.
 * Normalization strips `@`, whitespace, underscores, dots, and hyphens, so
 * "6t79", "enzolepg 63", "enzolepg_63", "enzolepg63", etc. all match seamlessly
 * before and after account rename.
 */
const CANONICAL_CREATOR_HANDLES = new Set<string>(["6t79", "enzolepg63"]);

export function normalizeRole(value: unknown): UserRole {
  if (typeof value !== "string") return "user";
  const clean = value.trim().toLowerCase();
  if (clean === "creator") return "creator";
  if (clean === "moderator") return "moderator";
  return "user";
}

export function normalizeIdentityHandle(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[\s_.-]+/g, "");
}

function parseEnvList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readEnv(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[key];
}

export function isCanonicalCreatorIdentity(input: {
  username?: string | null;
  displayName?: string | null;
  adminUsernamesEnv?: string;
}): boolean {
  const configured = parseEnvList(
    input.adminUsernamesEnv !== undefined
      ? input.adminUsernamesEnv
      : readEnv("ADMIN_USERNAME")
  )
    .map((entry) => normalizeIdentityHandle(entry))
    .filter(Boolean);

  const candidates = [
    normalizeIdentityHandle(input.username),
    normalizeIdentityHandle(input.displayName),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (CANONICAL_CREATOR_HANDLES.has(candidate)) {
      return true;
    }
    if (configured.includes(candidate)) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves a public profile / author's displayed role (safe for client & public views).
 */
export function resolvePublicProfileRole(input: {
  dbRole?: unknown;
  username?: string | null;
  displayName?: string | null;
  adminUsernamesEnv?: string;
}): UserRole {
  if (
    isCanonicalCreatorIdentity({
      username: input.username,
      displayName: input.displayName,
      adminUsernamesEnv: input.adminUsernamesEnv,
    })
  ) {
    return "creator";
  }
  return normalizeRole(input.dbRole);
}

/**
 * Resolves a user's authoritative server-side role.
 * Priority:
 * 1) Server env `ADMIN_EMAIL` (supports comma-separated list, case-insensitive)
 * 2) Server env `ADMIN_ANILIST_ID` (supports comma-separated numeric AniList user IDs)
 * 3) Official Creator identity (`enzolepg 63` / `enzolepg_63` / `ADMIN_USERNAME`)
 * 4) Database `profiles.role` (`'creator' | 'moderator' | 'user'`)
 */
export function resolveEffectiveRole(input: {
  dbRole?: unknown;
  email?: string | null;
  anilistUserId?: number | string | null;
  username?: string | null;
  displayName?: string | null;
  adminEmailsEnv?: string;
  adminAnilistIdsEnv?: string;
  adminUsernamesEnv?: string;
}): UserRole {
  const adminEmails = parseEnvList(
    input.adminEmailsEnv !== undefined
      ? input.adminEmailsEnv
      : readEnv("ADMIN_EMAIL")
  )
    .flatMap((entry) => entry.split(/\s+/))
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (input.email && adminEmails.length > 0) {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (normalizedEmail && adminEmails.includes(normalizedEmail)) {
      return "creator";
    }
  }

  const adminAnilistIds = parseEnvList(
    input.adminAnilistIdsEnv !== undefined
      ? input.adminAnilistIdsEnv
      : readEnv("ADMIN_ANILIST_ID")
  )
    .flatMap((entry) => entry.split(/\s+/))
    .map((e) => e.trim())
    .filter(Boolean);

  if (
    input.anilistUserId !== null &&
    input.anilistUserId !== undefined &&
    adminAnilistIds.length > 0
  ) {
    const normalizedId = String(input.anilistUserId).trim();
    if (/^\d+$/.test(normalizedId) && adminAnilistIds.includes(normalizedId)) {
      return "creator";
    }
  }

  if (
    isCanonicalCreatorIdentity({
      username: input.username,
      displayName: input.displayName,
      adminUsernamesEnv: input.adminUsernamesEnv,
    })
  ) {
    return "creator";
  }

  return normalizeRole(input.dbRole);
}

export function isCreatorRole(role: UserRole | null | undefined): boolean {
  return role === "creator";
}

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role === "creator" || role === "moderator";
}
