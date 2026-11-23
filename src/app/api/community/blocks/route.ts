import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import {
  getAllLocalCommunityProfiles,
  isAuthenticatedActor,
  makeId,
  readSocialDb,
  resolveServerActor,
  writeSocialDb,
} from "@/lib/server/social-store";
import type { UserBlockRecord } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

export async function GET() {
  const actor = await resolveServerActor();
  if (!isAuthenticatedActor(actor)) {
    return NextResponse.json({ error: "Authentification requise.", blocks: [] }, { status: 401 });
  }

  const blocksMap = new Map<string, UserBlockRecord>();
  const profilesById = new Map(getAllLocalCommunityProfiles().map((p) => [p.id, p]));

  if (actor.source === "supabase" && isUuid(actor.id)) {
    try {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        const { data, error } = await supabase
          .from("user_blocks")
          .select("id, blocker_id, blocked_id, created_at")
          .eq("blocker_id", actor.id)
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const ids = data.map((r) => String(r.blocked_id));
          const { data: profs } = await supabase
            .from("public_profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", ids);

          const profMap = new Map(
            (profs ?? []).map((p) => [
              String(p.id),
              {
                username: String(p.username),
                displayName: String(p.display_name || p.username),
                avatarUrl: p.avatar_url ?? null,
              },
            ])
          );

          for (const row of data) {
            const blockedId = String(row.blocked_id);
            const meta = profMap.get(blockedId);
            const fallback = profilesById.get(blockedId);
            blocksMap.set(blockedId, {
              id: String(row.id),
              blockerId: actor.id,
              blockedId,
              blockedUsername: meta?.username || fallback?.username || "membre",
              blockedDisplayName:
                meta?.displayName || fallback?.displayName || "Membre Shiori",
              blockedAvatarUrl: meta?.avatarUrl ?? fallback?.avatarUrl ?? null,
              createdAt: String(row.created_at),
            });
          }
        }
      }
    } catch {
      // table may not yet be migrated
    }
  }

  if (actor.source === "account") {
    const db = readSocialDb();
    for (const b of db.blocks ?? []) {
      if (b.blockerId === actor.id && !blocksMap.has(b.blockedId)) {
        blocksMap.set(b.blockedId, b);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    blocks: Array.from(blocksMap.values()),
  });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveServerActor();
    if (!isAuthenticatedActor(actor)) {
      return NextResponse.json(
        { error: "Connexion requise pour bloquer un utilisateur." },
        { status: 401 }
      );
    }

    const rl = checkRateLimit(`block:${actor.id}:${getClientIp(request)}`, 20, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Requête JSON invalide." }, { status: 400 });
    }
    const targetUserId = String(body?.targetUserId ?? "").trim();
    const targetUsername = String(body?.targetUsername ?? "")
      .trim()
      .replace(/^@+/, "");
    const targetDisplayName = String(body?.targetDisplayName ?? targetUsername).trim();
    const targetAvatarUrl =
      typeof body?.targetAvatarUrl === "string" ? body.targetAvatarUrl : null;

    if (!targetUserId) {
      return NextResponse.json({ error: "Identifiant utilisateur manquant." }, { status: 400 });
    }

    if (targetUserId === actor.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas vous bloquer vous-même." },
        { status: 400 }
      );
    }

    let blockId = makeId("blk");
    let savedToSupabase = false;

    if (actor.source === "supabase" && isUuid(actor.id) && isUuid(targetUserId)) {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          const { data, error } = await supabase
            .from("user_blocks")
            .upsert(
              { blocker_id: actor.id, blocked_id: targetUserId },
              { onConflict: "blocker_id,blocked_id" }
            )
            .select("id")
            .maybeSingle();

          if (!error) {
            if (data?.id) blockId = String(data.id);
            savedToSupabase = true;
          }
          // Also remove any existing friendship between both users
          await supabase
            .from("friendships")
            .delete()
            .or(
              `and(requester_id.eq.${actor.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${actor.id})`
            );
        }
      } catch {
        // graceful fallback
      }
    }

    const record: UserBlockRecord = {
      id: blockId,
      blockerId: actor.id,
      blockedId: targetUserId,
      blockedUsername: targetUsername || "membre",
      blockedDisplayName: targetDisplayName || targetUsername || "Membre Shiori",
      blockedAvatarUrl: targetAvatarUrl,
      createdAt: new Date().toISOString(),
    };

    if (actor.source === "account") {
      try {
        const db = readSocialDb();
        db.blocks = (db.blocks ?? []).filter(
          (b) => !(b.blockerId === actor.id && b.blockedId === targetUserId)
        );
        db.blocks.unshift(record);
        db.friendships = db.friendships.filter(
          (f) =>
            !(
              (f.requesterId === actor.id && f.addresseeId === targetUserId) ||
              (f.requesterId === targetUserId && f.addresseeId === actor.id)
            )
        );
        writeSocialDb(db);
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ ok: true, block: record, savedToSupabase });
  } catch {
    return NextResponse.json({ error: "Impossible de bloquer cet utilisateur." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const actor = await resolveServerActor();
    if (!isAuthenticatedActor(actor)) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let body: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object") {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      // Allow query-string-only DELETE requests cleanly
    }

    const targetUserId = String(
      body?.targetUserId ?? searchParams.get("targetUserId") ?? ""
    ).trim();
    if (!targetUserId) {
      return NextResponse.json({ error: "Identifiant utilisateur manquant." }, { status: 400 });
    }

    if (actor.source === "supabase" && isUuid(actor.id) && isUuid(targetUserId)) {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          await supabase
            .from("user_blocks")
            .delete()
            .eq("blocker_id", actor.id)
            .eq("blocked_id", targetUserId);
        }
      } catch {
        // non-fatal
      }
    } else if (actor.source === "account") {
      try {
        const db = readSocialDb();
        db.blocks = (db.blocks ?? []).filter(
          (b) => !(b.blockerId === actor.id && b.blockedId === targetUserId)
        );
        writeSocialDb(db);
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Impossible de débloquer cet utilisateur." }, { status: 400 });
  }
}
