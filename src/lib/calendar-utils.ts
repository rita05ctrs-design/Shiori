import type { AiringScheduleItem, MediaItem } from "@/types/media";

export interface CalendarMonthCell {
  dateKey: string; // YYYY-MM-DD
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  airingCount: number;
  premiereCount: number;
}

export function formatDateKeyInTimezone(date: Date, timeZone?: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value ?? String(date.getFullYear());
    const m = parts.find((p) => p.type === "month")?.value ?? String(date.getMonth() + 1).padStart(2, "0");
    const d = parts.find((p) => p.type === "day")?.value ?? String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

export function formatTimeInTimezone(unixSec: number, timeZone?: string): string {
  if (!Number.isFinite(unixSec) || unixSec <= 0) return "Heure inconnue";
  try {
    return new Date(unixSec * 1000).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });
  } catch {
    return new Date(unixSec * 1000).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

/**
 * Builds a Monday-first 6-week (or 5-week) month grid populated strictly from authentic
 * AniList airing timestamps and recorded seasonal premiere `startDate`s (zero invented times).
 */
export function buildMonthCalendarGrid(
  year: number,
  month0Based: number,
  airingItems: AiringScheduleItem[],
  seasonalItems: MediaItem[],
  options?: { timeZone?: string; today?: Date }
): {
  cells: CalendarMonthCell[];
  airingByDate: Record<string, AiringScheduleItem[]>;
  premieresByDate: Record<string, MediaItem[]>;
} {
  const tz = options?.timeZone;
  const todayKey = formatDateKeyInTimezone(options?.today ?? new Date(), tz);

  const airingByDate: Record<string, AiringScheduleItem[]> = {};
  for (const slot of airingItems) {
    if (!slot.airingAt || slot.airingAt <= 0) continue;
    const key = formatDateKeyInTimezone(new Date(slot.airingAt * 1000), tz);
    (airingByDate[key] ??= []).push(slot);
  }
  for (const k of Object.keys(airingByDate)) {
    airingByDate[k].sort((a, b) => a.airingAt - b.airingAt);
  }

  const premieresByDate: Record<string, MediaItem[]> = {};
  const seenPremiere = new Set<string>();
  for (const m of seasonalItems) {
    const sd = m.startDate;
    if (!sd?.year || !sd?.month || !sd?.day) continue;
    const key = `${sd.year}-${String(sd.month).padStart(2, "0")}-${String(sd.day).padStart(2, "0")}`;
    const dedupe = `${key}:${m.id}`;
    if (seenPremiere.has(dedupe)) continue;
    seenPremiere.add(dedupe);
    (premieresByDate[key] ??= []).push(m);
  }

  const firstOfMonth = new Date(year, month0Based, 1);
  // Monday = 0 ... Sunday = 6
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month0Based + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const cells: CalendarMonthCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(year, month0Based, 1 - startOffset + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cells.push({
      dateKey: key,
      dayOfMonth: d.getDate(),
      inCurrentMonth: d.getMonth() === month0Based && d.getFullYear() === year,
      isToday: key === todayKey,
      airingCount: airingByDate[key]?.length ?? 0,
      premiereCount: premieresByDate[key]?.length ?? 0,
    });
  }

  return { cells, airingByDate, premieresByDate };
}
