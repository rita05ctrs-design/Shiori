import type {
  AmbianceEffect,
  CornerStyle,
  GlowIntensity,
  SurfaceAtmosphere,
  ThemeSettings,
} from "@/types/media";

export const THEME_STORAGE_KEY = "shiori_theme_v1";

export interface ThemePreset {
  id: string;
  name: string;
  subtitle: string;
  accentColor: string;
  secondaryColor: string;
  surface: SurfaceAtmosphere;
  glow: GlowIntensity;
  suggestedEffect: AmbianceEffect;
  previewBg: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "akane",
    name: "Akane Crimson",
    subtitle: "Classique Shiori · Carmin & Or",
    accentColor: "#E5484D",
    secondaryColor: "#F0B95B",
    surface: "obsidian",
    glow: "subtle",
    suggestedEffect: "momiji",
    previewBg: "#07080C",
  },
  {
    id: "sakura",
    name: "Sakura Velvet",
    subtitle: "Cerisiers nocturnes · Rose soyeux",
    accentColor: "#F472B6",
    secondaryColor: "#FBBF24",
    surface: "velvet",
    glow: "vibrant",
    suggestedEffect: "sakura",
    previewBg: "#0E0712",
  },
  {
    id: "cyber",
    name: "Cyber Tokyo",
    subtitle: "Néon cyan & reflets magenta",
    accentColor: "#06B6D4",
    secondaryColor: "#E879F9",
    surface: "midnight",
    glow: "vibrant",
    suggestedEffect: "rain",
    previewBg: "#070A16",
  },
  {
    id: "amethyst",
    name: "Violet Améthyste",
    subtitle: "Nuit astrale & lavande",
    accentColor: "#8B5CF6",
    secondaryColor: "#C084FC",
    surface: "midnight",
    glow: "subtle",
    suggestedEffect: "stars",
    previewBg: "#070A16",
  },
  {
    id: "jade",
    name: "Jade Kyōto",
    subtitle: "Forêt de bambous · Émeraude",
    accentColor: "#10B981",
    secondaryColor: "#FCD34D",
    surface: "tinted",
    glow: "subtle",
    suggestedEffect: "fireflies",
    previewBg: "#060C0A",
  },
  {
    id: "kinpaku",
    name: "Kinpaku Impérial",
    subtitle: "Or solaire sur laque noire OLED",
    accentColor: "#F59E0B",
    secondaryColor: "#FDE68A",
    surface: "oled",
    glow: "subtle",
    suggestedEffect: "fireflies",
    previewBg: "#000000",
  },
  {
    id: "ocean",
    name: "Bleu Océanique",
    subtitle: "Abysse azur & givre d'hiver",
    accentColor: "#3B82F6",
    secondaryColor: "#38BDF8",
    surface: "midnight",
    glow: "subtle",
    suggestedEffect: "snow",
    previewBg: "#070A16",
  },
  {
    id: "sunset",
    name: "Corail Sunset",
    subtitle: "Crépuscule ambré & vermillon",
    accentColor: "#F97316",
    secondaryColor: "#FB7185",
    surface: "tinted",
    glow: "vibrant",
    suggestedEffect: "momiji",
    previewBg: "#0D0806",
  },
];

export const DEFAULT_THEME: ThemeSettings = {
  presetId: "akane",
  accentColor: "#E5484D",
  secondaryColor: "#F0B95B",
  surface: "obsidian",
  glow: "subtle",
  corners: "editorial",
  syncParticles: false,
};

export const CUSTOM_ACCENT_SWATCHES: { name: string; color: string }[] = [
  { name: "Akane", color: "#E5484D" },
  { name: "Rubis", color: "#F43F5E" },
  { name: "Sakura", color: "#F472B6" },
  { name: "Orchidée", color: "#D946EF" },
  { name: "Améthyste", color: "#8B5CF6" },
  { name: "Indigo", color: "#6366F1" },
  { name: "Azur", color: "#3B82F6" },
  { name: "Cyan Néon", color: "#06B6D4" },
  { name: "Turquoise", color: "#14B8A6" },
  { name: "Émeraude", color: "#10B981" },
  { name: "Or Kinpaku", color: "#F59E0B" },
  { name: "Corail", color: "#F97316" },
];

export const SECONDARY_SWATCHES: { name: string; color: string }[] = [
  { name: "Or Kinpaku", color: "#F0B95B" },
  { name: "Pêche Doux", color: "#FBBF24" },
  { name: "Magenta", color: "#E879F9" },
  { name: "Lavande", color: "#C084FC" },
  { name: "Glace", color: "#38BDF8" },
  { name: "Menthe", color: "#34D399" },
  { name: "Rose Corail", color: "#FB7185" },
  { name: "Perle", color: "#E2E8F0" },
];

export const SURFACE_OPTIONS: {
  id: SurfaceAtmosphere;
  label: string;
  desc: string;
  bg: string;
  surface: string;
  elevated: string;
  hover: string;
  solid: string;
  solidHeader: string;
}[] = [
  {
    id: "obsidian",
    label: "Obsidienne",
    desc: "Noir cinéma profond",
    bg: "#07080C",
    surface: "#0E1017",
    elevated: "#151822",
    hover: "#1C202E",
    solid: "#0D0F18",
    solidHeader: "#121522",
  },
  {
    id: "oled",
    label: "OLED Pur",
    desc: "Noir absolu haute précision",
    bg: "#000000",
    surface: "#08090D",
    elevated: "#11131B",
    hover: "#191C27",
    solid: "#07080C",
    solidHeader: "#0E1018",
  },
  {
    id: "midnight",
    label: "Minuit Indigo",
    desc: "Bleu nuit profond",
    bg: "#060914",
    surface: "#0D1224",
    elevated: "#141B33",
    hover: "#1C2544",
    solid: "#0B1021",
    solidHeader: "#111830",
  },
  {
    id: "velvet",
    label: "Velours Prune",
    desc: "Nocturne chaud & feutré",
    bg: "#0D0711",
    surface: "#160E1C",
    elevated: "#20152A",
    hover: "#2A1C37",
    solid: "#140C1A",
    solidHeader: "#1D1226",
  },
  {
    id: "slate",
    label: "Ardoise Douce",
    desc: "Gris sombre reposant",
    bg: "#0F131B",
    surface: "#171C27",
    elevated: "#202635",
    hover: "#293144",
    solid: "#151A25",
    solidHeader: "#1C2230",
  },
  {
    id: "tinted",
    label: "Teinte Assortie",
    desc: "Fond harmonisé à l'accent",
    bg: "#07080C",
    surface: "#0E1017",
    elevated: "#151822",
    hover: "#1C202E",
    solid: "#0D0F18",
    solidHeader: "#121522",
  },
];

export const GLOW_OPTIONS: {
  id: GlowIntensity;
  label: string;
  primaryAlpha: number;
  secondaryAlpha: number;
}[] = [
  { id: "off", label: "Désactivé", primaryAlpha: 0, secondaryAlpha: 0 },
  { id: "subtle", label: "Subtil", primaryAlpha: 0.095, secondaryAlpha: 0.055 },
  { id: "vibrant", label: "Intense", primaryAlpha: 0.175, secondaryAlpha: 0.1 },
];

export const CORNER_OPTIONS: {
  id: CornerStyle;
  label: string;
  desc: string;
}[] = [
  { id: "sharp", label: "Structuré", desc: "Angles nets" },
  { id: "editorial", label: "Éditorial", desc: "Équilibré" },
  { id: "soft", label: "Doux", desc: "Très arrondi" },
];

/* -------------------------------------------------------------------------- */
/* Color Science Helpers (pure, lightweight, zero dependencies)               */
/* -------------------------------------------------------------------------- */

export function normalizeHex(hex: string, fallback = "#E5484D"): string {
  const cleaned = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return (
      "#" +
      cleaned
        .split("")
        .map((c) => c + c)
        .join("")
        .toUpperCase()
    );
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  return fallback;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const safe = normalizeHex(hex);
  const num = parseInt(safe.slice(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;

  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

function mixHex(baseHex: string, tintHex: string, ratio: number): string {
  const a = hexToRgb(baseHex);
  const b = hexToRgb(tintHex);
  return rgbToHex(
    a.r * (1 - ratio) + b.r * ratio,
    a.g * (1 - ratio) + b.g * ratio,
    a.b * (1 - ratio) + b.b * ratio
  );
}

/** WCAG relative luminance — picks crisp dark or white text on top of any accent color */
export function getContrastForeground(hex: string): "#FFFFFF" | "#090A0F" {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return lum > 0.44 ? "#090A0F" : "#FFFFFF";
}

export function computeThemeCssVars(settings: ThemeSettings): Record<string, string> {
  const accent = normalizeHex(settings.accentColor, DEFAULT_THEME.accentColor);
  const secondary = normalizeHex(settings.secondaryColor, DEFAULT_THEME.secondaryColor);

  const accentRgb = hexToRgb(accent);
  const secondaryRgb = hexToRgb(secondary);
  const hsl = rgbToHsl(accentRgb.r, accentRgb.g, accentRgb.b);

  // Lifted hover tone
  const hoverRgb = hslToRgb(hsl.h, Math.min(100, hsl.s + 4), Math.min(72, hsl.l + 7));
  const accentHover = rgbToHex(hoverRgb.r, hoverRgb.g, hoverRgb.b);

  // Soft legible pastel tint for text badges on dark backgrounds (always high contrast!)
  const softRgb = hslToRgb(hsl.h, Math.min(95, Math.max(55, hsl.s)), Math.max(76, Math.min(84, hsl.l + 22)));
  const accentSoft = rgbToHex(softRgb.r, softRgb.g, softRgb.b);

  // Deep saturated stop for Shiori bookmark ribbon & avatar gradients
  const deepRgb = hslToRgb(hsl.h, Math.min(100, hsl.s + 6), Math.max(24, Math.min(36, hsl.l - 22)));
  const accentDeep = rgbToHex(deepRgb.r, deepRgb.g, deepRgb.b);

  const accentFg = getContrastForeground(accent);

  // Compute Surface palette
  const baseSurf =
    SURFACE_OPTIONS.find((s) => s.id === settings.surface) ?? SURFACE_OPTIONS[0];

  let bg = baseSurf.bg;
  let surface = baseSurf.surface;
  let elevated = baseSurf.elevated;
  let hover = baseSurf.hover;
  let solid = baseSurf.solid;
  let solidHeader = baseSurf.solidHeader;

  if (settings.surface === "tinted") {
    bg = mixHex("#06070B", accent, 0.055);
    surface = mixHex("#0D0F16", accent, 0.075);
    elevated = mixHex("#141722", accent, 0.095);
    hover = mixHex("#1B1F2E", accent, 0.115);
    solid = mixHex("#0C0E16", accent, 0.075);
    solidHeader = mixHex("#111420", accent, 0.095);
  }

  const surfRgb = hexToRgb(surface);
  const elevRgb = hexToRgb(elevated);

  const glowMeta = GLOW_OPTIONS.find((g) => g.id === settings.glow) ?? GLOW_OPTIONS[1];

  return {
    "--shiori-accent": accent,
    "--shiori-accent-rgb": `${accentRgb.r} ${accentRgb.g} ${accentRgb.b}`,
    "--shiori-accent-hover": accentHover,
    "--shiori-accent-soft": accentSoft,
    "--shiori-accent-deep": accentDeep,
    "--shiori-accent-fg": accentFg,
    "--shiori-secondary": secondary,
    "--shiori-secondary-rgb": `${secondaryRgb.r} ${secondaryRgb.g} ${secondaryRgb.b}`,
    "--shiori-bg": bg,
    "--shiori-surface": surface,
    "--shiori-surface-rgb": `${surfRgb.r} ${surfRgb.g} ${surfRgb.b}`,
    "--shiori-surface-elevated": elevated,
    "--shiori-surface-elevated-rgb": `${elevRgb.r} ${elevRgb.g} ${elevRgb.b}`,
    "--shiori-surface-hover": hover,
    "--shiori-surface-solid": solid,
    "--shiori-surface-solid-header": solidHeader,
    "--shiori-glow-primary": String(glowMeta.primaryAlpha),
    "--shiori-glow-secondary": String(glowMeta.secondaryAlpha),
  };
}

const THEME_VARS_CACHE_KEY = "shiori_theme_vars_v1";

export function applyThemeToDocument(settings: ThemeSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const vars = computeThemeCssVars(settings);
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
  root.setAttribute("data-corners", settings.corners);
  root.setAttribute("data-surface", settings.surface);
  try {
    localStorage.setItem(
      THEME_VARS_CACHE_KEY,
      JSON.stringify({
        vars,
        corners: settings.corners,
        surface: settings.surface,
      })
    );
  } catch {
    // ignore storage restrictions
  }
}

/**
 * Tiny synchronous inline boot script executed in <head> before first paint
 * so saved user colors/surfaces/corners appear immediately with zero FOUC.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(
  THEME_VARS_CACHE_KEY
)});if(!raw)return;var d=JSON.parse(raw);if(!d||typeof d!=="object")return;var r=document.documentElement;if(d.corners)r.setAttribute("data-corners",d.corners);if(d.surface)r.setAttribute("data-surface",d.surface);if(d.vars){for(var k in d.vars){if(Object.prototype.hasOwnProperty.call(d.vars,k)){r.style.setProperty(k,d.vars[k]);}}}}catch(e){}})();`;
