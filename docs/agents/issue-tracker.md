# Issue Tracker: Local Markdown

Issues are tracked as Markdown files under `.scratch/<feature>/` in this repo.

## Workflow

- Create issues using the `to-tickets` skill — it writes to `.scratch/<feature-name>/issue.md`.
- Triage issues using the `triage` skill — it scans `.scratch/` and updates status labels.
- Agents read from `.scratch/<feature>/issue.md` when an issue is marked `ready-for-agent`.

## Structure

```
.scratch/
├── <feature-name>/
│   ├── issue.md          # Core description, requirements, acceptance criteria
│   ├── comments.md       # Discussion history
│   └── notes.md          # Technical notes, references
```

## Migration Path

This setup can be migrated to GitHub Issues later by re-running `setup-matt-pocock-skills` and choosing GitHub.