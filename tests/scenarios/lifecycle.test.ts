import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { importDeck } from "../../packages/decks/index";
import { newGame, applyCommand, type Game } from "../../packages/engine/index";
import {
  modifier,
  own,
  job,
  advance,
  scripts,
  answer,
  defeat,
  player,
  checkVictory,
} from "../../packages/engine/kernel";
const deck = importDeck(
  readFileSync("docs/rules-audit/the-heist-import-fixture.txt", "utf8"),
);
function start(n = 3) {
  let g = newGame(
    "lifecycle",
    Array.from({ length: n }, (_, i) => ({
      id: String(i),
      name: "Player " + i,
      deck,
    })),
    100,
    Array(20000).fill(0.32),
  );
  let guard = 0;
  while (g.choice) {
    if (++guard > 30) throw Error("Setup stalled");
    const c = g.choice;
    g = applyCommand(g, c.player, {
      type: "choose",
      choice: c.id,
      values:
        c.key === "yes" ? ["no"] : c.options.slice(0, c.min).map((o) => o.id),
    });
  }
  return g;
}
function resolve(g: Game) {
  let n = 0;
  while (g.choice) {
    if (++n > 100) throw Error("Resolution stalled");
    const c = g.choice;
    g = applyCommand(g, c.player, {
      type: "choose",
      choice: c.id,
      values: c.options.slice(0, c.min).map((o) => o.id),
    });
  }
  return g;
}
it("d20 roll does not start overtime; all empty-fixer turns must finish", () => {
  let g = start();
  for (const p of g.players) p.fixer = [20];
  for (let i = 0; i < 3; i++) {
    g = resolve(applyCommand(g, g.turnPlayer, { type: "endTurn" }));
    expect(g.overtime).toBe(false);
  }
  for (let i = 0; i < 3; i++) {
    g = resolve(applyCommand(g, g.turnPlayer, { type: "endTurn" }));
    expect(g.overtime).toBe(false);
  }
  g = resolve(applyCommand(g, g.turnPlayer, { type: "endTurn" }));
  expect(g.overtime).toBe(true);
});
it("Sudden Death gives the triggering turn player one additional full turn", () => {
  let g = start();
  g.overtime = true;
  g.target = 1;
  g.gigs = [
    { id: "a", owner: "0", controller: "0", sides: 6, value: 2 },
    { id: "b", owner: "1", controller: "1", sides: 6, value: 2 },
  ];
  checkVictory(g);
  expect(g.sudden).toBeDefined();
  g = resolve(applyCommand(g, "0", { type: "endTurn" }));
  expect(g.sudden!.remaining).toContain("0");
  expect(g.winner).toBeUndefined();
});
it("Sudden Death compares players without turns and expires at skipped positions", () => {
  let g = start();
  g.sudden = { eligible: ["0", "2"], remaining: ["0", "2"] };
  g.players.forEach((p) => (p.fixer = []));
  g.gigs = [
    { id: "a", owner: "1", controller: "1", sides: 6, value: 2 },
    { id: "b", owner: "1", controller: "1", sides: 8, value: 2 },
  ];
  modifier(g, "1", "some-unit", "noAttack", 0, "next");
  g = resolve(applyCommand(g, "0", { type: "endTurn" }));
  expect(g.turnPlayer).toBe("2");
  expect(
    g.mods.find((m) => m.controller === "1" && m.expires === "next"),
  ).toBeUndefined();
  g = resolve(applyCommand(g, "2", { type: "endTurn" }));
  expect(g.winner).toBe("1");
});
it("pending effects are chosen within one player batch before following players", () => {
  const g = start(),
    events: string[] = [];
  const p = own(g, "0", "hand")[0];
  scripts["batch:1"] = [
    () => {
      events.push("A1");
    },
  ];
  scripts["batch:2"] = [
    () => {
      events.push("A2");
    },
  ];
  scripts["batch:3"] = [
    () => {
      events.push("B1");
    },
  ];
  g.pending = [
    job(g, "batch:1", "0", p.id),
    job(g, "batch:2", "0", p.id),
    job(g, "batch:3", "1", p.id),
  ];
  advance(g);
  expect(g.choice!.player).toBe("0");
  const second = g.pending.find((j) => j.key === "batch:2")!;
  answer(g, "0", g.choice!.id, [second.id]);
  expect(events).toEqual(["A2", "A1", "B1"]);
});
it("new effects for an earlier player wait until the next circuit", () => {
  const g = start(),
    events: string[] = [];
  const p = own(g, "0", "hand")[0];
  scripts["circuit:A"] = [
    () => {
      events.push("A");
    },
  ];
  scripts["circuit:B"] = [
    ({ g }) => {
      events.push("B");
      g.pending.push(job(g, "circuit:A", "0", p.id));
    },
  ];
  scripts["circuit:C"] = [
    () => {
      events.push("C");
    },
  ];
  g.pending = [job(g, "circuit:B", "1", p.id), job(g, "circuit:C", "2", p.id)];
  advance(g);
  expect(events).toEqual(["B", "C", "A"]);
});
it("spent-cost activation rejects Lag even when Adrenaline permits attacking", () => {
  let g = start();
  const p = own(g, "0", "hand")[0];
  p.cardId = "kerry-eurodyne-the-last-rockerboy";
  p.zone = "field";
  p.entered = g.turn;
  modifier(g, "0", p.id, "Adrenaline");
  expect(() => applyCommand(g, "0", { type: "activate", piece: p.id })).toThrow(
    "Cannot activate",
  );
});
for (const count of [2, 3, 4, 5])
  it(`finishes a ${count}-player match through legal turns and deck-out`, () => {
    let g = start(count),
      turns = 0;
    while (g.phase !== "finished") {
      if (++turns > 250) throw Error("Match did not finish");
      g = resolve(applyCommand(g, g.turnPlayer, { type: "endTurn" }));
    }
    expect(g.winner).toBeDefined();
    expect(g.players.filter((p) => !p.eliminated)).toHaveLength(1);
    expect(g.gigs).toHaveLength(6 * count);
  });

it("a defender conceding during reactions ends a Unit attack and releases the action window", () => {
  let g = start();
  const attacker = own(g, "0", "hand")[0];
  attacker.cardId = "animals-wrecker";
  attacker.zone = "field";
  attacker.entered = 0;
  const defender = own(g, "1", "hand")[0];
  defender.cardId = "animals-wrecker";
  defender.zone = "field";
  defender.ready = false;
  g = applyCommand(g, "0", {
    type: "attack",
    piece: attacker.id,
    target: defender.id,
  });
  expect(g.attack?.stage).toBe("react");
  g = applyCommand(g, "1", { type: "concede" });
  expect(g.players[1].eliminated).toBe(true);
  expect(g.attack).toBeUndefined();
  expect(g.phase).toBe("main");
  expect(() => applyCommand(g, "0", { type: "endTurn" })).not.toThrow();
});

it("a defender conceding during reactions leaves rolled Gigs available to the current attacker", () => {
  let g = start();
  const attacker = own(g, "0", "hand")[0];
  attacker.cardId = "animals-wrecker";
  attacker.zone = "field";
  attacker.entered = 0;
  g.gigs.push({
    id: "abandoned",
    owner: "1",
    controller: "1",
    sides: 6,
    value: 1,
  });
  g = applyCommand(g, "0", { type: "attack", piece: attacker.id, target: "1" });
  expect(g.attack?.stage).toBe("react");
  g = resolve(applyCommand(g, "1", { type: "concede" }));
  expect(g.gigs.find((d) => d.id === "abandoned")?.controller).toBe("0");
  expect(g.attack).toBeUndefined();
});
