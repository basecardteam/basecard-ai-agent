// =============================================================================
// Re-export DB Schema Types
// =============================================================================
export type { UserContext, Persona, Cast } from "../db/schema.js";

// =============================================================================
// Farcaster Types from Neynar API
// =============================================================================

export interface NeynarUser {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  profile: {
    bio: {
      text: string;
      mentioned_profiles?: Array<{ fid: number; username: string }>;
    };
    location?: {
      description?: string;
    };
  };
  follower_count: number;
  following_count: number;
  verifications: string[];
  verified_addresses?: {
    eth_addresses?: string[];
    sol_addresses?: string[];
  };
  active_status: string;
}

export interface NeynarCast {
  hash: string;
  parent_hash: string | null;
  parent_url: string | null;
  root_parent_url: string | null;
  parent_author: {
    fid: number | null;
  };
  author: {
    fid: number;
    username: string;
  };
  text: string;
  timestamp: string;
  embeds: Array<{
    url?: string;
    cast_id?: { fid: number; hash: string };
  }>;
  channel: {
    id: string;
    name: string;
  } | null;
  reactions: {
    likes_count: number;
    recasts_count: number;
    likes: Array<{ fid: number }>;
    recasts: Array<{ fid: number }>;
  };
  replies: {
    count: number;
  };
  mentioned_profiles: Array<{ fid: number; username: string }>;
}

// =============================================================================
// Persona Generation Types
// =============================================================================

export interface PersonaInput {
  metrics: {
    avgCastsPerWeek: number;
    avgLikesPerCast: number;
    avgRecastsPerCast: number;
    avgRepliesPerCast: number;
    followersCount: number;
    followingCount: number;
    totalCasts: number;
    topChannels: string[];
    activeSince: string; // e.g., "2023-06"
  };
  sampleCasts: Array<{
    hash: string;
    text: string;
    likes: number;
    recasts: number;
    replies: number;
    channel?: string;
    isReply: boolean;
  }>;
  userProfile: {
    username: string;
    displayName: string;
    bio: string;
    location?: string;
  };
}

export interface FeaturedCast {
  hash: string;
  url: string;
  text: string;
  likes: number;
  reason: string; // LLM-generated reason why this cast is notable
}

export interface PersonaOutput {
  tone: string;
  primaryTopics: string[];
  secondaryTopics: string[];
  personaLabels: string[];
  summary: string;
  tagline: string;
  sampleQuotes: string[];
  communicationStyle: string;
  contentFocus: string;
  engagementPattern: string;
  influenceType: string;
  featuredCasts: FeaturedCast[];
  confidenceScore: number;
}

// =============================================================================
// Card Context Types
// =============================================================================

export interface HighlightStat {
  label: string;
  value: string;
  icon?: string;
}

export interface StyleMeta {
  template: string;
  colorTheme?: string;
  variant?: string;
}

export interface CardContext {
  id: string;
  fid: number;
  headline: string;
  subheadline: string;
  summaryLine: string;
  stats: HighlightStat[];
  badges: string[];
  topics: string[];
  activityPattern: string;
  activeSince: string;
  featuredCasts: FeaturedCast[];
  styleConfig?: StyleMeta;
}

// =============================================================================
// Social Profile Summary (피드백 기반 정형화된 구조)
// =============================================================================

export interface SocialProfileSummary {
  identity: {
    fid: number;
    handle: string;
    displayName: string;
    avatarUrl: string;
    bio?: string;
    location?: string;
    links?: Array<{ type: string; url: string }>;
  };
  graph: {
    followers: number;
    following: number;
    followRatio: number;
    activeSince: string; // "2023-06"
  };
  activity: {
    avgCastsPerWeek: number;
    castsLast30d: number;
    totalCasts: number;
  };
  engagement: {
    avgLikesPerCast: number;
    avgRecastsPerCast: number;
    avgRepliesPerCast: number;
  };
  persona: {
    tone: string;
    primaryTopics: string[];
    personaLabels: string[];
    summary: string;
    tagline: string;
  };
  highlights: {
    stats: HighlightStat[];
    topTopics: string[];
    featuredCasts: FeaturedCast[];
  };
}

// =============================================================================
// API Response Types
// =============================================================================

export interface CardLatestResponse {
  card_context: {
    id: string;
    headline: string;
    subheadline: string;
    top_topics: string[];
    highlight_stats: HighlightStat[];
    summary_line: string;
    active_since: string;
    featured_casts: FeaturedCast[];
    style_meta: StyleMeta;
    created_at: string;
  } | null;
  user: {
    fid: number;
    username: string;
    display_name: string;
    avatar_url: string;
  } | null;
  metrics?: {
    followers_count: number;
    following_count: number;
    total_casts: number;
    avg_likes_per_cast: number;
  };
  profile_summary?: SocialProfileSummary;
}

export interface CardCreateResponse {
  card_context_id: string;
  status: "ready" | "processing" | "error";
  message?: string;
}
