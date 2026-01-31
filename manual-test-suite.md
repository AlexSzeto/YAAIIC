# Full Coverage Manual Tests

For all sections:
- ensure no javascript error occurs (boxicon errors are currently acceptable exceptions)

## Main Page
- page loads and renders
- switch theme from dark to light, then vice versa
- change folder, ensure new list of generated results load
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

## Upload Image

## Upload Audio

## Use Result Value

## Edit Result Value

## Result Fields Tab

## Export

## Delete

## Session History