# Installed skills

Design and UI skills used when working on this project. Everything in this folder
except this README is **installed output, not source**, and is gitignored. The app
repo stays small and Vercel does not clone ~13 MB of reference material on every
build.

Restore or refresh after a fresh clone:

```bash
node scripts/install-skills.mjs
```

Pass one or more names to reinstall just those (`node scripts/install-skills.mjs impeccable`).
Every source is pinned to a commit, so a run is reproducible. Each installed skill
carries a `SOURCE.md` with its upstream URL, commit and license.

### Slim by default

`ui-ux-pro-max` ships an 81-file, 5.5 MB shelf of `.ttf` files under
`ui-styling/canvas-fonts`, which its canvas-poster reference searches when building
print and social artwork. Nothing in this project does that, so the installer skips
them and the install is 7.2 MB instead of 13 MB. The reference falls back to system
fonts when the shelf is absent.

Install them anyway:

```bash
node scripts/install-skills.mjs ui-ux-pro-max --full
```

## What is installed

| Skill | Upstream | License | What it is for |
| --- | --- | --- | --- |
| `frontend-design` | [anthropics/claude-code](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design) | All rights reserved (Anthropic PBC) | Aesthetic direction, typography, avoiding templated-looking output |
| `apple-design` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | MIT | Fluid, physical motion: springs, velocity handoff, momentum, materials, type detail |
| `impeccable` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | Apache-2.0 | Broad design language: shape, critique, audit, polish, animate, harden, tokens |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT | A bundle of 7 skills (design, design-system, ui-styling, ui-ux-pro-max, brand, banner-design, slides) with local reference data. Canvas fonts trimmed; see below |
| `no-ai-slop` | [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) | MIT | Editing prose: strips AI writing patterns while keeping the writer's voice |

## Licensing note

`frontend-design` is **not** redistributed here. The `anthropics/claude-code`
repository is "© Anthropic PBC. All rights reserved. Use is subject to Anthropic's
Commercial Terms of Service", so its text is downloaded into this local install
rather than committed to the repository. Do not check `skills/frontend-design/`
into version control or publish it.

The other four are MIT or Apache-2.0 and are safe to vendor. If you decide to commit
them, copy each skill's `LICENSE` alongside it; Apache-2.0 additionally requires the
`NOTICE.md` that `impeccable` ships.

## Conventions these skills assume

They are `SKILL.md` files with YAML frontmatter (`name`, `description`), the format
used by Claude Code, Codex and most other agents. Claude Code additionally looks in
`.claude/skills/`; if you want it to pick these up automatically, point it here:

```bash
mkdir -p .claude && ln -s ../skills .claude/skills
```

See `AGENTS.md` at the repo root for which skill to reach for and when.
