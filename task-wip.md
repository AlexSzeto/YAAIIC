# Create Inpaint Modal
[] read a new attribute, `type`, that can be (currently) set to `txt2img` or `inpaint`.
[] create a new file, `public/js/inpaint-modal.js`, and export a new class, `InpaintModal`.
1. The constructor takes in `url` and `workflowData`. 
2. Create an instance of `CustomModal` and place the following UI elements inside the modal:
  - a canvas element with the id `inpaint` that takes up to 70% of the viewport vertically or horizontally, maintaining the aspect ratio of the original image.
  - a textbox with the name `instructions` and label `Instructions:`, placed directly below the canvas element.
  - beneath the textbox, a generate button and a cancel button
[] add a new button, inpaint, next to the delete button in the generated image display

# Add Progress Percent Dialog During Image Generation