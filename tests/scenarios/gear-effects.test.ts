import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  advance,
  answer,
  emit,
  own,
  spend,
  power,
  modifier,
} from "../../packages/engine/kernel";
import { applyCommand } from "../../packages/engine/index";
import { cost } from "../../packages/engine/actions";
import { card } from "../../packages/catalog/index";

it("Mantis Blades adds its printed power only to the equipped friendly bearer and has no effect textbox", () => {
  let g = scenario("mantis-blades", "unused");
  g.pending = [];
  const existing = g.pieces.find(
    (p) => p.cardId === "mantis-blades" && p.host,
  )!;
  existing.zone = "trash";
  delete existing.host;
  const bearer = own(g, "a", "field")[0],
    rival = own(g, "b", "field")[0];
  const base = power(g, bearer),
    rivalPower = power(g, rival);
  const gear = own(g, "a", "hand").find((p) => p.cardId === "mantis-blades")!;
  g = applyCommand(g, "a", { type: "play", piece: gear.id });
  expect(g.choice!.options.some((o) => o.id === rival.id)).toBe(false);
  expect(
    g.choice!.options.some((o) => o.id === own(g, "a", "legends")[0].id),
  ).toBe(false);
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [bearer.id],
  });
  const payment = g.choice!;
  expect(payment.min).toBe(1);
  g = applyCommand(g, "a", {
    type: "choose",
    choice: payment.id,
    values: [payment.options[0].id],
  });
  expect(g.pieces.find((p) => p.id === gear.id)!.host).toBe(bearer.id);
  expect(
    power(
      g,
      g.pieces.find((p) => p.id === bearer.id)!,
    ),
  ).toBe(base + 2);
  expect(
    power(
      g,
      g.pieces.find((p) => p.id === rival.id)!,
    ),
  ).toBe(rivalPower);
  expect(card("mantis-blades").gearText!.inherited).toBe("");
});
it("Zetatech Berserk counts friendly face-up Legends in both the Legend area and field", () => {
  const g = scenario("zetatech-berserk", "unused");
  const gear = own(g, "a", "hand").find(
    (p) => p.cardId === "zetatech-berserk",
  )!;
  expect(cost(g, gear)).toBe(6);
  own(g, "b", "legends").forEach((p) => (p.faceUp = true));
  expect(cost(g, gear)).toBe(6);
  own(g, "a", "legends").forEach((p) => (p.faceUp = true));
  expect(cost(g, gear)).toBe(4);
  own(g, "a", "legends")[0].zone = "field";
  expect(cost(g, gear)).toBe(4);
  expect(card(gear.cardId).cost).toBe(6);
});
for (const zone of ["field", "legends"] as const) {
  it(`Sandevistan readies its ${zone} bearer at its controller's end step only`, () => {
    const g = scenario("sandevistan", "unused");
    g.pending = [];
    const gear = g.pieces.find((p) => p.cardId === "sandevistan" && p.host)!;
    const bearer = g.pieces.find((p) => p.id === gear.host)!;
    if (zone === "legends") bearer.cardId = "v-corporate-exile";
    bearer.zone = zone;
    gear.zone = zone;
    bearer.faceUp = true;
    bearer.ready = false;
    emit(g, { type: "end", actor: "b" });
    advance(g);
    expect(bearer.ready).toBe(false);
    emit(g, { type: "end", actor: "a" });
    advance(g);
    expect(bearer.ready).toBe(true);
  });
  it(`Netwatch Netdriver draws for spending its ${zone} bearer, not another piece`, () => {
    const g = scenario("netwatch-netdriver", "unused");
    g.pending = [];
    const gear = g.pieces.find(
      (p) => p.cardId === "netwatch-netdriver" && p.host,
    )!;
    const bearer = g.pieces.find((p) => p.id === gear.host)!;
    if (zone === "legends") bearer.cardId = "v-corporate-exile";
    bearer.zone = zone;
    gear.zone = zone;
    bearer.faceUp = true;
    const before = own(g, "a", "hand").length;
    spend(g, own(g, "b", "field")[0]);
    advance(g);
    expect(own(g, "a", "hand")).toHaveLength(before);
    spend(g, bearer);
    advance(g);
    expect(own(g, "a", "hand")).toHaveLength(before + 1);
  });
}
for (const won of [true, false])
  it(`Satori draws only when its bearer wins a fight: won=${won}`, () => {
    const g = scenario("satori-sword-of-saburo", "unused");
    g.pending = [];
    const bearer = own(g, "a", "field")[0];
    const before = own(g, "a", "hand").length;
    emit(g, {
      type: "fight",
      actor: "a",
      piece: { ...own(g, "a", "field")[1] },
      opponent: own(g, "b", "field")[0].id,
      won: true,
    });
    advance(g);
    expect(own(g, "a", "hand")).toHaveLength(before);
    emit(g, {
      type: "fight",
      actor: "a",
      piece: { ...bearer },
      opponent: own(g, "c", "field")[0].id,
      won,
    });
    advance(g);
    expect(own(g, "a", "hand")).toHaveLength(before + Number(won));
  });
for (const trash of [true, false])
  it(`Tetratronic Rippler's top-card decision is private; trash=${trash}`, () => {
    const g = scenario("tetratronic-rippler", "unused");
    g.pending = [];
    const top = own(g, "a", "deck")[0],
      next = own(g, "a", "deck")[1];
    const before = own(g, "a", "hand").length;
    spend(g, own(g, "a", "field")[0]);
    advance(g);
    expect(g.choice!.private).toBe(true);
    expect(g.choice!.options.map((o) => o.id)).toEqual([top.id]);
    answer(g, "a", g.choice!.id, trash ? [top.id] : []);
    expect(top.zone).toBe(trash ? "trash" : "deck");
    expect(own(g, "a", "deck")[0].id).toBe(trash ? next.id : top.id);
    expect(own(g, "a", "hand")).toHaveLength(before);
    expect(
      g.log.some(
        (e) => !e.privateTo && e.text.includes(card(top.cardId).nameFull),
      ),
    ).toBe(trash);
  });
it("Tetratronic Rippler with an empty deck produces no choice and does not deck out", () => {
  const g = scenario("tetratronic-rippler", "unused");
  g.pending = [];
  g.pieces = g.pieces.filter(
    (p) => !(p.controller === "a" && p.zone === "deck"),
  );
  spend(g, own(g, "a", "field")[0]);
  advance(g);
  expect(g.choice).toBeUndefined();
  expect(g.players[0].eliminated).toBe(false);
});

for (const tie of [false, true])
  it(`Satori resolves an actual defensive fight, including mutual defeat: tie=${tie}`, () => {
    let g = scenario("satori-sword-of-saburo", "unused");
    g.pending = [];
    g.turnPlayer = "b";
    const defender = own(g, "a", "field")[0],
      attacker = own(g, "b", "field")[0];
    defender.ready = false;
    if (tie) modifier(g, "b", attacker.id, "power", 2, "turn");
    const before = own(g, "a", "hand").length;
    g = applyCommand(g, "b", {
      type: "attack",
      piece: attacker.id,
      target: defender.id,
    });
    expect(g.attack?.stage).toBe("react");
    g = applyCommand(g, "a", { type: "endReaction" });
    expect(g.attack).toBeUndefined();
    expect(own(g, "a", "hand")).toHaveLength(before + Number(!tie));
    expect(g.pieces.find((p) => p.id === defender.id)!.zone).toBe(
      tie ? "trash" : "field",
    );
  });

it("Netwatch's payment trigger waits until the paid Program resolves", () => {
  let g = scenario("netwatch-netdriver", "unused");
  g.pending = [];
  const gear = g.pieces.find(
    (p) => p.cardId === "netwatch-netdriver" && p.host,
  )!;
  const bearer = g.pieces.find((p) => p.id === gear.host)!;
  bearer.cardId = "v-corporate-exile";
  bearer.zone = "legends";
  bearer.faceUp = true;
  gear.zone = "legends";
  const program = own(g, "a", "hand").find((p) => p.cardId === "floor-it")!;
  const before = own(g, "a", "hand").length;
  g = applyCommand(g, "a", { type: "play", piece: program.id });
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [bearer.id],
  });
  expect(g.choice!.label).toContain("rival Unit");
  expect(own(g, "a", "hand")).toHaveLength(before - 1);
  g = applyCommand(g, "a", {
    type: "choose",
    choice: g.choice!.id,
    values: [g.choice!.options[0].id],
  });
  expect(own(g, "a", "hand")).toHaveLength(before + 1); // Floor It and Netwatch each draw one.
});
it("Netwatch's attack spending trigger draws before the defender's reaction window", () => {
  let g = scenario("netwatch-netdriver", "unused");
  g.pending = [];
  const before = own(g, "a", "hand").length;
  g = applyCommand(g, "a", {
    type: "attack",
    piece: own(g, "a", "field")[0].id,
    target: own(g, "b", "field")[1].id,
  });
  expect(g.attack?.stage).toBe("react");
  expect(own(g, "a", "hand")).toHaveLength(before + 1);
});
it("Berserk's intrinsic and Viktor discounts combine but cannot reduce payment below one", () => {
  const g = scenario("zetatech-berserk", "unused");
  g.pending = [];
  own(g, "a", "legends").forEach((p) => (p.faceUp = true));
  own(g, "a", "field")
    .slice(0, 2)
    .forEach((p) => (p.cardId = "viktor-vektor-drop-your-illusions"));
  const gear = own(g, "a", "hand").find(
    (p) => p.cardId === "zetatech-berserk",
  )!;
  expect(cost(g, gear)).toBe(1);
  expect(card(gear.cardId).cost).toBe(6);
});
