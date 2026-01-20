import { GoogleGenAI } from "@google/genai";
import type { PersonaInput, PersonaOutput } from "../types/index.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Prompt version for tracking
const PROMPT_VERSION = "v3.0.0-gemini-3";

/**
 * Generate social persona from user's casts and metrics using Google GenAI
 * Based on working test-google-genai.ts pattern
 */
export async function generatePersona(
  input: PersonaInput,
  options: { useSearchGrounding?: boolean; model?: string } = {}
): Promise<{ persona: PersonaOutput; rawJson: string; modelUsed: string }> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const modelName = options.model || "gemini-3-flash-preview";

  // Build a concise prompt (keep token count low)
  const prompt = `You are an expert social media analyst. Analyze this Farcaster user and generate a JSON persona profile.

## User Info
- Active since: ${input.metrics.activeSince || "Unknown"}
- Followers: ${input.metrics.followersCount}
- Total casts: ${input.metrics.totalCasts}
- Top channels: ${input.metrics.topChannels.slice(0, 3).join(", ") || "None"}

## Top 15 Casts (by engagement)
${input.sampleCasts
  .slice(0, 15)
  .map((cast, i) => `${i + 1}. "${cast.text.slice(0, 150)}" (${cast.likes}❤️)`)
  .join("\n")}

Return ONLY a valid JSON object (no markdown):
{
  "tone": "communication tone description",
  "primaryTopics": ["topic1", "topic2", "topic3"], // Content focus: what they talk about (e.g. "Base", "Web3 dev") - max 3, very short
  "secondaryTopics": ["topic1", "topic2"],
  "personaLabels": ["label1", "label2", "label3"], // Identity/Role: who they are (e.g. "Base Builder", "Runner") - max 3, short
  "summary": "2-3 sentence summary",
  "tagline": "max 5 word headline",
  "sampleQuotes": ["quote1", "quote2"],
  "communicationStyle": "style description",
  "contentFocus": "main content focus",
  "engagementPattern": "how they engage",
  "influenceType": "type of influence",
  "featuredCasts": [{"hash": "hash", "text": "excerpt", "likes": 0, "reason": "why notable"}], // Provide exactly 3 notable casts
  "confidenceScore": 0.85
}`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    const text = response.text || "";

    // Clean up code blocks if present
    let jsonText = text.trim();
    if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7);
    if (jsonText.startsWith("```")) jsonText = jsonText.slice(3);
    if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3);
    jsonText = jsonText.trim();

    const persona = JSON.parse(jsonText) as PersonaOutput;

    // Post-process URLs
    if (persona.featuredCasts) {
      persona.featuredCasts = persona.featuredCasts.map((cast) => ({
        ...cast,
        url: cast.url || `https://warpcast.com/unknown/${cast.hash}`,
      }));
    }

    return {
      persona,
      rawJson: jsonText,
      modelUsed: modelName,
    };
  } catch (error) {
    console.error("[Gemini] Error generating persona:", error);
    throw error;
  }
}

/**
 * Generate a catchy headline
 */
export async function generateHeadline(
  personaLabels: string[],
  primaryTopics: string[],
  summary: string
): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const prompt = `Generate ONE short headline (max 5 words) for a profile card.
Labels: ${personaLabels.join(", ")}
Topics: ${primaryTopics.join(", ")}
Summary: ${summary}
Return ONLY the headline text.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.8,
      },
    });

    return (
      response.text?.trim().replace(/^["']|["']$/g, "") ||
      personaLabels[0] ||
      "Farcaster User"
    );
  } catch (error) {
    console.error("[Gemini] Headline error:", error);
    return personaLabels[0] || "Farcaster User";
  }
}

export { PROMPT_VERSION };
