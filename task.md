# Sound Editor — Additional Bug Fixes

## Goal

Address remaining bugs in the sound editor modal related to clip regions, playback constraints, and UI contrast.

## Tasks

- [x] Clip regions are still being removed from the timeline whenever a new active region is selected.
- [x] Playbacks are not working as intended - when a region is selected, playback is not stopping at the end of the selected area. The loop button doesn't work at all.
- [x] Change the waveform progress color to be the primary contrast color (white in dark mode, black in light mode)
- [x] When the audio editor first opens, the clip regions that already exists on the timeline are not showing properly.
- [x] on the main page, when an edit that doesn't create new files occur, the updated clip regions are not saved back to the cached generation data on the client side. When a new clip is created as a result of file modification, the result is not added to the session history like uploads or normal generation actions.
- [] fix the play action when a section is selected, it is still not working properly. Currently, the playhead moves to the start of the selection, but doesn't move or play sound.
- [] change the behavior of the loop button from toggling loop mode to starting playback in loop mode, which should also turn the play button into the stop button. clicking the play button always start playback in non-looping mode.

## Implementation Details

A wavesurfer region example file from their website, demonstrating multiple regions occupying the timeline, looping region playback, and confining playback to a region:

```javascript
// Regions plugin

import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'

// Initialize the Regions plugin
const regions = RegionsPlugin.create()

// Create a WaveSurfer instance
const ws = WaveSurfer.create({
  container: '#waveform',
  waveColor: 'rgb(200, 0, 200)',
  progressColor: 'rgb(100, 0, 100)',
  url: '/examples/audio/audio.wav',
  plugins: [regions],
})

// Give regions a random color when they are created
const random = (min, max) => Math.random() * (max - min) + min
const randomColor = () => `rgba(${random(0, 255)}, ${random(0, 255)}, ${random(0, 255)}, 0.5)`

// Create some regions at specific time ranges
ws.on('decode', () => {
  // Regions
  regions.addRegion({
    start: 0,
    end: 8,
    content: 'Resize me',
    color: randomColor(),
    drag: false,
    resize: true,
  })
  regions.addRegion({
    start: 9,
    end: 10,
    content: 'Cramped region',
    color: randomColor(),
    minLength: 1,
    maxLength: 10,
  })
  regions.addRegion({
    start: 12,
    end: 17,
    content: 'Drag me',
    color: randomColor(),
    resize: false,
  })

  // Markers (zero-length regions)
  regions.addRegion({
    start: 19,
    content: 'Marker',
    color: randomColor(),
  })
  regions.addRegion({
    start: 20,
    content: 'Second marker',
    color: randomColor(),
  })
})

regions.enableDragSelection({
  color: 'rgba(255, 0, 0, 0.1)',
})

regions.on('region-updated', (region) => {
  console.log('Updated region', region)
})

// Loop a region on click
let loop = true
// Toggle looping with a checkbox
document.querySelector('input[type="checkbox"]').onclick = (e) => {
  loop = e.target.checked
}

{
  let activeRegion = null
  regions.on('region-in', (region) => {
    console.log('region-in', region)
    activeRegion = region
  })
  regions.on('region-out', (region) => {
    console.log('region-out', region)
    if (activeRegion === region) {
      if (loop) {
        region.play()
      } else {
        activeRegion = null
      }
    }
  })
  regions.on('region-clicked', (region, e) => {
    e.stopPropagation() // prevent triggering a click on the waveform
    activeRegion = region
    region.play(true)
    region.setOptions({ color: randomColor() })
  })
  // Reset the active region when the user clicks anywhere in the waveform
  ws.on('interaction', () => {
    activeRegion = null
  })
}

// Update the zoom level on slider change
ws.once('decode', () => {
  document.querySelector('input[type="range"]').oninput = (e) => {
    const minPxPerSec = Number(e.target.value)
    ws.zoom(minPxPerSec)
  }
})

/*
  <html>
    <div id="waveform"></div>

    <p>
      <label>
        <input type="checkbox" checked="${loop}" />
        Loop regions
      </label>

      <label style="margin-left: 2em">
        Zoom: <input type="range" min="10" max="1000" value="10" />
      </label>
    </p>

    <p>
      📖 <a href="https://wavesurfer.xyz/docs/classes/plugins_regions.default">Regions plugin docs</a>
    </p>
  </html>
*/
```