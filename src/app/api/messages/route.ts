import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  makeId,
  readSocialDb,
  resolveServerActor,
  writeSocialDb,
} from "@/lib/server/social-store";
import type { DirectMessageItem } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const actor = await resolveServerActor({
    userId: searchParams.get("userId") ?? undefined,
    username: searchParams.get("username") ?? undefined,
  });

  const merged = new Map<string, DirectMessageItem>();

  // 1) Fetch from Supabase `direct_messages` when authenticated via Supabase
  if (actor.source === "supabase") {
    try {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("direct_messages")
          .select("*")
          .or(`sender_id.eq.${actor.id},recipient_id.eq.${actor.id}`)
          .order("created_at", { ascending: true })
          .limit(300);

        if (!error && Array.isArray(data)) {
          for (const m of data) {
            merged.set(String(m.id), {
              id: String(m.id),
              senderId: String(m.sender_id),
              recipientId: String(m.recipient_id),
              senderUsername: String(m.sender_username),
              senderDisplayName: String(m.sender_display_name),
              senderAvatarUrl: m.sender_avatar_url ?? null,
              recipientUsername: String(m.recipient_username),
              recipientDisplayName: String(m.recipient_display_name),
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
  }

  // 2) Merge local direct messages involving this user
  const db = readSocialDb();
  const actorUserLower = actor.username.toLowerCase();
  for (const m of db.messages) {
    const involvesMe =
      m.senderId === actor.id ||
      m.recipientId === actor.id ||
      m.senderUsername.toLowerCase() === actorUserLower ||
      m.recipientUsername.toLowerCase() === actorUserLower;

    if (involvesMe && !merged.has(m.id)) {
      merged.set(m.id, m);
    }
  }

  const messages = Array.from(merged.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const unreadCount = messages.filter(
    (m) =>
      !m.isRead &&
      (m.recipientId === actor.id ||
        m.recipientUsername.toLowerCase() === actorUserLower)
  ).length;

  return NextResponse.json({
    actorId: actor.id,
    actorUsername: actor.username,
    messages,
    unreadCount,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = String(body?.body ?? "").trim();
    if (!text || text.length > 2000) {
      return NextResponse.json(
        { error: "Le message doit contenir entre 1 et 2000 caractères." },
        { status: 400 }
      );
    }

    const recipientId = String(body?.recipientId ?? "").trim();
    const recipientUsername = String(body?.recipientUsername ?? "").trim();
    const recipientDisplayName = String(body?.recipientDisplayName || recipientUsername).trim();
    const recipientAvatarUrl = body?.recipientAvatarUrl ?? null;

    if (!recipientId || !recipientUsername) {
      return NextResponse.json({ error: "Destinataire manquant." }, { status: 400 });
    }

    const actor = await resolveServerActor({
      userId: body?.senderId,
      username: body?.senderUsername,
      displayName: body?.senderDisplayName,
      avatarUrl: body?.senderAvatarUrl,
    });

    if (
      recipientId === actor.id ||
      recipientUsername.toLowerCase() === actor.username.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas vous envoyer un message à vous-même." },
        { status: 400 }
      );
    }

    let messageId = makeId("dm");
    const createdAt = new Date().toISOString();
    let savedToSupabase = false;

    if (actor.source === "supabase" && UUID_RE.test(recipientId)) {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          const { data: inserted, error } = await supabase
            .from("direct_messages")
            .insert({
              sender_id: actor.id,
              recipient_id: recipientId,
              sender_username: actor.username,
              sender_display_name: actor.displayName,
              sender_avatar_url: actor.avatarUrl,
              recipient_username: recipientUsername,
              recipient_display_name: recipientDisplayName,
              recipient_avatar_url: recipientAvatarUrl,
              body: text,
              is_read: false,
            })
            .select("id")
            .single();

          if (!error && inserted?.id) {
            messageId = String(inserted.id);
            savedToSupabase = true;
          }
        }
      } catch {
        // graceful local fallback
      }
    }

    const msg: DirectMessageItem = {
      id: messageId,
      senderId: actor.id,
      recipientId,
      senderUsername: actor.username,
      senderDisplayName: actor.displayName,
      senderAvatarUrl: actor.avatarUrl,
      recipientUsername,
      recipientDisplayName,
      recipientAvatarUrl,
      body: text,
      isRead: false,
      createdAt,
    };

    const db = readSocialDb();
    db.messages.push(msg);
    writeSocialDb(db);

    return NextResponse.json({ ok: true, message: msg, savedToSupabase });
  } catch {
    return NextResponse.json({ error: "Erreur lors de l'envoi du message." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const partnerId = String(body?.partnerId ?? "").trim();
    const partnerUsername = String(body?.partnerUsername ?? "").trim().toLowerCase();

    const actor = await resolveServerActor({
      userId: body?.userId,
      username: body?.username,
    });

    if (actor.source === "supabase" && UUID_RE.test(partnerId)) {
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
    }

    const db = readSocialDb();
    const actorLower = actor.username.toLowerCase();
    let changed = false;
    for (const m of db.messages) {
      const toMe =
        m.recipientId === actor.id || m.recipientUsername.toLowerCase() === actorLower;
      const fromPartner =
        (partnerId && m.senderId === partnerId) ||
        (partnerUsername && m.senderUsername.toLowerCase() === partnerUsername);
      if (toMe && fromPartner && !m.isRead) {
        m.isRead = true;
        changed = true;
      }
    }
    if (changed) writeSocialDb(db);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur de mise à jour." }, { status: 400 });
  }
}
