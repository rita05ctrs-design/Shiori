import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
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
        .limit(120);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const p = mapSupabaseProfile(row);
          byId.set(p.id, p);
          byUsername.set(p.username.toLowerCase(), p);
        }
      }
    }
  } catch {
    // ignore if Supabase view not migrated
  }

  for (const p of getAllLocalCommunityProfiles()) {
    if (!byId.has(p.id)) byId.set(p.id, p);
    const key = p.username.toLowerCase();
    if (!byUsername.has(key)) byUsername.set(key, p);
  }

  return { byId, byUsername };
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

        if (!error && Array.isArray(data)) {
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
      // fall through gracefully if table not migrated yet
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
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body?.action || "add") as "add" | "accept" | "decline" | "remove";

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
      return NextResponse.json({ error: "Membre cible manquant" }, { status: 400 });
    }

    const { byId, byUsername } = await loadAllKnownProfiles();
    const targetProfile =
      (rawTargetId ? byId.get(rawTargetId) : undefined) ??
      (rawTargetUsername ? byUsername.get(rawTargetUsername.toLowerCase()) : undefined) ??
      (rawTargetUsername
        ? makeFallbackProfile(
            rawTargetId || `user-${rawTargetUsername.toLowerCase()}`,
            rawTargetUsername,
            String(body?.targetDisplayName || rawTargetUsername),
            body?.targetAvatarUrl ?? null
          )
        : null);

    if (!targetProfile) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const actorUserLower = actor.username.toLowerCase();
    const targetUserLower = targetProfile.username.toLowerCase();

    if (targetProfile.id === actor.id || targetUserLower === actorUserLower) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas vous ajouter vous-même en ami." },
        { status: 400 }
      );
    }

    const db = readSocialDb();
    const existingIdx = db.friendships.findIndex((f) =>
      samePair(f, actor.id, actorUserLower, targetProfile.id, targetUserLower)
    );

    // Sync helper for Supabase `public.friendships` when both IDs are real UUIDs
    const canSyncSupabase =
      actor.source === "supabase" && isUuid(actor.id) && isUuid(targetProfile.id);

    if (action === "remove" || action === "decline") {
      if (existingIdx !== -1) {
        db.friendships.splice(existingIdx, 1);
        writeSocialDb(db);
      }
      if (canSyncSupabase) {
        try {
          const supabase = await getSupabaseServerClient();
          if (supabase) {
            await supabase
              .from("friendships")
              .delete()
              .or(
                `and(requester_id.eq.${actor.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${actor.id})`
              );
          }
        } catch {
          // non-fatal
        }
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

      if (canSyncSupabase) {
        try {
          const supabase = await getSupabaseServerClient();
          if (supabase) {
            await supabase
              .from("friendships")
              .update({ status: "ACCEPTED", updated_at: new Date().toISOString() })
              .eq("requester_id", targetProfile.id)
              .eq("addressee_id", actor.id);
          }
        } catch {
          // non-fatal
        }
      }

      return NextResponse.json({ ok: true, status: "ACCEPTED" });
    }

    // action === "add"
    if (existingIdx !== -1) {
      const existing = db.friendships[existingIdx];
      // If the other member already sent a request to actor -> auto-accept!
      const isIncoming =
        existing.addresseeId === actor.id ||
        existing.addresseeUsername.toLowerCase() === actorUserLower;
      if (isIncoming && existing.status === "PENDING") {
        existing.status = "ACCEPTED";
        writeSocialDb(db);
        if (canSyncSupabase) {
          try {
            const supabase = await getSupabaseServerClient();
            if (supabase) {
              await supabase
                .from("friendships")
                .update({ status: "ACCEPTED", updated_at: new Date().toISOString() })
                .eq("requester_id", targetProfile.id)
                .eq("addressee_id", actor.id);
            }
          } catch {
            // non-fatal
          }
        }
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
        friendship: existing,
      });
    }

    // Showcase community profiles accept right away so users can immediately test & enjoy Friends;
    // real registered/Supabase accounts receive a genuine PENDING invitation!
    const isCommunityShowcase = targetProfile.id.startsWith("community-");
    const status = isCommunityShowcase ? "ACCEPTED" : "PENDING";

    let createdId = makeId("fr");
    if (canSyncSupabase) {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          const { data: inserted } = await supabase
            .from("friendships")
            .upsert(
              {
                requester_id: actor.id,
                addressee_id: targetProfile.id,
                status,
              },
              { onConflict: "requester_id,addressee_id" }
            )
            .select("id")
            .single();
          if (inserted?.id) createdId = String(inserted.id);
        }
      } catch {
        // graceful fallback to local store
      }
    }

    const record: FriendshipRecord = {
      id: createdId,
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
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'amitié" },
      { status: 500 }
    );
  }
}
