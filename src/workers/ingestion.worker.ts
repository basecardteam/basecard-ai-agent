import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  fetchUserProfile,
  fetchAllUserCasts,
} from "../services/farcaster.service.js";
import { getUserByFid } from "../services/users.service.js";
import {
  getContext,
  isContextFresh,
  generateContext,
} from "../services/context.service.js";
import type { NeynarCast } from "../types/index.js";

/**
 * Ingestion Worker
 *
 * Orchestrates data collection:
 * 1. Fetching casts from Neynar
 * 2. Storing casts in ai_agent.casts
 * 3. Calling context.service to compute user_context
 */

export async function runIngestionForUser(
  fid: number,
  options: { forceRefresh?: boolean } = {}
): Promise<{
  castsIngested: number;
  contextUpdated: boolean;
  error?: string;
  message?: string;
}> {
  console.log(`[Ingestion] Starting ingestion for fid: ${fid}`);

  try {
    // 1. Check for cooldown
    const existingContext = await getContext(fid);
    if (isContextFresh(existingContext) && !options.forceRefresh) {
      const diffMins = Math.round(
        (Date.now() - existingContext!.updatedAt.getTime()) / 60000
      );
      console.log(
        `[Ingestion] FOUND FRESH DATA (Updated ${diffMins}m ago). SKIPPING Neynar fetch.`
      );
      return {
        castsIngested: 0,
        contextUpdated: false,
        message: "SKIPPED_COOLDOWN",
      };
    }

    // 2. Check if user exists (for logging only)
    const user = await getUserByFid(fid);
    if (!user) {
      console.warn(
        `[Ingestion] User with fid ${fid} not found in public.users. Proceeding for testing...`
      );
    }

    // 3. Fetch profile from Neynar
    const profile = await fetchUserProfile(fid);
    if (!profile) {
      return {
        castsIngested: 0,
        contextUpdated: false,
        error: "Failed to fetch profile from Neynar",
      };
    }

    // 4. Fetch casts
    const casts = await fetchAllUserCasts(fid, 500);
    console.log(`[Ingestion] Fetched ${casts.length} casts for fid: ${fid}`);

    // 5. Upsert casts to database
    let ingestedCount = 0;
    for (const cast of casts) {
      try {
        await upsertCast(fid, cast);
        ingestedCount++;
      } catch (error) {
        console.debug(`[Ingestion] Skipping cast ${cast.hash}: ${error}`);
      }
    }

    // 6. Generate context using service
    await generateContext(fid, profile.follower_count, profile.following_count);

    console.log(
      `[Ingestion] Completed ingestion for fid: ${fid}. Ingested ${ingestedCount} casts.`
    );
    return { castsIngested: ingestedCount, contextUpdated: true };
  } catch (error) {
    console.error(`[Ingestion] Error for fid ${fid}:`, error);
    return { castsIngested: 0, contextUpdated: false, error: String(error) };
  }
}

/**
 * Upsert a single cast into ai_agent.casts
 */
async function upsertCast(fid: number, cast: NeynarCast): Promise<void> {
  const existingCast = await db
    .select()
    .from(schema.casts)
    .where(eq(schema.casts.castHash, cast.hash))
    .limit(1);

  const castData = {
    fid,
    castHash: cast.hash,
    timestamp: new Date(cast.timestamp),
    text: cast.text,
    channel: cast.channel?.id || null,
    client: null,
    mentions: JSON.stringify(
      cast.mentioned_profiles.map((p) => ({ fid: p.fid, username: p.username }))
    ),
    parentHash: cast.parent_hash,
    parentAuthorFid: cast.parent_author?.fid || null,
    embeds: JSON.stringify(cast.embeds),
    repliesCount: cast.replies?.count || 0,
    recastsCount: cast.reactions?.recasts_count || 0,
    likesCount: cast.reactions?.likes_count || 0,
    raw: JSON.stringify(cast),
  };

  if (existingCast.length > 0) {
    await db
      .update(schema.casts)
      .set(castData)
      .where(eq(schema.casts.castHash, cast.hash));
  } else {
    await db.insert(schema.casts).values({
      id: uuidv4(),
      ...castData,
    });
  }
}

/**
 * Run ingestion for all registered users
 */
export async function runIngestionForAllUsers(): Promise<void> {
  const users = await db.select().from(schema.publicUsers);

  console.log(`[Ingestion] Starting ingestion for ${users.length} users`);

  for (const user of users) {
    if (user.fid !== null) {
      await runIngestionForUser(user.fid);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log(`[Ingestion] Completed ingestion for all users`);
}
