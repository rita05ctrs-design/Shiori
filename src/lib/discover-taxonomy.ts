export type SituationGroupId =
  | "ALL"
  | "fantasy_time"
  | "survival_tension"
  | "romance_relations"
  | "drama_psyche"
  | "life_power";

export interface TagOption {
  id: string; // Exact official AniList tag name
  label: string; // Clean French display label
  group?: Exclude<SituationGroupId, "ALL">;
}

export interface TagCategory {
  id: "genres" | "situations" | "universes" | "themes" | "demographics";
  label: string;
  description: string;
  items: TagOption[];
}

export const SITUATION_GROUPS: { id: SituationGroupId; label: string }[] = [
  { id: "ALL", label: "Toutes" },
  { id: "fantasy_time", label: "Fantastique & Temps" },
  { id: "survival_tension", label: "Survie & Tension" },
  { id: "romance_relations", label: "Relations & Romance" },
  { id: "drama_psyche", label: "Drame & Destin" },
  { id: "life_power", label: "Vie, Voyage & Pouvoir" },
];

export const GENRE_OPTIONS: TagOption[] = [
  { id: "Action", label: "Action" },
  { id: "Adventure", label: "Aventure" },
  { id: "Comedy", label: "Comédie" },
  { id: "Drama", label: "Drame" },
  { id: "Fantasy", label: "Fantastique" },
  { id: "Horror", label: "Horreur" },
  { id: "Mahou Shoujo", label: "Magical Girl" },
  { id: "Mecha", label: "Mecha" },
  { id: "Music", label: "Musique" },
  { id: "Mystery", label: "Mystère" },
  { id: "Psychological", label: "Psychologique" },
  { id: "Romance", label: "Romance" },
  { id: "Sci-Fi", label: "Sci-Fi" },
  { id: "Slice of Life", label: "Tranche de vie" },
  { id: "Sports", label: "Sport" },
  { id: "Supernatural", label: "Surnaturel" },
  { id: "Thriller", label: "Thriller" },
];

export const SITUATION_TAGS: TagOption[] = [
  // Fantastique & Temps (14)
  { id: "Isekai", label: "Isekai (Autre monde)", group: "fantasy_time" },
  { id: "Reincarnation", label: "Réincarnation", group: "fantasy_time" },
  { id: "Reverse Isekai", label: "Isekai inversé", group: "fantasy_time" },
  { id: "Time Loop", label: "Boucle temporelle", group: "fantasy_time" },
  { id: "Time Manipulation", label: "Manipulation du temps", group: "fantasy_time" },
  { id: "Time Skip", label: "Ellipse temporelle", group: "fantasy_time" },
  { id: "Body Swapping", label: "Échange de corps", group: "fantasy_time" },
  { id: "Age Regression", label: "Rajeunissement", group: "fantasy_time" },
  { id: "Gender Bending", label: "Changement de genre", group: "fantasy_time" },
  { id: "Shapeshifting", label: "Métamorphose", group: "fantasy_time" },
  { id: "Curses", label: "Malédiction", group: "fantasy_time" },
  { id: "Prophecy", label: "Prophétie", group: "fantasy_time" },
  { id: "Cultivation", label: "Cultivation / Ascension", group: "fantasy_time" },
  { id: "Lost Civilization", label: "Civilisation perdue", group: "fantasy_time" },

  // Survie & Tension (15)
  { id: "Survival", label: "Survie", group: "survival_tension" },
  { id: "Battle Royale", label: "Battle Royale", group: "survival_tension" },
  { id: "Death Game", label: "Jeu mortel", group: "survival_tension" },
  { id: "Revenge", label: "Vengeance", group: "survival_tension" },
  { id: "Fugitive", label: "Fugitif / Cavale", group: "survival_tension" },
  { id: "Rescue", label: "Mission de sauvetage", group: "survival_tension" },
  { id: "Proxy Battle", label: "Combat par procuration", group: "survival_tension" },
  { id: "Conspiracy", label: "Complot", group: "survival_tension" },
  { id: "Espionage", label: "Espionnage", group: "survival_tension" },
  { id: "Blackmail", label: "Chantage", group: "survival_tension" },
  { id: "Brainwashing", label: "Lavage de cerveau", group: "survival_tension" },
  { id: "Human Experimentation", label: "Expérimentation humaine", group: "survival_tension" },
  { id: "Natural Disaster", label: "Catastrophe naturelle", group: "survival_tension" },
  { id: "Pandemic", label: "Pandémie / Épidémie", group: "survival_tension" },
  { id: "Terrorism", label: "Terrorisme / Crise", group: "survival_tension" },

  // Relations & Romance (13)
  { id: "Love Triangle", label: "Triangle amoureux", group: "romance_relations" },
  { id: "Unrequited Love", label: "Amour non partagé", group: "romance_relations" },
  { id: "Fake Relationship", label: "Fausse relation", group: "romance_relations" },
  { id: "Arranged Marriage", label: "Mariage arrangé", group: "romance_relations" },
  { id: "Marriage", label: "Mariage / Vie de couple", group: "romance_relations" },
  { id: "Cohabitation", label: "Cohabitation", group: "romance_relations" },
  { id: "Matchmaking", label: "Entremetteur", group: "romance_relations" },
  { id: "Age Gap", label: "Écart d'âge", group: "romance_relations" },
  { id: "Interspecies", label: "Romance inter-espèces", group: "romance_relations" },
  { id: "Female Harem", label: "Harem féminin", group: "romance_relations" },
  { id: "Male Harem", label: "Harem masculin", group: "romance_relations" },
  { id: "Cheating", label: "Infidélité / Tromperie", group: "romance_relations" },
  { id: "Polyamorous", label: "Polyamour", group: "romance_relations" },

  // Drame & Destin (12)
  { id: "Amnesia", label: "Amnésie", group: "drama_psyche" },
  { id: "Memory Manipulation", label: "Mémoire altérée", group: "drama_psyche" },
  { id: "Dissociative Identities", label: "Double personnalité", group: "drama_psyche" },
  { id: "Exiled", label: "Exilé / Banni", group: "drama_psyche" },
  { id: "Orphan", label: "Orphelin", group: "drama_psyche" },
  { id: "Tragedy", label: "Tragédie", group: "drama_psyche" },
  { id: "Bullying", label: "Harcèlement", group: "drama_psyche" },
  { id: "Class Struggle", label: "Lutte des classes", group: "drama_psyche" },
  { id: "Rehabilitation", label: "Rédemption / Reconstruction", group: "drama_psyche" },
  { id: "Slavery", label: "Esclavage", group: "drama_psyche" },
  { id: "Poverty", label: "Pauvreté", group: "drama_psyche" },
  { id: "Homeless", label: "Sans-abri / Errance", group: "drama_psyche" },

  // Vie, Voyage & Pouvoir (10)
  { id: "Coming of Age", label: "Passage à l'âge adulte", group: "life_power" },
  { id: "Found Family", label: "Famille de cœur", group: "life_power" },
  { id: "Adoption", label: "Adoption", group: "life_power" },
  { id: "Family Life", label: "Vie de famille", group: "life_power" },
  { id: "Parenthood", label: "Parentalité", group: "life_power" },
  { id: "Travel", label: "Voyage / Road trip", group: "life_power" },
  { id: "Kingdom Management", label: "Gestion de royaume", group: "life_power" },
  { id: "Royal Affairs", label: "Intrigues royales", group: "life_power" },
  { id: "Language Barrier", label: "Barrière de la langue", group: "life_power" },
  { id: "Hikikomori", label: "Hikikomori / Isolement", group: "life_power" },
];

export const UNIVERSE_TAGS: TagOption[] = [
  { id: "School", label: "Lycée / École" },
  { id: "Boarding School", label: "Internat" },
  { id: "College", label: "Université" },
  { id: "Work", label: "Monde du travail" },
  { id: "Office", label: "Bureau / Entreprise" },
  { id: "Dungeon", label: "Donjon" },
  { id: "Cyberpunk", label: "Cyberpunk" },
  { id: "Steampunk", label: "Steampunk" },
  { id: "Post-Apocalyptic", label: "Post-apocalyptique" },
  { id: "Dystopian", label: "Dystopie" },
  { id: "Space", label: "Espace" },
  { id: "Historical", label: "Historique" },
  { id: "Medieval", label: "Médiéval" },
  { id: "Ancient China", label: "Chine ancienne" },
  { id: "Urban Fantasy", label: "Fantasy urbaine" },
  { id: "Virtual World", label: "Monde virtuel" },
  { id: "Prison", label: "Prison" },
  { id: "Military", label: "Militaire" },
  { id: "War", label: "Guerre" },
  { id: "Politics", label: "Politique" },
  { id: "Mythology", label: "Mythologie" },
  { id: "Rural", label: "Campagne / Rural" },
  { id: "Wilderness", label: "Nature sauvage" },
  { id: "Camping", label: "Camping / Plein air" },
];

export const THEME_TAGS: TagOption[] = [
  { id: "Anti-Hero", label: "Anti-héros" },
  { id: "Villainess", label: "Villainess" },
  { id: "Super Power", label: "Super-pouvoirs" },
  { id: "Magic", label: "Magie" },
  { id: "Alchemy", label: "Alchimie" },
  { id: "Martial Arts", label: "Arts martiaux" },
  { id: "Swordplay", label: "Combat à l'épée" },
  { id: "Samurai", label: "Samouraï" },
  { id: "Ninja", label: "Ninja" },
  { id: "Pirates", label: "Pirates" },
  { id: "Vikings", label: "Vikings" },
  { id: "Demons", label: "Démons" },
  { id: "Vampire", label: "Vampires" },
  { id: "Zombie", label: "Zombies" },
  { id: "Dragons", label: "Dragons" },
  { id: "Detective", label: "Enquête / Détective" },
  { id: "Assassins", label: "Assassins" },
  { id: "Mafia", label: "Mafia" },
  { id: "Yakuza", label: "Yakuza" },
  { id: "Crime", label: "Crime" },
  { id: "Gambling", label: "Jeux d'argent" },
  { id: "Video Games", label: "Jeux vidéo" },
  { id: "Iyashikei", label: "Apaisant (Iyashikei)" },
  { id: "Parody", label: "Parodie" },
  { id: "Philosophy", label: "Philosophie" },
  { id: "Gore", label: "Sombre / Gore" },
  { id: "Food", label: "Gastronomie" },
  { id: "Band", label: "Groupe musical" },
  { id: "Idol", label: "Idols" },
  { id: "Delinquents", label: "Délinquants" },
];

export const DEMOGRAPHIC_TAGS: TagOption[] = [
  { id: "Shounen", label: "Shōnen" },
  { id: "Seinen", label: "Seinen" },
  { id: "Shoujo", label: "Shōjo" },
  { id: "Josei", label: "Josei" },
  { id: "Kids", label: "Kodomo / Jeunesse" },
  { id: "Yuri", label: "Yuri (Girls' Love)" },
  { id: "Boys' Love", label: "Boys' Love (BL)" },
];

export const FILTER_CATEGORIES: TagCategory[] = [
  {
    id: "genres",
    label: "Genres",
    description: "Cumulez plusieurs genres pour affiner exactement le ton recherché.",
    items: GENRE_OPTIONS,
  },
  {
    id: "situations",
    label: "Situations",
    description:
      "64 situations & scénarios : isekai, boucles temporelles, jeu mortel, exil, fausse relation, gestion de royaume, amnésie...",
    items: SITUATION_TAGS,
  },
  {
    id: "universes",
    label: "Univers & Lieux",
    description: "Lycée, internat, cyberpunk, médiéval, Chine ancienne, donjon, espace, prison...",
    items: UNIVERSE_TAGS,
  },
  {
    id: "themes",
    label: "Thèmes & Styles",
    description: "Anti-héros, samouraïs, pirates, dragons, zombies, magie, enquête, mafia, iyashikei...",
    items: THEME_TAGS,
  },
  {
    id: "demographics",
    label: "Public",
    description: "Shōnen, Seinen, Shōjo, Josei et lignes éditoriales.",
    items: DEMOGRAPHIC_TAGS,
  },
];

export type MoodIconKey =
  | "swords"
  | "skull"
  | "sparkles"
  | "brain"
  | "heart"
  | "droplet"
  | "laugh"
  | "coffee"
  | "moon"
  | "flame"
  | "compass"
  | "cpu"
  | "trophy"
  | "search";

export interface MoodPreset {
  id: string;
  label: string;
  subtitle: string;
  icon: MoodIconKey;
  accentHex: string;
  image: string;
  genres: string[];
  tags: string[];
  minScore?: string;
  sort?: string;
}

export const MOOD_PRESETS: MoodPreset[] = [
  // Top 8 — immédiatement visibles en un coup d'œil (grille 4×2)
  {
    id: "shonen-action",
    label: "Shōnen & Combats",
    subtitle: "Pouvoirs, rivalités & batailles mythiques",
    icon: "swords",
    accentHex: "#E5484D",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/113415-jQBSkxWAAk83.jpg",
    genres: ["Action"],
    tags: ["Shounen", "Super Power"],
    sort: "POPULARITY_DESC",
  },
  {
    id: "dark-fantasy",
    label: "Dark Fantasy",
    subtitle: "Démons, tension sombre & univers cruels",
    icon: "skull",
    accentHex: "#F43F5E",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/127230-o8IRwCGVr9KW.jpg",
    genres: ["Fantasy"],
    tags: ["Demons", "Gore"],
    sort: "POPULARITY_DESC",
  },
  {
    id: "isekai-magic",
    label: "Isekai & Autre monde",
    subtitle: "Réincarnation, magie & nouvelle vie",
    icon: "sparkles",
    accentHex: "#8B5CF6",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21355-f9SjOfEJMk5P.jpg",
    genres: ["Fantasy"],
    tags: ["Isekai"],
    sort: "POPULARITY_DESC",
  },
  {
    id: "mindgames-thriller",
    label: "Mindgames & Thriller",
    subtitle: "Manipulation, génies & plot twists",
    icon: "brain",
    accentHex: "#6366F1",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/1535.jpg",
    genres: ["Psychological", "Thriller"],
    tags: [],
    sort: "POPULARITY_DESC",
  },
  {
    id: "romance-comedy",
    label: "Romance & Comédie",
    subtitle: "Coups de foudre, humour & alchimie",
    icon: "heart",
    accentHex: "#EC4899",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/101921-GgvvFhlNhzlF.jpg",
    genres: ["Romance", "Comedy"],
    tags: ["School"],
    sort: "POPULARITY_DESC",
  },
  {
    id: "emotions-tears",
    label: "Émotions & Larmes",
    subtitle: "Récits bouleversants qui marquent à vie",
    icon: "droplet",
    accentHex: "#38BDF8",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/21827-ROucgYiiiSpR.jpg",
    genres: ["Drama", "Romance"],
    tags: ["Tragedy"],
    minScore: "75",
    sort: "POPULARITY_DESC",
  },
  {
    id: "cyberpunk-scifi",
    label: "Cyberpunk & Sci-Fi",
    subtitle: "Néons, dystopies & futurs vertigineux",
    icon: "cpu",
    accentHex: "#06B6D4",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/120377-c15oLS8CA31s.jpg",
    genres: ["Sci-Fi"],
    tags: ["Cyberpunk"],
    sort: "POPULARITY_DESC",
  },
  {
    id: "adventure-epic",
    label: "Grande Aventure",
    subtitle: "Voyages épiques, quêtes & compagnons",
    icon: "compass",
    accentHex: "#10B981",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/154587-ivXNJ23SM1xB.jpg",
    genres: ["Adventure", "Fantasy"],
    tags: ["Travel"],
    sort: "POPULARITY_DESC",
  },

  // 6 autres envies dépliables en 1 clic
  {
    id: "seinen-mature",
    label: "Seinen mature",
    subtitle: "Histoires adultes, profondes & intenses",
    icon: "moon",
    accentHex: "#94A3B8",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/101348-pivKKffCAwAY.jpg",
    genres: ["Drama"],
    tags: ["Seinen"],
    minScore: "75",
    sort: "POPULARITY_DESC",
  },
  {
    id: "death-game",
    label: "Jeu mortel & Survie",
    subtitle: "Enjeux vitaux, pièges & paranoïa",
    icon: "flame",
    accentHex: "#F97316",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/20931-xDhiTPZmtS3u.jpg",
    genres: ["Psychological"],
    tags: ["Death Game"],
    sort: "POPULARITY_DESC",
  },
  {
    id: "chill-cozy",
    label: "Chill & Réconfortant",
    subtitle: "Douceur & apaisement pour décompresser",
    icon: "coffee",
    accentHex: "#34D399",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/98444-FpH9lzLiafe9.jpg",
    genres: ["Slice of Life"],
    tags: ["Iyashikei"],
    sort: "SCORE_DESC",
  },
  {
    id: "pure-comedy",
    label: "Rire & Bonne humeur",
    subtitle: "Humour décalé & moments feel-good",
    icon: "laugh",
    accentHex: "#F59E0B",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/140960-Z7xSvkRxHKfj.jpg",
    genres: ["Comedy", "Slice of Life"],
    tags: [],
    minScore: "75",
    sort: "POPULARITY_DESC",
  },
  {
    id: "sport-hype",
    label: "Sport & Adrénaline",
    subtitle: "Matchs électriques & esprit d'équipe",
    icon: "trophy",
    accentHex: "#EAB308",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/20464-PpYjO9cPN1gs.jpg",
    genres: ["Sports"],
    tags: [],
    sort: "POPULARITY_DESC",
  },
  {
    id: "mystery-detective",
    label: "Enquête & Mystère",
    subtitle: "Indices, complots & affaires secrètes",
    icon: "search",
    accentHex: "#A855F7",
    image: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/161645-oqzTZYIvviWI.jpg",
    genres: ["Mystery"],
    tags: ["Detective"],
    sort: "POPULARITY_DESC",
  },
];

const ALL_TAG_LABELS = new Map<string, string>(
  [
    ...GENRE_OPTIONS,
    ...SITUATION_TAGS,
    ...UNIVERSE_TAGS,
    ...THEME_TAGS,
    ...DEMOGRAPHIC_TAGS,
  ].map((o) => [o.id, o.label])
);

export function getTaxonomyLabel(id: string): string {
  return ALL_TAG_LABELS.get(id) ?? id;
}
