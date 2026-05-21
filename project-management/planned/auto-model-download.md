# Auto Model Download from Hugging Face

**Priority:** medium

## Goal

Allow users to trigger model downloads from Hugging Face directly through the app, rather than manually placing files in ComfyUI directories. The server fetches the file from a given URL and saves it to the appropriate model folder.

## Notes

- Download URLs and target subfolders (unet, lora, vae, text_encoders, checkpoints, etc.) need to be specified.
- Progress reporting during download would be valuable.
- Could be integrated into the settings page or as a standalone model management section.

## Known Model URLs

**Wan 2.2 5B (image-to-video)**
- `diffusion_models/wan2.2_ti2v_5B_fp16.safetensors` — https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors
- `loras/Wan2_2_5B_FastWanFullAttn_lora_rank_128_bf16.safetensors` — https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/FastWan/Wan2_2_5B_FastWanFullAttn_lora_rank_128_bf16.safetensors
- `loras/Wan22_TI2V_5B_Turbo_lora_rank_64_fp16.safetensors` — https://huggingface.co/Kijai/WanVideo_comfy/resolve/29d93f7394d49ed7ef070709ff92a316c1a6aa41/Wan22-Turbo/Wan22_TI2V_5B_Turbo_lora_rank_64_fp16.safetensors
- `vae/wan2.2_vae.safetensors` — https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan2.2_vae.safetensors
- `text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors` — https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors

**Inpaint (Realistic Vision)**
- `checkpoints/realisticVisionV60B1_v51VAE-inpainting.safetensors` — https://huggingface.co/Kuvshin/kuvshin8/resolve/main/realisticVisionV60B1_v51VAE-inpainting.safetensors

**Illustrious Inpaint (Waifu XL)**
- `checkpoints/Waifu-Inpaint-XL.safetensors` — https://huggingface.co/ShinoharaHare/Waifu-Inpaint-XL/resolve/main/Waifu-Inpaint-XL.safetensors

**Low Quant Album Gen (JuggernautXL GGUF)**
- `checkpoints/juggernautXL_juggXIByRundiffusion_Q4_K_S.gguf` — https://huggingface.co/Old-Fisherman/SDXL_Finetune_GGUF_Files/blob/main/GGUF_Models/juggernautXL_juggXIByRundiffusion_Q4_K_S.gguf

**AceStep 1.5 Turbo**
- `checkpoints/ace_step_1.5_turbo_aio.safetensors` — https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files/resolve/main/checkpoints/ace_step_1.5_turbo_aio.safetensors
