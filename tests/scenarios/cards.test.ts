import { describe, it, expect } from "vitest";
import { cards, card } from "../../packages/catalog/index";
import {
  scripts,
  triggers,
  job,
  advance,
  answer,
  uid,
  own,
  gigs,
  modifier,
  defeat,
} from "../../packages/engine/kernel";
import {
  applyCommand,
  type Game,
  type Piece,
  VERSION,
} from "../../packages/engine/index";
import { scenario } from "../helpers/card-game";
describe("explicit card-handler execution smoke checks (not rules certification)", () => {
  for (const c of cards) {
    const keys = Object.keys(scripts).filter(
      (k) => k.startsWith(c.id + ":") && !k.endsWith(":replay"),
    );
    for (const key of keys)
      for (const strategy of ["decline", "first", "middle", "last"] as const) {
        it(key + " / " + strategy, () => {
          const g = scenario(c.id, key.slice(c.id.length + 1));
          advance(g);
          let n = 0;
          while (g.choice) {
            if (++n > 100)
              throw Error("Card handler did not reach a stable boundary");
            const ch = g.choice;
            const no = ch.options.find((o) => o.id === "no");
            const opts =
              strategy === "last"
                ? ch.options.slice().reverse()
                : strategy === "middle"
                  ? [...ch.options.slice(1), ch.options[0]]
                  : ch.options;
            const values = no
              ? [strategy === "decline" ? "no" : "yes"]
              : opts
                  .slice(0, strategy === "decline" ? ch.min : ch.max)
                  .map((o) => o.id);
            answer(g, ch.player, ch.id, values);
          }
          expect(g.frames).toHaveLength(0);
          expect(g.pending).toHaveLength(0);
          expect(new Set(g.pieces.map((p) => p.id)).size).toBe(g.pieces.length);
        });
      }
  }
});
describe("card outcomes", () => {
  it("Floor It reduces the selected opponent and draws exactly one", () => {
    const g = scenario("floor-it", "program"),
      before = own(g, "a", "hand").length;
    advance(g);
    const id = g.choice!.options[0].id;
    answer(g, "a", g.choice!.id, [id]);
    expect(g.mods).toContainEqual(
      expect.objectContaining({ target: id, kind: "power", amount: -1 }),
    );
    expect(own(g, "a", "hand")).toHaveLength(before + 1);
  });
  it("Minotaur cannot target a Unit belonging to a nonqualifying Rival", () => {
    const g = scenario("minotaur", "play");
    g.gigs = g.gigs.filter((d) => d.controller !== "b");
    advance(g);
    expect(g.choice!.options.map((o) => o.id)).toEqual(["b"]);
    answer(g, "a", g.choice!.id, ["b"]);
    expect(
      g.choice!.options.every(
        (o) => g.pieces.find((p) => p.id === o.id)?.controller === "b",
      ),
    ).toBe(true);
  });
  it("an unrestricted spent-Unit effect includes friendly and different opponents", () => {
    const g = scenario("wild-in-the-streets", "program");
    advance(g);
    const owners = new Set(
      g.choice!.options.map(
        (o) => g.pieces.find((p) => p.id === o.id)!.controller,
      ),
    );
    expect(owners).toEqual(new Set(["a", "b", "c"]));
  });
  it("Deadman replaces defeat and preserves its bearer", () => {
    const g = scenario("deadman-transmitter", "unused");
    g.pending = [];
    const gear = g.pieces.find(
      (p) => p.cardId === "deadman-transmitter" && p.host,
    )!;
    const bearer = g.pieces.find((p) => p.id === gear.host)!;
    defeat(g, bearer, "b");
    advance(g);
    expect(g.choice!.key).toBe("replacement");
    answer(g, "a", g.choice!.id, [gear.id]);
    expect(bearer.zone).toBe("field");
    expect(gear.zone).toBe("trash");
  });
});
