import type { ContentLanguage, MediaRelation } from "../types/media.ts";

export type SourceMediumKind = "MANGA" | "MANHWA" | "MANHUA" | "NOVEL" | "WEB_NOVEL";

export interface LiveAdaptationAnchor {
  /** Verified reference episode number */
  anchorEpisode: number;
  /** Verified chapter adapted by anchorEpisode */
  anchorChapter: number;
  /** Average chapters adapted per episode */
  chaptersPerEpisode: number;
  /** Approximate chapters per tankobon volume (optional) */
  chaptersPerVolume?: number;
}

export interface MangaContinuationInfo {
  sourceKind: SourceMediumKind;
  endedAtChapter: number | null;
  continueAtChapter: number | null;
  endedAtVolume: number | null;
  continueAtVolume: number | null;
  coveredRange: string | null;
  adaptedArc: string | null;
  isFullyAdapted: boolean;
  isOngoingAdaptation?: boolean;
  verified: boolean;
  confidence: "verified" | "high" | "medium" | "low";
  note?: string | null;
  notesByLang?: Partial<Record<ContentLanguage, string>>;
  /** Real-time airing synchronization metadata */
  syncedEpisode?: number | null;
  totalEpisodes?: number | null;
  chaptersPerEpisode?: number | null;
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
  liveSynced?: boolean;
  updatedAt?: string;
  liveAnchor?: LiveAdaptationAnchor | null;
}

interface CuratedContinuationEntry extends Omit<MangaContinuationInfo, "verified" | "confidence"> {
  /** Primary AniList anime IDs matching this exact season / entry */
  anilistIds: number[];
  /** Optional normalized title patterns as secondary fallback */
  titleMatchers?: string[];
}

/**
 * Curated, community-verified Anime -> Manga / Manhwa / Light Novel continuation guide.
 * Covers major modern & classic franchises season-by-season so popular titles resolve in 0ms
 * with exact chapter & volume breakpoints.
 */
const CURATED_CONTINUATIONS: CuratedContinuationEntry[] = [
  // --- FRIEREN ---
  {
    anilistIds: [154587],
    sourceKind: "MANGA",
    endedAtChapter: 60,
    continueAtChapter: 61,
    endedAtVolume: 7,
    continueAtVolume: 7,
    coveredRange: "Ch. 1 – 60",
    adaptedArc: "First-Class Mage Exam",
    isFullyAdapted: false,
    notesByLang: {
      fr: "L'épisode 28 adapte exactement la fin du chapitre 60 (Tome 7). Reprenez directement au chapitre 61 !",
      en: "Episode 28 ends right at Chapter 60 (Volume 7). Pick up directly at Chapter 61!",
      es: "El episodio 28 termina exactamente en el capítulo 60 (Volumen 7). ¡Continúa en el capítulo 61!",
      de: "Folge 28 endet exakt bei Kapitel 60 (Band 7). Lies direkt ab Kapitel 61 weiter!",
      it: "L'episodio 28 termina esattamente al capitolo 60 (Volume 7). Riprendi dal capitolo 61!",
      pt: "O episódio 28 termina exatamente no capítulo 60 (Volume 7). Continue no capítulo 61!",
      ja: "第28話は原作第60話（7巻）まで映像化されています。第61話から続きを読めます。",
    },
  },

  // --- SOLO LEVELING (MANHWA) ---
  {
    anilistIds: [151807],
    sourceKind: "MANHWA",
    endedAtChapter: 45,
    continueAtChapter: 46,
    endedAtVolume: null,
    continueAtVolume: null,
    coveredRange: "Ch. 1 – 45",
    adaptedArc: "Job Change Quest (Igris)",
    isFullyAdapted: false,
    notesByLang: {
      fr: "La saison 1 s'arrête juste après la quête de changement de classe (Ch. 45 du manhwa). Continuez au chapitre 46.",
      en: "Season 1 ends right after the Job Change Quest (Manhwa Ch. 45). Continue at Chapter 46.",
      es: "La temporada 1 termina tras la misión de cambio de clase (Cap. 45 del manhwa). Sigue en el capítulo 46.",
      de: "Staffel 1 endet nach der Klassenwechsel-Quest (Manhwa Kap. 45). Weiter bei Kapitel 46.",
      it: "La stagione 1 si conclude al capitolo 45 del manhwa. Riprendi dal capitolo 46.",
      pt: "A 1ª temporada termina no capítulo 45 do manhwa. Continue no capítulo 46.",
      ja: "第1期はマンファ第45話まで。第46話から続きを読めます。",
    },
  },
  {
    anilistIds: [176496],
    sourceKind: "MANHWA",
    endedAtChapter: 110,
    continueAtChapter: 111,
    endedAtVolume: null,
    continueAtVolume: null,
    coveredRange: "Ch. 46 – 110",
    adaptedArc: "Jeju Island",
    isFullyAdapted: false,
    notesByLang: {
      fr: "La saison 2 (Arise from the Shadow) conclut l'arc de l'Île de Jeju au chapitre 110 du manhwa. Continuez au chapitre 111 !",
      en: "Season 2 (Arise from the Shadow) wraps up the Jeju Island arc at Manhwa Chapter 110. Continue at Chapter 111!",
      es: "La temporada 2 concluye el arco de la Isla Jeju en el capítulo 110 del manhwa. ¡Sigue en el 111!",
      de: "Staffel 2 schließt den Jeju-Insel-Arc bei Manhwa-Kapitel 110 ab. Weiter bei Kapitel 111!",
      it: "La stagione 2 conclude l'arco dell'Isola di Jeju al capitolo 110 del manhwa. Riprendi dal 111!",
      pt: "A 2ª temporada encerra o arco da Ilha Jeju no capítulo 110 do manhwa. Continue no 111!",
      ja: "第2期は架南島編（マンファ第110話）まで。第111話から続きを読めます。",
    },
  },

  // --- JUJUTSU KAISEN ---
  {
    anilistIds: [113415],
    sourceKind: "MANGA",
    endedAtChapter: 63,
    continueAtChapter: 64,
    endedAtVolume: 8,
    continueAtVolume: 8,
    coveredRange: "Ch. 1 – 63",
    adaptedArc: "Death Painting",
    isFullyAdapted: false,
    notesByLang: {
      fr: "La saison 1 couvre les chapitres 1 à 63. Enchaînez avec le chapitre 64 (Tome 8) ou la Saison 2.",
      en: "Season 1 adapts Chapters 1–63. Continue from Chapter 64 (Volume 8) or watch Season 2.",
    },
  },
  {
    anilistIds: [145064],
    sourceKind: "MANGA",
    endedAtChapter: 137,
    continueAtChapter: 138,
    endedAtVolume: 16,
    continueAtVolume: 16,
    coveredRange: "Ch. 65 – 137",
    adaptedArc: "Shibuya Incident",
    isFullyAdapted: false,
    notesByLang: {
      fr: "La fin de l'Incident de Shibuya couvre jusqu'au chapitre 137. Reprenez directement au chapitre 138 (Tome 16).",
      en: "The Shibuya Incident ends at Chapter 137. Pick up directly at Chapter 138 (Volume 16).",
    },
  },
  {
    anilistIds: [131573],
    sourceKind: "MANGA",
    endedAtChapter: 4,
    continueAtChapter: null,
    endedAtVolume: 0,
    continueAtVolume: null,
    coveredRange: "Volume 0 (Ch. 1 – 4)",
    adaptedArc: "Tokyo Metropolitan Curse Technical School",
    isFullyAdapted: true,
    notesByLang: {
      fr: "Le film adapte l'intégralité du Tome 0 (préquelle complète).",
      en: "The movie adapts the entire Volume 0 prequel manga.",
    },
  },

  // --- CHAINSAW MAN ---
  {
    anilistIds: [127230],
    sourceKind: "MANGA",
    endedAtChapter: 38,
    continueAtChapter: 39,
    endedAtVolume: 5,
    continueAtVolume: 5,
    coveredRange: "Ch. 1 – 38",
    adaptedArc: "Katana Man",
    isFullyAdapted: false,
    notesByLang: {
      fr: "La saison 1 s'arrête exactement au chapitre 38. Reprenez au chapitre 39 (Tome 5) pour l'arc Reze !",
      en: "Season 1 finishes right at Chapter 38. Continue at Chapter 39 (Volume 5) for the Bomb Girl arc!",
    },
  },
  {
    anilistIds: [171627],
    sourceKind: "MANGA",
    endedAtChapter: 52,
    continueAtChapter: 53,
    endedAtVolume: 6,
    continueAtVolume: 7,
    coveredRange: "Ch. 39 – 52",
    adaptedArc: "Bomb Girl (Reze)",
    isFullyAdapted: false,
    notesByLang: {
      fr: "Le film Reze Arc couvre les chapitres 39 à 52. Continuez au chapitre 53 (Tome 7).",
      en: "The Reze Arc movie adapts Chapters 39–52. Pick up at Chapter 53 (Volume 7).",
    },
  },

  // --- DEMON SLAYER (KIMETSU NO YAIBA) ---
  {
    anilistIds: [101922],
    sourceKind: "MANGA",
    endedAtChapter: 53,
    continueAtChapter: 54,
    endedAtVolume: 7,
    continueAtVolume: 7,
    coveredRange: "Ch. 1 – 53",
    adaptedArc: "Rehabilitation Training",
    isFullyAdapted: false,
  },
  {
    anilistIds: [112151, 129874],
    sourceKind: "MANGA",
    endedAtChapter: 66,
    continueAtChapter: 67,
    endedAtVolume: 8,
    continueAtVolume: 8,
    coveredRange: "Ch. 54 – 66",
    adaptedArc: "Mugen Train",
    isFullyAdapted: false,
  },
  {
    anilistIds: [142329],
    sourceKind: "MANGA",
    endedAtChapter: 97,
    continueAtChapter: 98,
    endedAtVolume: 11,
    continueAtVolume: 12,
    coveredRange: "Ch. 67 – 97",
    adaptedArc: "Entertainment District",
    isFullyAdapted: false,
  },
  {
    anilistIds: [145139],
    sourceKind: "MANGA",
    endedAtChapter: 127,
    continueAtChapter: 128,
    endedAtVolume: 15,
    continueAtVolume: 15,
    coveredRange: "Ch. 98 – 127",
    adaptedArc: "Swordsmith Village",
    isFullyAdapted: false,
  },
  {
    anilistIds: [166240],
    sourceKind: "MANGA",
    endedAtChapter: 139,
    continueAtChapter: 140,
    endedAtVolume: 16,
    continueAtVolume: 16,
    coveredRange: "Ch. 128 – 139",
    adaptedArc: "Hashira Training",
    isFullyAdapted: false,
    notesByLang: {
      fr: "L'Entraînement des Piliers se termine à l'entrée de la Forteresse Infinie (Ch. 139). Continuez au chapitre 140 (Tome 16) !",
      en: "Hashira Training ends right at the Infinity Castle drop (Ch. 139). Continue at Chapter 140 (Volume 16)!",
    },
  },

  // --- DANDADAN ---
  {
    anilistIds: [171018],
    sourceKind: "MANGA",
    endedAtChapter: 33,
    continueAtChapter: 34,
    endedAtVolume: 5,
    continueAtVolume: 5,
    coveredRange: "Ch. 1 – 33",
    adaptedArc: "Cursed House (Part 1)",
    isFullyAdapted: false,
    notesByLang: {
      fr: "La saison 1 s'arrête sur le cliffhanger du chapitre 33. Reprenez directement au chapitre 34 (Tome 5).",
      en: "Season 1 ends on the Chapter 33 cliffhanger. Continue directly at Chapter 34 (Volume 5).",
    },
  },
  {
    anilistIds: [185660],
    sourceKind: "MANGA",
    endedAtChapter: 71,
    continueAtChapter: 72,
    endedAtVolume: 9,
    continueAtVolume: 9,
    coveredRange: "Ch. 34 – 71",
    adaptedArc: "Evil Eye & Kaiju",
    isFullyAdapted: false,
  },

  // --- KAIJU NO. 8 ---
  {
    anilistIds: [153288],
    sourceKind: "MANGA",
    endedAtChapter: 38,
    continueAtChapter: 39,
    endedAtVolume: 5,
    continueAtVolume: 5,
    coveredRange: "Ch. 1 – 38",
    adaptedArc: "Kafka Captured",
    isFullyAdapted: false,
  },

  // --- SAKAMOTO DAYS ---
  {
    anilistIds: [177709],
    sourceKind: "MANGA",
    endedAtChapter: 37,
    continueAtChapter: 38,
    endedAtVolume: 5,
    continueAtVolume: 5,
    coveredRange: "Ch. 1 – 37",
    adaptedArc: "Lab Arc",
    isFullyAdapted: false,
  },

  // --- BLUE LOCK ---
  {
    anilistIds: [137822],
    sourceKind: "MANGA",
    endedAtChapter: 94,
    continueAtChapter: 95,
    endedAtVolume: 11,
    continueAtVolume: 11,
    coveredRange: "Ch. 1 – 94",
    adaptedArc: "Second Selection",
    isFullyAdapted: false,
  },
  {
    anilistIds: [163146],
    sourceKind: "MANGA",
    endedAtChapter: 149,
    continueAtChapter: 150,
    endedAtVolume: 18,
    continueAtVolume: 18,
    coveredRange: "Ch. 95 – 149",
    adaptedArc: "Japan U-20 Match",
    isFullyAdapted: false,
  },

  // --- VINLAND SAGA ---
  {
    anilistIds: [101348],
    sourceKind: "MANGA",
    endedAtChapter: 54,
    continueAtChapter: 55,
    endedAtVolume: 8,
    continueAtVolume: 8,
    coveredRange: "Ch. 1 – 54",
    adaptedArc: "Prologue (War Arc)",
    isFullyAdapted: false,
  },
  {
    anilistIds: [136430],
    sourceKind: "MANGA",
    endedAtChapter: 100,
    continueAtChapter: 101,
    endedAtVolume: 14,
    continueAtVolume: 15,
    coveredRange: "Ch. 55 – 100",
    adaptedArc: "Slave / Farmland Arc",
    isFullyAdapted: false,
    notesByLang: {
      fr: "La saison 2 clôt l'arc de la Ferme au chapitre 100. Continuez au chapitre 101 (Tome 15) pour l'expédition de la Baltique.",
      en: "Season 2 concludes the Farmland Arc at Chapter 100. Continue at Chapter 101 (Volume 15).",
    },
  },

  // --- ONE PUNCH MAN ---
  {
    anilistIds: [21087],
    sourceKind: "MANGA",
    endedAtChapter: 37,
    continueAtChapter: 38,
    endedAtVolume: 7,
    continueAtVolume: 8,
    coveredRange: "Ch. 1 – 37",
    adaptedArc: "Alien Conquerors (Boros)",
    isFullyAdapted: false,
  },
  {
    anilistIds: [97668],
    sourceKind: "MANGA",
    endedAtChapter: 84,
    continueAtChapter: 85,
    endedAtVolume: 17,
    continueAtVolume: 17,
    coveredRange: "Ch. 38 – 84",
    adaptedArc: "Hero Hunter / Elder Centipede",
    isFullyAdapted: false,
  },

  // --- HUNTER X HUNTER (2011) ---
  {
    anilistIds: [11061],
    sourceKind: "MANGA",
    endedAtChapter: 339,
    continueAtChapter: 340,
    endedAtVolume: 32,
    continueAtVolume: 32,
    coveredRange: "Ch. 1 – 339",
    adaptedArc: "13th Hunter Chairman Election",
    isFullyAdapted: false,
    notesByLang: {
      fr: "L'épisode 148 termine exactement au chapitre 339. L'arc du Continent Caché débute au chapitre 340 (Tome 32).",
      en: "Episode 148 ends cleanly at Chapter 339. The Dark Continent Expedition begins at Chapter 340 (Volume 32).",
    },
  },

  // --- SPY X FAMILY ---
  {
    anilistIds: [140960],
    sourceKind: "MANGA",
    endedAtChapter: 17,
    continueAtChapter: 18,
    endedAtVolume: 3,
    continueAtVolume: 4,
    coveredRange: "Ch. 1 – 17",
    adaptedArc: "Eden Academy Enrollment",
    isFullyAdapted: false,
  },
  {
    anilistIds: [142838],
    sourceKind: "MANGA",
    endedAtChapter: 37,
    continueAtChapter: 38,
    endedAtVolume: 6,
    continueAtVolume: 6,
    coveredRange: "Ch. 18 – 37",
    adaptedArc: "Doggy Crisis & Tennis",
    isFullyAdapted: false,
  },
  {
    anilistIds: [158927],
    sourceKind: "MANGA",
    endedAtChapter: 59,
    continueAtChapter: 60,
    endedAtVolume: 9,
    continueAtVolume: 9,
    coveredRange: "Ch. 38 – 59",
    adaptedArc: "Cruise Adventure",
    isFullyAdapted: false,
  },

  // --- OSHI NO KO ---
  {
    anilistIds: [150672],
    sourceKind: "MANGA",
    endedAtChapter: 40,
    continueAtChapter: 41,
    endedAtVolume: 4,
    continueAtVolume: 5,
    coveredRange: "Ch. 1 – 40",
    adaptedArc: "First Concert",
    isFullyAdapted: false,
  },
  {
    anilistIds: [166531],
    sourceKind: "MANGA",
    endedAtChapter: 80,
    continueAtChapter: 81,
    endedAtVolume: 8,
    continueAtVolume: 9,
    coveredRange: "Ch. 41 – 80",
    adaptedArc: "2.5D Stage Play & Private",
    isFullyAdapted: false,
  },

  // --- BOCCHI THE ROCK & ROMCOMS ---
  {
    anilistIds: [130003],
    sourceKind: "MANGA",
    endedAtChapter: 21,
    continueAtChapter: 22,
    endedAtVolume: 2,
    continueAtVolume: 2,
    coveredRange: "Ch. 1 – 21",
    adaptedArc: "School Cultural Festival",
    isFullyAdapted: false,
  },
  {
    anilistIds: [132405],
    sourceKind: "MANGA",
    endedAtChapter: 39,
    continueAtChapter: 40,
    endedAtVolume: 5,
    continueAtVolume: 5,
    coveredRange: "Ch. 1 – 39",
    adaptedArc: "Summer Festival",
    isFullyAdapted: false,
  },
  {
    anilistIds: [170942],
    sourceKind: "MANGA",
    endedAtChapter: 80,
    continueAtChapter: 81,
    endedAtVolume: 10,
    continueAtVolume: 10,
    coveredRange: "Ch. 1 – 80",
    adaptedArc: "Autumn Training & Cultural Festival",
    isFullyAdapted: false,
  },

  // --- MANHWA ADAPTATIONS ---
  {
    anilistIds: [115230],
    sourceKind: "MANHWA",
    endedAtChapter: 78,
    continueAtChapter: 79,
    endedAtVolume: null,
    continueAtVolume: null,
    coveredRange: "Saison 1 (Ch. 0 – 78)",
    adaptedArc: "Floor of Tests",
    isFullyAdapted: false,
    notesByLang: {
      fr: "La saison 1 adapte toute la Partie 1 du webtoon Tower of God (Ch. 0–78). Reprenez au début de la Saison 2 du manhwa (Ch. 79 / S2 Ep. 0).",
      en: "Season 1 adapts all of Tower of God Part 1 (Ch. 0–78). Continue at Season 2 Episode 0 (Ch. 79) on WEBTOON.",
    },
  },
  {
    anilistIds: [153406],
    sourceKind: "MANHWA",
    endedAtChapter: 190,
    continueAtChapter: 191,
    endedAtVolume: null,
    continueAtVolume: null,
    coveredRange: "S2 Ch. 0 – 110 (Global Ch. 79 – 190)",
    adaptedArc: "Return of the Prince & Workshop Battle",
    isFullyAdapted: false,
    notesByLang: {
      fr: "La saison 2 couvre jusqu'à la fin de la Bataille de l'Atelier (S2 Ep. 110). Continuez au début de l'arc Hell Train (S2 Ep. 111).",
      en: "Season 2 finishes the Workshop Battle (S2 Ep. 110). Continue at the start of the Hell Train arc (S2 Ep. 111).",
    },
  },
  {
    anilistIds: [116006],
    sourceKind: "MANHWA",
    endedAtChapter: 112,
    continueAtChapter: 113,
    endedAtVolume: null,
    continueAtVolume: null,
    coveredRange: "Ch. 1 – 112",
    adaptedArc: "National Competition",
    isFullyAdapted: false,
    notesByLang: {
      fr: "L'anime condense 112 chapitres du manhwa en 13 épisodes. Vous pouvez reprendre au Ch. 113, ou relire dès le Ch. 1 pour tous les détails.",
      en: "The anime condenses 112 manhwa chapters into 13 episodes. Resume at Ch. 113 (or start from Ch. 1 for full context).",
    },
  },
  {
    anilistIds: [163142],
    sourceKind: "MANHWA",
    endedAtChapter: 45,
    continueAtChapter: 46,
    endedAtVolume: null,
    continueAtVolume: null,
    coveredRange: "Ch. 1 – 45",
    adaptedArc: "Shadow World & Ranking Exam",
    isFullyAdapted: false,
  },
  {
    anilistIds: [158530],
    sourceKind: "MANHWA",
    endedAtChapter: 27,
    continueAtChapter: 28,
    endedAtVolume: null,
    continueAtVolume: null,
    coveredRange: "Ch. 1 – 27",
    adaptedArc: "School Festival",
    isFullyAdapted: false,
  },
  {
    anilistIds: [151847],
    sourceKind: "MANHWA",
    endedAtChapter: 50,
    continueAtChapter: 51,
    endedAtVolume: null,
    continueAtVolume: null,
    coveredRange: "Ch. 1 – 50",
    adaptedArc: "Temple & Contract Engagement",
    isFullyAdapted: false,
  },
  {
    anilistIds: [162144],
    sourceKind: "MANHWA",
    endedAtChapter: 50,
    continueAtChapter: 51,
    endedAtVolume: null,
    continueAtVolume: null,
    coveredRange: "Ch. 1 – 50",
    adaptedArc: "Crimean War Prelude",
    isFullyAdapted: false,
  },

  // --- SHONEN CLASSICS & BIG FRANCHISES ---
  {
    anilistIds: [21],
    sourceKind: "MANGA",
    endedAtChapter: 1088,
    continueAtChapter: 1089,
    endedAtVolume: 107,
    continueAtVolume: 108,
    coveredRange: "Ch. 1 – 1088+ (en cours)",
    adaptedArc: "Egghead Island",
    isFullyAdapted: false,
    isOngoingAdaptation: true,
    liveAnchor: {
      anchorEpisode: 1122,
      anchorChapter: 1088,
      chaptersPerEpisode: 0.92,
      chaptersPerVolume: 10,
    },
    notesByLang: {
      fr: "Synchronisé en temps réel avec les derniers épisodes diffusés de One Piece.",
      en: "Synced in real time with the latest aired One Piece episodes.",
    },
  },
  {
    anilistIds: [97940],
    sourceKind: "MANGA",
    endedAtChapter: 270,
    continueAtChapter: 271,
    endedAtVolume: 27,
    continueAtVolume: 27,
    coveredRange: "Ch. 1 – 270",
    adaptedArc: "Spade Kingdom Raid (Prelude)",
    isFullyAdapted: false,
    notesByLang: {
      fr: "L'épisode 170 s'arrête exactement au chapitre 270. Reprenez directement au chapitre 271 (Tome 27) !",
      en: "Episode 170 ends cleanly at Chapter 270. Pick up at Chapter 271 (Volume 27)!",
    },
  },
  {
    anilistIds: [269],
    sourceKind: "MANGA",
    endedAtChapter: 479,
    continueAtChapter: 480,
    endedAtVolume: 54,
    continueAtVolume: 55,
    coveredRange: "Ch. 1 – 479",
    adaptedArc: "Fullbring Arc",
    isFullyAdapted: false,
    notesByLang: {
      fr: "La série originale Bleach s'arrête au chapitre 479. L'arc Thousand-Year Blood War commence au chapitre 480 (Tome 55).",
      en: "Original Bleach ends at Chapter 479. The Thousand-Year Blood War begins at Chapter 480 (Volume 55).",
    },
  },
  {
    anilistIds: [116674],
    sourceKind: "MANGA",
    endedAtChapter: 542,
    continueAtChapter: 543,
    endedAtVolume: 61,
    continueAtVolume: 61,
    coveredRange: "Ch. 480 – 542",
    adaptedArc: "TYBW — The Blood Warfare",
    isFullyAdapted: false,
  },
  {
    anilistIds: [159322],
    sourceKind: "MANGA",
    endedAtChapter: 609,
    continueAtChapter: 610,
    endedAtVolume: 67,
    continueAtVolume: 67,
    coveredRange: "Ch. 543 – 609",
    adaptedArc: "TYBW — The Separation",
    isFullyAdapted: false,
  },
  {
    anilistIds: [169755],
    sourceKind: "MANGA",
    endedAtChapter: 661,
    continueAtChapter: 662,
    endedAtVolume: 72,
    continueAtVolume: 72,
    coveredRange: "Ch. 610 – 661",
    adaptedArc: "TYBW — The Conflict",
    isFullyAdapted: false,
  },
  {
    anilistIds: [20],
    sourceKind: "MANGA",
    endedAtChapter: 238,
    continueAtChapter: 239,
    endedAtVolume: 27,
    continueAtVolume: 27,
    coveredRange: "Ch. 1 – 238",
    adaptedArc: "Sasuke Recovery Mission",
    isFullyAdapted: false,
    notesByLang: {
      fr: "Les épisodes 136–219 sont majoritairement des fillers. Le manga reprend au Ch. 239 (Kakashi Gaiden) puis Ch. 245 (Shippuden).",
      en: "Episodes 136–219 are mostly filler. Continue the manga at Ch. 239 (Kakashi Gaiden) or Ch. 245 (Shippuden).",
    },
  },
  {
    anilistIds: [1735],
    sourceKind: "MANGA",
    endedAtChapter: 700,
    continueAtChapter: null,
    endedAtVolume: 72,
    continueAtVolume: null,
    coveredRange: "Ch. 245 – 700",
    adaptedArc: "Complete Series",
    isFullyAdapted: true,
    notesByLang: {
      fr: "Tout le manga Naruto est adapté (chapitre 700 adapté dans Boruto / OAV). Vous pouvez poursuivre avec Boruto.",
      en: "The full Naruto manga is adapted. You can continue with the Boruto sequel.",
    },
  },

  // --- ATTACK ON TITAN ---
  {
    anilistIds: [16498],
    sourceKind: "MANGA",
    endedAtChapter: 33,
    continueAtChapter: 34,
    endedAtVolume: 8,
    continueAtVolume: 8,
    coveredRange: "Ch. 1 – 33",
    adaptedArc: "Female Titan",
    isFullyAdapted: false,
  },
  {
    anilistIds: [20958],
    sourceKind: "MANGA",
    endedAtChapter: 50,
    continueAtChapter: 51,
    endedAtVolume: 12,
    continueAtVolume: 13,
    coveredRange: "Ch. 34 – 50",
    adaptedArc: "Clash of the Titans",
    isFullyAdapted: false,
  },
  {
    anilistIds: [99147],
    sourceKind: "MANGA",
    endedAtChapter: 72,
    continueAtChapter: 73,
    endedAtVolume: 18,
    continueAtVolume: 18,
    coveredRange: "Ch. 51 – 72",
    adaptedArc: "Royal Government",
    isFullyAdapted: false,
  },
  {
    anilistIds: [104578],
    sourceKind: "MANGA",
    endedAtChapter: 90,
    continueAtChapter: 91,
    endedAtVolume: 22,
    continueAtVolume: 23,
    coveredRange: "Ch. 73 – 90",
    adaptedArc: "Return to Shiganshina",
    isFullyAdapted: false,
  },
  {
    anilistIds: [110277],
    sourceKind: "MANGA",
    endedAtChapter: 116,
    continueAtChapter: 117,
    endedAtVolume: 29,
    continueAtVolume: 29,
    coveredRange: "Ch. 91 – 116",
    adaptedArc: "Marley & War for Paradis (Part 1)",
    isFullyAdapted: false,
  },
  {
    anilistIds: [131681],
    sourceKind: "MANGA",
    endedAtChapter: 130,
    continueAtChapter: 131,
    endedAtVolume: 32,
    continueAtVolume: 33,
    coveredRange: "Ch. 117 – 130",
    adaptedArc: "The Rumbling",
    isFullyAdapted: false,
  },
  {
    anilistIds: [146984, 162314],
    sourceKind: "MANGA",
    endedAtChapter: 139,
    continueAtChapter: null,
    endedAtVolume: 34,
    continueAtVolume: null,
    coveredRange: "Ch. 131 – 139",
    adaptedArc: "The Final Chapters",
    isFullyAdapted: true,
    notesByLang: {
      fr: "Adaptation intégrale jusqu'au chapitre final 139 (Tome 34) avec scènes étendues supervisées par Hajime Isayama.",
      en: "Complete adaptation through the final Chapter 139 (Volume 34).",
    },
  },

  // --- MY HERO ACADEMIA ---
  {
    anilistIds: [21459],
    sourceKind: "MANGA",
    endedAtChapter: 21,
    continueAtChapter: 22,
    endedAtVolume: 3,
    continueAtVolume: 3,
    coveredRange: "Ch. 1 – 21",
    adaptedArc: "U.S.J. Arc",
    isFullyAdapted: false,
  },
  {
    anilistIds: [21856],
    sourceKind: "MANGA",
    endedAtChapter: 69,
    continueAtChapter: 70,
    endedAtVolume: 8,
    continueAtVolume: 8,
    coveredRange: "Ch. 22 – 69",
    adaptedArc: "Sports Festival & Stain",
    isFullyAdapted: false,
  },
  {
    anilistIds: [100166],
    sourceKind: "MANGA",
    endedAtChapter: 124,
    continueAtChapter: 125,
    endedAtVolume: 14,
    continueAtVolume: 14,
    coveredRange: "Ch. 70 – 124",
    adaptedArc: "Kamino & Provisional License",
    isFullyAdapted: false,
  },
  {
    anilistIds: [104276],
    sourceKind: "MANGA",
    endedAtChapter: 190,
    continueAtChapter: 191,
    endedAtVolume: 21,
    continueAtVolume: 21,
    coveredRange: "Ch. 125 – 190",
    adaptedArc: "Shie Hassaikai & School Festival",
    isFullyAdapted: false,
  },
  {
    anilistIds: [117193],
    sourceKind: "MANGA",
    endedAtChapter: 257,
    continueAtChapter: 258,
    endedAtVolume: 26,
    continueAtVolume: 26,
    coveredRange: "Ch. 191 – 257",
    adaptedArc: "Meta Liberation Army",
    isFullyAdapted: false,
  },
  {
    anilistIds: [139630],
    sourceKind: "MANGA",
    endedAtChapter: 328,
    continueAtChapter: 329,
    endedAtVolume: 33,
    continueAtVolume: 34,
    coveredRange: "Ch. 258 – 328",
    adaptedArc: "Paranormal Liberation War & Dark Hero",
    isFullyAdapted: false,
  },
  {
    anilistIds: [163139],
    sourceKind: "MANGA",
    endedAtChapter: 398,
    continueAtChapter: 399,
    endedAtVolume: 40,
    continueAtVolume: 40,
    coveredRange: "Ch. 329 – 398",
    adaptedArc: "Final War (Part 1)",
    isFullyAdapted: false,
  },

  // --- DR. STONE, HAIKYUU, KAGUYA, ETC. ---
  {
    anilistIds: [105333],
    sourceKind: "MANGA",
    endedAtChapter: 60,
    continueAtChapter: 61,
    endedAtVolume: 7,
    continueAtVolume: 7,
    coveredRange: "Ch. 1 – 60",
    adaptedArc: "Kingdom of Science",
    isFullyAdapted: false,
  },
  {
    anilistIds: [113936],
    sourceKind: "MANGA",
    endedAtChapter: 83,
    continueAtChapter: 84,
    endedAtVolume: 10,
    continueAtVolume: 10,
    coveredRange: "Ch. 61 – 83",
    adaptedArc: "Stone Wars",
    isFullyAdapted: false,
  },
  {
    anilistIds: [131518, 162670],
    sourceKind: "MANGA",
    endedAtChapter: 142,
    continueAtChapter: 143,
    endedAtVolume: 17,
    continueAtVolume: 17,
    coveredRange: "Ch. 84 – 142",
    adaptedArc: "Treasure Island",
    isFullyAdapted: false,
  },
  {
    anilistIds: [20464],
    sourceKind: "MANGA",
    endedAtChapter: 71,
    continueAtChapter: 72,
    endedAtVolume: 8,
    continueAtVolume: 9,
    coveredRange: "Ch. 1 – 71",
    adaptedArc: "Interhigh Preliminaries",
    isFullyAdapted: false,
  },
  {
    anilistIds: [20992],
    sourceKind: "MANGA",
    endedAtChapter: 149,
    continueAtChapter: 150,
    endedAtVolume: 17,
    continueAtVolume: 17,
    coveredRange: "Ch. 72 – 149",
    adaptedArc: "Tokyo Training Camp & Spring Preliminaries",
    isFullyAdapted: false,
  },
  {
    anilistIds: [21698],
    sourceKind: "MANGA",
    endedAtChapter: 190,
    continueAtChapter: 191,
    endedAtVolume: 21,
    continueAtVolume: 22,
    coveredRange: "Ch. 150 – 190",
    adaptedArc: "Karasuno vs Shiratorizawa",
    isFullyAdapted: false,
  },
  {
    anilistIds: [106625, 113538],
    sourceKind: "MANGA",
    endedAtChapter: 292,
    continueAtChapter: 293,
    endedAtVolume: 33,
    continueAtVolume: 33,
    coveredRange: "Ch. 191 – 292",
    adaptedArc: "To The Top (Inarizaki Match)",
    isFullyAdapted: false,
  },
  {
    anilistIds: [153800],
    sourceKind: "MANGA",
    endedAtChapter: 325,
    continueAtChapter: 326,
    endedAtVolume: 37,
    continueAtVolume: 37,
    coveredRange: "Ch. 293 – 325",
    adaptedArc: "Battle of the Garbage Dump",
    isFullyAdapted: false,
  },
  {
    anilistIds: [101921],
    sourceKind: "MANGA",
    endedAtChapter: 45,
    continueAtChapter: 46,
    endedAtVolume: 5,
    continueAtVolume: 5,
    coveredRange: "Ch. 1 – 45",
    adaptedArc: "Summer Fireworks",
    isFullyAdapted: false,
  },
  {
    anilistIds: [112641],
    sourceKind: "MANGA",
    endedAtChapter: 91,
    continueAtChapter: 92,
    endedAtVolume: 9,
    continueAtVolume: 10,
    coveredRange: "Ch. 46 – 91",
    adaptedArc: "Sports Festival",
    isFullyAdapted: false,
  },
  {
    anilistIds: [125367],
    sourceKind: "MANGA",
    endedAtChapter: 137,
    continueAtChapter: 138,
    endedAtVolume: 14,
    continueAtVolume: 14,
    coveredRange: "Ch. 92 – 137",
    adaptedArc: "Ultra Romantic (Cultural Festival)",
    isFullyAdapted: false,
  },
  {
    anilistIds: [151384],
    sourceKind: "MANGA",
    endedAtChapter: 151,
    continueAtChapter: 152,
    endedAtVolume: 15,
    continueAtVolume: 16,
    coveredRange: "Ch. 138 – 151",
    adaptedArc: "The First Kiss That Never Ends",
    isFullyAdapted: false,
  },

  // --- MODERN HITS & ACCLAIMED ADAPTATIONS ---
  {
    anilistIds: [128893],
    sourceKind: "MANGA",
    endedAtChapter: 44,
    continueAtChapter: 45,
    endedAtVolume: 5,
    continueAtVolume: 5,
    coveredRange: "Ch. 1 – 44",
    adaptedArc: "Lord Tensen",
    isFullyAdapted: false,
  },
  {
    anilistIds: [151970],
    sourceKind: "MANGA",
    endedAtChapter: 58,
    continueAtChapter: 59,
    endedAtVolume: 6,
    continueAtVolume: 7,
    coveredRange: "Ch. 1 – 58",
    adaptedArc: "Wezaemon the Tombguard",
    isFullyAdapted: false,
  },
  {
    anilistIds: [176508],
    sourceKind: "MANGA",
    endedAtChapter: 125,
    continueAtChapter: 126,
    endedAtVolume: 13,
    continueAtVolume: 13,
    coveredRange: "Ch. 59 – 125",
    adaptedArc: "Ctarnidd of the Abyss (Part 1)",
    isFullyAdapted: false,
  },
  {
    anilistIds: [163270],
    sourceKind: "MANGA",
    endedAtChapter: 41,
    continueAtChapter: 42,
    endedAtVolume: 6,
    continueAtVolume: 6,
    coveredRange: "Ch. 1 – 41",
    adaptedArc: "Shishitoren",
    isFullyAdapted: false,
  },
  {
    anilistIds: [151801],
    sourceKind: "MANGA",
    endedAtChapter: 38,
    continueAtChapter: 39,
    endedAtVolume: 5,
    continueAtVolume: 5,
    coveredRange: "Ch. 1 – 38",
    adaptedArc: "Magia Lupus",
    isFullyAdapted: false,
  },
  {
    anilistIds: [166610],
    sourceKind: "MANGA",
    endedAtChapter: 74,
    continueAtChapter: 75,
    endedAtVolume: 9,
    continueAtVolume: 9,
    coveredRange: "Ch. 39 – 74",
    adaptedArc: "Divine Visionary Selection",
    isFullyAdapted: false,
  },
  {
    anilistIds: [153518],
    sourceKind: "MANGA",
    endedAtChapter: 52,
    continueAtChapter: 53,
    endedAtVolume: 8,
    continueAtVolume: 8,
    coveredRange: "Ch. 1 – 52",
    adaptedArc: "Golden Country",
    isFullyAdapted: false,
  },
  {
    anilistIds: [161645],
    sourceKind: "MANGA",
    endedAtChapter: 40,
    continueAtChapter: 41,
    endedAtVolume: 8,
    continueAtVolume: 8,
    coveredRange: "Manga Ch. 1 – 40 (LN Vol. 1 – 2)",
    adaptedArc: "Rear Palace & Lakan",
    isFullyAdapted: false,
    notesByLang: {
      fr: "Saison 1 = Chapitre 40 du manga (Nekokurage) et Tome 2 du Light Novel. Continuez au chapitre 41 du manga ou Tome 3 du LN.",
      en: "Season 1 finishes at Manga Chapter 40 (Nekokurage) and Light Novel Volume 2. Resume at Ch. 41 or LN Vol. 3.",
    },
  },
  {
    anilistIds: [120120],
    sourceKind: "MANGA",
    endedAtChapter: 73,
    continueAtChapter: 74,
    endedAtVolume: 9,
    continueAtVolume: 9,
    coveredRange: "Ch. 1 – 73",
    adaptedArc: "Bloody Halloween",
    isFullyAdapted: false,
  },
  {
    anilistIds: [142853],
    sourceKind: "MANGA",
    endedAtChapter: 125,
    continueAtChapter: 126,
    endedAtVolume: 14,
    continueAtVolume: 14,
    coveredRange: "Ch. 74 – 125",
    adaptedArc: "Christmas Showdown",
    isFullyAdapted: false,
  },
  {
    anilistIds: [163329],
    sourceKind: "MANGA",
    endedAtChapter: 185,
    continueAtChapter: 186,
    endedAtVolume: 21,
    continueAtVolume: 21,
    coveredRange: "Ch. 126 – 185",
    adaptedArc: "Tenjiku Arc",
    isFullyAdapted: false,
  },
  {
    anilistIds: [105310],
    sourceKind: "MANGA",
    endedAtChapter: 90,
    continueAtChapter: 91,
    endedAtVolume: 11,
    continueAtVolume: 11,
    coveredRange: "Ch. 1 – 90",
    adaptedArc: "Nether",
    isFullyAdapted: false,
  },
  {
    anilistIds: [114236],
    sourceKind: "MANGA",
    endedAtChapter: 174,
    continueAtChapter: 175,
    endedAtVolume: 20,
    continueAtVolume: 20,
    coveredRange: "Ch. 91 – 174",
    adaptedArc: "Joint Investigation",
    isFullyAdapted: false,
  },
  {
    anilistIds: [97986],
    sourceKind: "MANGA",
    endedAtChapter: 26,
    continueAtChapter: 27,
    endedAtVolume: 3,
    continueAtVolume: 4,
    coveredRange: "Ch. 1 – 26",
    adaptedArc: "4th Layer — Goblets of Giants",
    isFullyAdapted: false,
  },
  {
    anilistIds: [100643],
    sourceKind: "MANGA",
    endedAtChapter: 38,
    continueAtChapter: 39,
    endedAtVolume: 5,
    continueAtVolume: 6,
    coveredRange: "Ch. 27 – 38",
    adaptedArc: "Ido Front (Bondrewd)",
    isFullyAdapted: false,
  },
  {
    anilistIds: [114745],
    sourceKind: "MANGA",
    endedAtChapter: 60,
    continueAtChapter: 61,
    endedAtVolume: 10,
    continueAtVolume: 10,
    coveredRange: "Ch. 39 – 60",
    adaptedArc: "The Golden City of the Scorching Sun",
    isFullyAdapted: false,
  },
  {
    anilistIds: [101759],
    sourceKind: "MANGA",
    endedAtChapter: 37,
    continueAtChapter: 38,
    endedAtVolume: 5,
    continueAtVolume: 5,
    coveredRange: "Ch. 1 – 37",
    adaptedArc: "Grace Field Escape",
    isFullyAdapted: false,
    notesByLang: {
      fr: "La saison 2 de l'anime coupe plusieurs arcs majeurs (dont Goldy Pond). Reprenez directement au chapitre 38 après la Saison 1 !",
      en: "Anime Season 2 skips major manga arcs (including Goldy Pond). Highly recommended to continue at Chapter 38 right after Season 1!",
    },
  },
  {
    anilistIds: [163263],
    sourceKind: "MANGA",
    endedAtChapter: 113,
    continueAtChapter: 114,
    endedAtVolume: 25,
    continueAtVolume: 25,
    coveredRange: "Ch. 102 – 113",
    adaptedArc: "Decay of the Angel",
    isFullyAdapted: false,
  },
  {
    anilistIds: [33],
    sourceKind: "MANGA",
    endedAtChapter: 87,
    continueAtChapter: 88,
    endedAtVolume: 13,
    continueAtVolume: 13,
    coveredRange: "Golden Age (Vol. 3 – 13)",
    adaptedArc: "Golden Age & Eclipse",
    isFullyAdapted: false,
    notesByLang: {
      fr: "L'anime de 1997 omet le Chevalier Squelette et certains passages clés. Reprenez au Ch. 88 ou lisez depuis le Tome 1 pour l'expérience complète.",
      en: "The 1997 anime omits Skull Knight and key Black Swordsman scenes. Resume at Ch. 88 or read from Volume 1 for full context.",
    },
  },
  {
    anilistIds: [877],
    sourceKind: "MANGA",
    endedAtChapter: 42,
    continueAtChapter: 43,
    endedAtVolume: 12,
    continueAtVolume: 12,
    coveredRange: "Ch. 1 – 42",
    adaptedArc: "Trapnest & Blast",
    isFullyAdapted: false,
  },
  {
    anilistIds: [21128],
    sourceKind: "MANGA",
    endedAtChapter: 39,
    continueAtChapter: 40,
    endedAtVolume: 10,
    continueAtVolume: 11,
    coveredRange: "Ch. 13 – 39",
    adaptedArc: "Bishamon & Ebisu",
    isFullyAdapted: false,
  },
  {
    anilistIds: [1818],
    sourceKind: "MANGA",
    endedAtChapter: 60,
    continueAtChapter: 61,
    endedAtVolume: 11,
    continueAtVolume: 11,
    coveredRange: "Ch. 1 – 60 (fin originale en anime)",
    adaptedArc: "Northern Campaign",
    isFullyAdapted: false,
    notesByLang: {
      fr: "Les 2 derniers épisodes ont une fin originale. Reprenez au chapitre 60/61 (Tome 11) pour la vraie suite du manga !",
      en: "The final 2 episodes diverge with an anime-original ending. Pick up at Chapter 60/61 (Volume 11) for the canon story!",
    },
  },

  // --- FULLY ADAPTED CLASSICS ---
  {
    anilistIds: [5114],
    sourceKind: "MANGA",
    endedAtChapter: 108,
    continueAtChapter: null,
    endedAtVolume: 27,
    continueAtVolume: null,
    coveredRange: "Ch. 1 – 108",
    adaptedArc: "Complete Manga",
    isFullyAdapted: true,
    notesByLang: {
      fr: "Fullmetal Alchemist: Brotherhood adapte intégralement les 27 tomes (108 chapitres) du manga jusqu'à sa vraie fin.",
      en: "Fullmetal Alchemist: Brotherhood faithfully adapts all 27 volumes (108 chapters) through the true ending.",
    },
  },
  {
    anilistIds: [1535],
    sourceKind: "MANGA",
    endedAtChapter: 108,
    continueAtChapter: null,
    endedAtVolume: 12,
    continueAtVolume: null,
    coveredRange: "Ch. 1 – 108",
    adaptedArc: "Complete Manga",
    isFullyAdapted: true,
  },
  {
    anilistIds: [19],
    sourceKind: "MANGA",
    endedAtChapter: 162,
    continueAtChapter: null,
    endedAtVolume: 18,
    continueAtVolume: null,
    coveredRange: "Ch. 1 – 162",
    adaptedArc: "Complete Manga",
    isFullyAdapted: true,
  },
  {
    anilistIds: [140439],
    sourceKind: "MANGA",
    endedAtChapter: 101,
    continueAtChapter: null,
    endedAtVolume: 16,
    continueAtVolume: null,
    coveredRange: "Ch. 92 – 101",
    adaptedArc: "Complete Manga Finale",
    isFullyAdapted: true,
  },
  {
    anilistIds: [124080],
    sourceKind: "MANGA",
    endedAtChapter: 122,
    continueAtChapter: null,
    endedAtVolume: 16,
    continueAtVolume: null,
    coveredRange: "Ch. 1 – 122 (histoire principale)",
    adaptedArc: "Complete Main Story",
    isFullyAdapted: true,
    notesByLang: {
      fr: "L'anime couvre l'histoire principale jusqu'au final. Horimiya: The Missing Pieces adapte les chapitres comiques omis.",
      en: "Covers the complete main story through graduation. Watch Horimiya: The Missing Pieces for skipped slice-of-life chapters.",
    },
  },
];

// Fast O(1) index by AniList ID
const CURATED_BY_ID = new Map<number, CuratedContinuationEntry>();
for (const entry of CURATED_CONTINUATIONS) {
  for (const id of entry.anilistIds) {
    CURATED_BY_ID.set(id, entry);
  }
}

export function detectSourceMediumKind(
  source: string | null | undefined,
  sourceRelation?: MediaRelation["media"] | null
): SourceMediumKind {
  const country = sourceRelation?.countryOfOrigin?.toUpperCase() ?? null;
  if (country === "KR") return "MANHWA";
  if (country === "CN" || country === "TW") return "MANHUA";

  if (sourceRelation?.format === "NOVEL" || source === "LIGHT_NOVEL") {
    return "NOVEL";
  }
  if (source === "WEB_NOVEL") {
    return "WEB_NOVEL";
  }
  return "MANGA";
}

/**
 * Picks the best source Manga / Manhwa / Manhua / Light Novel relation for an anime.
 * Prefers `SOURCE` relation first, falling back to `ADAPTATION` of type MANGA (common for some webtoons/novels).
 */
export function findSourceMangaRelation(
  relations: readonly MediaRelation[] | undefined,
  animeSource?: string | null
): MediaRelation["media"] | null {
  if (!relations || relations.length === 0) return null;

  const mangaSources = relations.filter(
    (r) => r.relationType === "SOURCE" && r.media.type === "MANGA"
  );
  if (mangaSources.length > 0) {
    // If adapted from Manga/Manhwa/Comic, prefer non-NOVEL source first
    if (animeSource !== "LIGHT_NOVEL" && animeSource !== "WEB_NOVEL") {
      const nonNovel = mangaSources.find((r) => r.media.format !== "NOVEL");
      if (nonNovel) return nonNovel.media;
    }
    return mangaSources[0].media;
  }

  // Some webtoon / LN anime list the manhwa/manga under ADAPTATION
  const mangaAdaptations = relations.filter(
    (r) => r.relationType === "ADAPTATION" && r.media.type === "MANGA"
  );
  if (mangaAdaptations.length > 0) {
    const nonNovel = mangaAdaptations.find((r) => r.media.format !== "NOVEL");
    return (nonNovel ?? mangaAdaptations[0]).media;
  }

  return null;
}

export function getCuratedMangaContinuation(
  mediaId: number,
  lang: ContentLanguage = "fr"
): MangaContinuationInfo | null {
  const hit = CURATED_BY_ID.get(mediaId);
  if (!hit) return null;

  const localizedNote =
    hit.notesByLang?.[lang] ??
    hit.notesByLang?.en ??
    hit.notesByLang?.fr ??
    hit.note ??
    null;

  return {
    sourceKind: hit.sourceKind,
    endedAtChapter: hit.endedAtChapter,
    continueAtChapter: hit.continueAtChapter,
    endedAtVolume: hit.endedAtVolume,
    continueAtVolume: hit.continueAtVolume,
    coveredRange: hit.coveredRange,
    adaptedArc: hit.adaptedArc,
    isFullyAdapted: hit.isFullyAdapted,
    isOngoingAdaptation: hit.isOngoingAdaptation,
    verified: true,
    confidence: "verified",
    note: localizedNote,
    notesByLang: hit.notesByLang,
    liveAnchor: hit.liveAnchor ?? null,
    chaptersPerEpisode: hit.liveAnchor?.chaptersPerEpisode ?? hit.chaptersPerEpisode ?? null,
  };
}

/**
 * Resolves the exact latest aired episode number in real time using AniList airing schedules
 * and nextAiringEpisode timestamps (automatically ticking forward once airingAt passes nowMs).
 */
export function resolveLatestAiredEpisode(input: {
  status?: string | null;
  episodes?: number | null;
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
  latestAiredEpisode?: number | null;
  nowMs?: number;
}): number | null {
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  let fromNext: number | null = null;
  if (
    input.nextAiringEpisode &&
    Number.isFinite(input.nextAiringEpisode.episode) &&
    input.nextAiringEpisode.episode > 0
  ) {
    fromNext =
      input.nextAiringEpisode.airingAt <= nowSec
        ? input.nextAiringEpisode.episode
        : Math.max(0, input.nextAiringEpisode.episode - 1);
  }

  const fromSlot =
    typeof input.latestAiredEpisode === "number" &&
    Number.isFinite(input.latestAiredEpisode) &&
    input.latestAiredEpisode > 0
      ? Math.floor(input.latestAiredEpisode)
      : null;

  if (fromSlot !== null || fromNext !== null) {
    const best = Math.max(fromSlot ?? 0, fromNext ?? 0);
    return best > 0 ? best : null;
  }

  if (
    input.status === "FINISHED" &&
    typeof input.episodes === "number" &&
    Number.isFinite(input.episodes) &&
    input.episodes > 0
  ) {
    return Math.floor(input.episodes);
  }

  return null;
}

function parseStartChapter(coveredRange: string | null | undefined): number {
  if (!coveredRange) return 1;
  const match = /Ch\.\s*(\d+)\s*[–-]/i.exec(coveredRange);
  if (match) {
    const n = Number(match[1]);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  return 1;
}

/**
 * Dynamically recalibrates chapter & volume continuation breakpoints in real time for:
 * 1) Ongoing anchored series (e.g. One Piece) as new weekly episodes air
 * 2) Airing seasonal anime whose latest aired episode advances past a previous sync point
 * 3) A viewer's own tracked episode progress (spoiler-free mid-season continuation)
 */
export function applyLiveEpisodeAdjustment(
  base: MangaContinuationInfo,
  input: {
    liveAiredEpisode?: number | null;
    targetEpisode?: number | null;
    totalEpisodes?: number | null;
    sourceTotalChapters?: number | null;
    sourceTotalVolumes?: number | null;
    nextAiringEpisode?: { episode: number; airingAt: number } | null;
  }
): MangaContinuationInfo {
  const effectiveEp =
    typeof input.targetEpisode === "number" && input.targetEpisode > 0
      ? Math.floor(input.targetEpisode)
      : typeof input.liveAiredEpisode === "number" && input.liveAiredEpisode > 0
        ? Math.floor(input.liveAiredEpisode)
        : null;

  const nextAiring = input.nextAiringEpisode ?? base.nextAiringEpisode ?? null;
  const maxCh =
    typeof input.sourceTotalChapters === "number" && input.sourceTotalChapters > 0
      ? Math.floor(input.sourceTotalChapters)
      : null;
  const maxVol =
    typeof input.sourceTotalVolumes === "number" && input.sourceTotalVolumes > 0
      ? Math.floor(input.sourceTotalVolumes)
      : null;

  // Case 1: Ongoing curated anchor (e.g. One Piece) — compute live chapter from exact reference anchor
  if (base.liveAnchor && effectiveEp !== null) {
    const anchor = base.liveAnchor;
    const rawEnded = Math.round(
      anchor.anchorChapter + (effectiveEp - anchor.anchorEpisode) * anchor.chaptersPerEpisode
    );
    const endedAtChapter = Math.max(1, maxCh ? Math.min(maxCh, rawEnded) : rawEnded);
    const continueAtChapter =
      maxCh && endedAtChapter >= maxCh ? null : endedAtChapter + 1;

    let endedAtVolume = base.endedAtVolume;
    let continueAtVolume = base.continueAtVolume;
    if (anchor.chaptersPerVolume && anchor.chaptersPerVolume > 0) {
      const baseVol =
        base.endedAtVolume ?? Math.max(1, Math.ceil(anchor.anchorChapter / anchor.chaptersPerVolume));
      const shiftedEndVol = Math.max(
        1,
        Math.round(baseVol + (endedAtChapter - anchor.anchorChapter) / anchor.chaptersPerVolume)
      );
      endedAtVolume = maxVol ? Math.min(maxVol, shiftedEndVol) : shiftedEndVol;
      if (continueAtChapter === null) {
        continueAtVolume = null;
      } else {
        const shiftedContVol = Math.max(
          endedAtVolume,
          Math.round(
            baseVol + (continueAtChapter - anchor.anchorChapter) / anchor.chaptersPerVolume
          )
        );
        continueAtVolume = maxVol ? Math.min(maxVol, shiftedContVol) : shiftedContVol;
      }
    }

    return {
      ...base,
      endedAtChapter,
      continueAtChapter,
      endedAtVolume,
      continueAtVolume,
      coveredRange: `Ch. 1 – ${endedAtChapter} (Ép. ${effectiveEp})`,
      syncedEpisode: effectiveEp,
      totalEpisodes: input.totalEpisodes ?? base.totalEpisodes ?? null,
      chaptersPerEpisode: anchor.chaptersPerEpisode,
      nextAiringEpisode: nextAiring,
      liveSynced: true,
      isFullyAdapted: false,
    };
  }

  // Case 2: Proportional adjustment when targetEpisode differs from the base synced/total episode
  const baseRefEp =
    (typeof base.syncedEpisode === "number" && base.syncedEpisode > 0 ? base.syncedEpisode : null) ??
    (typeof input.totalEpisodes === "number" && input.totalEpisodes > 0 ? Math.floor(input.totalEpisodes) : null) ??
    (typeof base.totalEpisodes === "number" && base.totalEpisodes > 0 ? base.totalEpisodes : null) ??
    (typeof input.liveAiredEpisode === "number" && input.liveAiredEpisode > 0
      ? Math.floor(input.liveAiredEpisode)
      : null);

  if (
    effectiveEp !== null &&
    baseRefEp !== null &&
    effectiveEp !== baseRefEp &&
    base.endedAtChapter !== null
  ) {
    const startChapter = parseStartChapter(base.coveredRange);
    const coveredCount = Math.max(1, base.endedAtChapter - startChapter + 1);
    const inferredPace = Math.min(6, Math.max(0.5, coveredCount / baseRefEp));
    const pace =
      typeof base.chaptersPerEpisode === "number" &&
      base.chaptersPerEpisode >= 0.4 &&
      base.chaptersPerEpisode <= 8
        ? base.chaptersPerEpisode
        : inferredPace;

    const rawEnded = Math.round(base.endedAtChapter + (effectiveEp - baseRefEp) * pace);
    const lowerBound = effectiveEp < baseRefEp ? startChapter : 1;
    const endedAtChapter = Math.max(
      lowerBound,
      maxCh ? Math.min(maxCh, rawEnded) : rawEnded
    );
    const continueAtChapter =
      maxCh && endedAtChapter >= maxCh ? null : endedAtChapter + 1;

    let endedAtVolume = base.endedAtVolume;
    let continueAtVolume = base.continueAtVolume;
    if (base.endedAtVolume !== null && base.endedAtChapter > 0) {
      const approxChPerVol = Math.max(4, Math.min(12, base.endedAtChapter / Math.max(1, base.endedAtVolume)));
      const shiftedVol = Math.max(
        1,
        Math.round(base.endedAtVolume + (endedAtChapter - base.endedAtChapter) / approxChPerVol)
      );
      endedAtVolume = maxVol ? Math.min(maxVol, shiftedVol) : shiftedVol;
      continueAtVolume =
        continueAtChapter === null
          ? null
          : maxVol
            ? Math.min(maxVol, Math.max(endedAtVolume, Math.round(shiftedVol + 1 / approxChPerVol)))
            : Math.max(endedAtVolume, Math.round(shiftedVol + 1 / approxChPerVol));
    }

    return {
      ...base,
      endedAtChapter,
      continueAtChapter,
      endedAtVolume,
      continueAtVolume,
      coveredRange: `Ch. ${startChapter} – ${endedAtChapter} (Ép. ${effectiveEp})`,
      syncedEpisode: effectiveEp,
      totalEpisodes: input.totalEpisodes ?? base.totalEpisodes ?? null,
      chaptersPerEpisode: pace,
      nextAiringEpisode: nextAiring,
      liveSynced: true,
      isFullyAdapted: false,
    };
  }

  return {
    ...base,
    syncedEpisode: effectiveEp ?? base.syncedEpisode ?? null,
    totalEpisodes: input.totalEpisodes ?? base.totalEpisodes ?? null,
    nextAiringEpisode: nextAiring,
  };
}

const ELIGIBLE_SOURCES = new Set([
  "MANGA",
  "LIGHT_NOVEL",
  "WEB_NOVEL",
  "COMIC",
  "DOUJINSHI",
]);

export function shouldShowMangaContinuation(media: {
  id: number;
  type: string;
  source?: string | null;
  relations?: readonly MediaRelation[];
}): boolean {
  if (media.type !== "ANIME") return false;
  if (CURATED_BY_ID.has(media.id)) return true;
  if (media.source && ELIGIBLE_SOURCES.has(media.source.toUpperCase())) return true;
  const sourceRel = findSourceMangaRelation(media.relations, media.source);
  return Boolean(sourceRel && media.source !== "ORIGINAL");
}

export function getSourceKindLabel(kind: SourceMediumKind, lang: ContentLanguage): string {
  switch (kind) {
    case "MANHWA":
      return lang === "ja" ? "マンファ (韓国)" : "Manhwa";
    case "MANHUA":
      return lang === "ja" ? "漫画 (中国)" : "Manhua";
    case "NOVEL":
      return lang === "ja" ? "ライトノベル" : "Light Novel";
    case "WEB_NOVEL":
      return lang === "ja" ? "Web小説" : "Web Novel";
    case "MANGA":
    default:
      return lang === "ja" ? "漫画 (原作)" : "Manga";
  }
}

export const CURATED_CONTINUATION_COUNT = CURATED_BY_ID.size;
