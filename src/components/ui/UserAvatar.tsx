"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  avatarUrl?: string | null;
  initials: string;
  accentColor?: string;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-7 h-7 text-[11px]",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
  xl: "w-20 h-20 sm:w-24 sm:h-24 text-2xl",
};

export function UserAvatar({
  avatarUrl,
  initials,
  accentColor = "#E5484D",
  alt = "Avatar",
  size = "md",
  className,
}: UserAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  const showImg = Boolean(avatarUrl && avatarUrl.trim() && !imgFailed);

  return (
    <div
      className={cn(
        "rounded-full overflow-hidden flex items-center justify-center font-semibold text-white shrink-0 border border-white/15 select-none",
        SIZE_CLASSES[size],
        className
      )}
      style={
        showImg
          ? undefined
          : {
              background: `linear-gradient(135deg, ${accentColor}, var(--shiori-accent-deep))`,
            }
      }
    >
      {showImg ? (
        <img
          src={avatarUrl!}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  );
}
