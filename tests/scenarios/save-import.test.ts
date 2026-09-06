import { createCipheriv, randomBytes } from "node:crypto";
import { it, expect } from "vitest";
import { parseSaveFile } from "../../packages/saves/import";
import { seal, unseal } from "../../packages/saves/server";
const fixture = () => ({
  name: "Private table",
  code: "ABCDEF123456",
  revision: 12,
  version: "2026-09-06.playtest.2",
  savedAt: new Date().toISOString(),
  envelope: seal({ private: "state" }),
});
it("accepts exported metadata and excludes untrusted extra properties", () => {
  const value = fixture();
  expect(
    parseSaveFile(
      JSON.stringify({
        ...value,
        id: "untrusted-id",
        kind: "auto",
        html: "<script>",
      }),
    ),
  ).toEqual(value);
});
it("rejects malformed metadata before it reaches the save library", () => {
  for (const patch of [
    { savedAt: 4 },
    { savedAt: "invalid date" },
    { code: "../../api" },
    { revision: -1 },
    { version: {} },
    { name: [] },
  ])
    expect(() =>
      parseSaveFile(JSON.stringify({ ...fixture(), ...patch })),
    ).toThrow("metadata");
});
it("rejects malformed envelopes and JSON", () => {
  for (const patch of [
    { iv: "x" },
    { tag: "x" },
    { data: {} },
    { format: 3 },
  ]) {
    const value = fixture();
    expect(() =>
      parseSaveFile(
        JSON.stringify({ ...value, envelope: { ...value.envelope, ...patch } }),
      ),
    ).toThrow("envelope");
  }
  expect(() => parseSaveFile("not JSON")).toThrow("valid JSON");
});

it("new saves compress long histories and old uncompressed files remain readable", () => {
  const oldKeys = process.env.SAVE_KEYS,
    oldCurrent = process.env.SAVE_CURRENT_KEY;
  try {
    const key = Buffer.alloc(32, 7);
    process.env.SAVE_KEYS = JSON.stringify({ fixture: key.toString("base64") });
    process.env.SAVE_CURRENT_KEY = "fixture";
    const state = {
      log: Array(1000).fill(
        "A public action with repeated structured information",
      ),
      hidden: "secret",
    };
    const current = seal(state);
    expect(current.format).toBe(2);
    expect(current.data.length).toBeLessThan(JSON.stringify(state).length / 5);
    expect(unseal(current)).toEqual(state);
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from("cyberpunk-save:1:fixture"));
    const data = Buffer.concat([
      cipher.update(JSON.stringify(state), "utf8"),
      cipher.final(),
    ]);
    expect(
      unseal({
        format: 1,
        keyId: "fixture",
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        data: data.toString("base64"),
      }),
    ).toEqual(state);
    expect(() => unseal({ ...current, format: 1 })).toThrow("modified");
  } finally {
    if (oldKeys === undefined) delete process.env.SAVE_KEYS;
    else process.env.SAVE_KEYS = oldKeys;
    if (oldCurrent === undefined) delete process.env.SAVE_CURRENT_KEY;
    else process.env.SAVE_CURRENT_KEY = oldCurrent;
  }
});
