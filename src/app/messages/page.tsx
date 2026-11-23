import React from "react";
import type { Metadata } from "next";
import { MessagesClient } from "@/components/social/MessagesClient";

export const metadata: Metadata = {
  title: "Messages Privés",
  description:
    "Discutez directement en message privé avec les autres membres inscrits sur Shiori.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MessagesPage() {
  return <MessagesClient />;
}
