/**
 * Lightweight, bounded LRU + TTL client cache backed by memory & Web Storage.
 * Pure TypeScript with zero framework dependencies so it works cleanly in both
 * browser runtime and `node --test`.
 */

export interface CachedRecord<T> {
  value: T;
  expiresAt: number;
  touchedAt: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class BoundedClientCache<T> {
  private readonly storageKey: string;
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly memory = new Map<string, CachedRecord<T>>();
  private hydrated = false;
  private readonly getStorage: () => StorageLike | null;

  constructor(options: {
    storageKey: string;
    maxEntries: number;
    ttlMs: number;
    storage?: "local" | "session" | StorageLike | null;
  }) {
    this.storageKey = options.storageKey;
    this.maxEntries = Math.max(4, options.maxEntries);
    this.ttlMs = Math.max(1_000, options.ttlMs);

    if (options.storage && typeof options.storage === "object") {
      const custom = options.storage;
      this.getStorage = () => custom;
    } else if (options.storage === null) {
      this.getStorage = () => null;
    } else if (options.storage === "session") {
      this.getStorage = () =>
        typeof window !== "undefined" ? window.sessionStorage : null;
    } else {
      this.getStorage = () =>
        typeof window !== "undefined" ? window.localStorage : null;
    }
  }

  private hydrate(now: number): void {
    if (this.hydrated) return;
    this.hydrated = true;
    const store = this.getStorage();
    if (!store) return;

    try {
      const raw = store.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, CachedRecord<T>>;
      if (!parsed || typeof parsed !== "object") return;

      for (const [k, rec] of Object.entries(parsed)) {
        if (
          rec &&
          typeof rec === "object" &&
          typeof rec.expiresAt === "number" &&
          rec.expiresAt > now
        ) {
          this.memory.set(k, rec);
        }
      }
      this.evictIfNeeded();
    } catch {
      // Ignore corrupt storage entries
    }
  }

  private evictIfNeeded(): void {
    if (this.memory.size <= this.maxEntries) return;
    const sorted = Array.from(this.memory.entries()).sort(
      (a, b) => a[1].touchedAt - b[1].touchedAt
    );
    const excess = this.memory.size - this.maxEntries;
    for (let i = 0; i < excess; i++) {
      this.memory.delete(sorted[i][0]);
    }
  }

  private persist(): void {
    const store = this.getStorage();
    if (!store) return;
    try {
      const obj: Record<string, CachedRecord<T>> = {};
      for (const [k, v] of this.memory.entries()) {
        obj[k] = v;
      }
      store.setItem(this.storageKey, JSON.stringify(obj));
    } catch {
      // If quota exceeded, shed oldest half and retry once
      try {
        const sorted = Array.from(this.memory.entries()).sort(
          (a, b) => a[1].touchedAt - b[1].touchedAt
        );
        const dropCount = Math.ceil(sorted.length / 2);
        for (let i = 0; i < dropCount; i++) {
          this.memory.delete(sorted[i][0]);
        }
        const obj: Record<string, CachedRecord<T>> = {};
        for (const [k, v] of this.memory.entries()) {
          obj[k] = v;
        }
        store.setItem(this.storageKey, JSON.stringify(obj));
      } catch {
        // Non-fatal
      }
    }
  }

  get(key: string, now = Date.now()): T | null {
    this.hydrate(now);
    const rec = this.memory.get(key);
    if (!rec) return null;
    if (rec.expiresAt <= now) {
      this.memory.delete(key);
      return null;
    }
    rec.touchedAt = now;
    return rec.value;
  }

  set(key: string, value: T, now = Date.now()): void {
    this.hydrate(now);
    this.memory.set(key, {
      value,
      expiresAt: now + this.ttlMs,
      touchedAt: now,
    });
    this.evictIfNeeded();
    this.persist();
  }

  clear(): void {
    this.memory.clear();
    const store = this.getStorage();
    if (!store) return;
    try {
      store.removeItem(this.storageKey);
    } catch {
      // Ignore
    }
  }

  get size(): number {
    return this.memory.size;
  }
}

export interface PersistentSynopsisEntry {
  html: string;
  translated: boolean;
}

/** 14-day persistent synopsis translation cache (instant 0ms reads across sessions & offline) */
export const synopsisPersistentCache = new BoundedClientCache<PersistentSynopsisEntry>({
  storageKey: "shiori_synopsis_cache_v1",
  maxEntries: 120,
  ttlMs: 14 * 24 * 60 * 60 * 1000,
  storage: "local",
});

export interface DiscoverQuerySnapshot<TItem = unknown> {
  items: TItem[];
  hasNextPage: boolean;
  total: number;
  page?: number;
}

/** 15-minute session cache for Discover catalog queries (instant multi-page back-navigation!) */
export const discoverQueryCache = new BoundedClientCache<DiscoverQuerySnapshot>({
  storageKey: "shiori_discover_cache_v1",
  maxEntries: 24,
  ttlMs: 15 * 60 * 1000,
  storage: "session",
});

/** 14-day persistent cache for AI-resolved Anime -> Manga/Manhwa continuation breakpoints */
export const mangaContinuationCache = new BoundedClientCache<Record<string, unknown>>({
  storageKey: "shiori_manga_continuation_v1",
  maxEntries: 120,
  ttlMs: 14 * 24 * 60 * 60 * 1000,
  storage: "local",
});
