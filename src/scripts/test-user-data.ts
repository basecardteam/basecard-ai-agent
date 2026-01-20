/**
 * Test generation of UserData for infographic card
 *
 * Usage: npm run test:user-data
 */
import "dotenv/config";
import { buildUserData } from "../services/card.service.js";
import * as fs from "fs";
import * as path from "path";

const FID = parseInt(process.env.TEST_FID || "0");

async function main() {
  if (!FID) {
    console.error("❌ TEST_FID is not set in .env");
    process.exit(1);
  }

  console.log(`\n🚀 Generating UserData for fid ${FID}`);

  const data = await buildUserData(FID);

  if (!data) {
    console.error(
      "❌ Failed to generate UserData. Ensure ingestion and persona have run."
    );
    process.exit(1);
  }

  console.log("\n📊 UserData object:");
  console.log(JSON.stringify(data, null, 2));

  // Save to temp directory for inspection
  const outDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, `user-data-${FID}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`\n💾 Saved to ${outPath}`);

  process.exit(0);
}

main().catch(console.error);
