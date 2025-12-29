# Bugs / Fixes
- tag searches are not working as expected (i.e. anime tag search not picking up many "anime" tagged images)

# Features
- Deprecate tag feature, add "folders". Add "folder" attribute to image data. Put buttons next to gallery to show and allow user to change folder. Save inpaint image back to the same folder as the source image. Generated image should go to the current folder. Allow user to move selected items to destination folder in the gallery.
- Export to destination (customizable)
- Add versioning to config/default config. If there's a newer version default config, create new fields that currently didn't exist in config.
- Wan22 video loop
- Add camera stability verbiage (all videos) and no limb movement verbiage (looping videos)
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