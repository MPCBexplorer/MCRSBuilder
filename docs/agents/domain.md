# Domain Docs

This repo uses a **single-context** layout:

- **Root context**: `CONTEXT.md` at the repo root defines the project's domain model, ubiquitous language, and key concepts.
- **ADRs**: Architecture Decision Records live in `docs/adr/`.

## Consumer Rules

When working on this repo:

1. Read `CONTEXT.md` first to understand the domain terminology and boundaries.
2. Check `docs/adr/` for past architectural decisions before proposing changes.
3. Update `CONTEXT.md` when you discover new domain concepts or clarify existing ones.
4. Create new ADRs in `docs/adr/` for significant architectural decisions.

## File Locations

- `CONTEXT.md` — Single source of truth for domain vocabulary
- `docs/adr/NNNN-short-description.md` — Sequential ADRs (e.g., `0001-initial-architecture.md`)