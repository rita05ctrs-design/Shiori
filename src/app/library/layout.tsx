import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Ma Bibliothèque",
  description: "Votre espace personnel de suivi d'animés, mangas et collections sur Shiori.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LibraryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
