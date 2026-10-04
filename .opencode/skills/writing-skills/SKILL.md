---
name: writing-skills
description: This skill should be used when the user asks to "write a skill", "create a skill", "how do skills work", "skill format", "skill structure", or needs guidance on writing new OpenCode skills for the Crane framework.
license: MIT
---

# How to Write OpenCode Skills

Skills are markdown files that provide specialized knowledge to AI agents for specific tasks. Each skill lives in `.opencode/skills/<skill-name>/SKILL.md` and is automatically discovered when its description matches a user's request.

## Skill Directory Structure

Every skill is a directory containing a `SKILL.md` file:

```
.opencode/skills/
├── my-skill/
│   └── SKILL.md        # Mandatory — the skill content
└── another-skill/
    └── SKILL.md
```

## File Format: SKILL.md

Each `SKILL.md` has two parts: **YAML front matter** and **markdown content**.

### Front Matter (Required)

```yaml
---
name: my-skill
description: This skill should be used when the user asks about "topic A", "topic B", or needs guidance on <specific task>.
license: MIT  # Optional, defaults to project license
---
```

The `name` must match the directory name. The `description` is the most important field — it determines when the skill activates. Use trigger phrases in quotes describing what a user would ask.

### Content Structure

A well-written skill follows this structure:

```markdown
---
name: my-skill
description: ...
---

# My Skill Title

## Conceptual Overview (1-3 sentences)
Explain what this skill covers and when to use it.

## Key Concepts / Architecture
Explain the core ideas, patterns, and how components fit together.

## Practical Sections (the meat of the skill)

### Topic A — with code examples
```solidity
// Code showing the pattern
```

### Topic B — decision guides, tables, checklists
| Column A | Column B |
|----------|----------|
| Value 1 | Description |

## Important Constraints / Gotchas
Bulleted list of critical things to watch for.

## Key Files
```
path/to/key/file.sol
path/to/another/file.sol
```

## See Also
- `skill:related-skill-name` — brief note about relationship
```

## Description Trigger Phrases

Write descriptions that match how users naturally ask questions. Include:

- **Topic names** the user would type: `"Reliquary"`, `"ERC4626"`, `"access control"`
- **Action verbs**: `"deploy"`, `"configure"`, `"test"`, `"audit"`
- **Problem statements**: `"how to integrate"`, `"why does it revert"`
- **Exact phrases** users might use in quotes

**Good examples:**
```
description: This skill should be used when the user asks about "Balancer V3 swap", "add liquidity Balancer", "VaultSwapParams", or needs to understand the core Vault operations.
description: This skill should be used when the user asks to "deploy an ERC20 token", "create a token", "implement ERC20", or needs guidance on token standards implementation.
```

**Bad examples:**
```
description: Token deployment guidance.  # Too vague, no trigger phrases
description: About Uniswap.              # No context about when to use
```

## Content Guidelines

### Be Concise But Complete
- State concepts directly, then justify if needed
- Include working code examples with imports
- Prefer tables over prose for structured comparisons
- Use bullet points for constraints and gotchas

### Use Proper Import Paths
Always show Crane remappings, not raw paths:

```solidity
// ✓ Correct
import {Reliquary} from "@crane/contracts/protocols/staking/reliquary/v1/Reliquary.sol";

// ✗ Avoid
import {Reliquary} from "../../../../protocols/dexes/reliquary/v1/Reliquary.sol";
```

### Cross-Reference Related Skills
At the bottom of each skill, include a "See Also" section:

```markdown
## See Also
- `skill:crane-deployment` — deploying the contracts
- `skill:crane-testing` — writing tests
- `contracts/path/to/reference.sol` — key implementation file
```

### Anchor to Exact Code
When referencing Crane code, point to specific files and functions:

```markdown
// From: `contracts/access/operable/OperableRepo.sol`
function _onlyOperator() internal view { ... }
```

## Triggering Behavior

The OpenCode agent activates a skill when the user's request matches any phrase in the `description` field. The skill remains active throughout the conversation if it remains relevant.

**To maximize activation:**
- Include 5-10 trigger phrases in quotes
- Put the most important phrases first
- Include both nouns (what) and verbs (what to do with it)

## Example: Writing a New Protocol Skill

Suppose you've just ported a new protocol "Foo" to Crane. To write its skill:

1. **Architecture skill** (`foo-architecture/`):
   - What Foo does and why it exists
   - Core contract structure and relationships
   - Access control model
   - Key structs and constants
   - File map

2. **Deployment/Usage skill** (`foo-deployment/`):
   - How to deploy Foo (direct vs Create3Factory)
   - Step-by-step pool creation or configuration
   - User operations with exact signatures
   - Important constraints
   - Testing pattern reference

3. Trigger phrases for architecture:
   ```
   "Foo protocol", "how Foo works", "Foo architecture",
   "IFoo interface", "Foo contract"
   ```

4. Trigger phrases for deployment:
   ```
   "deploy Foo", "set up Foo pool", "use Foo", "Foo integration",
   "interact with Foo"
   ```

## Skill Quality Checklist

Before finishing a skill, verify:

- [ ] Front matter has `name` matching directory and a `description` with trigger phrases
- [ ] Code examples compile with correct Crane remappings
- [ ] File paths reference actual Crane locations
- [ ] "See Also" links to related skills
- [ ] Constraints and gotchas are clearly labeled
- [ ] Content is actionable — user can apply the skill immediately

## Key Files

```
.opencode/skills/                     # All skills live here
writing-skills/SKILL.md              # This skill
crane-architecture/SKILL.md          # Reference: Crane framework patterns
crane-deployment/SKILL.md              # Reference: Deployment patterns
crane-testing/SKILL.md               # Reference: Testing patterns
```
