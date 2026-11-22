"use client";

import React from "react";
import {
  Archive,
  Award,
  Bookmark,
  BookOpen,
  Camera,
  Clapperboard,
  Compass,
  Crown,
  Diamond,
  Eye,
  Feather,
  Film,
  Flame,
  Footprints,
  Gem,
  Globe,
  Heart,
  Hourglass,
  Infinity as InfinityIcon,
  Layers,
  Library,
  MessageCircle,
  Mic2,
  Moon,
  Orbit,
  Palette,
  PenTool,
  Scale,
  ScrollText,
  Shield,
  Sparkles,
  Star,
  Swords,
  Timer,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import type { BadgeIconKey } from "@/lib/badges";

interface BadgeIconProps {
  iconKey?: BadgeIconKey | string;
  className?: string;
}

export function BadgeIcon({ iconKey, className = "w-5 h-5" }: BadgeIconProps) {
  switch (iconKey) {
    case "footprints":
      return <Footprints className={className} />;
    case "compass":
      return <Compass className={className} />;
    case "flame":
      return <Flame className={className} />;
    case "crown":
      return <Crown className={className} />;
    case "swords":
      return <Swords className={className} />;
    case "zap":
      return <Zap className={className} />;
    case "award":
      return <Award className={className} />;
    case "orbit":
      return <Orbit className={className} />;
    case "book":
      return <BookOpen className={className} />;
    case "scroll":
      return <ScrollText className={className} />;
    case "library":
      return <Library className={className} />;
    case "bookmark":
      return <Bookmark className={className} />;
    case "shield":
      return <Shield className={className} />;
    case "layers":
      return <Layers className={className} />;
    case "feather":
      return <Feather className={className} />;
    case "moon":
      return <Moon className={className} />;
    case "timer":
      return <Timer className={className} />;
    case "hourglass":
      return <Hourglass className={className} />;
    case "infinity":
      return <InfinityIcon className={className} />;
    case "film":
      return <Film className={className} />;
    case "clapperboard":
      return <Clapperboard className={className} />;
    case "palette":
      return <Palette className={className} />;
    case "globe":
      return <Globe className={className} />;
    case "archive":
      return <Archive className={className} />;
    case "gem":
      return <Gem className={className} />;
    case "star":
      return <Star className={className} />;
    case "pen":
      return <PenTool className={className} />;
    case "scale":
      return <Scale className={className} />;
    case "eye":
      return <Eye className={className} />;
    case "diamond":
      return <Diamond className={className} />;
    case "heart":
      return <Heart className={className} />;
    case "mic":
      return <Mic2 className={className} />;
    case "camera":
      return <Camera className={className} />;
    case "message":
      return <MessageCircle className={className} />;
    case "users":
      return <Users className={className} />;
    case "sparkles":
      return <Sparkles className={className} />;
    default:
      return <Trophy className={className} />;
  }
}
