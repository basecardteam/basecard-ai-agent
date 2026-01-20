import { Router } from "express";
import { runIngestionForUser } from "../workers/ingestion.worker.js";
import {
  generatePersona,
  getLatestPersona,
} from "../services/persona.service.js";
import { getContext } from "../services/context.service.js";
import { buildCardOutput } from "../services/card.service.js";
import { getUserByFid } from "../services/users.service.js";
import { getCreditStatus, RATE_LIMIT_ERROR } from "../services/rate-limiter.js";

// =============================================================================
// Helper Functions
// =============================================================================

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// =============================================================================
// User Routes (Public API)
// =============================================================================

export const usersRouter = Router();

/**
 * GET /api/users/:fid/card-latest
 * Fetch the latest card output for a user
 */
usersRouter.get("/:fid/card-latest", async (req, res) => {
  try {
    const fid = parseInt(req.params.fid);
    if (isNaN(fid)) {
      return res.status(400).json({ error: "Invalid fid parameter" });
    }

    // Optional regeneration
    const regenerate = req.query.regenerate === "true";
    if (regenerate) {
      console.log(`[API] On-demand persona regeneration for fid ${fid}`);
      await generatePersona(fid);
    }

    // Build card output using service
    const card = await buildCardOutput(fid);

    if (!card) {
      return res.json({
        card: null,
        message:
          "No card data found. Call POST /api/admin/users/:fid/full-pipeline first.",
      });
    }

    // Get user info for additional context
    const user = await getUserByFid(fid);

    return res.json({
      card,
      user: user
        ? {
            fid: user.fid,
            wallet_address: user.walletAddress,
            avatar_url: user.farcasterPfpUrl,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error("[API] Error fetching card:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/users/:fid/cards
 * Trigger persona generation for a user
 */
usersRouter.post("/:fid/cards", async (req, res) => {
  try {
    const fid = parseInt(req.params.fid);
    if (isNaN(fid)) {
      return res.status(400).json({ error: "Invalid fid parameter" });
    }

    const result = await generatePersona(fid);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        hint: result.error?.includes("context")
          ? "Run POST /api/admin/users/:fid/ingest-now first"
          : undefined,
      });
    }

    return res.json({
      status: "success",
      persona_id: result.personaId,
      message: "Persona generated successfully.",
    });
  } catch (error) {
    console.error("[API] Error generating persona:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// =============================================================================
// Admin Routes
// =============================================================================

export const adminRouter = Router();

/**
 * POST /api/admin/users/:fid/ingest-now
 * Trigger immediate ingestion for a user
 */
adminRouter.post("/users/:fid/ingest-now", async (req, res) => {
  try {
    const fid = parseInt(req.params.fid);
    if (isNaN(fid)) {
      return res.status(400).json({ error: "Invalid fid parameter" });
    }

    const forceRefresh = req.query.force === "true";
    const result = await runIngestionForUser(fid, { forceRefresh });

    if (result.error) {
      if (result.error.includes("tomorrow")) {
        return res.status(429).json(RATE_LIMIT_ERROR);
      }
      return res.status(400).json({
        error: result.error,
        casts_ingested: result.castsIngested,
        context_updated: result.contextUpdated,
      });
    }

    return res.json({
      status: "success",
      casts_ingested: result.castsIngested,
      context_updated: result.contextUpdated,
      credits: getCreditStatus(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("tomorrow")) {
      return res.status(429).json(RATE_LIMIT_ERROR);
    }
    console.error("[API] Error running ingestion:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/admin/users/:fid/persona-now
 * Trigger immediate persona generation for a user
 */
adminRouter.post("/users/:fid/persona-now", async (req, res) => {
  try {
    const fid = parseInt(req.params.fid);
    if (isNaN(fid)) {
      return res.status(400).json({ error: "Invalid fid parameter" });
    }

    const result = await generatePersona(fid);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        hint: result.error?.includes("context")
          ? "Run POST /api/admin/users/:fid/ingest-now first"
          : undefined,
      });
    }

    return res.json({
      status: "success",
      persona_id: result.personaId,
    });
  } catch (error) {
    console.error("[API] Error running persona generation:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/admin/users/:fid/full-pipeline
 * Run the full pipeline: ingest -> persona
 */
adminRouter.post("/users/:fid/full-pipeline", async (req, res) => {
  try {
    const fid = parseInt(req.params.fid);
    if (isNaN(fid)) {
      return res.status(400).json({ error: "Invalid fid parameter" });
    }

    const results: Record<string, unknown> = {};

    // Step 1: Ingestion (with smart cooldown)
    console.log(`[Pipeline] Step 1: Ingesting data for fid ${fid}`);
    const forceRefresh = req.query.force === "true";
    const ingestionResult = await runIngestionForUser(fid, { forceRefresh });
    results.ingestion = {
      casts_ingested: ingestionResult.castsIngested,
      context_updated: ingestionResult.contextUpdated,
      message: ingestionResult.message,
      error: ingestionResult.error,
    };

    if (ingestionResult.error) {
      return res.status(400).json({
        step: "ingestion",
        error: ingestionResult.error,
        results,
      });
    }

    // Step 2: Persona generation
    console.log(`[Pipeline] Step 2: Generating persona for fid ${fid}`);
    const personaResult = await generatePersona(fid);
    results.persona = {
      persona_id: personaResult.personaId,
      success: personaResult.success,
      error: personaResult.error,
    };

    if (!personaResult.success) {
      return res.status(400).json({
        step: "persona",
        error: personaResult.error,
        results,
      });
    }

    console.log(`[Pipeline] Completed for fid ${fid}`);
    return res.json({
      status: "success",
      ...results,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("tomorrow")) {
      return res.status(429).json(RATE_LIMIT_ERROR);
    }
    console.error("[API] Error running full pipeline:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/admin/credits
 * Get current Neynar API credit status
 */
adminRouter.get("/credits", async (req, res) => {
  return res.json(getCreditStatus());
});
