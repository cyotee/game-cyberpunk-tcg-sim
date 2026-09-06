import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import { own, modifier, field } from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { cost, mayAttack } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
import { gameView } from "../../apps/service/rooms";
for (const [id, n, power, ram, color, tags, blocker] of [
  ["corpo-security", 2, 2, 1, "Green", ["Corpo"], true],
  [
    "jacked-in-voodoo-boy",
    2,
    2,
    2,
    "Blue",
    ["Netrunner", "Voodoo Boys"],
    false,
  ],
  ["maxtac-heavy", 7, 8, 3, "Green", ["NCPD"], false],
  ["maxtac-suppression-team", 5, 7, 1, "Yellow", ["NCPD"], false],
  [
    "nadia-fighting-through-grief",
    6,
    8,
    2,
    "Green",
    ["Medtech", "Trauma Team"],
    false,
  ],
  ["octant", 7, 8, 4, "Red", ["Drone", "Militech", "Zetatech"], false],
  [
    "trauma-team-operatives",
    6,
    7,
    2,
    "Yellow",
    ["Medtech", "Trauma Team"],
    false,
  ],
  ["valentino-guerrera", 3, 4, 2, "Red", ["Ganger", "Valentino"], false],
] as const)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Unit",
      cost: n,
      power,
      ram,
      color,
      tags,
      keywords: blocker ? ["Blocker"] : [],
      sell: false,
    }));
it("Corpo Security cannot attack even with Adrenaline but can spend to Block", () => {
  let g = scenario("corpo-security", "unused");
  g.pending = [];
  const p = own(g, "a", "field").find((p) => p.cardId === "corpo-security")!;
  p.entered = g.turn;
  modifier(g, "a", p.id, "Adrenaline");
  expect(mayAttack(g, p, "b")).toBe(false);
  p.entered = 0;
  expect(mayAttack(g, p, "b")).toBe(false);
  g.turnPlayer = "b";
  g = applyCommand(g, "b", {
    type: "attack",
    piece: own(g, "b", "field")[0].id,
    target: "a",
  });
  expect(gameView(g, "a").legal.blockers).toContain(p.id);
  expect(gameView(g, "c").legal.blockers).toEqual([]);
  g = applyCommand(g, "a", { type: "block", piece: p.id });
  expect(g.attack!.target).toBe(p.id);
  expect(g.pieces.find((x) => x.id === p.id)!.ready).toBe(false);
});
it("Voodoo Boy needs its controller's Program that turn even with Adrenaline", () => {
  const g = scenario("jacked-in-voodoo-boy", "unused"),
    p = own(g, "a", "field").find((p) => p.cardId === "jacked-in-voodoo-boy")!;
  g.pending = [];
  p.entered = g.turn;
  modifier(g, "a", p.id, "Adrenaline");
  g.players[0].programs = 0;
  expect(mayAttack(g, p, "b")).toBe(false);
  g.players[1].programs = 3;
  expect(mayAttack(g, p, "b")).toBe(false);
  g.players[0].programs = 1;
  expect(mayAttack(g, p, "b")).toBe(true);
});
for (const id of ["riding-nomad", "jackie-welles-mama-s-favorite"])
  it(`Suppression stops a newly played ${id} against every Rival, but not its own Units`, () => {
    const g = scenario("maxtac-suppression-team", "unused");
    g.pending = [];
    const enemy = own(g, "b", "field")[0];
    enemy.cardId = id;
    enemy.entered = g.turn;
    modifier(g, "b", enemy.id, "Adrenaline");
    g.turnPlayer = "b";
    expect(mayAttack(g, enemy, "a")).toBe(false);
    expect(mayAttack(g, enemy, "c")).toBe(false);
    enemy.entered = 0;
    expect(mayAttack(g, enemy, "c")).toBe(true);
    g.turnPlayer = "a";
    const friendly = own(g, "a", "field")[0];
    friendly.cardId = "riding-nomad";
    friendly.entered = g.turn;
    expect(mayAttack(g, friendly, "b")).toBe(true);
  });
it("Nadia's entry permission binds to a richer Rival's Gig area and is not rechecked after declaration", () => {
  let g = scenario("nadia-fighting-through-grief", "unused");
  g.pending = [];
  const p = own(g, "a", "field").find(
    (p) => p.cardId === "nadia-fighting-through-grief",
  )!;
  p.entered = g.turn;
  g.gigs.find((d) => d.controller === "c")!.controller = "b";
  expect(mayAttack(g, p, "b")).toBe(true);
  expect(mayAttack(g, p, "c")).toBe(false);
  expect(mayAttack(g, p, own(g, "b", "field")[1].id)).toBe(false);
  g = applyCommand(g, "a", { type: "attack", piece: p.id, target: "b" });
  g.gigs
    .filter((d) => d.controller === "b")
    .slice(0, 3)
    .forEach((d) => (d.controller = "a"));
  g = applyCommand(g, "b", { type: "endReaction" });
  expect(g.choice!.label).toContain("steal");
});
it("Valentino attacks only qualifying ready Blockers, and its target cannot Block its own attack", () => {
  let g = scenario("valentino-guerrera", "unused");
  g.pending = [];
  const p = own(g, "a", "field").find(
    (p) => p.cardId === "valentino-guerrera",
  )!;
  const b = own(g, "b", "field")[2],
    c = own(g, "c", "field")[2];
  g.gigs.filter((d) => d.controller === "b").forEach((d) => (d.value = 1));
  expect(mayAttack(g, p, b.id)).toBe(true);
  expect(mayAttack(g, p, c.id)).toBe(false);
  expect(mayAttack(g, p, own(g, "b", "field")[0].id)).toBe(false);
  g = applyCommand(g, "a", { type: "attack", piece: p.id, target: b.id });
  expect(gameView(g, "b").legal.blockers).not.toContain(b.id);
  expect(() => applyCommand(g, "b", { type: "block", piece: b.id })).toThrow(
    "cannot block",
  );
});
it("Octant's payment counts controlled high-value Gigs and bottoms out at one", () => {
  const g = scenario("octant", "unused"),
    p = own(g, "a", "field").find((p) => p.cardId === "octant")!;
  expect(cost(g, p)).toBe(4);
  g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 8));
  expect(cost(g, p)).toBe(1);
  expect(card(p.cardId).cost).toBe(7);
});
it("Trauma Team payment counts only Units in its own trash, to a minimum of one", () => {
  const g = scenario("trauma-team-operatives", "unused"),
    p = own(g, "a", "field").find(
      (p) => p.cardId === "trauma-team-operatives",
    )!;
  own(g, "a", "trash")
    .filter((p) => card(p.cardId).type === "Unit")
    .forEach((p) => (p.zone = "removed"));
  expect(cost(g, p)).toBe(6);
  const units = own(g, "a", "hand").filter(
    (p) => card(p.cardId).type === "Unit",
  );
  units.slice(0, 2).forEach((p) => (p.zone = "trash"));
  expect(cost(g, p)).toBe(4);
  units.slice(2, 8).forEach((p) => (p.zone = "trash"));
  expect(cost(g, p)).toBe(1);
  expect(card(p.cardId).cost).toBe(6);
});
it("MaxTac Heavy uses one Rival's Unit count, excluding their Gear and Legends area", () => {
  const g = scenario("maxtac-heavy", "unused"),
    p = own(g, "a", "field").find((p) => p.cardId === "maxtac-heavy")!;
  expect(cost(g, p, false, "b")).toBe(4);
  const gear = own(g, "b", "hand").find((p) => p.cardId === "mantis-blades")!;
  gear.zone = "field";
  gear.host = own(g, "b", "field")[0].id;
  own(g, "b", "legends")[0].faceUp = true;
  expect(cost(g, p, false, "b")).toBe(4);
  own(g, "b", "hand")
    .filter((p) => card(p.cardId).type === "Unit")
    .slice(0, 8)
    .forEach((p) => (p.zone = "field"));
  expect(cost(g, p, false, "b")).toBe(1);
  expect(cost(g, p, false, "c")).toBe(4);
  expect(card(p.cardId).cost).toBe(7);
});
