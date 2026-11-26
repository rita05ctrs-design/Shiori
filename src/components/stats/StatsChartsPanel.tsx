"use client";

import React from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BarChart3, CalendarRange } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { LibraryStatus } from "@/types/media";
import type { MonthlyActivityPoint, YearEvolutionPoint } from "@/lib/stats";

export interface StatusChartDatum {
  status: LibraryStatus;
  name: string;
  value: number;
  color: string;
}

export interface ScoreBucketDatum {
  bucket: string;
  count: number;
}

interface StatsCoreChartsProps {
  statusData: StatusChartDatum[];
  scoreBuckets: ScoreBucketDatum[];
}

export function StatsCoreCharts({ statusData, scoreBuckets }: StatsCoreChartsProps) {
  const { tr } = useTranslation();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Status Distribution Donut */}
      <div className="lg:col-span-5 rounded-2xl card-surface p-5 sm:p-6 flex flex-col">
        <h2 className="text-base font-semibold text-white mb-4">
          {tr("Répartition par statut")}
        </h2>

        {statusData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[#7D8296] py-10">
            {tr("Aucune œuvre pour le moment.")}
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={74}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {statusData.map((item) => (
                      <Cell key={item.status} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#11131D",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "#F4F3EE",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2.5">
              {statusData.map((d) => (
                <Link
                  key={d.status}
                  href={`/library?status=${d.status}`}
                  className="flex items-center justify-between text-xs hover:text-white transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-[#D2D5E2] group-hover:text-white">{d.name}</span>
                  </div>
                  <span className="font-mono font-semibold text-white">{d.value}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Score Distribution */}
      <div className="lg:col-span-7 rounded-2xl card-surface p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">
            {tr("Répartition de vos notes")}
          </h2>
          <span className="text-xs font-mono text-[#858A9E]">{tr("Note / 10")}</span>
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={scoreBuckets}
              margin={{ top: 6, right: 8, left: -24, bottom: 0 }}
            >
              <XAxis
                dataKey="bucket"
                stroke="#656A7E"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                stroke="#656A7E"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  backgroundColor: "#11131D",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "#F4F3EE",
                }}
                formatter={(value: number) => [tr("{n} titres", { n: value }), tr("Notes")]}
                labelFormatter={(label) => tr("Note {n} / 10", { n: String(label) })}
              />
              <Bar
                dataKey="count"
                radius={[8, 8, 2, 2]}
                fill="var(--shiori-accent)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

interface StatsAdvancedChartsProps {
  yearEvolution: YearEvolutionPoint[];
  monthlyActivity: MonthlyActivityPoint[];
  hasMonthlyActivity: boolean;
}

export function StatsAdvancedCharts({
  yearEvolution,
  monthlyActivity,
  hasMonthlyActivity,
}: StatsAdvancedChartsProps) {
  const { tr } = useTranslation();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-6 rounded-2xl card-surface p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-accent" />
            <span>{tr("Par année de sortie")}</span>
          </h3>
          <span className="text-xs font-mono text-[#858A9E]">
            {tr("{n} ans", { n: yearEvolution.length })}
          </span>
        </div>

        {yearEvolution.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-sm text-[#7D8296] text-center px-4">
            {tr("Aucune donnée annuelle disponible.")}
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={yearEvolution}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
              >
                <XAxis dataKey="year" stroke="#656A7E" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="#656A7E" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={{
                    backgroundColor: "#11131D",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#F4F3EE",
                  }}
                  formatter={(value: number, name: string) => [
                    tr("{n} titres", { n: value }),
                    name === "animeCount" ? tr("Animes") : tr("Mangas"),
                  ]}
                  labelFormatter={(label) => tr("Année {year}", { year: String(label) })}
                />
                <Bar dataKey="animeCount" stackId="yr" fill="#38BDF8" radius={[0, 0, 2, 2]} />
                <Bar dataKey="mangaCount" stackId="yr" fill="#A78BFA" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="lg:col-span-6 rounded-2xl card-surface p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-kinpaku" />
            <span>{tr("Activité mensuelle (12 mois)")}</span>
          </h3>
        </div>

        {!hasMonthlyActivity ? (
          <div className="h-52 flex items-center justify-center text-sm text-[#7D8296] text-center px-4">
            {tr("Vos mises à jour apparaîtront mois par mois ici.")}
          </div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyActivity}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
              >
                <XAxis dataKey="label" stroke="#656A7E" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} stroke="#656A7E" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={{
                    backgroundColor: "#11131D",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#F4F3EE",
                  }}
                  formatter={(value: number) => [tr("{n} actions", { n: value }), tr("Activité")]}
                />
                <Bar dataKey="count" fill="#F0B95B" radius={[6, 6, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
