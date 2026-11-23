import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Mes Statistiques",
  description: "Analyses personnelles de visionnage, genres favoris et notes sur Shiori.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
