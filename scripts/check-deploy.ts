import { existsSync } from "node:fs";
import { Pool } from "pg";
if (existsSync(".env")) process.loadEnvFile(".env");
const errors: string[] = [];
for (const name of [
  "APP_ORIGIN",
  "DATABASE_URL",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "SAVE_KEYS",
  "SAVE_CURRENT_KEY",
])
  if (!process.env[name]) errors.push(`${name} is missing`);
if (process.env.APP_ORIGIN) {
  try {
    const u = new URL(process.env.APP_ORIGIN);
    if (u.protocol !== "https:" || u.origin !== process.env.APP_ORIGIN)
      errors.push(
        "APP_ORIGIN must be an exact HTTPS origin without a path or trailing slash",
      );
  } catch {
    errors.push("APP_ORIGIN is invalid");
  }
}
if (process.env.DATABASE_URL) {
  try {
    const u = new URL(process.env.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(u.protocol))
      errors.push("DATABASE_URL must be a PostgreSQL connection URL");
  } catch {
    errors.push("DATABASE_URL is invalid");
  }
}
if (
  process.env.DISCORD_CLIENT_ID &&
  !/^\d+$/.test(process.env.DISCORD_CLIENT_ID)
)
  errors.push("DISCORD_CLIENT_ID must be the numeric OAuth application ID");
if (process.env.SAVE_KEYS) {
  try {
    const keys = JSON.parse(process.env.SAVE_KEYS) as Record<string, unknown>;
    if (!keys || typeof keys !== "object" || Array.isArray(keys)) throw Error();
    for (const value of Object.values(keys)) {
      if (
        typeof value !== "string" ||
        Buffer.from(value, "base64").length !== 32
      )
        throw Error();
      if (Buffer.from(value, "base64").equals(Buffer.alloc(32, 42)))
        errors.push("SAVE_KEYS contains the public development key");
    }
    if (!Object.hasOwn(keys, process.env.SAVE_CURRENT_KEY ?? ""))
      errors.push("SAVE_CURRENT_KEY is absent from SAVE_KEYS");
  } catch {
    errors.push("SAVE_KEYS must be an object of base64-encoded 32-byte keys");
  }
}
if (process.env.DEV_AUTH === "1")
  errors.push("Remove DEV_AUTH from deployment configuration");
if (errors.length) {
  for (const error of errors) console.error(`FAIL: ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    "Deployment configuration is present and structurally valid. No secret values were printed.",
  );
  if (process.argv.includes("--database")) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 10000,
    });
    try {
      const { rows } = await pool.query<{
        name: string;
        relation: string | null;
      }>(
        "SELECT name,to_regclass(name)::text AS relation FROM unnest(ARRAY['users','sessions','oauth_states','rooms','room_presence']) AS name",
      );
      const missing = rows.filter((r) => !r.relation).map((r) => r.name);
      if (missing.length) {
        console.error(
          `FAIL: Missing database tables: ${missing.join(", ")}. Run npm run db:migrate.`,
        );
        process.exitCode = 1;
      } else
        console.log(
          "Database connection and required tables verified (read-only).",
        );
    } catch {
      console.error(
        "FAIL: Database verification failed. Check connectivity, credentials, TLS and migrations; connection details have been omitted.",
      );
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  }
  console.log(
    "Real Discord login, hosted multiplayer and rules acceptance remain separate release checks.",
  );
}
