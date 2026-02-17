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
- Use specific file paths with git commands (repo is in user home directory)

## Tech Stack & Architecture

- Next.js + Supabase + Postmark
- UK accounting practice reminder system
- **Consult `ARCHITECTURE.md` for full backend architecture** — database schema, API routes, cron pipeline, auth model, Supabase client usage, and the reminder/email pipeline. Read this before making backend changes.
- **Consult `ENV_VARIABLES.md` for environment variable reference** — what each variable does, where it's used, and which are tenant-specific.
- See MEMORY.md for lessons learned about Supabase/PostgREST quirks and deadline calculations
