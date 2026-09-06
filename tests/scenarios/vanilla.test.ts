import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import { applyCommand, cost, mayAttack } from "../../packages/engine/index";
import { own, power, keyword } from "../../packages/engine/kernel";
import { card } from "../../packages/catalog/index";
// Independently transcribed from the four pinned official card renderings.
const observed = [
  {
    id: "animals-wrecker",
    cost: 6,
    power: 10,
    ram: 3,
    color: "Red",
    tags: ["ANIMAL", "GANGER"],
  },
  {
    id: "emergency-atlus",
    cost: 3,
    power: 4,
    ram: 1,
    color: "Green",
    tags: ["TRAUMA TEAM", "VEHICLE", "ZETATECH"],
  },
  {
    id: "psycho-squad",
    cost: 4,
    power: 6,
    ram: 1,
    color: "Blue",
    tags: ["NCPD"],
  },
  {
    id: "rockn-rockerboy",
    cost: 5,
    power: 8,
    ram: 1,
    color: "Yellow",
    tags: ["ROCKER"],
  },
];
for (const expected of observed)
  it(`${expected.id}: printed stats, ordinary payment, Lag and no flavor abilities`, () => {
    const c = card(expected.id);
    expect({ ...c, tags: c.tags.map((t) => t.toUpperCase()) }).toMatchObject({
      ...expected,
      type: "Unit",
      sell: false,
      text: "",
      keywords: [],
    });
    let g = scenario(expected.id, "unused");
    g.pending = [];
    const unit = own(g, "a", "hand").find((p) => p.cardId === expected.id)!;
    expect(cost(g, unit)).toBe(expected.cost);
    g = applyCommand(g, "a", { type: "play", piece: unit.id });
    expect(g.choice!.key).toBe("payment");
    expect(g.choice!.min).toBe(expected.cost);
    const resources = g
      .choice!.options.slice(0, expected.cost)
      .map((o) => o.id);
    g = applyCommand(g, "a", {
      type: "choose",
      choice: g.choice!.id,
      values: resources,
    });
    const played = g.pieces.find((p) => p.id === unit.id)!;
    expect(played.zone).toBe("field");
    expect(played.ready).toBe(true);
    expect(power(g, played)).toBe(expected.power);
    expect(
      resources.every((id) => !g.pieces.find((p) => p.id === id)!.ready),
    ).toBe(true);
    expect(g.pending).toEqual([]);
    expect(g.choice).toBeUndefined();
    expect(keyword(g, played, "Blocker")).toBe(false);
    expect(mayAttack(g, played, "b")).toBe(false);
    g.turn++;
    expect(mayAttack(g, played, "b")).toBe(true);
  });
