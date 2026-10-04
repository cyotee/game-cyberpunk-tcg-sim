---
name: cyotee-skills-manager
description: Manage Cyotee's Agent Skills catalog. Use when the user says "copy skills", "install pack", "sync skills", "add MCP to this repo", "which packs exist", or asks to start a project with crane/godot/manamesh/indexedex/aave skills.
---

# Cyotee skills manager

Canonical catalog: `/Users/cyotee/Development/github-cyotee/cyotee-skills`

This repo is the source of truth for Skills. `cyotee-claude-plugins` is Claude commands/hooks/marketplace only.

Do not copy skills by hand. Run `scripts/cyotee-skills.py`.

```bash
CATALOG=/Users/cyotee/Development/github-cyotee/cyotee-skills
python3 "$CATALOG/scripts/cyotee-skills.py" list
python3 "$CATALOG/scripts/cyotee-skills.py" list --pack crane
python3 "$CATALOG/scripts/cyotee-skills.py" copy --pack crane --target /path/to/repo
python3 "$CATALOG/scripts/cyotee-skills.py" copy --skill manamesh-p2p --target /path/to/repo
python3 "$CATALOG/scripts/cyotee-skills.py" copy --mcp higgsfield,meshy --target /path/to/repo
python3 "$CATALOG/scripts/cyotee-skills.py" copy --pack indexedex --agents --target /path/to/repo
python3 "$CATALOG/scripts/cyotee-skills.py" install-global
python3 "$CATALOG/scripts/cyotee-skills.py" sync
```

## Rules

- Edit skills in `cyotee-skills/skills/<name>/`.
- Copy into `$TARGET/.opencode/skills/<name>/` for OpenCode project pins.
- Prefer packs over dumping every skill into a repo.
- Do not add new skills under `cyotee-claude-plugins`.
- MCP recipes never store API keys. Meshy uses `{env:MESHY_API_KEY}`.
- After copy or `install-global`, tell the user to restart OpenCode.

## Packs

Protocol and tooling packs match old plugin names: `crane`, `aave-v3`, `aave-v4`, `balancer-v3`, `uniswap-v3`, `uniswap-v4`, `foundry`, `wagmi`, `tevm`, `godot`, `manamesh`, `indexedex`, and others. Run `list` for the full set.

`harness` is the catalog manager plus writing/librarian/browser skills.

## New project

1. Ask which pack(s) apply.
2. `copy --pack ... --target $REPO`
3. Add MCP only if that project needs it (`--mcp`).
4. Do not enable every global MCP in every repo.
