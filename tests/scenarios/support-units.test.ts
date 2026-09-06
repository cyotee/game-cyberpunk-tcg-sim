import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  emit,
  power,
  job,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { cost, playPiece } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
for (const [id, n, power, ram, color, tags] of [
  [
    "panam-palmer-strength-through-family",
    6,
    6,
    4,
    "Green",
    ["Aldecado", "Merc", "Nomad"],
  ],
  ["pepe-najarro-working-doubles", 4, 6, 2, "Green", ["Valentino"]],
  ["saul-bright-stormrider", 8, 14, 2, "Green", ["Aldecado", "Nomad"]],
  ["viktor-vektor-drop-your-illusions", 5, 5, 2, "Yellow", ["Ripperdoc"]],
  ["maxtac-av", 5, 8, 2, "Green", ["NCPD", "Vehicle"]],
] as const)
  it(`${id}: printed baseline`, () =>
    expect(card(id)).toMatchObject({
      type: "Unit",
      cost: n,
      power,
      ram,
      color,
      tags,
      keywords: [],
      sell: false,
    }));
it("Bootleg: printed baseline", () =>
  expect(card("bootleg-black-sapphire-show")).toMatchObject({
    type: "Program",
    cost: 5,
    power: null,
    ram: 4,
    color: "Yellow",
    tags: ["Braindance"],
    keywords: [],
    sell: true,
  }));
it("Panam permits a free Call during its controller's turn without resetting the once-per-turn limit", () => {
  let g = scenario("panam-palmer-strength-through-family", "unused");
  g.pending = [];
  const p = own(g, "a", "legends")[0],
    n = own(g, "a", "eddies").filter((p) => p.ready).length;
  g = applyCommand(g, "a", { type: "call", piece: p.id });
  expect(g.pieces.find((x) => x.id === p.id)!.faceUp).toBe(true);
  expect(own(g, "a", "eddies").filter((p) => p.ready)).toHaveLength(n);
  expect(() =>
    applyCommand(g, "a", { type: "call", piece: own(g, "a", "legends")[1].id }),
  ).toThrow();
});
for (const empty of [false, true])
  it(`Panam must discard before drawing for face-up Legends (${empty})`, () => {
    const g = scenario("panam-palmer-strength-through-family", "attack");
    if (empty) own(g, "a", "hand").forEach((p) => (p.zone = "removed"));
    own(g, "a", "legends").forEach((p) => (p.faceUp = true));
    const n = own(g, "a", "hand").length;
    advance(g);
    if (empty) {
      expect(g.choice).toBeUndefined();
      expect(own(g, "a", "hand")).toHaveLength(0);
    } else {
      expect(g.choice!.min).toBe(1);
      answer(g, "a", g.choice!.id, [own(g, "a", "hand")[0].id]);
      expect(own(g, "a", "hand")).toHaveLength(n + 1);
    }
  });
for (const paired of [false, true])
  it(`Pepe readies only face-up Mercs in the Legends area with a value-pair (${paired})`, () => {
    const g = scenario("pepe-najarro-working-doubles", "attack"),
      legend = own(g, "a", "legends")[0];
    legend.faceUp = true;
    legend.ready = false;
    const other = own(g, "a", "legends")[1];
    other.faceUp = true;
    if (!paired)
      g.gigs
        .filter((d) => d.controller === "a")
        .forEach((d, i) => (d.value = i + 1));
    advance(g);
    if (!paired) {
      expect(g.choice).toBeUndefined();
      return;
    }
    expect(g.choice!.options.map((o) => o.id)).toEqual([legend.id]);
    expect(g.choice!.min).toBe(0);
    answer(g, "a", g.choice!.id, [legend.id]);
    expect(legend.ready).toBe(true);
  });
it("Saul gives other friendly attackers two power throughout attack stages and readies up to three at own end", () => {
  const g = scenario("saul-bright-stormrider", "unused"),
    src = own(g, "a", "field").find(
      (p) => p.cardId === "saul-bright-stormrider",
    )!,
    p = own(g, "a", "field")[0],
    n = power(g, p);
  g.pending = [];
  for (const stage of ["effects", "react", "fight", "steal"] as const) {
    g.attack = { attacker: p.id, defender: "b", target: "b", stage };
    expect(power(g, p)).toBe(n + 2);
    g.attack.attacker = src.id;
    expect(power(g, src)).toBe(14);
  }
  delete g.attack;
  emit(g, { type: "end", actor: "b" });
  advance(g);
  expect(g.choice).toBeUndefined();
  own(g, "a", "field").forEach((p) => (p.ready = false));
  emit(g, { type: "end", actor: "a" });
  advance(g);
  expect(g.choice!.min).toBe(0);
  expect(g.choice!.max).toBe(3);
  const ps = own(g, "a", "field").slice(0, 3);
  answer(
    g,
    "a",
    g.choice!.id,
    ps.map((p) => p.id),
  );
  expect(ps.every((p) => p.ready)).toBe(true);
  expect(src.ready).toBe(false);
});
it("Viktor discounts the first Cyberware per turn even off-turn and after a prior free play it is consumed", () => {
  const g = scenario("viktor-vektor-drop-your-illusions", "unused"),
    p = own(g, "a", "hand").find((p) => p.cardId === "sandevistan")!;
  g.pending = [];
  g.turnPlayer = "b";
  expect(cost(g, p)).toBe(Math.max(1, card(p.cardId).cost! - 3));
  const cheap = own(g, "a", "hand").find((p) => p.cardId === "mantis-blades")!;
  expect(cost(g, cheap)).toBe(1);
  playPiece(g, cheap, own(g, "a", "field")[0].id);
  advance(g);
  expect(cost(g, p)).toBe(card(p.cardId).cost);
});
for (const swap of [false, true])
  it(`MaxTac AV may swap ownership of any friendly and rival Gig (${swap})`, () => {
    const g = scenario("maxtac-av", "play"),
      a = g.gigs[0],
      c = g.gigs.find((d) => d.controller === "c")!,
      values = [a.value, c.value],
      owners = [a.owner, c.owner];
    advance(g);
    answer(g, "a", g.choice!.id, [swap ? "yes" : "no"]);
    if (swap) {
      answer(g, "a", g.choice!.id, [a.id]);
      answer(g, "a", g.choice!.id, [c.id]);
    }
    expect([a.controller, c.controller]).toEqual(
      swap ? ["c", "a"] : ["a", "c"],
    );
    expect([a.value, c.value]).toEqual(values);
    expect([a.owner, c.owner]).toEqual(owners);
  });
for (const mixed of [false, true])
  it(`Bootleg blindly sells a non-sellable top card even after a normal sale, and draws for mixed values (${mixed})`, () => {
    const g = scenario("bootleg-black-sapphire-show", "program"),
      top = own(g, "a", "deck")[0],
      n = own(g, "a", "hand").length;
    top.cardId = "animals-wrecker";
    g.players[0].sold = true;
    g.gigs
      .filter((d) => d.controller === "a")
      .forEach((d, i) => (d.value = mixed && i === 0 ? 1 : 2));
    advance(g);
    expect(top.zone).toBe("eddies");
    expect(top.faceUp).toBe(false);
    expect(top.ready).toBe(true);
    expect(g.log.some((e) => e.text.includes(card(top.cardId).nameFull))).toBe(
      false,
    );
    expect(own(g, "a", "hand")).toHaveLength(n + (mixed ? 2 : 0));
  });
