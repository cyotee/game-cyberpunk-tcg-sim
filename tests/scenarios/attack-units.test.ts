import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  emit,
  power,
  modifier,
} from "../../packages/engine/kernel";
import { card } from "../../packages/catalog/index";
for (const [id, cost, power, ram, color, tags] of [
  ["dexter-deshawn-one-last-chance", 3, 4, 2, "Yellow", ["Fixer"]],
  ["el-sombrero-n-la-venganza-lenta", 5, 4, 4, "Red", ["Ganger", "Valentino"]],
  ["evelyn-parker-scheming-siren", 2, 0, 3, "Blue", ["Doll"]],
  ["goro-takemura-losing-his-way", 4, 4, 3, "Green", ["Arasaka", "Corpo"]],
  ["jackie-welles-ride-or-die-choom", 6, 8, 2, "Yellow", ["Merc", "Valentino"]],
  ["swordwise-huscle", 3, 3, 2, "Red", ["Merc"]],
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
      keywords: [],
    }));
for (const event of ["play", "attack"])
  it(`Dexter's ${event} may adjust any player's Gig by minus one, zero, or plus one`, () => {
    const g = scenario("dexter-deshawn-one-last-chance", event),
      d = g.gigs.find((d) => d.controller === "c" && d.sides === 6)!;
    advance(g);
    answer(g, "a", g.choice!.id, [d.id]);
    expect(g.choice!.options.map((o) => o.id)).toEqual(["1", "2", "3"]);
    answer(g, "a", g.choice!.id, ["3"]);
    expect(d.value).toBe(3);
  });
for (const difference of [9, 10, -10])
  it(`Dexter draws two when any Rival's Cred differs by at least ten (${difference})`, () => {
    const g = scenario("dexter-deshawn-one-last-chance", "defeated");
    g.gigs = g.gigs.filter((d) => d.sides === 20);
    g.gigs.find((d) => d.controller === "a")!.value = 10;
    g.gigs.find((d) => d.controller === "b")!.value = 10;
    g.gigs.find((d) => d.controller === "c")!.value = 10 + difference;
    // Avoid invalid die faces: the negative-ten boundary uses A=11 and C=1.
    if (difference === -10) {
      g.gigs.find((d) => d.controller === "a")!.value = 11;
      g.gigs.find((d) => d.controller === "b")!.value = 11;
      g.gigs.find((d) => d.controller === "c")!.value = 1;
    }
    const n = own(g, "a", "hand").length;
    advance(g);
    expect(own(g, "a", "hand")).toHaveLength(
      n + (Math.abs(difference) >= 10 ? 2 : 0),
    );
  });
for (const higher of [false, true])
  it(`Evelyn must draw, then discard only if a Rival has lower Cred (${higher})`, () => {
    const g = scenario("evelyn-parker-scheming-siren", "attack"),
      n = own(g, "a", "hand").length;
    if (higher)
      g.gigs.filter((d) => d.controller === "c").forEach((d) => (d.value = 1));
    advance(g);
    expect(own(g, "a", "hand")).toHaveLength(n + 1);
    if (higher) {
      expect(g.choice!.min).toBe(1);
      answer(g, "a", g.choice!.id, [g.choice!.options[0].id]);
      expect(own(g, "a", "hand")).toHaveLength(n);
    } else expect(g.choice).toBeUndefined();
  });
it("Jackie's attack snapshots the even-Gig count, and defeat counts the then-current odd Gigs", () => {
  const g = scenario("jackie-welles-ride-or-die-choom", "unused");
  g.pending = [];
  const p = own(g, "a", "field").find(
    (p) => p.cardId === "jackie-welles-ride-or-die-choom",
  )!;
  emit(g, { type: "attack", actor: "a", piece: { ...p } });
  advance(g);
  expect(power(g, p)).toBe(18);
  g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 1));
  expect(power(g, p)).toBe(18);
  const n = own(g, "a", "hand").length;
  emit(g, { type: "defeated", actor: "a", piece: { ...p } });
  advance(g);
  expect(own(g, "a", "hand")).toHaveLength(n + 6);
});
for (const before of [false, true])
  it(`Swordwise tests five power when the attack triggers, not from a later boost (${before})`, () => {
    const g = scenario("swordwise-huscle", "unused");
    g.pending = [];
    const p = own(g, "a", "field").find(
        (p) => p.cardId === "swordwise-huscle",
      )!,
      n = own(g, "a", "hand").length;
    if (before) modifier(g, "a", p.id, "power", 2);
    emit(g, { type: "attack", actor: "a", piece: { ...p } });
    if (!before) modifier(g, "a", p.id, "power", 2);
    advance(g);
    expect(own(g, "a", "hand")).toHaveLength(n + (before ? 1 : 0));
  });
for (const maximum of [false, true])
  it(`El Sombreron may pay two even without a max Gig, and its selected value is fixed (${maximum})`, () => {
    const g = scenario("el-sombrero-n-la-venganza-lenta", "attack"),
      source = g.pieces.find((p) => p.id === g.pending[0].source)!,
      eddies = own(g, "a", "eddies"),
      d = g.gigs.find((d) => d.controller === "a" && d.sides === 6)!;
    g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 1));
    if (maximum) d.value = 6;
    advance(g);
    answer(g, "a", g.choice!.id, ["yes"]);
    expect(g.choice!.min).toBe(2);
    answer(
      g,
      "a",
      g.choice!.id,
      eddies.slice(0, 2).map((p) => p.id),
    );
    if (maximum) {
      expect(g.choice!.options.map((o) => o.id)).toEqual([d.id]);
      answer(g, "a", g.choice!.id, [d.id]);
      d.value = 1;
    }
    expect(power(g, source)).toBe(maximum ? 10 : 4);
    expect(eddies.filter((p) => !p.ready)).toHaveLength(2);
  });
