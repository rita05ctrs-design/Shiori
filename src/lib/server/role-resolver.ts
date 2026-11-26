import type { UserRole } from "@/types/media";

export function normalizeRole(value: unknown): UserRole {
  if (typeof value !== "string") return "user";
  const clean = value.trim().toLowerCase();
  if (clean === "creator") return "creator";
  if (clean === "moderator") return "moderator";
  return "user";
}

function parseEnvList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * Resolves a user's authoritative server-side role.
 * Priority:
 * 1) Server env `ADMIN_EMAIL` (supports comma-separated list, case-insensitive)
 * 2) Server env `ADMIN_ANILIST_ID` (supports comma-separated numeric AniList user IDs)
 * 3) Database `profiles.role` (`'creator' | 'moderator' | 'user'`)
 */
export function resolveEffectiveRole(input: {
  dbRole?: unknown;
  email?: string | null;
  anilistUserId?: number | string | null;
  adminEmailsEnv?: string;
  adminAnilistIdsEnv?: string;
}): UserRole {
  const adminEmails = parseEnvList(
    input.adminEmailsEnv !== undefined
      ? input.adminEmailsEnv
      : process.env.ADMIN_EMAIL
  ).map((e) => e.toLowerCase());

  if (input.email && adminEmails.length > 0) {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (normalizedEmail && adminEmails.includes(normalizedEmail)) {
      return "creator";
    }
  }

  const adminAnilistIds = parseEnvList(
    input.adminAnilistIdsEnv !== undefined
      ? input.adminAnilistIdsEnv
      : process.env.ADMIN_ANILIST_ID
  );

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

  return normalizeRole(input.dbRole);
}

export function isCreatorRole(role: UserRole | null | undefined): boolean {
  return role === "creator";
}

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role === "creator" || role === "moderator";
}
