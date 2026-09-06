import { test, expect } from "@playwright/test";

test("cross-tab autosaves preserve the newest revision and manual snapshots", async ({
  context,
  page,
}) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  const write = (
    p: typeof page,
    revision: number,
    generation = 1,
    kind = "auto",
  ) =>
    p.evaluate(
      async ({ revision, generation, kind }) => {
        const path = "/__fixtures/storage.js";
        const { saveStore } = await import(path);
        await saveStore.put({
          id: kind === "auto" ? "auto:ABCDEF123456" : "manual:one",
          name: "Table",
          code: "ABCDEF123456",
          revision,
          generation,
          version: "fixture",
          savedAt: new Date().toISOString(),
          kind,
          envelope: { format: 1 },
        });
      },
      { revision, generation, kind },
    );
  await write(page, 5, 1, "manual");
  await Promise.all(
    Array.from({ length: 20 }, (_, i) => write(i % 2 ? page : other, 20 - i)),
  );
  await write(other, 1, 2);
  await write(page, 100, 1); // delayed response from the previous generation
  const records = await page.evaluate(async () => {
    const path = "/__fixtures/storage.js";
    return (await import(path)).saveStore.all();
  });
  expect(records.find((s: any) => s.kind === "auto")).toMatchObject({
    revision: 1,
    generation: 2,
  });
  expect(records.find((s: any) => s.kind === "manual")).toMatchObject({
    revision: 5,
    generation: 1,
  });
  await other.close();
});

test("editing a selected deck in another tab clears lobby readiness", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Local player name" })
    .fill("Cross-tab host");
  await page.getByRole("button", { name: "Enter local session" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  const { copyStarter } = await import("../../packages/decks/starters");
  const deck = copyStarter(0);
  await page.evaluate(async (deck) => {
    const path = "/__fixtures/storage.js";
    await (await import(path)).deckStore.put(deck);
  }, deck);
  await page
    .getByRole("button", { name: "＋ Create a table", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Table name" })
    .fill("Cross-tab table");
  await page
    .getByRole("button", { name: "Create table →", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Your deck", exact: true })
    .selectOption(deck.id);
  await page.getByRole("button", { name: "I’m ready" }).click();
  await expect(page.getByRole("button", { name: "Not ready" })).toBeVisible();
  const editor = await context.newPage();
  await editor.goto("/decks");
  await editor.evaluate(async (deck) => {
    const path = "/__fixtures/storage.js";
    await (
      await import(path)
    ).deckStore.put({ ...deck, main: [], updatedAt: new Date().toISOString() });
  }, deck);
  await page.bringToFront();
  await expect(page.getByRole("button", { name: "I’m ready" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Not ready" })).toHaveCount(0);
  await editor.close();
});
