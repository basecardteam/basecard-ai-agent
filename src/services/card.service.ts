import { getLatestPersona } from "../services/persona.service.js";
import { getContext } from "../services/context.service.js";
import { fetchUserProfile } from "../services/farcaster.service.js";
import type { FeaturedCast, StatItem, UserData } from "../types/index.js";

/**
 * Build the full UserData object required for the infographic card.
 * Combines persona, user_context, and optional profile fields.
 */
export async function buildUserData(fid: number): Promise<UserData | null> {
  // 1. Load persona and context
  const persona = await getLatestPersona(fid);
  const context = await getContext(fid);
  if (!persona || !context) {
    console.error(`[UserData] Missing persona or context for fid ${fid}`);
    return null;
  }

  // 2. Load optional Farcaster profile for avatar URL
  let pfpUrl: string | undefined;
  try {
    const profile = await fetchUserProfile(fid);
    if (profile && profile.pfp_url) {
      pfpUrl = profile.pfp_url;
    }
  } catch (e) {
    // ignore – avatar is optional
  }

  // 3. Parse JSON fields from persona
  let primaryTopics: string[] = [];
  let personaLabels: string[] = [];
  let featuredCasts: FeaturedCast[] = [];
  try {
    primaryTopics = JSON.parse(persona.primaryTopics || "[]");
  } catch {}
  try {
    personaLabels = JSON.parse(persona.personaLabels || "[]");
  } catch {}
  try {
    featuredCasts = JSON.parse(persona.featuredCasts || "[]");
  } catch {}

  // 4. Build stats (choose three core metrics)
  const stats: StatItem[] = [
    { label: "Casts / 30d", value: String(context.castsLast30d ?? 0) },
    { label: "Avg Likes", value: (context.avgLikesPerCast ?? 0).toFixed(1) },
    { label: "Followers", value: String(context.followersCount ?? 0) },
  ];

  // 5. Assemble final object
  const userData: UserData = {
    id: persona.id,
    headline: persona.tagline || "",
    subheadline: `@fid_${fid}`,
    summary_line: persona.summary?.split(".")[0] + "." || "",
    pfp_url: pfpUrl,
    stats,
    badges: personaLabels.slice(0, 3).map((l) => l.slice(0, 20)),
    topics: primaryTopics.slice(0, 3).map((t) => t.slice(0, 20)),
    activity_pattern: context.activityPattern || "",
    active_since: context.activeSince || "",
    featured_casts: featuredCasts.slice(0, 3),
    generated_at: persona.generatedAt?.toISOString(),
    confidence_score: persona.confidenceScore,
  };

  return userData;
}
