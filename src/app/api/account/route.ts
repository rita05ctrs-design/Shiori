import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  isSecureRequest,
  readAccountDb,
  SESSION_COOKIE_NAME,
  toPublicProfile,
  writeAccountDb,
} from "@/lib/server/auth-store";
import { clearAniListConnection } from "@/lib/server/anilist-oauth";
import {
  isAuthenticatedActor,
  purgeLocalUserData,
  readSocialDb,
  resolveServerActor,
} from "@/lib/server/social-store";
import { checkRateLimit, rateLimitResponse } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/account — Full authenticated personal data export (RGPD / Portability).
 * Strictly scoped to the authenticated actor; never exports password hashes or OAuth secrets.
 */
export async function GET() {
  const actor = await resolveServerActor();
  if (!isAuthenticatedActor(actor)) {
    return NextResponse.json(
      { error: "Authentification requise pour exporter vos données." },
      { status: 401 }
    );
  }

  const limit = checkRateLimit(`account:export:${actor.id}`, 10, 5 * 60_000);
  if (!limit.ok) {
    return rateLimitResponse(limit.retryAfterSec);
  }

  const exportedAt = new Date().toISOString();

  if (actor.source === "supabase") {
    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service Supabase indisponible." }, { status: 503 });
    }

    const [
      { data: profileRow },
      { data: libraryRows },
      { data: collectionRows },
      { data: badgeRows },
      { data: notifRows },
      { data: blockRows },
      { data: friendRows },
      { data: activityRows },
      { data: dmRows },
      { data: anilistStatsRow },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, username, display_name, email, bio, avatar_url, banner_url, accent_color, is_activity_public, preferred_language, notification_prefs, favorite_staff, favorite_media, stats_summary, unlocked_badges, pinned_badges, anilist_username, anilist_user_id, anilist_connected_at, created_at, updated_at"
        )
        .eq("id", actor.id)
        .maybeSingle(),
      supabase.from("library_entries").select("*").eq("user_id", actor.id),
      supabase.from("user_collections").select("*").eq("user_id", actor.id),
      supabase.from("user_badges").select("*").eq("user_id", actor.id),
      supabase.from("notifications").select("*").eq("user_id", actor.id),
      supabase.from("user_blocks").select("*").eq("blocker_id", actor.id),
      supabase
        .from("friendships")
        .select("*")
        .or(`requester_id.eq.${actor.id},addressee_id.eq.${actor.id}`),
      supabase.from("activity_events").select("*").eq("user_id", actor.id),
      supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${actor.id},recipient_id.eq.${actor.id}`),
      supabase.from("user_anilist_stats").select("*").eq("user_id", actor.id).maybeSingle(),
    ]);

    return NextResponse.json({
      schemaVersion: "shiori-export-v2",
      exportedAt,
      source: "supabase",
      profile: profileRow ?? { id: actor.id, username: actor.username, displayName: actor.displayName },
      library: libraryRows ?? [],
      collections: collectionRows ?? [],
      badges: badgeRows ?? [],
      notifications: notifRows ?? [],
      anilistStats: anilistStatsRow ?? null,
      social: {
        activities: activityRows ?? [],
        friendships: friendRows ?? [],
        blocks: blockRows ?? [],
        directMessages: dmRows ?? [],
      },
    });
  }

  // Local server account export
  const db = readAccountDb();
  const account = db.users.find((u) => u.id === actor.id);
  if (!account) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }

  const socialDb = readSocialDb();
  return NextResponse.json({
    schemaVersion: "shiori-export-v2",
    exportedAt,
    source: "account",
    profile: toPublicProfile(account),
    library: account.library ?? [],
    collections: account.collections ?? [],
    favoriteStaff: account.favoriteStaff ?? [],
    favoriteOrder: account.favoriteOrder ?? [],
    uiPreferences: account.uiPreferences ?? null,
    unlockedBadges: account.unlockedBadges ?? [],
    pinnedBadges: account.pinnedBadges ?? [],
    notifications: account.notifications ?? [],
    social: {
      activities: socialDb.activities.filter((a) => a.userId === actor.id),
      friendships: socialDb.friendships.filter(
        (f) => f.requesterId === actor.id || f.addresseeId === actor.id
      ),
      blocks: (socialDb.blocks ?? []).filter((b) => b.blockerId === actor.id),
      directMessages: (socialDb.messages ?? []).filter(
        (m) => m.senderId === actor.id || m.recipientId === actor.id
      ),
    },
  });
}

/**
 * DELETE /api/account — Self-service permanent deletion of the authenticated user's
 * account and associated data. Requires explicit `{ confirmation: "SUPPRIMER" }`.
 */
export async function DELETE(request: NextRequest) {
  const actor = await resolveServerActor();
  if (!isAuthenticatedActor(actor)) {
    return NextResponse.json(
      { error: "Authentification requise pour supprimer votre compte." },
      { status: 401 }
    );
  }

  const limit = checkRateLimit(`account:delete:${actor.id}`, 5, 15 * 60_000);
  if (!limit.ok) {
    return rateLimitResponse(limit.retryAfterSec);
  }

  const body = await request.json().catch(() => null);
  const confirmation = String(body?.confirmation ?? "").trim().toUpperCase();
  if (confirmation !== "SUPPRIMER") {
    return NextResponse.json(
      { error: 'Confirmation requise : envoyez { "confirmation": "SUPPRIMER" }.' },
      { status: 400 }
    );
  }

  if (actor.source === "supabase") {
    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ error: "Service Supabase indisponible." }, { status: 503 });
    }

    // 1) Delete user-owned rows explicitly under user's own RLS session (defense-in-depth)
    const cleanupOps = [
      supabase.from("library_entries").delete().eq("user_id", actor.id),
      supabase.from("user_collections").delete().eq("user_id", actor.id),
      supabase.from("user_badges").delete().eq("user_id", actor.id),
      supabase.from("notifications").delete().eq("user_id", actor.id),
      supabase.from("user_blocks").delete().eq("blocker_id", actor.id),
      supabase.from("activity_likes").delete().eq("user_id", actor.id),
      supabase.from("activity_comments").delete().eq("user_id", actor.id),
      supabase.from("activity_events").delete().eq("user_id", actor.id),
      supabase
        .from("friendships")
        .delete()
        .or(`requester_id.eq.${actor.id},addressee_id.eq.${actor.id}`),
      supabase.from("user_anilist_stats").delete().eq("user_id", actor.id),
    ];
    await Promise.allSettled(cleanupOps);

    // 2) Delete profile row (requires DELETE RLS policy on public.profiles)
    const { error: profileDeleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", actor.id);

    // 3) If server has SUPABASE_SERVICE_ROLE_KEY configured, also remove auth.users entry
    let authUserDeleted = false;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey) {
      try {
        const admin = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: adminErr } = await admin.auth.admin.deleteUser(actor.id);
        if (!adminErr) {
          authUserDeleted = true;
        }
      } catch {
        // non-fatal, reported transparently below
      }
    }

    await supabase.auth.signOut().catch(() => {});

    const res = NextResponse.json({
      ok: true,
      deleted: true,
      mode: "supabase",
      profileDeleted: !profileDeleteError || authUserDeleted,
      authUserDeleted,
      note: authUserDeleted
        ? "Compte et toutes les données associées supprimés définitivement."
        : "Vos données applicatives ont été supprimées et votre session fermée. La suppression définitive de l'identifiant d'authentification requiert SUPABASE_SERVICE_ROLE_KEY côté serveur.",
    });
    await clearAniListConnection(res).catch(() => {});
    return res;
  }

  // Local server account deletion
  const db = readAccountDb();
  const nextUsers = db.users.filter((u) => u.id !== actor.id);
  if (nextUsers.length === db.users.length) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }
  db.users = nextUsers;
  writeAccountDb(db);

  // Purge all associated community data (profile, activities, likes, comments, DMs, friendships, blocks, reports)
  purgeLocalUserData(actor.id);

  const res = NextResponse.json({
    ok: true,
    deleted: true,
    mode: "account",
    profileDeleted: true,
    authUserDeleted: true,
    note: "Votre compte et toutes les données associées ont été supprimés définitivement.",
  });

  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: 0,
  });
  await clearAniListConnection(res).catch(() => {});

  return res;
}
