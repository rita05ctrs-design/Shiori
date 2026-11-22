export type MediaType = "ANIME" | "MANGA";

export type LibraryStatus =
  | "WATCHING"
  | "COMPLETED"
  | "ON_HOLD"
  | "DROPPED"
  | "PLAN_TO_WATCH";

export interface MediaTitle {
  romaji: string;
  english: string | null;
  native: string | null;
}

export interface MediaCoverImage {
  extraLarge: string;
  large: string;
  color: string | null;
}

export interface NextAiringEpisode {
  airingAt: number;
  timeUntilAiring: number;
  episode: number;
}

export interface MediaItem {
  id: number;
  type: MediaType;
  title: MediaTitle;
  coverImage: MediaCoverImage;
  bannerImage: string | null;
  description: string | null;
  format: string | null;
  status: string | null;
  episodes: number | null;
  chapters: number | null;
  volumes: number | null;
  duration: number | null;
  season: string | null;
  seasonYear: number | null;
  startYear: number | null;
  startDate?: {
    year: number | null;
    month: number | null;
    day: number | null;
  } | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  favourites: number | null;
  genres: string[];
  studio: string | null;
  trailer: {
    id: string;
    site: string;
  } | null;
  nextAiringEpisode: NextAiringEpisode | null;
}

export interface CharacterEdge {
  id: number;
  role: string;
  name: string;
  image: string;
  voiceActor?: {
    name: string;
    image: string;
    language: string;
  } | null;
}

export interface MediaRelation {
  relationType: string;
  media: {
    id: number;
    type: MediaType;
    title: string;
    coverImage: string;
    format: string | null;
    averageScore: number | null;
  };
}

export interface ScoreDistributionItem {
  score: number;
  amount: number;
}

export interface MediaDetail extends MediaItem {
  source: string | null;
  countryOfOrigin: string | null;
  hashtag: string | null;
  siteUrl: string | null;
  studios: string[];
  tags: { name: string; rank: number }[];
  characters: CharacterEdge[];
  relations: MediaRelation[];
  recommendations: MediaItem[];
  scoreDistribution: ScoreDistributionItem[];
  streamingEpisodes: {
    title: string;
    thumbnail: string;
    url: string;
    site: string;
  }[];
}

export interface AiringScheduleItem {
  id: number;
  airingAt: number;
  episode: number;
  timeUntilAiring: number;
  media: MediaItem;
}

export interface LibraryEntry {
  mediaId: number;
  type: MediaType;
  title: string;
  nativeTitle?: string | null;
  coverImage: string;
  bannerImage: string | null;
  totalUnits: number | null; // episodes for ANIME, chapters for MANGA
  duration: number | null; // minutes per ep
  genres: string[];
  studio: string | null;
  format: string | null;
  seasonYear: number | null;
  averageScore: number | null;
  status: LibraryStatus;
  progress: number;
  score: number | null; // 0 to 10 (0.5 step)
  isFavorite: boolean;
  notes: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface NotificationPrefs {
  airingAlerts: boolean;
  weeklyDigest: boolean;
  milestones: boolean;
  recommendations: boolean;
}

export type AmbianceEffect =
  | "sakura"
  | "momiji"
  | "snow"
  | "fireflies"
  | "rain"
  | "stars"
  | "none";

export type AmbianceDensity = "subtle" | "balanced" | "immersive";
export type AmbianceSpeed = "slow" | "normal" | "brisk";

export interface AmbianceSettings {
  effect: AmbianceEffect;
  density: AmbianceDensity;
  speed: AmbianceSpeed;
}

export type SurfaceAtmosphere =
  | "obsidian"
  | "oled"
  | "midnight"
  | "velvet"
  | "slate"
  | "tinted";

export type GlowIntensity = "off" | "subtle" | "vibrant";
export type CornerStyle = "sharp" | "editorial" | "soft";

export interface ThemeSettings {
  presetId: string;
  accentColor: string;
  secondaryColor: string;
  surface: SurfaceAtmosphere;
  glow: GlowIntensity;
  corners: CornerStyle;
  syncParticles: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  bio: string;
  avatarInitials: string;
  accentColor: string;
  mode: "local" | "account" | "supabase";
  notificationPrefs: NotificationPrefs;
  joinedAt: string;
}

export interface ShioriNotification {
  id: string;
  kind: "AIRING" | "MILESTONE" | "RECOMMENDATION" | "SYSTEM";
  title: string;
  body: string;
  mediaId?: number;
  coverImage?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  mediaId: number;
  mediaTitle: string;
  mediaType: MediaType;
  coverImage: string;
  action: string;
  createdAt: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "info" | "warning";
  coverImage?: string;
  status?: LibraryStatus;
  mediaId?: number;
  celebrate?: boolean;
}

export interface AniListGenreStat {
  genre: string;
  count: number;
  meanScore: number;
  minutesWatched?: number;
  chaptersRead?: number;
}

export interface AniListStatusStat {
  status: string;
  count: number;
  meanScore: number;
  minutesWatched?: number;
  chaptersRead?: number;
}

export interface AniListFormatStat {
  format: string;
  count: number;
  meanScore: number;
  minutesWatched?: number;
  chaptersRead?: number;
}

export interface AniListScoreStat {
  score: number;
  count: number;
}

export interface AniListAnimeStatistics {
  count: number;
  meanScore: number;
  standardDeviation: number;
  minutesWatched: number;
  episodesWatched: number;
  genres: AniListGenreStat[];
  statuses: AniListStatusStat[];
  formats: AniListFormatStat[];
  scores: AniListScoreStat[];
}

export interface AniListMangaStatistics {
  count: number;
  meanScore: number;
  standardDeviation: number;
  chaptersRead: number;
  volumesRead: number;
  genres: AniListGenreStat[];
  statuses: AniListStatusStat[];
  formats: AniListFormatStat[];
  scores: AniListScoreStat[];
}

export interface AniListUserStatsSnapshot {
  anilistUsername: string;
  anilistUserId: number | null;
  anilistAvatarUrl: string | null;
  anilistBannerUrl: string | null;
  anilistSiteUrl: string | null;
  anime: AniListAnimeStatistics;
  manga: AniListMangaStatistics;
  syncedAt: string;
}

export interface AniListImportResponse {
  user: {
    id: number;
    name: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    siteUrl: string | null;
  };
  entries: LibraryEntry[];
  counts: {
    anime: number;
    manga: number;
    favorites: number;
    total: number;
  };
  statistics: AniListUserStatsSnapshot;
  supabaseSync: {
    authenticated: boolean;
    entriesSaved: number;
    statsSaved: boolean;
    error?: string;
  };
}

export interface AniListConnectionStatus {
  configured: boolean;
  connected: boolean;
  storage: "supabase" | "account" | "cookie" | null;
  redirectUri: string;
  user: {
    id: number;
    name: string;
    avatarUrl: string | null;
    siteUrl: string | null;
  } | null;
  connectedAt: string | null;
  expiresAt: string | null;
}

export interface AniListSyncEvent {
  ok: boolean;
  title: string;
  action: "save" | "delete" | "favorite";
  detail: string;
  at: string;
}
