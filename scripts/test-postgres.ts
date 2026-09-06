import { spawn } from "node:child_process";
const connection = process.env.TEST_DATABASE_URL;
if (!connection)
  throw Error("Set TEST_DATABASE_URL to a dedicated PostgreSQL test database.");
const url = new URL(connection);
if (!url.pathname.endsWith("_tests"))
  throw Error("The test database name must end in _tests.");
if (process.env.VERCEL || process.env.NODE_ENV === "production")
  throw Error("Do not run fixture tests in production.");
process.env.DATABASE_URL = connection;
const { migrate } = await import("../apps/service/db");
await migrate();
const child = spawn(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "tests/integration/service.test.ts",
    "tests/integration/oauth.test.ts",
  ],
  { stdio: "inherit", env: process.env },
);
child.on("error", () => process.exit(1));
child.on("exit", (code) => process.exit(code ?? 1));
