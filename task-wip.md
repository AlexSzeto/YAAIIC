# Bugs / Fixes
- Use in form buttons are not triggering form validation (for name field and possibly others)
- Refactor all custom-ui into preact components
- Fix pre generation tasks having an incorrect max step number as indicated by this event stream log:
```
event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":0,"currentStep":"(1/1) Generating prompt...","currentValue":0,"maxValue":2},"timestamp":"2025-12-13T17:34:28.476Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":50,"currentStep":"(1/1) Generating prompt complete","currentValue":1,"maxValue":2},"timestamp":"2025-12-13T17:34:29.509Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":50,"currentStep":"(1/1) Generating description...","currentValue":1,"maxValue":2},"timestamp":"2025-12-13T17:34:29.509Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":100,"currentStep":"(1/1) Generating description complete","currentValue":2,"maxValue":2},"timestamp":"2025-12-13T17:34:29.510Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":0,"currentStep":"Starting generation...","currentValue":0,"maxValue":0},"timestamp":"2025-12-13T17:34:29.526Z"}

event: progress
data: {"taskId":"task_1765647268475_z8pou5rrn","status":"in-progress","progress":{"percentage":0,"currentStep":"(5/18) Processing Load Image...","currentValue":0,"maxValue":0},"timestamp":"2025-12-13T17:34:29.565Z"}
```
For example, the correct `currentStep` for the first item should be `(1/18) Generating prompt`.

# Features
- Add versioning to config/default config. If there's a newer version default config, create new fields that currently didn't exist in config.
- Wan22 video loop
- Add camera stability verbiage (all videos) and no limb movement verbiage (looping videos)
- Export to destination (customizable)
- Move generation options (requireName, optionalPrompt, etc.) into an options object and only pass that to the client
- Use a solution other than freezeframe.js to freeze animations in gallery preview
- Auto download models from Hugging Face

# Scratch Space
- Download URLs for Wan5b:
1. https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors
- unet
2. https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/FastWan/Wan2_2_5B_FastWanFullAttn_lora_rank_128_bf16.safetensors
- lora
3. https://huggingface.co/Kijai/WanVideo_comfy/resolve/29d93f7394d49ed7ef070709ff92a316c1a6aa41/Wan22-Turbo/Wan22_TI2V_5B_Turbo_lora_rank_64_fp16.safetensors
- lora
4. https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan2.2_vae.safetensors
- vae
5. https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors
- text_encoders

- Download URLs for Inpaint:
1. https://huggingface.co/Kuvshin/kuvshin8/resolve/main/realisticVisionV60B1_v51VAE-inpainting.safetensors
checkpoint

- Download URLs for Illustrious Inpaint:
1. https://huggingface.co/ShinoharaHare/Waifu-Inpaint-XL/resolve/main/Waifu-Inpaint-XL.safetensors
checkpoint