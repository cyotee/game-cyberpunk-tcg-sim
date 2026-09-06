import { Pool } from "pg";
export interface SQL {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}
let pool: Pool | undefined;
let local: import("@electric-sql/pglite").PGlite | undefined;
let initializing: Promise<void> | undefined;
const schema = `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, blocks JSONB NOT NULL DEFAULT '[]');
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_states (hash TEXT PRIMARY KEY, verifier TEXT NOT NULL, next_path TEXT NOT NULL, expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, state JSONB NOT NULL, updated BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS room_presence (code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, player TEXT NOT NULL, connection TEXT NOT NULL, seen BIGINT NOT NULL, PRIMARY KEY(code,player));
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);`;
export async function connection(): Promise<SQL> {
  if (process.env.DATABASE_URL) {
    pool ??= new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
    return pool;
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production")
    throw Error("DATABASE_URL is required");
  if (!local) {
    const { PGlite } = await import("@electric-sql/pglite");
    local = new PGlite(
      process.env.LOCAL_DATABASE_PATH === "memory"
        ? undefined
        : (process.env.LOCAL_DATABASE_PATH ?? ".local/database"),
    );
  }
  return local as unknown as SQL;
}
export async function migrate() {
  const db = await connection();
  for (const statement of schema.split(";").filter((s) => s.trim()))
    await db.query(statement);
}
export async function db() {
  initializing ??= process.env.DATABASE_URL ? Promise.resolve() : migrate();
  await initializing;
  return connection();
}
let queue: Promise<unknown> = Promise.resolve();
export async function transaction<T>(fn: (sql: SQL) => Promise<T>): Promise<T> {
  await db();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  const execute = () => local!.transaction((tx) => fn(tx as unknown as SQL));
  const result = queue.then(execute, execute);
  queue = result.catch(() => {});
  return result;
}
