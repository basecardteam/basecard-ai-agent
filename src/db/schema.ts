import {
  pgSchema,
  pgTable,
  text,
  integer,
  real,
  timestamp,
  bigint,
} from "drizzle-orm/pg-core";

// =============================================================================
// SCHEMAS
// =============================================================================

// AI Agent 전용 스키마
export const aiAgentSchema = pgSchema("ai_agent");

// =============================================================================
// PUBLIC.USERS (Backend가 관리 - 참조용)
// 이 테이블은 생성하지 않고, 참조만 합니다.
// =============================================================================
export const publicUsers = pgTable("users", {
  id: text("id").primaryKey(),
  role: text("role"),
  walletAddress: text("wallet_address"),
  fid: bigint("fid", { mode: "number" }),
  totalPoints: integer("total_points").default(0),
  isNewUser: text("is_new_user"),
  hasMintedCard: text("has_minted_card"),
  farcasterPfpUrl: text("farcaster_pfp_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =============================================================================
// AI_AGENT.CASTS
// Historical Farcaster casts (계속 누적)
// =============================================================================
export const casts = aiAgentSchema.table("casts", {
  id: text("id").primaryKey(),
  fid: bigint("fid", { mode: "number" }).notNull(),
  castHash: text("cast_hash").notNull().unique(),
  timestamp: timestamp("timestamp").notNull(),
  text: text("text"),
  channel: text("channel"),
  client: text("client"),
  mentions: text("mentions"), // JSON array
  parentHash: text("parent_hash"),
  parentAuthorFid: bigint("parent_author_fid", { mode: "number" }),
  embeds: text("embeds"), // JSON array
  repliesCount: integer("replies_count").default(0),
  recastsCount: integer("recasts_count").default(0),
  likesCount: integer("likes_count").default(0),
  raw: text("raw"), // Full JSON payload
});

// =============================================================================
// AI_AGENT.USER_CONTEXT
// 유저의 함축적 활동 상태 + Metrics (유저당 1개)
// =============================================================================
export const userContext = aiAgentSchema.table("user_context", {
  id: text("id").primaryKey(),
  fid: bigint("fid", { mode: "number" }).notNull().unique(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Activity Tracking
  lastAnalyzedCastHash: text("last_analyzed_cast_hash"), // 새 cast 감지용
  totalCastsAnalyzed: integer("total_casts_analyzed").default(0),
  castsLast7d: integer("casts_last_7d").default(0),
  castsLast30d: integer("casts_last_30d").default(0),
  firstCastAt: timestamp("first_cast_at"),
  lastCastAt: timestamp("last_cast_at"),

  // Engagement Summary
  avgLikesPerCast: real("avg_likes_per_cast").default(0),
  avgRecastsPerCast: real("avg_recasts_per_cast").default(0),
  totalEngagement: integer("total_engagement").default(0),
  engagementTrend: text("engagement_trend"), // 'rising' | 'stable' | 'declining'

  // Top Cast
  topCastHash: text("top_cast_hash"),
  topCastLikes: integer("top_cast_likes").default(0),

  // Graph
  followersCount: integer("followers_count").default(0),
  followingCount: integer("following_count").default(0),
  followRatio: real("follow_ratio").default(0),

  // Patterns
  topChannels: text("top_channels"), // JSON array
  activityPattern: text("activity_pattern"), // 'daily_active' | 'weekly_active' | 'occasional'
  activeSince: text("active_since"),
  castsPerWeek: real("casts_per_week").default(0),

  // Sliding Window
  windowStart: timestamp("window_start"),
  windowEnd: timestamp("window_end"),
});

// =============================================================================
// AI_AGENT.PERSONA
// LLM-derived 현재 페르소나 (유저당 최신 1개 유지)
// =============================================================================
export const persona = aiAgentSchema.table("persona", {
  id: text("id").primaryKey(),
  fid: bigint("fid", { mode: "number" }).notNull(),
  contextId: text("context_id"), // 어떤 user_context 기반인지
  generatedAt: timestamp("generated_at").defaultNow().notNull(),

  // Core Persona
  tone: text("tone"),
  primaryTopics: text("primary_topics"), // JSON array
  personaLabels: text("persona_labels"), // JSON array (e.g., ['DeFi Builder', 'NFT Collector'])
  summary: text("summary"),
  tagline: text("tagline"),

  // Featured
  featuredCasts: text("featured_casts"), // JSON array

  // Debug
  confidenceScore: real("confidence_score"),
  modelUsed: text("model_used"),
  promptVersion: text("prompt_version"),
  rawJson: text("raw_json"),
});

// =============================================================================
// Type Exports
// =============================================================================
export type PublicUser = typeof publicUsers.$inferSelect;

export type Cast = typeof casts.$inferSelect;
export type NewCast = typeof casts.$inferInsert;

export type UserContext = typeof userContext.$inferSelect;
export type NewUserContext = typeof userContext.$inferInsert;

export type Persona = typeof persona.$inferSelect;
export type NewPersona = typeof persona.$inferInsert;

// NOTE: card_context 테이블은 삭제됨
// 최종 카드 출력은 persona + user_context를 조합하여 런타임에 생성
