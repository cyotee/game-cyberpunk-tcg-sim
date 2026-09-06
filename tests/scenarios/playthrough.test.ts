import { it, expect } from "vitest";
import {
  newGame,
  applyCommand,
  cost,
  resources,
  mayAttack,
  type Game,
  type Command,
} from "../../packages/engine/index";
import { card } from "../../packages/catalog/index";
import { copyStarter } from "../../packages/decks/starters";
import { own, field } from "../../packages/engine/kernel";
function randomInput(seed: number) {
  let value = seed;
  return Array.from({ length: 8000 }, () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  });
}
function choose(g: Game): Command {
  const c = g.choice!;
  let n = c.allowedCounts?.at(-1) ?? c.max;
  if (c.min === 0 && g.serial % 3 === 0) n = 0;
  if (c.allowedCounts && !c.allowedCounts.includes(n)) n = c.allowedCounts[0];
  return {
    type: "choose",
    choice: c.id,
    values: c.options.slice(0, n).map((o) => o.id),
  };
}
for (const count of [2, 3, 4, 5])
  for (const seed of [1, 19])
    it(`${count} players, seed ${seed}: complete a starter match using legal plays, attacks and choices`, () => {
      let g = newGame(
        `playthrough-${count}-${seed}`,
        Array.from({ length: count }, (_, i) => ({
          id: String(i),
          name: `Seat ${i}`,
          deck: copyStarter(i % 2),
        })),
        count * 3 + 1,
        randomInput(seed),
      );
      let steps = 0,
        plays = 0,
        attacks = 0;
      while (g.phase !== "finished" && steps++ < 2500) {
        let actor =
          g.choice?.player ??
          (g.attack?.stage === "react" ? g.attack.defender : g.turnPlayer);
        if (g.choice) {
          g = applyCommand(g, actor, choose(g));
          continue;
        }
        if (g.attack?.stage === "react") {
          g = applyCommand(g, actor, { type: "endReaction" });
          continue;
        }
        const candidates: Command[] = [];
        if (!g.players.find((p) => p.id === actor)!.sold) {
          const p = own(g, actor, "hand").find((p) => card(p.cardId).sell);
          if (p) candidates.push({ type: "sell", piece: p.id });
        }
        if (!g.players.find((p) => p.id === actor)!.called) {
          const p = own(g, actor, "legends").find((p) => !p.faceUp);
          if (p) candidates.push({ type: "call", piece: p.id });
        }
        for (const p of own(g, actor, "hand").filter(
          (p) => cost(g, p) <= resources(g, actor).length,
        ))
          candidates.push({ type: "play", piece: p.id });
        for (const p of field(g).filter((p) => p.controller === actor))
          for (const target of [
            ...g.players.filter((p) => p.id !== actor).map((p) => p.id),
            ...field(g)
              .filter((p) => p.controller !== actor)
              .map((p) => p.id),
          ])
            if (mayAttack(g, p, target))
              candidates.push({ type: "attack", piece: p.id, target });
        candidates.push({ type: "endTurn" });
        let accepted = false;
        const failures: string[] = [];
        for (const command of candidates) {
          const before = JSON.stringify(g);
          try {
            const next = applyCommand(g, actor, command);
            plays += Number(command.type === "play");
            attacks += Number(command.type === "attack");
            g = next;
            accepted = true;
            break;
          } catch (error) {
            failures.push(
              command.type +
                ": " +
                (error instanceof Error ? error.message : String(error)),
            );
            expect(JSON.stringify(g)).toBe(before);
          }
        }
        expect(
          accepted,
          `No action accepted at turn ${g.turn}: ${failures.join("; ")}`,
        ).toBe(true);
        expect(new Set(g.pieces.map((p) => p.id)).size).toBe(g.pieces.length);
        expect(g.gigs.every((d) => d.value >= 1 && d.value <= d.sides)).toBe(
          true,
        );
      }
      expect(g.phase, `Unfinished after ${steps} steps`).toBe("finished");
      expect(plays).toBeGreaterThan(0);
      expect(attacks).toBeGreaterThan(0);
    });
