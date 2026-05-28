# Storage Purging

**Priority:** high

## Goal

Scan the media storage directory and identify files not referenced by any database record, then move unreferenced files to a quarantine folder as a safe first step. A separate "empty trash" action permanently deletes everything in quarantine.

## Notes

- Referenced files are determined by walking the media database; hash-indexed files (e.g. AnyTale character/outfit previews) are intentionally excluded from the unreferenced check.
- Quarantine acts as a recycle bin — files are moved, not deleted, so accidental purges can be recovered manually.
- "Empty trash" permanently deletes all files currently in quarantine.
- Open question: should the quarantine folder live inside the media directory or outside it?
- Open question: surface this as a button in the settings page or as a dedicated storage management UI?
