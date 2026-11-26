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

const LANG_TO_LOCALE: Record<ContentLanguage, string> = {
  fr: "fr-FR",
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  ja: "ja-JP",
};

const FORMAT_LABELS: Record<ContentLanguage, Record<string, string>> = {
  fr: {
    DEFAULT: "Série",
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
  },
  en: {
    DEFAULT: "Series",
    TV: "TV",
    TV_SHORT: "TV Short",
    MOVIE: "Movie",
    SPECIAL: "Special",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "Music",
    MANGA: "Manga",
    NOVEL: "Light Novel",
    ONE_SHOT: "One-Shot",
  },
  es: {
    DEFAULT: "Serie",
    TV: "TV",
    TV_SHORT: "TV Corto",
    MOVIE: "Película",
    SPECIAL: "Especial",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "Música",
    MANGA: "Manga",
    NOVEL: "Novela Ligera",
    ONE_SHOT: "One-Shot",
  },
  de: {
    DEFAULT: "Serie",
    TV: "TV",
    TV_SHORT: "TV-Kurz",
    MOVIE: "Film",
    SPECIAL: "Special",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "Musik",
    MANGA: "Manga",
    NOVEL: "Light Novel",
    ONE_SHOT: "One-Shot",
  },
  it: {
    DEFAULT: "Serie",
    TV: "TV",
    TV_SHORT: "TV Corto",
    MOVIE: "Film",
    SPECIAL: "Speciale",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "Musica",
    MANGA: "Manga",
    NOVEL: "Light Novel",
    ONE_SHOT: "One-Shot",
  },
  pt: {
    DEFAULT: "Série",
    TV: "TV",
    TV_SHORT: "TV Curto",
    MOVIE: "Filme",
    SPECIAL: "Especial",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "Música",
    MANGA: "Mangá",
    NOVEL: "Light Novel",
    ONE_SHOT: "One-Shot",
  },
  ja: {
    DEFAULT: "シリーズ",
    TV: "TV",
    TV_SHORT: "TVショート",
    MOVIE: "映画",
    SPECIAL: "スペシャル",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "ミュージック",
    MANGA: "漫画",
    NOVEL: "ライトノベル",
    ONE_SHOT: "読み切り",
  },
};

export function formatFormat(
  format: string | null | undefined,
  lang: ContentLanguage = "fr"
): string {
  const dict = FORMAT_LABELS[lang] ?? FORMAT_LABELS.fr;
  if (!format) return dict.DEFAULT;
  return dict[format] ?? format;
}

const MEDIA_STATUS_LABELS: Record<ContentLanguage, Record<string, string>> = {
  fr: {
    UNKNOWN: "Inconnu",
    RELEASING: "En cours",
    FINISHED: "Terminé",
    NOT_YET_RELEASED: "À venir",
    CANCELLED: "Annulé",
    HIATUS: "En pause",
  },
  en: {
    UNKNOWN: "Unknown",
    RELEASING: "Airing",
    FINISHED: "Finished",
    NOT_YET_RELEASED: "Upcoming",
    CANCELLED: "Cancelled",
    HIATUS: "Hiatus",
  },
  es: {
    UNKNOWN: "Desconocido",
    RELEASING: "En emisión",
    FINISHED: "Finalizado",
    NOT_YET_RELEASED: "Próximamente",
    CANCELLED: "Cancelado",
    HIATUS: "En pausa",
  },
  de: {
    UNKNOWN: "Unbekannt",
    RELEASING: "Laufend",
    FINISHED: "Abgeschlossen",
    NOT_YET_RELEASED: "Angekündigt",
    CANCELLED: "Abgebrochen",
    HIATUS: "Pausiert",
  },
  it: {
    UNKNOWN: "Sconosciuto",
    RELEASING: "In corso",
    FINISHED: "Concluso",
    NOT_YET_RELEASED: "In arrivo",
    CANCELLED: "Cancellato",
    HIATUS: "In pausa",
  },
  pt: {
    UNKNOWN: "Desconhecido",
    RELEASING: "Em exibição",
    FINISHED: "Concluído",
    NOT_YET_RELEASED: "Em breve",
    CANCELLED: "Cancelado",
    HIATUS: "Em hiato",
  },
  ja: {
    UNKNOWN: "不明",
    RELEASING: "放送・連載中",
    FINISHED: "完結",
    NOT_YET_RELEASED: "放送予定",
    CANCELLED: "中止",
    HIATUS: "休止中",
  },
};

export function formatMediaStatus(
  status: string | null | undefined,
  lang: ContentLanguage = "fr"
): string {
  const dict = MEDIA_STATUS_LABELS[lang] ?? MEDIA_STATUS_LABELS.fr;
  if (!status) return dict.UNKNOWN;
  return dict[status] ?? status;
}

const SEASON_LABELS_BY_LANG: Record<ContentLanguage, Record<string, string>> = {
  fr: { WINTER: "Hiver", SPRING: "Printemps", SUMMER: "Été", FALL: "Automne", UNKNOWN: "Saison inconnue" },
  en: { WINTER: "Winter", SPRING: "Spring", SUMMER: "Summer", FALL: "Fall", UNKNOWN: "Unknown season" },
  es: { WINTER: "Invierno", SPRING: "Primavera", SUMMER: "Verano", FALL: "Otoño", UNKNOWN: "Temporada desconocida" },
  de: { WINTER: "Winter", SPRING: "Frühling", SUMMER: "Sommer", FALL: "Herbst", UNKNOWN: "Unbekannte Saison" },
  it: { WINTER: "Inverno", SPRING: "Primavera", SUMMER: "Estate", FALL: "Autunno", UNKNOWN: "Stagione sconosciuta" },
  pt: { WINTER: "Inverno", SPRING: "Primavera", SUMMER: "Verão", FALL: "Outono", UNKNOWN: "Temporada desconhecida" },
  ja: { WINTER: "冬", SPRING: "春", SUMMER: "夏", FALL: "秋", UNKNOWN: "シーズン不明" },
};

export function formatSeason(
  season: string | null | undefined,
  year: number | null | undefined,
  lang: ContentLanguage = "fr"
): string {
  const dict = SEASON_LABELS_BY_LANG[lang] ?? SEASON_LABELS_BY_LANG.fr;
  if (season && year) {
    if (lang === "ja") return `${year}年${dict[season] ?? season}`;
    return `${dict[season] ?? season} ${year}`;
  }
  if (year) return `${year}`;
  return dict.UNKNOWN;
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

const RELATIVE_TIME_LABELS: Record<
  ContentLanguage,
  {
    justNow: string;
    minsAgo: (m: number) => string;
    hoursAgo: (h: number) => string;
    daysAgo: (d: number) => string;
  }
> = {
  fr: {
    justNow: "À l'instant",
    minsAgo: (m) => `Il y a ${m} min`,
    hoursAgo: (h) => `Il y a ${h}h`,
    daysAgo: (d) => `Il y a ${d}j`,
  },
  en: {
    justNow: "Just now",
    minsAgo: (m) => `${m}m ago`,
    hoursAgo: (h) => `${h}h ago`,
    daysAgo: (d) => `${d}d ago`,
  },
  es: {
    justNow: "Ahora mismo",
    minsAgo: (m) => `Hace ${m} min`,
    hoursAgo: (h) => `Hace ${h}h`,
    daysAgo: (d) => `Hace ${d}d`,
  },
  de: {
    justNow: "Gerade eben",
    minsAgo: (m) => `Vor ${m} Min.`,
    hoursAgo: (h) => `Vor ${h} Std.`,
    daysAgo: (d) => `Vor ${d} T.`,
  },
  it: {
    justNow: "Proprio ora",
    minsAgo: (m) => `${m} min fa`,
    hoursAgo: (h) => `${h}h fa`,
    daysAgo: (d) => `${d}g fa`,
  },
  pt: {
    justNow: "Agora mesmo",
    minsAgo: (m) => `Há ${m} min`,
    hoursAgo: (h) => `Há ${h}h`,
    daysAgo: (d) => `Há ${d}d`,
  },
  ja: {
    justNow: "たった今",
    minsAgo: (m) => `${m}分前`,
    hoursAgo: (h) => `${h}時間前`,
    daysAgo: (d) => `${d}日前`,
  },
};

export function formatRelativeTime(
  iso: string,
  lang: ContentLanguage = "fr"
): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  const fmt = RELATIVE_TIME_LABELS[lang] ?? RELATIVE_TIME_LABELS.fr;
  if (mins < 1) return fmt.justNow;
  if (mins < 60) return fmt.minsAgo(mins);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return fmt.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  if (days < 7) return fmt.daysAgo(days);
  return new Date(iso).toLocaleDateString(LANG_TO_LOCALE[lang] ?? "fr-FR", {
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
