import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { VERSION } from "../packages/engine/index";
const path = `packages/runtimes/archives/${VERSION}.mjs`;
const result = await build({
  entryPoints: ["packages/runtimes/entry.ts"],
  bundle: true,
  platform: "neutral",
  format: "esm",
  target: "es2022",
  write: false,
});
const content = result.outputFiles[0].text;
// Exclusive creation prevents silently rewriting code needed by retained saves.
writeFileSync(path, content, { flag: "wx" });
const manifestPath = "packages/runtimes/archives/manifest.json";
let manifest: Record<string, { file: string; sha256: string }> = {};
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
manifest[VERSION] = {
  file: `${VERSION}.mjs`,
  sha256: createHash("sha256").update(content).digest("hex"),
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  `Archived ${VERSION}; add its static import to the runtime registry before changing the live version.`,
);
