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

## Tech Stack

- Next.js + Supabase + Postmark
- UK accounting practice reminder system
- See MEMORY.md for lessons learned about Supabase/PostgREST quirks and deadline calculations
