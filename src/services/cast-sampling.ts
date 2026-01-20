import { Cast } from "../db/schema.js";

export interface SampledCast {
  hash: string;
  text: string;
  likes: number;
  recasts: number;
  replies: number;
  channel?: string;
  timestamp: Date;
}

/**
 * Samples casts for LLM input based on WORKFLOW.md rules:
 * - Recent 30d: Top 5 by likes + Random 5
 * - All-time: Top 3 by likes
 * - Max 15 total
 */
export function sampleCastsForPersona(allCasts: Cast[]): SampledCast[] {
  if (allCasts.length === 0) return [];

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Separate recent and all-time
  const recentCasts = allCasts.filter(
    (c) => new Date(c.timestamp) >= thirtyDaysAgo
  );

  const pickedHashes = new Set<string>();
  const sampled: SampledCast[] = [];

  const toSampled = (c: Cast): SampledCast => ({
    hash: c.castHash,
    text: c.text || "",
    likes: c.likesCount || 0,
    recasts: c.recastsCount || 0,
    replies: c.repliesCount || 0,
    channel: c.channel || undefined,
    timestamp: c.timestamp,
  });

  // 2. Top 5 recent by likes
  const sortedRecent = [...recentCasts].sort(
    (a, b) => (b.likesCount || 0) - (a.likesCount || 0)
  );
  const topRecent = sortedRecent.slice(0, 5);
  topRecent.forEach((c) => {
    sampled.push(toSampled(c));
    pickedHashes.add(c.castHash);
  });

  // 3. Random 5 from the rest of recent
  const remainingRecent = sortedRecent.slice(5);
  const randomRecent = remainingRecent
    .sort(() => Math.random() - 0.5)
    .slice(0, 5);
  randomRecent.forEach((c) => {
    sampled.push(toSampled(c));
    pickedHashes.add(c.castHash);
  });

  // 4. Top 3 all-time by likes (excluding picked)
  const sortedAllTime = [...allCasts]
    .filter((c) => !pickedHashes.has(c.castHash))
    .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));

  const topAllTime = sortedAllTime.slice(0, 3);
  topAllTime.forEach((c) => {
    sampled.push(toSampled(c));
    pickedHashes.add(c.castHash);
  });

  // 5. Fill up more if needed (up to 15) from all-time top remaining
  if (sampled.length < 15) {
    const backup = sortedAllTime
      .filter((c) => !pickedHashes.has(c.castHash))
      .slice(0, 15 - sampled.length);
    backup.forEach((c) => {
      sampled.push(toSampled(c));
      pickedHashes.add(c.castHash);
    });
  }

  // Final sort by timestamp descending for context
  return sampled.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
