/**
 * Generate Final SVGs by combining templates with data
 *
 * Usage:
 *   npx tsx src/scripts/generate-final-svgs.ts
 */
import fs from "fs";
import path from "path";

async function main() {
  console.log("🚀 Generating Final SVGs from Templates...");

  const templateFrontPath = path.join(process.cwd(), "basecard-front.txt");
  const templateBackPath = path.join(process.cwd(), "basecard-back.txt");
  const exampleJsonPath = path.join(process.cwd(), "example.json");
  const outputDir = path.join(process.cwd(), "dist", "images");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const templateFront = fs.readFileSync(templateFrontPath, "utf-8");
  const templateBack = fs.readFileSync(templateBackPath, "utf-8");
  const data = JSON.parse(fs.readFileSync(exampleJsonPath, "utf-8"));

  // --- Front Card Data Preparation ---
  let frontSvg = templateFront;

  // 1. Avatar
  frontSvg = frontSvg.replace("{{avatar_url}}", data.user.avatar_url || "");

  // 2. FID
  frontSvg = frontSvg.replace("{{fid}}", data.user.fid.toString());

  // 3. Tagline
  frontSvg = frontSvg.replace("{{tagline}}", data.persona.tagline || "");

  // 4. Persona Labels (HTML in foreignObject)
  const labelsHtml = (data.persona.persona_labels || [])
    .map(
      (label: string) =>
        `<span style="background-color: #E0F2FE; color: #0284C7; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">${label}</span>`
    )
    .join("");
  frontSvg = frontSvg.replace("{{persona_labels}}", labelsHtml);

  // 5. Summary
  frontSvg = frontSvg.replace("{{summary}}", data.persona.summary || "");

  // --- Back Card Data Preparation ---
  let backSvg = templateBack;

  // 1. Total Engagement
  backSvg = backSvg.replace(
    "{{total_engagement}}",
    data.context.total_engagement?.toString() || "0"
  );

  // 2. Total Casts
  backSvg = backSvg.replace(
    "{{total_casts}}",
    data.context.total_casts_analyzed?.toString() || "0"
  );

  // 3. Featured Casts (HTML in foreignObject)
  const castsHtml = (data.persona.featured_casts || [])
    .slice(0, 3)
    .map(
      (cast: any) => `
      <div style="background-color: white; border-radius: 8px; padding: 10px; border: 1px solid #E2E8F0; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
        <div style="font-size: 12px; color: #334155; line-height: 1.4; margin-bottom: 4px;">"${cast.text}"</div>
        <div style="font-size: 10px; color: #94A3B8; display: flex; align-items: center; gap: 4px;">
           ❤️ ${cast.likes} • ${cast.reason}
        </div>
      </div>
    `
    )
    .join("");
  backSvg = backSvg.replace("{{featured_casts}}", castsHtml);

  // 4. Generated At
  const date = new Date(data.persona.generated_at).toLocaleDateString();
  backSvg = backSvg.replace("{{generated_at}}", date);

  // Save Files
  fs.writeFileSync(path.join(outputDir, "final-front.svg"), frontSvg);
  fs.writeFileSync(path.join(outputDir, "final-back.svg"), backSvg);

  console.log(`✅ Saved: ${path.join(outputDir, "final-front.svg")}`);
  console.log(`✅ Saved: ${path.join(outputDir, "final-back.svg")}`);
}

main().catch(console.error);
