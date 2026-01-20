import { db, schema } from "../db/index.js";
import {
  generatePersona,
  getLatestPersona,
  needsRegeneration,
} from "../services/persona.service.js";
import { getContext } from "../services/context.service.js";

/**
 * Persona Worker
 *
 * Orchestrates persona generation:
 * 1. Delegates to persona.service for AI generation
 * 2. Provides entry points for cron jobs and API calls
 */

export { generatePersona as runPersonaGenerationForUser } from "../services/persona.service.js";
export { getLatestPersona } from "../services/persona.service.js";
export { needsRegeneration as needsPersonaRegeneration } from "../services/persona.service.js";
export { getContext as getUserContext } from "../services/context.service.js";
export { hasNewCasts } from "../services/context.service.js";

/**
 * Run persona generation for all users that need it
 */
export async function runPersonaGenerationForAllUsers(): Promise<void> {
  const users = await db.select().from(schema.publicUsers);

  console.log(
    `[Persona] Starting persona generation for ${users.length} users`
  );

  for (const user of users) {
    if (user.fid !== null) {
      await generatePersona(user.fid);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log(`[Persona] Completed persona generation for all users`);
}
