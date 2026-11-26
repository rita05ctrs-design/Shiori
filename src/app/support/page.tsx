import React from "react";
import type { Metadata } from "next";
import { resolveDonationLink } from "@/lib/donation";
import { SupportClient } from "@/components/support/SupportClient";

export const metadata: Metadata = {
  title: "Soutenir Shiori",
  description:
    "Découvrez le projet indépendant Shiori, comment les fonds soutiennent les serveurs et l'IA, et comment recevoir le badge exclusif Supporter.",
};

export default function SupportPage() {
  const donation = resolveDonationLink(process.env.NEXT_PUBLIC_DONATION_URL);
  return <SupportClient donation={donation} />;
}
