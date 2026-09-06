import { projectLogPage } from "../../packages/engine/log";
import { randomBytes } from "node:crypto";
import { db, transaction, type SQL } from "./db";
import { hash, token, type User } from "./auth";
import type { Game } from "../../packages/engine/index";
import {
  latestRuntime,
  runtimeFor,
  supportsRuntime,
} from "../../packages/runtimes/index";
import { validateDeck } from "../../packages/decks/index";
import {
  targetCount,
  type Room,
  type Seat,
  actionSchema,
  deckSchema,
} from "../../packages/protocol/index";
import { sealAsync, unseal, type Envelope } from "../../packages/saves/server";
const connected = (s: Seat) => Date.now() - s.seen < 20000;
const randomness = () => {
  const bytes = randomBytes(32000);
  return Array.from(
    { length: 8000 },
    (_, i) => bytes.readUInt32LE(i * 4) / 4294967296,
  );
};
export async function readRoom(
  sql: SQL,
  code: string,
  lock = false,
  projection: boolean | "summary" = false,
) {
  const r = await sql.query<{ state: Room }>(
    "SELECT " +
      (projection === "summary"
        ? "state - 'game' - 'dedupe'"
        : projection
          ? "state #- '{game,random}'"
          : "state") +
      " AS state FROM rooms WHERE code=$1" +
      (lock ? " FOR UPDATE" : ""),
    [code],
  );
  if (!r.rows[0]) throw Error("Table not found");
  const room = r.rows[0].state;
  await hydratePresence(sql, room);
  return room;
}
async function hydratePresence(sql: SQL, room: Room) {
  const code = room.code;
  const presence = await sql.query<{
    player: string;
    connection: string;
    seen: string;
  }>("SELECT player,connection,seen FROM room_presence WHERE code=$1", [code]);
  for (const s of room.seats) {
    const p = presence.rows.find(
      (p) => p.player === s.id && p.connection === s.connection,
    );
    if (p) s.seen = Math.max(s.seen, Number(p.seen));
  }
}
async function persistPresence(sql: SQL, r: Room) {
  for (const s of r.seats)
    await sql.query(
      "INSERT INTO room_presence(code,player,connection,seen) VALUES($1,$2,$3,$4) ON CONFLICT(code,player) DO UPDATE SET connection=EXCLUDED.connection,seen=CASE WHEN room_presence.connection=EXCLUDED.connection AND EXCLUDED.seen>0 THEN GREATEST(room_presence.seen,EXCLUDED.seen) ELSE EXCLUDED.seen END",
      [r.code, s.id, s.connection, s.seen],
    );
}
async function persist(sql: SQL, r: Room) {
  await sql.query("UPDATE rooms SET state=$1,updated=$2 WHERE code=$3", [
    JSON.stringify(r),
    Date.now(),
    r.code,
  ]);
  await persistPresence(sql, r);
}
export async function mutate<T>(
  code: string,
  fn: (r: Room, sql: SQL) => Promise<T> | T,
) {
  return transaction(async (sql) => {
    const room = await readRoom(sql, code, true);
    const result = await fn(room, sql);
    await persist(sql, room);
    return result;
  });
}
async function transfer(r: Room) {
  if (r.seats.some((s) => s.id === r.host && connected(s))) return;
  const next = r.seats.filter(connected).sort((a, b) => a.joined - b.joined)[0];
  if (next && next.id !== r.host) {
    r.host = next.id;
    r.revision++;
  }
}
function seat(r: Room, u: User, connection?: string) {
  const s = r.seats.find((s) => s.id === u.id);
  if (!s) throw Error("You are not seated at this table");
  if (connection && s.connection !== hash(connection))
    throw Error(
      "Your seat is connected in another browser. Reclaim it to continue.",
    );
  return s;
}
function authenticateSeat(r: Room, u: User, connection: string | undefined) {
  if (!connection) throw Error("Reconnect to your seat");
  return seat(r, u, connection);
}
let directoryRead:
  Promise<Awaited<ReturnType<typeof queryPublicTables>>> | undefined;
export async function publicTables() {
  directoryRead ??= queryPublicTables();
  const reading = directoryRead;
  try {
    return await reading;
  } finally {
    if (directoryRead === reading) directoryRead = undefined;
  }
}
async function queryPublicTables() {
  const rows = await (
    await db()
  ).query<{ state: Room; started: boolean }>(
    "SELECT state - 'game' - 'dedupe' AS state, state ? 'game' AS started FROM rooms WHERE state->>'private'='false' ORDER BY updated DESC LIMIT 200",
  );
  return rows.rows.map(({ state: r, started }) => ({
    code: r.code,
    name: r.name,
    host: r.seats.find((s) => s.id === r.host)?.name ?? "Awaiting players",
    occupied: r.seats.length,
    capacity: r.capacity,
    status: started ? "in-progress" : "lobby",
    available: !started && r.seats.length < r.capacity,
  }));
}
export async function createRoom(
  u: User,
  input: {
    name: string;
    private: boolean;
    capacity: number;
    targetMode: Room["targetMode"];
    customTarget: number;
  },
) {
  const code = randomBytes(6).toString("hex").toUpperCase(),
    t = token();
  const room: Room = {
    format: 1,
    code,
    name: input.name,
    private: input.private,
    capacity: input.capacity,
    host: u.id,
    seats: [
      {
        id: u.id,
        name: u.name,
        ready: false,
        joined: Date.now(),
        seen: Date.now(),
        connection: hash(t),
      },
    ],
    revision: 1,
    generation: 1,
    targetMode: input.targetMode,
    customTarget: input.customTarget,
    restoring: false,
    created: Date.now(),
    dedupe: {},
  };
  await (
    await db()
  ).query("INSERT INTO rooms(code,state,updated) VALUES($1,$2,$3)", [
    code,
    JSON.stringify(room),
    Date.now(),
  ]);
  return { code, connection: t };
}
export async function joinRoom(code: string, u: User) {
  return mutate(code, async (r, sql) => {
    // Apply an already-due succession before consulting the admission block list.
    await transfer(r);
    let s = r.seats.find((s) => s.id === u.id);
    if (!s) {
      if (r.game) throw Error("No new players may join an in-progress match");
      if (r.seats.length >= r.capacity) throw Error("The table is full");
      const host = await sql.query<{ blocks: string[] }>(
        "SELECT blocks FROM users WHERE id=$1",
        [r.host],
      );
      if (host.rows[0]?.blocks.includes(u.id))
        throw Error("The host has blocked this account");
      s = {
        id: u.id,
        name: u.name,
        ready: false,
        joined: Date.now(),
        seen: Date.now(),
        connection: "",
      };
      r.seats.push(s);
      if (r.targetMode === "majority")
        r.seats.forEach((s) => (s.ready = false));
    }
    const t = token();
    s.connection = hash(t);
    s.name = u.name;
    s.seen = Date.now();
    await transfer(r);
    r.revision++;
    return { code: r.code, connection: t };
  });
}
export function gameView(g: Game, id: string) {
  const { power, cred, resources, mayAttack, cost, card, keyword, FEATURES } =
    runtimeFor(g.version);
  const ownPlayer = g.players.find((p) => p.id === id);
  if (!ownPlayer) throw Error("No spectator access");
  const pieces = g.pieces
    .filter(
      (p) =>
        (!["deck", "eddies"].includes(p.zone) &&
          p.zone !== "hand" &&
          !(p.zone === "removed" && !p.faceUp)) ||
        (p.controller === id && p.zone === "hand"),
    )
    .map((p) => {
      if (p.zone === "legends" && !p.faceUp)
        return {
          id: p.id,
          controller: p.controller,
          owner: p.owner,
          zone: p.zone,
          ready: p.ready,
          faceUp: false,
          ...(p.known ? { known: true } : {}),
          ...(p.controller === id && p.known ? { cardId: p.cardId } : {}),
        };
      if (p.zone === "removed") return { ...p };
      return {
        ...p,
        power: p.zone === "field" && !p.host ? power(g, p) : undefined,
      };
    });
  const active =
    g.turnPlayer === id && g.phase === "main" && !g.attack && !g.choice;
  const reaction =
    g.attack?.defender === id && g.attack.stage === "react" && !g.choice;
  const choices =
    g.choice?.player === id
      ? g.choice
      : g.choice
        ? {
            id: g.choice.id,
            player: g.choice.player,
            label: g.choice.private
              ? "Making a private choice"
              : g.choice.label,
          }
        : undefined;
  return {
    version: g.version,
    cardData: Object.fromEntries(
      [
        ...new Set(
          [
            ...pieces.map((p) => ("cardId" in p ? p.cardId : undefined)),
            ...(g.choice?.player === id
              ? g.choice.options.map((o) => o.cardId)
              : []),
          ].filter((id): id is string => !!id),
        ),
      ].map((id) => [id, card(id)]),
    ),
    id: g.id,
    players: g.players.map((p) => ({
      ...p,
      deckCount: g.pieces.filter(
        (x) => x.controller === p.id && x.zone === "deck",
      ).length,
      handCount: g.pieces.filter(
        (x) => x.controller === p.id && x.zone === "hand",
      ).length,
      eddies: g.pieces
        .filter((x) => x.controller === p.id && x.zone === "eddies")
        .map((x) => ({ id: x.id, ready: x.ready })),
      streetCred: Number.isFinite(cred(g, p.id)) ? cred(g, p.id) : null,
    })),
    pieces,
    gigs: g.gigs,
    turn: g.turn,
    turnPlayer: g.turnPlayer,
    phase: g.phase,
    target: g.target,
    overtime: g.overtime,
    sudden: g.sudden,
    winner: g.winner,
    draw: g.draw,
    attack: g.attack,
    choice: choices,
    ...projectLogPage(g.log, id),
    availableResources: resources(g, id).length,
    legal: {
      active,
      reaction,
      legendPlayCosts: Object.fromEntries(
        g.pieces
          .filter(
            (p) =>
              !!FEATURES?.normalLegendPlay &&
              p.controller === id &&
              !p.host &&
              p.zone === "legends" &&
              p.faceUp &&
              card(p.cardId).type === "Legend" &&
              Number.isFinite(cost(g, p)),
          )
          .map((p) => [p.id, cost(g, p)]),
      ),
      blockers:
        reaction && !g.attack?.unblocked
          ? g.pieces
              .filter(
                (p) =>
                  p.controller === id &&
                  p.zone === "field" &&
                  !p.host &&
                  p.ready &&
                  p.id !== g.attack?.target &&
                  keyword(g, p, "Blocker"),
              )
              .map((p) => p.id)
          : [],
      attackTargets: active
        ? Object.fromEntries(
            g.pieces
              .filter(
                (p) => p.controller === id && p.zone === "field" && !p.host,
              )
              .map((p) => [
                p.id,
                [
                  ...g.pieces
                    .filter((t) => t.zone === "field" && !t.host)
                    .map((t) => t.id),
                  ...g.players.map((t) => t.id),
                ].filter((t) => mayAttack(g, p, t)),
              ]),
          )
        : {},
      costs: Object.fromEntries(
        g.pieces
          .filter(
            (p) =>
              p.controller === id &&
              (p.zone === "hand" || (p.zone === "legends" && p.faceUp)),
          )
          .map((p) => [
            p.id,
            Number.isFinite(cost(g, p, p.zone === "legends"))
              ? cost(g, p, p.zone === "legends")
              : null,
          ]),
      ),
    },
  };
}
function requiredPlayer(g: Game) {
  if (g.choice) return g.choice.player;
  if (g.attack?.stage === "react") return g.attack.defender;
  return g.turnPlayer;
}
export function roomView(r: Room, id: string) {
  const needed = r.game ? requiredPlayer(r.game) : undefined;
  const missing = needed
    ? r.seats.find((s) => s.id === needed && !connected(s))
    : undefined;
  return {
    code: r.code,
    name: r.name,
    private: r.private,
    capacity: r.capacity,
    host: r.host,
    revision: r.revision,
    generation: r.generation,
    targetMode: r.targetMode,
    customTarget: r.customTarget,
    target: targetCount(r),
    restoring: r.restoring,
    seats: r.seats.map((s) => ({
      id: s.id,
      name: s.name,
      ready: s.ready,
      connected: connected(s),
      deckName: s.id === id ? s.deck?.name : undefined,
      deckError: s.id === id ? s.deckError : undefined,
      deckLegal: s.deck ? validateDeck(s.deck).length === 0 : false,
    })),
    game: r.game ? gameView(r.game, id) : undefined,
    waitingFor: missing?.name,
  };
}
export async function pollRoom(
  code: string,
  u: User,
  connection: string | undefined,
  since?: string,
  presenceUpdates = false,
) {
  const sql = await db();
  let r = await readRoom(sql, code, false, "summary");
  let needsGame = true;
  const s = authenticateSeat(r, u, connection);
  s.seen = Date.now();
  const heartbeat = await sql.query<{ seen: string }>(
    "INSERT INTO room_presence(code,player,connection,seen) SELECT $1,$2,$3,$4 WHERE EXISTS (SELECT 1 FROM rooms WHERE code=$1 AND state->'seats' @> $5::jsonb) ON CONFLICT(code,player) DO UPDATE SET seen=EXCLUDED.seen WHERE room_presence.connection=EXCLUDED.connection RETURNING seen",
    [
      code,
      u.id,
      s.connection,
      s.seen,
      JSON.stringify([{ id: u.id, connection: s.connection }]),
    ],
  );
  if (!heartbeat.rows.length)
    throw Error(
      "Your seat is connected in another browser. Reclaim it to continue.",
    );
  if (!r.seats.some((s) => s.id === r.host && connected(s))) {
    needsGame = false;
    r = await mutate(code, async (current) => {
      authenticateSeat(current, u, connection);
      await transfer(current);
      return current;
    });
  }
  const signatureFor = (room: Room) =>
    `${room.generation}.${room.revision}` +
    ":" +
    room.seats.map((s) => s.id + ":" + connected(s)).join(",");
  const signature = signatureFor(r);
  if (since === signature) return { unchanged: true, signature };
  if (
    presenceUpdates &&
    since?.split(":")[0] === `${r.generation}.${r.revision}`
  ) {
    const input = await sql.query<{ required: string | null }>(
      "SELECT COALESCE(state #>> '{game,choice,player}', CASE WHEN state #>> '{game,attack,stage}'='react' THEN state #>> '{game,attack,defender}' END, state #>> '{game,turnPlayer}') AS required FROM rooms WHERE code=$1 AND state->>'revision'=$2 AND state->>'generation'=$3",
      [code, String(r.revision), String(r.generation)],
    );
    if (input.rows.length)
      return {
        presenceOnly: true,
        code,
        generation: r.generation,
        revision: r.revision,
        signature,
        seats: r.seats.map((s) => ({ id: s.id, connected: connected(s) })),
        waitingFor: r.seats.find(
          (s) => s.id === input.rows[0].required && !connected(s),
        )?.name,
      };
  }
  if (needsGame) {
    r = await readRoom(sql, code, false, true);
    authenticateSeat(r, u, connection);
  }
  return { ...roomView(r, u.id), signature: signatureFor(r) };
}

// Share only work that is currently in flight; never serve a retained stale snapshot.
// Seat authorization is checked separately for every caller before encryption.
const checkpointReads = new Map<string, Promise<Room>>();
const checkpointEnvelopes = new WeakMap<Room, Promise<Envelope>>();
export async function checkpoint(
  code: string,
  u: User,
  connection: string | undefined,
) {
  let reading = checkpointReads.get(code);
  if (!reading) {
    reading = db().then((sql) => readRoom(sql, code));
    checkpointReads.set(code, reading);
  }
  let r: Room;
  try {
    r = await reading;
  } finally {
    if (checkpointReads.get(code) === reading) checkpointReads.delete(code);
  }
  authenticateSeat(r, u, connection);
  if (!r.game) throw Error("Start the match before saving");
  let envelope = checkpointEnvelopes.get(r);
  if (!envelope) {
    envelope = sealAsync(r);
    checkpointEnvelopes.set(r, envelope);
  }
  return {
    name: r.name,
    code: r.code,
    revision: r.revision,
    generation: r.generation,
    version: r.game.version,
    savedAt: new Date().toISOString(),
    envelope: await envelope,
  };
}
export async function roomAction(
  code: string,
  u: User,
  connection: string | undefined,
  input: unknown,
) {
  const req = actionSchema.parse(input);
  return mutate(code, async (r, sql) => {
    const s = authenticateSeat(r, u, connection);
    s.seen = Date.now();
    await transfer(r);
    const dedupeKey = u.id + ":" + req.commandId,
      serialized = JSON.stringify(req.command);
    if (r.dedupe[dedupeKey]) {
      if (r.dedupe[dedupeKey] !== serialized)
        throw Error("Command ID already used for a different action");
      return roomView(r, u.id);
    }
    if (req.revision !== r.revision || req.generation !== r.generation)
      throw Error("Table changed. Refresh the current state and try again.");
    if (!r.game || r.restoring) {
      const cmd = req.command;
      if (cmd.type === "ready") {
        if (!r.restoring && (!s.deck || validateDeck(s.deck).length))
          throw Error("Load a legal deck first");
        s.ready = !s.ready;
      } else if (cmd.type === "start") {
        if (r.host !== u.id) throw Error("Only the host can start");
        if (
          r.seats.length < 2 ||
          r.seats
            .filter(
              (p) => !r.game?.players.find((x) => x.id === p.id)?.eliminated,
            )
            .some((p) => !p.ready || !connected(p))
        )
          throw Error("Every remaining player must be connected and ready");
        if (r.restoring) {
          r.restoring = false;
        } else {
          r.game = latestRuntime.newGame(
            r.code,
            r.seats.map((s) => ({ id: s.id, name: s.name, deck: s.deck! })),
            targetCount(r),
            randomness(),
          );
        }
      } else if (cmd.type === "kick") {
        if (r.game) throw Error("Cannot kick players from a saved match");
        if (r.host !== u.id || cmd.target === u.id)
          throw Error("Only the host may remove another lobby player");
        r.seats = r.seats.filter((s) => s.id !== cmd.target);
        await sql.query(
          "UPDATE users SET blocks=CASE WHEN blocks @> $1::jsonb THEN blocks ELSE blocks || $1::jsonb END WHERE id=$2",
          [JSON.stringify([cmd.target]), u.id],
        );
        if (r.targetMode === "majority")
          r.seats.forEach((s) => (s.ready = false));
      } else throw Error("Unknown lobby action");
    } else {
      const needed = requiredPlayer(r.game);
      if (
        r.seats.some((s) => s.id === needed && !connected(s)) &&
        req.command.type !== "concede"
      )
        throw Error("Waiting for the required player to reconnect");
      const game = structuredClone(r.game);
      if (game.random.length - game.randomCursor < 1000) {
        game.random = game.random.slice(game.randomCursor).concat(randomness());
        game.randomCursor = 0;
      }
      r.game = runtimeFor(game.version).applyCommand(game, u.id, req.command);
    }
    r.revision++;
    r.dedupe[dedupeKey] = serialized;
    return roomView(r, u.id);
  });
}
export async function setDeck(
  code: string,
  u: User,
  connection: string | undefined,
  input: unknown,
) {
  const parsed = deckSchema.safeParse(input);
  return mutate(code, (r) => {
    const s = authenticateSeat(r, u, connection);
    if (r.game) throw Error("Decks are locked after match start");
    s.deck = parsed.success ? parsed.data : undefined;
    s.deckError = parsed.success
      ? validateDeck(parsed.data).join(" ")
      : "The selected deck has invalid fields. Edit it or load another legal deck.";
    s.ready = false;
    r.revision++;
    return roomView(r, u.id);
  });
}
export async function settings(
  code: string,
  u: User,
  connection: string | undefined,
  input: { targetMode: Room["targetMode"]; customTarget: number },
) {
  return mutate(code, (r) => {
    authenticateSeat(r, u, connection);
    if (r.host !== u.id || r.game)
      throw Error("Only the lobby host can change settings");
    r.targetMode = input.targetMode;
    r.customTarget = input.customTarget;
    r.seats.forEach((s) => (s.ready = false));
    r.revision++;
    return roomView(r, u.id);
  });
}
export async function leave(
  code: string,
  u: User,
  connection: string | undefined,
) {
  return mutate(code, async (r) => {
    const s = authenticateSeat(r, u, connection);
    if (r.game) {
      s.seen = 0;
    } else {
      r.seats = r.seats.filter((s) => s.id !== u.id);
      if (r.targetMode === "majority")
        r.seats.forEach((s) => (s.ready = false));
    }
    await transfer(r);
    r.revision++;
    return { ok: true };
  });
}
export async function restore(u: User, envelope: Envelope) {
  const saved = unseal<Room>(envelope);
  if (
    saved.format !== 1 ||
    !saved.game ||
    !supportsRuntime(saved.game.version) ||
    !saved.seats.some((s) => s.id === u.id)
  )
    throw Error(
      "This account cannot restore this save, or its rules version is unavailable",
    );
  return transaction(async (sql) => {
    // Serialize even the first restoration, when no room row exists yet.
    if (process.env.DATABASE_URL)
      await sql.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        saved.code,
      ]);
    const found = await sql.query<{ state: Room }>(
      "SELECT state FROM rooms WHERE code=$1 FOR UPDATE",
      [saved.code],
    );
    const current = found.rows[0]?.state;
    if (current) await hydratePresence(sql, current);
    if (
      current?.game &&
      !current.restoring &&
      current.game.phase !== "finished" &&
      current.seats.some(connected)
    ) {
      return { code: current.code, existing: true };
    }
    if (current?.restoring) return { code: current.code, existing: true };
    const r = structuredClone(
      current?.game && current.game.phase !== "finished" ? current : saved,
    );
    // Reopen the latest authoritative state; an old local copy cannot roll it back.
    r.generation = Math.max(r.generation, current?.generation ?? 0) + 1;
    r.revision = Math.max(r.revision, current?.revision ?? 0) + 1;
    r.restoring = true;
    r.dedupe = {};
    for (const s of r.seats) {
      s.ready = false;
      s.seen = 0;
      s.connection = "";
    }
    r.host = u.id;
    await sql.query(
      "INSERT INTO rooms(code,state,updated) VALUES($1,$2,$3) ON CONFLICT(code) DO UPDATE SET state=$2,updated=$3",
      [r.code, JSON.stringify(r), Date.now()],
    );
    return { code: r.code, existing: false };
  });
}

export async function historyPage(
  code: string,
  u: User,
  connection: string | undefined,
  before?: number,
) {
  const r = await readRoom(await db(), code, false, true);
  authenticateSeat(r, u, connection);
  if (!r.game) throw Error("This table has not started a match");
  return {
    generation: r.generation,
    revision: r.revision,
    ...projectLogPage(r.game.log, u.id, before),
  };
}
