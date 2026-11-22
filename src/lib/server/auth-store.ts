import crypto from "crypto";
import fs from "fs";
import path from "path";
import type {
  ActivityEvent,
  LibraryEntry,
  NotificationPrefs,
  ShioriNotification,
  UserProfile,
} from "@/types/media";

const DATA_DIR = path.join(process.cwd(), ".shiori-data");
const DB_PATH = path.join(DATA_DIR, "accounts.json");
const SECRET_PATH = path.join(DATA_DIR, ".session-secret");

export const SESSION_COOKIE_NAME = "shiori_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export interface StoredAccount {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarInitials: string;
  accentColor: string;
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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getSessionSecret(): string {
  if (process.env.SHIORI_SESSION_SECRET) {
    return process.env.SHIORI_SESSION_SECRET;
  }
  ensureDataDir();
  if (fs.existsSync(SECRET_PATH)) {
    return fs.readFileSync(SECRET_PATH, "utf8").trim();
  }
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(SECRET_PATH, secret, { encoding: "utf8", mode: 0o600 });
  return secret;
}

export function readAccountDb(): AccountDatabase {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    return { users: [] };
  }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.users)) {
      return parsed as AccountDatabase;
    }
  } catch {
    // ignore corrupt file
  }
  return { users: [] };
}

export function writeAccountDb(db: AccountDatabase) {
  ensureDataDir();
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, DB_PATH);
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
    accentColor: account.accentColor,
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
