/**
 * Script to run ingestion for a specific user
 * Usage: npm run worker:ingest -- <fid>
 */
import "dotenv/config";
import {
  runIngestionForUser,
  runIngestionForAllUsers,
} from "../workers/ingestion.worker.js";

async function main() {
  let fid = process.argv[2];

  if (!fid && process.env.TEST_FID) {
    fid = process.env.TEST_FID;
    console.log(`Using TEST_FID from environment: ${fid}`);
  }

  if (!fid) {
    console.log("Running ingestion for all users...");
    await runIngestionForAllUsers();
  } else {
    const fidNumber = parseInt(fid);
    if (isNaN(fidNumber)) {
      console.error("Invalid fid. Usage: npm run worker:ingest -- <fid>");
      process.exit(1);
    }
    console.log(`Running ingestion for fid: ${fidNumber}`);
    const result = await runIngestionForUser(fidNumber);
    console.log("Result:", result);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
