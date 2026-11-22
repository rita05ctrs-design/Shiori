import React from "react";
import type { Metadata } from "next";
import { CommunityClient } from "@/components/social/CommunityClient";

export const metadata: Metadata = {
  title: "Communauté & Activité",
  description:
    "Suivez en temps réel l'activité des membres Shiori, découvrez les profils publics, leurs Voice Actors favoris et échangez par commentaires.",
};

export default function CommunityPage() {
  return <CommunityClient />;
}
