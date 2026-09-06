# Deploying a playtest on Vercel

This repository builds a real browser client and an authoritative Node API. Vercel alone does not persist match state: configure PostgreSQL and Discord before inviting players. Use the same database and save keys for the life of the playtest.

## 1. Verify locally

Use Node 24, matching the repository and Vercel runtime configuration:

```sh
npm ci
npm test
npm run build
npm run dev
```

Open `http://127.0.0.1:5173`. With no `.env`, development uses a persistent embedded database at `.local/database` and clearly labeled local test identities. Use different names in different browser profiles for local multiplayer. These identities are unavailable in production. Browser decks and saves use IndexedDB, independent of login.

The supplied Heist list is available under Deck library → Quick start. Create a table, select a legal deck, share its invitation URL/code, and have all seated players mark ready. The host starts the match. Only the relevant player sees each choice prompt. Save snapshot preserves a separate local copy without pausing the game.

## 2. Create a PostgreSQL database

Use a hosted PostgreSQL provider, such as one available through Vercel's storage integrations. Choose a region close to the Vercel functions. Obtain the provider's connection URL, including its required TLS parameters. A pooled URL is suitable if the provider supports ordinary transactions and row locking through it. Do not use an HTTP-only SQL endpoint as `DATABASE_URL`.

For this playtest, Neon is a suitable starting provider. Create a project in the [Neon console](https://console.neon.tech), choose a region close to the Vercel functions, then use **Connect → Connection pooling** and copy the PostgreSQL URL into `DATABASE_URL`. Preserve the supplied TLS parameters. Alternatively, connect Neon from the [Vercel marketplace](https://vercel.com/marketplace/neon/neon). Check the selected plan's limits before provisioning; no fixed monthly cost has been assumed. [Neon pooling documentation](https://neon.com/docs/connect/connection-pooling).

Create a local `.env` containing the real database connection and configuration from `.env.example`. Keep it untracked. Then initialize the database:

```sh
npm run db:migrate
```

The migration creates users, sessions, temporary OAuth state, room, and room-presence tables. Re-running it is safe. Credentials are read from the environment; do not paste them into chat, source code, screenshots, or a PR.

## 3. Register Discord login

Open the [Discord Developer Portal](https://discord.com/developers/applications), choose **New Application**, name it, and open **OAuth2**. Copy its client ID and generate/copy its client secret into `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`. Under redirects, add and save the exact callback below. First create/link the Vercel project so its stable production hostname is known; use that hostname even before the application is ready for playtesting. Register this exact redirect URI, replacing the origin with your deployment's stable URL:

```text
https://YOUR-APP.vercel.app/api?route=auth/callback
```

Use the application's OAuth2 settings, not a Discord bot token. The application requests only `identify`. No bot, Discord server membership, email scope, or messaging permission is needed. Basic profile identity is mapped to stable Discord user IDs. [Discord OAuth2 documentation](https://docs.discord.com/developers/topics/oauth2).

## 4. Configure Vercel

Import this repository with the project root set to the repository root. `vercel.json` supplies the Vite build command and output directory. Set Node.js to a compatible version. Configure these server-side environment variables:

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | Exact stable HTTPS origin, without trailing slash. |
| `DATABASE_URL` | Your PostgreSQL connection string. |
| `DISCORD_CLIENT_ID` | Discord application client ID. |
| `DISCORD_CLIENT_SECRET` | Discord OAuth client secret. |
| `SAVE_KEYS` | JSON object mapping key IDs to base64-encoded 32-byte keys. |
| `SAVE_CURRENT_KEY` | Key ID to use for new saves, e.g. `v1`. |

Generate a save key locally and place it in environment configuration:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

For example, `SAVE_KEYS` has the shape `{"v1":"YOUR_GENERATED_BASE64_KEY"}`. Keep old entries when rotating keys. Losing a key makes saved files encrypted with it unrecoverable. Never use the documented local test key in production. Never prefix these variables with `VITE_`, which exposes variables to the frontend.

Do not enable `DEV_AUTH` in production; the server additionally rejects the development identity path when running on Vercel or with `NODE_ENV=production`.

Verify the deployment environment locally without printing credentials:

```sh
npm run check:deploy
npm run check:deploy -- --database
```

The second command performs a read-only connection and table-presence check. These checks do not create services, migrate a database, or certify real Discord login.

Deploy using the Vercel dashboard, or from a linked project:

```sh
vercel
```

After preview checks pass, deploy the production build:

```sh
vercel --prod
```

A preview URL has its own origin and Discord redirect requirements. Use separate preview database/keys, or a stable staging domain with its own registered OAuth redirect. Do not let unrelated preview deployments act on production match state.

## 5. Deployed smoke check

- Visit `/api?route=health`: verify the API responds and Discord configuration is detected. This endpoint does not reveal secrets.
- Sign in with Discord from two separate accounts. Build/import a legal deck in each browser.
- Create an unlisted table; verify it is absent from anonymous public listings.
- Join by full URL and by code; ready every seat; start a match.
- Complete setup, take a turn, pay for a card, react to an attack, and resolve a card choice.
- Disconnect one browser; verify play waits when its input is required and does not forfeit it.
- Reclaim a seat in another browser using the same Discord login. Confirm the old connection cannot act.
- Save a manual snapshot, export it, and import it on another browser. Verify authentication/readiness on restoration.
- Repeat with five players, including a mid-effect choice and a saved full action log.

Local test results do not substitute for this check against your actual Discord application, database, and deployment.

## Retention and recovery

Active room data currently remains in PostgreSQL until an explicit operator action removes it. No automatic forfeit or automatic room cleanup is installed. User saves have no application expiry. Clearing a browser or browser storage eviction can remove its copies; export files for migration or backup. Deleting one browser's copy does not delete other copies or the active match.

Restoring an existing connected match rejoins it. If all players are absent, restoration reopens the latest authoritative state with all players unready. A historical local snapshot does not overwrite a newer unfinished match.

Manual snapshots and rolling autosaves are separate. A save stores an authenticated encrypted state including private cards, pending choices, and full history; users do not receive the decryption key. Retained files still require this service and the pinned rules runtime to resume.

Read [PROGRESS.md](../../PROGRESS.md) and the rules audit before treating this playtest as a fully certified release. Remaining source conflicts, full-roster outcome evidence, and hosted capacity/cost checks must be resolved before the plan's first-release gate passes.

## Retained rules runtimes

`packages/runtimes/archives` contains self-contained, checksummed historical engines, including their card data and deck validators. The service dispatches every match by its stored version and fails closed for an unavailable runtime. Do not edit or delete an archive while saves or active matches may reference it. Before changing the live engine version, run `node --import tsx scripts/archive-engine.ts`, add its static import to the registry, then bump the live version. Archive creation uses exclusive file creation and refuses overwrites. Keep database backups, all historical runtime artifacts, the pinned images and all save-encryption keys together when moving the service.

Browser tests now launch their own isolated server on port 5174 against the built client. `npm run test:e2e` builds the current client before starting browser tests. Chromium, Firefox and WebKit are configured; install all three with `npx playwright install chromium firefox webkit`. WebKit tracing is disabled because tracing five pages causes excessive automation overhead on this host. Actual Safari remains a distinct check.

## PostgreSQL verification and save formats

`npm run test:postgres` runs migrations and integration tests against `TEST_DATABASE_URL`. Use a dedicated database whose name ends in `_tests`; this writes synthetic accounts, sessions and rooms. CI includes an isolated PostgreSQL service. A local PostgreSQL 18.4 test also verified restart persistence and 100-player burst polling; results are in `local-postgres-load-results.json`. The temporary local runtime used the [embedded-postgres project](https://github.com/leinelissen/embedded-postgres); it is not a production dependency.

New envelopes use format 2: JSON is compressed with DEFLATE before AES-256-GCM encryption. The authenticated associated data binds the format and key ID. Format 1 files are still decoded without compression. Keep both readers and historical keys; importing an old file does not require rewriting the file. Browser metadata includes generation as well as revision, so delayed cross-tab responses cannot replace a newer autosave.


Large-save handling coalesces concurrent reads of the same room and compresses asynchronously. Every caller still undergoes seat authorization; no completed snapshot is retained as a stale cache. Browsers display storage failures, can retry autosaving, and can export the current checkpoint directly without requiring an IndexedDB write. Anonymous directory requests share only concurrent reads. Unchanged room polls fetch room metadata before deciding whether a full authorized game projection is needed.

## Action history

The current engine records typed action data, captured display names, turn numbers and explicit public/seat visibility. The service filters records before rendering each player’s history. Stored text is a compatibility cache; typed events are authoritative for rendering. Legacy text-only histories retain their original visibility and remain readable. Private draw identities, searches and choices remain inside the encrypted checkpoint and the entitled seat’s projection.

Board updates carry the latest 200 authorized history entries. “Earlier actions” pages backward through the full retained history; “Latest actions” returns to the live feed. Paging uses the same authenticated seat/connection checks as the board. Saves still contain every event; paging does not trim or expire history.
