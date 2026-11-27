import type { UnlockedBadgeRecord, UserRole } from "@/types/media";

export interface AdminUserGrantEntry {
  grantedBadges: UnlockedBadgeRecord[];
  revokedBadgeIds: string[];
  role?: "user" | "moderator";
  updatedAt: string;
}

export interface AdminGrantsLedger {
  users: Record<string, AdminUserGrantEntry>;
  updatedAt: string;
}

/**
 * Merges creator-managed special badge grants & revocations onto a user's badge array.
 */
export function applyAdminGrantsToBadges(
  baseBadges: UnlockedBadgeRecord[] | null | undefined,
  entry: AdminUserGrantEntry | undefined
): UnlockedBadgeRecord[] {
  const map = new Map<string, UnlockedBadgeRecord>();
  for (const b of baseBadges ?? []) {
    if (b?.badgeId) map.set(b.badgeId, b);
  }
  if (!entry) return Array.from(map.values());

  for (const revId of entry.revokedBadgeIds) {
    map.delete(revId);
  }
  for (const grant of entry.grantedBadges) {
    if (!map.has(grant.badgeId)) {
      map.set(grant.badgeId, grant);
    }
  }
  return Array.from(map.values());
}

/**
 * Resolves a member's effective role taking any durable admin role override into account
 * (never downgrading a Creator).
 */
export function applyAdminGrantRole(
  baseRole: UserRole,
  entry: AdminUserGrantEntry | undefined
): UserRole {
  if (baseRole === "creator") return "creator";
  if (entry?.role === "moderator") return "moderator";
  if (entry?.role === "user") return "user";
  return baseRole;
}
