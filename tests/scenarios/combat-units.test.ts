import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  power,
  modifier,
  emit,
  spend,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { card } from "../../packages/catalog/index";
for (const [id, cost, power, ram, color, tags, blocker] of [
  ["augmented-negotiators", 3, 2, 1, "Yellow", ["Arasaka", "Corpo"], true],
  [
    "johnny-silverhand-never-stop-fighting",
    6,
    8,
    2,
    "Red",
    ["Merc", "Rocker", "Samurai"],
    false,
  ],
  [
    "la-llorona-ghost-of-the-past",
    3,
    3,
    1,
    "Red",
    ["Ganger", "Valentino"],
    true,
  ],
  ["maelstrom-zealots", 4, 0, 1, "Green", ["Ganger", "Maelstrom"], false],
  [
    "meredith-stout-stone-cold-corpo",
    4,
    5,
    1,
    "Red",
    ["Corpo", "Militech"],
    true,
  ],
  [
    "rita-wheeler-no-stupid-questions",
    4,
    4,
    2,
    "Blue",
    ["Ganger", "Mox"],
    true,
  ],
] as const)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Unit",
      cost,
      power,
      ram,
      color,
      tags,
      sell: false,
      keywords: blocker ? ["Blocker"] : [],
    }));
for (const empty of [false, true])
  it(`Augmented Negotiators redirects an attack and selects a Rival to discard, even with an empty hand (${empty})`, () => {
    let g = scenario("augmented-negotiators", "unused");
    g.pending = [];
    g.turnPlayer = "b";
    const p = own(g, "a", "field").find(
      (p) => p.cardId === "augmented-negotiators",
    )!;
    if (empty) own(g, "c", "hand").forEach((p) => (p.zone = "trash"));
    g = applyCommand(g, "b", {
      type: "attack",
      piece: own(g, "b", "field")[0].id,
      target: "a",
    });
    g = applyCommand(g, "a", { type: "block", piece: p.id });
    expect(g.attack!.target).toBe(p.id);
    g = applyCommand(g, "a", {
      type: "choose",
      choice: g.choice!.id,
      values: ["c"],
    });
    if (!empty) {
      const discard = own(g, "c", "hand")[0];
      expect(g.choice!.player).toBe("c");
      g = applyCommand(g, "c", {
        type: "choose",
        choice: g.choice!.id,
        values: [discard.id],
      });
      expect(g.pieces.find((p) => p.id === discard.id)!.zone).toBe("trash");
    }
    expect(g.choice).toBeUndefined();
    expect(g.attack!.stage).toBe("react");
  });
it("La Llorona adjusts before combat and another Blocker may redirect again", () => {
  let g = scenario("la-llorona-ghost-of-the-past", "unused");
  g.pending = [];
  g.turnPlayer = "b";
  const p = own(g, "a", "field").find(
      (p) => p.cardId === "la-llorona-ghost-of-the-past",
    )!,
    other = own(g, "a", "field")[2],
    die = g.gigs.find((d) => d.controller === "c" && d.sides === 6)!;
  g = applyCommand(g, "b", {
    type: "attack",
    piece: own(g, "b", "field")[0].id,
    target: "a",
  });
  g = applyCommand(g, "a", { type: "block", piece: p.id });
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [die.id],
  });
  expect(g.choice!.options.map((o) => o.id)).toEqual(["2", "3", "4", "5"]);
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: ["5"],
  });
  expect(g.attack!.stage).toBe("react");
  g = applyCommand(g, "a", { type: "block", piece: other.id });
  expect(g.attack!.target).toBe(other.id);
});
it("Rita draws then discards only for her first spend that turn, including a Block", () => {
  let g = scenario("rita-wheeler-no-stupid-questions", "unused");
  g.pending = [];
  g.turnPlayer = "b";
  const p = own(g, "a", "field").find(
      (p) => p.cardId === "rita-wheeler-no-stupid-questions",
    )!,
    n = own(g, "a", "hand").length;
  g = applyCommand(g, "b", {
    type: "attack",
    piece: own(g, "b", "field")[0].id,
    target: "a",
  });
  g = applyCommand(g, "a", { type: "block", piece: p.id });
  expect(own(g, "a", "hand")).toHaveLength(n + 1);
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [g.choice!.options[0].id],
  });
  expect(own(g, "a", "hand")).toHaveLength(n);
  const r = g.pieces.find((x) => x.id === p.id)!;
  r.ready = true;
  spend(g, r);
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(own(g, "a", "hand")).toHaveLength(n);
});
it("Rita decks out when her mandatory draw cannot be completed", () => {
  const g = scenario("rita-wheeler-no-stupid-questions", "unused");
  g.pending = [];
  own(g, "a", "deck").forEach((p) => (p.zone = "removed"));
  spend(
    g,
    own(g, "a", "field").find(
      (p) => p.cardId === "rita-wheeler-no-stupid-questions",
    )!,
  );
  advance(g);
  expect(g.players[0].eliminated).toBe(true);
});
for (const protectedUnit of [false, true])
  it(`Zealots' loss defeats only its fight opponent before normal combat defeat (${protectedUnit})`, () => {
    let g = scenario("maelstrom-zealots", "unused");
    g.pending = [];
    g.turnPlayer = "b";
    const p = own(g, "a", "field").find(
        (p) => p.cardId === "maelstrom-zealots",
      )!,
      enemy = own(g, "b", "field")[0];
    p.ready = false;
    if (protectedUnit) modifier(g, "a", p.id, "fightSafe");
    g = applyCommand(g, "b", { type: "attack", piece: enemy.id, target: p.id });
    g = applyCommand(g, "a", { type: "endReaction" });
    expect(g.pieces.find((p) => p.id === enemy.id)!.zone).toBe("trash");
    expect(g.pieces.find((x) => x.id === p.id)!.zone).toBe("field");
    expect(own(g, "c", "field")).toHaveLength(3);
  });
for (const zero of [false, true])
  it(`Johnny wins against stronger Corpo Units, but cannot defeat them at zero power (${zero})`, () => {
    let g = scenario("johnny-silverhand-never-stop-fighting", "unused");
    g.pending = [];
    const johnny = own(g, "a", "field").find(
        (p) => p.cardId === "johnny-silverhand-never-stop-fighting",
      )!,
      enemy = own(g, "b", "field")[0];
    enemy.cardId = "corpo-security";
    enemy.ready = false;
    modifier(g, "b", enemy.id, "power", 30);
    if (zero) modifier(g, "a", johnny.id, "power", -8);
    g = applyCommand(g, "a", {
      type: "attack",
      piece: johnny.id,
      target: enemy.id,
    });
    g = applyCommand(g, "b", { type: "endReaction" });
    expect(g.pieces.find((p) => p.id === johnny.id)).toMatchObject({
      zone: "field",
      ready: true,
    });
    expect(g.pieces.find((p) => p.id === enemy.id)!.zone).toBe(
      zero ? "field" : "trash",
    );
  });
it("Johnny's first victory readies him even on defense, but a second victory that turn does not", () => {
  let g = scenario("johnny-silverhand-never-stop-fighting", "unused");
  g.pending = [];
  g.turnPlayer = "b";
  const johnny = own(g, "a", "field").find(
    (p) => p.cardId === "johnny-silverhand-never-stop-fighting",
  )!;
  johnny.ready = false;
  for (let i = 0; i < 2; i++) {
    const enemy = own(g, "b", "field")[0];
    enemy.cardId = "corpo-security";
    enemy.ready = true;
    modifier(g, "b", enemy.id, "power", 30); // Corpo Security cannot attack; use a different Corpo identity.
    enemy.cardId = "goro-takemura-hands-unclean";
    g.pieces.find((p) => p.id === johnny.id)!.ready = false;
    g = applyCommand(g, "b", {
      type: "attack",
      piece: enemy.id,
      target: johnny.id,
    });
    g = applyCommand(g, "a", { type: "endReaction" });
    expect(g.pieces.find((p) => p.id === johnny.id)!.ready).toBe(i === 0);
  }
});
it("Meredith's power bonus applies only while she fights a Legend", () => {
  const g = scenario("meredith-stout-stone-cold-corpo", "unused");
  g.pending = [];
  const p = own(g, "a", "field").find(
      (p) => p.cardId === "meredith-stout-stone-cold-corpo",
    )!,
    opponent = own(g, "b", "field")[0];
  opponent.cardId = "goro-takemura-hands-unclean";
  g.attack = {
    attacker: opponent.id,
    target: p.id,
    defender: "a",
    stage: "react",
  };
  expect(power(g, p)).toBe(5);
  g.attack.stage = "fight";
  expect(power(g, p)).toBe(7);
  opponent.cardId = "animals-wrecker";
  expect(power(g, p)).toBe(5);
});
it("Meredith offers one optional retrieval when a Rival swaps multiple friendly Gigs", () => {
  const g = scenario("meredith-stout-stone-cold-corpo", "unused");
  g.pending = [];
  const dice = g.gigs.filter((d) => d.controller === "a").slice(0, 2);
  emit(g, { type: "adjust", actor: "c", gigs: dice }); // Swap shares the batched Gig-change event.
  advance(g);
  expect(g.choice!.min).toBe(0);
  const p = own(g, "a", "trash")[0];
  answer(g, "a", g.choice!.id, [p.id]);
  expect(p.zone).toBe("hand");
  expect(g.choice).toBeUndefined();
  emit(g, { type: "adjust", actor: "a", gig: dice[0] });
  advance(g);
  expect(g.choice).toBeUndefined();
});
