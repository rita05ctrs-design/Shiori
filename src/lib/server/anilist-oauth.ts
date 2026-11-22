import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  readAccountDb,
  SESSION_COOKIE_NAME,
  verifySessionToken,
  writeAccountDb,
} from "@/lib/server/auth-store";
import type { LibraryStatus, MediaType } from "@/types/media";

const ANILIST_OAUTH_AUTHORIZE_URL = "https://anilist.co/api/v2/oauth/authorize";
const ANILIST_OAUTH_TOKEN_URL = "https://anilist.co/api/v2/oauth/token";
const ANILIST_GRAPHQL_URL = "https://graphql.anilist.co";

export const ANILIST_STATE_COOKIE = "shiori_anilist_oauth_state";
export const ANILIST_SESSION_COOKIE = "shiori_anilist_oauth_session";

const ENC_PREFIX = "enc:v1:";

export interface AniListOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface ResolvedAniListConnection {
  accessToken: string;
  userId: number;
  username: string;
  avatarUrl: string | null;
  siteUrl: string | null;
  connectedAt: string;
  expiresAt: string | null;
  storage: "supabase" | "account" | "cookie";
}

export function getAniListOAuthConfig(fallbackOrigin?: string): AniListOAuthConfig | null {
  const clientId = process.env.ANILIST_CLIENT_ID?.trim();
  const clientSecret = process.env.ANILIST_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.NEXT_PUBLIC_ANILIST_REDIRECT_URI?.trim() ||
    (fallbackOrigin ? `${fallbackOrigin}/auth/anilist/callback` : "http://localhost:3000/auth/anilist/callback");

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isAniListOAuthConfigured(): boolean {
  return Boolean(process.env.ANILIST_CLIENT_ID?.trim() && process.env.ANILIST_CLIENT_SECRET?.trim());
}

export function buildAniListAuthorizeUrl(state: string, fallbackOrigin?: string): string | null {
  const cfg = getAniListOAuthConfig(fallbackOrigin);
  if (!cfg) return null;
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    state,
  });
  return `${ANILIST_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

/* -------------------------------------------------------------------------- */
/* Server-Side AES-256-GCM Token Encryption (tokens never exposed to client)  */
/* -------------------------------------------------------------------------- */

function getEncryptionKey(): Buffer {
  const material =
    process.env.ANILIST_CLIENT_SECRET ||
    process.env.SHIORI_SESSION_SECRET ||
    "shiori-local-fallback-key";
  return crypto.createHash("sha256").update(`shiori-anilist-oauth:${material}`).digest();
}

export function encryptAniListSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptAniListSecret(value: string): string | null {
  if (!value) return null;
  if (!value.startsWith(ENC_PREFIX)) {
    // Support plain tokens if ever inserted manually in Supabase profiles
    return value;
  }
  try {
    const parts = value.slice(ENC_PREFIX.length).split(".");
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, dataB64] = parts;
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* AniList OAuth Token Exchange & Viewer Profile                              */
/* -------------------------------------------------------------------------- */

export async function exchangeAniListCode(
  code: string,
  fallbackOrigin?: string
): Promise<{ accessToken: string; expiresIn: number | null }> {
  const cfg = getAniListOAuthConfig(fallbackOrigin);
  if (!cfg) {
    throw new Error("Variables ANILIST_CLIENT_ID / ANILIST_CLIENT_SECRET manquantes sur le serveur.");
  }

  const res = await fetch(ANILIST_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      code,
    }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.access_token) {
    const msg =
      json?.message || json?.error_description || json?.error || `HTTP ${res.status}`;
    throw new Error(`Échange OAuth AniList refusé : ${msg}`);
  }

  return {
    accessToken: String(json.access_token),
    expiresIn: typeof json.expires_in === "number" ? json.expires_in : null,
  };
}

export async function fetchAniListViewer(accessToken: string): Promise<{
  id: number;
  name: string;
  avatarUrl: string | null;
  siteUrl: string | null;
}> {
  const query = `
    query {
      Viewer {
        id
        name
        avatar {
          large
          medium
        }
        siteUrl
      }
    }
  `;

  const res = await fetch(ANILIST_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors?.length || !json.data?.Viewer) {
    const msg = json.errors?.[0]?.message || `HTTP ${res.status}`;
    throw new Error(`Impossible de lire le profil Viewer AniList : ${msg}`);
  }

  const v = json.data.Viewer;
  return {
    id: Number(v.id),
    name: String(v.name),
    avatarUrl: v.avatar?.large ?? v.avatar?.medium ?? null,
    siteUrl: v.siteUrl ?? `https://anilist.co/user/${encodeURIComponent(String(v.name))}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Hybrid Server Persistence (Supabase profiles + Local Store + HttpOnly)     */
/* -------------------------------------------------------------------------- */

interface CookieSessionPayload {
  t: string; // raw access token (inside AES-256-GCM envelope)
  uid: number;
  name: string;
  avatar: string | null;
  url: string | null;
  at: string;
  exp: string | null;
}

export async function saveAniListConnection(
  input: {
    accessToken: string;
    userId: number;
    username: string;
    avatarUrl: string | null;
    siteUrl: string | null;
    expiresIn: number | null;
  },
  response: NextResponse
): Promise<{
  savedToSupabase: boolean;
  savedToAccount: boolean;
  supabaseError?: string;
}> {
  const connectedAt = new Date().toISOString();
  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
    : null;

  const encryptedToken = encryptAniListSecret(input.accessToken);

  let savedToSupabase = false;
  let supabaseError: string | undefined;

  // 1) Save to Supabase `profiles` table if user is authenticated via Supabase
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const anilistFields = {
          anilist_access_token: encryptedToken,
          anilist_user_id: input.userId,
          anilist_username: input.username,
          anilist_avatar_url: input.avatarUrl,
          anilist_site_url: input.siteUrl,
          anilist_connected_at: connectedAt,
          anilist_token_expires_at: expiresAt,
        };

        const { data: updatedRows, error: updateErr } = await supabase
          .from("profiles")
          .update(anilistFields)
          .eq("id", user.id)
          .select("id");

        if (!updateErr && updatedRows && updatedRows.length > 0) {
          savedToSupabase = true;
        } else if (!updateErr) {
          // Profile row did not exist yet -> create it via upsert
          const fallbackName =
            (user.user_metadata?.display_name as string) ||
            (user.user_metadata?.full_name as string) ||
            user.email?.split("@")[0] ||
            input.username;
          const fallbackUsername =
            (user.user_metadata?.username as string) ||
            `${fallbackName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${user.id.slice(0, 6)}`;

          const { error: upsertErr } = await supabase.from("profiles").upsert(
            {
              id: user.id,
              username: fallbackUsername,
              display_name: fallbackName,
              avatar_url: input.avatarUrl,
              ...anilistFields,
            },
            { onConflict: "id" }
          );

          if (!upsertErr) {
            savedToSupabase = true;
          } else {
            supabaseError = upsertErr.message;
          }
        } else {
          supabaseError = updateErr.message;
        }
      }
    }
  } catch (err) {
    supabaseError = err instanceof Error ? err.message : "Erreur Supabase";
  }

  // 2) Save to built-in Shiori server account store if signed in locally
  let savedToAccount = false;
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const localUid = verifySessionToken(sessionToken);
    if (localUid) {
      const db = readAccountDb();
      const idx = db.users.findIndex((u) => u.id === localUid);
      if (idx !== -1) {
        db.users[idx].anilistOAuth = {
          encryptedAccessToken: encryptedToken,
          userId: input.userId,
          username: input.username,
          avatarUrl: input.avatarUrl,
          siteUrl: input.siteUrl,
          connectedAt,
          expiresAt,
        };
        writeAccountDb(db);
        savedToAccount = true;
      }
    }
  } catch {
    // non-fatal
  }

  // 3) Always store an AES-256-GCM encrypted HttpOnly cookie as seamless server session
  const cookiePayload: CookieSessionPayload = {
    t: input.accessToken,
    uid: input.userId,
    name: input.username,
    avatar: input.avatarUrl,
    url: input.siteUrl,
    at: connectedAt,
    exp: expiresAt,
  };
  const sealedCookie = encryptAniListSecret(JSON.stringify(cookiePayload));
  const maxAge = Math.min(input.expiresIn ?? 60 * 60 * 24 * 30, 60 * 60 * 24 * 90);

  response.cookies.set(ANILIST_SESSION_COOKIE, sealedCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });

  return { savedToSupabase, savedToAccount, supabaseError };
}

export async function getAniListConnection(): Promise<ResolvedAniListConnection | null> {
  // 1) Try Supabase `profiles` first when user is signed into Supabase
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profileRow, error } = await supabase
          .from("profiles")
          .select(
            "anilist_access_token, anilist_user_id, anilist_username, anilist_avatar_url, anilist_site_url, anilist_connected_at, anilist_token_expires_at"
          )
          .eq("id", user.id)
          .maybeSingle();

        if (!error && profileRow?.anilist_access_token) {
          const accessToken = decryptAniListSecret(String(profileRow.anilist_access_token));
          if (accessToken) {
            return {
              accessToken,
              userId: Number(profileRow.anilist_user_id ?? 0),
              username: String(profileRow.anilist_username ?? "AniList"),
              avatarUrl: profileRow.anilist_avatar_url ?? null,
              siteUrl: profileRow.anilist_site_url ?? null,
              connectedAt: profileRow.anilist_connected_at ?? new Date().toISOString(),
              expiresAt: profileRow.anilist_token_expires_at ?? null,
              storage: "supabase",
            };
          }
        }
      }
    }
  } catch {
    // fall through cleanly if profiles table/columns not migrated yet
  }

  // 2) Try built-in Shiori server account store
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const localUid = verifySessionToken(sessionToken);
    if (localUid) {
      const db = readAccountDb();
      const acct = db.users.find((u) => u.id === localUid);
      if (acct?.anilistOAuth?.encryptedAccessToken) {
        const accessToken = decryptAniListSecret(acct.anilistOAuth.encryptedAccessToken);
        if (accessToken) {
          return {
            accessToken,
            userId: acct.anilistOAuth.userId,
            username: acct.anilistOAuth.username,
            avatarUrl: acct.anilistOAuth.avatarUrl,
            siteUrl: acct.anilistOAuth.siteUrl,
            connectedAt: acct.anilistOAuth.connectedAt,
            expiresAt: acct.anilistOAuth.expiresAt,
            storage: "account",
          };
        }
      }
    }
  } catch {
    // fall through
  }

  // 3) Fallback to encrypted HttpOnly server cookie
  try {
    const cookieStore = await cookies();
    const sealed = cookieStore.get(ANILIST_SESSION_COOKIE)?.value;
    if (sealed) {
      const decoded = decryptAniListSecret(sealed);
      if (decoded) {
        const parsed = JSON.parse(decoded) as CookieSessionPayload;
        if (parsed?.t) {
          return {
            accessToken: parsed.t,
            userId: Number(parsed.uid ?? 0),
            username: String(parsed.name ?? "AniList"),
            avatarUrl: parsed.avatar ?? null,
            siteUrl: parsed.url ?? null,
            connectedAt: parsed.at ?? new Date().toISOString(),
            expiresAt: parsed.exp ?? null,
            storage: "cookie",
          };
        }
      }
    }
  } catch {
    // ignore corrupt cookie
  }

  return null;
}

export async function clearAniListConnection(response: NextResponse): Promise<void> {
  // Clear in Supabase profiles
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            anilist_access_token: null,
            anilist_user_id: null,
            anilist_username: null,
            anilist_avatar_url: null,
            anilist_site_url: null,
            anilist_connected_at: null,
            anilist_token_expires_at: null,
          })
          .eq("id", user.id);
      }
    }
  } catch {
    // ignore if table not migrated
  }

  // Clear in local account store
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const localUid = verifySessionToken(sessionToken);
    if (localUid) {
      const db = readAccountDb();
      const idx = db.users.findIndex((u) => u.id === localUid);
      if (idx !== -1) {
        db.users[idx].anilistOAuth = null;
        writeAccountDb(db);
      }
    }
  } catch {
    // ignore
  }

  // Clear HttpOnly session & state cookies
  response.cookies.set(ANILIST_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(ANILIST_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/* -------------------------------------------------------------------------- */
/* Bidirectional AniList GraphQL Mutations (Save / Delete / Favorite)         */
/* -------------------------------------------------------------------------- */

export type AniListMediaListStatus =
  | "CURRENT"
  | "PLANNING"
  | "COMPLETED"
  | "DROPPED"
  | "PAUSED"
  | "REPEATING";

export function mapShioriStatusToAniList(status: LibraryStatus): AniListMediaListStatus {
  switch (status) {
    case "WATCHING":
      return "CURRENT";
    case "COMPLETED":
      return "COMPLETED";
    case "ON_HOLD":
      return "PAUSED";
    case "DROPPED":
      return "DROPPED";
    case "PLAN_TO_WATCH":
    default:
      return "PLANNING";
  }
}

function parseIsoToFuzzyDate(
  iso?: string | null
): { year: number; month: number; day: number } | undefined {
  if (!iso) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return { year, month, day };
}

async function queryAniListAuthed(
  accessToken: string,
  query: string,
  variables: Record<string, unknown>
) {
  const res = await fetch(ANILIST_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors?.length) {
    const firstErr = json.errors?.[0];
    const err = new Error(firstErr?.message || `AniList API HTTP ${res.status}`) as Error & {
      status?: number;
    };
    err.status = firstErr?.status ?? res.status;
    throw err;
  }
  return json.data;
}

export interface SaveMediaListInput {
  mediaId: number;
  status: LibraryStatus;
  progress: number;
  score: number | null;
  notes?: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export async function saveMediaListEntryOnAniList(
  accessToken: string,
  input: SaveMediaListInput
): Promise<{
  id: number;
  mediaId: number;
  status: string;
  progress: number;
  score: number;
  updatedAt: number;
}> {
  const mutation = `
    mutation (
      $mediaId: Int!
      $status: MediaListStatus
      $progress: Int
      $scoreRaw: Int
      $notes: String
      $startedAt: FuzzyDateInput
      $completedAt: FuzzyDateInput
    ) {
      SaveMediaListEntry(
        mediaId: $mediaId
        status: $status
        progress: $progress
        scoreRaw: $scoreRaw
        notes: $notes
        startedAt: $startedAt
        completedAt: $completedAt
      ) {
        id
        mediaId
        status
        progress
        score(format: POINT_10_DECIMAL)
        updatedAt
      }
    }
  `;

  // Convert Shiori 0..10 score (supports 0.5 steps) -> AniList scoreRaw (0..100 universal integer)
  const scoreRaw =
    input.score !== null && input.score !== undefined
      ? Math.max(0, Math.min(100, Math.round(input.score * 10)))
      : 0;

  const variables: Record<string, unknown> = {
    mediaId: Math.trunc(input.mediaId),
    status: mapShioriStatusToAniList(input.status),
    progress: Math.max(0, Math.trunc(input.progress ?? 0)),
    scoreRaw,
  };

  if (typeof input.notes === "string") {
    variables.notes = input.notes;
  }

  const startedAt = parseIsoToFuzzyDate(input.startedAt);
  if (startedAt) variables.startedAt = startedAt;

  const completedAt = parseIsoToFuzzyDate(input.completedAt);
  if (completedAt) variables.completedAt = completedAt;

  const data = await queryAniListAuthed(accessToken, mutation, variables);
  const saved = data?.SaveMediaListEntry;
  if (!saved) {
    throw new Error("SaveMediaListEntry n'a renvoyé aucune entrée.");
  }
  return saved;
}

export async function deleteMediaListEntryOnAniList(
  accessToken: string,
  anilistUserId: number,
  mediaId: number
): Promise<{ deleted: boolean }> {
  // First locate the MediaList entry ID for (userId, mediaId)
  const lookupQuery = `
    query ($userId: Int, $mediaId: Int) {
      MediaList(userId: $userId, mediaId: $mediaId) {
        id
      }
    }
  `;

  let entryId: number | null = null;
  try {
    const lookup = await queryAniListAuthed(accessToken, lookupQuery, {
      userId: anilistUserId || undefined,
      mediaId: Math.trunc(mediaId),
    });
    entryId = lookup?.MediaList?.id ? Number(lookup.MediaList.id) : null;
  } catch (err) {
    // 404 Not Found means the item isn't on AniList -> already deleted
    const status = (err as { status?: number })?.status;
    if (status === 404) return { deleted: true };
    throw err;
  }

  if (!entryId) return { deleted: true };

  const deleteMutation = `
    mutation ($id: Int!) {
      DeleteMediaListEntry(id: $id) {
        deleted
      }
    }
  `;
  const data = await queryAniListAuthed(accessToken, deleteMutation, { id: entryId });
  return { deleted: Boolean(data?.DeleteMediaListEntry?.deleted) };
}

export async function syncFavoriteOnAniList(
  accessToken: string,
  mediaId: number,
  mediaType: MediaType,
  desiredFavorite: boolean
): Promise<{ isFavourite: boolean; toggled: boolean }> {
  // Check current favourite state on AniList first so the operation is idempotent
  const checkQuery = `
    query ($id: Int!) {
      Media(id: $id) {
        id
        isFavourite
      }
    }
  `;
  const checkData = await queryAniListAuthed(accessToken, checkQuery, {
    id: Math.trunc(mediaId),
  });
  const currentFav = Boolean(checkData?.Media?.isFavourite);
  if (currentFav === desiredFavorite) {
    return { isFavourite: currentFav, toggled: false };
  }

  const toggleMutation =
    mediaType === "MANGA"
      ? `mutation ($id: Int!) { ToggleFavourite(mangaId: $id) { manga { nodes { id } } } }`
      : `mutation ($id: Int!) { ToggleFavourite(animeId: $id) { anime { nodes { id } } } }`;

  await queryAniListAuthed(accessToken, toggleMutation, { id: Math.trunc(mediaId) });
  return { isFavourite: desiredFavorite, toggled: true };
}
