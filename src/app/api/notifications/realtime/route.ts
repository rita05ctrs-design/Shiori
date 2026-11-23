import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAllLocalCommunityProfiles,
  isAuthenticatedActor,
  readSocialDb,
  resolveServerActor,
} from "@/lib/server/social-store";
import type { ShioriNotification } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

/**
 * Aggregates live real-time notifications strictly for the server-verified authenticated user.
 * Unauthenticated callers receive HTTP 401 so private notifications can never be enumerated.
 */
export async function GET() {
  const actor = await resolveServerActor();
  if (!isAuthenticatedActor(actor)) {
    return NextResponse.json(
      { error: "Authentification requise.", notifications: [] },
      { status: 401 }
    );
  }

  const byId = new Map<string, ShioriNotification>();
  const actorUserLower = actor.username.toLowerCase();

  // Helper profile lookup for enriching Supabase IDs
  const profileMetaById = new Map<
    string,
    { username: string; displayName: string; avatarUrl: string | null }
  >();
  for (const p of getAllLocalCommunityProfiles()) {
    profileMetaById.set(p.id, {
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
    });
  }

  // 1) SUPABASE REALTIME DATA (friendships, direct_messages, activity_likes, activity_comments)
  if (actor.source === "supabase" && isUuid(actor.id)) {
    try {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        const [
          { data: pendingFr },
          { data: incomingDms },
          { data: ownEvents },
          { data: pubProfiles },
        ] = await Promise.all([
          supabase
            .from("friendships")
            .select("id, requester_id, created_at")
            .eq("addressee_id", actor.id)
            .eq("status", "PENDING")
            .order("created_at", { ascending: false })
            .limit(15),
          supabase
            .from("direct_messages")
            .select("id, sender_id, sender_username, sender_display_name, sender_avatar_url, body, is_read, created_at")
            .eq("recipient_id", actor.id)
            .order("created_at", { ascending: false })
            .limit(12),
          supabase
            .from("activity_events")
            .select("id, media_title, cover_image")
            .eq("user_id", actor.id)
            .order("created_at", { ascending: false })
            .limit(25),
          supabase
            .from("public_profiles")
            .select("id, username, display_name, avatar_url")
            .limit(200),
        ]);

        for (const p of pubProfiles ?? []) {
          profileMetaById.set(String(p.id), {
            username: String(p.username),
            displayName: String(p.display_name || p.username),
            avatarUrl: p.avatar_url ?? null,
          });
        }

        // Incoming friend requests
        for (const fr of pendingFr ?? []) {
          const reqId = String(fr.requester_id);
          const reqProf = profileMetaById.get(reqId);
          const displayName = reqProf?.displayName || "Un membre Shiori";
          const username = reqProf?.username || "membre";
          const id = `fr-${fr.id}`;
          byId.set(id, {
            id,
            kind: "FRIEND_REQUEST",
            title: `Demande d'ami de ${displayName}`,
            body: `@${username} souhaite vous ajouter en ami sur Shiori.`,
            coverImage: reqProf?.avatarUrl ?? undefined,
            href: "/community?tab=friends",
            actorId: reqId,
            actorUsername: username,
            actorDisplayName: displayName,
            actorAvatarUrl: reqProf?.avatarUrl ?? null,
            isRead: false,
            createdAt: String(fr.created_at || new Date().toISOString()),
          });
        }

        // Incoming direct messages
        for (const dm of incomingDms ?? []) {
          const senderId = String(dm.sender_id);
          const senderProf = profileMetaById.get(senderId);
          const displayName = senderProf?.displayName || String(dm.sender_display_name || "Membre");
          const username = senderProf?.username || String(dm.sender_username || "membre");
          const id = `dm-${dm.id}`;
          byId.set(id, {
            id,
            kind: "MESSAGE",
            title: `Nouveau message de ${displayName}`,
            body: String(dm.body ?? "").slice(0, 140),
            coverImage: senderProf?.avatarUrl ?? dm.sender_avatar_url ?? undefined,
            href: `/messages?to=${encodeURIComponent(username)}`,
            actorId: senderId,
            actorUsername: username,
            actorDisplayName: displayName,
            actorAvatarUrl: senderProf?.avatarUrl ?? dm.sender_avatar_url ?? null,
            isRead: Boolean(dm.is_read),
            createdAt: String(dm.created_at || new Date().toISOString()),
          });
        }

        // Likes & comments received on the user's own activities
        const ownEventIds = (ownEvents ?? []).map((e) => String(e.id));
        const ownEventMap = new Map(
          (ownEvents ?? []).map((e) => [
            String(e.id),
            { title: String(e.media_title), cover: e.cover_image ?? undefined },
          ])
        );

        if (ownEventIds.length > 0) {
          const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
            supabase
              .from("activity_likes")
              .select("activity_id, user_id, created_at")
              .in("activity_id", ownEventIds)
              .neq("user_id", actor.id)
              .order("created_at", { ascending: false })
              .limit(15),
            supabase
              .from("activity_comments")
              .select("id, activity_id, user_id, author_username, author_display_name, author_avatar_url, body, created_at")
              .in("activity_id", ownEventIds)
              .neq("user_id", actor.id)
              .order("created_at", { ascending: false })
              .limit(15),
          ]);

          for (const l of likeRows ?? []) {
            const likerId = String(l.user_id);
            const liker = profileMetaById.get(likerId);
            const act = ownEventMap.get(String(l.activity_id));
            const id = `like-${l.activity_id}-${likerId}`;
            byId.set(id, {
              id,
              kind: "SOCIAL",
              title: `${liker?.displayName || "Un membre"} a aimé votre activité`,
              body: act ? `Sur « ${act.title} » dans le fil communautaire.` : "Sur votre activité Shiori.",
              coverImage: act?.cover ?? liker?.avatarUrl ?? undefined,
              href: "/community?tab=activity",
              actorId: likerId,
              actorUsername: liker?.username,
              actorDisplayName: liker?.displayName,
              actorAvatarUrl: liker?.avatarUrl ?? null,
              isRead: false,
              createdAt: String(l.created_at || new Date().toISOString()),
            });
          }

          for (const c of commentRows ?? []) {
            const act = ownEventMap.get(String(c.activity_id));
            const id = `cmt-${c.id}`;
            byId.set(id, {
              id,
              kind: "SOCIAL",
              title: `${c.author_display_name || c.author_username} a commenté votre activité`,
              body: `${act ? `[${act.title}] ` : ""}« ${String(c.body ?? "").slice(0, 110)} »`,
              coverImage: act?.cover ?? c.author_avatar_url ?? undefined,
              href: "/community?tab=activity",
              actorId: String(c.user_id),
              actorUsername: String(c.author_username),
              actorDisplayName: String(c.author_display_name),
              actorAvatarUrl: c.author_avatar_url ?? null,
              isRead: false,
              createdAt: String(c.created_at || new Date().toISOString()),
            });
          }
        }
      }
    } catch {
      // graceful fallback to local store
    }
  }

  // 2) LOCAL STORE (only for built-in local server accounts; never mix into Supabase accounts)
  if (actor.source === "account") {
  try {
    const db = readSocialDb();

    // Pending incoming friend requests
    for (const f of db.friendships) {
      const toMe =
        f.status === "PENDING" &&
        (f.addresseeId === actor.id || f.addresseeUsername.toLowerCase() === actorUserLower);
      if (!toMe) continue;
      const id = `fr-${f.id}`;
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          kind: "FRIEND_REQUEST",
          title: `Demande d'ami de ${f.requesterDisplayName}`,
          body: `@${f.requesterUsername} souhaite vous ajouter en ami sur Shiori.`,
          coverImage: f.requesterAvatarUrl ?? undefined,
          href: "/community?tab=friends",
          actorId: f.requesterId,
          actorUsername: f.requesterUsername,
          actorDisplayName: f.requesterDisplayName,
          actorAvatarUrl: f.requesterAvatarUrl ?? null,
          isRead: false,
          createdAt: f.createdAt,
        });
      }
    }

    // Incoming DMs
    const localDms = db.messages
      .filter((m) => m.recipientId === actor.id)
      .slice(-12);
    for (const dm of localDms) {
      const id = `dm-${dm.id}`;
      if (!byId.has(id)) {
        const senderProf = profileMetaById.get(dm.senderId);
        const displayName = senderProf?.displayName || dm.senderDisplayName;
        const username = senderProf?.username || dm.senderUsername;
        byId.set(id, {
          id,
          kind: "MESSAGE",
          title: `Nouveau message de ${displayName}`,
          body: dm.body.slice(0, 140),
          coverImage: senderProf?.avatarUrl ?? dm.senderAvatarUrl ?? undefined,
          href: `/messages?to=${encodeURIComponent(username)}`,
          actorId: dm.senderId,
          actorUsername: username,
          actorDisplayName: displayName,
          actorAvatarUrl: senderProf?.avatarUrl ?? dm.senderAvatarUrl ?? null,
          isRead: Boolean(dm.isRead),
          createdAt: dm.createdAt,
        });
      }
    }

    // Likes & comments received on the user's own local activities
    for (const act of db.activities) {
      const isMine =
        act.userId === actor.id || act.actorUsername.toLowerCase() === actorUserLower;
      if (!isMine) continue;

      for (const likerId of act.likes) {
        if (likerId === actor.id) continue;
        const id = `like-${act.id}-${likerId}`;
        if (!byId.has(id)) {
          const liker = profileMetaById.get(likerId);
          byId.set(id, {
            id,
            kind: "SOCIAL",
            title: `${liker?.displayName || "Un membre"} a aimé votre activité`,
            body: `Sur « ${act.mediaTitle} » dans la communauté.`,
            coverImage: act.coverImage ?? liker?.avatarUrl ?? undefined,
            href: "/community?tab=activity",
            actorId: likerId,
            actorUsername: liker?.username,
            actorDisplayName: liker?.displayName,
            actorAvatarUrl: liker?.avatarUrl ?? null,
            isRead: false,
            createdAt: act.createdAt,
          });
        }
      }

      for (const c of act.comments) {
        if (c.userId === actor.id || c.authorUsername.toLowerCase() === actorUserLower) continue;
        const id = `cmt-${c.id}`;
        if (!byId.has(id)) {
          byId.set(id, {
            id,
            kind: "SOCIAL",
            title: `${c.authorDisplayName} a commenté votre activité`,
            body: `[${act.mediaTitle}] « ${c.body.slice(0, 110)} »`,
            coverImage: act.coverImage ?? c.authorAvatarUrl ?? undefined,
            href: "/community?tab=activity",
            actorId: c.userId,
            actorUsername: c.authorUsername,
            actorDisplayName: c.authorDisplayName,
            actorAvatarUrl: c.authorAvatarUrl ?? null,
            isRead: false,
            createdAt: c.createdAt,
          });
        }
      }
    }
  } catch {
    // non-fatal
  }
  }

  const notifications = Array.from(byId.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 40);

  return NextResponse.json({ notifications });
}
