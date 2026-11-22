import type {
  FavoriteVoiceActor,
  LibraryEntry,
  MediaType,
  PublicProfileLibraryItem,
  PublicUserProfile,
} from "@/types/media";

export interface CommonMediaMatch {
  mediaId: number;
  type: MediaType;
  title: string;
  coverImage: string;
  viewerScore: number | null;
  targetScore: number | null;
  scoreDiff: number | null;
  bothFavorite: boolean;
  targetFavorite: boolean;
  viewerFavorite: boolean;
}

export interface ProfileAffinityRecommendation {
  mediaId: number;
  type: MediaType;
  title: string;
  coverImage: string;
  targetScore: number | null;
  genres: string[];
  reason: string;
}

export interface ProfileAffinityResult {
  compatibilityPct: number;
  tierLabel: string;
  tierTone: "emerald" | "violet" | "sky" | "amber";
  commonTitles: CommonMediaMatch[];
  sharedFavorites: CommonMediaMatch[];
  sharedStaff: FavoriteVoiceActor[];
  avgScoreDiff: number | null;
  ratedCommonCount: number;
  recommendationsFromTarget: ProfileAffinityRecommendation[];
  targetPoolSize: number;
}

export function computeProfileAffinity(input: {
  viewerLibrary: LibraryEntry[];
  viewerFavoriteStaff: FavoriteVoiceActor[];
  targetProfile: PublicUserProfile;
}): ProfileAffinityResult {
  const { viewerLibrary, viewerFavoriteStaff, targetProfile } = input;

  // 1) Build unified target catalog pool (libraryPreview + favoriteMedia, deduped by mediaId)
  const targetPoolMap = new Map<number, PublicProfileLibraryItem>();
  for (const item of targetProfile.libraryPreview ?? []) {
    targetPoolMap.set(item.mediaId, { ...item });
  }
  for (const fav of targetProfile.favoriteMedia ?? []) {
    const existing = targetPoolMap.get(fav.mediaId);
    targetPoolMap.set(fav.mediaId, {
      mediaId: fav.mediaId,
      type: fav.type,
      title: fav.title,
      coverImage: fav.coverImage,
      score: fav.score ?? existing?.score ?? null,
      status: existing?.status ?? "COMPLETED",
      isFavorite: true,
      genres: existing?.genres ?? [],
    });
  }
  const targetPool = Array.from(targetPoolMap.values());

  const viewerById = new Map<number, LibraryEntry>();
  for (const e of viewerLibrary) {
    viewerById.set(e.mediaId, e);
  }

  // 2) Common titles & shared favorites
  const commonTitles: CommonMediaMatch[] = [];
  for (const t of targetPool) {
    const v = viewerById.get(t.mediaId);
    if (!v) continue;
    const viewerScore = v.score ?? null;
    const targetScore = t.score ?? null;
    const scoreDiff =
      viewerScore !== null && targetScore !== null
        ? Math.round(Math.abs(viewerScore - targetScore) * 10) / 10
        : null;
    const targetFav = Boolean(t.isFavorite);
    const viewerFav = Boolean(v.isFavorite);
    commonTitles.push({
      mediaId: t.mediaId,
      type: t.type,
      title: t.title || v.title,
      coverImage: t.coverImage || v.coverImage,
      viewerScore,
      targetScore,
      scoreDiff,
      bothFavorite: targetFav && viewerFav,
      targetFavorite: targetFav,
      viewerFavorite: viewerFav,
    });
  }

  // Sort common titles: both favorites first, then highest combined rating
  commonTitles.sort((a, b) => {
    if (a.bothFavorite !== b.bothFavorite) return a.bothFavorite ? -1 : 1;
    const favCountA = (a.targetFavorite ? 1 : 0) + (a.viewerFavorite ? 1 : 0);
    const favCountB = (b.targetFavorite ? 1 : 0) + (b.viewerFavorite ? 1 : 0);
    if (favCountB !== favCountA) return favCountB - favCountA;
    const sumA = (a.viewerScore ?? 0) + (a.targetScore ?? 0);
    const sumB = (b.viewerScore ?? 0) + (b.targetScore ?? 0);
    return sumB - sumA;
  });

  // Shared favorites (strict mutual favorites first; also include mutual 9+ gems if < 3 exact)
  const exactSharedFavs = commonTitles.filter((c) => c.bothFavorite);
  const sharedFavorites =
    exactSharedFavs.length > 0
      ? exactSharedFavs
      : commonTitles.filter(
          (c) =>
            (c.targetFavorite || c.viewerFavorite) &&
            (c.viewerScore === null || c.viewerScore >= 8) &&
            (c.targetScore === null || c.targetScore >= 8)
        );

  // 3) Shared Voice Actors (Seiyuu)
  const viewerStaffIds = new Set(viewerFavoriteStaff.map((s) => s.id));
  const sharedStaff = (targetProfile.favoriteStaff ?? []).filter((s) =>
    viewerStaffIds.has(s.id)
  );

  // 4) Rating agreement on commonly rated titles
  const ratedCommon = commonTitles.filter((c) => c.scoreDiff !== null);
  const avgScoreDiff = ratedCommon.length
    ? Math.round(
        (ratedCommon.reduce((acc, c) => acc + (c.scoreDiff ?? 0), 0) / ratedCommon.length) *
          10
      ) / 10
    : null;

  // Genre overlap similarity (cosine similarity on genre frequency vectors)
  const viewerGenreWeights = new Map<string, number>();
  for (const e of viewerLibrary) {
    const w = e.isFavorite ? 2.5 : (e.score ?? 7) >= 8 ? 1.5 : 1;
    for (const g of e.genres ?? []) {
      const k = g.toLowerCase();
      viewerGenreWeights.set(k, (viewerGenreWeights.get(k) ?? 0) + w);
    }
  }
  const targetGenreWeights = new Map<string, number>();
  for (const t of targetPool) {
    const w = t.isFavorite ? 2.5 : (t.score ?? 7) >= 8 ? 1.5 : 1;
    for (const g of t.genres ?? []) {
      const k = g.toLowerCase();
      targetGenreWeights.set(k, (targetGenreWeights.get(k) ?? 0) + w);
    }
  }

  let genreSimilarity = 0;
  if (viewerGenreWeights.size > 0 && targetGenreWeights.size > 0) {
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (const [k, vA] of viewerGenreWeights) {
      magA += vA * vA;
      const vB = targetGenreWeights.get(k);
      if (vB) dot += vA * vB;
    }
    for (const vB of targetGenreWeights.values()) {
      magB += vB * vB;
    }
    if (magA > 0 && magB > 0) {
      genreSimilarity = Math.round((dot / (Math.sqrt(magA) * Math.sqrt(magB))) * 100);
    }
  }

  // Overlap coverage relative to smaller library slice
  const denom = Math.max(1, Math.min(targetPool.length, Math.max(1, viewerLibrary.length)));
  const overlapRatioPct = Math.min(100, Math.round((commonTitles.length / denom) * 100));

  // Final weighted compatibility percentage (0–99% realistic editorial scale)
  let rawScore = 52;
  if (ratedCommon.length >= 2 && avgScoreDiff !== null) {
    const ratingAgreement = Math.max(18, Math.min(100, Math.round(100 - avgScoreDiff * 12)));
    const overlapComponent = Math.min(100, Math.round(overlapRatioPct * 0.7 + 30));
    const genreComponent = genreSimilarity > 0 ? genreSimilarity : overlapComponent;
    rawScore = Math.round(
      ratingAgreement * 0.58 + overlapComponent * 0.24 + genreComponent * 0.18
    );
  } else if (commonTitles.length > 0) {
    const ratingHint =
      avgScoreDiff !== null ? Math.max(30, Math.round(100 - avgScoreDiff * 11)) : 72;
    const genreComponent = genreSimilarity > 0 ? genreSimilarity : 68;
    rawScore = Math.round(ratingHint * 0.45 + Math.min(100, overlapRatioPct + 35) * 0.3 + genreComponent * 0.25);
  } else if (genreSimilarity > 0) {
    rawScore = Math.round(genreSimilarity * 0.72 + 12);
  } else {
    rawScore = 45;
  }

  // Bonuses for exact mutual favorites & shared Voice Actors
  rawScore += Math.min(8, exactSharedFavs.length * 3);
  rawScore += Math.min(6, sharedStaff.length * 3);

  const compatibilityPct = Math.max(15, Math.min(99, rawScore));

  let tierLabel = "Univers complémentaires";
  let tierTone: ProfileAffinityResult["tierTone"] = "amber";
  if (compatibilityPct >= 85) {
    tierLabel = "Âmes sœurs Otaku";
    tierTone = "emerald";
  } else if (compatibilityPct >= 70) {
    tierLabel = "Très forte affinité";
    tierTone = "violet";
  } else if (compatibilityPct >= 52) {
    tierLabel = "Bons goûts communs";
    tierTone = "sky";
  }

  // 5) Pick 3 curated recommendations from the visited profile's list that viewer hasn't seen!
  const unseenCandidates = targetPool.filter((t) => !viewerById.has(t.mediaId));
  const fallbackUnfinished = targetPool.filter((t) => {
    const v = viewerById.get(t.mediaId);
    return v && v.status === "PLAN_TO_WATCH";
  });

  const recSource = [...unseenCandidates, ...fallbackUnfinished].sort((a, b) => {
    if (Boolean(a.isFavorite) !== Boolean(b.isFavorite)) return a.isFavorite ? -1 : 1;
    // Slight preference for titles matching viewer's favorite genres
    const gScoreA = (a.genres ?? []).reduce(
      (sum, g) => sum + (viewerGenreWeights.get(g.toLowerCase()) ?? 0),
      0
    );
    const gScoreB = (b.genres ?? []).reduce(
      (sum, g) => sum + (viewerGenreWeights.get(g.toLowerCase()) ?? 0),
      0
    );
    const scoreA = (a.score ?? 7.5) * 10 + Math.min(12, gScoreA);
    const scoreB = (b.score ?? 7.5) * 10 + Math.min(12, gScoreB);
    return scoreB - scoreA;
  });

  const seenRecIds = new Set<number>();
  const recommendationsFromTarget: ProfileAffinityRecommendation[] = [];
  for (const item of recSource) {
    if (seenRecIds.has(item.mediaId)) continue;
    seenRecIds.add(item.mediaId);
    const inPlanToWatch = viewerById.get(item.mediaId)?.status === "PLAN_TO_WATCH";
    const reason = item.isFavorite
      ? `Coup de cœur de ${targetProfile.displayName}${item.score ? ` · ★ ${item.score.toFixed(1)}` : ""}`
      : item.score !== null
        ? `Noté ★ ${item.score.toFixed(1)}/10 par ${targetProfile.displayName}`
        : inPlanToWatch
          ? `Déjà dans votre Plan to Watch · adoré par ${targetProfile.displayName}`
          : `Recommandé par la liste de ${targetProfile.displayName}`;

    recommendationsFromTarget.push({
      mediaId: item.mediaId,
      type: item.type,
      title: item.title,
      coverImage: item.coverImage,
      targetScore: item.score,
      genres: item.genres ?? [],
      reason,
    });
    if (recommendationsFromTarget.length >= 3) break;
  }

  return {
    compatibilityPct,
    tierLabel,
    tierTone,
    commonTitles,
    sharedFavorites,
    sharedStaff,
    avgScoreDiff,
    ratedCommonCount: ratedCommon.length,
    recommendationsFromTarget,
    targetPoolSize: targetPool.length,
  };
}
