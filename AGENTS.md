# Working on this repo

Appointment and visitor management for Systems Plus Computer College, Caloocan.
Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, Supabase auth + Postgres,
Resend for email. Server actions live in `app/actions.ts`; the shell and design
tokens live in `app/globals.css`.

## Design skills

Five skills are installed under `skills/` and describe how to design, critique and
polish UI here. They are installed artifacts, not source, and are gitignored — see
[skills/README.md](skills/README.md) for provenance and licenses.

If `skills/` is missing, restore it first:

```bash
node scripts/install-skills.mjs
```

Each skill is a `SKILL.md` with YAML frontmatter. Read the file before following it;
they are long and specific.

### Which one to reach for

| When the work is | Use |
| --- | --- |
| Choosing an aesthetic direction, palette, type scale; anything that risks looking templated | `skills/frontend-design/SKILL.md` |
| Motion, gestures, sheets, drag/swipe, springs, momentum, interruptible transitions, translucent materials, type tracking/leading | `skills/apple-design/SKILL.md` |
| Critiquing, auditing, polishing, simplifying, hardening an existing screen; design tokens and `DESIGN.md` | `skills/impeccable/SKILL.md` |
| Component/design-system specifics, shadcn + Tailwind patterns, palettes, font pairings, UX guidelines, chart types | `skills/ui-ux-pro-max/ui-styling/SKILL.md`, `ui-ux-pro-max/ui-ux-pro-max/SKILL.md` |
| Marketing copy, microcopy, error and empty-state strings, or any prose | `skills/no-ai-slop/SKILL.md` |

`impeccable` and `ui-ux-pro-max` carry `reference/` and `data/` folders — open the
specific reference file a task needs (`critique.md`, `polish.md`, `animate.md`,
`audit.md`) instead of loading the whole skill.

Note that `no-ai-slop` is a **writing** skill, not a UI-quality one. It is still
relevant here: interface copy is part of the design.

### Using them together

For a redesign, read `frontend-design` for direction and `impeccable` for critique
before writing code. For a motion or interaction pass, `apple-design` is the
authority. `ui-ux-pro-max` is the lookup for concrete component and data questions.
Finish by running the `no-ai-slop` checks over any user-facing strings you wrote.

## House rules that already exist here

- The palette, spacing and easing tokens are CSS custom properties in
  `app/globals.css` (`--navy`, `--gold`, `--g*` scale, `--ease`). Extend them rather
  than hardcoding new colors.
- `prefers-reduced-motion`, `prefers-reduced-transparency` and `prefers-contrast`
  are already handled globally. New motion must respect them.
- Accessibility is a quality floor: visible focus rings, `inert` for off-screen
  panels, labelled controls, 44px minimum touch targets on small screens.
- Verify UI work in a browser at several widths rather than trusting the build.
