/**
 * Server-side Supabase Realtime REST Broadcast helper.
 *
 * Publishes an instant broadcast message directly from Next.js API routes to
 * Supabase Realtime's HTTP endpoint (`/realtime/v1/api/broadcast`), delivering
 * events in ~80ms to every subscribed browser worldwide without relying on
 * fragile ephemeral client WebSockets or conflicting channel subscriptions.
 */
export async function broadcastRealtimeEvent(
  topic: string,
  event: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key || !url.startsWith("https://") || url.includes("votre-projet")) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              topic,
              event,
              payload,
            },
          ],
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      return res.ok;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}
