"use client";

import React from "react";
import { ShioriAiChatPanel } from "@/components/ai/ShioriAiChatPanel";

/**
 * Full-tab native AI Assistant workspace (`/assistant`).
 * Occupies the entire viewport cleanly below the top Navbar and above the mobile
 * bottom dock (or flush to the bottom edge on desktop) with zero boxed window chrome.
 */
export default function AssistantPage() {
  return (
    <div className="h-[100dvh] pt-[calc(3.5rem+env(safe-area-inset-top))] sm:pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-0 w-full flex flex-col overflow-hidden bg-obsidian">
      <ShioriAiChatPanel fullScreen />
    </div>
  );
}
