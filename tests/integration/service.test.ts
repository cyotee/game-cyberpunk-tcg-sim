import { beforeAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { handle } from "../../apps/service/api";
import { importDeck } from "../../packages/decks/index";
import { db } from "../../apps/service/db";
import { unseal } from "../../packages/saves/server";
import type { Room } from "../../packages/protocol/index";
process.env.LOCAL_DATABASE_PATH = "memory";
process.env.DEV_AUTH = "1";
process.env.APP_ORIGIN = "http://127.0.0.1:5173";
const fixture = importDeck(
  readFileSync("docs/rules-audit/the-heist-import-fixture.txt", "utf8"),
);
async function request(
  route: string,
  body?: unknown,
  cookie = "",
  code = "",
  connection = "",
  params: Record<string, string> = {},
) {
  const url = new URL("http://127.0.0.1:5173/api");
  url.searchParams.set("route", route);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  if (code) url.searchParams.set("code", code);
  const req = new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin: process.env.APP_ORIGIN!,
      "x-table-request": "1",
      cookie,
      "x-seat-connection": connection,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const res = await handle(req);
  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
async function auth(name: string) {
  const r = await request("auth/local", { name });
  expect(r.status, r.data.error).toBe(200);
  return r.cookie;
}
describe("authoritative service", () => {
  it("runs an authenticated 5-seat match; protects hidden state, deduplicates and replaces seats", async () => {
    const cookies = await Promise.all(
      Array.from({ length: 5 }, (_, i) => auth("integration-" + i)),
    );
    const created = await request(
      "tables",
      {
        name: "Integration table",
        private: true,
        capacity: 5,
        targetMode: "majority",
        customTarget: 7,
      },
      cookies[0],
    );
    expect(created.status, created.data.error).toBe(200);
    const code = created.data.code,
      connections = [created.data.connection];
    for (let i = 1; i < 5; i++)
      connections.push(
        (await request("join", {}, cookies[i], code)).data.connection,
      );
    expect(
      (await request("tables")).data.tables.some((t: any) => t.code === code),
    ).toBe(false);
    for (let i = 0; i < 5; i++)
      expect(
        (await request("deck", fixture, cookies[i], code, connections[i]))
          .status,
      ).toBe(200);
    let r = (await request("room", undefined, cookies[0], code, connections[0]))
      .data;
    for (let i = 0; i < 5; i++) {
      const response = await request(
        "action",
        {
          revision: r.revision,
          generation: r.generation,
          commandId: crypto.randomUUID(),
          command: { type: "ready" },
        },
        cookies[i],
        code,
        connections[i],
      );
      expect(response.status, response.data.error).toBe(200);
      r = response.data;
    }
    const command = {
      revision: r.revision,
      generation: r.generation,
      commandId: crypto.randomUUID(),
      command: { type: "start" },
    };
    const started = await request(
      "action",
      command,
      cookies[0],
      code,
      connections[0],
    );
    expect(started.status, started.data.error).toBe(200);
    expect(started.data.game.target).toBe(16);
    const repeated = await request(
      "action",
      command,
      cookies[0],
      code,
      connections[0],
    );
    expect(repeated.data.revision).toBe(started.data.revision);
    const mine = started.data.seats[0].id;
    expect(
      started.data.game.pieces
        .filter((p: any) => p.zone === "hand")
        .every((p: any) => p.controller === mine),
    ).toBe(true);
    expect(started.data.game.pieces.some((p: any) => p.zone === "deck")).toBe(
      false,
    );
    expect(
      started.data.game.pieces
        .filter((p: any) => p.zone === "legends")
        .every((p: any) => !p.cardId),
    ).toBe(true);
    const historyDb = await db();
    const historyState = (
      await historyDb.query<{ state: Room }>(
        "SELECT state FROM rooms WHERE code=$1",
        [code],
      )
    ).rows[0].state;
    for (let i = 0; i < 501; i++)
      historyState.game!.log.push({
        id: ++historyState.game!.serial,
        text: i % 2 ? "public fixture" : "private history fixture",
        ...(i % 2 ? {} : { privateTo: mine }),
      });
    await historyDb.query("UPDATE rooms SET state=$1 WHERE code=$2", [
      JSON.stringify(historyState),
      code,
    ]);
    const recent = await request(
      "room",
      undefined,
      cookies[1],
      code,
      connections[1],
    );
    expect(recent.data.game.log).toHaveLength(200);
    expect(JSON.stringify(recent.data.game.log)).not.toContain(
      "private history fixture",
    );
    const earlier = await request(
      "history",
      undefined,
      cookies[1],
      code,
      connections[1],
      { before: String(recent.data.game.logBefore) },
    );
    expect(earlier.status).toBe(200);
    expect(
      earlier.data.log.every((e: any) => e.id < recent.data.game.logBefore),
    ).toBe(true);
    expect(JSON.stringify(earlier.data)).not.toContain(
      "private history fixture",
    );
    expect(
      (await request("history", undefined, "", code, connections[1])).status,
    ).toBe(400);
    expect(
      (
        await request("history", undefined, cookies[1], code, connections[1], {
          before: "-1",
        })
      ).status,
    ).toBe(400);
    const checkpoint = await request(
      "checkpoint",
      {},
      cookies[0],
      code,
      connections[0],
    );
    expect(checkpoint.status).toBe(200);
    const restored = unseal<Room>(checkpoint.data.envelope);
    expect(restored.game?.players).toHaveLength(5);
    expect(restored.game!.log.length).toBeGreaterThan(500);
    const copies = await Promise.all(
      cookies.map((cookie, i) =>
        request("checkpoint", {}, cookie, code, connections[i]),
      ),
    );
    for (const copy of copies) {
      expect(copy.status).toBe(200);
      expect(unseal<Room>(copy.data.envelope).revision).toBe(restored.revision);
    }
    const beforePresence = await request(
      "room",
      undefined,
      cookies[0],
      code,
      connections[0],
    );
    const presenceDb = await db();
    await presenceDb.query(
      "UPDATE rooms SET state=jsonb_set(state, '{seats,1,seen}', '1'::jsonb) WHERE code=$1",
      [code],
    );
    await presenceDb.query(
      "UPDATE room_presence SET seen=1 WHERE code=$1 AND player=$2",
      [code, restored.seats[1].id],
    );
    const presence = await request(
      "room",
      undefined,
      cookies[0],
      code,
      connections[0],
      { presence: "1", since: beforePresence.data.signature },
    );
    expect(presence.status).toBe(200);
    expect(presence.data.presenceOnly).toBe(true);
    expect(presence.data.game).toBeUndefined();
    expect(presence.data.seats[1]).toEqual({
      id: restored.seats[1].id,
      connected: false,
    });
    expect(
      presence.data.seats.every((s: any) => Object.keys(s).length === 2),
    ).toBe(true);
    expect(
      (
        await request("room", undefined, cookies[0], code, connections[0], {
          presence: "1",
          since: presence.data.signature,
        })
      ).data.unchanged,
    ).toBe(true);
    await presenceDb.query(
      "UPDATE rooms SET state=jsonb_set(state, '{generation}', to_jsonb((state->>'generation')::int + 1)) WHERE code=$1",
      [code],
    );
    const newGeneration = await request(
      "room",
      undefined,
      cookies[0],
      code,
      connections[0],
      { presence: "1", since: presence.data.signature },
    );
    expect(newGeneration.data.presenceOnly).toBeUndefined();
    expect(newGeneration.data.game).toBeDefined();
    expect(newGeneration.data.generation).toBe(restored.generation + 1);
    const newConnection = (await request("join", {}, cookies[0], code)).data
      .connection;
    const [oldSave, currentSave] = await Promise.all([
      request("checkpoint", {}, cookies[0], code, connections[0]),
      request("checkpoint", {}, cookies[0], code, newConnection),
    ]);
    expect(oldSave.status).toBe(400);
    expect(
      (await request("history", undefined, cookies[0], code, connections[0]))
        .status,
    ).toBe(400);
    expect(currentSave.status).toBe(200);
    expect(unseal<Room>(currentSave.data.envelope).revision).toBeGreaterThan(
      restored.revision,
    );
    expect(
      (await request("room", undefined, cookies[0], code, connections[0]))
        .status,
    ).toBe(400);
    expect(
      (await request("room", undefined, cookies[0], code, newConnection))
        .status,
    ).toBe(200);
    // Heartbeats live outside the large match document. Old document timestamps
    // must not let an imported snapshot reopen an actively connected match.
    const sql = await db();
    const stored = (
      await sql.query<{ state: Room }>(
        "SELECT state FROM rooms WHERE code=$1",
        [code],
      )
    ).rows[0].state;
    stored.seats.forEach((s) => (s.seen = 1));
    await sql.query("UPDATE rooms SET state=$1 WHERE code=$2", [
      JSON.stringify(stored),
      code,
    ]);
    const activeRestore = await request(
      "restore",
      { envelope: checkpoint.data.envelope },
      cookies[0],
    );
    expect(activeRestore.data.existing).toBe(true);
    const activeView = await request(
      "room",
      undefined,
      cookies[0],
      code,
      newConnection,
    );
    expect(activeView.data.restoring).toBe(false);
    const outsider = await auth("outsider");
    expect(
      (
        await request(
          "restore",
          { envelope: checkpoint.data.envelope },
          outsider,
        )
      ).status,
    ).toBe(400);
    expect((await request("join", {}, outsider, code)).status).toBe(400);
    connections[0] = newConnection;
    for (let i = 0; i < 5; i++)
      expect(
        (await request("leave", {}, cookies[i], code, connections[i])).status,
      ).toBe(200);
    const resumed = await request(
      "restore",
      { envelope: checkpoint.data.envelope },
      cookies[0],
    );
    expect(resumed.status, resumed.data.error).toBe(200);
    expect(resumed.data.existing).toBe(false);
    const reconnected = await request("join", {}, cookies[0], code);
    const waiting = await request(
      "room",
      undefined,
      cookies[0],
      code,
      reconnected.data.connection,
    );
    expect(waiting.data.restoring).toBe(true);
    expect(waiting.data.seats.every((s: any) => !s.ready)).toBe(true);
    expect(waiting.data.generation).toBeGreaterThan(started.data.generation);
    expect(waiting.data.revision).toBeGreaterThan(started.data.revision);
    expect(waiting.data.game.choice.id).toBe(started.data.game.choice.id);
  });
  it("rejects cross-origin mutation and unauthenticated table creation", async () => {
    const response = await handle(
      new Request("http://127.0.0.1:5173/api?route=tables", {
        method: "POST",
        headers: { origin: "https://evil.example", "x-table-request": "1" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(403);
    expect((await request("tables", {})).status).toBe(400);
  });
});

describe("lobby concurrency and host-owned blocks", () => {
  async function table(name: string, capacity = 3) {
    const cookie = await auth(name);
    const r = await request(
      "tables",
      {
        name,
        private: false,
        capacity,
        targetMode: "majority",
        customTarget: 7,
      },
      cookie,
    );
    expect(r.status).toBe(200);
    return { cookie, code: r.data.code, connection: r.data.connection };
  }
  async function action(
    t: { cookie: string; code: string; connection: string },
    command: unknown,
  ) {
    const view = await request(
      "room",
      undefined,
      t.cookie,
      t.code,
      t.connection,
    );
    return request(
      "action",
      {
        commandId: crypto.randomUUID(),
        revision: view.data.revision,
        generation: view.data.generation,
        command,
      },
      t.cookie,
      t.code,
      t.connection,
    );
  }
  it("serializes two concurrent requests for the final seat", async () => {
    const t = await table("race-host", 2);
    const [a, b] = await Promise.all([auth("race-a"), auth("race-b")]);
    const results = await Promise.all([
      request("join", {}, a, t.code),
      request("join", {}, b, t.code),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    const view = await request(
      "room",
      undefined,
      t.cookie,
      t.code,
      t.connection,
    );
    expect(view.data.seats).toHaveLength(2);
  });
  it("only commits one of two different commands at the same revision", async () => {
    const t = await table("revision-host");
    await request("deck", fixture, t.cookie, t.code, t.connection);
    const view = await request(
      "room",
      undefined,
      t.cookie,
      t.code,
      t.connection,
    );
    const body = {
      revision: view.data.revision,
      generation: view.data.generation,
      command: { type: "ready" },
    };
    const responses = await Promise.all(
      [0, 1].map(() =>
        request(
          "action",
          { ...body, commandId: crypto.randomUUID() },
          t.cookie,
          t.code,
          t.connection,
        ),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
    const latest = await request(
      "room",
      undefined,
      t.cookie,
      t.code,
      t.connection,
    );
    expect(latest.data.seats[0].ready).toBe(true);
  });
  it("resets readiness on deck edits and applies only the incoming host block list", async () => {
    const t = await table("block-host");
    const second = await auth("block-successor"),
      third = await auth("blocked-guest");
    const successor = await request("join", {}, second, t.code);
    await request("join", {}, third, t.code);
    await request("deck", fixture, t.cookie, t.code, t.connection);
    await action(t, { type: "ready" });
    const edited = { ...fixture, name: "Edited selection" };
    await request("deck", edited, t.cookie, t.code, t.connection);
    let view = await request("room", undefined, t.cookie, t.code, t.connection);
    expect(view.data.seats[0].ready).toBe(false);
    await action(t, { type: "ready" });
    const malformed = await request(
      "deck",
      { ...fixture, main: "invalid" },
      t.cookie,
      t.code,
      t.connection,
    );
    expect(malformed.status).toBe(200);
    view = await request("room", undefined, t.cookie, t.code, t.connection);
    expect(view.data.seats[0].ready).toBe(false);
    expect(view.data.seats[0].deckError).toBeTruthy();
    expect((await action(t, { type: "ready" })).status).toBe(400);
    const blocked = view.data.seats[2].id;
    expect((await action(t, { type: "kick", target: blocked })).status).toBe(
      200,
    );
    expect((await request("join", {}, third, t.code)).status).toBe(400);
    const otherTable = await table("block-host");
    expect((await request("join", {}, third, otherTable.code)).status).toBe(
      400,
    );
    await request("leave", {}, t.cookie, t.code, t.connection);
    view = await request(
      "room",
      undefined,
      second,
      t.code,
      successor.data.connection,
    );
    expect(view.data.host).toBe(view.data.seats[0].id);
    expect((await request("join", {}, third, t.code)).status).toBe(200);
  });
});
