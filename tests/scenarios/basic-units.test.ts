import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  own,
  field,
  power,
  modifier,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { mayAttack } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";
const printed = [
  {
    id: "delamain-rideshare-ai",
    cost: 3,
    power: 0,
    ram: 3,
    color: "Blue",
    tags: ["AI"],
    keywords: [],
  },
  {
    id: "japantown-jonin",
    cost: 2,
    power: 0,
    ram: 2,
    color: "Red",
    tags: ["Tyger Claws"],
    keywords: [],
  },
  {
    id: "field-operator",
    cost: 3,
    power: 2,
    ram: 2,
    color: "Green",
    tags: ["Arasaka", "Corpo", "Techie"],
    keywords: [],
  },
  {
    id: "offduty-malfini",
    cost: 4,
    power: 5,
    ram: 2,
    color: "Yellow",
    tags: ["Ganger", "Voodoo Boys"],
    keywords: [],
  },
  {
    id: "riding-nomad",
    cost: 5,
    power: 4,
    ram: 4,
    color: "Green",
    tags: ["Nomad"],
    keywords: ["Adrenaline"],
  },
  {
    id: "ruthless-lowlife",
    cost: 2,
    power: 4,
    ram: 1,
    color: "Red",
    tags: ["Ganger", "Maelstrom"],
    keywords: [],
  },
];
for (const row of printed)
  it(`${row.id}: printed Unit baseline`, () => {
    expect(card(row.id)).toMatchObject({ ...row, type: "Unit", sell: false });
  });
it("Delamain Rideshare's draw two is mandatory and draws the actual top cards", () => {
  const g = scenario("delamain-rideshare-ai", "play");
  const top = own(g, "a", "deck").slice(0, 2),
    before = own(g, "a", "hand").length;
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(own(g, "a", "hand")).toHaveLength(before + 2);
  expect(top.every((p) => p.zone === "hand")).toBe(true);
});
it("Delamain Rideshare's mandatory draw decks out its controller when only one card remains", () => {
  const g = scenario("delamain-rideshare-ai", "play");
  const top = own(g, "a", "deck")[0];
  g.pieces = g.pieces.filter(
    (p) => p.controller !== "a" || p.zone !== "deck" || p.id === top.id,
  );
  advance(g);
  expect(g.players[0].eliminated).toBe(true);
  expect(g.players.filter((p) => !p.eliminated)).toHaveLength(2);
});
for (const value of [0, 1, 2, 3, 4])
  it(`Field Operator draws only for a positive even Street Cred: ${value}`, () => {
    const g = scenario("field-operator", "play");
    g.gigs = g.gigs.filter((d) => d.controller !== "a");
    if (value)
      g.gigs.push({ id: "cred", controller: "a", owner: "a", sides: 6, value });
    const before = own(g, "a", "hand").length;
    advance(g);
    expect(own(g, "a", "hand")).toHaveLength(
      before + Number(value > 0 && value % 2 === 0),
    );
  });
it("Japantown Jonin can buff itself, cannot target a rival, and loses the bonus after the turn", () => {
  let g = scenario("japantown-jonin", "play");
  const self = g.pieces.find((p) => p.id === g.pending[0].source)!;
  advance(g);
  expect(g.choice!.options.some((o) => o.id === self.id)).toBe(true);
  expect(
    g.choice!.options.some((o) => o.id === own(g, "b", "field")[0].id),
  ).toBe(false);
  answer(g, "a", g.choice!.id, [self.id]);
  expect(power(g, self)).toBe(2);
  g = applyCommand(g, "a", { type: "endTurn" });
  expect(
    power(
      g,
      g.pieces.find((p) => p.id === self.id)!,
    ),
  ).toBe(0);
});
for (const slug of ["delamain-rideshare-ai", "japantown-jonin"])
  it(`${slug}: zero power cannot steal a Gig during a completed attack`, () => {
    let g = scenario(slug, "unused");
    g.pending = [];
    const p = own(g, "a", "field").find((p) => p.cardId === slug)!;
    const before = g.gigs.filter((d) => d.controller === "a").length;
    g = applyCommand(g, "a", { type: "attack", piece: p.id, target: "b" });
    g = applyCommand(g, "b", { type: "endReaction" });
    expect(g.choice).toBeUndefined();
    expect(g.attack).toBeUndefined();
    expect(g.gigs.filter((d) => d.controller === "a")).toHaveLength(before);
  });
it("Offduty Malfini spends itself even without any rival Units", () => {
  const g = scenario("offduty-malfini", "play");
  const self = g.pieces.find((p) => p.id === g.pending[0].source)!;
  field(g)
    .filter((p) => p.controller !== "a")
    .forEach((p) => (p.zone = "trash"));
  advance(g);
  expect(self.ready).toBe(false);
  expect(g.choice).toBeUndefined();
});
it("Offduty Malfini must spend one rival Unit and may select the third player", () => {
  const g = scenario("offduty-malfini", "play");
  const target = own(g, "c", "field")[0];
  advance(g);
  expect(g.choice!.min).toBe(1);
  expect(
    g.choice!.options.every(
      (o) => g.pieces.find((p) => p.id === o.id)!.controller !== "a",
    ),
  ).toBe(true);
  answer(g, "a", g.choice!.id, [target.id]);
  expect(target.ready).toBe(false);
});
it("Riding Nomad's Adrenaline permits attacking on entry but does not ignore spending or ready-target restrictions", () => {
  const g = scenario("riding-nomad", "unused");
  g.pending = [];
  const p = own(g, "a", "field").find((p) => p.cardId === "riding-nomad")!;
  p.entered = g.turn;
  expect(mayAttack(g, p, "b")).toBe(true);
  expect(mayAttack(g, p, own(g, "b", "field")[0].id)).toBe(false);
  expect(mayAttack(g, p, own(g, "c", "field")[1].id)).toBe(true);
  p.ready = false;
  expect(mayAttack(g, p, "b")).toBe(false);
});
it("Ruthless Lowlife cannot be forced to attack a Gig area when no legal Unit exists", () => {
  let g = scenario("ruthless-lowlife", "unused");
  g.pending = [];
  const p = own(g, "a", "field").find((p) => p.cardId === "ruthless-lowlife")!;
  expect(mayAttack(g, p, "b")).toBe(false);
  expect(mayAttack(g, p, own(g, "c", "field")[1].id)).toBe(true);
  field(g)
    .filter((p) => p.controller !== "a")
    .forEach((p) => (p.ready = true));
  modifier(g, "b", p.id, "forced", 0, "targetEnd");
  expect(() => (g = applyCommand(g, "a", { type: "endTurn" }))).not.toThrow();
});
