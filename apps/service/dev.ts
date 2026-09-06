import { createServer } from "node:http";
import { mkdirSync, existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
process.env.DEV_AUTH ??= "1";
process.env.APP_ORIGIN ??= "http://127.0.0.1:5173";
mkdirSync(".local", { recursive: true });
const { createServer: createViteServer } = await import("vite");
const { default: handler } = await import("../../api/index");
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "spa",
});
const server = createServer((req, res) => {
  if (req.url?.startsWith("/api")) void handler(req, res);
  else vite.middlewares(req, res);
});
server.listen(5173, "127.0.0.1", () =>
  console.log(
    "Night City Tables: http://127.0.0.1:5173 (local test identities enabled only outside production)",
  ),
);
