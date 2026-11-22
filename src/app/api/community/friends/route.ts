import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureServerSupabaseProfile,
  getAllLocalCommunityProfiles,
  makeId,
  readSocialDb,
  resolveServerActor,
  writeSocialDb,
} from "@/lib/server/social-store";
import type {
  FriendRequestWithProfile,
  FriendshipRecord,
  PublicUserProfile,
} from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupabaseProfile(row: any): PublicUserProfile {
  const displayName = String(row.display_name || row.username || "Membre Shiori");
  const s = row.stats_summary && typeof row.stats_summary === "object" ? row.stats_summary : {};
  return {
    id: String(row.id),
    username: String(row.username),
    displayName,
    avatarUrl: row.avatar_url ?? null,
    avatarInitials: displayName.slice(0, 2).toUpperCase(),
    bio: String(row.bio ?? ""),
    accentColor: String(row.accent_color || "#E5484D"),
    isActivityPublic: row.is_activity_public !== false,
    joinedAt: row.joined_at ?? row.created_at ?? new Date().toISOString(),
    favoriteStaff: Array.isArray(row.favorite_staff) ? row.favorite_staff : [],
    favoriteMedia: Array.isArray(row.favorite_media) ? row.favorite_media : [],
    stats: {
      totalEntries: Number(s.totalEntries ?? 0),
      animeCount: Number(s.animeCount ?? 0),
      mangaCount: Number(s.mangaCount ?? 0),
      episodesWatched: Number(s.episodesWatched ?? 0),
      chaptersRead: Number(s.chaptersRead ?? 0),
      completedCount: Number(s.completedCount ?? 0),
      meanScore: typeof s.meanScore === "number" ? s.meanScore : null,
    },
    unlockedBadges: Array.isArray(row.unlocked_badges) ? row.unlocked_badges : [],
    pinnedBadges: Array.isArray(row.pinned_badges) ? row.pinned_badges.slice(0, 3) : [],
    source: "supabase",
  };
}

function makeFallbackProfile(
  id: string,
  username: string,
  displayName: string,
  avatarUrl: string | null
): PublicUserProfile {
  return {
    id,
    username,
    displayName,
    avatarUrl,
    avatarInitials: (displayName || username || "SH").slice(0, 2).toUpperCase(),
    bio: "",
    accentColor: "#E5484D",
    isActivityPublic: true,
    joinedAt: new Date().toISOString(),
    favoriteStaff: [],
    favoriteMedia: [],
    stats: {
      totalEntries: 0,
      animeCount: 0,
      mangaCount: 0,
      episodesWatched: 0,
      chaptersRead: 0,
      completedCount: 0,
      meanScore: null,
    },
    unlockedBadges: [],
    pinnedBadges: [],
  };
}

function formatSupabaseFriendError(err: { code?: string; message?: string }): {
  status: number;
  error: string;
} {
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();

  if (code === "42P01" || code === "PGRST205" || msg.includes("friendships")) {
    return {
      status: 503,
      error:
        "La table public.friendships n'est pas encore créée dans Supabase. Exécutez supabase/schema.sql dans votre SQL Editor.",
    };
  }
  if (code === "23503") {
    return {
      status: 400,
      error:
        "Profil non encore synchronisé dans public.profiles. Rechargez la page puis réessayez.",
    };
  }
  if (code === "42501" || msg.includes("row-level security")) {
    return {
      status: 403,
      error:
        "Permission refusée par Supabase (RLS) sur public.friendships. Vérifiez les politiques de schema.sql.",
    };
  }
  if (code === "23505") {
    return {
      status: 409,
      error: "Une relation ou demande d'ami existe déjà avec cet utilisateur.",
    };
  }
  return {
    status: 500,
    error: err.message || "Erreur Supabase lors de la gestion de l'amitié.",
  };
}

async function loadAllKnownProfiles(): Promise<{
  byId: Map<string, PublicUserProfile>;
  byUsername: Map<string, PublicUserProfile>;
}> {
  const byId = new Map<string, PublicUserProfile>();
  const byUsername = new Map<string, PublicUserProfile>();

  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("public_profiles")
        .select("*")
        .limit(200);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const p = mapSupabaseProfile(row);
          byId.set(p.id, p);
          byUsername.set(p.username.toLowerCase(), p);
        }
      }
    }
  } catch {
    // ignore if view not migrated
  }

  for (const p of getAllLocalCommunityProfiles()) {
    if (!byId.has(p.id)) byId.set(p.id, p);
    const key = p.username.toLowerCase();
    if (!byUsername.has(key)) byUsername.set(key, p);
  }

  return { byId, byUsername };
}

async function findTargetProfile(
  rawTargetId: string,
  rawTargetUsername: string
): Promise<PublicUserProfile | null> {
  // 1) Direct targeted lookup in Supabase `public_profiles` (handles > 200 users cleanly!)
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      if (rawTargetId && isUuid(rawTargetId)) {
        const { data } = await supabase
          .from("public_profiles")
          .select("*")
          .eq("id", rawTargetId)
          .maybeSingle();
        if (data) return mapSupabaseProfile(data);
      }
      if (rawTargetUsername) {
        const { data } = await supabase
          .from("public_profiles")
          .select("*")
          .ilike("username", rawTargetUsername)
          .maybeSingle();
        if (data) return mapSupabaseProfile(data);
      }
    }
  } catch {
    // fall through to local community store
  }

  // 2) Fallback lookup in local / community profiles
  const local = getAllLocalCommunityProfiles();
  const targetLower = rawTargetUsername.toLowerCase();
  return (
    local.find(
      (p) =>
        (rawTargetId && p.id === rawTargetId) ||
        (targetLower && p.username.toLowerCase() === targetLower)
    ) ?? null
  );
}

function samePair(
  f: FriendshipRecord,
  aId: string,
  aUserLower: string,
  bId: string,
  bUserLower: string
): boolean {
  const fReqU = f.requesterUsername.toLowerCase();
  const fAddU = f.addresseeUsername.toLowerCase();
  const forward =
    (f.requesterId === aId || fReqU === aUserLower) &&
    (f.addresseeId === bId || fAddU === bUserLower);
  const reverse =
    (f.requesterId === bId || fReqU === bUserLower) &&
    (f.addresseeId === aId || fAddU === aUserLower);
  return forward || reverse;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const actor = await resolveServerActor({
    userId: searchParams.get("userId") ?? undefined,
    username: searchParams.get("username") ?? undefined,
  });

  const actorUserLower = actor.username.toLowerCase();
  const { byId, byUsername } = await loadAllKnownProfiles();
  const records: FriendshipRecord[] = [];
  let warning: string | undefined;

  // 1) Fetch Supabase friendships if signed in via Supabase
  if (actor.source === "supabase" && isUuid(actor.id)) {
    try {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("friendships")
          .select("*")
          .or(`requester_id.eq.${actor.id},addressee_id.eq.${actor.id}`)
          .order("created_at", { ascending: false });

        if (error) {
          warning = formatSupabaseFriendError(error).error;
        } else if (Array.isArray(data)) {
          for (const row of data) {
            const reqProfile = byId.get(String(row.requester_id));
            const addProfile = byId.get(String(row.addressee_id));
            records.push({
              id: String(row.id),
              requesterId: String(row.requester_id),
              requesterUsername: reqProfile?.username ?? "membre",
              requesterDisplayName: reqProfile?.displayName ?? "Membre Shiori",
              requesterAvatarUrl: reqProfile?.avatarUrl ?? null,
              addresseeId: String(row.addressee_id),
              addresseeUsername: addProfile?.username ?? "membre",
              addresseeDisplayName: addProfile?.displayName ?? "Membre Shiori",
              addresseeAvatarUrl: addProfile?.avatarUrl ?? null,
              status: row.status === "ACCEPTED" ? "ACCEPTED" : "PENDING",
              createdAt: row.created_at ?? new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // keep going cleanly
    }
  }

  // 2) Merge local friendships
  const db = readSocialDb();
  for (const f of db.friendships) {
    const involvesActor =
      f.requesterId === actor.id ||
      f.addresseeId === actor.id ||
      f.requesterUsername.toLowerCase() === actorUserLower ||
      f.addresseeUsername.toLowerCase() === actorUserLower;
    if (!involvesActor) continue;

    const already = records.some((r) =>
      samePair(
        r,
        f.requesterId,
        f.requesterUsername.toLowerCase(),
        f.addresseeId,
        f.addresseeUsername.toLowerCase()
      )
    );
    if (!already) records.push(f);
  }

  const friends: PublicUserProfile[] = [];
  const incomingRequests: FriendRequestWithProfile[] = [];
  const outgoingRequests: FriendRequestWithProfile[] = [];
  const seenFriendKeys = new Set<string>();

  for (const f of records) {
    const iAmRequester =
      f.requesterId === actor.id ||
      f.requesterUsername.toLowerCase() === actorUserLower;
    const otherId = iAmRequester ? f.addresseeId : f.requesterId;
    const otherUsername = iAmRequester ? f.addresseeUsername : f.requesterUsername;
    const otherDisplayName = iAmRequester ? f.addresseeDisplayName : f.requesterDisplayName;
    const otherAvatar = iAmRequester ? f.addresseeAvatarUrl : f.requesterAvatarUrl;

    const otherProfile =
      byId.get(otherId) ??
      byUsername.get(otherUsername.toLowerCase()) ??
      makeFallbackProfile(otherId, otherUsername, otherDisplayName, otherAvatar);

    const dedupKey = otherProfile.username.toLowerCase();
    if (dedupKey === actorUserLower) continue;

    if (f.status === "ACCEPTED") {
      if (!seenFriendKeys.has(dedupKey)) {
        seenFriendKeys.add(dedupKey);
        friends.push(otherProfile);
      }
    } else if (iAmRequester) {
      outgoingRequests.push({ friendship: f, user: otherProfile });
    } else {
      incomingRequests.push({ friendship: f, user: otherProfile });
    }
  }

  return NextResponse.json({
    friends,
    incomingRequests,
    outgoingRequests,
    friendships: records,
    warning,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || "add") as "add" | "accept" | "decline" | "remove";

    if (!["add", "accept", "decline", "remove"].includes(action)) {
      return NextResponse.json(
        { ok: false, error: "Action d'amitié non reconnue." },
        { status: 400 }
      );
    }

    const actor = await resolveServerActor({
      userId: body?.userId,
      username: body?.username,
      displayName: body?.displayName,
      avatarUrl: body?.avatarUrl,
      accentColor: body?.accentColor,
    });

    const rawTargetUsername = String(body?.targetUsername || "")
      .trim()
      .replace(/^@+/, "");
    const rawTargetId = String(body?.targetUserId || "").trim();

    if (!rawTargetUsername && !rawTargetId) {
      return NextResponse.json(
        { ok: false, error: "Veuillez renseigner un pseudo d'utilisateur valide." },
        { status: 400 }
      );
    }

    const targetProfile = await findTargetProfile(rawTargetId, rawTargetUsername);

    if (!targetProfile) {
      const shownHandle = rawTargetUsername ? ` (@${rawTargetUsername})` : "";
      return NextResponse.json(
        {
          ok: false,
          code: "USER_NOT_FOUND",
          error: `Utilisateur introuvable sur Shiori${shownHandle}. Vérifiez le pseudo exact ou demandez-lui de se connecter une première fois.`,
        },
        { status: 404 }
      );
    }

    const actorUserLower = actor.username.toLowerCase();
    const targetUserLower = targetProfile.username.toLowerCase();

    if (targetProfile.id === actor.id || targetUserLower === actorUserLower) {
      return NextResponse.json(
        {
          ok: false,
          code: "SELF_FRIEND",
          error: "Vous ne pouvez pas vous ajouter vous-même en ami.",
        },
        { status: 400 }
      );
    }

    const targetIsSupabaseUser = isUuid(targetProfile.id);
    if (targetIsSupabaseUser && actor.source !== "supabase") {
      return NextResponse.json(
        {
          ok: false,
          code: "AUTH_REQUIRED",
          error:
            "Connectez-vous à votre compte Shiori pour ajouter un membre inscrit en ami.",
        },
        { status: 401 }
      );
    }

    const canSyncSupabase =
      actor.source === "supabase" && isUuid(actor.id) && targetIsSupabaseUser;

    // 1) SUPABASE CLOUD FRIENDSHIPS (Primary source of truth for registered Supabase users)
    if (canSyncSupabase) {
      const supabase = await getSupabaseServerClient();
      if (!supabase) {
        return NextResponse.json(
          { ok: false, error: "Connexion Supabase indisponible côté serveur." },
          { status: 503 }
        );
      }

      // Ensure actor's own profile row exists in `public.profiles` before FK insert!
      const ensured = await ensureServerSupabaseProfile(supabase, actor);
      if (!ensured.ok) {
        return NextResponse.json(
          {
            ok: false,
            error:
              ensured.error ||
              "Impossible d'initialiser votre profil dans public.profiles.",
          },
          { status: 500 }
        );
      }

      if (action === "remove" || action === "decline") {
        const { error } = await supabase
          .from("friendships")
          .delete()
          .or(
            `and(requester_id.eq.${actor.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${actor.id})`
          );
        if (error) {
          const mapped = formatSupabaseFriendError(error);
          return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
        }
        return NextResponse.json({ ok: true, status: "REMOVED" });
      }

      if (action === "accept") {
        const { data: updated, error } = await supabase
          .from("friendships")
          .update({ status: "ACCEPTED", updated_at: new Date().toISOString() })
          .eq("requester_id", targetProfile.id)
          .eq("addressee_id", actor.id)
          .select("id")
          .maybeSingle();

        if (error) {
          const mapped = formatSupabaseFriendError(error);
          return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
        }
        if (!updated) {
          return NextResponse.json(
            { ok: false, error: "Aucune demande d'ami en attente de cet utilisateur." },
            { status: 404 }
          );
        }
        return NextResponse.json({ ok: true, status: "ACCEPTED" });
      }

      // action === "add" — Check both directions first!
      const { data: existingRows, error: checkErr } = await supabase
        .from("friendships")
        .select("*")
        .or(
          `and(requester_id.eq.${actor.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${actor.id})`
        );

      if (checkErr) {
        const mapped = formatSupabaseFriendError(checkErr);
        return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
      }

      const existing = Array.isArray(existingRows) ? existingRows[0] : null;
      if (existing) {
        if (existing.status === "ACCEPTED") {
          return NextResponse.json({
            ok: true,
            status: "ACCEPTED",
            alreadyFriends: true,
            message: `Vous êtes déjà ami avec ${targetProfile.displayName} (@${targetProfile.username}).`,
          });
        }
        // Reverse incoming request -> auto-accept!
        if (existing.addressee_id === actor.id) {
          const { error: accErr } = await supabase
            .from("friendships")
            .update({ status: "ACCEPTED", updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (accErr) {
            const mapped = formatSupabaseFriendError(accErr);
            return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
          }
          return NextResponse.json({
            ok: true,
            status: "ACCEPTED",
            autoAccepted: true,
          });
        }
        return NextResponse.json({
          ok: true,
          status: "PENDING",
          alreadyPending: true,
          message: `Une demande d'ami est déjà en attente pour @${targetProfile.username}.`,
        });
      }

      const { data: inserted, error: insErr } = await supabase
        .from("friendships")
        .insert({
          requester_id: actor.id,
          addressee_id: targetProfile.id,
          status: "PENDING",
        })
        .select("id, created_at")
        .single();

      if (insErr) {
        const mapped = formatSupabaseFriendError(insErr);
        return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
      }

      return NextResponse.json({
        ok: true,
        status: "PENDING",
        friendship: {
          id: String(inserted.id),
          requesterId: actor.id,
          requesterUsername: ensured.username,
          requesterDisplayName: actor.displayName,
          requesterAvatarUrl: actor.avatarUrl,
          addresseeId: targetProfile.id,
          addresseeUsername: targetProfile.username,
          addresseeDisplayName: targetProfile.displayName,
          addresseeAvatarUrl: targetProfile.avatarUrl,
          status: "PENDING",
          createdAt: inserted.created_at ?? new Date().toISOString(),
        },
      });
    }

    // 2) LOCAL / COMMUNITY SHOWCASE FRIENDSHIPS
    const db = readSocialDb();
    const existingIdx = db.friendships.findIndex((f) =>
      samePair(f, actor.id, actorUserLower, targetProfile.id, targetUserLower)
    );

    if (action === "remove" || action === "decline") {
      if (existingIdx !== -1) {
        db.friendships.splice(existingIdx, 1);
        writeSocialDb(db);
      }
      return NextResponse.json({ ok: true, status: "REMOVED" });
    }

    if (action === "accept") {
      if (existingIdx !== -1) {
        db.friendships[existingIdx].status = "ACCEPTED";
        writeSocialDb(db);
      } else {
        db.friendships.unshift({
          id: makeId("fr"),
          requesterId: targetProfile.id,
          requesterUsername: targetProfile.username,
          requesterDisplayName: targetProfile.displayName,
          requesterAvatarUrl: targetProfile.avatarUrl,
          addresseeId: actor.id,
          addresseeUsername: actor.username,
          addresseeDisplayName: actor.displayName,
          addresseeAvatarUrl: actor.avatarUrl,
          status: "ACCEPTED",
          createdAt: new Date().toISOString(),
        });
        writeSocialDb(db);
      }
      return NextResponse.json({ ok: true, status: "ACCEPTED" });
    }

    if (existingIdx !== -1) {
      const existing = db.friendships[existingIdx];
      const isIncoming =
        existing.addresseeId === actor.id ||
        existing.addresseeUsername.toLowerCase() === actorUserLower;
      if (isIncoming && existing.status === "PENDING") {
        existing.status = "ACCEPTED";
        writeSocialDb(db);
        return NextResponse.json({
          ok: true,
          status: "ACCEPTED",
          autoAccepted: true,
          friendship: existing,
        });
      }
      return NextResponse.json({
        ok: true,
        status: existing.status,
        alreadyFriends: existing.status === "ACCEPTED",
        alreadyPending: existing.status === "PENDING",
        friendship: existing,
      });
    }

    const isCommunityShowcase = targetProfile.id.startsWith("community-");
    const status = isCommunityShowcase ? "ACCEPTED" : "PENDING";

    const record: FriendshipRecord = {
      id: makeId("fr"),
      requesterId: actor.id,
      requesterUsername: actor.username,
      requesterDisplayName: actor.displayName,
      requesterAvatarUrl: actor.avatarUrl,
      addresseeId: targetProfile.id,
      addresseeUsername: targetProfile.username,
      addresseeDisplayName: targetProfile.displayName,
      addresseeAvatarUrl: targetProfile.avatarUrl,
      status,
      createdAt: new Date().toISOString(),
    };

    db.friendships.unshift(record);
    writeSocialDb(db);

    return NextResponse.json({
      ok: true,
      status,
      autoAccepted: isCommunityShowcase,
      friendship: record,
    });
  } catch (err) {
    console.error("[/api/community/friends] POST error:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? `Erreur lors de la mise à jour de l'amitié : ${err.message}`
            : "Impossible de traiter la demande d'ami pour le moment.",
      },
      { status: 500 }
    );
  }
}
