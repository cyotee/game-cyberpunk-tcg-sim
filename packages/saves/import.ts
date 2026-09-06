import type { Envelope } from "./server";
export interface SaveMetadata {
  name: string;
  code: string;
  revision: number;
  generation?: number;
  version: string;
  savedAt: string;
  envelope: Envelope;
}
export function parseSaveFile(text: string): SaveMetadata {
  if (text.length > 20_000_000) throw Error("Save file is too large");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw Error("Save file is not valid JSON");
  }
  if (!value || typeof value !== "object") throw Error("Not a saved game file");
  const s = value as Record<string, unknown>;
  const e = s.envelope as Partial<Envelope> | undefined;
  if (
    typeof s.name !== "string" ||
    s.name.length > 80 ||
    typeof s.code !== "string" ||
    !/^[A-F0-9]{12}$/.test(s.code) ||
    !Number.isSafeInteger(s.revision) ||
    (s.revision as number) < 0 ||
    typeof s.version !== "string" ||
    s.version.length > 100 ||
    typeof s.savedAt !== "string" ||
    s.savedAt.length > 40 ||
    !Number.isFinite(Date.parse(s.savedAt))
  )
    throw Error("Saved game metadata is invalid");
  if (
    s.generation !== undefined &&
    (!Number.isSafeInteger(s.generation) || (s.generation as number) < 1)
  )
    throw Error("Saved game metadata is invalid");
  if (
    !e ||
    (e.format !== 1 && e.format !== 2) ||
    typeof e.keyId !== "string" ||
    !e.keyId.length ||
    e.keyId.length > 100 ||
    typeof e.iv !== "string" ||
    !/^[A-Za-z0-9+/]{16}$/.test(e.iv) ||
    typeof e.tag !== "string" ||
    !/^[A-Za-z0-9+/]{22}==$/.test(e.tag) ||
    typeof e.data !== "string" ||
    !e.data.length ||
    e.data.length > 16_000_000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(e.data)
  )
    throw Error("Saved game envelope is invalid");
  return {
    name: s.name,
    code: s.code,
    revision: s.revision as number,
    ...(s.generation === undefined
      ? {}
      : { generation: s.generation as number }),
    version: s.version,
    savedAt: s.savedAt,
    envelope: e as Envelope,
  };
}
