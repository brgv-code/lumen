import { GLOW, type GlowKind } from "@lumen/core";
import type { SessionUser } from "../env";
import { dayIn, id, now } from "./util";

export function glowStmt(db: D1Database, user: SessionUser, kind: GlowKind, itemId: string | null = null) {
  return db.prepare("INSERT INTO activity (id, user_id, day, kind, item_id, glow, created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(id("act_"), user.id, dayIn(user.timezone), kind, itemId, GLOW[kind], now());
}
