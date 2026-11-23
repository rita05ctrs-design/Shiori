import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LibraryStatus, MediaItem, MediaType } from "@/types/media";

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

export function formatCountdown(airingAt: number, nowSec?: number): string {
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  const diff = airingAt - now;
  if (diff <= 0) {
    const ago = Math.abs(diff);
    if (ago < 3600) return `Diffusé il y a ${Math.max(1, Math.floor(ago / 60))} min`;
    if (ago < 86400) return `Diffusé il y a ${Math.floor(ago / 3600)}h`;
    return `Diffusé il y a ${Math.floor(ago / 86400)}j`;
  }
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `Dans ${days}j ${hours}h`;
  if (hours > 0) return `Dans ${hours}h ${mins}m`;
  return `Dans ${Math.max(1, mins)} min`;
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
