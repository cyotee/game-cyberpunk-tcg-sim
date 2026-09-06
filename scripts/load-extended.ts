import { log, logActor, logCard } from "../packages/engine/kernel";
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { handle } from "../apps/service/api";
import { db } from "../apps/service/db";
import type { Room } from "../packages/protocol";
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  process.env.LOCAL_POSTGRES_BENCHMARK !== "1" ||
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !url.pathname.endsWith("_tests") ||
  process.env.VERCEL
)
  throw Error(
    "Use only the explicitly enabled disposable loopback PostgreSQL benchmark.",
  );
process.env.DEV_AUTH = "1";
process.env.APP_ORIGIN = "http://127.0.0.1:5173";
async function request(
  route: string,
  body?: unknown,
  cookie = "",
  code = "",
  connection = "",
  expected = 200,
  since = "",
) {
  const result = await handle(
    new Request(
      `${process.env.APP_ORIGIN}/api?route=${route}&code=${code}&presence=1&since=${encodeURIComponent(since)}`,
      {
        method: body === undefined ? "GET" : "POST",
        headers: {
          origin: process.env.APP_ORIGIN!,
          "x-table-request": "1",
          cookie,
          "x-seat-connection": connection,
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
    ),
  );
  const data = await result.json();
  if (result.status !== expected)
    throw Error(
      `${route} returned unexpected status ${result.status}: ${data.error}`,
    );
  return {
    data,
    cookie: result.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
const metric = (values: number[]) => {
  values.sort((a, b) => a - b);
  return {
    requests: values.length,
    p50Ms: Math.round(values[Math.floor(values.length * 0.5)]),
    p95Ms: Math.round(values[Math.floor(values.length * 0.95)]),
  };
};
const sql = await db();
const rows = (
  await sql.query<{ state: Room }>(
    "SELECT state FROM rooms WHERE state->>'name'='Load fixture'",
  )
).rows;
if (rows.length !== 70)
  throw Error(
    "First run load-playtest.ts in a fresh disposable database to create 70 fixture tables.",
  );
const reports = [];
for (const size of [5, 2]) {
  const tables = [];
  for (const { state: r } of rows.filter(
    (r) => r.state.seats.length === size,
  )) {
    const seats = [];
    for (const s of r.seats) {
      if (!s.name.startsWith("load-"))
        throw Error("Unexpected fixture identity");
      const cookie = (await request("auth/local", { name: s.name })).cookie;
      const joined = await request("join", {}, cookie, r.code);
      seats.push({ id: s.id, cookie, connection: joined.data.connection });
    }
    tables.push({ code: r.code, seats });
  }
  const reconnect: number[] = [];
  await Promise.all(
    tables.flatMap((t) =>
      t.seats.map(async (s) => {
        const old = s.connection,
          start = performance.now();
        s.connection = (
          await request("join", {}, s.cookie, t.code)
        ).data.connection;
        reconnect.push(performance.now() - start);
        await request("room", undefined, s.cookie, t.code, old, 400);
      }),
    ),
  );
  const commits: number[] = [];
  for (let round = 0; round < 10; round++)
    await Promise.all(
      tables.map(async (t) => {
        const view = (
          await request(
            "room",
            undefined,
            t.seats[0].cookie,
            t.code,
            t.seats[0].connection,
          )
        ).data;
        const actor = t.seats.find(
          (s) => s.id === (view.game.choice?.player ?? view.game.turnPlayer),
        )!;
        // Read as the chooser so private choice options remain seat-authorized.
        const own = (
          await request(
            "room",
            undefined,
            actor.cookie,
            t.code,
            actor.connection,
          )
        ).data;
        const c = own.game.choice;
        const command = c
          ? {
              type: "choose",
              choice: c.id,
              values: c.options.slice(0, c.min).map((o: any) => o.id),
            }
          : { type: "endTurn" };
        const start = performance.now();
        await request(
          "action",
          {
            protocolVersion: 1,
            commandId: crypto.randomUUID(),
            revision: own.revision,
            generation: own.generation,
            command,
          },
          actor.cookie,
          t.code,
          actor.connection,
        );
        commits.push(performance.now() - start);
      }),
    );
  for (const [index, t] of tables.entries()) {
    const state = (
      await sql.query<{ state: Room }>(
        "SELECT state FROM rooms WHERE code=$1",
        [t.code],
      )
    ).rows[0].state;
    const game = state.game!,
      actor = game.players[0].id;
    const hidden = game.pieces.find(
      (p) => p.controller === actor && p.zone === "deck",
    )!;
    for (let i = 0; i < 10000; i++) {
      if (i % 3 === 0)
        log(game, { kind: "draw-private", card: logCard(hidden) }, actor);
      else
        log(game, { kind: "draw", actor: logActor(game, actor), count: i % 3 });
    }
    state.private = index % 2 !== 0;
    state.revision++;
    await sql.query("UPDATE rooms SET state=$1 WHERE code=$2", [
      JSON.stringify(state),
      t.code,
    ]);
  }
  const snapshots: number[] = [];
  let bytes = 0;
  await Promise.all(
    tables.flatMap((t) =>
      t.seats.map(async (s) => {
        const start = performance.now();
        const saved = (
          await request("checkpoint", {}, s.cookie, t.code, s.connection)
        ).data;
        snapshots.push(performance.now() - start);
        bytes += Buffer.byteLength(JSON.stringify(saved));
      }),
    ),
  );
  const unchangedPolls: number[] = [];
  let pollBytes = 0,
    unchangedResponses = 0,
    presenceResponses = 0;
  const signatures = new Map<string, string>();
  for (const t of tables) {
    const s = t.seats[0];
    const view = await request(
      "room",
      undefined,
      s.cookie,
      t.code,
      s.connection,
    );
    // Simulate a client's last known disconnected roster while keeping the
    // authoritative revision current: the first burst must use presence patches.
    signatures.set(t.code, view.data.signature.replace(/:true/g, ":false"));
  }
  for (let round = 0; round < 3; round++)
    await Promise.all(
      tables.flatMap((t) =>
        t.seats.map(async (s) => {
          const start = performance.now();
          const view = await request(
            "room",
            undefined,
            s.cookie,
            t.code,
            s.connection,
            200,
            signatures.get(t.code),
          );
          unchangedPolls.push(performance.now() - start);
          // Presence changes may legitimately cause one refreshed view.
          pollBytes += Buffer.byteLength(JSON.stringify(view.data));
          if (view.data.unchanged) unchangedResponses++;
          else {
            if (view.data.presenceOnly) presenceResponses++;
            signatures.set(t.code, view.data.signature);
          }
        }),
      ),
    );
  if (!presenceResponses)
    throw Error("The fixture did not exercise presence-only refreshes");
  const directory: number[] = [];
  await Promise.all(
    Array.from({ length: 100 }, async () => {
      const start = performance.now();
      await request("tables");
      directory.push(performance.now() - start);
    }),
  );
  reports.push({
    players: 100,
    seatsPerTable: size,
    tables: tables.length,
    reconnect: metric(reconnect),
    oldConnectionsRejected: 100,
    commands: metric(commits),
    longHistoryEntriesPerTable: 10000,
    longHistoryFormat: "typed events; one third seat-private",
    snapshots: { ...metric(snapshots), responseBytes: bytes },
    anonymousDirectory: metric(directory),
    conditionalPolls: {
      ...metric(unchangedPolls),
      responseBytes: pollBytes,
      unchangedResponses,
      presenceResponses,
    },
  });
}
writeFileSync(
  "docs/operations/local-postgres-extended-results.json",
  JSON.stringify(
    {
      measuredAt: new Date().toISOString(),
      scope:
        "Synthetic in-process PostgreSQL fixtures. Excludes deployed Vercel, network, real Discord and browser rendering. Not production acceptance.",
      reports,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(reports, null, 2));
process.exit(0);
