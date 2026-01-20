import type { NeynarUser, NeynarCast } from "../types/index.js";
import {
  consumeCredits,
  NEYNAR_CREDITS,
  RATE_LIMIT_ERROR,
} from "./rate-limiter.js";

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_BASE_URL = "https://api.neynar.com/v2/farcaster";

// Response types for Neynar API
interface NeynarUserResponse {
  users: NeynarUser[];
}

interface NeynarCastsResponse {
  casts: NeynarCast[];
  next?: {
    cursor?: string;
  };
}

interface NeynarSearchResponse {
  casts?: NeynarCast[];
  result?: {
    casts?: NeynarCast[];
  };
}

/**
 * Fetch user profile from Neynar API
 */
export async function fetchUserProfile(
  fid: number
): Promise<NeynarUser | null> {
  if (!NEYNAR_API_KEY) {
    throw new Error("NEYNAR_API_KEY is not set");
  }

  // Check and consume credits
  if (!consumeCredits(NEYNAR_CREDITS.USER_BULK, `fetchUserProfile(${fid})`)) {
    throw new Error(RATE_LIMIT_ERROR.message);
  }

  try {
    const response = await fetch(`${NEYNAR_BASE_URL}/user/bulk?fids=${fid}`, {
      headers: {
        accept: "application/json",
        "x-api-key": NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
      console.error(
        `[Farcaster] Failed to fetch profile for fid ${fid}: ${response.status}`
      );
      return null;
    }

    const data = (await response.json()) as NeynarUserResponse;
    return data.users?.[0] ?? null;
  } catch (error) {
    console.error(`[Farcaster] Error fetching profile for fid ${fid}:`, error);
    throw error;
  }
}

/**
 * Fetch user casts from Neynar API
 * @param fid - Farcaster ID
 * @param limit - Number of casts to fetch (max 150 per request)
 * @param cursor - Pagination cursor
 */
export async function fetchUserCasts(
  fid: number,
  limit: number = 100,
  cursor?: string
): Promise<{ casts: NeynarCast[]; nextCursor?: string }> {
  if (!NEYNAR_API_KEY) {
    throw new Error("NEYNAR_API_KEY is not set");
  }

  // Check and consume credits
  if (
    !consumeCredits(NEYNAR_CREDITS.FEED_USER_CASTS, `fetchUserCasts(${fid})`)
  ) {
    throw new Error(RATE_LIMIT_ERROR.message);
  }

  try {
    let url = `${NEYNAR_BASE_URL}/feed/user/casts?fid=${fid}&limit=${Math.min(
      limit,
      150
    )}`;
    if (cursor) {
      url += `&cursor=${cursor}`;
    }

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "x-api-key": NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
      console.error(
        `[Farcaster] Failed to fetch casts for fid ${fid}: ${response.status}`
      );
      return { casts: [] };
    }

    const data = (await response.json()) as NeynarCastsResponse;
    return {
      casts: data.casts ?? [],
      nextCursor: data.next?.cursor,
    };
  } catch (error) {
    console.error(`[Farcaster] Error fetching casts for fid ${fid}:`, error);
    throw error;
  }
}

/**
 * Fetch all casts for a user (with pagination)
 * @param fid - Farcaster ID
 * @param maxCasts - Maximum number of casts to fetch
 */
export async function fetchAllUserCasts(
  fid: number,
  maxCasts: number = 500
): Promise<NeynarCast[]> {
  const allCasts: NeynarCast[] = [];
  let cursor: string | undefined;

  while (allCasts.length < maxCasts) {
    const remaining = maxCasts - allCasts.length;
    const { casts, nextCursor } = await fetchUserCasts(
      fid,
      Math.min(remaining, 150),
      cursor
    );

    if (casts.length === 0) break;

    allCasts.push(...casts);
    cursor = nextCursor;

    if (!cursor) break;

    // Rate limiting: wait 100ms between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return allCasts;
}

/**
 * Search casts by user (alternative endpoint)
 */
export async function searchUserCasts(
  fid: number,
  query?: string
): Promise<NeynarCast[]> {
  if (!NEYNAR_API_KEY) {
    throw new Error("NEYNAR_API_KEY is not set");
  }

  // Check and consume credits
  if (!consumeCredits(NEYNAR_CREDITS.CAST_GET, `searchUserCasts(${fid})`)) {
    throw new Error(RATE_LIMIT_ERROR.message);
  }

  try {
    const url = query
      ? `${NEYNAR_BASE_URL}/cast/search?q=${encodeURIComponent(
          query
        )}&author_fid=${fid}&limit=100`
      : `${NEYNAR_BASE_URL}/feed/user/casts?fid=${fid}&limit=100`;

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "x-api-key": NEYNAR_API_KEY,
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as NeynarSearchResponse;
    return data.casts ?? data.result?.casts ?? [];
  } catch (error) {
    console.error(`[Farcaster] Error searching casts for fid ${fid}:`, error);
    throw error;
  }
}
