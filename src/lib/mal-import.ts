import type { LibraryStatus, MediaType } from "@/types/media";

export interface MalParsedItem {
  malId: number;
  type: MediaType;
  title: string;
  status: LibraryStatus;
  progress: number;
  progressVolumes: number;
  totalUnits: number | null;
  totalVolumes: number | null;
  score: number | null;
  notes: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface MalParseResult {
  username: string | null;
  mediaType: MediaType | "MIXED";
  items: MalParsedItem[];
  skipped: number;
}

function decodeXmlText(raw: string): string {
  const unwrapped = raw
    .trim()
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1");

  return unwrapped
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_m, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff
        ? String.fromCodePoint(code)
        : "";
    })
    .trim();
}

function extractTag(block: string, tagName: string): string {
  const re = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(re);
  return match ? decodeXmlText(match[1]) : "";
}

function parsePositiveInt(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

function parseNonNegativeInt(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function parseMalDate(raw: string): string | null {
  const clean = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return null;
  if (clean === "0000-00-00" || clean.startsWith("0000-") || clean.includes("-00")) {
    return null;
  }
  return clean;
}

function mapMalStatus(raw: string): LibraryStatus {
  const norm = raw.trim().toLowerCase();
  if (norm === "watching" || norm === "reading" || norm === "1") return "WATCHING";
  if (norm === "completed" || norm === "2") return "COMPLETED";
  if (norm === "on-hold" || norm === "on hold" || norm === "3") return "ON_HOLD";
  if (norm === "dropped" || norm === "4") return "DROPPED";
  if (norm === "plan to watch" || norm === "plan to read" || norm === "6") {
    return "PLAN_TO_WATCH";
  }
  return "PLAN_TO_WATCH";
}

/**
 * Pure, zero-dependency MyAnimeList XML parser supporting both official Anime
 * (`<anime>...</anime>`) and Manga (`<manga>...</manga>`) exports.
 */
export function parseMalXml(xmlText: string): MalParseResult {
  const text = String(xmlText ?? "");
  const myinfoMatch = text.match(/<myinfo>([\s\S]*?)<\/myinfo>/i);
  const username = myinfoMatch ? extractTag(myinfoMatch[1], "user_name") || null : null;

  const items: MalParsedItem[] = [];
  let skipped = 0;

  const parseBlocks = (tag: "anime" | "manga", type: MediaType) => {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const block = m[1];
      const malId = parsePositiveInt(
        extractTag(block, type === "ANIME" ? "series_animedb_id" : "manga_mangadb_id")
      );
      const title = extractTag(block, type === "ANIME" ? "series_title" : "manga_title");

      if (!malId || !title) {
        skipped++;
        continue;
      }

      const rawScore = Number(extractTag(block, "my_score"));
      const score =
        Number.isFinite(rawScore) && rawScore > 0 && rawScore <= 10
          ? Math.round(rawScore * 10) / 10
          : null;

      items.push({
        malId,
        type,
        title,
        status: mapMalStatus(extractTag(block, "my_status")),
        progress: parseNonNegativeInt(
          extractTag(block, type === "ANIME" ? "my_watched_episodes" : "my_read_chapters")
        ),
        progressVolumes:
          type === "MANGA" ? parseNonNegativeInt(extractTag(block, "my_read_volumes")) : 0,
        totalUnits: parsePositiveInt(
          extractTag(block, type === "ANIME" ? "series_episodes" : "manga_chapters")
        ),
        totalVolumes:
          type === "MANGA" ? parsePositiveInt(extractTag(block, "manga_volumes")) : null,
        score,
        notes: extractTag(block, "my_comments").slice(0, 1000),
        startedAt: parseMalDate(extractTag(block, "my_start_date")),
        completedAt: parseMalDate(extractTag(block, "my_finish_date")),
      });
    }
  };

  parseBlocks("anime", "ANIME");
  parseBlocks("manga", "MANGA");

  const hasAnime = items.some((i) => i.type === "ANIME");
  const hasManga = items.some((i) => i.type === "MANGA");
  const mediaType: MediaType | "MIXED" =
    hasAnime && hasManga ? "MIXED" : hasManga ? "MANGA" : "ANIME";

  return { username, mediaType, items, skipped };
}

/**
 * Reads either a plain `.xml` or gzipped `.xml.gz` MyAnimeList export file
 * directly in the browser using native `DecompressionStream("gzip")`.
 */
export async function readMalFileAsXml(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const isGzip =
    file.name.toLowerCase().endsWith(".gz") ||
    (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b);

  if (!isGzip) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "Votre navigateur ne supporte pas la décompression .gz. Décompressez le fichier en .xml avant import."
    );
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}
