import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { card } from "../../packages/catalog/index";
const origin = process.env.E2E_ORIGIN ?? "http://127.0.0.1:5174";
const fixture = readFileSync(
  "docs/rules-audit/the-heist-import-fixture.txt",
  "utf8",
);
test("anonymous deck import persists and table creation leads to a usable lobby", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your crew. Same table." }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/tables.png", fullPage: true });
  await page.getByRole("button", { name: "Deck library", exact: true }).click();
  await page.getByRole("button", { name: "Import text", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Deck text", exact: true })
    .fill(fixture);
  await page.getByRole("button", { name: "Save editable deck" }).click();
  await expect(page.getByText("✓ Legal deck")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: /The Heist Starter Deck.*40 cards/ })
    .click();
  await expect(page.getByText("✓ Legal deck")).toBeVisible();
  const tile = page.locator(".card-tile").first();
  await tile.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect
    .poll(() =>
      dialog
        .locator("img")
        .evaluate(
          (node: HTMLImageElement) => node.complete && node.naturalWidth > 0,
        ),
    )
    .toBe(true);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(tile).toBeFocused();
  await page.screenshot({ path: "test-results/decks.png", fullPage: false });
  await page
    .getByRole("textbox", { name: "Local player name" })
    .fill("Browser host");
  const session = page.waitForResponse(
    (r) =>
      new URL(r.url()).searchParams.get("route") === "auth/local" &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Enter local session" }).click();
  expect((await session).ok()).toBe(true);
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Find a table", exact: true }).click();
  await page
    .getByRole("button", { name: "＋ Create a table", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Table name" })
    .fill("Browser test table");
  await page
    .getByRole("button", { name: "Create table →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser test table" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Your deck", exact: true })
    .selectOption({ label: "The Heist Starter Deck" });
  await page.getByRole("button", { name: "I’m ready" }).click();
  await expect(page.getByRole("button", { name: "Not ready" })).toBeVisible();
  await page.screenshot({ path: "test-results/lobby.png", fullPage: true });
});

test("five independent browsers finish setup, take turns, and save a manual snapshot", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const { importDeck } = await import("../../packages/decks/index");
  const contexts = await Promise.all(
    Array.from({ length: 5 }, () => browser.newContext()),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const headers = { origin, "x-table-request": "1" };
  const connections: string[] = [];
  async function call(i: number, route: string, body?: unknown, code?: string) {
    const path = "/api?route=" + route + (code ? "&code=" + code : "");
    const response =
      body === undefined
        ? await contexts[i].request.get(path, {
            maxRetries: 2,
            headers: { ...headers, "x-seat-connection": connections[i] ?? "" },
          })
        : await contexts[i].request.post(path, {
            headers: { ...headers, "x-seat-connection": connections[i] ?? "" },
            data: body,
          });
    const r = await response.json();
    expect(response.ok(), JSON.stringify(r)).toBe(true);
    return r;
  }
  try {
    const names = Array.from(
      { length: 5 },
      (_, i) => "Crew " + Date.now() + "-" + i,
    );
    for (let i = 0; i < 5; i++) await call(i, "auth/local", { name: names[i] });
    const created = await call(0, "tables", {
      name: "Five-player playtest",
      private: true,
      capacity: 5,
      targetMode: "majority",
      customTarget: 7,
    });
    const code = created.code;
    connections.push(created.connection);
    for (let i = 1; i < 5; i++)
      connections.push((await call(i, "join", {}, code)).connection);
    for (let i = 0; i < 5; i++)
      await call(i, "deck", importDeck(fixture), code);
    let room = await call(0, "room", undefined, code);
    for (let i = 0; i < 5; i++)
      room = await call(
        i,
        "action",
        {
          commandId: crypto.randomUUID(),
          revision: room.revision,
          generation: room.generation,
          command: { type: "ready" },
        },
        code,
      );
    room = await call(
      0,
      "action",
      {
        commandId: crypto.randomUUID(),
        revision: room.revision,
        generation: room.generation,
        command: { type: "start" },
      },
      code,
    );
    for (let i = 0; i < 5; i++) {
      await pages[i].goto("/");
      await pages[i].evaluate(
        ([code, connection]) =>
          sessionStorage.setItem("seat:" + code, connection),
        [code, connections[i]],
      );
      await pages[i].goto("/room/" + code);
    }
    let guard = 0;
    while (room.game.phase !== "main") {
      if (++guard > 12) throw Error("Setup did not complete");
      const index = room.seats.findIndex(
        (s: any) => s.id === room.game.choice.player,
      );
      const page = pages[index];
      await page.bringToFront();
      await expect(
        page.getByRole("heading", { name: "Your choice", exact: true }),
      ).toBeVisible();
      const previousRevision = room.revision;
      const opts = page.locator(".choice-option");
      if (room.game.choice.label.includes("Mulligan"))
        await opts.filter({ hasText: "No" }).locator("input").check();
      else await opts.first().locator("input").check();
      await page
        .getByRole("button", { name: "Confirm selection", exact: true })
        .click();
      await expect
        .poll(
          async () => {
            room = await call(index, "room", undefined, code);
            return room.revision;
          },
          { timeout: 15000 },
        )
        .toBeGreaterThan(previousRevision);
    }
    const current = room.seats.findIndex(
      (s: any) => s.id === room.game.turnPlayer,
    );
    await pages[current].bringToFront();
    await expect(
      pages[current].getByRole("heading", {
        name: "Your main phase",
        exact: true,
      }),
    ).toBeVisible();
    const absent = room.seats.findIndex(
      (_s: any, i: number) => i !== current && i !== 0,
    );
    const absentId = room.seats[absent].id;
    const presence = pages[current].waitForResponse(
      async (response) => {
        if (
          new URL(response.url()).searchParams.get("route") !== "room" ||
          !response.ok()
        )
          return false;
        const data = await response.json();
        return (
          data.presenceOnly &&
          data.seats.some((s: any) => s.id === absentId && !s.connected)
        );
      },
      { timeout: 40000 },
    );
    await pages[absent].goto("about:blank");
    await presence;
    const absentBoard = pages[current]
      .locator(".player-board")
      .filter({ hasText: names[absent] });
    await expect(
      absentBoard.getByText("Disconnected", { exact: true }),
    ).toBeVisible();
    await expect(
      pages[current].getByRole("heading", {
        name: "Your main phase",
        exact: true,
      }),
    ).toBeVisible();
    await pages[absent].goto("/room/" + code);
    await expect(
      absentBoard.getByText("Connected", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await pages[current].screenshot({
      path: "test-results/five-player-board.png",
      fullPage: true,
    });
    await pages[current]
      .getByRole("button", { name: "Save snapshot", exact: true })
      .click();
    await expect(
      pages[current].getByText("Manual snapshot saved. Play continues."),
    ).toBeVisible();
    await pages[current].evaluate(() => {
      const proto = IDBObjectStore.prototype as any,
        original = proto.put;
      (window as any).restoreSaveWrites = () => {
        proto.put = original;
      };
      proto.put = function (this: IDBObjectStore, ...args: any[]) {
        if (this.name === "saves")
          throw new DOMException("Test storage quota", "QuotaExceededError");
        return Reflect.apply(original, this, args);
      };
    });
    await pages[current]
      .getByRole("button", { name: "End turn →", exact: true })
      .click();
    await expect
      .poll(async () => {
        room = await call(current, "room", undefined, code);
        return room.game.turn;
      })
      .toBe(2);
    await expect(
      pages[current].getByRole("button", { name: "Retry autosave" }),
    ).toBeVisible();
    const downloading = pages[current].waitForEvent("download");
    await pages[current]
      .getByRole("button", { name: "Export current game" })
      .click();
    const exported = await downloading;
    const file = JSON.parse(readFileSync((await exported.path())!, "utf8"));
    expect(file.code).toBe(code);
    expect(file.envelope.format).toBe(2);
    await pages[current].evaluate(() => (window as any).restoreSaveWrites());
    await pages[current]
      .getByRole("button", { name: "Retry autosave" })
      .click();
    await expect(
      pages[current].getByRole("button", { name: "Retry autosave" }),
    ).toHaveCount(0);
    // Exercise restoration ordering independently of historical-rollback policy:
    // a recreated authority may have a newer generation and a smaller revision.
    const intercept = "**/api?route=room*";
    await pages[current].route(intercept, async (route) => {
      const url = new URL(route.request().url());
      url.searchParams.delete("since");
      url.searchParams.delete("presence");
      const response = await route.fetch({ url: url.toString() });
      const data = await response.json();
      data.generation += 1;
      data.revision = 1;
      data.game.target = 99;
      const owner = room.seats[current].id;
      const legend = data.game.pieces.find(
        (p: any) => p.controller === owner && p.zone === "legends" && !p.host,
      );
      Object.assign(legend, {
        faceUp: true,
        ready: true,
        cardId: "v-corporate-exile",
      });
      data.game.pieces.push({
        id: "equipment-ui-fixture",
        cardId: "overwatch-panam-s-gift",
        owner,
        controller: owner,
        zone: "legends",
        faceUp: true,
        ready: true,
        host: legend.id,
      });
      data.game.log = [{ id: 501, text: "Latest history fixture" }];
      data.game.logBefore = 501;
      data.game.legal.active = true;
      for (const id of ["v-corporate-exile", "overwatch-panam-s-gift"])
        data.game.cardData[id] = card(id);
      data.game.legal.legendPlayCosts[legend.id] = 5;
      data.game.legal.costs[legend.id] = 5;
      data.signature = data.generation + ".1:restored";
      await route.fulfill({ response, json: data });
    });
    await expect(
      pages[current].getByText("99 Gigs", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    const equippedLegend = pages[current]
      .locator(".legend-slot")
      .filter({ hasText: "Overwatch" });
    await expect(
      equippedLegend.getByRole("button", { name: "Use Overwatch" }),
    ).toBeVisible();
    await expect(
      equippedLegend.getByRole("button", { name: /Play with Lag/ }),
    ).toBeVisible();
    await expect(
      equippedLegend.getByRole("button", { name: /Go Solo/ }),
    ).toBeVisible();
    const historyRoute = "**/api?route=history&*";
    await pages[current].route(historyRoute, async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      await route.fulfill({
        response,
        json: {
          generation: room.generation + 1,
          revision: 1,
          log: [{ id: 1, text: "Earlier history fixture" }],
          logBefore: null,
        },
      });
    });
    await pages[current]
      .getByRole("button", { name: "Earlier actions", exact: true })
      .click();
    await expect(
      pages[current]
        .locator(".game-log p")
        .filter({ hasText: "Earlier history fixture" }),
    ).toBeVisible();
    await pages[current]
      .getByRole("button", { name: "Latest actions", exact: true })
      .click();
    await expect(
      pages[current]
        .locator(".game-log p")
        .filter({ hasText: "Latest history fixture" }),
    ).toBeVisible();
    // Polling can still have an intercepted request in flight.
    await pages[current].unrouteAll({ behavior: "wait" });
    // A response from the previous authority must not roll the client backward.
    const older = pages[current].waitForResponse(
      (r) => new URL(r.url()).searchParams.get("route") === "room",
    );
    await older;
    await expect(
      pages[current].getByText("99 Gigs", { exact: true }),
    ).toBeVisible();
    await pages[current]
      .getByRole("button", { name: "Saved games", exact: true })
      .click();
    await expect(
      pages[current].getByText("Manual snapshot", { exact: true }),
    ).toBeVisible();
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
