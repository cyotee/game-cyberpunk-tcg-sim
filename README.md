# Night City Tables

A browser application for Cyberpunk TCG free-for-all play with two to five players. The implementation includes a local deck builder, public/unlisted tables, Discord account integration, authoritative game actions, card-effect prompts, reconnection, and encrypted local saved-game files.

**This is a playtest implementation, not a certified full-rules release.** See [PROGRESS.md](PROGRESS.md) for tested behavior and outstanding requirements. The complete release scope remains in [PRD.md](PRD.md); execution milestones are in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Run locally

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. No external services are needed for local development. Use the explicitly labeled development identity form with different names in separate browser profiles. The production application requires Discord; it does not offer local test logins.

Build a deck under Deck library, or copy either official starter template. Create a table, share its URL/code, select legal decks, and have everyone mark ready. The host can start with any 2–5 ready players below table capacity.

## Verify

```sh
npm run typecheck
npm test
npm run build
```

The separate `npm run check:release` gate currently fails because the full-roster certification remains incomplete; passing the technical suite does not bypass that gate.

Browser tests build the current client and start an isolated server with a disposable database. Install the browser runtimes and run:

```sh
npx playwright install chromium firefox webkit
npm run test:e2e
```

## Deploy

Follow [the Vercel deployment guide](docs/operations/DEPLOYMENT.md). You need a PostgreSQL database, a Discord OAuth application, and persistent save-encryption keys. The repository includes `vercel.json`, the API entry point, a database migration command, and `.env.example`.

Never commit credentials. Keep historical save keys and rules runtimes if players retain saved games. A browser-local deck library is independent of the shared database used for accounts and active matches.

## Development references

- [Architecture decision](docs/architecture/0001-playtest-hosting.md)
- [Official-source audit](docs/rules-audit/README.md)
- [Multiplayer decisions](docs/rules-audit/MULTIPLAYER.md)
- [Implementation plan](IMPLEMENTATION_PLAN.md)
- [Release evidence and remaining dependencies](docs/operations/RELEASE_EVIDENCE.md)

The application renders card references from a pinned catalog; matches do not fetch rules from the publisher at runtime. This is an independent fan project, not an official Cyberpunk TCG service.
