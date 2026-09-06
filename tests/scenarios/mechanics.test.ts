import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  uid,
  power,
  own,
  ready,
  spend,
  moveMany,
  defeat,
  keyword,
} from "../../packages/engine/kernel";
import { applyCommand, cost, type Piece } from "../../packages/engine/index";
import { card } from "../../packages/catalog/index";
function duplicate(g: ReturnType<typeof scenario>, p: Piece) {
  const copy = { ...structuredClone(p), id: uid(g) };
  g.pieces.push(copy);
  return copy;
}
it("multiple Saul effects stack only while the affected Unit is attacking", () => {
  const g = scenario("saul-bright-stormrider", "unused");
  g.pending = [];
  const saul = g.pieces.find(
    (p) => p.cardId === "saul-bright-stormrider" && p.zone === "field",
  )!;
  duplicate(g, saul);
  const unit = g.pieces.find(
    (p) =>
      p.controller === "a" &&
      p.zone === "field" &&
      p.cardId === "animals-wrecker",
  )!;
  const base = power(g, unit);
  g.attack = { attacker: unit.id, defender: "b", target: "b", stage: "react" };
  expect(power(g, unit)).toBe(base + 4);
  delete g.attack;
  expect(power(g, unit)).toBe(base);
});
it("multiple Viktor discounts stack and apply only to the first Cyberware Gear", () => {
  const g = scenario("viktor-vektor-drop-your-illusions", "unused");
  g.pending = [];
  const v = g.pieces.find(
    (p) =>
      p.zone === "field" && p.cardId === "viktor-vektor-drop-your-illusions",
  )!;
  const gear = own(g, "a", "hand").find(
    (p) => p.cardId === "zetatech-berserk",
  )!;
  expect(cost(g, gear)).toBe(3);
  duplicate(g, v);
  expect(cost(g, gear)).toBe(1);
  g.players[0].played.CYBERWARE = 1;
  expect(cost(g, gear)).toBe(6);
});
it("Synapse Burnout recalculates face-up Legends while its Unit fights", () => {
  const g = scenario("synapse-burnout", "program");
  advance(g);
  const target = g.choice!.options[0].id;
  answer(g, "a", g.choice!.id, [target]);
  const unit = g.pieces.find((p) => p.id === target)!;
  const base = power(g, unit);
  const opponent = g.pieces.find(
    (p) => p.controller === "b" && p.zone === "field",
  )!;
  g.attack = {
    attacker: unit.id,
    defender: "b",
    target: opponent.id,
    stage: "fight",
  };
  const legends = own(g, "a", "legends");
  legends[0].faceUp = true;
  expect(power(g, unit)).toBe(base + 1);
  legends[1].faceUp = true;
  expect(power(g, unit)).toBe(base + 2);
  g.attack.attacker = opponent.id;
  g.attack.target = "elsewhere";
  expect(power(g, unit)).toBe(base);
});
it("Viktor only equips the free Gear to another friendly Unit", () => {
  const g = scenario("viktor-vektor-you-might-feel-a-little-pinch", "play");
  const source = g.pending[0].source;
  own(g, "a", "legends").forEach((p) => (p.faceUp = true));
  advance(g);
  answer(g, "a", g.choice!.id, [g.choice!.options[0].id]);
  expect(g.choice!.key).toBe("equip");
  expect(
    g.choice!.options.every((o) => {
      const p = g.pieces.find((p) => p.id === o.id)!;
      return p.zone === "field" && p.id !== source && p.controller === "a";
    }),
  ).toBe(true);
});
it("Viktor does not offer an impossible free equip when no other friendly Unit exists", () => {
  const g = scenario("viktor-vektor-you-might-feel-a-little-pinch", "play");
  const source = g.pending[0].source;
  g.pieces = g.pieces.filter(
    (p) => !(p.controller === "a" && p.zone === "field" && p.id !== source),
  );
  own(g, "a", "legends").forEach((p) => (p.faceUp = true));
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(g.frames).toEqual([]);
});
it("Maman requires either zero or exactly two discarded Programs", () => {
  const g = scenario("maman-brigitte-spirit-of-death", "play");
  advance(g);
  expect(g.choice!.allowedCounts).toEqual([0, 2]);
  const before = structuredClone(g);
  expect(() =>
    answer(g, "a", g.choice!.id, [g.choice!.options[0].id]),
  ).toThrow();
  expect(g).toEqual(before);
  answer(g, "a", g.choice!.id, []);
  expect(g.choice).toBeUndefined();
});
it("Gear cannot bypass its bearer by being activated directly", () => {
  const g = scenario("overwatch-panam-s-gift", "unused");
  g.pending = [];
  const gear = g.pieces.find(
    (p) => p.host && p.cardId === "overwatch-panam-s-gift",
  )!;
  const before = structuredClone(g);
  expect(() =>
    applyCommand(g, "a", { type: "activate", piece: gear.id }),
  ).toThrow("Cannot activate");
  expect(g).toEqual(before);
});
it("playing Gear without a valid bearer is rejected before committing a payment choice", () => {
  const g = scenario("animals-wrecker", "unused");
  g.pending = [];
  g.pieces = g.pieces.filter(
    (p) => !(p.controller === "a" && p.zone === "field"),
  );
  const gear = own(g, "a", "hand").find((p) => card(p.cardId).type === "Gear")!;
  const before = structuredClone(g);
  expect(() => applyCommand(g, "a", { type: "play", piece: gear.id })).toThrow(
    "needs a friendly",
  );
  expect(g).toEqual(before);
});
it("resource state changes appear in the log without revealing hidden identities", () => {
  const g = scenario("animals-wrecker", "unused");
  g.pending = [];
  const resource = own(g, "a", "eddies")[0];
  spend(g, resource);
  ready(g, resource);
  expect(g.log.map((e) => e.text).join(" ")).toContain("an Eddie");
  expect(g.log.map((e) => e.text).join(" ")).not.toContain(
    card(resource.cardId).nameFull,
  );
});

it("MaxTac Heavy binds its discount to the chosen affordable Rival", () => {
  let g = scenario("maxtac-heavy", "unused");
  g.pending = [];
  const heavy = g.pieces.find(
    (p) => p.cardId === "maxtac-heavy" && p.zone === "field",
  )!;
  heavy.zone = "hand";
  const enemy = g.pieces.find(
    (p) => p.controller === "b" && p.zone === "field",
  )!;
  duplicate(g, enemy);
  const bCost = cost(g, heavy, false, "b"),
    cCost = cost(g, heavy, false, "c");
  expect(bCost).toBe(cCost - 1);
  g = applyCommand(g, "a", { type: "play", piece: heavy.id });
  expect(g.choice!.key).toBe("costRival");
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: ["c"],
  });
  expect(g.choice!.min).toBe(cCost);
  expect(g.choice!.key).toBe("payment");
});

it("simultaneous bottom-deck movement shuffles one group per owner including attached Gear", () => {
  const g = scenario("animals-wrecker", "unused");
  g.pending = [];
  const units = g.pieces
    .filter((p) => p.controller === "a" && p.zone === "field")
    .slice(0, 2);
  const gear = own(g, "a", "hand").find((p) => p.cardId === "mantis-blades")!;
  gear.zone = "field";
  gear.host = units[0].id;
  const cursor = g.randomCursor;
  moveMany(g, units, "deck");
  expect(g.randomCursor - cursor).toBe(2);
  expect(
    new Set(
      own(g, "a", "deck")
        .slice(-3)
        .map((p) => p.id),
    ),
  ).toEqual(new Set([...units, gear].map((p) => p.id)));
  expect(gear.host).toBeUndefined();
});
it("moving hidden cards between private zones does not disclose their identity publicly", () => {
  const g = scenario("animals-wrecker", "unused");
  g.pending = [];
  const hidden = own(g, "a", "hand").slice(0, 2);
  moveMany(g, hidden, "deck");
  expect(g.log.filter((e) => !e.privateTo)).toEqual([]);
  expect(g.log.every((e) => e.privateTo === "a")).toBe(true);
});
it("mandatory public-trash retrieval cannot be declined when a matching card exists", () => {
  for (const [slug, type] of [
    ["all-is-lost", "Unit"],
    ["hacked-corpo", "Program"],
    ["the-heist", "Gear"],
  ]) {
    const g = scenario(slug, slug === "hacked-corpo" ? "play" : "program");
    const top = own(g, "a", "deck")[0];
    top.cardId =
      type === "Unit"
        ? "animals-wrecker"
        : type === "Program"
          ? "floor-it"
          : "mantis-blades";
    advance(g);
    expect(g.choice!.min, slug).toBe(1);
    expect(
      g.choice!.options.some((o) => o.id === top.id),
      slug,
    ).toBe(true);
  }
});
it("mandatory free play from public trash cannot be declined for Relic or Viktor", () => {
  for (const [slug, event] of [
    ["the-relic-experimental-biochip", "defeated"],
    ["viktor-vektor-you-might-feel-a-little-pinch", "play"],
  ]) {
    const g = scenario(slug, event);
    advance(g);
    expect(g.choice!.min, slug).toBe(1);
  }
});
it("Jackie cannot replace a defeated Gear or a Legend outside the field", () => {
  const g = scenario("jackie-welles-mama-s-favorite", "unused");
  g.pending = [];
  const gear = own(g, "a", "hand").find((p) => p.cardId === "mantis-blades")!;
  gear.zone = "field";
  gear.host = g.pieces.find(
    (p) => p.controller === "a" && p.zone === "field",
  )!.id;
  defeat(g, gear, "b");
  expect(g.frames).toEqual([]);
  expect(gear.zone).toBe("trash");
  const legend = own(g, "a", "legends").find(
    (p) => p.cardId !== "jackie-welles-mama-s-favorite",
  )!;
  legend.faceUp = true;
  defeat(g, legend, "b");
  expect(g.frames).toEqual([]);
  expect(legend.zone).toBe("removed");
});

it("mentioning a keyword does not grant it to the source card", () => {
  for (const [slug, key] of [
    ["valentino-street-racer", "Adrenaline"],
    ["valentino-guerrera", "Blocker"],
    ["goro-takemura-vengeful-bodyguard", "Blocker"],
  ]) {
    const g = scenario(slug, "unused");
    const p = g.pieces.find(
      (p) => p.cardId === slug && ["field", "legends"].includes(p.zone),
    )!;
    expect(keyword(g, p, key), slug).toBe(false);
  }
  const g = scenario("mandibular-upgrade", "unused");
  const gear = g.pieces.find(
    (p) => p.cardId === "mandibular-upgrade" && p.host,
  )!;
  expect(
    keyword(
      g,
      g.pieces.find((p) => p.id === gear.host)!,
      "Blocker",
    ),
  ).toBe(true);
});

it("a normal main-phase sale reveals the card in the public action log", () => {
  let g = scenario("animals-wrecker", "unused");
  g.pending = [];
  const sold = own(g, "a", "hand").find((p) => p.cardId === "floor-it")!;
  g = applyCommand(g, "a", { type: "sell", piece: sold.id });
  expect(
    g.log.some(
      (e) => !e.privateTo && e.text.includes("reveals Floor It and sells it"),
    ),
  ).toBe(true);
  expect(g.pieces.find((p) => p.id === sold.id)).toMatchObject({
    zone: "eddies",
    faceUp: false,
    ready: true,
  });
});
it("mandatory Deadman replacement precedes optional Jackie protection", () => {
  const g = scenario("jackie-welles-mama-s-favorite", "unused");
  g.pending = [];
  const unit = own(g, "a", "field").find(
    (p) => p.cardId === "animals-wrecker",
  )!;
  const gear = own(g, "a", "hand").find(
    (p) => p.cardId === "deadman-transmitter",
  )!;
  gear.zone = "field";
  gear.host = unit.id;
  defeat(g, unit, "b");
  advance(g);
  expect(g.choice!.options.map((o) => o.id)).toEqual([gear.id]);
  answer(g, "a", g.choice!.id, [gear.id]);
  expect(gear.zone).toBe("trash");
  expect(unit.zone).toBe("field");
});
it("a replacement rechecks the new defeat and never reapplies the same replacement", () => {
  const g = scenario("jackie-welles-mama-s-favorite", "unused");
  g.pending = [];
  const jackie = g.pieces.find(
    (p) => p.cardId === "jackie-welles-mama-s-favorite" && p.zone === "legends",
  )!;
  jackie.zone = "field";
  const unit = own(g, "a", "field").find(
    (p) => p.cardId === "animals-wrecker",
  )!;
  const gear = own(g, "a", "hand").find(
    (p) => p.cardId === "deadman-transmitter",
  )!;
  gear.zone = "field";
  gear.host = jackie.id;
  defeat(g, unit, "b");
  advance(g);
  answer(g, "a", g.choice!.id, [jackie.id]);
  expect(g.choice!.key).toBe("payment");
  answer(g, "a", g.choice!.id, [g.choice!.options[0].id]);
  expect(g.choice!.options.map((o) => o.id)).toEqual([gear.id]);
  answer(g, "a", g.choice!.id, [gear.id]);
  expect(gear.zone).toBe("trash");
  expect(jackie.zone).toBe("field");
  expect(unit.zone).toBe("field");
  expect(g.choice).toBeUndefined();
});

it("decking out during a main-phase effect advances after resolution completes", () => {
  const g = scenario("floor-it", "program");
  g.pieces = g.pieces.filter(
    (p) => !(p.controller === "a" && p.zone === "deck"),
  );
  advance(g);
  answer(g, "a", g.choice!.id, [g.choice!.options[0].id]);
  expect(g.players[0].eliminated).toBe(true);
  expect(g.turnPlayer).toBe("b");
  expect(g.choice?.player).toBe("b");
  expect(g.gigs.filter((d) => d.controller === "a")).toHaveLength(6);
});
