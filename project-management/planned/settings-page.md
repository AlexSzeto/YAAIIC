# Settings Page

**Priority:** high

## Goal

Add a settings page that lets users view and edit `config.json` through the UI without touching the file directly. Also introduce versioning to the default config so that when `config.default.json` gains new fields, any existing `config.json` that lacks those fields is automatically migrated on startup.

## Notes

- Settings page should surface fields from `config.json` in a structured form, not a raw JSON editor.
- Versioning logic: compare version in `config.json` against `config.default.json`; add missing keys with their default values.
- Must handle the case where `config.json` doesn't exist yet (already handled by server startup copy).
