import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  importDeck,
  validateDeck,
  exportDeck,
  limits,
} from "../../packages/decks/index";
import { cards } from "../../packages/catalog/index";
import {
  newGame,
  applyCommand,
  type Game,
  power,
} from "../../packages/engine/index";
import {
  scripts,
  triggers,
  job,
  advance,
  modifier,
  piece,
  emit,
} from "../../packages/engine/kernel";
import { seal, unseal } from "../../packages/saves/server";
const fixture = readFileSync(
  "docs/rules-audit/the-heist-import-fixture.txt",
  "utf8",
);
export function game(count = 2): Game {
  return newGame(
    "TEST",
    Array.from({ length: count }, (_, i) => ({
      id: String(i),
      name: "Player " + i,
      deck: importDeck(fixture),
    })),
    Math.floor((6 * count) / 2) + 1,
    Array(40000).fill(0.41),
  );
}
function choose(g: Game, values?: string[]) {
  if (!g.choice) throw Error("Expected a choice");
  return applyCommand(g, g.choice.player, {
    type: "choose",
    choice: g.choice.id,
    values: values ?? g.choice.options.slice(0, g.choice.min).map((o) => o.id),
  });
}
export function started(count = 2) {
  let g = game(count);
  let guard = 0;
  while (g.phase !== "main") {
    if (++guard > 30) throw Error("Setup did not finish");
    g = choose(g, g.choice?.key === "yes" ? ["no"] : undefined);
  }
  return g;
}
describe("catalog and decks", () => {
  it("imports the Heist fixture with exact quantities and RAM", () => {
    const d = importDeck(fixture);
    expect(d.unresolved).toEqual([]);
    expect(validateDeck(d)).toEqual([]);
    expect(d.main.reduce((n, e) => n + e.quantity, 0)).toBe(40);
    expect(limits(d)).toMatchObject({ Blue: 4, Yellow: 2 });
    expect(importDeck(exportDeck(d)).main).toEqual(d.main);
  });
  it("combines quantities then reports legality; retains malformed lines", () => {
    const d = importDeck(fixture + "\n2x 065 Afterparty at Lizzie's\nbad line");
    expect(
      d.main.find((e) => e.cardId === "afterparty-at-lizzie-s")?.quantity,
    ).toBe(4);
    expect(d.unresolved).toContain("bad line");
    expect(validateDeck(d).some((e) => e.includes("At most 3"))).toBe(true);
  });
  it("does not substitute collector-number matches with a different name", () => {
    const d = importDeck("# Legends\n1x 001 Made Up Card");
    expect(d.legends).toEqual([]);
    expect(d.unresolved).toHaveLength(1);
  });
  it("catalog contains 150 playable-definition candidates, excluding Rebecca", () => {
    expect(cards).toHaveLength(150);
    expect(cards.some((c) => c.id === "rebecca-having-a-moment")).toBe(false);
  });
});
describe("rules kernel", () => {
  for (const n of [2, 3, 4, 5])
    it(`completes setup for ${n} players`, () => {
      const g = started(n);
      expect(g.players).toHaveLength(n);
      expect(g.gigs).toHaveLength(1);
      expect(g.gigs[0].sides).not.toBe(20);
      expect(g.phase).toBe("main");
      expect(
        g.pieces.filter(
          (p) =>
            p.controller === g.turnPlayer && p.zone === "legends" && !p.ready,
        ),
      ).toHaveLength(2);
    });
  it("rejects illegal commands without mutating state or randomness", () => {
    const g = started(),
      before = JSON.stringify(g);
    expect(() => applyCommand(g, "1", { type: "endTurn" })).toThrow();
    expect(JSON.stringify(g)).toBe(before);
  });
  it("checks normal victory before readying/drawing", () => {
    let g = started();
    const next = g.players.find((p) => p.id !== g.turnPlayer)!.id;
    g.gigs = Array.from({ length: g.target }, (_, i) => ({
      id: "d" + i,
      owner: next,
      controller: next,
      sides: 6,
      value: 3,
    }));
    g = applyCommand(g, g.turnPlayer, { type: "endTurn" });
    expect(g.winner).toBe(next);
    expect(g.phase).toBe("finished");
  });
  it("last non-eliminated player wins; rolled Gig controller is preserved", () => {
    let g = started();
    g.gigs.push({
      id: "stolen",
      owner: "1",
      controller: "0",
      sides: 20,
      value: 17,
    });
    g = applyCommand(g, "1", { type: "concede" });
    expect(g.winner).toBe("0");
    expect(g.gigs.find((d) => d.id === "stolen")).toMatchObject({
      controller: "0",
      value: 17,
    });
    expect(g.players[1].fixer).toEqual([]);
    expect(
      g.pieces
        .filter((p) => p.controller === "1")
        .every((p) => p.zone === "removed"),
    ).toBe(true);
  });
  it("scheduler holds the current player batch for new effects", () => {
    const g = started(3);
    const events: string[] = [];
    scripts.testA = [
      ({ g }) => {
        events.push("A1");
        g.pending.push(job(g, "testA2", "0"));
      },
    ];
    scripts.testA2 = [
      () => {
        events.push("A2");
      },
    ];
    scripts.testB = [
      () => {
        events.push("B1");
      },
    ];
    g.pending = [job(g, "testA", "0"), job(g, "testB", "1")];
    advance(g);
    expect(events).toEqual(["A1", "A2", "B1"]);
  });
  it("a resumable choice continues after an encrypted round trip", () => {
    const original = game(3),
      saved = unseal<Game>(seal(original));
    expect(choose(saved)).toEqual(choose(original));
  });
  it("save encryption hides identities and rejects modification", () => {
    const g = game(),
      e = seal(g);
    expect(JSON.stringify(e)).not.toContain("viktor-vektor");
    expect(unseal<Game>(e)).toEqual(g);
    expect(() => unseal({ ...e, data: "AAAA" + e.data.slice(4) })).toThrow();
  });
  it("every Program has an explicit handler", () => {
    expect(
      cards
        .filter((c) => c.type === "Program" && !scripts[c.id + ":program"])
        .map((c) => c.id),
    ).toEqual([]);
  });
});

it("old saves decrypt after key rotation while new saves use the new key", () => {
  const previous = {
    keys: process.env.SAVE_KEYS,
    current: process.env.SAVE_CURRENT_KEY,
  };
  try {
    process.env.SAVE_KEYS = JSON.stringify({
      old: Buffer.alloc(32, 1).toString("base64"),
    });
    process.env.SAVE_CURRENT_KEY = "old";
    const old = seal({ hidden: "original" });
    process.env.SAVE_KEYS = JSON.stringify({
      old: Buffer.alloc(32, 1).toString("base64"),
      next: Buffer.alloc(32, 2).toString("base64"),
    });
    process.env.SAVE_CURRENT_KEY = "next";
    expect(unseal(old)).toEqual({ hidden: "original" });
    expect(seal({}).keyId).toBe("next");
  } finally {
    if (previous.keys === undefined) delete process.env.SAVE_KEYS;
    else process.env.SAVE_KEYS = previous.keys;
    if (previous.current === undefined) delete process.env.SAVE_CURRENT_KEY;
    else process.env.SAVE_CURRENT_KEY = previous.current;
  }
});
