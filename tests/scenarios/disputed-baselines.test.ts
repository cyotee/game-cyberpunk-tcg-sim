import { it, expect } from "vitest";
import { card } from "../../packages/catalog/index";
// Stats-only evidence. This deliberately does not certify the disputed effects.
for (const [id, type, cost, power, ram, color, tags, keywords] of [
  ["bonnie-and-clyde", "Program", 3, null, 3, "Red", ["Braindance"], []],
  ["towerfall", "Program", 6, null, 4, "Blue", ["Braindance"], []],
  ["pyramid-song", "Program", 3, null, 3, "Blue", ["Braindance"], []],
  [
    "safety-override",
    "Program",
    2,
    null,
    3,
    "Yellow",
    ["Quickhack"],
    ["Quick"],
  ],
  ["v-streetkid", "Legend", 5, 6, 2, "Red", ["Merc"], ["Go Solo"]],
  [
    "johnny-silverhand-rocking-renegade",
    "Legend",
    null,
    0,
    2,
    "Red",
    ["Merc", "Rocker", "Samurai"],
    [],
  ],
  [
    "river-ward-detective-on-the-hunt",
    "Legend",
    null,
    0,
    2,
    "Yellow",
    ["NCPD"],
    ["Quick"],
  ],
  ["mt0d12-flathead", "Unit", 5, 7, 3, "Blue", ["Drone", "Militech"], []],
] as const)
  it(`${id}: printed stats only; rules decision remains open`, () =>
    expect(card(id)).toMatchObject({
      type,
      cost,
      power,
      ram,
      color,
      tags,
      keywords,
      sell: true,
    }));
