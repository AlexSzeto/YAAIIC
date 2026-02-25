# Further fixes for the brew editor
## Bugs and Design Flaws
- For Track slider limits, all sliders need to have its maximum set to at least 1.00, and at most 60.00.
 - For sound sources, round the length of the clips to 2 decimal digits, and display those digits in the clip length display.
 - The source label is not updating from its default value when a new clip is added and a new clip source is selected.
 - Use the full audio player (from `custom-ui/media/audio-player.mjs`) in the dynamic list for clip playback.
 - The channel label is not updating from its default value when a new track added and the source is the first item on the select input. Add a `- select source -` with `null` value as the first item on the select input. Disable the duration/delay input and disable the preview when one of the sources is `null`. 
 - After pressing the record button, nothing happens - the play timer does not advance, there is no audible playback, and there's no indication that the recording has started.
## Tasks
## Implementation Details