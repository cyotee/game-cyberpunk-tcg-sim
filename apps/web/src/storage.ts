import { openDB } from "idb";
import type { Deck } from "../../../packages/decks/index";
import type { Envelope } from "../../../packages/saves/server";
export interface SavedGame {
  id: string;
  name: string;
  code: string;
  revision: number;
  generation?: number;
  version: string;
  savedAt: string;
  kind: "auto" | "manual";
  envelope: Envelope;
}
const database = openDB("night-city-tables", 1, {
  upgrade(db) {
    db.createObjectStore("decks", { keyPath: "id" });
    db.createObjectStore("saves", { keyPath: "id" });
  },
});
const deckChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("night-city-decks")
    : undefined;
function deckChanged(id: string, deleted = false, remote = false) {
  window.dispatchEvent(
    new CustomEvent("deck-library-change", { detail: { id, deleted } }),
  );
  if (!remote) deckChannel?.postMessage({ id, deleted });
}
if (deckChannel)
  deckChannel.onmessage = (e) => deckChanged(e.data.id, !!e.data.deleted, true);
export const deckStore = {
  all: async () => (await database).getAll("decks") as Promise<Deck[]>,
  put: async (d: Deck) => {
    await (await database).put("decks", d);
    deckChanged(d.id);
  },
  delete: async (id: string) => {
    await (await database).delete("decks", id);
    deckChanged(id, true);
  },
};
export const saveStore = {
  all: async () => (await database).getAll("saves") as Promise<SavedGame[]>,
  put: async (s: SavedGame) => {
    const tx = (await database).transaction("saves", "readwrite");
    const prior = (await tx.store.get(s.id)) as SavedGame | undefined;
    // A delayed response in another tab must never replace a newer autosave.
    const newer =
      !prior ||
      (s.generation ?? 1) > (prior.generation ?? 1) ||
      ((s.generation ?? 1) === (prior.generation ?? 1) &&
        s.revision >= prior.revision);
    if (s.kind !== "auto" || newer) await tx.store.put(s);
    await tx.done;
  },
  delete: async (id: string) => {
    await (await database).delete("saves", id);
  },
};
export function download(name: string, contents: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/[<>:"/\\|?*]/g, "_");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
