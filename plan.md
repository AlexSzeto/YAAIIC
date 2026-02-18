# Bugs

# Future Features
- Higher Quality Flux Klein (add a field to use 9b param model for generation)
- Cancel generation (replace generation button)
- Cropping (similar to inpaint, but "execution" crops the image, and instead of a generation menu there are image ratio options and 1/3 guide toggle)
- Add math ops for pre/post generation tasks. Convert the Wan5b video length math calculation into a process. Add 5 frames to Wan5b video length, and then convert the video length in pre-gen.
- Allow processes to report progress. For workflows, report this using workflow completion percentage; For frame blend, use the current frame being blended to calculate the completion percentage.
- Add versioning to config/default config. If there's a newer version default config, create new fields that currently didn't exist in config.
- Wan22 video loop (add workflow)
- Add status endpoint and allow client to poll it to see if ollama/comfyui is running, and recover progress report from tasks currently in progress
- Add watch mode for config files (config.json, comfyui-workflows.json). If any of these files change, reload the config and workflows.
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

- Download URLs for Low Quant Album Gen:
1. https://huggingface.co/Old-Fisherman/SDXL_Finetune_GGUF_Files/blob/main/GGUF_Models/juggernautXL_juggXIByRundiffusion_Q4_K_S.gguf