# Local keyframe-to-video / 2D in-betweening on Apple Silicon (M3 24 GB) and Anthropic "Claude Motion" — as of 2026-10-21

Scope reminder: animate official Slay the Spire 2 card portraits (~1000x760 source, 250x190 in game) into ~2–5 s loops that start/end on the official art, ~600 cards, free cosmetic mod. Target machine: Apple M3 MacBook, 24 GB unified memory, no NVIDIA GPU. Nothing was installed or downloaded for this research. "Verified" = primary source (model card, README, official docs). "Community claim" = Reddit / blog / single-user report. "Inference" = my own estimate, not measured.

---

## Q1. Which local models can do first+last-frame or multi-keyframe video on an M3 24 GB, and how long per clip?

### Takeaway
The only family with a native, maintained Apple-Silicon path (MLX ports) AND explicit multi-keyframe conditioning is Lightricks' LTX (LTX-2.3 / LTX-2.5 via `ltx-2-mlx` / `ltx-video-swift-mlx`, plus the older small LTX-Video 0.9.x 2B). Measured MLX numbers on an M4 Max (2 s @ 512x512 in ~35 s) suggest a few minutes per 2–4 s clip on a base M3 if a 4-bit 22B pack fits in 24 GB — but no one has published a base-M3/24 GB measurement. Wan 14B first/last-frame (FLF) is technically runnable via GGUF but measured at 82 min for a 2 s clip on an M1 Max (4x the M3's memory bandwidth), so it is impractical for 600 cards locally. Small Wan "Fun-InP" models (1.3B / 5B, Apache-2.0, start+end frame) are the realistic Wan-family option, but no Mac timing exists for them.

### Cited Findings

**Hardware context**
- Base M3 GPU: 10 cores, 102.4 GB/s memory bandwidth; M1 Max 32-core GPU: 409.6 GB/s (4x bandwidth) and ~2.4x the Geekbench 6 Compute score of the M3 10-core GPU — [nanoreview M3 vs M1 Max](https://nanoreview.net/ru/gpu-compare/apple-m3-gpu-10-core-vs-apple-m1-max-gpu-32-core) (third-party spec aggregator).

**Wan 2.2 14B (FLF via ComfyUI) — measured, impractical**
- Article published 2026-03-01 (updated 2026-05-20). M1 Max 64 GB, ComfyUI + ComfyUI-GGUF: Wan 2.2 14B T2V, high-noise + low-noise experts each Q4_K_S (8.75 GB each), umt5-xxl encoder Q8_0 (6.04 GB), 832x480, 33 frames (~2 s @16 fps), 10+10 steps: stage 1 = 41 min 40 s (250 s/step), stage 2 = 39 min 21 s (236 s/step), VAE decode ~1 min 41 s, total 1 h 22 min 45 s. Using `wan2.2_vae` instead of `wan_2.1_vae` crashed at decode after ~80 min (channel mismatch 48 vs 16) — [lilting.ch](https://lilting.ch/en/articles/ltx2-wan22-mac-local-video-gen) (single-author measurement).
- Same article: LTX-2 FP8 checkpoint (`ltx-2-19b-dev-fp8`, 25.22 GB) failed with `RuntimeError: Undefined type Float8_e4m3fn` — Metal does not implement FP8; Gemma-3 "fp4_mixed" text encoder failed for the same reason — [lilting.ch](https://lilting.ch/en/articles/ltx2-wan22-mac-local-video-gen). Corroborated: "fp8 models don't work on metal, use bf16 or GGUF" — [HF LTX-2 discussion #43](https://huggingface.co/Lightricks/LTX-2/discussions/43); ComfyUI crash "Trying to convert Float8_e4m3fn to the MPS backend" — [ComfyUI discussion #13273](https://github.com/Comfy-Org/ComfyUI/discussions/13273).
- Wan 2.2 FLF in ComfyUI exists as GGUF workflows (Q8_0 + 4-step Lightning LoRA) — [Civitai Wan2.2 FLF GGUF 4 steps](https://civitai.com/models/1944974/wan22-first-last-frame-to-video-gguf-4-steps); on an RTX 4090 the official FLF workflow is ~3 min with Lightning LoRA vs ~26 min without (community tutorial) — [stable-diffusion-art.com](https://stable-diffusion-art.com/wan-2-2-first-last-frame-video/).
- Wan2.1-FLF2V-14B-720P: released 2025-04-17, Apache-2.0, "Currently, only 720P is supported", trained mainly on Chinese text-video pairs (Chinese prompts recommended) — [HF model card](https://huggingface.co/Wan-AI/Wan2.1-FLF2V-14B-720P).
- HunyuanVideo (original) on Mac, community: M3 Max 128 GB in ComfyUI ~155 s/step, ~100 GB RAM, ~60 min for 73 frames at 848x480 — [HF tencent/HunyuanVideo discussion #13](https://huggingface.co/tencent/HunyuanVideo/discussions/13) (community claim).

**Wan open-weight status (no Wan 2.5/2.6/2.7 weights)**
- Wan 2.5 (Sept 2025 preview) and Wan 2.6 (Dec 2025) are API-only; Wan-AI on Hugging Face publishes weights only up to Wan 2.2 (T2V-A14B, I2V-A14B, TI2V-5B) plus Wan 2.1; Wan-Dancer-14B (music-to-dance) released 2026-07-13; article dated 2026-07-20 calls Wan 2.7 open-weight claims "SEO fabrications" — [localaimaster, 2026-07-20](https://localaimaster.com/blog/wan-2-7-open-source); [RunPod Wan 2.7 guide](https://www.runpod.io/articles/guides/wan-2-7-runpod). Contradicted only by [Flowith blog](https://flowith.io/blog/wan-2-6-3-0-open-weight-architecture-democratize-ai-film-production/) claiming Apache-2.0 open weights for 2.5/2.6 (treated as unreliable). Wan 3.0 status: only previews/rumor pages found — [youart.ai](https://youart.ai/blog/wan-3-0-release-date).

**Wan 2.2 TI2V-5B and small "Fun-InP" start/end-frame variants**
- Wan2.2-TI2V-5B: Apache-2.0, 5B dense, 720P (1280x704), 24 fps, Wan2.2-VAE 16x16x4 compression; "can run on a GPU with at least 24GB VRAM (e.g., RTX 4090)"; 5 s 720P "in under 9 minutes" on one consumer GPU; first/last-frame not mentioned (T2V + I2V only); released 2025-07-28 — [HF model card](https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B).
- ComfyUI says the Wan2.2 5B "should fit well on 8GB vram with ComfyUI native offloading" — [ComfyUI Wan2.2 docs](https://docs.comfy.org/tutorials/video/wan/wan2_2).
- Wan2.2-Fun-5B-InP (Alibaba PAI): Apache-2.0, "supports first/last frame prediction", trained at 121 frames / 24 fps, 23.0 GB on disk — [HF alibaba-pai/Wan2.2-Fun-5B-InP](https://huggingface.co/alibaba-pai/Wan2.2-Fun-5B-InP). An official ComfyUI template "Wan 2.2 5B Fun Inpaint" interpolates between start and end frames — [comfy.org workflow](https://comfy.org/workflows/video_wan2_2_5B_fun_inpaint-00d3d57a5195/).
- Wan2.1-Fun-1.3B-InP: Apache-2.0, "supports start-and-end frame prediction", multi-resolution training, 19.0 GB weights, tested down to an RTX 3060 12 GB with CPU-offload modes; a 14B-InP sibling also exists (47 GB) — [HF alibaba-pai/Wan2.1-Fun-1.3B-InP](https://huggingface.co/alibaba-pai/Wan2.1-Fun-1.3B-InP).
- Mac measurement for the same 1.3B backbone (T2V, not InP): mlx-video, Wan2.1 T2V 1.3B 4-bit, M2 Max 32 GB, 9 frames, 50 steps: 256x256 = 70 s; 512x512 = 229 s (212 s diffusion); 768x768 = 584 s. T5 encoder alone is ~11 GB bf16. Article dated 2026-05-20. Author says Wan2.2 14B "uses almost all 32GB even with Q4" — [note.com mikai](https://note.com/mikai_daichi/n/nab2a5d452f83?hl=en) (single-author measurement).
- Wan 2.2 TI2V-5B via mlx-video on Mac Studio M5 Max 36 GB: "about 14 min for one 3.4-second clip, 45.7GB of memory" (resolution/steps not stated) — [llmonmac.com](https://llmonmac.com/en/videos).
- Mac status claims (community guides): one guide says Wan 2.2 and HunyuanVideo "do not yet have stable MPS paths as of April 2026"; another lists TI2V-5B via MPS as "slow but works" for 64–128 GB Mac Studios — [localaimaster local video guide](https://localaimaster.com/blog/local-ai-video-generation); default Comfy Wan 2.2 workflow "isn't optimized for Mac silicon", PYTORCH_MPS_HIGH_WATERMARK_RATIO errors — [papayabytes guide](https://papayabytes.substack.com/p/guide-comfyui-and-wan-22-image-to).

**MLX projects (native Apple Silicon)**
- Blaizzy/mlx-video (MIT): supports LTX-2 (19B; distilled/dev/two-stage pipelines), LTX-2.3, Wan2.1 (1.3B/14B T2V), Wan2.2 (T2V-14B, TI2V-5B, I2V-14B); I2V via `--image` for LTX-2 and Wan2.2 I2V-14B; first/last-frame/keyframe NOT mentioned for any model — [GitHub Blaizzy/mlx-video](https://github.com/Blaizzy/mlx-video).
- dgrauet/ltx-2-mlx (MIT code): LTX-2.3 and LTX-2.5 in bf16/int8/int4 packs; dedicated `keyframe` command ("Smooth transition between reference images": `--start frame1.png --end frame2.png`); on LTX-2.5 packs keyframe requires `--dev-transformer`; "32GB+ RAM recommended (int8) or 16GB+ with --low-ram. 16GB minimum (int4 without streaming)"; int4 2.3 pack ~12 GB download; int4 on 32 GB at 97 frames "512x320 is comfortable"; only timing: M1 Max, 2.5 q8, 576x1024x241 distilled I2V 701 s → 563 s with float16 compute — [GitHub dgrauet/ltx-2-mlx](https://github.com/dgrauet/ltx-2-mlx).
- VincentGourbin/ltx-video-swift-mlx: `--keyframe PATH:FRAME_IDX` repeatable (first, middle, last-frame anchors, loop) for LTX-2.3/2.5 — [GitHub](https://github.com/VincentGourbin/ltx-video-swift-mlx). peskyneil/ltx-2-mlx marks LTX-2.5 keyframes "validated end to end" but needs the dev transformer — [GitHub](https://github.com/peskyneil/ltx-2-mlx). janishar/ltx-2-studio: local MLX web studio, pins images at frames (e.g. 0 and 48 of 49) — [GitHub](https://github.com/janishar/ltx-2-studio).
- james-see/ltx-video-mac (MIT app, v2.3.69): "first/last frame and multi-image keyframes" on the LTX path; models include LTX-2.3 Distilled Q4 (~22 GB) and an "LTX-2.3 12GB RAM Optimized" pack (~19 GB, default on ≤16 GB Macs); states minimum RAM 32 GB, 64 GB+ recommended; no timings — [GitHub james-see/ltx-video-mac](https://github.com/james-see/ltx-video-mac).
- Measured LTX-2.3 22B distilled on MLX, M4 Max 128 GB: 576x1024x121 frames (5 s), 8+3 steps: MLX FP16 video-only 152.5 s, peak 34.2 GB; PyTorch MPS bf16 264 s, peak >60 GB; 512x512x49 frames (2 s) = 35.1 s; 320x512x25 frames (1 s) = 10.4 s; card lists 64 GB Mac as minimum for FP16 — [HF gajesh/LTX-2.3-mlx-fp16](https://huggingface.co/gajesh/LTX-2.3-mlx-fp16). 4-bit MLX: ~154 s total, peak ~30 GB, "fits on 32GB Macs" — [HF gajesh/LTX-2.3-mlx-q4](https://huggingface.co/gajesh/LTX-2.3-mlx-q4). Another 4-bit release: 16 GB works with low-RAM mode, 24 GB+ recommended; 24.0 s for a 256x256x17 test — [HF PocketAiHub/LTX-2.3-Distilled-MLX](https://huggingface.co/PocketAiHub/LTX-2.3-Distilled-MLX).
- LTX-2 on Mac via ComfyUI GGUF (M1 Max 64 GB): dev Q4_K_S T2V 512x288x33 frames, 25 steps = 6 min 54 s; dev+distilled-LoRA I2V 768x512x33 = 13 min 42 s; distilled GGUF two-stage produced a broken single-frame output; single-stage distilled I2V (~3 min) was "nearly static" (mean inter-frame diff 1.19). Unattributed reports in the same article: "Mac M3 ~5 minutes, a few seconds"; "Mac M1 16GB ~15 minutes ~4 s" — [lilting.ch](https://lilting.ch/en/articles/ltx2-wan22-mac-local-video-gen) (the M3 figure is an unsourced community claim).
- LTX-2.3: ~22B, frames must be 8n+1, width/height divisible by 32, distilled = 8 steps CFG 1, distilled 1.1 update, temporal upscaler x2 for higher FPS, ComfyUI built-in LTXVideo nodes — [HF Lightricks/LTX-2.3](https://huggingface.co/Lightricks/LTX-2.3). Lightricks release notes list last-frame interpolation for the 22B model (search-snippet only; page could not be fetched) — [ltx.io release notes](https://ltx.io/release-notes).
- LTX-2.5: released 2026-08-11; 22B dev + distilled, Gemma-4 12B text encoder, gated download; LTX-2.x Community License — [gradually.ai](https://www.gradually.ai/en/ai-models/ltx-2-5/), [innfactory](https://innfactory.ai/en/ai-models/lightricks-ltx/); fal's hosted endpoint accepts start + end frame — [fal.ai/ltx-2.5](https://fal.ai/ltx-2.5). LTX-2.5 MLX packs: bf16 ~120 GB, int8 ~75 GB, int4 ~47 GB "lower quality" download — [dgrauet/ltx-2-mlx](https://github.com/dgrauet/ltx-2-mlx).
- Lightricks issue asking for MPS parity: no torch.compile on MPS, IC-LoRAs CUDA-only — [ComfyUI-LTXVideo issue #473](https://github.com/Lightricks/ComfyUI-LTXVideo/issues/473).

**LTX-Video 0.9.x (small, older, multi-keyframe)**
- ltxv-2b-0.9.8-distilled and 13B variants (2025-07-16); keyframe + video extension since v0.9.5 (2025-03-05); "multiple image or video conditions, each placed at a target frame number"; MPS support added 2025-02-20 (tested with PyTorch 2.3.0); repo Apache-2.0; README says v0.9.5 introduced OpenRAIL-M "for commercial use"; LTX-2 is now the primary home for development (2025-10-23) — [GitHub Lightricks/LTX-Video](https://github.com/Lightricks/LTX-Video).

**Draw Things (native Mac app)**
- App Store listing says it supports Wan 2.2 and is optimized for M1/M2/M3 — [App Store](https://apps.apple.com/us/app/draw-things-offline-ai-art/id6444050820). Draw Things wiki (page ~167 days old per search snippet): LTX-2 first-frame/last-frame modes "not available in the app"; "First-to-Last Frame (FFLF) inputs are not implemented"; preliminary Wan 2.2 5B T2V in v1.20250930.0; downloads page shows latest release 2026-10-14 with LTX-2.3 distilled 1.1 update — [Draw Things wiki LTX-2](https://wiki.drawthings.ai/wiki/LTX-2) (fetch returned 503; content from search snippet), [drawthings.ai downloads](https://drawthings.ai/downloads/). Draw Things guide suggests ≥8 GB for video and ≥20 GB for large models — cited via [llmonmac.com](https://llmonmac.com/en/videos).

**FramePack / HunyuanVideo 1.5 / CogVideoX**
- FramePack macOS fork (brandon929/FramePack): author reports ~2.5 min per 1 s of video on M3 Ultra; M4 Max 64 GB ~19 min for 5 s at 416 res, 25 steps; Mac mini M4 24 GB "about a minute per step at 320 resolution"; memory grows per generation (48 GB → 140 GB reported) — [r/StableDiffusion "FramePack on macOS" thread](https://pol1.lr.ggtyler.dev/r/StableDiffusion/comments/1k2neim/framepack_on_macos/mom61ar/?context=3) (community claims, April–May 2025). FramePackI2V_HY weights: 13B, "FramePack for HY" — [HF lllyasviel/FramePackI2V_HY](https://huggingface.co/lllyasviel/FramePackI2V_HY).
- HunyuanVideo 1.5 (8.3B) has native ComfyUI support — [Comfy blog](https://blog.comfy.org/p/hunyuanvideo-15-native-support); no Mac/MPS results found.
- CogVideoX-Fun "InP" models do start/end-frame generation (connect end image = two-point interpolation) — [comfy.icu CogVideoX-Fun node](https://comfy.icu/node/CogVideoXFunInpaintSampler); see Q3 for license.

**AnimateDiff + SparseCtrl**
- SparseCtrl accepts one or a few sparse RGB/sketch/depth inputs; keyframe animation and interpolation are listed uses; RGB encoder `v3_sd15_sparsectrl_rgb.ckpt` ~1.85 GB; SD1.5-based — [Diffusers SparseCtrl docs](https://huggingface.co/docs/diffusers/api/models/controlnet_sparsectrl), [HF guoyww/animatediff-sparsectrl-rgb](https://huggingface.co/guoyww/animatediff-sparsectrl-rgb). No Mac-specific reports found.

### Inferences
- **Realistic per-clip time on M3 24 GB, ~512x384, 2–4 s (all inference, scaled from the measurements above using ~2.5–3x slower than M1 Max/M2 Max and ~4–5x slower than M4 Max):**
  - LTX-2.3 22B distilled, MLX int4 (ltx-2-mlx `keyframe` or swift `--keyframe`): ~2–6 min per 2 s, ~5–12 min per 4 s, *if* it runs within 24 GB (int4 + `--low-ram` streaming is documented for 16 GB; streaming will add overhead). Best candidate. Quality risk: distilled LTX on Mac produced static/broken output in one ComfyUI-GGUF test; MLX ports have not shown this but untested on base M3.
  - LTX-2.5 keyframes: requires the dev transformer (non-distilled, more steps) and ≥47 GB int4 download → likely 3–5x slower than 2.3 distilled and memory-marginal on 24 GB. Treat as impractical locally.
  - LTX-Video 0.9.8 2B distilled (multi-keyframe, MPS): likely ~1–3 min per clip; lower quality, but fastest for prototyping. No Mac measurement found.
  - Wan2.1-Fun-1.3B-InP (start+end, Apache-2.0) via ComfyUI/VideoX-Fun on MPS: ~10–25 min per 2 s clip (1.3B T2V on M2 Max = 212 s for only 9 frames at 512x512, 50 steps; 33 frames ≈ 3–4x the tokens; MPS PyTorch slower than MLX). No MLX port of Fun-InP found.
  - Wan2.2-Fun-5B-InP (start+end, Apache-2.0): ~15–40 min per 2–4 s clip at 512x384 (very rough; only data point is 14 min / 3.4 s on an M5 Max at unspecified resolution with 45.7 GB peak).
  - Wan 2.1/2.2 14B FLF (GGUF Q4): ~1.5–2 h per 2 s clip at 512x384 with 20 steps; ~20–30 min with a 4-step Lightning LoRA; memory-tight on 24 GB (two 8.75 GB experts + 6 GB encoder). Impractical for 600 cards (≥200–1000 GPU-hours).
  - FramePack (13B HunyuanVideo-based) and HunyuanVideo 1.5: impractical (≈1 min/step at 320 px on a 24 GB M4; memory leak reports) and license-blocked in Korea (see Q3).
  - CogVideoX-Fun InP 5B: possible but older/lower quality than Wan/LTX; no Mac numbers.
  - AnimateDiff + SparseCtrl RGB (SD1.5): fast on Mac (SD1.5-class), but known for flicker/identity drift; unlikely to land exactly on a painterly target frame — use only as a fallback.
- At 600 cards, even 5 min/clip = 50 h of generation, before retakes (expect several seeds per card). A realistic local plan is LTX-2.3 int4 MLX for batch work, plus cloud bursts for heavier models.
- Because the in-game display is 250x190, generating at ~512x384 (or 512x320/384x288) and upscaling is sufficient; 8n+1 frame counts (LTX) and 4n+1 (Wan) should be planned for loop lengths.
- To guarantee an exact final frame equal to the official art, the last generated frame should be replaced/cross-faded with the original PNG in post (diffusion VAEs never reproduce the input exactly).

### Gaps
- No published measurement for any video model on a base M3 (10-core GPU) with 24 GB; all M3 figures above are extrapolations.
- Whether `ltx-2-mlx` int4 + `--low-ram` actually completes keyframe mode on 24 GB without swapping was not found.
- No Mac timing for Wan2.1-Fun-1.3B-InP / Wan2.2-Fun-5B-InP / Wan2.1-FLF2V specifically.
- Draw Things wiki page could not be fetched (503); FFLF status relies on a search snippet that may be stale.
- No quality comparison of these models specifically on flat-shaded/painterly 2D card art was found.

---

## Q2. 2D-specific in-betweening and classic frame interpolation (ToonCrafter, Framer, ToonComposer, AnimeInterp, RIFE/FILM/GIMM-VFI)

### Takeaway
ToonCrafter (Apache-2.0 code, 512x320, 16 frames) and ToonComposer (Wan2.1-I2V-14B-based) are the main open cartoon in-betweeners, but neither has documented Mac support; ToonComposer inherits a 14B backbone and is impractical on 24 GB. Classic VFI (RIFE, FILM) runs on Apple Silicon and is fast, but it only fills small motions — useful for fps up-sampling of generated clips, not for "lance spins and flies in" motion.

### Cited Findings
- ToonCrafter: code Apache-2.0; described as "an open-source research exploration, instead of commercial products" (no separate weight license stated); "up to 16 frames with a resolution of 512x320"; original ~24 GB VRAM (24–27 GB in issues), community versions ~10–12 GB fp16; ~24 s on A100 at 50 DDIM steps; sparse sketch guidance; ComfyUI via kijai/ComfyUI-DynamiCrafterWrapper and AIGODLIKE/ComfyUI-ToonCrafter; weights/code released 2024-05-29; no Mac/MPS notes — [GitHub ToonCrafter](https://github.com/ToonCrafter/ToonCrafter). Paper published in ACM TOG; adapts live-action video priors to cartoons with a sketch encoder — [HF paper page](https://huggingface.co/papers/2405.17933).
- ToonComposer (Tencent ARC, ICLR 2026): unifies inbetweening + colorization from sparse sketches and a colored reference frame; weights released 2025-08-15 (480p and 608p); requires Wan2.1-I2V-14B-480P base + ToonComposer weights — [GitHub TencentARC/ToonComposer](https://github.com/TencentARC/ToonComposer), [HF TencentARC/ToonComposer](https://huggingface.co/TencentARC/ToonComposer), [arXiv 2508.10881](https://arxiv.org/abs/2508.10881). Weight license: a third-party FAQ says Apache-2.0, unconfirmed — [xugj520.cn](https://www.xugj520.cn/en/archives/tooncomposer-ai-animation-tool.html).
- Framer (Zhejiang Univ. + Ant Group, ICLR 2025): built on Stable Video Diffusion; 512x320 checkpoint; "For academic use, this project is licensed under the 2-clause BSD License. For commercial use, please contact C Shen" — [arXiv 2410.18978](https://arxiv.org/pdf/2410.18978), [HF wwen1997/framer_512x320](https://huggingface.co/wwen1997/framer_512x320).
- RIFE / FILM on Mac: ComfyUI-Frame-Interpolation's non-CUDA support is "experimental"; M2 Max users hit "MPS: Unsupported Border padding mode" for RIFE and FILM — [PyTorch forum](https://discuss.pytorch.org/t/rife-vfi-error-on-comfyui-on-mac/194087); re-exported Metal-compatible FILM models fix the padding error — [HF jkawamoto/frame-interpolation-pytorch](https://huggingface.co/jkawamoto/frame-interpolation-pytorch); `venhance` CLI runs RIFE v4.7 on MPS at ~51 ms/frame at 720p fp16 on an M5 (MIT) — [libraries.io venhance](https://libraries.io/npm/venhance).
- GIMM-VFI has a ComfyUI node (RAFT / FlowFormer variants); no MPS confirmation found — [RunComfy ComfyUI-GIMM-VFI](https://www.runcomfy.com/comfyui-nodes/ComfyUI-GIMM-VFI).
- PyTorch MPS general: some ops not implemented; `PYTORCH_ENABLE_MPS_FALLBACK=1` falls back to CPU — [Diffusers MPS docs](https://huggingface.co/docs/diffusers/optimization/mps). Historical "Conv3D is not supported on MPS" error with SVD in ComfyUI (Intel Mac, older PyTorch) — [PyTorch forum](https://discuss.pytorch.org/t/will-the-conv3d-operation-be-supported-on-mps-through-pytorch/198233).

### Inferences
- ToonCrafter's 512x320 / 16-frame output is close to the card's 250x190 aspect needs (card art ≈1.32:1 vs 1.6:1 output → crop/pad) and 16 frames @ 8 fps = 2 s; on an M3 it would plausibly take ~5–15 min per clip at 25–50 DDIM steps if the DynamiCrafter wrapper runs on MPS (untested). It was trained on anime-style line art; painterly STS2 art with soft gradients is out of its training domain.
- RIFE/FILM are best used as a final step: generate 8–16 keyframes/sec with a diffusion model, then RIFE to 24–30 fps for smooth hover playback.
- Large non-linear motions (spin + fly-in) are exactly where flow-based VFI fails; generative in-betweeners or keyframe video models are required for those.

### Gaps
- AnimeInterp (2021) and "Tween"/sketch-guided in-betweening models: not researched in depth; no license/Mac data collected.
- GIMM-VFI license not confirmed (search suggested S-Lab non-commercial family but the repo LICENSE was not retrieved).
- ToonCrafter base DynamiCrafter weight license and ToonComposer weight license not verified from primary sources.
- No Mac runs of ToonCrafter/ToonComposer/Framer found.

---

## Q3. Weight licenses for a free, publicly distributed mod

### Takeaway
Clean permissive options: Wan 2.1/2.2 family incl. FLF2V and Fun-InP (Apache-2.0), FLUX.2 klein 4B (Apache-2.0), Qwen-Image-Edit-2511 (Apache-2.0), ToonCrafter code (Apache-2.0). LTX-2.x Community License permits free use for individuals and entities under US$10M revenue and claims no rights in outputs. Avoid HunyuanVideo / HunyuanVideo 1.5 (and HunyuanVideo-derived FramePack) because the Tencent license explicitly excludes South Korea. Framer and CogVideoX-5B are academic/non-commercial-by-default.

### Cited Findings
- Wan2.1-FLF2V-14B-720P: Apache-2.0 — [HF](https://huggingface.co/Wan-AI/Wan2.1-FLF2V-14B-720P). Wan2.2-TI2V-5B: Apache-2.0 — [HF](https://huggingface.co/Wan-AI/Wan2.2-TI2V-5B). Wan2.1-Fun-1.3B-InP and Wan2.2-Fun-5B-InP: Apache-2.0 — [HF 1.3B-InP](https://huggingface.co/alibaba-pai/Wan2.1-Fun-1.3B-InP), [HF 5B-InP](https://huggingface.co/alibaba-pai/Wan2.2-Fun-5B-InP).
- LTX license split: LTX-2 Community License applies to LTX-2 versions since 2026-01-05 "including LTX-2.3 until August 11, 2026"; LTX-2.x Community License applies to all LTX-2.5 versions since 2026-08-11 — [GitHub Lightricks/LTX-2 LICENSE](https://github.com/Lightricks/LTX-2/blob/main/LICENSE). LTX-2.x terms: entities with annual revenue ≥ $10,000,000 need a paid license; individuals may use it "in a personal capacity for research, experimentation, learning"; "Licensor claims no rights in the Output you generate using LTX-2.x"; must disclose machine-generated content when placed in contexts like bot posts (Attachment A item 5); keep attribution notices; worldwide grant except sanctioned parties — [LICENSE-2_x raw](https://raw.githubusercontent.com/Lightricks/LTX-2/main/LICENSE-2_x). LTX-2.3 MLX conversions are tagged `ltx-2-community` — [HF gajesh/LTX-2.3-mlx-fp16](https://huggingface.co/gajesh/LTX-2.3-mlx-fp16).
- LTX-Video 0.9.x: repo Apache-2.0; v0.9.5 (2025-03-05) "introduced a new license for commercial use, OpenRAIL-M" — [GitHub Lightricks/LTX-Video](https://github.com/Lightricks/LTX-Video).
- HunyuanVideo 1.5: Tencent Hunyuan Community License (dated 2025-11-21) "does not apply in the European Union, United Kingdom and South Korea"; use outside Territory is unlicensed; outputs can't train competing models; 100M MAU threshold; some third-party pages wrongly call it Apache-2.0 — [HF tencent/HunyuanVideo-1.5 LICENSE commit](https://huggingface.co/tencent/HunyuanVideo-1.5/commit/8791be83aee30ef7e3bd7c90688a023c3e1df286), [HF tencent/HunyuanVideo LICENSE](https://huggingface.co/tencent/HunyuanVideo/blob/main/LICENSE).
- CogVideoX: code Apache-2.0; CogVideoX-2B weights Apache-2.0; CogVideoX-5B transformer under "CogVideoX LICENSE" — non-commercial by default, commercial use requires registration (free up to 1M visits/month); generated-content IP belongs to the user — [scancode cogvideox-2024](https://scancode-licensedb.aboutcode.org/cogvideox-2024.html), [RunComfy CogVideoX-5B page](https://www.runcomfy.com/comfyui-workflows/cogvideox5b-text-to-video-model-available-in-comfyui).
- Framer: academic BSD-2, commercial "contact" — [HF framer_512x320](https://huggingface.co/wwen1997/framer_512x320).
- ToonCrafter: code Apache-2.0; weights not separately licensed; "research exploration" — [GitHub ToonCrafter](https://github.com/ToonCrafter/ToonCrafter).
- FLUX.2 klein 4B: Apache-2.0 — [HF black-forest-labs/FLUX.2-klein-4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B). Qwen-Image-Edit-2511: Apache-2.0 — [HF Qwen/Qwen-Image-Edit-2511](https://huggingface.co/Qwen/Qwen-Image-Edit-2511).
- MLX port code: mlx-video MIT; ltx-2-mlx MIT; ltx-video-mac MIT (weights not covered by these) — [Blaizzy/mlx-video](https://github.com/Blaizzy/mlx-video), [dgrauet/ltx-2-mlx](https://github.com/dgrauet/ltx-2-mlx), [james-see/ltx-video-mac](https://github.com/james-see/ltx-video-mac).

### Inferences
- Since the mod is free and only the *outputs* (rendered clips) are distributed, the weight license mainly matters for (a) whether use is permitted at all in Korea (Hunyuan: no) and (b) output restrictions. Apache-2.0 models and LTX-2.x (individual, <$10M) are both fine; non-commercial licenses (Framer, CogVideoX-5B without registration) are probably fine for a no-revenue mod but add risk if donations/monetization ever appear.
- FramePack weights are HunyuanVideo-derived ("for HY"), so the Tencent territory exclusion very likely carries over — avoid.
- Separate and bigger issue (out of scope here): the official card art is Mega Crit's IP; model licenses do not grant any right to redistribute derivative works of it.

### Gaps
- FramePack weight license tag not shown on its HF card; carry-over of Tencent terms is inferred.
- FLUX.1 Kontext [dev] license was not re-verified in this session (historically the FLUX.1 [dev] Non-Commercial License, which allows outputs to be used — verify on the HF card).
- LTX-2 (non-2.x) LICENSE-2 text not fetched; assumed similar to LICENSE-2_x.
- SVD (Framer base) and SD1.5/AnimateDiff motion-module licenses not verified.

---

## Q4. Local keyframe-image editing on M3 24 GB (FLUX.2 klein 4B, Qwen-Image-Edit 2509/2511, FLUX Kontext dev)

### Takeaway
FLUX.2 klein 4B (Apache-2.0, 4-step distilled, multi-reference editing, ~8–13 GB) is the clear fit for 24 GB unified memory. Qwen-Image-Edit-2511 (20B, Apache-2.0) is feasible only as a GGUF quant and will be slow (minutes per edit); no Mac benchmarks were found for either.

### Cited Findings
- FLUX.2 klein 4B: "4 billion parameter rectified flow transformer", Apache-2.0, text-to-image + image editing incl. multi-reference, "can run with as little as 13GB VRAM", 4 steps, guidance 1.0 — [HF FLUX.2-klein-4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B).
- Comfy blog (2026-01-15): klein 4B distilled ~1.2 s and 8.4 GB VRAM; 4B base (50 steps) ~17 s, 9.2 GB; 9B distilled ~2 s / 19.6 GB; 9B base ~35 s / 21.7 GB (RTX 5090); single- and multi-reference editing; BF16/FP8/NVFP4 releases; inconsistency: 9B distilled described as API-only yet an HF repo is listed — [Comfy blog](https://blog.comfy.org/p/flux2-klein-4b-fast-local-image-editing).
- Qwen-Image-Edit-2511: ~20B BF16, Apache-2.0, upgrade of 2509 with reduced drift, better character consistency, built-in popular LoRAs (lighting, new viewpoint); quick-start uses 40 steps, true CFG 4.0 — [HF Qwen-Image-Edit-2511](https://huggingface.co/Qwen/Qwen-Image-Edit-2511). GGUF builds exist (Unsloth, via ComfyUI-GGUF) — [HF unsloth/Qwen-Image-Edit-2511-GGUF](https://huggingface.co/unsloth/Qwen-Image-Edit-2511-GGUF).
- Speed comparisons (NVIDIA): klein 3.6 s vs Qwen Image Edit 2511 Lightning 7.7 s for a 1024² edit — [Sogni blog](https://blog.sogni.ai/blogs/flux-3-image-klein-vs-turbo-models/); Qwen-Image FP8 peaks ~22.9 GB, klein 4B FP8 ~6.2 GB — [localaimaster VRAM calculator](https://localaimaster.com/tools/image-model-vram-calculator); one user ~40 s/edit for Qwen-Image-Edit on an unspecified PC — [HF discussion](https://huggingface.co/Phr00t/Qwen-Image-Edit-Rapid-AIO/discussions/243).
- MPS caveat: FP8/NVFP4 checkpoints won't run on Metal (see Q1 FP8 findings); MPS bf16 matmul reported ~2x slower than fp16 (community blog) — [lilting.ch MPS tag](https://lilting.ch/en/tags/MPS).
- Mac image-generation ballpark (third-party blog, still images, not edit-specific): M3 Pro/M4 Pro 24–36 GB ~25–40 s per image; M4 Max 48 GB+ ~12–20 s — [thinkdifferent.blog](https://www.thinkdifferent.blog/blog/run-stable-diffusion-on-your-mac-no-cloud-no-limits-no-cost/).

### Inferences
- klein 4B on a base M3 (BF16 weights, ~8–13 GB): roughly 20–60 s per 1024x768 edit at 4 steps — practical for generating 1–3 extra keyframes per card (~600–1800 edits ≈ 5–30 h total).
- Qwen-Image-Edit-2511 on 24 GB: needs Q4/Q5 GGUF transformer (~11–14 GB) plus the Qwen2.5-VL text encoder; with 40 steps expect several minutes per edit; with a Lightning 4–8-step LoRA maybe ~1–3 min. Memory pressure/swap likely. Best reserved for hard edits (e.g., removing the lance to make a "before" keyframe) or run in the cloud.
- FLUX.1 Kontext dev (12B) is a middle option on 24 GB via GGUF but is superseded by klein for this use and carries a non-commercial-style license (see Q3 gap).
- Draw Things is a possible GUI for klein/Qwen edits on Mac, but model support was not verified in this session.

### Gaps
- No measured Mac timings for klein 4B, Qwen-Image-Edit-2509/2511, or Kontext dev.
- Draw Things / MLX support for FLUX.2 klein editing and Qwen-Image-Edit not verified.

---

## Q5. Free cloud GPU options (Colab, Kaggle, Lightning.ai, HF ZeroGPU) — limits in 2026 and suitability

### Takeaway
Official HF ZeroGPU docs give free accounts 5 min/day of GPU (half an RTX Pro 6000 Blackwell, 48 GB) and let free accounts host 2 ZeroGPU Spaces — enough for a handful of clips/day. Kaggle (~30 GPU-h/week, P100 or 2xT4, third-party figure) and Lightning.ai (~80 free GPU-hours on interruptible machines, T4 75 h / L4 31 h / A100 10 h starting credit) are the most useful for batch work. Colab free forbids driving a web UI (e.g., ComfyUI via tunnel) on free runtimes; notebook-driven scripts are fine.

### Cited Findings
- HF ZeroGPU (official docs): daily quota — unauthenticated 2 min, free account 5 min, PRO 40 min (extensible with credits at $1 per 10 min), Team 40 min, Enterprise 60 min; quota resets 24 h after first use; GPUs = half RTX Pro 6000 Blackwell (48 GB, default) or full (96 GB, 2x quota); Gradio SDK only; default 60 s per call, custom `duration` allowed; free accounts in good standing (verified email, >30 days) can host up to 2 ZeroGPU Spaces; PRO gets 8x usage quota — [HF ZeroGPU docs](https://huggingface.co/docs/hub/spaces-zerogpu). Existing public Spaces for Wan 2.2 FLF exist (e.g. multimodalart/wan-2-2-first-last-frame) — [HF Space](https://huggingface.co/spaces/multimodalart/wan-2-2-first-last-frame/tree/06ce900e36b56a2f3a4d2fd1ade220d6bded285c/custom_nodes).
- Google Colab (official FAQ): no published limits ("vary over time"); free notebooks run "at most 12 hours"; disallowed on free runtimes: "remote control such as SSH shells, remote desktops", "bypassing the notebook UI to interact primarily via a web UI", "running distributed computing workers"; disallowed everywhere: "creating deepfakes", file hosting/media serving, etc. — [Colab FAQ](https://research.google.com/colaboratory/faq.html). Free GPU usually T4, sometimes P100; ~90 min idle disconnect (third-party) — [aimultiple](https://aimultiple.com/free-cloud-gpu).
- Kaggle: ~30 GPU-hours/week, P100 16 GB or 2x T4; session cap reported as 9 h or 12 h (sources conflict); quota resets Saturday 00:00 UTC (one source); internet needs phone verification — [aimultiple](https://aimultiple.com/free-cloud-gpu), [gmicloud](https://www.gmicloud.ai/en/blog/best-free-gpu-cloud-options-for-ai-startups-and-researchers), [clusy.io](https://www.clusy.io/compare/colab-vs-kaggle) (all third-party; official Kaggle doc page returned no content).
- Lightning.ai (official pricing page): "80 free GPU hours to start"; 5 credits on sign-up + 25 after adding a card (up to 30), expire after 12 months; "~80 GPU hours on interruptible machines"; free hours to start: T4 75, L4 31, L40S 5, RTX Pro 6000 3, A100 40GB 10; phone verification required; 1 free active Studio, restart every 4 h, 10 GB free storage; on-demand T4 $0.55/h, L4 $0.79/h, L40S $3.54/h (page lists interruptible prices higher than on-demand — apparent inconsistency) — [Lightning pricing](https://lightning.ai/pricing).

### Inferences
- ZeroGPU free (5 min/day, 48 GB Blackwell): a self-hosted Gradio Space running Wan 2.2 14B FLF with a 4-step Lightning LoRA at 480p, or LTX-2.3 distilled keyframes, could plausibly produce ~3–10 short clips/day; 600 cards would take months on free quota, ~2–4 weeks on PRO (40 min/day). Model loading time inside `@spaces.GPU` also counts, so models must be loaded at module level as the docs require.
- Kaggle 2xT4 / P100 (16 GB each, no bf16 tensor cores, no FP8): Wan 2.2 5B / Fun-5B-InP, Wan 2.1 FLF 14B in GGUF, ToonCrafter fp16 (~12 GB), LTX-Video 2B and FLUX.2 klein should run headless; LTX-2.3 22B needs GGUF/offload and will be slow. ~30 h/week is the best free batch budget.
- Lightning's free T4/L4 hours (75/31 h) are a one-time starter budget; L4 (24 GB, Ada, FP8-capable) is the best free card for Wan 14B FLF with FP8 + Lightning LoRA.
- Colab free: run ComfyUI headless via its API from notebook cells, not via the web UI, to stay within the FAQ rules.

### Gaps
- No official Kaggle documentation retrieved; 30 h/week is a widely repeated third-party figure.
- No measured times for Wan/LTX/ToonCrafter on T4/P100 in 2026 found.

---

## Q6. Claude Motion — what it is, access, limits, export (official sources)

### Takeaway
Claude Motion (beta, announced 2026-10-08) is NOT a video-generation model: per Anthropic, "It doesn't use a video generation model, so there's no generated footage and no AI-generated people." Claude writes code that animates text, charts, shapes and images you provide, plays it like a short video, lets you edit it, and exports MP4. It is available only on Team and Enterprise plans (not Free/Pro/Max). Anthropic publishes no resolution, fps, max length, or alpha/transparency spec.

### Cited Findings
- Official launch post (dated 2026-10-08): "Claude builds an animation from your prompt, and it plays like a short video"; "It doesn't use a video generation model, so there's no generated footage and no AI-generated people"; "Claude writes code that animates your text, charts, shapes, and images, so you can change any word, number, or timing"; adjust in editor or by asking Claude, "then download it as an MP4 file"; "Claude Motion is in beta on Team and Enterprise"; typing "/motion" in the message box brings up Motion; can open animations in Adobe, Descript, HeyGen, Higgsfield, invideo, Luma AI, Runway (Canva, Captions "coming soon"); Docs/Slides/Design left beta at the same time — [claude.com dashboards-and-motion](https://claude.com/resources/articles/dashboards-and-motion).
- Official help article: turns content into short animated videos (explainers, animated charts, product walkthroughs); attach reports, data or images; "Claude Motion doesn't use a video generation model" (can't create realistic footage or people); Export → MP4 (only format listed); animations private by default, saved in the Artifacts tab; on by default for Team, off for Enterprise until an Owner enables it in Organization settings > Artifacts (can be limited to groups); counts toward plan usage limits, "longer or more complex animations use more of your limit" — [support.claude.com: Get started with Claude Motion](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion).
- Plan matrix (third-party summary of Anthropic pricing page): not on Free, Pro, Max; included on Team Standard/Premium and Enterprise; no separate Motion fee; Oct 1–15, 2026 artifact usage promotion (Team) — [eesel.ai](https://www.eesel.ai/blog/claude-motion), [eesel.ai review](https://www.eesel.ai/blog/claude-motion-review); pricing page shows Motion unavailable on Free/Pro/Max — [claude.com/pricing](https://claude.com/pricing).
- Motion artifacts on HIPAA-ready configurations "aren't covered under your Business Associate Agreement"; outside sharing capped at 50 invitees per artifact (per eesel's reading of Anthropic docs) — [eesel.ai](https://www.eesel.ai/blog/claude-motion).
- Not specified anywhere official: resolution, frame rate, max duration, transparency/alpha, image-sequence export, rendering stack — [kingy.ai](https://kingy.ai/blog/claude-dashboards-motion-beta-pricing-design-animation/); [testingcatalog](https://www.testingcatalog.com/claude-launches-dashboards-and-motion-in-beta/) (says Anthropic describes animations written "as code, with no video model involved"; no hands-on details). A Claude Design MP4 export has no alpha channel (transparent areas become solid) — [theaiautomators](https://www.theaiautomators.com/stunning-motion-graphic-overlays-in-claude-design/). Claims of "4K 60 fps" come from unrelated third-party sites (claudevideo.io, claude2video.com), not Anthropic — [claudevideo.io](https://claudevideo.io/claude/motion-graphics).
- Output ownership: Anthropic Commercial Terms (which govern Team/Enterprise): Anthropic agrees Customer "(b) owns its Outputs" and "hereby assigns to Customer its right, title and interest (if any) in and to Outputs" — [Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms). No Motion-specific output-license text found.
- Third-party explainers exist at eesel.ai, aiwiki.ai (fetch rate-limited, HTTP 429), ud.hk (not fetched), medium, pasqualepillitteri.it, cellcog.ai, alphasignal.ai — consistent with the above — [search results](https://www.eesel.ai/blog/claude-motion), [alphasignal](https://alphasignal.ai/news/anthropic-ships-claude-dashboards-and-motion-to-turn-data-into-auditable).

### Inferences
- Claude Motion cannot invent new imagery (no frost particles painted in the card's style, no new lance poses); anything that moves must be supplied as an image or drawable as code shapes/text/charts.
- A user on Pro or Max cannot access it today; a Team seat is the minimum.
- MP4-only export with no documented alpha means it can only produce a full-frame rectangular clip (the art box), not a transparent overlay — acceptable for a card art box, but not for effects that spill over the frame.

### Gaps
- Exact rendering technology (HTML/CSS/JS, canvas, Remotion-like) not disclosed.
- Resolution, fps, duration cap, and alpha support undocumented; no hands-on review found that measured them.
- Whether uploaded images can be arbitrarily transformed (rotate/scale/path), layered with z-order, masked, or used as cut-outs is not stated in any official source (plausible given "animates ... images", but unverified).
- Anthropic usage policy specifics for animating third-party copyrighted art (Mega Crit's) not researched.

---

## Q7. Could Claude Motion produce motion-graphics card animations from provided layers, and how does that compare to Godot AnimationPlayer?

### Takeaway
Plausibly yes for "cut-out" motion graphics (layers rotate/fly in/scale/fade, provided effect sprites appear and grow), since Motion animates supplied images via editable code — but it outputs MP4 only, which Godot 4 cannot play natively (Ogg Theora only, CPU-decoded, no alpha except chroma key). Doing the same keyframing directly in Godot's AnimationPlayer (which can animate "anything available in the Inspector") on layered sprites gives resolution-independent, tiny, natively looping results with exact final frames, and requires no Team plan.

### Cited Findings
- Motion animates "text, charts, shapes, and images" supplied by the user, with editable timing — [claude.com launch post](https://claude.com/resources/articles/dashboards-and-motion); export MP4 only — [support.claude.com](https://support.claude.com/en/articles/17454997-get-started-with-claude-motion).
- Godot 4 core video: Ogg Theora only; H.264/H.265 can't be supported in core due to patents; WebM removed in 4.0; decoding on CPU; recommended ≤1080p@30 desktop; transparency only via chroma-key shader; non-zero Video Delay Compensation can break seamless loops; conversion `ffmpeg -i input.mp4 -q:v 6 -q:a 6 -g:v 64 output.ogv` — [Godot docs: Playing videos](https://docs.godotengine.org/en/stable/tutorials/animation/playing_videos.html).
- Godot AnimationPlayer: can animate "anything available in the Inspector" (transforms, sprites, UI, particles), modify script variables and call functions; per-track interpolation Nearest/Linear/Cubic (+ Linear/Cubic Angle for rotation); per-key easing; Clamp vs Wrap loop interpolation — [Godot docs: Introduction to animation](https://docs.godotengine.org/en/stable/tutorials/animation/introduction.html).

### Inferences
- For the Ice Lance example (lance cut-out spins + flies in, effect sprites appear and grow, end on the official art): this is a 2D compositing problem, not a generative one. Pipeline: separate the lance/effects from the background (image-edit model or manual), then keyframe position/rotation/scale/modulate in Godot. The final keyframe = all layers at rest = pixel-exact official art, and loops are trivial.
- Claude Motion would add value only as a *prototyping/preview* tool (prompt-to-timing), and its MP4 would then need conversion to .ogv; dozens of simultaneously visible cards each decoding Theora on the CPU (e.g., a full deck view) would be costlier than sprite transforms. AnimationPlayer data is a few KB per card versus MB-scale video.
- Claude (in Claude Code) can equally write Godot `.tscn`/`.tres` AnimationPlayer resources or GDScript tweens directly from a description, achieving the "code-based animation" benefit of Motion without the plan restriction or MP4 conversion — this is the most efficient route for "motion graphics" style cards; generative video models are only needed where genuinely new painted frames (deformation, new poses, painterly effects) are required.
- Hybrid: generate effect sprites/sequences (frost burst, particles) with image models or Godot GPUParticles2D, and use generative keyframe video only for the subset of cards where cut-out motion looks wrong.

### Gaps
- No hands-on test of Claude Motion with layered PNG cut-outs found; transform capabilities unverified.
- No benchmark of many simultaneous Theora VideoStreamPlayers in Godot 4 (STS2's engine) found.
- How STS2 mods can hook card-portrait rendering (replace TextureRect with an animated scene) was out of scope.
