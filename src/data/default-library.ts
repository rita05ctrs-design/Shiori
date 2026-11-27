import { getSeedData } from "@/lib/anilist";
import { getDisplayTitle } from "@/lib/utils";
import type {
  ActivityEvent,
  LibraryEntry,
  LibraryStatus,
  MediaItem,
  ShioriNotification,
  UserProfile,
} from "@/types/media";

function makeEntry(
  media: MediaItem,
  status: LibraryStatus,
  progress: number,
  score: number | null,
  isFavorite: boolean,
  notes: string,
  hoursAgo: number
): LibraryEntry {
  return {
    mediaId: media.id,
    type: media.type,
    title: getDisplayTitle(media),
    nativeTitle: media.title.native,
    coverImage: media.coverImage.extraLarge,
    bannerImage: media.bannerImage,
    totalUnits: media.type === "MANGA" ? media.chapters : media.episodes,
    duration: media.duration,
    genres: media.genres,
    studio: media.studio,
    format: media.format,
    seasonYear: media.seasonYear ?? media.startYear,
    averageScore: media.averageScore,
    status,
    progress,
    score,
    isFavorite,
    notes,
    updatedAt: new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString(),
  };
}

export function createDefaultLibrary(): LibraryEntry[] {
  const { all } = getSeedData();
  const find = (id: number) => all.find((m) => m.id === id);

  const presets: {
    id: number;
    status: LibraryStatus;
    progress: number;
    score: number | null;
    fav: boolean;
    notes: string;
    hoursAgo: number;
  }[] = [
    // WATCHING (Anime + Manga)
    {
      id: 154587, // Frieren
      status: "WATCHING",
      progress: 21,
      score: 9.5,
      fav: true,
      notes: "Direction artistique exceptionnelle et bande-son d'Evan Call inoubliable.",
      hoursAgo: 2,
    },
    {
      id: 195516, // Apothecary Diaries S3
      status: "WATCHING",
      progress: 7,
      score: 9.0,
      fav: true,
      notes: "Maomao porte chaque intrigue avec une finesse incroyable.",
      hoursAgo: 5,
    },
    {
      id: 21, // ONE PIECE
      status: "WATCHING",
      progress: 1094,
      score: 9.0,
      fav: false,
      notes: "Arc Egghead — l'animation de Toei est d'un niveau cinématographique.",
      hoursAgo: 14,
    },
    {
      id: 30002, // Berserk (Manga)
      status: "WATCHING",
      progress: 248,
      score: 10,
      fav: true,
      notes: "Chef-d'œuvre absolu de Kentaro Miura. Planches d'une densité inégalée.",
      hoursAgo: 20,
    },
    // COMPLETED
    {
      id: 16498, // Attack on Titan
      status: "COMPLETED",
      progress: 25,
      score: 9.5,
      fav: true,
      notes: "Mise en scène magistrale et tension dramatique du début à la fin.",
      hoursAgo: 48,
    },
    {
      id: 5114, // Fullmetal Alchemist: Brotherhood
      status: "COMPLETED",
      progress: 64,
      score: 9.5,
      fav: true,
      notes: "Un classique intemporel parfaitement rythmé.",
      hoursAgo: 96,
    },
    {
      id: 9253, // Steins;Gate
      status: "COMPLETED",
      progress: 24,
      score: 9.0,
      fav: false,
      notes: "Seconde moitié brillante, impossible de décrocher à partir de l'épisode 12.",
      hoursAgo: 140,
    },
    {
      id: 1535, // Death Note
      status: "COMPLETED",
      progress: 37,
      score: 8.5,
      fav: false,
      notes: "Duel psychologique légendaire.",
      hoursAgo: 210,
    },
    {
      id: 30001, // Monster (Manga)
      status: "COMPLETED",
      progress: 162,
      score: 9.5,
      fav: true,
      notes: "Naoki Urasawa au sommet du thriller psychologique.",
      hoursAgo: 260,
    },
    // ON HOLD
    {
      id: 11061, // Hunter x Hunter
      status: "ON_HOLD",
      progress: 76,
      score: 9.0,
      fav: false,
      notes: "Pause juste avant l'arc des Fourmis Chimères pour le savourer d'une traite.",
      hoursAgo: 180,
    },
    {
      id: 30656, // Vagabond (Manga)
      status: "ON_HOLD",
      progress: 142,
      score: 9.5,
      fav: true,
      notes: "À reprendre tranquillement — les dessins à l'encre sont hypnotiques.",
      hoursAgo: 320,
    },
    // PLAN TO WATCH
    {
      id: 171627, // Chainsaw Man Reze Arc
      status: "PLAN_TO_WATCH",
      progress: 0,
      score: null,
      fav: false,
      notes: "Très attendu en salle / Blu-ray.",
      hoursAgo: 26,
    },
    {
      id: 195604, // Black Clover S2
      status: "PLAN_TO_WATCH",
      progress: 0,
      score: null,
      fav: false,
      notes: "À commencer dès le week-end prochain.",
      hoursAgo: 34,
    },
    {
      id: 30642, // Vinland Saga Manga
      status: "PLAN_TO_WATCH",
      progress: 0,
      score: null,
      fav: false,
      notes: "Lire la suite directement après la saison 2.",
      hoursAgo: 70,
    },
    // DROPPED
    {
      id: 20605, // Tokyo Ghoul
      status: "DROPPED",
      progress: 5,
      score: 6.0,
      fav: false,
      notes: "Je préfère découvrir l'histoire via le manga original.",
      hoursAgo: 400,
    },
  ];

  const entries: LibraryEntry[] = [];
  for (const p of presets) {
    const media = find(p.id);
    if (media) {
      entries.push(makeEntry(media, p.status, p.progress, p.score, p.fav, p.notes, p.hoursAgo));
    }
  }
  return entries;
}

/**
 * Returns true ONLY when a local library array consists exclusively of unmodified
 * entries from the legacy starter demo library (same mediaId, status, progress, score, notes).
 * Used to auto-clean old untouched demo data in `localStorage` without ever deleting
 * entries that a visitor actually added or edited themselves.
 */
export function isUntouchedDemoLibrary(entries: readonly LibraryEntry[]): boolean {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  const demo = createDefaultLibrary();
  if (demo.length === 0 || entries.length > demo.length) return false;

  const demoById = new Map<number, LibraryEntry>();
  for (const item of demo) {
    demoById.set(item.mediaId, item);
  }

  return entries.every((entry) => {
    const preset = demoById.get(entry.mediaId);
    if (!preset) return false;
    return (
      entry.status === preset.status &&
      entry.progress === preset.progress &&
      entry.score === preset.score &&
      Boolean(entry.isFavorite) === Boolean(preset.isFavorite) &&
      (entry.notes ?? "") === (preset.notes ?? "")
    );
  });
}

export function createDefaultProfile(): UserProfile {
  return {
    id: "local-curator",
    username: "kuro_shiori",
    displayName: "Invité",
    email: "",
    bio: "",
    avatarInitials: "IN",
    avatarUrl: null,
    accentColor: "#E5484D",
    isActivityPublic: true,
    mode: "local",
    notificationPrefs: {
      airingAlerts: true,
      weeklyDigest: true,
      milestones: true,
      recommendations: true,
    },
    joinedAt: new Date().toISOString(),
  };
}

export function createDefaultNotifications(): ShioriNotification[] {
  return [];
}

export function createDefaultActivity(entries: LibraryEntry[]): ActivityEvent[] {
  return entries.slice(0, 6).map((e, i) => ({
    id: `act-init-${i}`,
    mediaId: e.mediaId,
    mediaTitle: e.title,
    mediaType: e.type,
    coverImage: e.coverImage,
    action:
      e.status === "COMPLETED"
        ? `A terminé ${e.type === "MANGA" ? "le manga" : "la série"} (${e.score ? `${e.score}/10` : "sans note"})`
        : e.status === "PLAN_TO_WATCH"
          ? "Ajouté à Plan to Watch"
          : `Progression : ${e.type === "MANGA" ? "Ch." : "Ép."} ${e.progress}${e.totalUnits ? ` / ${e.totalUnits}` : ""}`,
    createdAt: e.updatedAt,
  }));
}
