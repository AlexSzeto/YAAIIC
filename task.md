# Workflow Import and Edit UI - Bug Fixing

## Goals
Fix design flaws and bugs for the Workflow Import and Edit UI.

## Bugs and Design Flaws
- The button to open the hamburger menu should not be a unique element - reuse large buttons
- Don't fix the hamburger menu to the window - place it in the header area, to the right of the title and all the buttons on the right side (gallery, home, etc).
- The Workflow Editor page should be the ONLY option in the hambburger menu.
- The Nav menu should be generic and converted into a custom UI component. its highlight color should be background instead of backgroundLight. No link in the entire program should ever have underlines.
- The Inpaint Nav item (which shouldn't exist) is using the wrong icon. We need to find a way to gracefully handle non-existent icon names, showing a blank area instead of a block of unsightly wide text.
- The Workflow editor page currently show "Fail to load workflows" toast message. The network log shows it's trying to make a request to `http://localhost:3000/api/workflows`, which doesn't exist.
- The Workflow editor page should have a home header button, like the inpaint page, to return to the home page.

## Tasks

## Implementation Details

