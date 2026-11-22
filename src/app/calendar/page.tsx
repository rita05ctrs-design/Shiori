import React from "react";
import { fetchWeeklySchedule } from "@/lib/anilist";
import { CalendarClient } from "@/components/calendar/CalendarClient";

export const revalidate = 300;

export default async function CalendarPage() {
  const schedule = await fetchWeeklySchedule();
  return <CalendarClient schedule={schedule} />;
}
