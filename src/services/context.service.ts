import { db, schema } from "../db/index.js";
import { eq, desc, gte, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { fetchUserProfile, fetchAllUserCasts } from "./farcaster.service.js";
import type { NeynarCast, UserContext } from "../types/index.js";

// =============================================================================
// CONSTANTS
// =============================================================================

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get existing user context from DB
 */
export async function getContext(fid: number): Promise<UserContext | null> {
  const result = await db
    .select()
    .from(schema.userContext)
    .where(eq(schema.userContext.fid, fid))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Check if context data is fresh (within cooldown period)
 */
export function isContextFresh(context: UserContext | null): boolean {
  if (!context || !context.updatedAt) return false;
  return Date.now() - context.updatedAt.getTime() < COOLDOWN_MS;
}

/**
 * Generate/Update user context from casts data
 * This is called after ingestion to compute statistics
 */
export async function generateContext(
  fid: number,
  followersCount: number,
  followingCount: number
): Promise<UserContext> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get all casts for this user
  const allCasts = await db
    .select()
    .from(schema.casts)
    .where(eq(schema.casts.fid, fid))
    .orderBy(desc(schema.casts.timestamp));

  if (allCasts.length === 0) {
    throw new Error(`No casts found for fid: ${fid}`);
  }

  // Activity metrics
  const castsLast7d = allCasts.filter(
    (c) => c.timestamp >= sevenDaysAgo
  ).length;
  const castsLast30d = allCasts.filter(
    (c) => c.timestamp >= thirtyDaysAgo
  ).length;
  const firstCastAt = allCasts[allCasts.length - 1]?.timestamp;
  const lastCastAt = allCasts[0]?.timestamp;
  const lastAnalyzedCastHash = allCasts[0]?.castHash;

  // Engagement metrics
  const totalLikes = allCasts.reduce((sum, c) => sum + (c.likesCount || 0), 0);
  const totalRecasts = allCasts.reduce(
    (sum, c) => sum + (c.recastsCount || 0),
    0
  );
  const totalReplies = allCasts.reduce(
    (sum, c) => sum + (c.repliesCount || 0),
    0
  );
  const totalEngagement = totalLikes + totalRecasts + totalReplies;
  const avgLikesPerCast = totalLikes / allCasts.length;
  const avgRecastsPerCast = totalRecasts / allCasts.length;

  // Top performing cast (by likes)
  // NOTE: Using in-memory sort here since we already have all casts loaded
  // For large datasets, consider adding an index on (fid, likes_count)
  const topCast = allCasts.reduce(
    (best, c) => ((c.likesCount || 0) > (best.likesCount || 0) ? c : best),
    allCasts[0]
  );

  // Channel activity
  const channelCounts: Record<string, number> = {};
  for (const cast of allCasts) {
    if (cast.channel) {
      channelCounts[cast.channel] = (channelCounts[cast.channel] || 0) + 1;
    }
  }
  const topChannels = Object.entries(channelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([channel, count]) => ({ channel, count }));

  // Activity pattern
  let activityPattern = "occasional";
  if (castsLast7d >= 7) {
    activityPattern = "daily_active";
  } else if (castsLast30d >= 4) {
    activityPattern = "weekly_active";
  }

  // Engagement trend
  const recentCasts = allCasts.filter((c) => c.timestamp >= sevenDaysAgo);
  const olderCasts = allCasts.filter(
    (c) => c.timestamp < sevenDaysAgo && c.timestamp >= thirtyDaysAgo
  );
  const recentAvgLikes =
    recentCasts.length > 0
      ? recentCasts.reduce((s, c) => s + (c.likesCount || 0), 0) /
        recentCasts.length
      : 0;
  const olderAvgLikes =
    olderCasts.length > 0
      ? olderCasts.reduce((s, c) => s + (c.likesCount || 0), 0) /
        olderCasts.length
      : 0;
  let engagementTrend = "stable";
  if (recentAvgLikes > olderAvgLikes * 1.2) {
    engagementTrend = "rising";
  } else if (recentAvgLikes < olderAvgLikes * 0.8) {
    engagementTrend = "declining";
  }

  // Compute activeSince
  const activeSince = firstCastAt
    ? `${firstCastAt.getFullYear()}-${String(
        firstCastAt.getMonth() + 1
      ).padStart(2, "0")}`
    : null;

  // Build context data
  const contextData = {
    fid,
    updatedAt: now,
    lastAnalyzedCastHash,
    totalCastsAnalyzed: allCasts.length,
    castsLast7d,
    castsLast30d,
    firstCastAt,
    lastCastAt,
    avgLikesPerCast,
    avgRecastsPerCast,
    totalEngagement,
    engagementTrend,
    topCastHash: topCast?.castHash,
    topCastLikes: topCast?.likesCount || 0,
    followersCount,
    followingCount,
    followRatio: followingCount > 0 ? followersCount / followingCount : 0,
    topChannels: JSON.stringify(topChannels),
    activityPattern,
    activeSince,
    castsPerWeek: castsLast30d / (30 / 7),
    windowStart: thirtyDaysAgo,
    windowEnd: now,
  };

  // Upsert to database
  const existing = await getContext(fid);

  if (existing) {
    await db
      .update(schema.userContext)
      .set(contextData)
      .where(eq(schema.userContext.fid, fid));
    console.log(`[Context] Updated context for fid: ${fid}`);
  } else {
    const id = uuidv4();
    await db.insert(schema.userContext).values({ id, ...contextData });
    console.log(`[Context] Created context for fid: ${fid}`);
  }

  // Return the updated context
  return (await getContext(fid))!;
}

/**
 * Get featured casts (top by likes) for a user
 * Uses ORDER BY on likes_count column
 */
export async function getFeaturedCasts(fid: number, limit: number = 3) {
  // NOTE: For optimal performance with large datasets,
  // ensure there's an index on (fid, likes_count DESC)
  // CREATE INDEX idx_casts_fid_likes ON ai_agent.casts(fid, likes_count DESC);
  const casts = await db
    .select()
    .from(schema.casts)
    .where(eq(schema.casts.fid, fid))
    .orderBy(desc(schema.casts.likesCount))
    .limit(limit);

  return casts;
}

/**
 * Check if there are new casts since last analysis
 */
export async function hasNewCasts(fid: number): Promise<boolean> {
  const context = await getContext(fid);
  if (!context || !context.lastAnalyzedCastHash) {
    return true;
  }

  const latestCast = await db
    .select()
    .from(schema.casts)
    .where(eq(schema.casts.fid, fid))
    .orderBy(desc(schema.casts.timestamp))
    .limit(1);

  if (latestCast.length === 0) {
    return false;
  }

  return latestCast[0].castHash !== context.lastAnalyzedCastHash;
}
