import React from "react";
import type { Metadata } from "next";
import { DEFAULT_DONATION_URL, resolveDonationLink } from "@/lib/donation";
import { SupportClient } from "@/components/support/SupportClient";

export const metadata: Metadata = {
  title: "Soutenir Shiori",
  description:
    "Découvrez le projet indépendant Shiori créé par 6t79, soutenez le financement d'Antigravity sur Ko-fi et obtenez le badge Supporter.",
};

export default function SupportPage() {
  const donation = resolveDonationLink(
    process.env.NEXT_PUBLIC_DONATION_URL?.trim() || DEFAULT_DONATION_URL
  );
  return <SupportClient donation={donation} />;
}
