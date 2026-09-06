// Isolated browser-test server: built static client, no HMR, disposable database.
import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
process.env.APP_ORIGIN = process.env.E2E_ORIGIN ?? "http://127.0.0.1:5174";
process.env.DEV_AUTH = "1";
process.env.LOCAL_DATABASE_PATH = "memory";
if (
  process.env.DATABASE_URL ||
  process.env.VERCEL ||
  process.env.NODE_ENV === "production"
)
  throw Error("Browser fixture server must use its disposable local database.");
const { default: handler } = await import("../api/index");
const root = resolve("dist");
const storageFixture = await build({
  entryPoints: ["apps/web/src/storage.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
});
createServer(async (req, res) => {
  if (req.url?.startsWith("/api")) {
    await handler(req, res);
    return;
  }
  const pathname = new URL(req.url ?? "/", process.env.APP_ORIGIN).pathname;
  if (pathname === "/__fixtures/storage.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(storageFixture.outputFiles[0].text);
    return;
  }
  const file = resolve(
    root,
    "." +
      (pathname.startsWith("/assets/") || pathname.startsWith("/cards/")
        ? pathname
        : "/index.html"),
  );
  if (!file.startsWith(root + "/")) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    const data = await readFile(file);
    res.setHeader(
      "Content-Type",
      (
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".webp": "image/webp",
        } as Record<string, string>
      )[extname(file)] ?? "application/octet-stream",
    );
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(Number(new URL(process.env.APP_ORIGIN).port), "127.0.0.1");
