# Playtest hosting decision

Date: 2026-09-05. Implementation selection; gameplay requirements are unchanged.

Use a React/Vite frontend and Node API on Vercel, with an external PostgreSQL database. The initial implementation uses short polling, with a revision/presence signature that suppresses unchanged board payloads. This replaces the plan's proposed Cloudflare transport/authority adapter for the first playtest build.

Each match lives in one PostgreSQL row. Commands run inside a database transaction using `SELECT ... FOR UPDATE`; state, revision, and command deduplication are committed together. Presence heartbeats use a separate small row with an atomic connection-generation check. Polling acquires the room lock only when host succession needs a mutation. Checkpoints hydrate presence without rewriting the match, share concurrent reads and compress asynchronously. Unchanged room polls read metadata without transferring the game/log document from PostgreSQL. Directory requests share concurrent reads. These process-local optimizations do not retain completed cached results or replace the PostgreSQL authority. This makes cold starts and multiple Vercel instances safe without relying on process memory. The database must be in the same region as the functions where possible. Local development uses PGlite behind the same SQL interface; hosted PostgreSQL integration remains a deployment check.

Why this choice: it gives the owner a single Vercel project plus a database connection, uses ordinary request handlers, and avoids WebSocket runtime/beta and separate Cloudflare account setup for the initial build. The engine is independent of the transport. Polling incurs request and database overhead; it is not asserted to be the cheapest architecture at every traffic level. A Durable Object backend remains a future alternative if measured usage justifies it.

The current client polls a room every 1.5 seconds and the directory every 5 seconds. At 100 simultaneously open match clients this is approximately 67 room requests/second or 240,000/hour, before commands, autosaves, directory viewers, and login. Unchanged board suppression reduces response payloads, not request counts. Include database transfer and connection limits in a hosted cost test. Do not describe 100-player hosting costs as certified from local tests.

Deployment requires `APP_ORIGIN`, `DATABASE_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SAVE_KEYS`, and `SAVE_CURRENT_KEY`. The application never uses local test identities or its local development save key on Vercel. Database migration is an explicit deployment step, not DDL on every production cold start.

Sources reviewed during planning: [Vercel Functions](https://vercel.com/docs/functions), [Vercel WebSockets](https://vercel.com/docs/functions/websockets), [node-postgres transactions](https://node-postgres.com/features/transactions), [PGlite](https://pglite.dev/docs/).

Action history is stored as typed, visibility-scoped records. Normal board projections include at most 200 recent authorized entries; an authenticated cursor endpoint pages earlier entries without truncating encrypted saves. A history response is bound to the match generation, so the client cannot display an older restoration's page in a newer game. Historical text-only runtime logs use the same visibility boundary.
