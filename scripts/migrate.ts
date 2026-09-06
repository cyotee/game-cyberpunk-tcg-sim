import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const { migrate } = await import("../apps/service/db");
await migrate();
console.log("Database schema ready.");
process.exit(0);
