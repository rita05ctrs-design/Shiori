import { NextRequest, NextResponse } from "next/server";
import { ADMIN_GRANTABLE_BADGE_IDS, BADGE_BY_ID } from "@/lib/badges";
import { normalizeRole, requireCreatorActor } from "@/lib/server/admin-auth";
import { sanitizeSafeImageUrl } from "@/lib/server/rate-limit";
import {
  getAllLocalCommunityProfiles,
  updateLocalUserAdminGrants,
} from "@/lib/server/social-store";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import type { UnlockedBadgeRecord, UserRole } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRANTABLE_SET = new Set<string>(ADMIN_GRANTABLE_BADGE_IDS);

export interface AdminUserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accentColor: string;
  role: UserRole;
  joinedAt: string;
  unlockedBadges: UnlockedBadgeRecord[];
  pinnedBadges: string[];
  source: "supabase" | "local" | "community";
}

export async function GET(request: NextRequest) {
  const guard = await requireCreatorActor();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().replace(/^@+/, "").toLowerCase();

  const byId = new Map<string, AdminUserSummary>();

  // 1) Fetch Supabase profiles
  try {
    const supabase = getSupabaseAdminClient() ?? (await getSupabaseServerClient());
    if (supabase) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rows: any[] | null = null;
      const extendedRes = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, accent_color, role, unlocked_badges, pinned_badges, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(120);

      if (!extendedRes.error && Array.isArray(extendedRes.data)) {
        rows = extendedRes.data;
      } else {
        const fallbackRes = await supabase
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url, accent_color, unlocked_badges, pinned_badges, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(120);
        if (!fallbackRes.error && Array.isArray(fallbackRes.data)) {
          rows = fallbackRes.data;
        }
      }

      if (Array.isArray(rows)) {
        for (const row of rows) {
          const id = String(row.id);
          const role =
            id === guard.actor.id ? "creator" : normalizeRole(row.role);
          byId.set(id, {
            id,
            username: String(row.username || `user_${id.slice(0, 6)}`),
            displayName: String(row.display_name || row.username || "Membre Shiori"),
            avatarUrl: sanitizeSafeImageUrl(row.avatar_url),
            accentColor: typeof row.accent_color === "string" ? row.accent_color : "#E5484D",
            role,
            joinedAt: String(row.created_at || new Date().toISOString()),
            unlockedBadges: Array.isArray(row.unlocked_badges) ? row.unlocked_badges : [],
            pinnedBadges: Array.isArray(row.pinned_badges) ? row.pinned_badges : [],
            source: "supabase",
          });
        }
      }
    }
  } catch {
    // non-fatal
  }

  // 2) Merge local / community profiles
  for (const p of getAllLocalCommunityProfiles()) {
    if (!byId.has(p.id)) {
      byId.set(p.id, {
        id: p.id,
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        accentColor: p.accentColor || "#E5484D",
        role: p.id === guard.actor.id ? "creator" : normalizeRole(p.role),
        joinedAt: p.joinedAt,
        unlockedBadges: p.unlockedBadges ?? [],
        pinnedBadges: p.pinnedBadges ?? [],
        source: p.source === "community" ? "community" : "local",
      });
    }
  }

  const roleWeight: Record<UserRole, number> = { creator: 0, moderator: 1, user: 2 };
  let users = Array.from(byId.values()).sort(
    (a, b) =>
      roleWeight[a.role] - roleWeight[b.role] ||
      new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
  );

  if (q) {
    users = users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    users: users.slice(0, 100),
    grantableBadges: ADMIN_GRANTABLE_BADGE_IDS.map((id) => {
      const def = BADGE_BY_ID.get(id);
      return {
        id,
        title: def?.title ?? id,
        description: def?.description ?? "",
        rarity: def?.rarity ?? "gold",
      };
    }),
  });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireCreatorActor();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const action = body?.action;
  const badgeId = typeof body?.badgeId === "string" ? body.badgeId.trim() : undefined;
  const targetRole = typeof body?.role === "string" ? normalizeRole(body.role) : undefined;

  if (!userId) {
    return NextResponse.json({ error: "Identifiant utilisateur manquant." }, { status: 400 });
  }

  if (action === "grant_badge" || action === "revoke_badge") {
    if (!badgeId || !GRANTABLE_SET.has(badgeId)) {
      return NextResponse.json(
        { error: "Badge non autorisé (autorisés : beta_tester, supporter, vip)." },
        { status: 400 }
      );
    }

    let updatedSupabase = false;
    let finalBadges: UnlockedBadgeRecord[] | undefined;

    if (UUID_RE.test(userId)) {
      try {
        const supabase = getSupabaseAdminClient() ?? (await getSupabaseServerClient());
        if (supabase) {
          const { data: row } = await supabase
            .from("profiles")
            .select("unlocked_badges, pinned_badges")
            .eq("id", userId)
            .maybeSingle();

          if (row) {
            const current: UnlockedBadgeRecord[] = Array.isArray(row.unlocked_badges)
              ? row.unlocked_badges
              : [];
            const map = new Map<string, UnlockedBadgeRecord>();
            for (const b of current) {
              if (b?.badgeId) map.set(b.badgeId, b);
            }
            const nowIso = new Date().toISOString();
            if (action === "grant_badge") {
              if (!map.has(badgeId)) {
                map.set(badgeId, { badgeId, unlockedAt: nowIso });
              }
              await supabase
                .from("user_badges")
                .upsert(
                  { user_id: userId, badge_id: badgeId, unlocked_at: nowIso },
                  { onConflict: "user_id,badge_id" }
                );
            } else {
              map.delete(badgeId);
              await supabase
                .from("user_badges")
                .delete()
                .eq("user_id", userId)
                .eq("badge_id", badgeId);
            }

            const nextBadges = Array.from(map.values());
            const nextPinned =
              action === "revoke_badge" && Array.isArray(row.pinned_badges)
                ? row.pinned_badges.filter((p: unknown) => p !== badgeId)
                : row.pinned_badges;

            const { error: updErr } = await supabase
              .from("profiles")
              .update({
                unlocked_badges: nextBadges,
                ...(Array.isArray(nextPinned) ? { pinned_badges: nextPinned } : {}),
              })
              .eq("id", userId);

            if (!updErr) {
              updatedSupabase = true;
              finalBadges = nextBadges;
            }
          }
        }
      } catch {
        // non-fatal
      }
    }

    const localRes = updateLocalUserAdminGrants(userId, {
      grantBadgeId: action === "grant_badge" ? badgeId : undefined,
      revokeBadgeId: action === "revoke_badge" ? badgeId : undefined,
    });

    if (!updatedSupabase && !localRes.found) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      userId,
      action,
      badgeId,
      unlockedBadges: finalBadges ?? localRes.unlockedBadges ?? [],
    });
  }

  if (action === "set_role") {
    if (!targetRole || (targetRole !== "user" && targetRole !== "moderator")) {
      return NextResponse.json(
        { error: "Seuls les rôles 'user' et 'moderator' peuvent être modifiés ici." },
        { status: 400 }
      );
    }
    if (userId === guard.actor.id) {
      return NextResponse.json(
        { error: "Impossible de modifier votre propre rôle Créateur." },
        { status: 400 }
      );
    }

    let updatedSupabase = false;
    if (UUID_RE.test(userId)) {
      try {
        const supabase = getSupabaseAdminClient() ?? (await getSupabaseServerClient());
        if (supabase) {
          const { error } = await supabase
            .from("profiles")
            .update({ role: targetRole })
            .eq("id", userId);
          if (!error) updatedSupabase = true;
        }
      } catch {
        // non-fatal
      }
    }

    const localRes = updateLocalUserAdminGrants(userId, { role: targetRole });
    if (!updatedSupabase && !localRes.found) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      userId,
      role: targetRole,
    });
  }

  return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
}
