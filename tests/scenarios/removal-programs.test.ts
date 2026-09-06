import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  field,
  modifier,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { card } from "../../packages/catalog/index";
const printed = [
  {
    id: "corporate-surveillance",
    cost: 2,
    ram: 1,
    color: "Green",
    tags: ["Corpo"],
    keywords: [],
  },
  {
    id: "wild-in-the-streets",
    cost: 5,
    ram: 4,
    color: "Green",
    tags: ["Ganger"],
    keywords: [],
  },
  {
    id: "detonate",
    cost: 1,
    ram: 2,
    color: "Red",
    tags: ["Quickhack"],
    keywords: ["Quick"],
  },
  {
    id: "over-the-edge",
    cost: 3,
    ram: 2,
    color: "Red",
    tags: ["Merc"],
    keywords: [],
  },
];
for (const row of printed) {
  it(`${row.id}: printed Program baseline`, () => {
    expect(card(row.id)).toMatchObject({
      ...row,
      power: null,
      sell: true,
      type: "Program",
    });
  });
  it(`${row.id}: can be paid and played without an eligible target`, () => {
    let g = scenario(row.id, "unused");
    g.pending = [];
    field(g).forEach((p) => (p.zone = "trash"));
    const p = own(g, "a", "hand").find((p) => p.cardId === row.id)!;
    g = applyCommand(g, "a", { type: "play", piece: p.id });
    const c = g.choice!;
    g = applyCommand(g, "a", {
      type: "choose",
      choice: c.id,
      values: c.options.slice(0, c.min).map((o) => o.id),
    });
    expect(g.choice).toBeUndefined();
    expect(g.pieces.find((x) => x.id === p.id)!.zone).toBe("trash");
  });
}
it("Corporate Surveillance permits either rival, rejects friendly and cost-five-plus Units, and spends the target", () => {
  const g = scenario("corporate-surveillance", "program");
  const target = own(g, "c", "field")[0];
  target.cardId = "hacked-corpo"; // printed cost exactly four
  target.ready = true;
  advance(g);
  const ids = g.choice!.options.map((o) => o.id);
  expect(ids).toContain(target.id);
  expect(ids).not.toContain(own(g, "a", "field")[1].id);
  expect(ids).not.toContain(own(g, "b", "field")[0].id); // Animals costs six
  expect(g.choice!.min).toBe(1);
  answer(g, "a", g.choice!.id, [target.id]);
  expect(target.ready).toBe(false);
  expect(target.zone).toBe("field");
});
it("Corporate Surveillance may choose an already-spent Unit without a new spending event", () => {
  const g = scenario("corporate-surveillance", "program");
  const target = own(g, "b", "field")[1];
  advance(g);
  answer(g, "a", g.choice!.id, [target.id]);
  expect(target.ready).toBe(false);
  expect(g.log.some((e) => e.text.includes(" spends "))).toBe(false);
});
it("Wild in the Streets must defeat a spent friendly Unit if it is the only eligible Unit", () => {
  const g = scenario("wild-in-the-streets", "program");
  field(g).forEach((p) => (p.ready = true));
  const target = own(g, "a", "field")[0];
  target.ready = false;
  advance(g);
  expect(g.choice!.options.map((o) => o.id)).toEqual([target.id]);
  expect(() => answer(g, "a", g.choice!.id, [])).toThrow();
  answer(g, "a", g.choice!.id, [target.id]);
  expect(target.zone).toBe("trash");
});
it("Wild in the Streets can defeat a third player's spent Unit but cannot select a ready one", () => {
  const g = scenario("wild-in-the-streets", "program");
  advance(g);
  const target = own(g, "c", "field")[1];
  expect(g.choice!.options.map((o) => o.id)).not.toContain(
    own(g, "c", "field")[0].id,
  );
  answer(g, "a", g.choice!.id, [target.id]);
  expect(target.zone).toBe("trash");
});
it("Detonate targets low-power rival Gear on a Legend and leaves the bearer in play", () => {
  const g = scenario("detonate", "program");
  const bearer = own(g, "c", "legends")[0];
  bearer.faceUp = true;
  const gear = own(g, "c", "hand").find(
    (p) => p.cardId === "arasaka-emergency-radioport",
  )!;
  gear.zone = "field";
  gear.faceUp = true;
  gear.host = bearer.id;
  const strong = own(g, "b", "hand").find(
    (p) => p.cardId === "adrenaline-converter",
  )!;
  strong.zone = "field";
  strong.faceUp = true;
  strong.host = own(g, "b", "field")[0].id;
  const friendly = own(g, "a", "hand").find(
    (p) => p.cardId === "arasaka-emergency-radioport",
  )!;
  friendly.zone = "field";
  friendly.faceUp = true;
  friendly.host = own(g, "a", "field")[0].id;
  advance(g);
  expect(g.choice!.options.map((o) => o.id)).toEqual([gear.id]);
  answer(g, "a", g.choice!.id, [gear.id]);
  expect(gear.zone).toBe("trash");
  expect(gear.host).toBeUndefined();
  expect(bearer.zone).toBe("legends");
  expect(strong.zone).toBe("field");
  expect(friendly.zone).toBe("field");
});
it("Over the Edge requires a friendly rolled d20 even against zero power", () => {
  const g = scenario("over-the-edge", "program");
  g.gigs = g.gigs.filter((d) => d.controller !== "a" || d.sides !== 20);
  own(g, "b", "field")[0].cardId = "hacked-corpo";
  modifier(g, "a", own(g, "b", "field")[0].id, "power", -3, "turn");
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(own(g, "b", "field")).toHaveLength(3);
});
it("Over the Edge uses current power and the controlled d20, including stolen dice and friendly Units", () => {
  const g = scenario("over-the-edge", "program");
  g.gigs = g.gigs.filter((d) => d.controller !== "a");
  const die = g.gigs.find((d) => d.controller === "b" && d.sides === 20)!;
  die.controller = "a";
  die.value = 3;
  const friendly = own(g, "a", "field")[0];
  modifier(g, "a", friendly.id, "power", -7, "turn"); // 10 to 3
  const third = own(g, "c", "field")[0];
  advance(g);
  expect(g.choice!.options.map((o) => o.id)).toContain(friendly.id);
  expect(g.choice!.options.map((o) => o.id)).not.toContain(third.id);
  answer(g, "a", g.choice!.id, [friendly.id]);
  expect(friendly.zone).toBe("trash");
});
