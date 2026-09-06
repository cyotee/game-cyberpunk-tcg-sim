import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { handle } from "../apps/service/api";
import { importDeck } from "../packages/decks/index";
const localPostgres = process.env.LOCAL_POSTGRES_BENCHMARK === "1";
if (process.env.VERCEL || process.env.NODE_ENV === "production")
  throw Error("This benchmark requires a disposable local database.");
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  if (
    !localPostgres ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !url.pathname.endsWith("_tests")
  )
    throw Error(
      "PostgreSQL benchmark requires explicit opt-in and a loopback database ending in _tests.",
    );
}
process.env.LOCAL_DATABASE_PATH = "memory";
process.env.DEV_AUTH = "1";
process.env.APP_ORIGIN = "http://127.0.0.1:5173";
const deck = importDeck(
  readFileSync("docs/rules-audit/the-heist-import-fixture.txt", "utf8"),
);
async function request(
  route: string,
  body?: unknown,
  cookie = "",
  code = "",
  connection = "",
) {
  const res = await handle(
    new Request(`${process.env.APP_ORIGIN}/api?route=${route}&code=${code}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        origin: process.env.APP_ORIGIN!,
        "x-table-request": "1",
        "content-type": "application/json",
        cookie,
        "x-seat-connection": connection,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  const data = await res.json();
  if (!res.ok) throw Error(`${route}: ${data.error}`);
  return { data, cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "" };
}
const results = [];
for (const size of [5, 2]) {
  const tables = [];
  for (let t = 0; t < 100 / size; t++) {
    const seats = [];
    let code = "";
    for (let i = 0; i < size; i++) {
      const cookie = (
        await request("auth/local", { name: `load-${size}-${t}-${i}` })
      ).cookie;
      const joined = await request(
        i ? "join" : "tables",
        i
          ? {}
          : {
              name: "Load fixture",
              private: true,
              capacity: size,
              targetMode: "majority",
              customTarget: 7,
            },
        cookie,
        code,
      );
      code = joined.data.code ?? code;
      const connection = joined.data.connection;
      await request("deck", deck, cookie, code, connection);
      seats.push({ cookie, connection });
    }
    let room = (
      await request(
        "room",
        undefined,
        seats[0].cookie,
        code,
        seats[0].connection,
      )
    ).data;
    for (const seat of seats)
      room = (
        await request(
          "action",
          {
            commandId: crypto.randomUUID(),
            revision: room.revision,
            generation: room.generation,
            command: { type: "ready" },
          },
          seat.cookie,
          code,
          seat.connection,
        )
      ).data;
    await request(
      "action",
      {
        commandId: crypto.randomUUID(),
        revision: room.revision,
        generation: room.generation,
        command: { type: "start" },
      },
      seats[0].cookie,
      code,
      seats[0].connection,
    );
    tables.push({ code, seats });
  }
  const latencies: number[] = [];
  let bytes = 0;
  const start = performance.now();
  for (let round = 0; round < 3; round++)
    await Promise.all(
      tables.flatMap((table) =>
        table.seats.map(async (seat) => {
          const t = performance.now();
          const r = await request(
            "room",
            undefined,
            seat.cookie,
            table.code,
            seat.connection,
          );
          latencies.push(performance.now() - t);
          bytes += JSON.stringify(r.data).length;
        }),
      ),
    );
  latencies.sort((a, b) => a - b);
  results.push({
    players: 100,
    tables: tables.length,
    seatsPerTable: size,
    requests: latencies.length,
    elapsedMs: Math.round(performance.now() - start),
    p50Ms: Math.round(latencies[Math.floor(latencies.length * 0.5)]),
    p95Ms: Math.round(latencies[Math.floor(latencies.length * 0.95)]),
    responseBytes: bytes,
  });
}
writeFileSync(
  localPostgres
    ? "docs/operations/local-postgres-load-results.json"
    : "docs/operations/local-load-results.json",
  JSON.stringify(
    {
      scope: `In-process API handler against disposable ${localPostgres ? "PostgreSQL" : "PGlite"}. Excludes HTTP, Vercel, hosted PostgreSQL, cold starts and browser rendering. Not production capacity certification.`,
      measuredAt: new Date().toISOString(),
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(results, null, 2));
process.exit(0);
