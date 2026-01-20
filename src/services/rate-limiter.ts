/**
 * Neynar API Rate Limiter
 *
 * Tracks API credit usage and enforces daily limits.
 * Based on Neynar's credit pricing system.
 */

// =============================================================================
// Credit Costs per Endpoint (per object)
// =============================================================================

export const NEYNAR_CREDITS = {
  // User endpoints
  USER_BULK: 2, // GET /v2/farcaster/user/bulk
  USER_BULK_BY_ADDRESS: 2, // GET /v2/farcaster/user/bulk-by-address
  USER_BY_USERNAME: 2, // GET /v2/farcaster/user/by_username

  // Feed endpoints
  FEED_USER_CASTS: 4, // GET /v2/farcaster/feed/user/casts

  // Cast endpoints
  CAST_GET: 4, // GET /v2/farcaster/cast
  CAST_POST: 150, // POST /v2/farcaster/cast

  // Reaction endpoints (v1)
  REACTION_BY_ID: 100,
  REACTIONS_BY_CAST: 150,

  // Storage
  STORAGE_LIMITS: 5,

  // Subscribers
  SUBSCRIPTION_CHECK: 2,
} as const;

// =============================================================================
// Daily Credit Limit Configuration
// =============================================================================

// Default: 10,000 credits per day (adjust based on your plan)
const DEFAULT_DAILY_LIMIT = parseInt(
  process.env.NEYNAR_DAILY_CREDIT_LIMIT || "10000"
);

// =============================================================================
// In-Memory Credit Tracker
// =============================================================================

interface CreditState {
  date: string; // YYYY-MM-DD format
  used: number;
  limit: number;
}

let creditState: CreditState = {
  date: getTodayString(),
  used: 0,
  limit: DEFAULT_DAILY_LIMIT,
};

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Reset credit counter if it's a new day
 */
function resetIfNewDay(): void {
  const today = getTodayString();
  if (creditState.date !== today) {
    console.log(
      `[RateLimiter] New day detected. Resetting credits. Previous: ${creditState.used}/${creditState.limit}`
    );
    creditState = {
      date: today,
      used: 0,
      limit: DEFAULT_DAILY_LIMIT,
    };
  }
}

/**
 * Check if we have enough credits for an operation
 */
export function hasCredits(cost: number): boolean {
  resetIfNewDay();
  return creditState.used + cost <= creditState.limit;
}

/**
 * Consume credits for an operation
 * @returns true if credits were consumed, false if limit exceeded
 */
export function consumeCredits(
  cost: number,
  operation: string = "unknown"
): boolean {
  resetIfNewDay();

  if (creditState.used + cost > creditState.limit) {
    console.warn(
      `[RateLimiter] Credit limit exceeded! Requested: ${cost}, Used: ${creditState.used}/${creditState.limit}, Operation: ${operation}`
    );
    return false;
  }

  creditState.used += cost;
  console.log(
    `[RateLimiter] Credits consumed: ${cost} for ${operation}. Total: ${creditState.used}/${creditState.limit}`
  );
  return true;
}

/**
 * Get current credit status
 */
export function getCreditStatus(): {
  date: string;
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
} {
  resetIfNewDay();
  return {
    date: creditState.date,
    used: creditState.used,
    limit: creditState.limit,
    remaining: creditState.limit - creditState.used,
    percentUsed: Math.round((creditState.used / creditState.limit) * 100),
  };
}

/**
 * Error message for rate limit exceeded
 */
export const RATE_LIMIT_ERROR = {
  error: "rate_limit_exceeded",
  message: "Today's operating was already finished. Please do it tomorrow.",
};

/**
 * Check credits and throw error if exceeded
 */
export function requireCredits(cost: number, operation: string): void {
  if (!consumeCredits(cost, operation)) {
    throw new Error(RATE_LIMIT_ERROR.message);
  }
}

/**
 * Calculate estimated credits for fetching user casts
 * @param castCount Number of casts to fetch
 * @param pageSize Casts per page (max 150)
 */
export function estimateCastFetchCredits(
  castCount: number,
  pageSize: number = 150
): number {
  const pages = Math.ceil(castCount / pageSize);
  return pages * NEYNAR_CREDITS.FEED_USER_CASTS;
}

/**
 * Pre-check if we can fetch casts for a user
 */
export function canFetchUserCasts(maxCasts: number = 500): boolean {
  const profileCost = NEYNAR_CREDITS.USER_BULK;
  const castsCost = estimateCastFetchCredits(maxCasts);
  return hasCredits(profileCost + castsCost);
}
