import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  runtimeFor,
  latestRuntime,
  runtimeVersions,
} from "../../packages/runtimes/index";
import { copyStarter, starters } from "../../packages/decks/starters";
import {
  validateDeck,
  exportDeck,
  importDeck,
} from "../../packages/decks/index";
import { gameView } from "../../apps/service/rooms";
import manifest from "../../packages/runtimes/archives/manifest.json";
describe("retained rules runtimes", () => {
  it("retains an intact self-contained archive and refuses unknown versions", () => {
    for (const entry of Object.values(manifest))
      expect(
        createHash("sha256")
          .update(readFileSync("packages/runtimes/archives/" + entry.file))
          .digest("hex"),
      ).toBe(entry.sha256);
    expect(runtimeVersions).toHaveLength(2);
    expect(() => runtimeFor("__proto__")).toThrow();
  });
  it("dispatches a restored mid-choice save to its original code and catalog", () => {
    const old = runtimeFor("2026-09-05.playtest.1");
    const g = old.newGame(
      "old",
      [
        { id: "a", name: "A", deck: copyStarter(0) },
        { id: "b", name: "B", deck: copyStarter(1) },
      ],
      7,
      Array(10000).fill(0.4),
    );
    const command = { type: "choose", choice: g.choice!.id, values: ["a"] };
    expect(() =>
      latestRuntime.applyCommand(g, g.choice!.player, command),
    ).toThrow();
    const restored = JSON.parse(JSON.stringify(g));
    const next = runtimeFor(restored.version).applyCommand(
      restored,
      g.choice!.player,
      command,
    );
    expect(next.version).toBe(old.VERSION);
    expect(next.choice!.label).toContain("Mulligan");
    expect(gameView(next, "a").version).toBe(old.VERSION);
    for (const p of next.pieces.filter((p) => p.zone === "legends"))
      p.faceUp = true;
    expect(gameView(next, "a").legal.legendPlayCosts).toEqual({});
    expect(old.scripts).not.toBe(latestRuntime.scripts);
    expect(old.cards).not.toBe(latestRuntime.cards);
  });
});
describe("official constructed starters", () => {
  for (let i = 0; i < starters.length; i++)
    it(starters[i].name, () => {
      const d = copyStarter(i);
      expect(validateDeck(d)).toEqual([]);
      expect(d.legends.reduce((n, e) => n + e.quantity, 0)).toBe(3);
      expect(d.main.reduce((n, e) => n + e.quantity, 0)).toBe(40);
      expect(
        importDeck(exportDeck(d)).main.map((e) => [e.cardId, e.quantity]),
      ).toEqual(d.main.map((e) => [e.cardId, e.quantity]));
      const other = copyStarter(i);
      d.main[0].quantity = 0;
      expect(other.main[0].quantity).toBeGreaterThan(0);
      expect(other.id).not.toBe(d.id);
    });
});
