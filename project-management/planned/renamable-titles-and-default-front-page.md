# Renamable Titles and Default Front Page

**Priority:** medium

## Goal

Allow the config file to define custom display names for each page in the app (e.g. YAAIIC, Ambient Brew, AnyTale) so the titles can be changed without code refactoring. Additionally, move the main media generation page off of the root index route and add a config setting that maps the root URL (`/`) to any existing or future page.

## Notes

- Page title overrides should apply to all places titles are displayed: nav/hamburger menu, page headings, browser tab titles.
- The default front page config should support any current or future page slug, making it forward-compatible.
- Moving generation off `/` is a breaking change for any bookmarks — worth noting in the spec.
