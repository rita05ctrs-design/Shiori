import type { ContentLanguage } from "@/types/media";

export interface YearEraPreset {
  id: string;
  minYear?: number;
  maxYear?: number;
}

/**
 * Curated Anime & Manga release-era categories.
 * Notice `"2000-2010"` (iconic 2000s golden era) alongside modern, 2010s, 90s, 80s and pre-1980 classics.
 */
export const YEAR_ERA_PRESETS: YearEraPreset[] = [
  { id: "2020-2026", minYear: 2020, maxYear: 2026 },
  { id: "2010-2019", minYear: 2010, maxYear: 2019 },
  { id: "2000-2010", minYear: 2000, maxYear: 2010 },
  { id: "1990-1999", minYear: 1990, maxYear: 1999 },
  { id: "1980-1989", minYear: 1980, maxYear: 1989 },
  { id: "BEFORE-1980", maxYear: 1979 },
];

export interface ParsedYearFilter {
  exactYear?: number;
  minYear?: number;
  maxYear?: number;
}

const MIN_VALID_YEAR = 1917;
const MAX_VALID_YEAR = 2035;

function clampYear(y: number): number | null {
  if (!Number.isFinite(y)) return null;
  const n = Math.trunc(y);
  if (n < MIN_VALID_YEAR || n > MAX_VALID_YEAR) return null;
  return n;
}

/**
 * Parses a unified year filter string:
 * - `"ALL"` / empty -> `null`
 * - `"2024"` -> `{ exactYear: 2024 }`
 * - `"2000-2010"` -> `{ minYear: 2000, maxYear: 2010 }`
 * - `"BEFORE-1980"` -> `{ maxYear: 1979 }`
 * - `"2020+"` -> `{ minYear: 2020 }`
 * - `"-2005"` -> `{ maxYear: 2005 }`
 */
export function parseYearFilter(value: string | number | null | undefined): ParsedYearFilter | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    const exact = clampYear(value);
    return exact ? { exactYear: exact } : null;
  }

  const clean = value.trim().toUpperCase();
  if (!clean || clean === "ALL") return null;

  const beforeMatch = clean.match(/^BEFORE-(\d{4})$/);
  if (beforeMatch) {
    const bound = clampYear(Number(beforeMatch[1]));
    return bound ? { maxYear: bound - 1 } : null;
  }

  const plusMatch = clean.match(/^(\d{4})\+$/);
  if (plusMatch) {
    const minY = clampYear(Number(plusMatch[1]));
    return minY ? { minYear: minY } : null;
  }

  const openMaxMatch = clean.match(/^-(\d{4})$/);
  if (openMaxMatch) {
    const maxY = clampYear(Number(openMaxMatch[1]));
    return maxY ? { maxYear: maxY } : null;
  }

  const openMinMatch = clean.match(/^(\d{4})-$/);
  if (openMinMatch) {
    const minY = clampYear(Number(openMinMatch[1]));
    return minY ? { minYear: minY } : null;
  }

  const rangeMatch = clean.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (rangeMatch) {
    const a = clampYear(Number(rangeMatch[1]));
    const b = clampYear(Number(rangeMatch[2]));
    if (!a || !b) return null;
    if (a === b) return { exactYear: a };
    return { minYear: Math.min(a, b), maxYear: Math.max(a, b) };
  }

  const exactMatch = clean.match(/^(\d{4})$/);
  if (exactMatch) {
    const exact = clampYear(Number(exactMatch[1]));
    return exact ? { exactYear: exact } : null;
  }

  return null;
}

/**
 * Checks whether a media release year matches an exact year OR era/range filter string.
 */
export function matchesYearFilter(
  mediaYear: number | null | undefined,
  filterValue: string | null | undefined
): boolean {
  const parsed = parseYearFilter(filterValue);
  if (!parsed) return true;
  if (typeof mediaYear !== "number" || !Number.isFinite(mediaYear)) return false;

  if (parsed.exactYear !== undefined) {
    return mediaYear === parsed.exactYear;
  }
  if (parsed.minYear !== undefined && mediaYear < parsed.minYear) return false;
  if (parsed.maxYear !== undefined && mediaYear > parsed.maxYear) return false;
  return true;
}

/**
 * Converts inclusive year bounds into AniList GraphQL `FuzzyDateInt` (`YYYYMMDD`),
 * respecting AniList's strict `startDate_greater` (`>`) and `startDate_lesser` (`<`).
 */
export function toAniListFuzzyDateBounds(parsed: ParsedYearFilter): {
  startDateGreater?: number;
  startDateLesser?: number;
} {
  if (parsed.exactYear !== undefined) {
    return {
      startDateGreater: (parsed.exactYear - 1) * 10000 + 1231,
      startDateLesser: (parsed.exactYear + 1) * 10000 + 101,
    };
  }
  const out: { startDateGreater?: number; startDateLesser?: number } = {};
  if (parsed.minYear !== undefined) {
    out.startDateGreater = (parsed.minYear - 1) * 10000 + 1231;
  }
  if (parsed.maxYear !== undefined) {
    out.startDateLesser = (parsed.maxYear + 1) * 10000 + 101;
  }
  return out;
}

export interface YearFilterCopy {
  sectionTitle: string;
  allLabel: string;
  allShort: string;
  fromPlaceholder: string;
  toPlaceholder: string;
  toConnector: string;
  erasGroupLabel: string;
  yearsGroupLabel: string;
  before1980Label: string;
  beforePrefix: string;
  eraHints: Record<string, string>;
}

const YEAR_COPY: Record<ContentLanguage, YearFilterCopy> = {
  fr: {
    sectionTitle: "Époque & Années",
    allLabel: "Toutes les années",
    allShort: "Toutes",
    fromPlaceholder: "De",
    toPlaceholder: "À",
    toConnector: "à",
    erasGroupLabel: "Époques",
    yearsGroupLabel: "Année précise",
    before1980Label: "Avant 1980",
    beforePrefix: "Avant",
    eraHints: {
      "2020-2026": "Ère moderne & nouveautés",
      "2010-2019": "Années 2010",
      "2000-2010": "Âge d'or 2000–2010",
      "1990-1999": "Classiques des années 90",
      "1980-1989": "Rétro années 80",
      "BEFORE-1980": "Origines & pionniers",
    },
  },
  en: {
    sectionTitle: "Era & Years",
    allLabel: "All years",
    allShort: "All",
    fromPlaceholder: "From",
    toPlaceholder: "To",
    toConnector: "to",
    erasGroupLabel: "Eras",
    yearsGroupLabel: "Exact year",
    before1980Label: "Before 1980",
    beforePrefix: "Before",
    eraHints: {
      "2020-2026": "Modern era & new releases",
      "2010-2019": "2010s hits",
      "2000-2010": "2000–2010 golden era",
      "1990-1999": "90s classics",
      "1980-1989": "80s retro",
      "BEFORE-1980": "Early classics",
    },
  },
  es: {
    sectionTitle: "Época y Años",
    allLabel: "Todos los años",
    allShort: "Todos",
    fromPlaceholder: "Desde",
    toPlaceholder: "Hasta",
    toConnector: "a",
    erasGroupLabel: "Épocas",
    yearsGroupLabel: "Año exacto",
    before1980Label: "Antes de 1980",
    beforePrefix: "Antes de",
    eraHints: {
      "2020-2026": "Era moderna y estrenos",
      "2010-2019": "Años 2010",
      "2000-2010": "Edad de oro 2000–2010",
      "1990-1999": "Clásicos de los 90",
      "1980-1989": "Retro años 80",
      "BEFORE-1980": "Orígenes y pioneros",
    },
  },
  de: {
    sectionTitle: "Ära & Jahre",
    allLabel: "Alle Jahre",
    allShort: "Alle",
    fromPlaceholder: "Von",
    toPlaceholder: "Bis",
    toConnector: "bis",
    erasGroupLabel: "Epochen",
    yearsGroupLabel: "Genaues Jahr",
    before1980Label: "Vor 1980",
    beforePrefix: "Vor",
    eraHints: {
      "2020-2026": "Moderne & Neuheiten",
      "2010-2019": "2010er Jahre",
      "2000-2010": "Goldene Ära 2000–2010",
      "1990-1999": "90er-Klassiker",
      "1980-1989": "80er-Retro",
      "BEFORE-1980": "Frühe Klassiker",
    },
  },
  it: {
    sectionTitle: "Epoca e Anni",
    allLabel: "Tutti gli anni",
    allShort: "Tutti",
    fromPlaceholder: "Da",
    toPlaceholder: "A",
    toConnector: "a",
    erasGroupLabel: "Epoche",
    yearsGroupLabel: "Anno preciso",
    before1980Label: "Prima del 1980",
    beforePrefix: "Prima del",
    eraHints: {
      "2020-2026": "Era moderna e novità",
      "2010-2019": "Anni 2010",
      "2000-2010": "Età d'oro 2000–2010",
      "1990-1999": "Classici anni '90",
      "1980-1989": "Retrò anni '80",
      "BEFORE-1980": "Origini e pionieri",
    },
  },
  pt: {
    sectionTitle: "Época e Anos",
    allLabel: "Todos os anos",
    allShort: "Todos",
    fromPlaceholder: "De",
    toPlaceholder: "Até",
    toConnector: "a",
    erasGroupLabel: "Épocas",
    yearsGroupLabel: "Ano exato",
    before1980Label: "Antes de 1980",
    beforePrefix: "Antes de",
    eraHints: {
      "2020-2026": "Era moderna e lançamentos",
      "2010-2019": "Anos 2010",
      "2000-2010": "Era de ouro 2000–2010",
      "1990-1999": "Clássicos dos anos 90",
      "1980-1989": "Retrô anos 80",
      "BEFORE-1980": "Origens e pioneiros",
    },
  },
  ja: {
    sectionTitle: "年代・公開年",
    allLabel: "すべての年代",
    allShort: "すべて",
    fromPlaceholder: "開始",
    toPlaceholder: "終了",
    toConnector: "〜",
    erasGroupLabel: "年代カテゴリー",
    yearsGroupLabel: "年を指定",
    before1980Label: "1980年以前",
    beforePrefix: "〜",
    eraHints: {
      "2020-2026": "最新・2020年代",
      "2010-2019": "2010年代の名作",
      "2000-2010": "2000〜2010年 黄金期",
      "1990-1999": "90年代クラシック",
      "1980-1989": "80年代レトロ",
      "BEFORE-1980": "黎明期クラシック",
    },
  },
};

export function getYearFilterCopy(lang: ContentLanguage): YearFilterCopy {
  return YEAR_COPY[lang] ?? YEAR_COPY.fr;
}

export function getYearEraOptions(lang: ContentLanguage): {
  id: string;
  label: string;
  hint: string;
}[] {
  const copy = getYearFilterCopy(lang);
  return YEAR_ERA_PRESETS.map((era) => ({
    id: era.id,
    label:
      era.id === "BEFORE-1980"
        ? copy.before1980Label
        : `${era.minYear} – ${era.maxYear}`,
    hint: copy.eraHints[era.id] ?? "",
  }));
}

export function getYearFilterLabel(
  value: string,
  lang: ContentLanguage
): string {
  const copy = getYearFilterCopy(lang);
  if (!value || value === "ALL") return copy.allLabel;
  if (value === "BEFORE-1980") return copy.before1980Label;
  const parsed = parseYearFilter(value);
  if (!parsed) return value;
  if (parsed.exactYear !== undefined) return String(parsed.exactYear);
  if (parsed.minYear !== undefined && parsed.maxYear !== undefined) {
    return `${parsed.minYear} – ${parsed.maxYear}`;
  }
  if (parsed.minYear !== undefined) return `${parsed.minYear}+`;
  if (parsed.maxYear !== undefined) {
    return lang === "ja" ? `${parsed.maxYear}年以前` : `≤ ${parsed.maxYear}`;
  }
  return value;
}
