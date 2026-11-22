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

export interface FavoriteVoiceActor {
  id: number;
  name: string;
  nativeName: string | null;
  image: string;
  language: string | null;
  siteUrl: string | null;
  notableRoles?: { name: string; mediaTitle?: string | null }[];
}

export type ContentLanguage = "fr" | "en" | "es" | "it";

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  bio: string;
  avatarInitials: string;
  avatarUrl?: string | null;
  accentColor: string;
  isActivityPublic?: boolean;
  preferredLanguage?: ContentLanguage;
  mode: "local" | "account" | "supabase";
  notificationPrefs: NotificationPrefs;
  joinedAt: string;
}

export interface PublicProfileMediaSummary {
  mediaId: number;
  type: MediaType;
  title: string;
  coverImage: string;
  score: number | null;
}

export interface PublicProfileStatsSummary {
  totalEntries: number;
  animeCount: number;
  mangaCount: number;
  episodesWatched: number;
  chaptersRead: number;
  completedCount: number;
  meanScore: number | null;
}

export type BadgeRarity = "bronze" | "silver" | "gold" | "legendary" | "mythic";
export type BadgeCategory = "anime" | "manga" | "milestone" | "critic" | "social";

export interface UnlockedBadgeRecord {
  badgeId: string;
  unlockedAt: string;
}

export interface EvaluatedBadge {
  id: string;
  title: string;
  description: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  iconKey: string;
  current: number;
  target: number;
  unitLabel: string;
  unlocked: boolean;
  unlockedAt: string | null;
  progressPct: number;
}

export interface PublicUserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarInitials: string;
  bio: string;
  accentColor: string;
  isActivityPublic: boolean;
  joinedAt: string;
  favoriteStaff: FavoriteVoiceActor[];
  favoriteMedia: PublicProfileMediaSummary[];
  stats: PublicProfileStatsSummary;
  unlockedBadges?: UnlockedBadgeRecord[];
  pinnedBadges?: string[];
  socialInteractionsCount?: number;
  source?: "supabase" | "local" | "community";
}

export type CommunityActivityKind =
  | "FAVORITE_MEDIA"
  | "FAVORITE_STAFF"
  | "COMPLETED"
  | "SCORED"
  | "BADGE_UNLOCKED"
  | "UPDATE";

export interface ActivityCommentItem {
  id: string;
  activityId: string;
  userId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorAccentColor?: string;
  body: string;
  createdAt: string;
}

export interface CommunityActivityItem {
  id: string;
  userId: string;
  actorUsername: string;
  actorDisplayName: string;
  actorAvatarUrl: string | null;
  actorAccentColor?: string;
  actorPinnedBadges?: string[];
  kind: CommunityActivityKind;
  mediaId: number;
  mediaTitle: string;
  mediaType: MediaType | "STAFF" | "BADGE";
  coverImage: string | null;
  action: string;
  score?: number | null;
  badgeId?: string | null;
  badgeRarity?: BadgeRarity | null;
  isPublic: boolean;
  createdAt: string;
  likes: string[]; // user IDs who liked
  comments: ActivityCommentItem[];
}

export interface DirectMessageItem {
  id: string;
  senderId: string;
  recipientId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string | null;
  recipientUsername: string;
  recipientDisplayName: string;
  recipientAvatarUrl: string | null;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export type FriendshipStatus = "PENDING" | "ACCEPTED";
export type FriendRelationState =
  | "NONE"
  | "PENDING_OUTGOING"
  | "PENDING_INCOMING"
  | "FRIENDS";

export interface FriendshipRecord {
  id: string;
  requesterId: string;
  requesterUsername: string;
  requesterDisplayName: string;
  requesterAvatarUrl: string | null;
  addresseeId: string;
  addresseeUsername: string;
  addresseeDisplayName: string;
  addresseeAvatarUrl: string | null;
  status: FriendshipStatus;
  createdAt: string;
}

export interface FriendRequestWithProfile {
  friendship: FriendshipRecord;
  user: PublicUserProfile;
}

export interface PersonalizedRecommendation {
  media: MediaItem;
  reason: string;
  reasonKind: "similar" | "genre";
  sourceTitle?: string;
  matchedTag?: string;
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
