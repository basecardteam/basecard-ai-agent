import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";
import type { PublicUser } from "../db/schema.js";

/**
 * Users Service
 *
 * public.users 테이블을 **읽기 전용**으로 접근합니다.
 * 이 테이블은 Backend가 관리하며, AI Agent는 SELECT만 가능합니다.
 */

/**
 * Get user by Farcaster ID from public.users (READ-ONLY)
 */
export async function getUserByFid(fid: number): Promise<PublicUser | null> {
  const result = await db
    .select()
    .from(schema.publicUsers)
    .where(eq(schema.publicUsers.fid, fid))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get user by UUID from public.users (READ-ONLY)
 */
export async function getUserById(id: string): Promise<PublicUser | null> {
  const result = await db
    .select()
    .from(schema.publicUsers)
    .where(eq(schema.publicUsers.id, id))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get all users for sync (READ-ONLY)
 * TODO: 실제 환경에서는 필터 조건 추가 필요
 */
export async function getAllUsersForSync(): Promise<PublicUser[]> {
  const result = await db.select().from(schema.publicUsers);
  return result;
}

/**
 * Get users that need persona update (READ-ONLY)
 */
export async function getUsersNeedingPersonaUpdate(): Promise<PublicUser[]> {
  // TODO: 조건 추가 (예: 최근 활동 유저만)
  const result = await db.select().from(schema.publicUsers);
  return result;
}

/**
 * Update user's last sync timestamp
 * NOTE: ai_agent에서는 public.users를 수정할 수 없으므로,
 * 동기화 정보는 ai_agent.social_metrics의 snapshotAt으로 추적합니다.
 */
export async function updateUserSyncTimestamp(
  fid: number,
  type: "casts" | "persona"
): Promise<void> {
  // public.users는 수정 불가 (SELECT only)
  // 대신 metrics/persona 테이블의 timestamp로 추적
  console.log(
    `[Users] Sync timestamp for fid ${fid} tracked via ${
      type === "casts" ? "social_metrics" : "social_persona"
    } table`
  );
}
