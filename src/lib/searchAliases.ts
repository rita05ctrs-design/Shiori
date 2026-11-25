/**
 * Multilingual Search Alias Dictionary & Query Normalizer for Shiori.
 * Maps popular abbreviations (snk, jjk, mha, aot, fmab, kny, etc.) and common
 * French localized titles to their canonical AniList search queries.
 */

export interface SearchAliasEntry {
  /** Canonical AniList query sent to GraphQL search */
  canonical: string;
  /** Human-readable display name shown in subtle UI hint */
  displayLabel: string;
  /** Abbreviations, French titles, and alternate variants */
  aliases: readonly string[];
}

export interface ResolvedSearchQuery {
  originalQuery: string;
  normalizedQuery: string;
  resolvedQuery: string;
  matchedAlias: string | null;
  canonicalLabel: string | null;
  didExpand: boolean;
}

/**
 * Strips diacritics/accents, punctuation (dashes, colons, apostrophes),
 * lowercases, and collapses whitespace so multilingual queries match reliably.
 */
export function normalizeSearchText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`´]/g, " ")
    .replace(/[-–—_:;!?.,/\\()[\]{}"«»~·•*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const SEARCH_ALIAS_DICTIONARY: readonly SearchAliasEntry[] = [
  {
    canonical: "Shingeki no Kyojin",
    displayLabel: "Attack on Titan (L'Attaque des Titans)",
    aliases: [
      "snk",
      "aot",
      "attack on titan",
      "attaque des titans",
      "l attaque des titans",
      "lattaque des titans",
    ],
  },
  {
    canonical: "Jujutsu Kaisen",
    displayLabel: "Jujutsu Kaisen",
    aliases: ["jjk"],
  },
  {
    canonical: "Boku no Hero Academia",
    displayLabel: "My Hero Academia",
    aliases: ["mha", "bnha", "my hero academia"],
  },
  {
    canonical: "Tensei Shitara Slime Datta Ken",
    displayLabel: "That Time I Got Reincarnated as a Slime",
    aliases: [
      "tensura",
      "slime",
      "moi quand je me reincarne en slime",
      "quand je me reincarne en slime",
      "reincarne en slime",
      "that time i got reincarnated as a slime",
    ],
  },
  {
    canonical: "Kusuriya no Hitorigoto",
    displayLabel: "Les Carnets de l'Apothicaire",
    aliases: [
      "carnets de l apothicaire",
      "les carnets de l apothicaire",
      "apothicaire",
      "apothecary diaries",
      "the apothecary diaries",
      "kusuriya",
    ],
  },
  {
    canonical: "Sousou no Frieren",
    displayLabel: "Frieren: Beyond Journey's End",
    aliases: ["frieren", "frieren beyond journeys end", "sousou no frieren"],
  },
  {
    canonical: "Fullmetal Alchemist: Brotherhood",
    displayLabel: "Fullmetal Alchemist: Brotherhood",
    aliases: ["fma", "fmab", "fullmetal", "fullmetal alchemist"],
  },
  {
    canonical: "Kimetsu no Yaiba",
    displayLabel: "Demon Slayer (Kimetsu no Yaiba)",
    aliases: ["kny", "ds", "demon slayer", "pourfendeur de demons", "les rodeurs de la nuit"],
  },
  {
    canonical: "Hunter x Hunter",
    displayLabel: "Hunter x Hunter",
    aliases: ["hxh"],
  },
  {
    canonical: "One Piece",
    displayLabel: "One Piece",
    aliases: ["op"],
  },
  {
    canonical: "One Punch Man",
    displayLabel: "One Punch Man",
    aliases: ["opm"],
  },
  {
    canonical: "Chainsaw Man",
    displayLabel: "Chainsaw Man",
    aliases: ["csm", "homme tronconneuse", "l homme tronconneuse"],
  },
  {
    canonical: "Sword Art Online",
    displayLabel: "Sword Art Online",
    aliases: ["sao"],
  },
  {
    canonical: "Re:Zero kara Hajimeru Isekai Seikatsu",
    displayLabel: "Re:Zero",
    aliases: ["rezero", "re zero"],
  },
  {
    canonical: "Tokyo Ghoul",
    displayLabel: "Tokyo Ghoul",
    aliases: ["tg"],
  },
  {
    canonical: "Tokyo Revengers",
    displayLabel: "Tokyo Revengers",
    aliases: ["tr"],
  },
  {
    canonical: "Death Note",
    displayLabel: "Death Note",
    aliases: ["dn"],
  },
  {
    canonical: "Dragon Ball Z",
    displayLabel: "Dragon Ball Z",
    aliases: ["dbz"],
  },
  {
    canonical: "Dragon Ball Super",
    displayLabel: "Dragon Ball Super",
    aliases: ["dbs"],
  },
  {
    canonical: "Neon Genesis Evangelion",
    displayLabel: "Neon Genesis Evangelion",
    aliases: ["nge", "eva", "evangelion"],
  },
  {
    canonical: "Code Geass",
    displayLabel: "Code Geass",
    aliases: ["cg", "code geass"],
  },
  {
    canonical: "Steins;Gate",
    displayLabel: "Steins;Gate",
    aliases: ["sg", "steins gate"],
  },
  {
    canonical: "JoJo no Kimyou na Bouken",
    displayLabel: "JoJo's Bizarre Adventure",
    aliases: [
      "jjba",
      "jojo",
      "jojos bizarre adventure",
      "jojo bizarre adventure",
      "les aventures bizarres de jojo",
    ],
  },
  {
    canonical: "Mushoku Tensei",
    displayLabel: "Mushoku Tensei: Jobless Reincarnation",
    aliases: ["mt", "mushoku", "jobless reincarnation"],
  },
  {
    canonical: "Tate no Yuusha no Nariagari",
    displayLabel: "The Rising of the Shield Hero",
    aliases: [
      "shield hero",
      "rising of the shield hero",
      "l ascension du heros du bouclier",
      "heros du bouclier",
    ],
  },
  {
    canonical: "Kage no Jitsuryokusha ni Naritakute",
    displayLabel: "The Eminence in Shadow",
    aliases: [
      "eminence in shadow",
      "l eminence de l ombre",
      "eminence de l ombre",
    ],
  },
  {
    canonical: "Nanatsu no Taizai",
    displayLabel: "The Seven Deadly Sins",
    aliases: [
      "7ds",
      "sds",
      "nnt",
      "seven deadly sins",
      "les sept peches capitaux",
      "sept peches capitaux",
    ],
  },
  {
    canonical: "Spy x Family",
    displayLabel: "Spy x Family",
    aliases: ["sxf", "spyxfamily"],
  },
  {
    canonical: "Oshi no Ko",
    displayLabel: "Oshi no Ko",
    aliases: ["onk", "oshinoko"],
  },
  {
    canonical: "Ore dake Level Up na Ken",
    displayLabel: "Solo Leveling",
    aliases: ["sl", "solo leveling", "sololeveling"],
  },
  {
    canonical: "Bungou Stray Dogs",
    displayLabel: "Bungo Stray Dogs",
    aliases: ["bsd", "bungo stray dogs"],
  },
  {
    canonical: "Black Clover",
    displayLabel: "Black Clover",
    aliases: ["bc"],
  },
  {
    canonical: "Fairy Tail",
    displayLabel: "Fairy Tail",
    aliases: ["ft"],
  },
  {
    canonical: "Kono Subarashii Sekai ni Shukufuku wo!",
    displayLabel: "KonoSuba",
    aliases: ["konosuba"],
  },
  {
    canonical: "Dungeon ni Deai wo Motomeru no wa Machigatteiru Darou ka",
    displayLabel: "DanMachi",
    aliases: ["danmachi", "familial myth"],
  },
  {
    canonical: "Kaguya-sama: Love is War",
    displayLabel: "Kaguya-sama: Love is War",
    aliases: ["kaguya", "kaguya sama", "love is war"],
  },
  {
    canonical: "Mob Psycho 100",
    displayLabel: "Mob Psycho 100",
    aliases: ["mp100", "mob psycho"],
  },
  {
    canonical: "Sen to Chihiro no Kamikakushi",
    displayLabel: "Le Voyage de Chihiro (Spirited Away)",
    aliases: ["le voyage de chihiro", "voyage de chihiro", "chihiro", "spirited away"],
  },
  {
    canonical: "Mononoke-hime",
    displayLabel: "Princesse Mononoké",
    aliases: ["princesse mononoke", "princess mononoke", "mononoke"],
  },
  {
    canonical: "Howl no Ugoku Shiro",
    displayLabel: "Le Château Ambulant",
    aliases: ["le chateau ambulant", "chateau ambulant", "howls moving castle"],
  },
  {
    canonical: "Tonari no Totoro",
    displayLabel: "Mon Voisin Totoro",
    aliases: ["mon voisin totoro", "totoro", "my neighbor totoro"],
  },
  {
    canonical: "Hotaru no Haka",
    displayLabel: "Le Tombeau des Lucioles",
    aliases: ["le tombeau des lucioles", "tombeau des lucioles", "grave of the fireflies"],
  },
  {
    canonical: "Kimi no Na wa.",
    displayLabel: "Your Name (Kimi no Na wa.)",
    aliases: ["your name", "kimi no na wa"],
  },
  {
    canonical: "Tenki no Ko",
    displayLabel: "Les Enfants du Temps (Weathering With You)",
    aliases: ["les enfants du temps", "enfants du temps", "weathering with you"],
  },
  {
    canonical: "Koe no Katachi",
    displayLabel: "A Silent Voice",
    aliases: ["a silent voice", "silent voice", "forme de la voix"],
  },
  {
    canonical: "Ookami Kodomo no Ame to Yuki",
    displayLabel: "Les Enfants Loups",
    aliases: ["les enfants loups", "enfants loups", "wolf children"],
  },
  {
    canonical: "Toki wo Kakeru Shoujo",
    displayLabel: "La Traversée du Temps",
    aliases: ["la traversee du temps", "traversee du temps", "the girl who leapt through time"],
  },
  {
    canonical: "Kimitachi wa Dou Ikiru ka",
    displayLabel: "Le Garçon et le Héron",
    aliases: [
      "le garcon et le heron",
      "l enfant et le heron",
      "garcon et le heron",
      "the boy and the heron",
    ],
  },
  {
    canonical: "Bakemono no Ko",
    displayLabel: "Le Garçon et la Bête",
    aliases: ["le garcon et la bete", "garcon et la bete", "the boy and the beast"],
  },
  {
    canonical: "Tongari Boushi no Atelier",
    displayLabel: "L'Atelier des Sorciers",
    aliases: ["l atelier des sorciers", "atelier des sorciers", "witch hat atelier"],
  },
  {
    canonical: "Houseki no Kuni",
    displayLabel: "L'Ère des Cristaux",
    aliases: ["l ere des cristaux", "ere des cristaux", "land of the lustrous"],
  },
  {
    canonical: "Vanitas no Carte",
    displayLabel: "Les Mémoires de Vanitas",
    aliases: ["les memoires de vanitas", "memoires de vanitas", "the case study of vanitas"],
  },
  {
    canonical: "Hataraku Saibou",
    displayLabel: "Les Brigades Immunitaires (Cells at Work!)",
    aliases: ["les brigades immunitaires", "brigades immunitaires", "cells at work"],
  },
  {
    canonical: "Natsume Yuujinchou",
    displayLabel: "Le Pacte des Yōkai",
    aliases: ["le pacte des yokai", "pacte des yokai", "natsumes book of friends"],
  },
  {
    canonical: "Saiki Kusuo no Psi-nan",
    displayLabel: "La Vie Désastreuse de Saiki K.",
    aliases: ["saiki k", "la vie desastreuse de saiki k", "vie desastreuse de saiki"],
  },
  {
    canonical: "Yofukashi no Uta",
    displayLabel: "Call of the Night (Le Chant de la Nuit)",
    aliases: ["le chant de la nuit", "chant de la nuit", "call of the night"],
  },
  {
    canonical: "Oyasumi Punpun",
    displayLabel: "Bonne Nuit Punpun",
    aliases: ["bonne nuit punpun", "goodnight punpun", "punpun"],
  },
  {
    canonical: "Saint Seiya",
    displayLabel: "Les Chevaliers du Zodiaque (Saint Seiya)",
    aliases: ["les chevaliers du zodiaque", "chevaliers du zodiaque"],
  },
  {
    canonical: "City Hunter",
    displayLabel: "Nicky Larson (City Hunter)",
    aliases: ["nicky larson"],
  },
  {
    canonical: "Captain Tsubasa",
    displayLabel: "Olive et Tom (Captain Tsubasa)",
    aliases: ["olive et tom"],
  },
  {
    canonical: "Hokuto no Ken",
    displayLabel: "Ken le Survivant (Hokuto no Ken)",
    aliases: ["ken le survivant", "fist of the north star"],
  },
  {
    canonical: "Meitantei Conan",
    displayLabel: "Détective Conan",
    aliases: ["detective conan", "case closed"],
  },
  {
    canonical: "UFO Robo Grendizer",
    displayLabel: "Goldorak",
    aliases: ["goldorak"],
  },
  {
    canonical: "Uchuu Kaizoku Captain Harlock",
    displayLabel: "Albator",
    aliases: ["albator", "captain harlock"],
  },
  {
    canonical: "Versailles no Bara",
    displayLabel: "Lady Oscar (La Rose de Versailles)",
    aliases: ["lady oscar", "la rose de versailles", "rose de versailles"],
  },
  {
    canonical: "Ansatsu Kyoushitsu",
    displayLabel: "Assassination Classroom",
    aliases: ["assassination classroom", "assclass"],
  },
  {
    canonical: "Dandadan",
    displayLabel: "DAN DA DAN",
    aliases: ["dan da dan", "ddd"],
  },
  {
    canonical: "Vinland Saga",
    displayLabel: "Vinland Saga",
    aliases: ["vs", "vinland"],
  },
  {
    canonical: "Ginga Eiyuu Densetsu",
    displayLabel: "Les Héros de la Galaxie",
    aliases: ["logh", "les heros de la galaxie", "legend of the galactic heroes"],
  },
  {
    canonical: "Kumo desu ga, Nani ka?",
    displayLabel: "So I'm a Spider, So What?",
    aliases: ["moi qui suis devenu une araignee", "je suis une araignee"],
  },
  {
    canonical: "Fumetsu no Anata e",
    displayLabel: "To Your Eternity",
    aliases: ["to your eternity", "pour l eternite"],
  },
  {
    canonical: "Shigatsu wa Kimi no Uso",
    displayLabel: "Your Lie in April",
    aliases: ["ylia", "your lie in april"],
  },
  {
    canonical: "Ano Hi Mita Hana no Namae wo Bokutachi wa Mada Shiranai.",
    displayLabel: "Anohana",
    aliases: ["anohana"],
  },
  {
    canonical: "Seishun Buta Yarou wa Bunny Girl Senpai no Yume wo Minai",
    displayLabel: "Rascal Does Not Dream of Bunny Girl Senpai",
    aliases: ["bunny girl senpai", "aobuta"],
  },
  {
    canonical: "Yahari Ore no Seishun Love Comedy wa Machigatteiru.",
    displayLabel: "Oregairu",
    aliases: ["oregairu", "snafu"],
  },
  {
    canonical: "Gotoubun no Hanayome",
    displayLabel: "The Quintessential Quintuplets",
    aliases: ["quintuplets", "quintessential quintuplets", "les quintuplees"],
  },
];

// Precomputed normalized alias lookup table for O(1) resolution
const EXACT_ALIAS_MAP = new Map<string, { entry: SearchAliasEntry; rawAlias: string }>();
const LONG_ALIAS_LIST: { norm: string; rawAlias: string; entry: SearchAliasEntry }[] = [];

for (const entry of SEARCH_ALIAS_DICTIONARY) {
  for (const alias of entry.aliases) {
    const norm = normalizeSearchText(alias);
    if (!norm) continue;
    if (!EXACT_ALIAS_MAP.has(norm)) {
      EXACT_ALIAS_MAP.set(norm, { entry, rawAlias: alias });
    }
    if (norm.length >= 6) {
      LONG_ALIAS_LIST.push({ norm, rawAlias: alias, entry });
    }
  }
}

function quickEditDistance(a: string, b: string): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 2) return 3;
  const prev = new Array<number>(lb + 1);
  const curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > 2) return 3;
    for (let j = 0; j <= lb; j++) prev[j] = curr[j];
  }
  return prev[lb];
}

/**
 * Resolves abbreviations and French titles into their canonical AniList search
 * query before hitting the API, supporting minor typos on longer French titles.
 */
export function resolveSearchAlias(rawQuery: string): ResolvedSearchQuery {
  const originalQuery = rawQuery.trim();
  const normalizedQuery = normalizeSearchText(originalQuery);

  if (!normalizedQuery) {
    return {
      originalQuery,
      normalizedQuery,
      resolvedQuery: originalQuery,
      matchedAlias: null,
      canonicalLabel: null,
      didExpand: false,
    };
  }

  // 1. Exact alias hit (covers short abbreviations like snk, jjk, mha, aot + full FR titles)
  const exact = EXACT_ALIAS_MAP.get(normalizedQuery);
  if (exact) {
    const didExpand =
      normalizeSearchText(exact.entry.canonical) !== normalizedQuery;
    return {
      originalQuery,
      normalizedQuery,
      resolvedQuery: exact.entry.canonical,
      matchedAlias: originalQuery,
      canonicalLabel: exact.entry.displayLabel,
      didExpand,
    };
  }

  // 2. Fuzzy / prefix hit for multi-word French titles (e.g. "l'attaque des titan", "moi quand je me reincarne")
  if (normalizedQuery.length >= 6) {
    for (const candidate of LONG_ALIAS_LIST) {
      if (
        candidate.norm.startsWith(normalizedQuery) ||
        normalizedQuery.includes(candidate.norm) ||
        (normalizedQuery.length >= 8 &&
          quickEditDistance(normalizedQuery, candidate.norm) <= 2)
      ) {
        return {
          originalQuery,
          normalizedQuery,
          resolvedQuery: candidate.entry.canonical,
          matchedAlias: originalQuery,
          canonicalLabel: candidate.entry.displayLabel,
          didExpand: normalizeSearchText(candidate.entry.canonical) !== normalizedQuery,
        };
      }
    }
  }

  return {
    originalQuery,
    normalizedQuery,
    resolvedQuery: originalQuery,
    matchedAlias: null,
    canonicalLabel: null,
    didExpand: false,
  };
}

/**
 * Instant alias autocomplete suggestions while typing (0 network latency).
 */
export function getInstantAliasSuggestions(
  rawQuery: string,
  limit = 4
): SearchAliasEntry[] {
  const norm = normalizeSearchText(rawQuery);
  if (norm.length < 2) return [];

  const matches: { entry: SearchAliasEntry; score: number }[] = [];
  const seenCanon = new Set<string>();

  for (const entry of SEARCH_ALIAS_DICTIONARY) {
    if (seenCanon.has(entry.canonical)) continue;
    let best = 0;

    const canonNorm = normalizeSearchText(entry.canonical);
    const labelNorm = normalizeSearchText(entry.displayLabel);
    if (canonNorm.startsWith(norm) || labelNorm.startsWith(norm)) best = Math.max(best, 85);
    else if (canonNorm.includes(norm) || labelNorm.includes(norm)) best = Math.max(best, 70);

    for (const alias of entry.aliases) {
      const aNorm = normalizeSearchText(alias);
      if (aNorm === norm) best = Math.max(best, 100);
      else if (aNorm.startsWith(norm)) best = Math.max(best, 92);
      else if (norm.length >= 4 && aNorm.includes(norm)) best = Math.max(best, 76);
    }

    if (best > 0) {
      seenCanon.add(entry.canonical);
      matches.push({ entry, score: best });
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((m) => m.entry);
}
