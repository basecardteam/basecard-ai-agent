import "dotenv/config";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

async function resetTestData() {
  const fid = parseInt(process.env.TEST_FID || "0");

  console.log(`[Reset] Clearing test data for FID: ${fid}...`);

  try {
    // 1. Delete Persona
    const personaResult = await db
      .delete(schema.persona)
      .where(eq(schema.persona.fid, fid));
    console.log(`[Reset] Deleted ${personaResult.rowCount} persona records.`);

    // 2. Delete User Context
    const contextResult = await db
      .delete(schema.userContext)
      .where(eq(schema.userContext.fid, fid));
    console.log(
      `[Reset] Deleted ${contextResult.rowCount} user_context records.`,
    );

    // 3. Delete Casts
    const castsResult = await db
      .delete(schema.casts)
      .where(eq(schema.casts.fid, fid));
    console.log(`[Reset] Deleted ${castsResult.rowCount} cast records.`);

    console.log("[Reset] Done.");
  } catch (error) {
    console.error("[Reset] Error clearing test data:", error);
    process.exit(1);
  }
}

resetTestData();
