import React from "react";
import { fetchSeasonalCalendarData, fetchWeeklySchedule } from "@/lib/anilist";
import { CalendarClient } from "@/components/calendar/CalendarClient";

export const revalidate = 300;

export default async function CalendarPage() {
  const [schedule, seasons] = await Promise.all([
    fetchWeeklySchedule(),
    fetchSeasonalCalendarData(),
  ]);
  return <CalendarClient schedule={schedule} seasons={seasons} />;
}
