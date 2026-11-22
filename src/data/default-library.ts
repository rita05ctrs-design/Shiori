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

export function createDefaultProfile(): UserProfile {
  return {
    id: "local-curator",
    username: "kuro_shiori",
    displayName: "Kuro",
    email: "kuro@shiori.app",
    bio: "Collectionneur d'histoires nocturnes — seinen, fantasy mélancolique & animation d'auteur.",
    avatarInitials: "KU",
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
    joinedAt: new Date(Date.now() - 45 * 86400 * 1000).toISOString(),
  };
}

export function createDefaultNotifications(): ShioriNotification[] {
  const { all } = getSeedData();
  const frieren = all.find((m) => m.id === 154587);
  const apothecary = all.find((m) => m.id === 195516);
  const berserk = all.find((m) => m.id === 30002);

  return [
    {
      id: "notif-1",
      kind: "AIRING",
      title: "Nouvel épisode disponible",
      body: "The Apothecary Diaries Season 3 — L'épisode 8 est sorti cette semaine.",
      mediaId: apothecary?.id ?? 195516,
      coverImage: apothecary?.coverImage.large,
      isRead: false,
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
    {
      id: "notif-2",
      kind: "MILESTONE",
      title: "Palier atteint : 1 300+ épisodes",
      body: "Vous venez de franchir un nouveau cap dans votre bibliothèque Shiori.",
      mediaId: frieren?.id ?? 154587,
      coverImage: frieren?.coverImage.large,
      isRead: false,
      createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    },
    {
      id: "notif-3",
      kind: "RECOMMENDATION",
      title: "Parce que vous aimez Berserk",
      body: "Découvrez Vinland Saga et Vagabond dans votre sélection éditoriale.",
      mediaId: berserk?.id ?? 30002,
      coverImage: berserk?.coverImage.large,
      isRead: true,
      createdAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    },
    {
      id: "notif-4",
      kind: "SYSTEM",
      title: "Architecture Supabase prête",
      body: "Connectez votre projet Supabase dans les Paramètres pour activer la synchronisation cloud.",
      isRead: true,
      createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    },
  ];
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
