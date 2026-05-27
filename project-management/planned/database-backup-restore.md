# Database Backup and Restore

**Priority:** medium

## Goal

Provide two backup modes — data-only and full — covering config, workflow settings, workflows, and all database files. Data-only strips entries that reference generated media (e.g. media records, music tracks in AnyTale genre data, character portrait/voice URLs), producing a portable settings snapshot; full backup copies all entries regardless of media ties. Restore supports either a direct replace or a best-effort merge with existing data.

## Notes

- Backup scope: `config.json`, workflow definitions, workflow settings, and everything under `server/database/`.
- Data-only mode: walks each database record and removes or nulls fields that point to generated media files, so the backup is self-contained without needing the media folder.
- Full mode: copies all records as-is; restoring this on a different machine without the matching media files will leave broken links.
- Restore — direct replace: overwrites current data with backup contents entirely.
- Restore — merge: attempts to combine backup records with existing data (conflict resolution strategy TBD at grooming).
- Open question: backup format — single zip, a directory, or a JSON envelope?
- Open question: where does the UI live — settings page, a dedicated backup/restore page, or a CLI-only operation?
