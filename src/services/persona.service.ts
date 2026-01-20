import { db, schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  generatePersona as callGemini,
  PROMPT_VERSION,
} from "./gemini.service.js";
import { getContext, hasNewCasts } from "./context.service.js";
import { sampleCastsForPersona } from "./cast-sampling.js";
import type { PersonaInput, Persona } from "../types/index.js";

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get the latest persona for a user
 */
export async function getLatestPersona(fid: number): Promise<Persona | null> {
  const result = await db
    .select()
    .from(schema.persona)
    .where(eq(schema.persona.fid, fid))
    .orderBy(desc(schema.persona.generatedAt))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Generate a new persona for a user using Gemini AI
 */
export async function generatePersona(fid: number): Promise<{
  personaId: string | null;
  success: boolean;
  error?: string;
}> {
  console.log(`[Persona] Generating persona for fid: ${fid}`);

  try {
    // 1. Get user_context
    const context = await getContext(fid);
    if (!context) {
      return {
        personaId: null,
        success: false,
        error: "No user_context found. Run ingestion first.",
      };
    }

    // 2. Get casts for sampling
    const allCasts = await db
      .select()
      .from(schema.casts)
      .where(eq(schema.casts.fid, fid))
      .orderBy(desc(schema.casts.likesCount));

    if (allCasts.length === 0) {
      return {
        personaId: null,
        success: false,
        error: "No casts found. Run ingestion first.",
      };
    }

    // 3. Sample casts for LLM input
    const sampledCasts = sampleCastsForPersona(allCasts);

    // 4. Parse top channels
    const topChannels: string[] = [];
    try {
      const parsed = JSON.parse(context.topChannels || "[]");
      topChannels.push(...parsed.map((c: { channel: string }) => c.channel));
    } catch {}

    // 5. Prepare input for Gemini
    const personaInput: PersonaInput = {
      metrics: {
        avgCastsPerWeek: context.castsPerWeek || 0,
        avgLikesPerCast: context.avgLikesPerCast || 0,
        avgRecastsPerCast: context.avgRecastsPerCast || 0,
        avgRepliesPerCast: 0,
        followersCount: context.followersCount || 0,
        followingCount: context.followingCount || 0,
        totalCasts: context.totalCastsAnalyzed || 0,
        topChannels,
        activeSince: context.activeSince || "",
      },
      sampleCasts: sampledCasts.map((c) => ({
        hash: c.hash,
        text: c.text,
        likes: c.likes,
        recasts: c.recasts,
        replies: c.replies,
        channel: c.channel,
        isReply: false,
      })),
      userProfile: {
        username: "",
        displayName: "",
        bio: "",
        location: undefined,
      },
    };

    // 6. Call Gemini AI
    const { persona, rawJson, modelUsed } = await callGemini(personaInput, {
      useSearchGrounding: true,
      model: "gemini-3-flash-preview",
    });

    // 7. Store in database
    const personaId = uuidv4();
    await db.insert(schema.persona).values({
      id: personaId,
      fid,
      contextId: context.id,
      generatedAt: new Date(),
      tone: persona.tone,
      primaryTopics: JSON.stringify(persona.primaryTopics),
      personaLabels: JSON.stringify(persona.personaLabels),
      summary: persona.summary,
      tagline: persona.tagline,
      featuredCasts: JSON.stringify(persona.featuredCasts || []),
      confidenceScore: persona.confidenceScore,
      rawJson,
      modelUsed,
      promptVersion: PROMPT_VERSION,
    });

    console.log(`[Persona] Generated persona ${personaId} for fid: ${fid}`);
    return { personaId, success: true };
  } catch (error) {
    console.error(`[Persona] Error for fid ${fid}:`, error);
    return { personaId: null, success: false, error: String(error) };
  }
}

/**
 * Check if persona needs regeneration (based on new casts)
 */
export async function needsRegeneration(fid: number): Promise<boolean> {
  const hasNew = await hasNewCasts(fid);
  if (!hasNew) return false;

  const persona = await getLatestPersona(fid);
  if (!persona) return true;

  const context = await getContext(fid);
  if (!context) return false;

  // Regenerate if context was updated after persona was generated
  return context.updatedAt > persona.generatedAt;
}
