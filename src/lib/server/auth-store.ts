import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import type {
  ActivityEvent,
  AmbianceSettings,
  ContentLanguage,
  CustomCollection,
  DisplayPreferences,
  FavoriteVoiceActor,
  HomeSectionPreference,
  LibraryEntry,
  NotificationPrefs,
  ShioriNotification,
  ThemeSettings,
  UnlockedBadgeRecord,
  UserProfile,
} from "@/types/media";

export interface StoredUiPreferences {
  theme?: ThemeSettings;
  ambiance?: AmbianceSettings;
  displayPrefs?: DisplayPreferences;
  homeSections?: HomeSectionPreference[];
}

export function isSecureRequest(request: {
  headers: { get: (name: string) => string | null };
  nextUrl?: { protocol?: string };
}): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return request.nextUrl?.protocol === "https:";
}

const PROJECT_DATA_DIR = process.env.SHIORI_DATA_DIR
  ? path.resolve(process.env.SHIORI_DATA_DIR)
  : path.join(process.cwd(), ".shiori-data");
const TMP_DATA_DIR = path.join(os.tmpdir(), "shiori-data");

let resolvedAuthDir: string | null = null;
const authGlobalMem = globalThis as unknown as {
  __shioriAccountDbCache?: AccountDatabase;
  __shioriSessionSecretCache?: string;
};

function getWritableAuthDir(): string | null {
  if (resolvedAuthDir) return resolvedAuthDir;
  for (const dir of [PROJECT_DATA_DIR, TMP_DATA_DIR]) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.accessSync(dir, fs.constants.W_OK);
      resolvedAuthDir = dir;
      return dir;
    } catch {
      // try next candidate (e.g. /tmp on read-only serverless FS)
    }
  }
  return null;
}

export const SESSION_COOKIE_NAME = "shiori_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export interface StoredAccount {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarInitials: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  accentColor: string;
  isActivityPublic?: boolean;
  preferredLanguage?: ContentLanguage;
  favoriteStaff?: FavoriteVoiceActor[];
  favoriteOrder?: number[];
  collections?: CustomCollection[];
  uiPreferences?: StoredUiPreferences;
  unlockedBadges?: UnlockedBadgeRecord[];
  pinnedBadges?: string[];
  socialInteractionsCount?: number;
  passwordHash: string;
  notificationPrefs: NotificationPrefs;
  joinedAt: string;
  library: LibraryEntry[];
  notifications: ShioriNotification[];
  activity: ActivityEvent[];
  anilistOAuth?: {
    encryptedAccessToken: string;
    userId: number;
    username: string;
    avatarUrl: string | null;
    siteUrl: string | null;
    connectedAt: string;
    expiresAt: string | null;
  } | null;
}

interface AccountDatabase {
  users: StoredAccount[];
}

function getSessionSecret(): string {
  if (process.env.SHIORI_SESSION_SECRET) {
    return process.env.SHIORI_SESSION_SECRET;
  }
  if (authGlobalMem.__shioriSessionSecretCache) {
    return authGlobalMem.__shioriSessionSecretCache;
  }
  const dir = getWritableAuthDir();
  if (dir) {
    const secretPath = path.join(dir, ".session-secret");
    try {
      if (fs.existsSync(secretPath)) {
        const existing = fs.readFileSync(secretPath, "utf8").trim();
        if (existing) {
          authGlobalMem.__shioriSessionSecretCache = existing;
          return existing;
        }
      }
      const secret = crypto.randomBytes(32).toString("hex");
      fs.writeFileSync(secretPath, secret, { encoding: "utf8", mode: 0o600 });
      authGlobalMem.__shioriSessionSecretCache = secret;
      return secret;
    } catch {
      // fall through to ephemeral in-memory secret
    }
  }
  const ephemeral = crypto.randomBytes(32).toString("hex");
  authGlobalMem.__shioriSessionSecretCache = ephemeral;
  return ephemeral;
}

export function readAccountDb(): AccountDatabase {
  const dir = getWritableAuthDir();
  if (dir) {
    const dbPath = path.join(dir, "accounts.json");
    if (fs.existsSync(dbPath)) {
      try {
        const raw = fs.readFileSync(dbPath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users)) {
          const loaded = parsed as AccountDatabase;
          authGlobalMem.__shioriAccountDbCache = loaded;
          return loaded;
        }
      } catch {
        // ignore corrupt file
      }
    }
  }
  return authGlobalMem.__shioriAccountDbCache ?? { users: [] };
}

export function writeAccountDb(db: AccountDatabase) {
  authGlobalMem.__shioriAccountDbCache = db;
  const dir = getWritableAuthDir();
  if (!dir) return;
  try {
    const dbPath = path.join(dir, "accounts.json");
    const tmp = `${dbPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, dbPath);
  } catch {
    // non-fatal on read-only serverless FS
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, "hex");
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
    })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { uid?: string; exp?: number };
    if (!decoded.uid || !decoded.exp) return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded.uid;
  } catch {
    return null;
  }
}

export function toPublicProfile(account: StoredAccount): UserProfile {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    email: account.email,
    bio: account.bio,
    avatarInitials: account.avatarInitials,
    avatarUrl: account.avatarUrl ?? null,
    bannerUrl: account.bannerUrl ?? null,
    accentColor: account.accentColor,
    isActivityPublic: account.isActivityPublic ?? true,
    preferredLanguage: account.preferredLanguage ?? "fr",
    mode: "account",
    notificationPrefs: account.notificationPrefs,
    joinedAt: account.joinedAt,
  };
}

export function slugifyUsername(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 22);
  return base || "membre_shiori";
}
