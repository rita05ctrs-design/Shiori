import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  readAccountDb,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/server/auth-store";
import type {
  ActivityCommentItem,
  CommunityActivityItem,
  ContentReportRecord,
  DirectMessageItem,
  FriendshipRecord,
  PublicUserProfile,
  UserBlockRecord,
} from "@/types/media";

const PROJECT_DATA_DIR = process.env.SHIORI_DATA_DIR
  ? path.resolve(process.env.SHIORI_DATA_DIR)
  : path.join(process.cwd(), ".shiori-data");
const TMP_DATA_DIR = path.join(os.tmpdir(), "shiori-data");

let resolvedDataDir: string | null = null;
const globalMemory = globalThis as unknown as {
  __shioriSocialDbCache?: SocialDatabase;
};

function getWritableSocialPath(): string | null {
  if (resolvedDataDir) {
    return path.join(resolvedDataDir, "social.json");
  }
  for (const dir of [PROJECT_DATA_DIR, TMP_DATA_DIR]) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.accessSync(dir, fs.constants.W_OK);
      resolvedDataDir = dir;
      return path.join(dir, "social.json");
    } catch {
      // try next candidate (e.g. /tmp on Vercel serverless)
    }
  }
  return null;
}

export interface SocialDatabase {
  profiles: PublicUserProfile[];
  activities: CommunityActivityItem[];
  messages: DirectMessageItem[];
  friendships: FriendshipRecord[];
  blocks?: UserBlockRecord[];
  reports?: ContentReportRecord[];
}

function createSeedSocialDb(): SocialDatabase {
  const now = Date.now();
  const h = (hrs: number) => new Date(now - hrs * 3600 * 1000).toISOString();
  const d = (days: number) => new Date(now - days * 86400 * 1000).toISOString();

  const profiles: PublicUserProfile[] = [
    {
      id: "community-sora",
      username: "sora_kyoto",
      displayName: "Sora",
      avatarUrl: "https://s4.anilist.co/file/anilistcdn/character/large/b176754-PCnpqIOkjhFk.png",
      avatarInitials: "SO",
      bio: "Amoureuse de fantasy contemplative, de seinen atmosphériques et des performances d'Atsumi Tanezaki.",
      accentColor: "#8B5CF6",
      isActivityPublic: true,
      joinedAt: d(94),
      favoriteStaff: [
        {
          id: 112215,
          name: "Atsumi Tanezaki",
          nativeName: "種﨑敦美",
          image: "https://s4.anilist.co/file/anilistcdn/staff/large/n112215-kfABGD8W2YSJ.jpg",
          language: "Japanese",
          siteUrl: "https://anilist.co/staff/112215",
          notableRoles: [
            { name: "Frieren", mediaTitle: "Frieren: Beyond Journey's End" },
            { name: "Anya Forger", mediaTitle: "SPY x FAMILY" },
          ],
        },
        {
          id: 95185,
          name: "Kana Hanazawa",
          nativeName: "花澤香菜",
          image: "https://s4.anilist.co/file/anilistcdn/staff/large/n95185-x8ZYvtN7SegC.png",
          language: "Japanese",
          siteUrl: "https://anilist.co/staff/95185",
          notableRoles: [
            { name: "Mitsuri Kanroji", mediaTitle: "Demon Slayer" },
            { name: "Mayuri Shiina", mediaTitle: "Steins;Gate" },
          ],
        },
      ],
      favoriteMedia: [
        {
          mediaId: 154587,
          type: "ANIME",
          title: "Frieren: Beyond Journey's End",
          coverImage:
            "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg",
          score: 10,
        },
        {
          mediaId: 195516,
          type: "ANIME",
          title: "The Apothecary Diaries Season 3",
          coverImage:
            "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx195516-MJpUZlOberqH.jpg",
          score: 9.5,
        },
      ],
      libraryPreview: [
        {
          mediaId: 154587,
          type: "ANIME",
          title: "Frieren: Beyond Journey's End",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg",
          score: 10,
          status: "COMPLETED",
          isFavorite: true,
          genres: ["Adventure", "Drama", "Fantasy"],
        },
        {
          mediaId: 457,
          type: "ANIME",
          title: "MUSHI-SHI",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx457-l6cTtNgI9Bi6.png",
          score: 9.5,
          status: "COMPLETED",
          isFavorite: true,
          genres: ["Adventure", "Fantasy", "Mystery", "Slice of Life"],
        },
        {
          mediaId: 9253,
          type: "ANIME",
          title: "Steins;Gate",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx9253-tIUXF2gfU8Sg.jpg",
          score: 9.5,
          status: "COMPLETED",
          isFavorite: true,
          genres: ["Drama", "Psychological", "Sci-Fi", "Thriller"],
        },
        {
          mediaId: 5114,
          type: "ANIME",
          title: "Fullmetal Alchemist: Brotherhood",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx5114-nSWCgQlmOMtj.jpg",
          score: 9.5,
          status: "COMPLETED",
          genres: ["Action", "Adventure", "Drama", "Fantasy"],
        },
        {
          mediaId: 19,
          type: "ANIME",
          title: "Monster",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx19-gtMC64182sm4.jpg",
          score: 9.5,
          status: "COMPLETED",
          genres: ["Drama", "Mystery", "Psychological", "Thriller"],
        },
        {
          mediaId: 30104,
          type: "MANGA",
          title: "Yotsuba&!",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30104-sUVzNlTWZ5cu.jpg",
          score: 9.5,
          status: "COMPLETED",
          isFavorite: true,
          genres: ["Comedy", "Slice of Life"],
        },
        {
          mediaId: 13601,
          type: "ANIME",
          title: "PSYCHO-PASS",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx13601-i42VFuHpqEOJ.jpg",
          score: 9,
          status: "COMPLETED",
          genres: ["Action", "Psychological", "Sci-Fi", "Thriller"],
        },
        {
          mediaId: 16498,
          type: "ANIME",
          title: "Attack on Titan",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg",
          score: 9,
          status: "COMPLETED",
          genres: ["Action", "Drama", "Fantasy", "Mystery"],
        },
        {
          mediaId: 108632,
          type: "ANIME",
          title: "Re:ZERO -Starting Life in Another World- Season 2",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx108632-lQWnmw7XaNOK.jpg",
          score: 9,
          status: "COMPLETED",
          genres: ["Action", "Drama", "Fantasy", "Psychological"],
        },
        {
          mediaId: 30001,
          type: "MANGA",
          title: "Monster",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30001-Knby7l1jevE7.jpg",
          score: 9.5,
          status: "COMPLETED",
          genres: ["Drama", "Mystery", "Psychological", "Thriller"],
        },
      ],
      stats: {
        totalEntries: 184,
        animeCount: 142,
        mangaCount: 42,
        episodesWatched: 2480,
        chaptersRead: 1620,
        completedCount: 138,
        meanScore: 8.6,
      },
      unlockedBadges: [
        { badgeId: "anime_first_step", unlockedAt: d(92) },
        { badgeId: "anime_explorer", unlockedAt: d(80) },
        { badgeId: "anime_otaku", unlockedAt: d(45) },
        { badgeId: "anime_legend", unlockedAt: d(12) },
        { badgeId: "manga_curious", unlockedAt: d(74) },
        { badgeId: "manga_devourer", unlockedAt: d(28) },
        { badgeId: "critic_sharp", unlockedAt: d(65) },
        { badgeId: "heart_collector", unlockedAt: d(50) },
        { badgeId: "known_face", unlockedAt: d(93) },
        { badgeId: "active_member", unlockedAt: d(20) },
      ],
      pinnedBadges: ["anime_legend", "manga_devourer", "active_member"],
      socialInteractionsCount: 14,
      source: "community",
    },
    {
      id: "community-ren",
      username: "ren_seinen",
      displayName: "Ren",
      avatarUrl: "https://s4.anilist.co/file/anilistcdn/character/large/b422-XTaiTuvRohsV.png",
      avatarInitials: "RE",
      bio: "Lecteur nocturne de Berserk, Vagabond et Vinland Saga. Fan absolu de la voix grave de Kenjiro Tsuda.",
      accentColor: "#E5484D",
      isActivityPublic: true,
      joinedAt: d(142),
      favoriteStaff: [
        {
          id: 95591,
          name: "Kenjirou Tsuda",
          nativeName: "津田健次郎",
          image: "https://s4.anilist.co/file/anilistcdn/staff/large/n95591-WQGdD3ubbeoq.jpg",
          language: "Japanese",
          siteUrl: "https://anilist.co/staff/95591",
          notableRoles: [
            { name: "Kento Nanami", mediaTitle: "Jujutsu Kaisen" },
            { name: "Seto Kaiba", mediaTitle: "Yu-Gi-Oh!" },
          ],
        },
        {
          id: 95118,
          name: "Hiroshi Kamiya",
          nativeName: "神谷浩史",
          image: "https://s4.anilist.co/file/anilistcdn/staff/large/n95118-oOElrn1aSaiC.png",
          language: "Japanese",
          siteUrl: "https://anilist.co/staff/95118",
          notableRoles: [
            { name: "Levi Ackerman", mediaTitle: "Attack on Titan" },
            { name: "Trafalgar Law", mediaTitle: "ONE PIECE" },
          ],
        },
      ],
      favoriteMedia: [
        {
          mediaId: 30002,
          type: "MANGA",
          title: "Berserk",
          coverImage:
            "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30002-Cul4OeN7bYtn.jpg",
          score: 10,
        },
        {
          mediaId: 21,
          type: "ANIME",
          title: "ONE PIECE",
          coverImage:
            "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-ELSYx3yMPcKM.jpg",
          score: 9.5,
        },
      ],
      libraryPreview: [
        {
          mediaId: 30002,
          type: "MANGA",
          title: "Berserk",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30002-Cul4OeN7bYtn.jpg",
          score: 10,
          status: "COMPLETED",
          isFavorite: true,
          genres: ["Action", "Adventure", "Drama", "Fantasy", "Horror", "Psychological"],
        },
        {
          mediaId: 30656,
          type: "MANGA",
          title: "Vagabond",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30656-9mW113O7rDnA.png",
          score: 10,
          status: "COMPLETED",
          isFavorite: true,
          genres: ["Action", "Adventure", "Drama"],
        },
        {
          mediaId: 31706,
          type: "MANGA",
          title: "JoJo's Bizarre Adventure: Part 7–Steel Ball Run",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx31706-lRncu9VbcBB7.png",
          score: 9.5,
          status: "COMPLETED",
          isFavorite: true,
          genres: ["Action", "Adventure", "Drama", "Mystery", "Supernatural"],
        },
        {
          mediaId: 30642,
          type: "MANGA",
          title: "Vinland Saga",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30642-0mjRDkf4THpo.jpg",
          score: 9.5,
          status: "COMPLETED",
          genres: ["Action", "Adventure", "Drama"],
        },
        {
          mediaId: 21,
          type: "ANIME",
          title: "ONE PIECE",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21-ELSYx3yMPcKM.jpg",
          score: 9.5,
          status: "WATCHING",
          isFavorite: true,
          genres: ["Action", "Adventure", "Comedy", "Drama", "Fantasy"],
        },
        {
          mediaId: 113415,
          type: "ANIME",
          title: "JUJUTSU KAISEN",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-LHBAeoZDIsnF.jpg",
          score: 9,
          status: "COMPLETED",
          genres: ["Action", "Drama", "Supernatural"],
        },
        {
          mediaId: 127230,
          type: "ANIME",
          title: "Chainsaw Man",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-DdP4vAdssLoz.png",
          score: 9,
          status: "COMPLETED",
          genres: ["Action", "Drama", "Horror", "Supernatural"],
        },
        {
          mediaId: 16498,
          type: "ANIME",
          title: "Attack on Titan",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg",
          score: 9.5,
          status: "COMPLETED",
          genres: ["Action", "Drama", "Fantasy", "Mystery"],
        },
        {
          mediaId: 19,
          type: "ANIME",
          title: "Monster",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx19-gtMC64182sm4.jpg",
          score: 9.5,
          status: "COMPLETED",
          genres: ["Drama", "Horror", "Mystery", "Psychological", "Thriller"],
        },
      ],
      stats: {
        totalEntries: 268,
        animeCount: 175,
        mangaCount: 93,
        episodesWatched: 3910,
        chaptersRead: 5420,
        completedCount: 210,
        meanScore: 8.3,
      },
      unlockedBadges: [
        { badgeId: "anime_first_step", unlockedAt: d(140) },
        { badgeId: "anime_explorer", unlockedAt: d(125) },
        { badgeId: "anime_otaku", unlockedAt: d(90) },
        { badgeId: "anime_legend", unlockedAt: d(2) },
        { badgeId: "manga_curious", unlockedAt: d(132) },
        { badgeId: "manga_devourer", unlockedAt: d(100) },
        { badgeId: "manga_supreme", unlockedAt: d(35) },
        { badgeId: "critic_sharp", unlockedAt: d(110) },
        { badgeId: "known_face", unlockedAt: d(141) },
        { badgeId: "active_member", unlockedAt: d(42) },
      ],
      pinnedBadges: ["anime_legend", "manga_supreme", "critic_sharp"],
      socialInteractionsCount: 22,
      source: "community",
    },
    {
      id: "community-hana",
      username: "hana_sakura",
      displayName: "Hana",
      avatarUrl: null,
      avatarInitials: "HA",
      bio: "Romance slice-of-life, films d'animation japonais et découvertes saisonnières chaque dimanche.",
      accentColor: "#F472B6",
      isActivityPublic: true,
      joinedAt: d(58),
      favoriteStaff: [
        {
          id: 95065,
          name: "Mamoru Miyano",
          nativeName: "宮野真守",
          image: "https://s4.anilist.co/file/anilistcdn/staff/large/n95065-eyynywrhombR.png",
          language: "Japanese",
          siteUrl: "https://anilist.co/staff/95065",
          notableRoles: [
            { name: "Rintarou Okabe", mediaTitle: "Steins;Gate" },
            { name: "Light Yagami", mediaTitle: "Death Note" },
          ],
        },
      ],
      favoriteMedia: [
        {
          mediaId: 154587,
          type: "ANIME",
          title: "Frieren: Beyond Journey's End",
          coverImage:
            "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg",
          score: 9.5,
        },
      ],
      libraryPreview: [
        {
          mediaId: 21519,
          type: "ANIME",
          title: "Your Name.",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx21519-SUo3ZQuCbYhJ.png",
          score: 10,
          status: "COMPLETED",
          isFavorite: true,
          genres: ["Drama", "Romance", "Supernatural"],
        },
        {
          mediaId: 154587,
          type: "ANIME",
          title: "Frieren: Beyond Journey's End",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg",
          score: 9.5,
          status: "COMPLETED",
          isFavorite: true,
          genres: ["Adventure", "Drama", "Fantasy"],
        },
        {
          mediaId: 30104,
          type: "MANGA",
          title: "Yotsuba&!",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30104-sUVzNlTWZ5cu.jpg",
          score: 9.5,
          status: "COMPLETED",
          isFavorite: true,
          genres: ["Comedy", "Slice of Life"],
        },
        {
          mediaId: 101922,
          type: "ANIME",
          title: "Demon Slayer: Kimetsu no Yaiba",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg",
          score: 8.5,
          status: "COMPLETED",
          genres: ["Action", "Adventure", "Drama", "Fantasy"],
        },
        {
          mediaId: 457,
          type: "ANIME",
          title: "MUSHI-SHI",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx457-l6cTtNgI9Bi6.png",
          score: 9.5,
          status: "COMPLETED",
          genres: ["Adventure", "Fantasy", "Mystery", "Slice of Life"],
        },
        {
          mediaId: 98659,
          type: "ANIME",
          title: "Classroom of the Elite",
          coverImage: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx98659-WNyPLIZDpGGY.jpg",
          score: 8.5,
          status: "COMPLETED",
          genres: ["Drama", "Psychological"],
        },
      ],
      stats: {
        totalEntries: 112,
        animeCount: 96,
        mangaCount: 16,
        episodesWatched: 1410,
        chaptersRead: 480,
        completedCount: 84,
        meanScore: 8.8,
      },
      unlockedBadges: [
        { badgeId: "anime_first_step", unlockedAt: d(56) },
        { badgeId: "anime_explorer", unlockedAt: d(48) },
        { badgeId: "anime_otaku", unlockedAt: d(18) },
        { badgeId: "manga_curious", unlockedAt: d(39) },
        { badgeId: "critic_sharp", unlockedAt: d(30) },
        { badgeId: "active_member", unlockedAt: d(10) },
      ],
      pinnedBadges: ["anime_otaku", "active_member", "critic_sharp"],
      socialInteractionsCount: 9,
      source: "community",
    },
  ];

  const activities: CommunityActivityItem[] = [
    {
      id: "act-seed-badge-1",
      userId: "community-ren",
      actorUsername: "ren_seinen",
      actorDisplayName: "Ren",
      actorAvatarUrl: profiles[1].avatarUrl,
      actorAccentColor: "#E5484D",
      actorPinnedBadges: profiles[1].pinnedBadges,
      kind: "BADGE_UNLOCKED",
      mediaId: 0,
      mediaTitle: "Légende de l'Animation",
      mediaType: "BADGE",
      coverImage: null,
      action: "a débloqué le badge Légende de l'Animation !",
      badgeId: "anime_legend",
      badgeRarity: "legendary",
      isPublic: true,
      createdAt: h(0.7),
      likes: ["community-sora", "community-hana"],
      comments: [
        {
          id: "cmt-seed-badge-1",
          activityId: "act-seed-badge-1",
          userId: "community-sora",
          authorUsername: "sora_kyoto",
          authorDisplayName: "Sora",
          authorAvatarUrl: profiles[0].avatarUrl,
          authorAccentColor: "#8B5CF6",
          body: "GG pour le palier légendaire des 100 animés terminés !",
          createdAt: h(0.4),
        },
      ],
    },
    {
      id: "act-seed-1",
      userId: "community-sora",
      actorUsername: "sora_kyoto",
      actorDisplayName: "Sora",
      actorAvatarUrl: profiles[0].avatarUrl,
      actorAccentColor: "#8B5CF6",
      actorPinnedBadges: profiles[0].pinnedBadges,
      kind: "FAVORITE_MEDIA",
      mediaId: 154587,
      mediaTitle: "Frieren: Beyond Journey's End",
      mediaType: "ANIME",
      coverImage:
        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg",
      action: "A ajouté en coup de cœur",
      score: 10,
      isPublic: true,
      createdAt: h(1.5),
      likes: ["community-ren", "community-hana"],
      comments: [
        {
          id: "cmt-seed-1",
          activityId: "act-seed-1",
          userId: "community-hana",
          authorUsername: "hana_sakura",
          authorDisplayName: "Hana",
          authorAvatarUrl: null,
          authorAccentColor: "#F472B6",
          body: "Chef-d'œuvre absolu, chaque épisode donne des frissons !",
          createdAt: h(1),
        },
      ],
    },
    {
      id: "act-seed-2",
      userId: "community-ren",
      actorUsername: "ren_seinen",
      actorDisplayName: "Ren",
      actorAvatarUrl: profiles[1].avatarUrl,
      actorAccentColor: "#E5484D",
      actorPinnedBadges: profiles[1].pinnedBadges,
      kind: "FAVORITE_STAFF",
      mediaId: 95591,
      mediaTitle: "Kenjirou Tsuda",
      mediaType: "STAFF",
      coverImage: "https://s4.anilist.co/file/anilistcdn/staff/large/n95591-WQGdD3ubbeoq.jpg",
      action: "A ajouté en Voice Actor favori (Seiyuu)",
      isPublic: true,
      createdAt: h(3.5),
      likes: ["community-sora"],
      comments: [],
    },
    {
      id: "act-seed-3",
      userId: "community-hana",
      actorUsername: "hana_sakura",
      actorDisplayName: "Hana",
      actorAvatarUrl: null,
      actorAccentColor: "#F472B6",
      actorPinnedBadges: profiles[2].pinnedBadges,
      kind: "SCORED",
      mediaId: 195516,
      mediaTitle: "The Apothecary Diaries Season 3",
      mediaType: "ANIME",
      coverImage:
        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx195516-MJpUZlOberqH.jpg",
      action: "A attribué la note de 9.5/10",
      score: 9.5,
      isPublic: true,
      createdAt: h(6),
      likes: ["community-sora"],
      comments: [],
    },
    {
      id: "act-seed-4",
      userId: "community-ren",
      actorUsername: "ren_seinen",
      actorDisplayName: "Ren",
      actorAvatarUrl: profiles[1].avatarUrl,
      actorAccentColor: "#E5484D",
      actorPinnedBadges: profiles[1].pinnedBadges,
      kind: "COMPLETED",
      mediaId: 30002,
      mediaTitle: "Berserk",
      mediaType: "MANGA",
      coverImage:
        "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30002-Cul4OeN7bYtn.jpg",
      action: "A terminé la série · ★ 10/10",
      score: 10,
      isPublic: true,
      createdAt: h(14),
      likes: ["community-sora", "community-hana"],
      comments: [],
    },
  ];

  const messages: DirectMessageItem[] = [
    {
      id: "dm-seed-1",
      senderId: "community-sora",
      recipientId: "local-curator",
      senderUsername: "sora_kyoto",
      senderDisplayName: "Sora",
      senderAvatarUrl: profiles[0].avatarUrl,
      recipientUsername: "kuro_shiori",
      recipientDisplayName: "Kuro",
      recipientAvatarUrl: null,
      body: "Salut ! Bienvenue sur la communauté Shiori ✨ J'ai vu que tu suis Frieren et The Apothecary Diaries, tu as déjà vu les derniers épisodes de cette semaine ?",
      isRead: false,
      createdAt: h(0.8),
    },
  ];

  return { profiles, activities, messages, friendships: [], blocks: [], reports: [] };
}

export function isLocalPairBlocked(userAId: string, userBId: string): boolean {
  const db = readSocialDb();
  const blocks = db.blocks ?? [];
  return blocks.some(
    (b) =>
      (b.blockerId === userAId && b.blockedId === userBId) ||
      (b.blockerId === userBId && b.blockedId === userAId)
  );
}

export function readSocialDb(): SocialDatabase {
  const filePath = getWritableSocialPath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<SocialDatabase>;
      const loaded: SocialDatabase = {
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        activities: Array.isArray(parsed.activities) ? parsed.activities : [],
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        friendships: Array.isArray(parsed.friendships) ? parsed.friendships : [],
        blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      };
      // Automatically backfill libraryPreview onto seeded profiles from older social.json files
      const needsSeedBackfill = loaded.profiles.some(
        (p) =>
          (p.id === "community-sora" || p.id === "community-ren" || p.id === "community-hana") &&
          (!Array.isArray(p.libraryPreview) || p.libraryPreview.length === 0)
      );
      if (needsSeedBackfill) {
        const seedById = new Map(createSeedSocialDb().profiles.map((sp) => [sp.id, sp]));
        loaded.profiles = loaded.profiles.map((p) => {
          const sp = seedById.get(p.id);
          if (sp && (!Array.isArray(p.libraryPreview) || p.libraryPreview.length === 0)) {
            return { ...p, libraryPreview: sp.libraryPreview };
          }
          return p;
        });
      }
      globalMemory.__shioriSocialDbCache = loaded;
      return loaded;
    } catch {
      // fall through cleanly
    }
  }

  if (globalMemory.__shioriSocialDbCache) {
    return globalMemory.__shioriSocialDbCache;
  }

  const seed = createSeedSocialDb();
  writeSocialDb(seed);
  return seed;
}

export function writeSocialDb(db: SocialDatabase) {
  globalMemory.__shioriSocialDbCache = db;
  const filePath = getWritableSocialPath();
  if (!filePath) return;
  try {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, filePath);
  } catch {
    // Never crash serverless handlers if filesystem is read-only; in-memory cache stays updated
  }
}

/**
 * Guarantees that an authenticated Supabase user has a row in `public.profiles`
 * (retrying with a unique suffix on username collision) so `public_profiles`,
 * `friendships`, `activity_events` and `direct_messages` never fail foreign-key checks.
 */
export async function ensureServerSupabaseProfile(
  supabase: SupabaseClient,
  actor: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    accentColor?: string;
  }
): Promise<{ ok: boolean; username: string; error?: string }> {
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", actor.id)
      .maybeSingle();

    if (existing?.id) {
      return { ok: true, username: String(existing.username || actor.username) };
    }

    const cleanBase =
      actor.username
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 24) || `user_${actor.id.slice(0, 6)}`;

    const baseRow = {
      id: actor.id,
      username: cleanBase,
      display_name: actor.displayName || cleanBase,
      avatar_url: actor.avatarUrl ?? null,
      accent_color: actor.accentColor || "#E5484D",
      is_activity_public: true,
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(baseRow, { onConflict: "id" });

    if (!error) {
      return { ok: true, username: cleanBase };
    }

    // Retry with unique suffix if username collided with another member
    const fallbackUsername = `${cleanBase.slice(0, 20)}_${actor.id.slice(0, 5)}`;
    const retry = await supabase
      .from("profiles")
      .upsert({ ...baseRow, username: fallbackUsername }, { onConflict: "id" });

    if (!retry.error) {
      return { ok: true, username: fallbackUsername };
    }

    return { ok: false, username: cleanBase, error: retry.error.message };
  } catch (err) {
    return {
      ok: false,
      username: actor.username,
      error: err instanceof Error ? err.message : "Erreur initialisation profil",
    };
  }
}

export function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export interface ActiveActor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accentColor: string;
  source: "supabase" | "account" | "local";
}

export function isAuthenticatedActor(actor: ActiveActor): boolean {
  return actor.source === "supabase" || actor.source === "account";
}

/**
 * Resolves the active user STRICTLY from cryptographically verified server credentials:
 * 1) Supabase Auth JWT session cookie (`supabase.auth.getUser()`), or
 * 2) Signed HttpOnly `shiori_session` HMAC cookie (`accounts.json`).
 *
 * SECURITY: Never trusts client-supplied `userId` or `username` to impersonate another user!
 * Unauthenticated callers always resolve to the non-privileged guest actor (`source: "local"`).
 */
export async function resolveServerActor(): Promise<ActiveActor> {
  // 1) Supabase Auth user (server-verified JWT)
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        let username =
          (user.user_metadata?.username as string) ||
          user.email?.split("@")[0] ||
          `user_${user.id.slice(0, 6)}`;
        let displayName =
          (user.user_metadata?.display_name as string) ||
          (user.user_metadata?.full_name as string) ||
          username;
        let avatarUrl: string | null =
          (user.user_metadata?.avatar_url as string) ?? null;
        let accentColor = "#E5484D";

        const { data: pRow } = await supabase
          .from("profiles")
          .select("username, display_name, avatar_url, accent_color")
          .eq("id", user.id)
          .maybeSingle();

        if (pRow) {
          if (pRow.username) username = pRow.username;
          if (pRow.display_name) displayName = pRow.display_name;
          if (pRow.avatar_url !== undefined) avatarUrl = pRow.avatar_url;
          if (pRow.accent_color) accentColor = pRow.accent_color;
        }

        return {
          id: user.id,
          username,
          displayName,
          avatarUrl,
          accentColor,
          source: "supabase",
        };
      }
    }
  } catch {
    // fall through cleanly
  }

  // 2) Built-in Shiori server account (HMAC-signed HttpOnly cookie)
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const uid = verifySessionToken(token);
    if (uid) {
      const db = readAccountDb();
      const acct = db.users.find((u) => u.id === uid);
      if (acct) {
        return {
          id: acct.id,
          username: acct.username,
          displayName: acct.displayName,
          avatarUrl: acct.avatarUrl ?? null,
          accentColor: acct.accentColor || "#E5484D",
          source: "account",
        };
      }
    }
  } catch {
    // fall through
  }

  // 3) Unauthenticated guest — NEVER trusts client-supplied userId/username
  return {
    id: "local-curator",
    username: "kuro_shiori",
    displayName: "Kuro",
    avatarUrl: null,
    accentColor: "#E5484D",
    source: "local",
  };
}

/**
 * Permanently scrubs all local social records associated with a deleted account.
 */
export function purgeLocalUserData(userId: string) {
  const db = readSocialDb();
  db.profiles = db.profiles.filter((p) => p.id !== userId);
  db.activities = db.activities
    .filter((a) => a.userId !== userId)
    .map((a) => ({
      ...a,
      likes: a.likes.filter((id) => id !== userId),
      comments: a.comments.filter((c) => c.userId !== userId),
    }));
  db.messages = db.messages.filter(
    (m) => m.senderId !== userId && m.recipientId !== userId
  );
  db.friendships = db.friendships.filter(
    (f) => f.requesterId !== userId && f.addresseeId !== userId
  );
  db.blocks = (db.blocks ?? []).filter(
    (b) => b.blockerId !== userId && b.blockedId !== userId
  );
  db.reports = (db.reports ?? []).filter((r) => r.reporterId !== userId);
  writeSocialDb(db);
}

/**
 * Merges registered local Shiori accounts + persisted social profiles into one deduplicated list.
 */
export function getAllLocalCommunityProfiles(): PublicUserProfile[] {
  const socialDb = readSocialDb();
  const byUsername = new Map<string, PublicUserProfile>();

  for (const p of socialDb.profiles) {
    byUsername.set(p.username.toLowerCase(), p);
  }

  // Also include any registered local server accounts from .shiori-data/accounts.json
  try {
    const acctDb = readAccountDb();
    for (const u of acctDb.users) {
      const key = u.username.toLowerCase();
      if (byUsername.has(key)) continue;
      const lib = u.library ?? [];
      const scored = lib.filter((e) => e.score !== null);
      const meanScore = scored.length
        ? Math.round((scored.reduce((a, b) => a + (b.score ?? 0), 0) / scored.length) * 10) / 10
        : null;
      byUsername.set(key, {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl ?? null,
        avatarInitials: u.avatarInitials,
        bio: u.bio,
        accentColor: u.accentColor || "#E5484D",
        isActivityPublic: u.isActivityPublic ?? true,
        joinedAt: u.joinedAt,
        favoriteStaff: u.favoriteStaff ?? [],
        favoriteMedia: lib
          .filter((e) => e.isFavorite)
          .slice(0, 8)
          .map((e) => ({
            mediaId: e.mediaId,
            type: e.type,
            title: e.title,
            coverImage: e.coverImage,
            score: e.score,
          })),
        libraryPreview: [...lib]
          .sort(
            (a, b) =>
              Number(b.isFavorite) - Number(a.isFavorite) ||
              (b.score ?? -1) - (a.score ?? -1)
          )
          .slice(0, 80)
          .map((e) => ({
            mediaId: e.mediaId,
            type: e.type,
            title: e.title,
            coverImage: e.coverImage,
            score: e.score,
            status: e.status,
            isFavorite: e.isFavorite,
            genres: Array.isArray(e.genres) ? e.genres.slice(0, 5) : undefined,
          })),
        stats: {
          totalEntries: lib.length,
          animeCount: lib.filter((e) => e.type === "ANIME").length,
          mangaCount: lib.filter((e) => e.type === "MANGA").length,
          episodesWatched: lib
            .filter((e) => e.type === "ANIME")
            .reduce((a, b) => a + b.progress, 0),
          chaptersRead: lib
            .filter((e) => e.type === "MANGA")
            .reduce((a, b) => a + b.progress, 0),
          completedCount: lib.filter((e) => e.status === "COMPLETED").length,
          meanScore,
        },
        unlockedBadges: u.unlockedBadges ?? [],
        pinnedBadges: (u.pinnedBadges ?? []).slice(0, 3),
        socialInteractionsCount: u.socialInteractionsCount ?? 0,
        source: "local",
      });
    }
  } catch {
    // ignore
  }

  return Array.from(byUsername.values());
}

export function upsertLocalCommunityProfile(profile: PublicUserProfile) {
  const db = readSocialDb();
  const idx = db.profiles.findIndex(
    (p) =>
      p.id === profile.id ||
      p.username.toLowerCase() === profile.username.toLowerCase()
  );
      if (idx === -1) {
    db.profiles.unshift(profile);
  } else {
    // SECURITY: Never overwrite another user's profile on username collision; match strictly by id
    const byId = db.profiles.findIndex((p) => p.id === profile.id);
    if (byId !== -1) {
      db.profiles[byId] = { ...db.profiles[byId], ...profile };
    } else {
      db.profiles.unshift(profile);
    }
  }
  writeSocialDb(db);
}

export function pushLocalActivity(item: CommunityActivityItem) {
  const db = readSocialDb();
  db.activities.unshift(item);
  db.activities = db.activities.slice(0, 120);
  writeSocialDb(db);
}

export function toggleLocalActivityLike(activityId: string, userId: string): {
  liked: boolean;
  likes: string[];
} | null {
  const db = readSocialDb();
  const target = db.activities.find((a) => a.id === activityId);
  if (!target) return null;
  const exists = target.likes.includes(userId);
  target.likes = exists
    ? target.likes.filter((id) => id !== userId)
    : [...target.likes, userId];
  writeSocialDb(db);
  return { liked: !exists, likes: target.likes };
}

export function addLocalActivityComment(
  activityId: string,
  comment: ActivityCommentItem
): ActivityCommentItem | null {
  const db = readSocialDb();
  const target = db.activities.find((a) => a.id === activityId);
  if (!target) return null;
  target.comments.push(comment);
  writeSocialDb(db);
  return comment;
}
