import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Paramètres",
  description: "Gérez votre profil, confidentialité, thèmes, sauvegardes et synchronisations Shiori.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
