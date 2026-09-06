import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import { advance, answer, own, power } from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { card } from "../../packages/catalog/index";
const observed = [
  {
    id: "afterparty-at-lizzie-s",
    color: "Yellow",
    tags: ["BRAINDANCE", "MOX"],
    keywords: [],
  },
  {
    id: "industrial-assembly",
    color: "Red",
    tags: ["ARASAKA", "BRAINDANCE"],
    keywords: [],
  },
  { id: "trust-no-one", color: "Blue", tags: ["BRAINDANCE"], keywords: [] },
  { id: "peace-offering", color: "Green", tags: ["BRAINDANCE"], keywords: [] },
  {
    id: "floor-it",
    color: "Blue",
    tags: ["MERC", "QUICKHACK"],
    keywords: ["Quick"],
  },
];
for (const expected of observed)
  it(`${expected.id}: printed Program baseline`, () => {
    const c = card(expected.id);
    expect({ ...c, tags: c.tags.map((t) => t.toUpperCase()) }).toMatchObject({
      ...expected,
      cost: 1,
      ram: 1,
      power: null,
      sell: true,
      type: "Program",
    });
  });
for (const [slug, amount, mode] of [
  ["afterparty-at-lizzie-s", 1, "both"],
  ["industrial-assembly", 4, "increase"],
  ["trust-no-one", 3, "decrease"],
] as const) {
  it(`${slug}: legal adjustment range, third-player targeting and conditional draw`, () => {
    const g = scenario(slug, "program");
    const before = own(g, "a", "hand").length;
    const die = g.gigs.find((d) => d.controller === "c" && d.sides === 6)!;
    die.value = 3;
    advance(g);
    answer(g, "a", g.choice!.id, [die.id]);
    const lo = mode === "increase" ? 3 : Math.max(1, 3 - amount),
      hi = mode === "decrease" ? 3 : Math.min(6, 3 + amount);
    expect(g.choice!.options.map((o) => Number(o.id))).toEqual(
      Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
    );
    const saved = structuredClone(g);
    expect(() => answer(g, "a", g.choice!.id, ["99"])).toThrow();
    expect(g).toEqual(saved);
    answer(g, "a", g.choice!.id, [String(mode === "decrease" ? lo : hi)]);
    expect(die.value).toBe(mode === "decrease" ? lo : hi);
    expect(own(g, "a", "hand")).toHaveLength(before + 1);
  });
  it(`${slug}: a nonqualifying friendly Gig configuration does not draw`, () => {
    const g = scenario(slug, "program");
    g.gigs.filter((d) => d.controller === "a").forEach((d) => (d.value = 2));
    const before = own(g, "a", "hand").length;
    const die = g.gigs.find((d) => d.controller === "b")!;
    advance(g);
    answer(g, "a", g.choice!.id, [die.id]);
    answer(g, "a", g.choice!.id, [String(die.value)]);
    expect(own(g, "a", "hand")).toHaveLength(before);
  });
}
it("Peace Offering may decline setting and still draws for an existing friendly pair", () => {
  const g = scenario("peace-offering", "program");
  const before = own(g, "a", "hand").length;
  advance(g);
  answer(g, "a", g.choice!.id, ["no"]);
  expect(own(g, "a", "hand")).toHaveLength(before + 1);
});
it("Peace Offering copies across players, preserves die identity and requires a friendly pair for drawing", () => {
  const g = scenario("peace-offering", "program");
  g.gigs = g.gigs.filter((d) => d.controller !== "a" || d.sides === 4);
  const before = own(g, "a", "hand").length;
  const from = g.gigs.find((d) => d.controller === "b" && d.sides === 8)!,
    to = g.gigs.find((d) => d.controller === "c" && d.sides === 10)!;
  from.value = 2;
  to.value = 7;
  advance(g);
  answer(g, "a", g.choice!.id, ["yes"]);
  answer(g, "a", g.choice!.id, [from.id]);
  expect(g.choice!.options.some((o) => o.id === from.id)).toBe(false);
  answer(g, "a", g.choice!.id, [to.id]);
  expect(from).toMatchObject({ controller: "b", sides: 8, value: 7 });
  expect(own(g, "a", "hand")).toHaveLength(before);
});
it("Floor It enforces rival targeting, reduces power for the turn and draws one", () => {
  let g = scenario("floor-it", "program");
  const before = own(g, "a", "hand").length;
  advance(g);
  expect(
    g.choice!.options.every(
      (o) => g.pieces.find((p) => p.id === o.id)!.controller !== "a",
    ),
  ).toBe(true);
  const target = g.pieces.find((p) => p.id === g.choice!.options[0].id)!,
    base = power(g, target);
  answer(g, "a", g.choice!.id, [target.id]);
  expect(power(g, target)).toBe(base - 1);
  expect(own(g, "a", "hand")).toHaveLength(before + 1);
  g = applyCommand(g, "a", { type: "endTurn" });
  expect(
    power(
      g,
      g.pieces.find((p) => p.id === target.id)!,
    ),
  ).toBe(base);
});
it("only Floor It among these Programs can be paid and played in a defender reaction", () => {
  let g = scenario("floor-it", "unused");
  g.pending = [];
  g.turnPlayer = "b";
  const attacker = own(g, "b", "field")[0],
    defender = own(g, "a", "field")[0];
  g.attack = {
    attacker: attacker.id,
    target: defender.id,
    defender: "a",
    stage: "react",
  };
  for (const row of observed.filter((c) => c.id !== "floor-it")) {
    const p = own(g, "a", "hand").find((p) => p.cardId === row.id)!;
    expect(() => applyCommand(g, "a", { type: "play", piece: p.id })).toThrow(
      "Only Quick",
    );
  }
  const program = own(g, "a", "hand").find((p) => p.cardId === "floor-it")!;
  const before = power(g, attacker);
  g = applyCommand(g, "a", { type: "play", piece: program.id });
  expect(g.choice!.min).toBe(1);
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [g.choice!.options[0].id],
  });
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [attacker.id],
  });
  expect(g.attack?.stage).toBe("react");
  expect(g.pieces.find((p) => p.id === program.id)!.zone).toBe("trash");
  expect(
    power(
      g,
      g.pieces.find((p) => p.id === attacker.id)!,
    ),
  ).toBe(before - 1);
});
