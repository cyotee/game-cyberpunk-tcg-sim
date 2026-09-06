# Playtest release evidence

Updated September 6, 2026. **Not a full-release approval or a deployed-service claim.**

| Item | Current evidence |
| --- | --- |
| Application | React/Vite browser client and authoritative Vercel Node API with PostgreSQL transactions. |
| Live rules/catalog | `2026-09-06.playtest.2` / `2026-09-06.2`; live bundle remains under development. |
| Retained runtime | Checksummed, self-contained `2026-09-05.playtest.1` engine/catalog/deck validator. |
| Catalog | 150 sufficiently defined candidate identities at the September 5 cutoff; Rebecca deferred. All printed stat baselines manually checked against pinned official images. |
| Card outcomes | 142 identities have linked baseline and printed-clause outcome evidence. This does not resolve shared source conflicts or certify all interactions. |
| Starter decks | Both official August 21 constructed starters verified: three Legends plus 40 main-deck cards each. |
| Automated checks | 1,132 tests in 43 files passed after history paging and all printed-stat baselines. Type checking, formatting and production build pass. |
| Browser evidence | All twelve current journeys passed in Chromium, Firefox and WebKit, including five independent player contexts, reconnecting, snapshots, quota recovery and cross-tab readiness. The subsequent paged-history five-player journey also passes in all three engines. Actual Safari remains unverified. |
| Database evidence | Real local PostgreSQL integration and restart recovery passed. The structured-history fixture passed 100 reconnects, 200/500 commands, 100 full snapshots per configuration, directory traffic and conditional polls. See local reports; these exclude hosted latency/cost. |
| Deployment | Vercel configuration and migrations supplied; no project linked or production environment configured. `check:deploy` reports all six required variables missing. |

## Uncertified card effects

| Identity | Open issue |
| --- | --- |
| Bonnie and Clyde | Whether its enhanced two-target mode may reach nonqualifying Rivals after another Rival satisfies the Gig condition. |
| Towerfall | Whether any qualifying Rival enables both global modes, or the enhanced scope is limited to qualifying Rivals. |
| Pyramid Song | Pinned official image says −4 power; structured card text says −5. |
| Safety Override | Printed effect applies to the next friendly fight loss; FAQ describes selecting a Unit. |
| V — Streetkid | Printed trash/retrieval instruction conflicts with an official FAQ. |
| Johnny — Rocking Renegade | Zero-cost activation versus the conflicting minimum-payment guidance. |
| River Ward | Search/trash handling and ordering conflict in official guidance. |
| MT0D12 Flathead | When Street Cred is checked for blocking restriction. |

The [multiplayer register](../rules-audit/MULTIPLAYER.md), [source audit](../rules-audit/README.md) and [coverage inventory](../rules-audit/implementation-coverage.json) preserve the detailed issues. No disputed card is marked complete merely because its handler executes.

## Remaining release dependencies

- Resolve the recorded source hierarchy and outstanding multiplayer/deck-out rulings. Implement September 6 approved setup and concession restrictions.
- Implement the approved historical manual-snapshot policy: create a separate continuation preserving newer original progress. Current implementation rejoins live progress or resumes the latest unattended state; it cannot silently roll back newer progress.
- Configure a stable application origin, PostgreSQL, Discord OAuth and retained save keys. Run `npm run check:deploy -- --database` after configuration, then verify real Discord login with separate accounts.
- Complete deployed two- through five-player acceptance, actual Safari checks, recovery/rollback and hosted latency/cost measurements.
- Close the remaining lifecycle/retention decisions in the implementation plan and run the release gate. `npm run check:release` deliberately fails while required evidence and decisions are incomplete.

[Deployment instructions](DEPLOYMENT.md) describe the concrete configuration, migration and smoke-check steps. Local encrypted saves require the service, retained keys and the pinned engine to resume; a file grants no account or seat authority.

## Structured-history load fixture

The 20 tables of five players / 50 tables of two players configurations retained 10,000 synthetic typed events per table, one third private to a seat. Command p95 was 1.55/2.60 seconds; snapshot p95 was 7.54/14.23 seconds. All 200 replaced connections were rejected. These are local burst measurements under development load, not agreed production acceptance targets. History paging was added afterward and passed log, service, real-PostgreSQL and restart checks; the five-player paging journey passes in Chromium, Firefox and WebKit after correcting test text matching and route cleanup. These numbers must not be presented as a paging benchmark.
