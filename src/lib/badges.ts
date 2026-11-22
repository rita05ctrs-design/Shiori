import type {
  BadgeCategory,
  BadgeRarity,
  EvaluatedBadge,
  FavoriteVoiceActor,
  LibraryEntry,
  UnlockedBadgeRecord,
  UserProfile,
} from "@/types/media";

export type BadgeIconKey =
  | "footprints"
  | "compass"
  | "flame"
  | "crown"
  | "swords"
  | "zap"
  | "award"
  | "orbit"
  | "book"
  | "scroll"
  | "library"
  | "bookmark"
  | "shield"
  | "layers"
  | "feather"
  | "moon"
  | "timer"
  | "hourglass"
  | "infinity"
  | "film"
  | "clapperboard"
  | "palette"
  | "globe"
  | "archive"
  | "gem"
  | "star"
  | "pen"
  | "scale"
  | "eye"
  | "diamond"
  | "heart"
  | "mic"
  | "camera"
  | "message"
  | "users"
  | "sparkles";

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  iconKey: BadgeIconKey;
  target: number;
  unitLabel: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ============================================================================
  // 1. Visionnage d'animés (8 paliers : de 1 jusqu'à 1 000 animés terminés !)
  // ============================================================================
  {
    id: "anime_first_step",
    title: "Premier Pas",
    description: "Terminer votre tout premier animé sur Shiori.",
    category: "anime",
    rarity: "bronze",
    iconKey: "footprints",
    target: 1,
    unitLabel: "animé terminé",
  },
  {
    id: "anime_explorer",
    title: "Explorateur",
    description: "Terminer 10 animés dans votre bibliothèque.",
    category: "anime",
    rarity: "silver",
    iconKey: "compass",
    target: 10,
    unitLabel: "animés terminés",
  },
  {
    id: "anime_otaku",
    title: "Otaku Confirmé",
    description: "Atteindre le cap des 50 animés terminés.",
    category: "anime",
    rarity: "gold",
    iconKey: "flame",
    target: 50,
    unitLabel: "animés terminés",
  },
  {
    id: "anime_legend",
    title: "Légende de l'Animation",
    description: "Franchir le panthéon des 100 animés terminés.",
    category: "anime",
    rarity: "legendary",
    iconKey: "crown",
    target: 100,
    unitLabel: "animés terminés",
  },
  {
    id: "anime_master",
    title: "Maître de la Toile",
    description: "Terminer 250 animés et forger une culture japanime d'exception.",
    category: "anime",
    rarity: "legendary",
    iconKey: "swords",
    target: 250,
    unitLabel: "animés terminés",
  },
  {
    id: "anime_akihabara",
    title: "Vétéran d'Akihabara",
    description: "Accomplir l'exploit monumental de 500 animés terminés.",
    category: "anime",
    rarity: "mythic",
    iconKey: "zap",
    target: 500,
    unitLabel: "animés terminés",
  },
  {
    id: "anime_emperor",
    title: "Empereur de l'Animation",
    description: "Régner sur 750 animés terminés — un palier réservé à l'élite.",
    category: "anime",
    rarity: "mythic",
    iconKey: "award",
    target: 750,
    unitLabel: "animés terminés",
  },
  {
    id: "anime_deity",
    title: "Divinité de l'Anime",
    description: "Atteindre le sommet absolu : 1 000 animés terminés.",
    category: "anime",
    rarity: "mythic",
    iconKey: "orbit",
    target: 1000,
    unitLabel: "animés terminés",
  },

  // ============================================================================
  // 2. Lecture de mangas & chapitres (8 paliers : jusqu'à 250 mangas / 15 000 ch.)
  // ============================================================================
  {
    id: "manga_curious",
    title: "Lecteur Curieux",
    description: "Lire ou archiver 5 mangas dans votre collection.",
    category: "manga",
    rarity: "bronze",
    iconKey: "book",
    target: 5,
    unitLabel: "mangas lus",
  },
  {
    id: "manga_devourer",
    title: "Dévoreur de Chapitres",
    description: "Explorer 25 mangas dans votre bibliothèque papier.",
    category: "manga",
    rarity: "gold",
    iconKey: "scroll",
    target: 25,
    unitLabel: "mangas lus",
  },
  {
    id: "manga_supreme",
    title: "Bibliothécaire Suprême",
    description: "Rassembler et lire 50 mangas sur Shiori.",
    category: "manga",
    rarity: "legendary",
    iconKey: "library",
    target: 50,
    unitLabel: "mangas lus",
  },
  {
    id: "manga_archivist",
    title: "Archiviste Impérial",
    description: "Lire 100 mangas différents dans votre collection.",
    category: "manga",
    rarity: "legendary",
    iconKey: "bookmark",
    target: 100,
    unitLabel: "mangas lus",
  },
  {
    id: "manga_guardian",
    title: "Gardien du Jump",
    description: "Franchir la barre mythique des 250 mangas lus.",
    category: "manga",
    rarity: "mythic",
    iconKey: "shield",
    target: 250,
    unitLabel: "mangas lus",
  },
  {
    id: "chapters_1k",
    title: "Mille Pages",
    description: "Dépasser les 1 000 chapitres de manga lus.",
    category: "manga",
    rarity: "silver",
    iconKey: "layers",
    target: 1000,
    unitLabel: "chapitres lus",
  },
  {
    id: "chapters_5k",
    title: "Liseur Infini",
    description: "Dévorer plus de 5 000 chapitres de manga.",
    category: "manga",
    rarity: "gold",
    iconKey: "scroll",
    target: 5000,
    unitLabel: "chapitres lus",
  },
  {
    id: "chapters_15k",
    title: "Seigneur de l'Encre",
    description: "Cumuler l'incroyable total de 15 000 chapitres lus.",
    category: "manga",
    rarity: "mythic",
    iconKey: "feather",
    target: 15000,
    unitLabel: "chapitres lus",
  },

  // ============================================================================
  // 3. Exploits, Marathons, Films & Collection (10 paliers Endgame)
  // ============================================================================
  {
    id: "episodes_1k",
    title: "Nuit Blanche",
    description: "Cumuler 1 000 épisodes d'animés visionnés.",
    category: "milestone",
    rarity: "silver",
    iconKey: "moon",
    target: 1000,
    unitLabel: "épisodes vus",
  },
  {
    id: "episodes_5k",
    title: "Marathonien d'Élite",
    description: "Franchir les 5 000 épisodes visionnés.",
    category: "milestone",
    rarity: "gold",
    iconKey: "timer",
    target: 5000,
    unitLabel: "épisodes vus",
  },
  {
    id: "episodes_10k",
    title: "Voyageur Temporel",
    description: "Passer le cap vertigineux des 10 000 épisodes visionnés.",
    category: "milestone",
    rarity: "legendary",
    iconKey: "hourglass",
    target: 10000,
    unitLabel: "épisodes vus",
  },
  {
    id: "episodes_25k",
    title: "Éternel Spectateur",
    description: "Cumuler 25 000 épisodes visionnés — plus d'une année complète devant l'écran.",
    category: "milestone",
    rarity: "mythic",
    iconKey: "infinity",
    target: 25000,
    unitLabel: "épisodes vus",
  },
  {
    id: "movies_15",
    title: "Cinéphile Nippon",
    description: "Terminer 15 films d'animation japonais.",
    category: "milestone",
    rarity: "silver",
    iconKey: "film",
    target: 15,
    unitLabel: "films terminés",
  },
  {
    id: "movies_50",
    title: "Palme d'Or Anime",
    description: "Terminer 50 longs-métrages d'animation.",
    category: "milestone",
    rarity: "gold",
    iconKey: "clapperboard",
    target: 50,
    unitLabel: "films terminés",
  },
  {
    id: "genres_12",
    title: "Caméléon des Genres",
    description: "Explorer au moins 12 genres différents dans votre bibliothèque.",
    category: "milestone",
    rarity: "silver",
    iconKey: "palette",
    target: 12,
    unitLabel: "genres explorés",
  },
  {
    id: "genres_18",
    title: "Omniscient Culturel",
    description: "Toucher à 18 genres d'animés et mangas différents.",
    category: "milestone",
    rarity: "gold",
    iconKey: "globe",
    target: 18,
    unitLabel: "genres explorés",
  },
  {
    id: "collection_500",
    title: "Grande Collection",
    description: "Répertorier 500 animés et mangas dans votre bibliothèque Shiori.",
    category: "milestone",
    rarity: "gold",
    iconKey: "archive",
    target: 500,
    unitLabel: "titres archivés",
  },
  {
    id: "collection_1000",
    title: "Panthéon Vivant",
    description: "Rassembler 1 000 œuvres (animés & mangas) dans votre collection.",
    category: "milestone",
    rarity: "mythic",
    iconKey: "gem",
    target: 1000,
    unitLabel: "titres archivés",
  },

  // ============================================================================
  // 4. Engagement, Critique & Favoris (9 paliers)
  // ============================================================================
  {
    id: "critic_sharp",
    title: "Critique Exigeant",
    description: "Attribuer une note sur 10 à au moins 10 œuvres.",
    category: "critic",
    rarity: "silver",
    iconKey: "star",
    target: 10,
    unitLabel: "notes attribuées",
  },
  {
    id: "critic_100",
    title: "Plume Aiguisée",
    description: "Évaluer 100 œuvres avec votre propre barème critique.",
    category: "critic",
    rarity: "gold",
    iconKey: "pen",
    target: 100,
    unitLabel: "notes attribuées",
  },
  {
    id: "critic_300",
    title: "Juge Suprême",
    description: "Attribuer une note précise à 300 animés ou mangas.",
    category: "critic",
    rarity: "legendary",
    iconKey: "scale",
    target: 300,
    unitLabel: "notes attribuées",
  },
  {
    id: "critic_600",
    title: "Oracle de la Critique",
    description: "Noter 600 œuvres — une encyclopédie critique vivante.",
    category: "critic",
    rarity: "mythic",
    iconKey: "eye",
    target: 600,
    unitLabel: "notes attribuées",
  },
  {
    id: "perfect_tens",
    title: "Chasseur de Chefs-d'œuvre",
    description: "Décerner la note parfaite (10/10) à 10 œuvres inoubliables.",
    category: "critic",
    rarity: "gold",
    iconKey: "diamond",
    target: 10,
    unitLabel: "notes parfaites 10/10",
  },
  {
    id: "heart_collector",
    title: "Coup de Cœur",
    description: "Ajouter 5 animés ou mangas dans vos favoris.",
    category: "critic",
    rarity: "silver",
    iconKey: "heart",
    target: 5,
    unitLabel: "favoris",
  },
  {
    id: "heart_20",
    title: "Collectionneur Passionné",
    description: "Réunir 20 coups de cœur dans votre sélection d'élite.",
    category: "critic",
    rarity: "gold",
    iconKey: "heart",
    target: 20,
    unitLabel: "favoris",
  },
  {
    id: "seiyuu_fan",
    title: "Fan de Seiyuu",
    description: "Mettre en avant au moins 3 Voice Actors favoris.",
    category: "critic",
    rarity: "gold",
    iconKey: "mic",
    target: 3,
    unitLabel: "Voice Actors favoris",
  },
  {
    id: "seiyuu_connoisseur",
    title: "Mélomane des Voix",
    description: "Mettre en lumière 10 Voice Actors légendaires sur votre profil.",
    category: "critic",
    rarity: "legendary",
    iconKey: "mic",
    target: 10,
    unitLabel: "Voice Actors favoris",
  },

  // ============================================================================
  // 5. Social & Communauté (4 paliers)
  // ============================================================================
  {
    id: "known_face",
    title: "Visage Reconnu",
    description: "Personnaliser votre profil avec un avatar unique.",
    category: "social",
    rarity: "bronze",
    iconKey: "camera",
    target: 1,
    unitLabel: "avatar personnalisé",
  },
  {
    id: "active_member",
    title: "Membre Actif",
    description: "Partager 5 likes ou commentaires dans la communauté.",
    category: "social",
    rarity: "gold",
    iconKey: "message",
    target: 5,
    unitLabel: "interactions",
  },
  {
    id: "community_pillar",
    title: "Pilier de la Communauté",
    description: "Cumuler 25 likes ou commentaires avec les membres Shiori.",
    category: "social",
    rarity: "legendary",
    iconKey: "users",
    target: 25,
    unitLabel: "interactions",
  },
  {
    id: "community_icon",
    title: "Icône de Shiori",
    description: "Atteindre 50 likes ou commentaires dans la communauté.",
    category: "social",
    rarity: "mythic",
    iconKey: "sparkles",
    target: 50,
    unitLabel: "interactions",
  },
];

export const BADGE_BY_ID = new Map<string, BadgeDefinition>(
  BADGE_DEFINITIONS.map((b) => [b.id, b])
);

export const RARITY_RANK: Record<BadgeRarity, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  legendary: 4,
  mythic: 5,
};

export const RARITY_META: Record<
  BadgeRarity,
  {
    label: string;
    shortLabel: string;
    color: string;
    border: string;
    bg: string;
    pillClass: string;
    glow: string;
    iconBg: string;
  }
> = {
  bronze: {
    label: "Bronze",
    shortLabel: "Bronze",
    color: "text-[#E5A96F]",
    border: "border-[#CD7F32]/45",
    bg: "bg-gradient-to-br from-[#2B1B10]/90 via-[#171110]/95 to-[#0E0D13]/95",
    pillClass: "bg-[#CD7F32]/20 border-[#E5A96F]/45 text-[#F0BE8A]",
    glow: "0 12px 30px -10px rgba(205,127,50,0.45)",
    iconBg: "from-[#E5A96F] to-[#8C4A1C]",
  },
  silver: {
    label: "Argent",
    shortLabel: "Argent",
    color: "text-[#E2E8F0]",
    border: "border-slate-300/40",
    bg: "bg-gradient-to-br from-[#1F2533]/90 via-[#131722]/95 to-[#0C0E16]/95",
    pillClass: "bg-slate-300/18 border-slate-300/45 text-slate-100",
    glow: "0 12px 30px -10px rgba(203,213,225,0.42)",
    iconBg: "from-[#F1F5F9] to-[#64748B]",
  },
  gold: {
    label: "Or",
    shortLabel: "Or",
    color: "text-[#FCD34D]",
    border: "border-[#F0B95B]/55",
    bg: "bg-gradient-to-br from-[#2A200D]/90 via-[#18140F]/95 to-[#0E0F16]/95",
    pillClass: "bg-[#F0B95B]/20 border-[#FCD34D]/50 text-[#FDE68A]",
    glow: "0 14px 34px -10px rgba(240,185,91,0.52)",
    iconBg: "from-[#FDE047] via-[#F0B95B] to-[#B45309]",
  },
  legendary: {
    label: "Légendaire",
    shortLabel: "★ Légendaire",
    color: "text-[#F0ABFC]",
    border: "border-fuchsia-400/60",
    bg: "bg-gradient-to-br from-[#241236]/92 via-[#11192E]/95 to-[#1F1028]/95",
    pillClass:
      "bg-gradient-to-r from-fuchsia-500/25 via-cyan-400/25 to-amber-400/25 border-fuchsia-300/60 text-white",
    glow: "0 16px 38px -8px rgba(192,132,252,0.58)",
    iconBg: "from-[#F472B6] via-[#8B5CF6] to-[#38BDF8]",
  },
  mythic: {
    label: "Mythique",
    shortLabel: "✦ Mythique",
    color: "text-[#67E8F9]",
    border: "border-cyan-300/70",
    bg: "bg-gradient-to-br from-[#0F2438]/95 via-[#241030]/95 to-[#2D1810]/95",
    pillClass:
      "bg-gradient-to-r from-cyan-400/30 via-amber-300/30 to-rose-400/30 border-cyan-200/75 text-white",
    glow: "0 18px 46px -8px rgba(56,189,248,0.62)",
    iconBg: "from-[#22D3EE] via-[#FDE047] to-[#FB7185]",
  },
};

export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  anime: "Visionnage Animés",
  manga: "Lecture Mangas",
  milestone: "Exploits & Marathon",
  critic: "Critique & Favoris",
  social: "Social & Communauté",
};

export interface BadgeEvaluationMetrics {
  completedAnimeCount: number;
  mangaCount: number;
  episodesWatched: number;
  chaptersRead: number;
  moviesCompletedCount: number;
  uniqueGenresCount: number;
  totalLibraryCount: number;
  scoredCount: number;
  perfectScoresCount: number;
  favoriteMediaCount: number;
  favoriteStaffCount: number;
  hasCustomAvatar: boolean;
  socialInteractionsCount: number;
}

export function extractBadgeMetrics(input: {
  library: LibraryEntry[];
  profile: Pick<UserProfile, "avatarUrl">;
  favoriteStaff: FavoriteVoiceActor[];
  socialInteractionsCount: number;
}): BadgeEvaluationMetrics {
  const { library, profile, favoriteStaff, socialInteractionsCount } = input;

  const completedAnimeCount = library.filter(
    (e) => e.type === "ANIME" && e.status === "COMPLETED"
  ).length;

  const mangaCount = library.filter(
    (e) =>
      e.type === "MANGA" &&
      (e.status === "COMPLETED" || e.progress > 0 || e.status === "WATCHING")
  ).length;

  const episodesWatched = library
    .filter((e) => e.type === "ANIME")
    .reduce((sum, e) => sum + Math.max(0, e.progress || 0), 0);

  const chaptersRead = library
    .filter((e) => e.type === "MANGA")
    .reduce((sum, e) => sum + Math.max(0, e.progress || 0), 0);

  const moviesCompletedCount = library.filter(
    (e) =>
      e.type === "ANIME" &&
      e.status === "COMPLETED" &&
      (e.format === "MOVIE" || e.format?.toUpperCase() === "MOVIE")
  ).length;

  const genreSet = new Set<string>();
  for (const e of library) {
    if (Array.isArray(e.genres)) {
      for (const g of e.genres) {
        if (g) genreSet.add(g.trim().toLowerCase());
      }
    }
  }

  const totalLibraryCount = library.length;
  const scoredCount = library.filter((e) => e.score !== null && e.score > 0).length;
  const perfectScoresCount = library.filter((e) => e.score !== null && e.score >= 10).length;
  const favoriteMediaCount = library.filter((e) => e.isFavorite).length;
  const favoriteStaffCount = favoriteStaff.length;
  const hasCustomAvatar = Boolean(profile.avatarUrl && profile.avatarUrl.trim().length > 0);

  return {
    completedAnimeCount,
    mangaCount,
    episodesWatched,
    chaptersRead,
    moviesCompletedCount,
    uniqueGenresCount: genreSet.size,
    totalLibraryCount,
    scoredCount,
    perfectScoresCount,
    favoriteMediaCount,
    favoriteStaffCount,
    hasCustomAvatar,
    socialInteractionsCount,
  };
}

export function evaluateAllBadges(
  metrics: BadgeEvaluationMetrics,
  unlockedRecords: UnlockedBadgeRecord[] = []
): EvaluatedBadge[] {
  const unlockedMap = new Map<string, string>();
  for (const r of unlockedRecords) {
    unlockedMap.set(r.badgeId, r.unlockedAt);
  }

  return BADGE_DEFINITIONS.map((def) => {
    let current = 0;
    switch (def.id) {
      // Animés terminés
      case "anime_first_step":
      case "anime_explorer":
      case "anime_otaku":
      case "anime_legend":
      case "anime_master":
      case "anime_akihabara":
      case "anime_emperor":
      case "anime_deity":
        current = metrics.completedAnimeCount;
        break;
      // Mangas lus
      case "manga_curious":
      case "manga_devourer":
      case "manga_supreme":
      case "manga_archivist":
      case "manga_guardian":
        current = metrics.mangaCount;
        break;
      // Chapitres lus
      case "chapters_1k":
      case "chapters_5k":
      case "chapters_15k":
        current = metrics.chaptersRead;
        break;
      // Épisodes visionnés
      case "episodes_1k":
      case "episodes_5k":
      case "episodes_10k":
      case "episodes_25k":
        current = metrics.episodesWatched;
        break;
      // Films d'animation
      case "movies_15":
      case "movies_50":
        current = metrics.moviesCompletedCount;
        break;
      // Diversité des genres
      case "genres_12":
      case "genres_18":
        current = metrics.uniqueGenresCount;
        break;
      // Taille de bibliothèque
      case "collection_500":
      case "collection_1000":
        current = metrics.totalLibraryCount;
        break;
      // Critique & notes
      case "critic_sharp":
      case "critic_100":
      case "critic_300":
      case "critic_600":
        current = metrics.scoredCount;
        break;
      case "perfect_tens":
        current = metrics.perfectScoresCount;
        break;
      // Favoris
      case "heart_collector":
      case "heart_20":
        current = metrics.favoriteMediaCount;
        break;
      // Seiyuu
      case "seiyuu_fan":
      case "seiyuu_connoisseur":
        current = metrics.favoriteStaffCount;
        break;
      // Social
      case "known_face":
        current = metrics.hasCustomAvatar ? 1 : 0;
        break;
      case "active_member":
      case "community_pillar":
      case "community_icon":
        current = metrics.socialInteractionsCount;
        break;
    }

    const storedDate = unlockedMap.get(def.id) ?? null;
    const unlocked = current >= def.target || Boolean(storedDate);
    const clampedCurrent = Math.min(current, def.target);
    const progressPct = unlocked
      ? 100
      : Math.min(99, Math.round((clampedCurrent / Math.max(1, def.target)) * 100));

    return {
      id: def.id,
      title: def.title,
      description: def.description,
      category: def.category,
      rarity: def.rarity,
      iconKey: def.iconKey,
      current,
      target: def.target,
      unitLabel: def.unitLabel,
      unlocked,
      unlockedAt: storedDate,
      progressPct,
    };
  });
}

export function isRareBadge(rarity: BadgeRarity): boolean {
  return rarity === "gold" || rarity === "legendary" || rarity === "mythic";
}
