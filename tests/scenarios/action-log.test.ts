import { it, expect } from "vitest";
import { scenario } from "../helpers/card-game";
import {
  draw,
  own,
  spend,
  advance,
  answer,
} from "../../packages/engine/kernel";
import { projectLog } from "../../packages/engine/log";
import { gameView } from "../../apps/service/rooms";
import { seal, unseal } from "../../packages/saves/server";
import { applyCommand } from "../../packages/engine/index";
it("structured private draw data is retained only for the entitled seat, including after save restoration", () => {
  const g = scenario("animals-wrecker", "unused");
  g.pending = [];
  const top = own(g, "a", "deck")[0];
  draw(g, "a");
  const restored = unseal(seal(g)) as typeof g;
  const a = projectLog(restored.log, "a"),
    b = projectLog(restored.log, "b");
  expect(a.find((e) => e.event?.kind === "draw-private")!.event).toMatchObject({
    card: { id: top.cardId },
  });
  expect(b.map((e) => e.event?.kind)).toEqual(["draw"]);
  expect(JSON.stringify(gameView(restored, "b").log)).not.toContain(top.cardId);
});
it("history rendering uses the event and captured names rather than cached text or current names", () => {
  const g = scenario("animals-wrecker", "unused");
  g.pending = [];
  draw(g, "a");
  g.players[0].name = "Renamed";
  g.log.at(-1)!.text = "corrupt cached presentation";
  expect(projectLog(g.log, "b")[0].text).toBe("a draws 1.");
});
it("spending an Eddie records its instance but no hidden card identity", () => {
  const g = scenario("animals-wrecker", "unused"),
    eddie = own(g, "a", "eddies")[0];
  spend(g, eddie);
  const row = projectLog(g.log, "b")[0];
  expect(row.event).toMatchObject({
    kind: "spend",
    piece: eddie.id,
    label: "an Eddie",
  });
  expect(JSON.stringify(row)).not.toContain(eddie.cardId);
});
it("private choice details never appear in another seat's structured history", () => {
  const g = scenario("sketchy-ripper", "attack"),
    top = own(g, "a", "deck")[0];
  top.cardId = "mantis-blades";
  advance(g);
  answer(g, "a", g.choice!.id, []);
  expect(projectLog(g.log, "a").some((e) => e.event?.kind === "choice")).toBe(
    true,
  );
  expect(projectLog(g.log, "b").some((e) => e.event?.kind === "choice")).toBe(
    false,
  );
  expect(
    projectLog(g.log, "b").some((e) => e.event?.kind === "private-choice"),
  ).toBe(true);
});
it("legacy text-only saved histories retain their visibility and text", () => {
  const rows = [
    { id: 1, text: "public" },
    { id: 2, text: "private", privateTo: "a" },
  ];
  expect(projectLog(rows, "b")).toEqual([rows[0]]);
  expect(projectLog(rows, "a")).toEqual(rows);
});
it("combat history records the declared attack, defender pass and resolved powers", () => {
  let g = scenario("animals-wrecker", "unused");
  g.pending = [];
  const p = own(g, "a", "field")[0],
    target = own(g, "b", "field")[1];
  g = applyCommand(g, "a", { type: "attack", piece: p.id, target: target.id });
  g = applyCommand(g, "b", { type: "endReaction" });
  const events = projectLog(g.log, "c").map((e) => e.event);
  expect(events.some((e) => e?.kind === "attack")).toBe(true);
  expect(events.some((e) => e?.kind === "pass-reaction")).toBe(true);
  expect(events.find((e) => e?.kind === "fight")).toMatchObject({
    attackerPower: 10,
    defenderPower: 4,
  });
});

it("history pagination preserves every authorized event without gaps or private leaks", async () => {
  const { projectLogPage } = await import("../../packages/engine/log");
  const rows = Array.from({ length: 1001 }, (_, i) => ({
    id: i + 1,
    text: String(i),
    ...(i % 3 === 0 ? { privateTo: "a" } : {}),
  }));
  for (const seat of ["a", "b"]) {
    const collected: number[] = [];
    let before: number | undefined;
    do {
      const page = projectLogPage(rows, seat, before);
      expect(page.log.length).toBeLessThanOrEqual(200);
      collected.unshift(...page.log.map((e) => e.id));
      before = page.logBefore ?? undefined;
    } while (before);
    expect(collected).toEqual(projectLog(rows, seat).map((e) => e.id));
  }
});
it("room snapshots bound recent history while saved state keeps all events", () => {
  const g = scenario("animals-wrecker", "unused");
  g.log = Array.from({ length: 1000 }, (_, i) => ({
    id: i + 1,
    text: `Event ${i}`,
  }));
  const view = gameView(g, "a");
  expect(view.log).toHaveLength(200);
  expect(view.logBefore).toBe(801);
  expect(g.log).toHaveLength(1000);
});
