import { NextRequest, NextResponse } from "next/server";
import { ADMIN_GRANTABLE_BADGE_IDS, BADGE_BY_ID } from "@/lib/badges";
import {
  normalizeRole,
  requireCreatorActor,
  resolvePublicProfileRole,
} from "@/lib/server/admin-auth";
import { sanitizeSafeImageUrl } from "@/lib/server/rate-limit";
import {
  getAllLocalCommunityProfiles,
  isSeedBotAccount,
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
  source: "supabase" | "local";
}

export async function GET(request: NextRequest) {
  const guard = await requireCreatorActor();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().replace(/^@+/, "").toLowerCase();

  const byId = new Map<string, AdminUserSummary>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ingestSupabaseRow = (row: any) => {
    if (!row?.id) return;
    const id = String(row.id);
    const uname = String(row.username || `user_${id.slice(0, 6)}`);
    const dname = String(row.display_name || row.username || "Membre Shiori");
    if (isSeedBotAccount({ id, username: uname })) return;

    const existing = byId.get(id);
    const role =
      id === guard.actor.id
        ? "creator"
        : resolvePublicProfileRole({
            dbRole: row.role ?? existing?.role,
            username: uname,
            displayName: dname,
          });
    const badges = Array.isArray(row.unlocked_badges)
      ? row.unlocked_badges
      : existing?.unlockedBadges ?? [];
    const pinned = Array.isArray(row.pinned_badges)
      ? row.pinned_badges
      : existing?.pinnedBadges ?? [];

    byId.set(id, {
      id,
      username: uname,
      displayName: dname,
      avatarUrl: sanitizeSafeImageUrl(row.avatar_url) ?? existing?.avatarUrl ?? null,
      accentColor:
        typeof row.accent_color === "string"
          ? row.accent_color
          : existing?.accentColor ?? "#E5484D",
      role,
      joinedAt: String(
        row.joined_at || row.created_at || existing?.joinedAt || new Date().toISOString()
      ),
      unlockedBadges: badges,
      pinnedBadges: pinned,
      source: "supabase",
    });
  };

  // 1) Fetch ALL Supabase members via service-role admin client when available
  //    (includes both `public.profiles` and any `auth.users` who haven't synced a profile yet)
  try {
    const adminClient = getSupabaseAdminClient();
    if (adminClient) {
      let rows: unknown[] | null = (
        await adminClient
          .from("profiles")
          .select(
            "id, username, display_name, avatar_url, accent_color, role, unlocked_badges, pinned_badges, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(500)
      ).data;

      if (!Array.isArray(rows)) {
        rows = (
          await adminClient
            .from("profiles")
            .select(
              "id, username, display_name, avatar_url, accent_color, unlocked_badges, pinned_badges, created_at"
            )
            .order("created_at", { ascending: false })
            .limit(500)
        ).data;
      }
      if (Array.isArray(rows)) {
        for (const row of rows) ingestSupabaseRow(row);
      }

      // Also list all Auth accounts so even users who haven't triggered profile sync appear
      try {
        const { data: authList } = await adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 500,
        });
        for (const authUser of authList?.users ?? []) {
          if (!authUser?.id || byId.has(authUser.id)) continue;
          const meta = authUser.user_metadata ?? {};
          const rawDisplay =
            (typeof meta.display_name === "string" && meta.display_name.trim()) ||
            (typeof meta.full_name === "string" && meta.full_name.trim()) ||
            (typeof meta.name === "string" && meta.name.trim()) ||
            authUser.email?.split("@")[0] ||
            `Membre ${authUser.id.slice(0, 6)}`;
          const rawUser =
            (typeof meta.username === "string" && meta.username.trim()) ||
            rawDisplay
              .toLowerCase()
              .replace(/[^a-z0-9_]+/g, "_")
              .replace(/^_+|_+$/g, "") ||
            `user_${authUser.id.slice(0, 6)}`;
          ingestSupabaseRow({
            id: authUser.id,
            username: rawUser,
            display_name: rawDisplay,
            avatar_url: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
            accent_color: "#E5484D",
            role: "user",
            created_at: authUser.created_at,
          });
        }
      } catch {
        // non-fatal if auth admin API is unavailable
      }
    }
  } catch {
    // non-fatal
  }

  // 2) ALWAYS also query `public.public_profiles` view (security_invoker = false) via server client!
  //    This guarantees EVERY registered Supabase user is returned even when SUPABASE_SERVICE_ROLE_KEY
  //    is not configured and `public.profiles` RLS restricts direct SELECT to auth.uid() = id.
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { data: publicRows } = await supabase
        .from("public_profiles")
        .select("*")
        .order("joined_at", { ascending: false })
        .limit(500);

      if (Array.isArray(publicRows)) {
        for (const row of publicRows) ingestSupabaseRow(row);
      }

      // Also merge the creator's own direct `profiles` row in case `public_profiles` lacks a column
      const { data: ownRow } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name, avatar_url, accent_color, role, unlocked_badges, pinned_badges, created_at"
        )
        .eq("id", guard.actor.id)
        .maybeSingle();
      if (ownRow) ingestSupabaseRow(ownRow);
    }
  } catch {
    // non-fatal
  }

  // 3) Merge real local server accounts (strictly excluding Shiori seed/demo bots)
  for (const p of getAllLocalCommunityProfiles()) {
    if (isSeedBotAccount(p)) continue;
    if (!byId.has(p.id)) {
      byId.set(p.id, {
        id: p.id,
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        accentColor: p.accentColor || "#E5484D",
        role:
          p.id === guard.actor.id
            ? "creator"
            : resolvePublicProfileRole({
                dbRole: p.role,
                username: p.username,
                displayName: p.displayName,
              }),
        joinedAt: p.joinedAt,
        unlockedBadges: p.unlockedBadges ?? [],
        pinnedBadges: p.pinnedBadges ?? [],
        source: "local",
      });
    }
  }

  const roleWeight: Record<UserRole, number> = { creator: 0, moderator: 1, user: 2 };
  let users = Array.from(byId.values()).sort(
    (a, b) =>
      roleWeight[a.role] - roleWeight[b.role] ||
      new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
  );

  const totalCount = users.length;

  if (q) {
    users = users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    users: users.slice(0, 500),
    totalCount,
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
          let row = (
            await supabase
              .from("profiles")
              .select("unlocked_badges, pinned_badges")
              .eq("id", userId)
              .maybeSingle()
          ).data;

          // Fallback to public_profiles when SELECT on profiles is RLS-scoped to auth.uid() = id
          if (!row) {
            row = (
              await supabase
                .from("public_profiles")
                .select("unlocked_badges, pinned_badges")
                .eq("id", userId)
                .maybeSingle()
            ).data;
          }

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
              try {
                await supabase
                  .from("user_badges")
                  .upsert(
                    { user_id: userId, badge_id: badgeId, unlocked_at: nowIso },
                    { onConflict: "user_id,badge_id" }
                  );
              } catch {
                // non-fatal if RLS on user_badges restricts non-service-role writes
              }
            } else {
              map.delete(badgeId);
              try {
                await supabase
                  .from("user_badges")
                  .delete()
                  .eq("user_id", userId)
                  .eq("badge_id", badgeId);
              } catch {
                // non-fatal
              }
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
