# Full Coverage Manual Tests

For all sections:
- ensure no javascript error occurs (boxicon errors are currently acceptable exceptions)

## Main Page
- page loads and renders
- switch theme from dark to light, then vice versa
- change folder, ensure new list of generated results load
- navigating session history (prev, next, first, last) should work
- switch workflow to `Image Edit (Qwen)`, should see `Input Image` section
- switch workflow type to `Video`, should see new workflow sets and new custom input values (`Length`, `Frame Rate`, `Image 1`, `Image 2`)
- switch workflow type to `Audio`, switch workflow to `Text to Speech (Chatterbox)`, should see `Input Audio`

## Generate 1girl (Illustrious Characters)
- enter 1 gril into prompt and generate
- should see toast
- should see progress
- should see new generated result on complete

## Generate Video
- switch workflow type to `Video`, workflow to `Image to Video Loop (WAN5b)`
- make sure current generated result is an image. make sure the select action is clickable

## Generate Audio
- switch workflow type to `Audio`
- enter prompt `smooth jazz` and generate, should see new generated result on complete

## Upload Image
- click upload, select image file
- file should show on generated result

## Upload Audio
- click upload, select audio file
- file should show on generated result

## Generated Result Section
- use workflow should work
- use seed should work (and lock)
- use name should work

- edit name to `Sam Spade` should work
- changing tabs from `Prompt` to `Tags` should work
- edit tag to `character, anime` should work

- export, then choose download
- file should appear in download folder

- delete, then confirm
- data entry should be removed from generated result

## Gallery
- open gallery, immediately click view
- session history should contain all folder items

- open gallery, select first 3 items, then click view
- session history should have 3 items

- open gallery, select 2 items, move to different folder
- items should disappear from gallery view
- change folder, items should appear at the top of gallery

- open gallery, select 2 items, delete, confirm
- items should disappear from gallery view

## Inpaint
- inpaint should disable on video/audio
- open inpaint, inpaint ui visible
- select area, area should highlight
- enter prompt `smudge`, should be able to inpaint
- after inpaint new image with replaced highlighted area should appear, session history should have 2 items