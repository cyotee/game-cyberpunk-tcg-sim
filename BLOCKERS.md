# Implementation and playtest blockers

Updated September 6, 2026. This is a handoff for the user and the implementation agent. The application is not deployed and the full implementation plan is not complete. Continue independent, authorized work while decisions or external configuration are pending; do not treat recommendations as approvals.

## 1. Approved decisions — implement without asking again

These are outstanding implementation tasks, not questions for the user:

- **Historical manual saves:** create a separate continuation, preserving newer progress in the original match. Preserve participant identities and require every non-eliminated player to connect and ready up before resuming.
- **Setup:** use join order as cyclic turn order, starting at the selected first player. Randomly select the player who chooses who goes first; resolve mulligans in turn order. In games with more than two players, the first player starts with two spent Legends and the second player with one. Preserve the official two-player setup.
- **Concession:** do not allow it while an effect is processing.
- **Disconnection:** retain the player's seat and pieces; wait when their input is required, including off-turn input. Never automatically forfeit them.
- **Zero Gigs:** does not eliminate a player. The previously approved deck-out/concession elimination rules remain in place.

Agent: implement these requirements, add meaningful regression coverage, and update the PRD, progress report and release evidence. Do not mark these tasks complete merely because they are documented.

## 2. Rules decisions still needed

### Deck-out during an effect

Official comprehensive rules 1.14–1.14.1 make drawing from an empty deck an immediate loss. Their example explicitly covers a Draw 2 effect with only one card remaining. Our multiplayer adaptation eliminates that player while others continue. Blocking concessions during processing does not remove this case.

**User decision needed:** if the resolving effect's controller decks out, do its remaining instructions stop, or finish wherever possible?

**Recommendation, not approved:** stop the remaining instructions. Pending effects and lingering effects controlled by an eliminated player are already approved to be canceled/ended. This question is specifically about instructions already resolving.

### Conflicting official sources and card-specific multiplayer scope

Agent: consult the captured source evidence in [the rules audit](docs/rules-audit/README.md) and [multiplayer register](docs/rules-audit/MULTIPLAYER.md), explain each concrete conflict, and present manageable groups of choices. Research may resolve a conflict without a house ruling; do not ask the user to adjudicate facts that can be established from authoritative errata.

Eight identities remain uncertified:

| Card | Decision or evidence needed |
| --- | --- |
| Bonnie and Clyde | Can the enhanced two-target mode affect nonqualifying Rivals once another Rival meets the Gig condition, or must targets belong to qualifying Rivals? |
| Towerfall | Does any qualifying Rival enable both global modes, or is the enhanced scope restricted to qualifying Rivals? |
| Pyramid Song | Official image says −4 power; structured card text says −5. Establish precedence or approve a provisional ruling. |
| Safety Override | Printed effect covers the next friendly fight loss; FAQ describes selecting a Unit. |
| V — Streetkid | Printed retrieval wording and official FAQ disagree about eligible cards in the trash. |
| Johnny — Rocking Renegade | FAQ permits zero-cost activation while other guidance imposes a minimum payment. |
| River Ward | Search/trash selection and ordering differ in official guidance. |
| MT0D12 Flathead | Determine when Street Cred is checked for its blocking restriction. |

Shared audit conflicts also cover sales, target-selection timing, Legend timing, null versus zero, and teaching-guide discrepancies. A blanket claim that all handlers run does not resolve these conflicts. Preserve the already approved per-effect Rival binding, qualifying-Rival restrictions, unrestricted multi-target scope, and official per-player effect batching.

**To unblock:** record authoritative findings or explicit user rulings, implement them, and link outcome tests for each affected printed clause and interaction. Run the release gate; do not bypass it.

## 3. Create and configure hosting services

The user has not created a Discord OAuth application or PostgreSQL database. The last inspection found no linked Vercel project or production configuration for this application. Recheck before creating anything to avoid duplicates. The Vercel CLI is installed and authenticated; unrelated projects must remain untouched.

### A. Establish the Vercel project and stable origin

Create/import this repository as a Vercel project, or link it using the installed CLI. Use the repository root and existing `vercel.json`; select Node.js 24. Obtain its stable production hostname, for example `https://YOUR-APP.vercel.app`.

Set `APP_ORIGIN` to that exact HTTPS origin, without a trailing slash. Use the stable hostname for Discord configuration rather than an individual preview deployment URL. Creating/linking the project does not mean the application is ready for playtesting.

### B. Create PostgreSQL

Suggested starting provider: [Neon](https://console.neon.tech), also available through the [Vercel marketplace](https://vercel.com/marketplace/neon/neon). No provider has been provisioned and no fixed monthly cost is assumed.

1. Create a project and select a region close to the Vercel functions.
2. Open **Connect**, enable **Connection pooling**, and copy the PostgreSQL connection URL.
3. Store it as `DATABASE_URL`, preserving the provider's TLS parameters. Use an ordinary PostgreSQL connection URL, not an HTTP SQL endpoint.

See [Neon's pooling instructions](https://neon.com/docs/connect/connection-pooling). Review the selected plan's limits before provisioning. Hosted load and cost still need measurement.

### C. Create Discord login

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and select **New Application**.
2. Name the application and open **OAuth2**.
3. Obtain its client ID and generate/copy the client secret. Store them as `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`.
4. Add and save this exact redirect URI, replacing the hostname:

   ```text
   https://YOUR-APP.vercel.app/api?route=auth/callback
   ```

The application uses the `identify` scope. It does not require a bot token, email access, Discord server membership or messaging permissions. See [Discord OAuth2 documentation](https://docs.discord.com/developers/topics/oauth2).

### D. Configure environment and retained save keys

Use an ignored local `.env` based on `.env.example` and the Vercel project's server-side environment settings. Do not paste secret values into chat or commit them. Do not prefix these variables with `VITE_`.

| Variable | Required value |
| --- | --- |
| `APP_ORIGIN` | Stable HTTPS application origin, no trailing slash. |
| `DATABASE_URL` | Hosted PostgreSQL connection URL. |
| `DISCORD_CLIENT_ID` | Discord application client ID. |
| `DISCORD_CLIENT_SECRET` | Discord OAuth client secret. |
| `SAVE_KEYS` | JSON mapping retained key IDs to base64-encoded 32-byte keys. |
| `SAVE_CURRENT_KEY` | Key ID for new saves, such as `v1`. |

Generate a key locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Set `SAVE_KEYS` to `{"v1":"YOUR_GENERATED_BASE64_KEY"}` and `SAVE_CURRENT_KEY` to `v1`. Retain the keys securely: losing a key prevents recovery of files encrypted with it. Keep older key entries during rotation. Never use the public local-development key or enable `DEV_AUTH` in production.

Keep preview/staging database and keys separate from production. Every different OAuth origin needs its corresponding registered redirect URI.

### E. Verify and hand back to the agent

Once the target database and local configuration are correct:

```sh
npm run check:deploy
npm run db:migrate
npm run check:deploy -- --database
```

Migration writes the application schema to the configured database. The deployment checks validate configuration without printing credentials; the database check is read-only.

**Tell the agent:** the project name/stable URL and where configuration is available (ignored `.env`, Vercel, or both). Do not send credential values. The agent can then verify configuration, complete deployment work, and guide real Discord acceptance testing.

Full operational steps: [DEPLOYMENT.md](docs/operations/DEPLOYMENT.md).

## 4. Remaining lifecycle and release work

The implementation plan's D1–D8 register includes further lifecycle details. Agent: reconcile it with the latest approved PRD before asking questions; the older register still lists some now-resolved decisions.

Outstanding areas include mixed ownership/control on elimination, simultaneous losses and round boundaries, choices by multiple players within one effect, mandatory loops, lobby readiness after settings changes, host-block behavior for already-seated players, join-code lifecycle, restoration discovery/deduplication, server-side retention, and identity/session deletion policies. Present concrete proposed behavior only where existing rules and approvals do not determine it. Local saves must retain their approved no-expiry policy; disconnection must never become automatic forfeit.

Before calling the full plan complete:

- Implement and verify all approved changes and remaining card rulings.
- Verify real Discord login and deployed two- through five-player play, reconnecting, separate continuations, and save migration.
- Verify actual Safari. WebKit automation alone is not Safari evidence. Enable Safari's **Allow Remote Automation** for automated checking, or perform documented manual checks.
- Exercise deployed recovery/rollback with retained encryption keys and pinned rules runtimes.
- Measure hosted latency and cost at the intended capacity; local database burst results are not hosted acceptance. Agree practical release targets from those measurements.
- Run appropriate tests, type checking, lint/build and `npm run check:release`. Record remaining failures honestly.

See [release evidence](docs/operations/RELEASE_EVIDENCE.md), [PROGRESS.md](PROGRESS.md), [PRD.md](PRD.md), and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Suggested continuation prompt

> Read BLOCKERS.md and the latest PRD and progress report. Implement the approved outstanding changes without asking again. Continue all independent work, ask the remaining rules questions in small multiple-choice groups, and use configured services when available. Keep BLOCKERS.md current, distinguish completed work from unresolved decisions, and continue through deployment and playtest verification wherever the required decisions and configuration are available.
