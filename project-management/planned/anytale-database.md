# AnyTale Database

**Priority:** low

## Goal

Persist completed AnyTale runs into a tales database so generated data is never lost to storage purging. Users can load saved tales and replay them from the start, export/import complete tale packages (media + data) as zip files, and run "full story mode" — where all narrative decisions are resolved upfront and the entire generation queue runs before the player ever begins reading.

## Notes

- Save entry point: augment the existing end screen with a "Save this tale" action that writes the current session's full generated dataset to the tales database.
- Saved tales are exempt from storage purging (see storage-purging feature).
- Load/replay: a new UI entry loads a list of saved tales and allows replaying any from the beginning.
- Export/import: zip bundle contains all media files referenced by the tale and the tale's data record; import extracts and registers both.
- Full story mode:
  - All branching decisions are resolved before generation begins — either fully random or guided by player choice upfront.
  - Image, dialog, and audio generation for the entire story is queued and runs in bulk.
  - Generated data is saved to the tales database as it completes.
  - Once generation is done, the player can run the full story without any loading waits.
- Open question: where does the tales database live (`tales-data.json` alongside other databases)?
- Open question: full story mode — does the player make choices one branch at a time, or all branches upfront in a single session?
