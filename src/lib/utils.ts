import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ContentLanguage, LibraryStatus, MediaItem, MediaType } from "@/types/media";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getDisplayTitle(media: Pick<MediaItem, "title">): string {
  return media.title.english || media.title.romaji || media.title.native || "Sans titre";
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "Aucun synopsis disponible pour le moment.";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  // AniList scores are 0-100; user scores are 0-10
  if (score > 10) {
    return (score / 10).toFixed(1);
  }
  return score.toFixed(1);
}

export function formatFormat(format: string | null | undefined): string {
  if (!format) return "Série";
  const map: Record<string, string> = {
    TV: "TV",
    TV_SHORT: "TV Court",
    MOVIE: "Film",
    SPECIAL: "Spécial",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "Clip",
    MANGA: "Manga",
    NOVEL: "Light Novel",
    ONE_SHOT: "One-Shot",
  };
  return map[format] ?? format;
}

export function formatMediaStatus(status: string | null | undefined): string {
  if (!status) return "Inconnu";
  const map: Record<string, string> = {
    RELEASING: "En cours",
    FINISHED: "Terminé",
    NOT_YET_RELEASED: "À venir",
    CANCELLED: "Annulé",
    HIATUS: "En pause",
  };
  return map[status] ?? status;
}

export function formatSeason(season: string | null | undefined, year: number | null | undefined): string {
  const map: Record<string, string> = {
    WINTER: "Hiver",
    SPRING: "Printemps",
    SUMMER: "Été",
    FALL: "Automne",
  };
  if (season && year) return `${map[season] ?? season} ${year}`;
  if (year) return `${year}`;
  return "Saison inconnue";
}

export const STATUS_CONFIG: Record<
  LibraryStatus,
  {
    label: string;
    mangaLabel: string;
    shortLabel: string;
    color: string;
    bg: string;
    border: string;
    dot: string;
  }
> = {
  WATCHING: {
    label: "En cours",
    mangaLabel: "En lecture",
    shortLabel: "En cours",
    color: "text-sky-400",
    bg: "bg-sky-500/12",
    border: "border-sky-500/30",
    dot: "bg-sky-400",
  },
  COMPLETED: {
    label: "Terminé",
    mangaLabel: "Terminé",
    shortLabel: "Terminé",
    color: "text-emerald-400",
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  ON_HOLD: {
    label: "En pause",
    mangaLabel: "En pause",
    shortLabel: "En pause",
    color: "text-amber-400",
    bg: "bg-amber-500/12",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
  },
  DROPPED: {
    label: "Abandonné",
    mangaLabel: "Abandonné",
    shortLabel: "Abandonné",
    color: "text-rose-400",
    bg: "bg-rose-500/12",
    border: "border-rose-500/30",
    dot: "bg-rose-400",
  },
  PLAN_TO_WATCH: {
    label: "À voir",
    mangaLabel: "À lire",
    shortLabel: "À voir",
    color: "text-violet-400",
    bg: "bg-violet-500/12",
    border: "border-violet-500/30",
    dot: "bg-violet-400",
  },
};

export function getStatusLabel(status: LibraryStatus, type?: MediaType): string {
  const cfg = STATUS_CONFIG[status];
  if (type === "MANGA" && status === "WATCHING") return cfg.mangaLabel;
  if (type === "MANGA" && status === "PLAN_TO_WATCH") return cfg.mangaLabel;
  return cfg.label;
}

const COUNTDOWN_LABELS: Record<
  ContentLanguage,
  {
    airedMin: (m: number) => string;
    airedHour: (h: number) => string;
    airedDay: (d: number) => string;
    inDayHour: (d: number, h: number) => string;
    inHourMin: (h: number, m: number) => string;
    inMin: (m: number) => string;
  }
> = {
  fr: {
    airedMin: (m) => `Diffusé il y a ${m} min`,
    airedHour: (h) => `Diffusé il y a ${h}h`,
    airedDay: (d) => `Diffusé il y a ${d}j`,
    inDayHour: (d, h) => `Dans ${d}j ${h}h`,
    inHourMin: (h, m) => `Dans ${h}h ${m}m`,
    inMin: (m) => `Dans ${m} min`,
  },
  en: {
    airedMin: (m) => `Aired ${m}m ago`,
    airedHour: (h) => `Aired ${h}h ago`,
    airedDay: (d) => `Aired ${d}d ago`,
    inDayHour: (d, h) => `In ${d}d ${h}h`,
    inHourMin: (h, m) => `In ${h}h ${m}m`,
    inMin: (m) => `In ${m} min`,
  },
  es: {
    airedMin: (m) => `Emitido hace ${m} min`,
    airedHour: (h) => `Emitido hace ${h}h`,
    airedDay: (d) => `Emitido hace ${d}d`,
    inDayHour: (d, h) => `En ${d}d ${h}h`,
    inHourMin: (h, m) => `En ${h}h ${m}m`,
    inMin: (m) => `En ${m} min`,
  },
  de: {
    airedMin: (m) => `Vor ${m} Min. ausgestrahlt`,
    airedHour: (h) => `Vor ${h} Std. ausgestrahlt`,
    airedDay: (d) => `Vor ${d} T. ausgestrahlt`,
    inDayHour: (d, h) => `In ${d}T ${h}Std`,
    inHourMin: (h, m) => `In ${h}Std ${m}m`,
    inMin: (m) => `In ${m} Min.`,
  },
  it: {
    airedMin: (m) => `Trasmesso ${m} min fa`,
    airedHour: (h) => `Trasmesso ${h}h fa`,
    airedDay: (d) => `Trasmesso ${d}g fa`,
    inDayHour: (d, h) => `Tra ${d}g ${h}h`,
    inHourMin: (h, m) => `Tra ${h}h ${m}m`,
    inMin: (m) => `Tra ${m} min`,
  },
  pt: {
    airedMin: (m) => `Exibido há ${m} min`,
    airedHour: (h) => `Exibido há ${h}h`,
    airedDay: (d) => `Exibido há ${d}d`,
    inDayHour: (d, h) => `Em ${d}d ${h}h`,
    inHourMin: (h, m) => `Em ${h}h ${m}m`,
    inMin: (m) => `Em ${m} min`,
  },
  ja: {
    airedMin: (m) => `${m}分前に放送`,
    airedHour: (h) => `${h}時間前に放送`,
    airedDay: (d) => `${d}日前に放送`,
    inDayHour: (d, h) => `あと${d}日${h}時間`,
    inHourMin: (h, m) => `あと${h}時間${m}分`,
    inMin: (m) => `あと${m}分`,
  },
};

export function formatCountdown(
  airingAt: number,
  nowSec?: number,
  lang: ContentLanguage = "fr"
): string {
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  const diff = airingAt - now;
  const fmt = COUNTDOWN_LABELS[lang] ?? COUNTDOWN_LABELS.fr;
  if (diff <= 0) {
    const ago = Math.abs(diff);
    if (ago < 3600) return fmt.airedMin(Math.max(1, Math.floor(ago / 60)));
    if (ago < 86400) return fmt.airedHour(Math.floor(ago / 3600));
    return fmt.airedDay(Math.floor(ago / 86400));
  }
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return fmt.inDayHour(days, hours);
  if (hours > 0) return fmt.inHourMin(hours, mins);
  return fmt.inMin(Math.max(1, mins));
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function formatCompactNumber(num: number | null | undefined): string {
  if (!num) return "—";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return String(num);
}

export const ALL_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
];

export const GENRE_LABELS_FR: Record<string, string> = {
  Action: "Action",
  Adventure: "Aventure",
  Comedy: "Comédie",
  Drama: "Drame",
  Fantasy: "Fantastique",
  Horror: "Horreur",
  "Mahou Shoujo": "Magical Girl",
  Mecha: "Mecha",
  Music: "Musique",
  Mystery: "Mystère",
  Psychological: "Psychologique",
  Romance: "Romance",
  "Sci-Fi": "Sci-Fi",
  "Slice of Life": "Tranche de vie",
  Sports: "Sport",
  Supernatural: "Surnaturel",
  Thriller: "Thriller",
};
