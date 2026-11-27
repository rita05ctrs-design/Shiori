import React from "react";

/**
 * Official Next.js App Router Template wrapper.
 * Next.js mounts a fresh Template instance inside LayoutRouter on each navigation,
 * giving every route a silky 240ms GPU entrance (animation-fill-mode: backwards)
 * without ever remounting LayoutRouter, providers, or breaking position: sticky.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="shiori-route-enter w-full min-w-0">{children}</div>;
}
