import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import {
  ensureServerSupabaseProfile,
  getAllLocalCommunityProfiles,
  isAuthenticatedActor,
  isLocalPairBlocked,
  makeId,
  readSocialDb,
  resolveServerActor,
  writeSocialDb,
} from "@/lib/server/social-store";
import type { DirectMessageItem, PublicUserProfile } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPublicProfileRow(row: any): PublicUserProfile {
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

/**
 * Resolves live profiles strictly by unique user ID from `public.public_profiles`
 * (with local community profile fallback for non-UUID showcase profiles).
 */
async function loadProfilesByIds(ids: string[]): Promise<Map<string, PublicUserProfile>> {
  const map = new Map<string, PublicUserProfile>();
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return map;

  const uuidIds = uniqueIds.filter(isUuid);
  if (uuidIds.length > 0) {
    try {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("public_profiles")
          .select("*")
          .in("id", uuidIds);
        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const p = mapPublicProfileRow(row);
            map.set(p.id, p);
          }
        }
      }
    } catch {
      // non-fatal
    }
  }

  // Fill any remaining IDs from local community profiles
  const localProfiles = getAllLocalCommunityProfiles();
  for (const p of localProfiles) {
    if (!map.has(p.id) && uniqueIds.includes(p.id)) {
      map.set(p.id, p);
    }
  }

  return map;
}

export async function GET() {
  const actor = await resolveServerActor();
  if (!isAuthenticatedActor(actor)) {
    return NextResponse.json(
      { error: "Connexion requise pour consulter vos messages privés." },
      { status: 401 }
    );
  }

  const merged = new Map<string, DirectMessageItem>();

  // 1) Fetch from Supabase `direct_messages` strictly by verified actor UUID
  if (actor.source === "supabase" && isUuid(actor.id)) {
    try {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("direct_messages")
          .select("*")
          .or(`sender_id.eq.${actor.id},recipient_id.eq.${actor.id}`)
          .order("created_at", { ascending: true })
          .limit(500);

        if (!error && Array.isArray(data)) {
          for (const m of data) {
            merged.set(String(m.id), {
              id: String(m.id),
              senderId: String(m.sender_id),
              recipientId: String(m.recipient_id),
              senderUsername: String(m.sender_username ?? ""),
              senderDisplayName: String(m.sender_display_name ?? m.sender_username ?? ""),
              senderAvatarUrl: m.sender_avatar_url ?? null,
              recipientUsername: String(m.recipient_username ?? ""),
              recipientDisplayName: String(m.recipient_display_name ?? m.recipient_username ?? ""),
              recipientAvatarUrl: m.recipient_avatar_url ?? null,
              body: String(m.body),
              isRead: Boolean(m.is_read),
              createdAt: m.created_at,
            });
          }
        }
      }
    } catch {
      // fall through if table not yet migrated
    }
  } else if (actor.source === "account") {
    // 2) Built-in local server account messages involving strictly verified actor.id
    const db = readSocialDb();
    for (const m of db.messages) {
      const involvesMe = m.senderId === actor.id || m.recipientId === actor.id;
      if (involvesMe && !merged.has(m.id)) {
        merged.set(m.id, m);
      }
    }
  }

  // 3) Hydrate live current username, displayName & avatarUrl from `public.public_profiles`
  // strictly via senderId / recipientId so renamed users NEVER split into duplicate threads!
  const rawMessages = Array.from(merged.values());
  const allParticipantIds: string[] = [];
  for (const m of rawMessages) {
    allParticipantIds.push(m.senderId, m.recipientId);
  }
  const profilesById = await loadProfilesByIds(allParticipantIds);

  const messages: DirectMessageItem[] = rawMessages
    .map((m) => {
      const liveSender = profilesById.get(m.senderId);
      const liveRecipient = profilesById.get(m.recipientId);
      return {
        ...m,
        senderUsername: liveSender?.username ?? m.senderUsername,
        senderDisplayName: liveSender?.displayName ?? m.senderDisplayName,
        senderAvatarUrl: liveSender !== undefined ? liveSender.avatarUrl : m.senderAvatarUrl,
        recipientUsername: liveRecipient?.username ?? m.recipientUsername,
        recipientDisplayName: liveRecipient?.displayName ?? m.recipientDisplayName,
        recipientAvatarUrl:
          liveRecipient !== undefined ? liveRecipient.avatarUrl : m.recipientAvatarUrl,
      };
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const unreadCount = messages.filter(
    (m) => !m.isRead && m.recipientId === actor.id
  ).length;

  return NextResponse.json({
    actorId: actor.id,
    actorUsername: actor.username,
    messages,
    partnerProfiles: Array.from(profilesById.values()),
    unreadCount,
  });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveServerActor();
    if (!isAuthenticatedActor(actor)) {
      return NextResponse.json(
        { error: "Connexion requise pour envoyer un message privé." },
        { status: 401 }
      );
    }

    const rl = checkRateLimit(`dm:${actor.id}:${getClientIp(request)}`, 30, 60_000);
    if (!rl.allowed) {
      return rateLimitResponse(rl.retryAfterSec, "Envoi de messages trop rapide. Patientez quelques instants.");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Requête JSON invalide." }, { status: 400 });
    }
    const text = String(body?.body ?? "").trim();
    if (!text || text.length > 2000) {
      return NextResponse.json(
        { error: "Le message doit contenir entre 1 et 2000 caractères." },
        { status: 400 }
      );
    }

    const recipientId = String(body?.recipientId ?? "").trim();
    if (!recipientId) {
      return NextResponse.json({ error: "Destinataire manquant." }, { status: 400 });
    }

    if (recipientId === actor.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas vous envoyer un message à vous-même." },
        { status: 400 }
      );
    }

    if (actor.source === "account" && isLocalPairBlocked(actor.id, recipientId)) {
      return NextResponse.json(
        { error: "Impossible d'envoyer un message : un blocage est actif entre ces deux comptes." },
        { status: 403 }
      );
    }

    // Resolve recipient's latest live profile by unique ID from `public.public_profiles`
    const profileMap = await loadProfilesByIds([actor.id, recipientId]);
    const liveRecipient = profileMap.get(recipientId);
    const liveActor = profileMap.get(actor.id);

    const senderUsername = liveActor?.username ?? actor.username;
    const senderDisplayName = liveActor?.displayName ?? actor.displayName;
    const senderAvatarUrl = liveActor !== undefined ? liveActor.avatarUrl : actor.avatarUrl;

    const recipientUsername =
      liveRecipient?.username || String(body?.recipientUsername ?? "").trim() || "membre";
    const recipientDisplayName =
      liveRecipient?.displayName ||
      String(body?.recipientDisplayName || recipientUsername).trim();
    const recipientAvatarUrl =
      liveRecipient !== undefined ? liveRecipient.avatarUrl : (body?.recipientAvatarUrl ?? null);

    let messageId = makeId("dm");
    let createdAt = new Date().toISOString();
    let savedToSupabase = false;

    if (actor.source === "supabase" && isUuid(actor.id) && isUuid(recipientId)) {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        await ensureServerSupabaseProfile(supabase, {
          id: actor.id,
          username: senderUsername,
          displayName: senderDisplayName,
          avatarUrl: senderAvatarUrl,
          accentColor: actor.accentColor,
        });

        const { data: inserted, error } = await supabase
          .from("direct_messages")
          .insert({
            sender_id: actor.id,
            recipient_id: recipientId,
            sender_username: senderUsername,
            sender_display_name: senderDisplayName,
            sender_avatar_url: senderAvatarUrl,
            recipient_username: recipientUsername,
            recipient_display_name: recipientDisplayName,
            recipient_avatar_url: recipientAvatarUrl,
            body: text,
            is_read: false,
          })
          .select("id, created_at")
          .single();

        if (error) {
          const isPolicyBlock =
            error.code === "42501" ||
            (error.message ?? "").toLowerCase().includes("row-level security");
          return NextResponse.json(
            {
              error: isPolicyBlock
                ? "Impossible d'envoyer un message : un blocage est actif entre ces comptes."
                : "Erreur lors de l'envoi du message.",
            },
            { status: isPolicyBlock ? 403 : 500 }
          );
        }

        if (inserted?.id) {
          messageId = String(inserted.id);
          if (inserted.created_at) createdAt = String(inserted.created_at);
          savedToSupabase = true;
        }
      }
    }

    const msg: DirectMessageItem = {
      id: messageId,
      senderId: actor.id,
      recipientId,
      senderUsername,
      senderDisplayName,
      senderAvatarUrl,
      recipientUsername,
      recipientDisplayName,
      recipientAvatarUrl,
      body: text,
      isRead: false,
      createdAt,
    };

    // Keep Supabase private DMs strictly inside Supabase (never mirror into shared local social.json)
    if (actor.source === "account") {
      try {
        const db = readSocialDb();
        if (!db.messages.some((existing) => existing.id === msg.id)) {
          db.messages.push(msg);
          writeSocialDb(db);
        }
      } catch {
        // non-fatal on serverless FS
      }
    }

    return NextResponse.json({ ok: true, message: msg, savedToSupabase });
  } catch {
    return NextResponse.json({ error: "Erreur lors de l'envoi du message." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await resolveServerActor();
    if (!isAuthenticatedActor(actor)) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const body = await request.json();
    const partnerId = String(body?.partnerId ?? "").trim();

    if (!partnerId) {
      return NextResponse.json({ error: "Identifiant partenaire manquant." }, { status: 400 });
    }

    if (actor.source === "supabase" && isUuid(actor.id) && isUuid(partnerId)) {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          await supabase
            .from("direct_messages")
            .update({ is_read: true })
            .eq("sender_id", partnerId)
            .eq("recipient_id", actor.id)
            .eq("is_read", false);
        }
      } catch {
        // ignore if table not migrated
      }
    } else if (actor.source === "account") {
      try {
        const db = readSocialDb();
        let changed = false;
        for (const m of db.messages) {
          if (m.recipientId === actor.id && m.senderId === partnerId && !m.isRead) {
            m.isRead = true;
            changed = true;
          }
        }
        if (changed) writeSocialDb(db);
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur de mise à jour." }, { status: 400 });
  }
}
