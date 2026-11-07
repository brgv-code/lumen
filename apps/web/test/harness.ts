// The real routes and migrations on Node's SQLite, which is what D1 runs underneath.
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { Hono } from "hono";
import type { AppEnv, SessionUser } from "../src/worker/env.ts";
import { me } from "../src/worker/routes/me.ts";
import { items } from "../src/worker/routes/items.ts";
import { destinations } from "../src/worker/routes/destinations.ts";

const MIGRATIONS = new URL("../migrations/", import.meta.url);

type Row = Record<string, unknown>;

function statement(sqlite: DatabaseSync, sql: string, values: SQLInputValue[] = []) {
  const rows = () => sqlite.prepare(sql).all(...values).map((row) => ({ ...row }) as Row);
  return {
    bind: (...next: unknown[]) => statement(sqlite, sql, next.map((value) => (value === undefined ? null : value) as SQLInputValue)),
    all: async () => ({ results: rows(), success: true, meta: {} }),
    first: async (column?: string) => {
      const [row] = rows();
      if (!row) return null;
      return column ? row[column] : row;
    },
    run: async () => {
      const result = sqlite.prepare(sql).run(...values);
      return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
    },
    rowsNow: rows,
  };
}

type Statement = ReturnType<typeof statement>;

/** A D1Database over SQLite: batches run in one transaction, as D1's do. */
export function sqliteD1(sqlite: DatabaseSync) {
  return {
    prepare: (sql: string) => statement(sqlite, sql),
    batch: async (statements: Statement[]) => {
      sqlite.exec("BEGIN");
      try {
        const results = statements.map((entry) => ({ results: entry.rowsNow(), success: true, meta: {} }));
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    exec: async (sql: string) => sqlite.exec(sql),
  };
}

export function migratedDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  return sqlite;
}

export const READER: SessionUser = {
  id: "usr_reader", email: "reader@example.com", name: "Reader", avatar_url: null, is_demo: 0, plan: "pro", daily_goal: 20,
  timezone: "UTC", ai_provider: "lumen", share_signals: 0, reminders: 0, created_at: 0,
};

/** The API as a signed in reader sees it, plus the database to seed. */
export function signedInApi() {
  const sqlite = migratedDatabase();
  sqlite.prepare("INSERT INTO users (id, email, name, plan, created_at) VALUES (?, ?, ?, ?, 0)").run(READER.id, READER.email, READER.name, READER.plan);
  const app = new Hono<AppEnv>();
  app.use("*", async (context, next) => { context.set("user", READER); await next(); });
  app.route("/api/v1", me);
  app.route("/api/v1/items", items);
  app.route("/api/v1/destinations", destinations);
  const env = { DB: sqliteD1(sqlite) };
  // No analytics key in env, so tracking returns before it would schedule anything here.
  const executionContext = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} };
  const call = async <T = Row>(method: string, path: string, payload?: unknown): Promise<T> => {
    const response = await app.request(path, { method, headers: { "content-type": "application/json" }, body: payload === undefined ? undefined : JSON.stringify(payload) }, env, executionContext);
    if (!response.ok) throw new Error(`${method} ${path} answered ${response.status}: ${await response.text()}`);
    return response.json() as Promise<T>;
  };
  return { sqlite, call };
}
