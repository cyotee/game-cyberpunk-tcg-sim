import React, { useEffect, useState, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  cards,
  byId,
  colors,
  type Card,
} from "../../../packages/catalog/index";
import {
  newDeck,
  importDeck,
  exportDeck,
  validateDeck,
  limits,
  type Deck,
  type DeckEntry,
} from "../../../packages/decks/index";
import { api } from "./api";
import { parseSaveFile } from "../../../packages/saves/import";
import { deckStore, saveStore, download, type SavedGame } from "./storage";
import { starters, copyStarter } from "../../../packages/decks/starters";
import "./style.css";

type Page = "tables" | "decks" | "saves" | "room";
function App() {
  const initialCode = location.pathname
    .match(/^\/room\/([A-Fa-f0-9]+)$/)?.[1]
    ?.toUpperCase();
  const [page, setPage] = useState<Page>(
    initialCode
      ? "room"
      : location.pathname === "/decks"
        ? "decks"
        : location.pathname === "/saves"
          ? "saves"
          : "tables",
  );
  const [code, setCode] = useState(initialCode ?? "");
  const [me, setMe] = useState<any>(null);
  const [local, setLocal] = useState(false);
  const [error, setError] = useState("");
  const [decks, setDecks] = useState<Deck[]>([]);
  const [inspect, setInspect] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const cardDialog = useRef<HTMLDialogElement>(null);
  const cardInvoker = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!inspect || !cardDialog.current) return;
    const previous =
      cardInvoker.current ?? (document.activeElement as HTMLElement | null);
    const dialog = cardDialog.current;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, [inspect]);
  const refreshDecks = useCallback(
    async () =>
      setDecks(
        (await deckStore.all()).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      ),
    [],
  );
  const auth = useCallback(async () => {
    try {
      const r = await api("me");
      setMe(r.user);
      setLocal(r.localAuth);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }, []);
  useEffect(() => {
    void auth();
    void refreshDecks();
  }, [auth, refreshDecks]);
  useEffect(() => {
    const changed = () => void refreshDecks();
    window.addEventListener("deck-library-change", changed);
    return () => window.removeEventListener("deck-library-change", changed);
  }, [refreshDecks]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const navigate = (p: Page, c = "") => {
    setPage(p);
    if (c) setCode(c);
    history.pushState(
      {},
      "",
      p === "tables" ? "/" : p === "room" ? "/room/" + (c || code) : "/" + p,
    );
  };
  useEffect(() => {
    const pop = () => {
      const c = location.pathname.match(/^\/room\/([^/]+)/)?.[1];
      setPage(
        c
          ? "room"
          : location.pathname === "/decks"
            ? "decks"
            : location.pathname === "/saves"
              ? "saves"
              : "tables",
      );
      if (c) setCode(c);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const login = () => {
    location.href =
      "/api?route=auth/login&next=" + encodeURIComponent(location.pathname);
  };
  const join = async (c: string) => {
    const r = await api("join", {}, c);
    sessionStorage.setItem("seat:" + c, r.connection);
    navigate("room", c);
  };
  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("tables");
          }}
        >
          <span className="brand-mark">NC</span>
          <span>
            NIGHT CITY <b>TABLES</b>
            <small>CYBERPUNK TRADING CARD GAME</small>
          </span>
        </a>
        <nav>
          {(["tables", "decks", "saves"] as const).map((p) => (
            <button
              key={p}
              className={page === p ? "nav active" : "nav"}
              onClick={() => navigate(p)}
            >
              {p === "tables"
                ? "Find a table"
                : p === "decks"
                  ? "Deck library"
                  : "Saved games"}
            </button>
          ))}
        </nav>
        <div className="account">
          {me ? (
            <>
              <span className="status-dot" />
              <span>{me.name}</span>
              <button
                className="quiet"
                onClick={() =>
                  run(async () => {
                    await api("auth/logout", {});
                    setMe(null);
                  })
                }
              >
                Log out
              </button>
            </>
          ) : (
            <button className="secondary" onClick={login}>
              Continue with Discord ↗
            </button>
          )}
        </div>
      </header>
      {error && (
        <div role="alert" className="error global">
          <span>{error}</span>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      <main
        onClickCapture={(e) => {
          const node = (e.target as HTMLElement).closest<HTMLElement>(
            "button,a[href]",
          );
          if (node) cardInvoker.current = node;
        }}
      >
        {!me && local && (
          <div className="dev-login">
            <span>Local development identity</span>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = new FormData(e.currentTarget).get("name");
                void run(async () => {
                  await api("auth/local", { name });
                  await auth();
                });
              }}
            >
              <input
                name="name"
                aria-label="Local player name"
                placeholder="Player name"
                required
              />
              <button>Enter local session</button>
            </form>
            <small>Disabled on Vercel. Production uses Discord.</small>
          </div>
        )}
        {page === "tables" && (
          <Tables
            me={me}
            decks={decks}
            run={run}
            busy={busy}
            join={join}
            navigate={navigate}
            login={login}
          />
        )}
        {page === "decks" && (
          <DeckBuilder
            decks={decks}
            refresh={refreshDecks}
            run={run}
            inspect={setInspect}
          />
        )}
        {page === "saves" && (
          <Saves me={me} run={run} join={join} login={login} />
        )}
        {page === "room" && (
          <Room
            key={code + ":" + (me?.id ?? "anonymous")}
            code={code}
            me={me}
            decks={decks}
            run={run}
            busy={busy}
            join={join}
            navigate={navigate}
            inspect={setInspect}
            login={login}
          />
        )}
      </main>
      <footer>
        <span>Built for your table. Bring your friends.</span>
        <span>Independent fan project · Playtest build</span>
        <a
          href="https://cyberpunktcg.com/comprehensive-rules"
          target="_blank"
          rel="noreferrer"
        >
          Official rules ↗
        </a>
      </footer>
      {inspect && (
        <dialog
          ref={cardDialog}
          className="modal card-inspect"
          aria-label={inspect.nameFull}
          onKeyDown={(e) => {
            if (e.key !== "Tab") return;
            const nodes = [
              ...e.currentTarget.querySelectorAll<HTMLElement>(
                'button:not([disabled]),a[href],[tabindex="0"]',
              ),
            ];
            if (!nodes.length) return;
            e.preventDefault();
            const index = nodes.indexOf(document.activeElement as HTMLElement);
            nodes[
              (index + (e.shiftKey ? -1 : 1) + nodes.length) % nodes.length
            ]?.focus();
          }}
          onCancel={(e) => {
            e.preventDefault();
            setInspect(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              const r = e.currentTarget.getBoundingClientRect();
              if (
                e.clientX < r.left ||
                e.clientX > r.right ||
                e.clientY < r.top ||
                e.clientY > r.bottom
              )
                setInspect(null);
            }
          }}
        >
          <button className="close" onClick={() => setInspect(null)}>
            Close ✕
          </button>
          <img
            className="official-card-image"
            src={inspect.image}
            alt={inspect.nameFull + " official card rendering"}
          />
          <div>
            <span className="eyebrow">CARD REFERENCE</span>
            <h2>{inspect.nameFull}</h2>
            <p>
              {inspect.type} · {inspect.color} · {inspect.tags.join(" / ")}
            </p>
            {inspect.gearText ? (
              <>
                <p>{inspect.gearText.reminder}</p>
                {inspect.gearText.intrinsic && (
                  <p className="rules-text">
                    <b>Gear ability: </b>
                    {inspect.gearText.intrinsic}
                  </p>
                )}
                {inspect.gearText.inherited && (
                  <p className="rules-text">
                    <b>Equipped Unit / Legend: </b>
                    {inspect.gearText.inherited}
                  </p>
                )}
              </>
            ) : (
              <p className="rules-text">
                {inspect.text || "No printed abilities."}
              </p>
            )}
            <p>
              Cost {inspect.cost ?? "—"} · Power {inspect.power ?? "—"} · RAM{" "}
              {inspect.ram ?? "—"} {inspect.color}
            </p>
            <a href={inspect.source} target="_blank" rel="noreferrer">
              View official card ↗
            </a>
          </div>
        </dialog>
      )}
    </>
  );
}
function CardTile({
  c,
  large = false,
  onClick,
  quantity,
}: {
  c: Card;
  large?: boolean;
  onClick?: () => void;
  quantity?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={"card-tile " + c.color.toLowerCase() + (large ? " large" : "")}
    >
      <div className="card-top">
        <span>{c.type.toUpperCase()}</span>
        <b>
          {c.cost ?? "—"} <small>€$</small>
        </b>
      </div>
      <div className="card-art">
        <span>
          {c.type === "Legend"
            ? "✦"
            : c.type === "Program"
              ? "⌘"
              : c.type === "Gear"
                ? "◇"
                : "⌁"}
        </span>
        <small>{c.tags[0] ?? "NIGHT CITY"}</small>
      </div>
      <div className="card-name">
        {c.name}
        <small>{c.subtitle || c.type}</small>
      </div>
      <p>
        {c.text.replace(/\([^)]*\)/g, "").slice(0, large ? 2000 : 190) ||
          "No printed abilities."}
      </p>
      <div className="card-bottom">
        <span>{c.ram ?? "—"} RAM</span>
        <span>
          {c.power !== null
            ? c.power + " PWR"
            : c.sell
              ? "SELLABLE"
              : "PROGRAM"}
        </span>
      </div>
      {quantity !== undefined && <span className="quantity">×{quantity}</span>}
    </button>
  );
}
function Tables({ me, run, busy, join, navigate, login }: any) {
  const [tables, setTables] = useState<any[]>([]),
    [create, setCreate] = useState(false),
    [filter, setFilter] = useState("all"),
    [capacity, setCapacity] = useState("all"),
    [available, setAvailable] = useState(false),
    [joinCode, setJoinCode] = useState("");
  const refresh = useCallback(async () => {
    try {
      setTables((await api("tables")).tables);
    } catch {}
  }, []);
  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);
  const shown = tables.filter(
    (t) =>
      (filter === "all" || t.status === filter) &&
      (capacity === "all" || t.capacity === Number(capacity)) &&
      (!available || t.available),
  );
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">
            <span className="status-dot" /> THE CITY IS OPEN
          </span>
          <h1>
            Your crew.
            <br />
            Same table.
          </h1>
          <p>
            Play Cyberpunk TCG together, wherever you are.
            <br />
            Find a free-for-all or make a table for your friends.
          </p>
          <div className="hero-actions">
            <button
              className="primary"
              onClick={() => (me ? setCreate(true) : login())}
            >
              ＋ Create a table
            </button>
            <span>2–5 players · All cards available</span>
          </div>
        </div>
        <div className="hero-board" aria-hidden="true">
          <div className="gig-die d20">
            20<small>STREET CRED</small>
          </div>
          <div className="mini-deck">
            <span>✦</span>
            <b>PLAY YOUR HAND</b>
            <small>MAKE YOUR NAME</small>
          </div>
          <div className="gig-die d6">6</div>
          <div className="hero-label">NO DISTANCE BETWEEN CHOOMS.</div>
        </div>
      </section>
      <section className="section-heading">
        <div>
          <span className="eyebrow">PUBLIC TABLES</span>
          <h2>
            Find your next match <span className="count">{tables.length}</span>
          </h2>
        </div>
        <form
          className="join-code"
          onSubmit={(e) => {
            e.preventDefault();
            const c = joinCode.trim().split("/").at(-1)?.toUpperCase();
            if (c) void run(() => join(c));
          }}
        >
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Invitation code or room URL"
            aria-label="Invitation code or room URL"
          />
          <button disabled={!me || busy}>Join →</button>
        </form>
      </section>
      <div className="filters">
        <label>
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />{" "}
          Available seats only
        </label>
        <select
          aria-label="Filter by status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="lobby">In lobby</option>
          <option value="in-progress">In progress</option>
        </select>
        <select
          aria-label="Filter by capacity"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        >
          <option value="all">All table sizes</option>
          {[2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} seats
            </option>
          ))}
        </select>
        <button className="quiet" onClick={refresh}>
          ↻ Refresh
        </button>
      </div>
      <div className="table-list">
        <div className="table-row table-header">
          <span>TABLE / HOST</span>
          <span>SEATS</span>
          <span>STATUS</span>
          <span />
        </div>
        {shown.length ? (
          shown.map((t) => (
            <div className="table-row" key={t.code}>
              <div>
                <strong>{t.name}</strong>
                <small>Hosted by {t.host}</small>
              </div>
              <span className="seats-visual">
                {Array.from({ length: t.capacity }, (_, i) => (
                  <i key={i} className={i < t.occupied ? "filled" : ""} />
                ))}
                <small>
                  {t.occupied} / {t.capacity}
                </small>
              </span>
              <span
                className={"badge " + (t.status === "lobby" ? "green" : "")}
              >
                {t.status === "lobby" ? "In lobby" : "In progress"}
              </span>
              <button
                className="secondary"
                disabled={!t.available || busy}
                onClick={() => (me ? run(() => join(t.code)) : login())}
              >
                {t.available ? "Join table →" : "Match started"}
              </button>
            </div>
          ))
        ) : (
          <div className="empty">
            <span>⌁</span>
            <h3>No tables yet</h3>
            <p>
              The next match starts with you. Create a table and invite your
              crew.
            </p>
            <button
              className="secondary"
              onClick={() => (me ? setCreate(true) : login())}
            >
              Create the first table
            </button>
          </div>
        )}
      </div>
      <div className="bottom-cards">
        <button onClick={() => navigate("decks")}>
          <span>01 / PREPARE</span>
          <h3>Build your deck ↗</h3>
          <p>
            Browse the full catalog. Import your list or start from scratch.
          </p>
        </button>
        <button onClick={() => navigate("saves")}>
          <span>02 / PICK UP WHERE YOU LEFT OFF</span>
          <h3>Resume a saved match ↗</h3>
          <p>Your table, preserved. Bring everyone back when you’re ready.</p>
        </button>
      </div>
      {create && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void run(async () => {
                const r = await api("tables", {
                  name: data.get("name"),
                  capacity: Number(data.get("capacity")),
                  private: data.get("private") === "on",
                  targetMode: data.get("targetMode"),
                  customTarget: Number(data.get("customTarget")),
                });
                sessionStorage.setItem("seat:" + r.code, r.connection);
                setCreate(false);
                navigate("room", r.code);
              });
            }}
          >
            <button
              type="button"
              className="close"
              onClick={() => setCreate(false)}
            >
              Close ✕
            </button>
            <span className="eyebrow">YOUR TABLE, YOUR CREW</span>
            <h2>Create a table</h2>
            <label>
              Table name
              <input
                name="name"
                defaultValue="Night City regulars"
                maxLength={80}
                required
                autoFocus
              />
            </label>
            <label>
              Maximum seats
              <select name="capacity" defaultValue="5">
                {[2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" name="private" /> Unlisted — invitation URL
              / code only
            </label>
            <label>
              Gigs required to win
              <select name="targetMode" defaultValue="majority">
                <option value="majority">
                  Majority — updates as players join
                </option>
                <option value="seven">Rules-as-written: 7</option>
                <option value="custom">Custom target</option>
              </select>
            </label>
            <label>
              Custom target
              <input
                name="customTarget"
                type="number"
                min="1"
                defaultValue="7"
                required
              />
            </label>
            <p className="muted">
              The target locks when the match starts. All seated players must be
              ready.
            </p>
            <button className="primary" disabled={busy}>
              Create table →
            </button>
          </form>
        </div>
      )}
    </>
  );
}
function DeckBuilder({ decks, refresh, run, inspect }: any) {
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null),
    [query, setQuery] = useState(""),
    [type, setType] = useState(""),
    [color, setColor] = useState(""),
    [maxCost, setMaxCost] = useState(""),
    [tagFilter, setTagFilter] = useState(""),
    [setFilter, setSetFilter] = useState(""),
    [text, setText] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const tags = [...new Set(cards.flatMap((c) => c.tags))].sort();
  const sets = [
    ...new Map(
      cards.flatMap((c) => c.printings.map((p) => [p.set, p.setName] as const)),
    ).entries(),
  ];
  const filtered = cards.filter(
    (c) =>
      (!query ||
        (c.nameFull + " " + c.text)
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!type || c.type === type) &&
      (!color || c.color === color) &&
      (!maxCost || c.cost === Number(maxCost)) &&
      (!tagFilter || c.tags.includes(tagFilter)) &&
      (!setFilter || c.printings.some((p) => p.set === setFilter)),
  );
  const save = async (d: Deck) => {
    d = { ...d, updatedAt: new Date().toISOString() };
    await deckStore.put(d);
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (
        key?.startsWith("selected-deck:") &&
        sessionStorage.getItem(key) === d.id
      ) {
        const code = key.slice("selected-deck:".length);
        try {
          await api("deck", d, code);
        } catch (e) {
          if (e instanceof Error && e.message.includes("locked"))
            sessionStorage.removeItem(key);
          else throw e;
        }
      }
    }
    setSelectedDeck(d);
    await refresh();
  };
  const add = (c: Card, delta: number) => {
    if (!selectedDeck) return;
    const d = structuredClone(selectedDeck),
      section = c.type === "Legend" ? "legends" : "main",
      entry = d[section].find((e) => e.cardId === c.id);
    if (entry) entry.quantity += delta;
    else if (delta > 0) d[section].push({ cardId: c.id, quantity: 1 });
    d[section] = d[section].filter((e) => e.quantity > 0);
    void run(() => save(d));
  };
  const errors = selectedDeck ? validateDeck(selectedDeck) : [];
  return (
    <>
      <div className="section-heading page-heading">
        <div>
          <span className="eyebrow">YOUR BROWSER · YOUR DECKS</span>
          <h1>Deck library</h1>
          <p>No account needed. Every card is yours to build with.</p>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={() => setText("")}>
            Import text
          </button>
          <button
            className="primary"
            onClick={() => run(() => save(newDeck()))}
          >
            ＋ New deck
          </button>
        </div>
      </div>
      <div className="deck-layout">
        <aside className="deck-sidebar">
          <h3>
            Your decks <span className="count">{decks.length}</span>
          </h3>
          {decks.map((d: Deck) => (
            <button
              key={d.id}
              className={
                "deck-choice " + (selectedDeck?.id === d.id ? "selected" : "")
              }
              onClick={() => setSelectedDeck(d)}
            >
              <b>{d.name}</b>
              <small>
                {d.main.reduce((n, e) => n + e.quantity, 0)} cards ·{" "}
                {validateDeck(d).length ? "Draft" : "Legal"}
              </small>
            </button>
          ))}
          {!decks.length && (
            <p className="muted">Start a deck or import a list.</p>
          )}
          <hr />
          <span className="eyebrow">QUICK START</span>
          {starters.map((starter, index) => (
            <button
              key={starter.name}
              className="deck-choice"
              onClick={() => run(() => save(copyStarter(index)))}
            >
              <b>{starter.name}</b>
              <small>Copy official starter deck</small>
            </button>
          ))}
          <p className="fine-print">
            Decks are saved on this browser. Export a text copy to take them
            elsewhere.
          </p>
        </aside>
        <section>
          <div className="catalog-filters">
            <input
              placeholder="Search names and rules text…"
              aria-label="Search names and rules text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Card type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">All types</option>
              {["Legend", "Unit", "Gear", "Program"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              aria-label="Card color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            >
              <option value="">All colors</option>
              {colors.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              aria-label="Card cost"
              value={maxCost}
              onChange={(e) => setMaxCost(e.target.value)}
            >
              <option value="">All costs</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
            <select
              aria-label="Card tag"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              aria-label="Card set"
              value={setFilter}
              onChange={(e) => setSetFilter(e.target.value)}
            >
              <option value="">All sets</option>
              {sets.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="catalog-summary">
            <span>{filtered.length} cards</span>
            <span>Click a card to inspect · ＋ to add</span>
          </div>
          <div className="catalog-grid">
            {filtered.map((c) => (
              <div key={c.id}>
                <CardTile c={c} onClick={() => inspect(c)} />
                <button
                  className="add-card"
                  disabled={!selectedDeck}
                  onClick={() => add(c, 1)}
                >
                  ＋ Add to deck
                </button>
              </div>
            ))}
          </div>
        </section>
        <aside className="deck-editor">
          {selectedDeck ? (
            <>
              <input
                className="deck-title"
                aria-label="Deck name"
                value={selectedDeck.name}
                onChange={(e) => {
                  const d = { ...selectedDeck, name: e.target.value };
                  setSelectedDeck(d);
                  void run(() => save(d));
                }}
              />
              <div className="ram-row">
                {Object.entries(limits(selectedDeck)).map(([c, n]) => (
                  <span className={c.toLowerCase()} key={c}>
                    {n} {c}
                  </span>
                ))}
              </div>
              <div
                className={
                  "validation " + (errors.length ? "invalid" : "valid")
                }
              >
                {errors.length
                  ? `${errors.length} legality issue(s)`
                  : "✓ Legal deck"}
                {errors.length > 0 && (
                  <ul>
                    {errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
              {(["legends", "main"] as const).map((section) => (
                <div key={section}>
                  <h3>
                    {section === "legends" ? "Legends" : "Main deck"}{" "}
                    <span className="count">
                      {selectedDeck[section].reduce(
                        (n, e) => n + e.quantity,
                        0,
                      )}
                    </span>
                  </h3>
                  {selectedDeck[section].map((e) => (
                    <div className="deck-entry" key={e.cardId}>
                      <button onClick={() => inspect(byId[e.cardId])}>
                        {byId[e.cardId]?.nameFull ?? e.cardId}
                      </button>
                      <div>
                        <button
                          aria-label={"Remove " + e.cardId}
                          onClick={() => add(byId[e.cardId], -1)}
                        >
                          −
                        </button>
                        <b>{e.quantity}</b>
                        <button
                          aria-label={"Add " + e.cardId}
                          onClick={() => add(byId[e.cardId], 1)}
                        >
                          ＋
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div className="button-row wrap">
                <button
                  className="secondary"
                  onClick={() =>
                    download(
                      selectedDeck.name + ".txt",
                      exportDeck(selectedDeck),
                    )
                  }
                >
                  Export text
                </button>
                <button
                  className="secondary"
                  onClick={() => setText(exportDeck(selectedDeck))}
                >
                  Edit text
                </button>
                <button
                  className="quiet"
                  onClick={() =>
                    run(() =>
                      save({
                        ...structuredClone(selectedDeck),
                        id: crypto.randomUUID(),
                        name: selectedDeck.name + " copy",
                      }),
                    )
                  }
                >
                  Duplicate
                </button>
                <button
                  className="danger"
                  onClick={() =>
                    run(async () => {
                      await deckStore.delete(selectedDeck.id);
                      setSelectedDeck(null);
                      await refresh();
                    })
                  }
                >
                  Delete deck
                </button>
              </div>
              <small className="muted">
                Changes save automatically in this browser.
              </small>
            </>
          ) : (
            <div className="empty">
              <h3>Build something yours</h3>
              <p>Create or select a deck to start adding cards.</p>
            </div>
          )}
        </aside>
      </div>
      {text !== null && (
        <div className="modal-backdrop">
          <section className="modal wide">
            <button className="close" onClick={() => setText(null)}>
              Close ✕
            </button>
            <h2>Import or edit deck text</h2>
            <p>
              Use # Name, # Legends, and # Main Deck sections. Invalid lines
              remain editable.
            </p>
            <label className="file-picker">
              Import a text file
              <input
                type="file"
                accept=".txt,text/plain"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void f.text().then(setText);
                }}
              />
            </label>
            <textarea
              aria-label="Deck text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={16}
              placeholder="# Name: My deck&#10;&#10;# Legends&#10;1x 001 Viktor Vektor — Sit Down and Relax&#10;&#10;# Main Deck"
            />
            <button
              className="primary"
              onClick={() =>
                run(async () => {
                  const d = importDeck(text);
                  if (selectedDeck) d.id = selectedDeck.id;
                  await save(d);
                  setText(null);
                  setNotice(
                    "Deck imported. Any errors are shown beside your list.",
                  );
                })
              }
            >
              Save editable deck
            </button>
          </section>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </>
  );
}
function Saves({ me, run, join, login }: any) {
  const [saves, setSaves] = useState<SavedGame[]>([]);
  const refresh = async () =>
    setSaves(
      (await saveStore.all()).sort((a, b) =>
        b.savedAt.localeCompare(a.savedAt),
      ),
    );
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <>
      <div className="section-heading page-heading">
        <div>
          <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
          <h1>Saved games</h1>
          <p>
            Protected snapshots in this browser. Export a copy to move it to
            another device.
          </p>
        </div>
        <label className="file-picker secondary">
          Import saved game
          <input
            type="file"
            accept=".json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f)
                void run(async () => {
                  if (f.size > 20000000) throw Error("Save file too large");
                  const value = parseSaveFile(await f.text());
                  await saveStore.put({
                    ...value,
                    id: crypto.randomUUID(),
                    kind: "manual",
                  });
                  await refresh();
                });
            }}
          />
        </label>
      </div>
      {!saves.length ? (
        <div className="empty panel">
          <span>◇</span>
          <h3>Your next session starts here</h3>
          <p>
            Matches autosave as you play. Manual snapshots appear separately.
          </p>
        </div>
      ) : (
        <div className="save-grid">
          {saves.map((s) => (
            <article className="panel" key={s.id}>
              <span className="badge">
                {s.kind === "auto" ? "Rolling autosave" : "Manual snapshot"}
              </span>
              <h2>{s.name}</h2>
              <p>
                {new Date(s.savedAt).toLocaleString()}
                <br />
                Revision {s.revision} · {s.code}
              </p>
              <div className="button-row wrap">
                <button
                  className="primary"
                  onClick={() =>
                    me
                      ? run(async () => {
                          const r = await api("restore", {
                            envelope: s.envelope,
                          });
                          await join(r.code);
                        })
                      : login()
                  }
                >
                  Resume →
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    download(
                      s.name + "-" + s.revision + ".json",
                      JSON.stringify(s),
                      "application/json",
                    )
                  }
                >
                  Export
                </button>
                <button
                  className="quiet"
                  onClick={() =>
                    run(async () => {
                      await saveStore.delete(s.id);
                      await refresh();
                    })
                  }
                >
                  Delete local copy
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
function Room({
  code,
  me,
  decks,
  run,
  busy,
  join,
  navigate,
  inspect,
  login,
}: any) {
  const signature = useRef("");
  const [room, setRoom] = useState<any>(null),
    [roomError, setRoomError] = useState(""),
    [historyPage, setHistoryPage] = useState<any>(null),
    [choiceValues, setChoiceValues] = useState<string[]>([]),
    [attackSource, setAttackSource] = useState(""),
    [saveStatus, setSaveStatus] = useState(""),
    [saveFailure, setSaveFailure] = useState(""),
    [saveAttempt, setSaveAttempt] = useState(0),
    [lastSave, setLastSave] = useState(-1),
    [blocks, setBlocks] = useState<any[] | null>(null);
  const refresh = useCallback(async () => {
    if (!me || !sessionStorage.getItem("seat:" + code)) return;
    try {
      const result = await api("room", undefined, code, {
        since: signature.current,
        presence: "1",
      });
      signature.current = result.signature ?? "";
      if (!result.unchanged)
        setRoom((previous: any) => {
          if (result.presenceOnly) {
            if (
              previous?.code !== result.code ||
              previous?.generation !== result.generation ||
              previous?.revision !== result.revision
            ) {
              signature.current = "";
              return previous;
            }
            return {
              ...previous,
              signature: result.signature,
              waitingFor: result.waitingFor,
              seats: previous.seats.map((s: any) => ({
                ...s,
                connected:
                  result.seats.find((p: any) => p.id === s.id)?.connected ??
                  s.connected,
              })),
            };
          }
          return previous &&
            (previous.generation > result.generation ||
              (previous.generation === result.generation &&
                previous.revision > result.revision))
            ? previous
            : result;
        });
      setRoomError("");
    } catch (e) {
      setRoomError(e instanceof Error ? e.message : String(e));
    }
  }, [code, me]);
  useEffect(() => {
    setRoom(null);
    signature.current = "";
    void refresh();
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [refresh]);
  useEffect(() => {
    setHistoryPage(null);
  }, [room?.generation]);
  useEffect(() => {
    setChoiceValues([]);
  }, [room?.game?.choice?.id]);
  useEffect(() => {
    if (!room?.game || room.revision === lastSave || roomError) return;
    let cancelled = false;
    const save = async () => {
      try {
        const s = await api("checkpoint", {}, code);
        await saveStore.put({ ...s, id: "auto:" + code, kind: "auto" });
        if (!cancelled) {
          setLastSave(s.revision);
          setSaveFailure("");
          setSaveStatus("Autosaved · " + new Date().toLocaleTimeString());
        }
      } catch (e) {
        if (!cancelled) {
          setSaveFailure(e instanceof Error ? e.message : String(e));
          setSaveStatus("Autosave failed");
        }
      }
    };
    void save();
    return () => {
      cancelled = true;
    };
  }, [room?.revision, code, lastSave, roomError, saveAttempt]);
  useEffect(() => {
    const changed = async (event: Event) => {
      const { id, deleted } = (event as CustomEvent).detail;
      if (sessionStorage.getItem("selected-deck:" + code) !== id || room?.game)
        return;
      try {
        const d = deleted
          ? null
          : (await deckStore.all()).find((d) => d.id === id);
        setRoom(await api("deck", d ?? null, code));
      } catch (e) {
        setRoomError(e instanceof Error ? e.message : String(e));
      }
    };
    window.addEventListener("deck-library-change", changed);
    return () => window.removeEventListener("deck-library-change", changed);
  }, [code, !!room?.game]);
  const act = async (command: any) => {
    const result = await api(
      "action",
      {
        commandId: crypto.randomUUID(),
        revision: room.revision,
        generation: room.generation,
        command,
      },
      code,
    );
    setRoom(result);
    setAttackSource("");
  };
  if (!me)
    return (
      <div className="empty panel page-heading">
        <h1>Your table is waiting</h1>
        <p>
          Sign in with Discord to join room {code} or reclaim your existing
          seat.
        </p>
        <button className="primary" onClick={login}>
          Continue with Discord
        </button>
      </div>
    );
  if (!room || roomError)
    return (
      <div className="empty panel page-heading">
        <h2>{roomError ? "Reconnect to your table" : "Join the table"}</h2>
        <p>
          {roomError || "This invitation connects you to room " + code + "."}
        </p>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await join(code);
              await refresh();
            })
          }
        >
          Join / reclaim seat →
        </button>
      </div>
    );
  const host = room.host === me.id,
    g = room.game,
    tableCards = g?.cardData ?? byId,
    ownSeat = room.seats.find((s: any) => s.id === me.id),
    canStart =
      room.seats.length >= 2 &&
      room.seats
        .filter(
          (s: any) => !g?.players.find((p: any) => p.id === s.id)?.eliminated,
        )
        .every((s: any) => s.ready && s.connected);
  const equipment = (piece: any, mine: boolean) => (
    <div className="gear-tags">
      {g.pieces
        .filter((gear: any) => gear.host === piece.id)
        .map((gear: any) => (
          <span key={gear.id}>
            <button onClick={() => inspect(tableCards[gear.cardId])}>
              ◇ {tableCards[gear.cardId].name}
            </button>
            {mine &&
              piece.ready &&
              piece.faceUp &&
              (piece.zone === "legends" || piece.entered !== g.turn) &&
              tableCards[gear.cardId].text.includes("{Spend}") &&
              (g.legal.active ||
                (g.legal.reaction &&
                  tableCards[gear.cardId].text.includes("{Quick}"))) && (
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      act({
                        type: "activate",
                        piece: piece.id,
                        ability: gear.id,
                      }),
                    )
                  }
                >
                  Use {tableCards[gear.cardId].name}
                </button>
              )}
          </span>
        ))}
    </div>
  );
  return (
    <>
      <div className="room-heading">
        <div>
          <span className="eyebrow">
            {room.private ? "UNLISTED TABLE" : "PUBLIC TABLE"} ·{" "}
            {room.seats.length}/{room.capacity} SEATS
          </span>
          <h1>{room.name}</h1>
        </div>
        <div className="button-row">
          <button
            className="secondary"
            onClick={() =>
              run(async () => {
                await navigator.clipboard.writeText(
                  location.origin + "/room/" + code,
                );
                setSaveStatus("Invitation link copied");
              })
            }
          >
            Copy invite · {code}
          </button>
          {g && (
            <button
              className="secondary"
              onClick={() =>
                run(async () => {
                  const s = await api("checkpoint", {}, code);
                  await saveStore.put({
                    ...s,
                    id: crypto.randomUUID(),
                    kind: "manual",
                  });
                  setSaveStatus("Manual snapshot saved. Play continues.");
                })
              }
            >
              Save snapshot
            </button>
          )}
          {g && (
            <button
              className="secondary"
              onClick={() =>
                run(async () => {
                  const snapshot = await api("checkpoint", {}, code);
                  download(
                    room.name + ".cyberpunk.json",
                    JSON.stringify(snapshot, null, 2),
                    "application/json",
                  );
                  setSaveStatus("Export download started. Play continues.");
                })
              }
            >
              Export current game
            </button>
          )}
          <button
            className="quiet"
            onClick={() =>
              run(async () => {
                await api("leave", {}, code);
                navigate("tables");
              })
            }
          >
            {g ? "Leave / disconnect" : "Leave table"}
          </button>
        </div>
      </div>
      {g && saveFailure && (
        <div className="panel" role="alert">
          <p>
            This browser could not save the game: {saveFailure}. Export the
            current game to keep a file copy, or free browser storage and retry.
          </p>
          <button onClick={() => setSaveAttempt((n) => n + 1)}>
            Retry autosave
          </button>
        </div>
      )}
      {ownSeat?.deckError && (
        <p role="alert" className="error">
          {ownSeat.deckError}
        </p>
      )}
      {!g || room.restoring ? (
        <div className="lobby-layout">
          <section className="panel">
            <span className="eyebrow">
              {room.restoring ? "RESUME CHECK" : "READY CHECK"}
            </span>
            <h2>
              {room.restoring
                ? "Bring the crew back"
                : "Get your crew together"}
            </h2>
            <p>
              {room.restoring
                ? "All non-eliminated players must reconnect and be ready."
                : "Choose a legal deck, then mark yourself ready. The host can start with 2–5 players."}
            </p>
            <div className="lobby-seats">
              {room.seats.map((s: any, i: number) => (
                <div className="lobby-seat" key={s.id}>
                  <span className="seat-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>
                      {s.name} {s.id === me.id && <small>(you)</small>}
                    </strong>
                    <small>
                      {s.id === room.host ? "Host · " : ""}
                      {s.connected ? "Connected" : "Disconnected"}
                      {s.deckName ? " · " + s.deckName : ""}
                    </small>
                  </div>
                  <span className={"badge " + (s.ready ? "green" : "")}>
                    {s.ready
                      ? "Ready"
                      : s.deckLegal || room.restoring
                        ? "Choosing readiness"
                        : "Needs legal deck"}
                  </span>
                  {host && s.id !== me.id && !g && (
                    <button
                      className="quiet danger"
                      onClick={() =>
                        run(() => act({ type: "kick", target: s.id }))
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {Array.from(
                { length: room.capacity - room.seats.length },
                (_, i) => (
                  <div className="lobby-seat vacant" key={i}>
                    <span className="seat-number">＋</span>
                    <span>Waiting for a player</span>
                  </div>
                ),
              )}
            </div>
            {!g && (
              <label>
                Your deck
                <select
                  value={
                    decks.find((d: Deck) => d.name === ownSeat?.deckName)?.id ??
                    ""
                  }
                  onChange={(e) =>
                    run(async () => {
                      const d = decks.find(
                        (d: Deck) => d.id === e.target.value,
                      );
                      if (d) {
                        setRoom(await api("deck", d, code));
                        sessionStorage.setItem("selected-deck:" + code, d.id);
                      }
                    })
                  }
                >
                  <option value="">Select from your browser library</option>
                  {decks.map((d: Deck) => (
                    <option value={d.id} key={d.id}>
                      {d.name}
                      {validateDeck(d).length ? " — invalid draft" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="button-row">
              <button
                className={ownSeat?.ready ? "secondary" : "primary"}
                disabled={busy || (!room.restoring && !ownSeat?.deckLegal)}
                onClick={() => run(() => act({ type: "ready" }))}
              >
                {ownSeat?.ready ? "Not ready" : "I’m ready"}
              </button>
              {host && (
                <button
                  className="primary"
                  disabled={busy || !canStart}
                  onClick={() => run(() => act({ type: "start" }))}
                >
                  {room.restoring ? "Resume match →" : "Start match →"}
                </button>
              )}
              <button className="quiet" onClick={() => navigate("decks")}>
                Edit deck library ↗
              </button>
            </div>
          </section>
          <aside className="panel">
            <span className="eyebrow">TABLE RULES</span>
            <h2>Free-for-all</h2>
            <div className="target-number">
              {g?.target ?? room.target}
              <small>GIGS TO WIN</small>
            </div>
            <p>
              {room.targetMode === "majority"
                ? "Majority of the starting dice supply."
                : "Host-selected target."}{" "}
              Locked at match start.
            </p>
            {host && !g && (
              <>
                <label>
                  Target mode
                  <select
                    value={room.targetMode}
                    onChange={(e) =>
                      run(async () =>
                        setRoom(
                          await api(
                            "settings",
                            {
                              targetMode: e.target.value,
                              customTarget: room.customTarget,
                            },
                            code,
                          ),
                        ),
                      )
                    }
                  >
                    <option value="majority">Majority (automatic)</option>
                    <option value="seven">Rules-as-written: 7</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                {room.targetMode === "custom" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const n = Number(
                        new FormData(e.currentTarget).get("target"),
                      );
                      void run(async () =>
                        setRoom(
                          await api(
                            "settings",
                            { targetMode: "custom", customTarget: n },
                            code,
                          ),
                        ),
                      );
                    }}
                  >
                    <label>
                      Required Gigs
                      <input
                        type="number"
                        min="1"
                        name="target"
                        defaultValue={room.customTarget}
                      />
                    </label>
                    <button className="secondary">Set target</button>
                  </form>
                )}
                <button
                  className="quiet"
                  onClick={() =>
                    run(async () =>
                      setRoom(
                        await api(
                          "settings",
                          { targetMode: "seven", customTarget: 7 },
                          code,
                        ),
                      ),
                    )
                  }
                >
                  Set rules-as-written value: 7
                </button>
              </>
            )}
            {room.target > 6 * room.seats.length && (
              <p className="warning">
                This target exceeds the starting dice supply. Elimination can
                still end the match.
              </p>
            )}
            <hr />
            <p className="muted">
              Only the defending player reacts. No new players join after the
              match starts. Disconnecting never forfeits your seat.
            </p>
            <button
              className="quiet"
              onClick={() =>
                run(async () => setBlocks((await api("blocks")).blocks))
              }
            >
              Manage my host block list
            </button>
          </aside>
        </div>
      ) : (
        <>
          <div className="match-status">
            <div>
              <span className="eyebrow">
                TURN {g.turn} · {g.phase.toUpperCase()}
              </span>
              <strong>
                {g.winner
                  ? `${g.players.find((p: any) => p.id === g.winner)?.name} wins`
                  : g.draw
                    ? "Match drawn"
                    : g.sudden
                      ? "Sudden Death"
                      : g.overtime
                        ? "Overtime"
                        : `${g.players.find((p: any) => p.id === g.turnPlayer)?.name}’s turn`}
              </strong>
            </div>
            <span>
              Target <b>{g.target} Gigs</b>
            </span>
            <span className="muted" role="status">
              {saveStatus || "Saving…"}
            </span>
          </div>
          {room.waitingFor && (
            <div className="warning" role="status">
              Waiting for {room.waitingFor}. Their input is required. You may
              save a snapshot and return later.
            </div>
          )}
          <div className="game-layout">
            <section className="game-main">
              <div className="player-grid">
                {g.players.map((p: any) => {
                  const mine = p.id === me.id,
                    ps = g.pieces.filter(
                      (x: any) => x.controller === p.id && !x.host,
                    ),
                    ds = g.gigs.filter((d: any) => d.controller === p.id),
                    targets = g.legal.attackTargets[attackSource] ?? [];
                  return (
                    <section
                      key={p.id}
                      className={
                        "player-board " +
                        (mine ? "mine " : "") +
                        (p.id === g.turnPlayer ? "current" : "")
                      }
                    >
                      <div className="player-title">
                        <span className={"avatar " + (mine ? "self" : "")}>
                          {p.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <strong>
                            {p.name}
                            {mine ? " · You" : ""}
                          </strong>
                          <small>
                            {p.eliminated
                              ? "Eliminated"
                              : g.sudden && !g.sudden.eligible.includes(p.id)
                                ? "Reactions only · Still eligible to win"
                                : room.seats.find((s: any) => s.id === p.id)
                                      ?.connected
                                  ? "Connected"
                                  : "Disconnected"}
                          </small>
                        </div>
                        <div className="street-cred">
                          <b>{p.streetCred ?? "—"}</b>
                          <small>STREET CRED</small>
                        </div>
                      </div>
                      <div className="gig-area">
                        <span className="zone-label">
                          GIGS <b>{ds.length}</b>
                        </span>
                        {ds.map((d: any) => (
                          <div className="board-die" key={d.id}>
                            <b>{d.value}</b>
                            <small>d{d.sides}</small>
                          </div>
                        ))}
                        {!ds.length && (
                          <span className="muted">No rolled Gigs</span>
                        )}
                        {targets.includes(p.id) && (
                          <button
                            className="primary"
                            onClick={() =>
                              run(() =>
                                act({
                                  type: "attack",
                                  piece: attackSource,
                                  target: p.id,
                                }),
                              )
                            }
                          >
                            Attack Gigs
                          </button>
                        )}
                      </div>
                      <div className="resources-row">
                        <span>
                          DECK <b>{p.deckCount}</b>
                        </span>
                        <span>
                          HAND <b>{p.handCount}</b>
                        </span>
                        <span>
                          EDDIES{" "}
                          <b>
                            {p.eddies.filter((x: any) => x.ready).length}/
                            {p.eddies.length}
                          </b>
                        </span>
                        <span>
                          FIXER{" "}
                          {p.fixer.map((n: number) => "d" + n).join(" · ") ||
                            "Empty"}
                        </span>
                      </div>
                      <div className="legend-row">
                        {ps
                          .filter((x: any) => x.zone === "legends")
                          .map((x: any, i: number) => (
                            <div
                              className={
                                "legend-slot " + (!x.ready ? "spent" : "")
                              }
                              key={x.id}
                            >
                              <button
                                onClick={() =>
                                  x.cardId && inspect(tableCards[x.cardId])
                                }
                              >
                                {x.cardId
                                  ? tableCards[x.cardId].name
                                  : "✦ Legend " + (i + 1)}
                                <small>
                                  {x.faceUp
                                    ? "Face-up"
                                    : x.known
                                      ? "Known location"
                                      : "Face-down"}{" "}
                                  · {x.ready ? "Ready" : "Spent"}
                                </small>
                              </button>
                              {equipment(x, mine)}
                              {mine &&
                                !x.faceUp &&
                                (g.legal.active || g.legal.reaction) && (
                                  <button
                                    disabled={busy || p.called}
                                    onClick={() =>
                                      run(() =>
                                        act({ type: "call", piece: x.id }),
                                      )
                                    }
                                  >
                                    Call · 1 €$
                                  </button>
                                )}
                              {mine &&
                                x.faceUp &&
                                g.legal.active &&
                                tableCards[x.cardId]?.keywords.includes(
                                  "Go Solo",
                                ) && (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      run(() =>
                                        act({ type: "solo", piece: x.id }),
                                      )
                                    }
                                  >
                                    Go Solo · {g.legal.costs[x.id]}
                                  </button>
                                )}
                              {mine &&
                                g.legal.active &&
                                g.legal.legendPlayCosts?.[x.id] !==
                                  undefined && (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      run(() =>
                                        act({ type: "play", piece: x.id }),
                                      )
                                    }
                                  >
                                    Play with Lag ·{" "}
                                    {g.legal.legendPlayCosts[x.id]} €$
                                  </button>
                                )}
                              {mine &&
                                x.faceUp &&
                                x.ready &&
                                tableCards[x.cardId]?.text.includes(
                                  "{Spend}",
                                ) &&
                                (g.legal.active || g.legal.reaction) && (
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      run(() =>
                                        act({ type: "activate", piece: x.id }),
                                      )
                                    }
                                  >
                                    Activate
                                  </button>
                                )}
                            </div>
                          ))}
                      </div>
                      <div className="field-zone">
                        <span className="zone-label">FIELD</span>
                        <div className="field-cards">
                          {ps
                            .filter((x: any) => x.zone === "field")
                            .map((x: any) => (
                              <div
                                className={
                                  "field-piece " +
                                  (!x.ready ? "spent" : "") +
                                  (attackSource === x.id ? " selected" : "")
                                }
                                key={x.id}
                              >
                                <button
                                  onClick={() => inspect(tableCards[x.cardId])}
                                >
                                  <strong>{tableCards[x.cardId].name}</strong>
                                  <small>{tableCards[x.cardId].subtitle}</small>
                                  <b className="power">{x.power} PWR</b>
                                  <small>
                                    {x.ready ? "Ready" : "Spent"}
                                    {x.entered === g.turn ? " · Lag" : ""}
                                  </small>
                                </button>
                                {equipment(x, mine)}
                                {mine &&
                                  g.legal.active &&
                                  (g.legal.attackTargets[x.id]?.length ?? 0) >
                                    0 && (
                                    <button
                                      className="action"
                                      onClick={() =>
                                        setAttackSource(
                                          attackSource === x.id ? "" : x.id,
                                        )
                                      }
                                    >
                                      {attackSource === x.id
                                        ? "Cancel attack"
                                        : "Attack →"}
                                    </button>
                                  )}
                                {targets.includes(x.id) && (
                                  <button
                                    className="primary"
                                    onClick={() =>
                                      run(() =>
                                        act({
                                          type: "attack",
                                          piece: attackSource,
                                          target: x.id,
                                        }),
                                      )
                                    }
                                  >
                                    Attack this Unit
                                  </button>
                                )}
                                {g.legal.blockers?.includes(x.id) && (
                                  <button
                                    onClick={() =>
                                      run(() =>
                                        act({ type: "block", piece: x.id }),
                                      )
                                    }
                                  >
                                    Use Blocker
                                  </button>
                                )}
                                {mine &&
                                  x.ready &&
                                  tableCards[x.cardId].text.includes(
                                    "{Spend}",
                                  ) &&
                                  (g.legal.active || g.legal.reaction) && (
                                    <button
                                      onClick={() =>
                                        run(() =>
                                          act({
                                            type: "activate",
                                            piece: x.id,
                                          }),
                                        )
                                      }
                                    >
                                      Activate
                                    </button>
                                  )}
                              </div>
                            ))}
                        </div>
                      </div>
                      <details>
                        <summary>
                          Trash ·{" "}
                          {ps.filter((x: any) => x.zone === "trash").length}{" "}
                          cards
                        </summary>
                        <div className="trash-list">
                          {ps
                            .filter((x: any) => x.zone === "trash")
                            .map((x: any) => (
                              <button
                                key={x.id}
                                onClick={() => inspect(tableCards[x.cardId])}
                              >
                                {tableCards[x.cardId].nameFull}
                              </button>
                            ))}
                        </div>
                      </details>
                    </section>
                  );
                })}
              </div>
              <section className="hand-area">
                <div className="section-heading">
                  <h3>
                    Your hand{" "}
                    <span className="count">
                      {
                        g.pieces.filter(
                          (p: any) =>
                            p.controller === me.id && p.zone === "hand",
                        ).length
                      }
                    </span>
                  </h3>
                  <span className="muted">Only you can see these cards.</span>
                </div>
                <div className="hand-cards">
                  {g.pieces
                    .filter(
                      (p: any) => p.controller === me.id && p.zone === "hand",
                    )
                    .map((p: any) => (
                      <div key={p.id}>
                        <CardTile
                          c={tableCards[p.cardId]}
                          onClick={() => inspect(tableCards[p.cardId])}
                        />
                        <div className="button-row">
                          {(g.legal.active ||
                            (g.legal.reaction &&
                              tableCards[p.cardId].type === "Program" &&
                              tableCards[p.cardId].text.includes(
                                "{Quick}",
                              ))) && (
                            <button
                              className="primary"
                              disabled={
                                busy ||
                                g.availableResources < g.legal.costs[p.id]
                              }
                              onClick={() =>
                                run(() => act({ type: "play", piece: p.id }))
                              }
                            >
                              Play · {g.legal.costs[p.id]} €$
                            </button>
                          )}
                          {g.legal.active && tableCards[p.cardId].sell && (
                            <button
                              disabled={
                                busy ||
                                g.players.find((x: any) => x.id === me.id).sold
                              }
                              onClick={() =>
                                run(() => act({ type: "sell", piece: p.id }))
                              }
                            >
                              Sell
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            </section>
            <aside className="action-panel">
              <section className="panel">
                <span className="eyebrow">ACTION REQUIRED</span>
                {g.choice ? (
                  <>
                    <h3>
                      {g.choice.player === me.id
                        ? "Your choice"
                        : g.players.find((p: any) => p.id === g.choice.player)
                            ?.name + " is choosing"}
                    </h3>
                    <p>{g.choice.label}</p>
                    {g.choice.player === me.id && g.choice.options && (
                      <>
                        <div className="choice-options">
                          {g.choice.options.map((o: any) => (
                            <label
                              key={o.id}
                              className={
                                "choice-option " +
                                (choiceValues.includes(o.id) ? "selected" : "")
                              }
                            >
                              <input
                                type={g.choice.max === 1 ? "radio" : "checkbox"}
                                name="choice"
                                checked={choiceValues.includes(o.id)}
                                onChange={() =>
                                  setChoiceValues(
                                    g.choice.max === 1
                                      ? [o.id]
                                      : choiceValues.includes(o.id)
                                        ? choiceValues.filter((v) => v !== o.id)
                                        : [...choiceValues, o.id],
                                  )
                                }
                              />
                              <span>{o.label}</span>
                              {o.cardId && (
                                <button
                                  type="button"
                                  className="quiet"
                                  onClick={() => inspect(tableCards[o.cardId])}
                                >
                                  Inspect
                                </button>
                              )}
                            </label>
                          ))}
                        </div>
                        <button
                          className="primary"
                          disabled={
                            busy ||
                            choiceValues.length < g.choice.min ||
                            choiceValues.length > g.choice.max ||
                            (g.choice.allowedCounts &&
                              !g.choice.allowedCounts.includes(
                                choiceValues.length,
                              ))
                          }
                          onClick={() =>
                            run(() =>
                              act({
                                type: "choose",
                                choice: g.choice.id,
                                values: choiceValues,
                              }),
                            )
                          }
                        >
                          {choiceValues.length
                            ? "Confirm selection"
                            : "Skip optional choice"}
                        </button>
                        <small className="muted">
                          Choose{" "}
                          {g.choice.allowedCounts
                            ? g.choice.allowedCounts.join(" or ")
                            : g.choice.min === g.choice.max
                              ? g.choice.min
                              : `${g.choice.min}–${g.choice.max}`}
                          .
                        </small>
                      </>
                    )}
                  </>
                ) : g.legal.reaction ? (
                  <>
                    <h3>You are defending</h3>
                    <p>
                      Call a Legend, use a Blocker, or play a Quick effect. Only
                      you may react.
                    </p>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => run(() => act({ type: "endReaction" }))}
                    >
                      Finish reactions →
                    </button>
                  </>
                ) : g.legal.active ? (
                  <>
                    <h3>Your main phase</h3>
                    <p>
                      Play cards, activate effects, or attack. Spend ready
                      Eddies and Legends to pay.
                    </p>
                    {attackSource && (
                      <p className="warning">
                        Choose a highlighted attack target on the board.
                      </p>
                    )}
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => run(() => act({ type: "endTurn" }))}
                    >
                      End turn →
                    </button>
                  </>
                ) : (
                  <>
                    <h3>
                      {g.winner ? "Match complete" : "Waiting for the table"}
                    </h3>
                    <p>
                      {g.winner
                        ? "Save a snapshot to retain this match."
                        : "You’ll be prompted when your input is required."}
                    </p>
                  </>
                )}
                {!g.winner &&
                  !g.players.find((p: any) => p.id === me.id)?.eliminated && (
                    <details className="concede">
                      <summary>Concede this match</summary>
                      <p>
                        Your cards leave play. Rolled Gigs remain for others to
                        take.
                      </p>
                      <button
                        className="danger"
                        onClick={() => run(() => act({ type: "concede" }))}
                      >
                        Confirm concession
                      </button>
                    </details>
                  )}
              </section>
              <section className="panel game-log">
                <span className="eyebrow">GAME ACTION LOG</span>
                <div className="button-row">
                  {(historyPage?.generation === room.generation
                    ? historyPage.logBefore
                    : g.logBefore) != null && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          const before =
                            historyPage?.generation === room.generation
                              ? historyPage.logBefore
                              : g.logBefore;
                          const page = await api("history", undefined, code, {
                            before: String(before),
                          });
                          setHistoryPage(page);
                        })
                      }
                    >
                      Earlier actions
                    </button>
                  )}
                  {historyPage?.generation === room.generation && (
                    <button onClick={() => setHistoryPage(null)}>
                      Latest actions
                    </button>
                  )}
                </div>
                <div aria-live="polite">
                  {(historyPage?.generation === room.generation
                    ? historyPage.log
                    : g.log
                  )
                    .slice()
                    .reverse()
                    .map((e: any) => (
                      <p key={e.id}>
                        <span>{String(e.id).padStart(3, "0")}</span>
                        {e.text}
                        {e.privateTo && <small>Only you</small>}
                      </p>
                    ))}
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
      {blocks && (
        <div className="modal-backdrop">
          <section className="modal">
            <button className="close" onClick={() => setBlocks(null)}>
              Close ✕
            </button>
            <h2>Your host block list</h2>
            <p>Applies to tables you host, across browsers.</p>
            {blocks.length ? (
              blocks.map((b) => (
                <div className="lobby-seat" key={b.id}>
                  <span>{b.name}</span>
                  <button
                    onClick={() =>
                      run(async () =>
                        setBlocks((await api("blocks", { id: b.id })).blocks),
                      )
                    }
                  >
                    Unblock
                  </button>
                </div>
              ))
            ) : (
              <p>No blocked players.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
