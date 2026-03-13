# Peninsula Accounting - Project Instructions

## UI Design Standards

**CRITICAL: Always consult DESIGN.md before creating or modifying UI components.**

The `DESIGN.md` file contains established design patterns and component standards for this application. Before implementing any UI changes, review the relevant sections:

- Dropdown patterns (Select vs DropdownMenu)
- Date range filter patterns
- Toggle component standards (ToggleGroup with variant="muted")
- Button variants and color standards
- Icon usage guidelines
- Traffic light status system
- Card header spacing patterns
- Editable cell patterns

When you establish a new UI pattern during development, update DESIGN.md to document it for consistency.

## Development Workflow

- This project uses the GSD workflow with plans in `.planning/`
- Commits go directly to main/master (no branching)
- After completing a requested change, commit the changes with a descriptive commit message. Do not push unless explicitly asked.
- Use specific file paths with git commands (repo is in user home directory)

## Design Reference Project

**`C:\Users\ejsch\University\Coding Projects\estudios-launchpad-new`** — A previous project built by the same developer with similar UI goals. Use it as a design and layout reference when building new components or pages for Prompt.

Key patterns to take inspiration from:
- **Hero heading animation**: Word-by-word spring entrance — each word uses `motion.span` with `initial={{ opacity: 0, y: 20 }}`, `animate={{ opacity: 1, y: 0 }}`, spring config `{ type: "spring", stiffness: 100, damping: 12, delay: index * 0.08 }`, and `className="inline-block mr-[0.25em]"`.
- **Overall aesthetic**: Clean, modern, slightly editorial — generous whitespace, bold typography, subtle motion.
- **Particle system**: Physics-based icon particle bursts from a focal point with elastic collisions — see `src/components/HeroParticles.tsx` for the reference implementation.
- **Tech stack**: Vite + React + shadcn/ui + framer-motion — components are compatible with this project's stack.

## Tech Stack & Architecture

- Next.js + Supabase + Postmark
- UK accounting practice reminder system
- **Consult `ARCHITECTURE.md` for full backend architecture** — database schema, API routes, cron pipeline, auth model, Supabase client usage, and the reminder/email pipeline. Read this before making backend changes.
- **Consult `ENV_VARIABLES.md` for environment variable reference** — what each variable does, where it's used, and which are tenant-specific.
- See MEMORY.md for lessons learned about Supabase/PostgREST quirks and deadline calculations
