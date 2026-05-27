# Installation Wizard

**Priority:** high

## Goal

Provide a guided first-run setup experience after a fresh GitHub clone that walks the user through connecting YAAIIC to ComfyUI and Ollama, then automatically downloads all required ComfyUI extensions and models and requests Ollama to pull any required LLM models. The wizard depends on the Settings Page (config screen) and replaces the standalone auto-model-download feature.

## Notes

- Prerequisites that must exist before this feature can be built: Settings Page (config screen), and the model self-install capability (formerly tracked in auto-model-download).
- Wizard steps (rough order): configure ComfyUI connection → configure Ollama connection → install ComfyUI custom nodes/extensions → download ComfyUI models → pull Ollama models.
- Model downloads from Hugging Face (previously tracked separately in auto-model-download.md) are now part of this wizard's model install step. Known model URLs are documented in the absorbed auto-model-download file.
- ComfyUI extension install: needs a mechanism to install custom nodes (e.g. ComfyUI Manager API or direct git clone).
- Ollama model pull: call Ollama's `/api/pull` endpoint for each required model.
- Should be skippable / re-runnable for users who want to add models later.
- Open question: how does the wizard know which models are "required" for the currently configured workflows?

## Absorbed: Known Model URLs (from auto-model-download)

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
