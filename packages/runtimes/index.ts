import * as current from "./entry";
// Bundled archives are immutable and include their own card catalog/validator.
// @ts-expect-error Archived ESM deliberately has no dependency on live TS modules.
import * as initial from "./archives/2026-09-05.playtest.1.mjs";
export type Runtime = typeof current;
const retained: Readonly<Record<string, Runtime>> = Object.freeze({
  [initial.VERSION]: initial as Runtime,
  [current.VERSION]: current,
});
export const latestRuntime = current;
export const runtimeVersions = Object.freeze(Object.keys(retained));
export function runtimeFor(version: string): Runtime {
  const runtime = Object.prototype.hasOwnProperty.call(retained, version)
    ? retained[version]
    : undefined;
  if (!runtime)
    throw Error(
      `Rules version ${version} is unavailable. The operator must restore its archived runtime.`,
    );
  return runtime;
}
export const supportsRuntime = (version: string) =>
  Object.prototype.hasOwnProperty.call(retained, version);
