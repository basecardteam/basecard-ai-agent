/**
 * Script to run persona generation for a specific user
 * Usage: npm run worker:persona -- <fid>
 */
import "dotenv/config";
import {
  runPersonaGenerationForUser,
  runPersonaGenerationForAllUsers,
} from "../workers/persona.worker.js";

async function main() {
  let fid = process.argv[2];

  if (!fid && process.env.TEST_FID) {
    fid = process.env.TEST_FID;
    console.log(`Using TEST_FID from environment: ${fid}`);
  }

  if (!fid) {
    console.log("Running persona generation for all users...");
    await runPersonaGenerationForAllUsers();
  } else {
    const fidNumber = parseInt(fid);
    if (isNaN(fidNumber)) {
      console.error("Invalid fid. Usage: npm run worker:persona -- <fid>");
      process.exit(1);
    }
    console.log(`Running persona generation for fid: ${fidNumber}`);
    const result = await runPersonaGenerationForUser(fidNumber);
    console.log("Result:", result);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
