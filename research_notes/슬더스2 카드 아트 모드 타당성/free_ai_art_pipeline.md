# Free (Zero-Cost) AI Tooling for Animating STS2 Card Art — Workers AI First, Local M3 Second

Research date: 2026-10-18. All prices/limits verified on the pages cited on that date unless marked otherwise. "Free" below means no payment method required unless explicitly flagged.

Neuron arithmetic used throughout: Workers AI free allowance = 10,000 Neurons/day. A 1024x1024 image = 4 tiles of 512x512 = 1 megapixel. A typical STS2 portrait (~1000 px wide, taller than wide) at e.g. 1024x1536 = 6 tiles. Image-count figures are my calculations from the official per-unit prices and are labelled as inferences.

---

## 1. Cloudflare Workers AI (Oct 2026): free allowance, image model catalog, capabilities, per-image cost, video/segmentation/depth, output licensing

### Takeaway
Workers AI gives 10,000 free Neurons/day (reset 00:00 UTC) and, as of the 2026-10-15 pricing page, hosts ten text-to-image models; the only free-tier-friendly model that does real reference-image editing at useful volume is **FLUX.2 [klein] 4B** (~79–95 1-MP images/day, Apache-2.0 weights), while FLUX.2 [dev] (~2/day), klein 9B (~6–7/day) and the Leonardo models (~3–4/day) are too expensive for the free allowance. There is no video, depth, or segmentation model in the image catalog, and the only mask-based inpainting model is the old beta SD 1.5 inpainting.

### Cited Findings
**Free allowance & price**
- Free allocation is 10,000 Neurons per day at no charge, resetting daily at 00:00 UTC; usage above that is billed at $0.011 per 1,000 Neurons on Workers Paid. Page last updated 2026-10-15. — [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

**Image model catalog (Text-to-Image filter, fetched 2026-10-18) — 10 models**
- `dreamshaper-8-lcm` (Lykon, SD fine-tune); `flux-1-schnell` (BFL, 12B); `flux-2-dev` (BFL, "multi-reference support"); `flux-2-klein-4b` (BFL, "handles both generation and editing"); `flux-2-klein-9b` (BFL, "multi-reference editing"); `lucid-origin` (Leonardo); `phoenix-1.0` (Leonardo); `stable-diffusion-v1-5-inpainting` (RunwayML, **Beta**, inpainting); `stable-diffusion-xl-base-1.0` (Stability, **Beta**); `stable-diffusion-xl-lightning` (ByteDance, **Beta**). No model is listed under an image-to-image category and no video models appear. — [Workers AI models, Text-to-Image](https://developers.cloudflare.com/workers-ai/models/?tasks=Text-to-Image)
- The older `stable-diffusion-v1-5-img2img` model did not appear in the Text-to-Image listing fetched on 2026-10-18 (img2img is still possible via the inpainting model's `image_b64` + `strength` fields, below). — [Workers AI models](https://developers.cloudflare.com/workers-ai/models/?tasks=Text-to-Image)

**Per-unit Neuron prices (pricing page, 2026-10-15)**
| Model | Unit | Neurons | USD |
|---|---|---|---|
| flux-1-schnell | per 512x512 tile | 4.80 | $0.0000528 |
| | per step | 9.60 | $0.0001056 |
| lucid-origin | per 512x512 tile | 636.00 | $0.006996 |
| | per step | 12.00 | $0.000132 |
| phoenix-1.0 | per 512x512 tile | 530.00 | $0.005830 |
| | per step | 10.00 | $0.000110 |
| flux-2-dev | per input 512x512 tile, per step | 18.75 | $0.00021 |
| | per output 512x512 tile, per step | 37.50 | $0.00041 |
| flux-2-klein-4b | per input 512x512 tile | 5.37 | $0.000059 |
| | per output 512x512 tile | 26.05 | $0.000287 |
| flux-2-klein-9b | per first megapixel (1024x1024) | 1,363.64 | $0.015 |
| | per subsequent megapixel | 181.82 | $0.002 |
| | per input image megapixel | 181.82 | $0.002 |
— [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/). SDXL base, SDXL Lightning, DreamShaper and SD 1.5 inpainting are **not on the pricing table**; the SD 1.5 inpainting model page lists "Unit Pricing: $0.00 per step". — [SD 1.5 inpainting model page](https://developers.cloudflare.com/workers-ai/models/stable-diffusion-v1-5-inpainting/index.md)

**Capabilities / parameters**
- SD 1.5 inpainting (Beta): `prompt`, `negative_prompt`, `width`/`height` 256–2048, `image`/`image_b64` "for use with img2img tasks", `mask` array "for inpainting", `num_steps` default 20 / max 20, `strength` 0–1 ("lower values make the output closer to the input image"), `guidance` default 7.5, `seed`. License link: RunwayML stable-diffusion LICENSE. — [SD 1.5 inpainting model page](https://developers.cloudflare.com/workers-ai/models/stable-diffusion-v1-5-inpainting/index.md)
- FLUX.2 [dev] on Workers AI (launched 2025-11-25): multi-reference images "up to 4", sent as multipart form data; inputs "(up to 4 512x512 images)"; "output images up to 4 megapixels"; example uses `steps=25`, `width=1024`, `height=1024`; style-transfer example prompt "take the subject of image 2 and style it like image 1"; no mention of inpainting/masks. — [Cloudflare blog: FLUX.2 on Workers AI](https://blog.cloudflare.com/flux-2-workers-ai)
- The launch changelog words the input limit as images "smaller than 512x512" and says fields must be named `input_image_0`, `input_image_1`, … (sources slightly inconsistent on exact vs. maximum 512x512). — [CF changelog 2025-11-25](https://developers.cloudflare.com/changelog/2025-11-25-flux-2-dev-workers-ai/)
- FLUX.2 klein 4B (added 2026-01-15) and klein 9B (added 2026-01-28) also accept up to 4 image inputs per their changelog entries (the 512x512 limit is not restated there). — [CF changelog klein 4B](https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/); [CF changelog klein 9B](https://developers.cloudflare.com/changelog/2026-01-28-flux-2-klein-9b-workers-ai/)
- The flux-2-dev / klein-4b / klein-9b model pages only show a required `multipart{}` input and a Base64 `image` output; they are marked "Partner: Yes" and link "Terms and License" to bfl.ai's terms of service. No mask parameter is documented. — [flux-2-klein-4b page](https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/); [flux-2-dev page](https://developers.cloudflare.com/workers-ai/models/flux-2-dev/)

**Video / segmentation / depth**
- The pricing page lists no image-to-image, segmentation, depth, or video models; the Text-to-Image catalog lists no video models. — [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/); [Workers AI models](https://developers.cloudflare.com/workers-ai/models/?tasks=Text-to-Image)

**Licensing of outputs/weights**
- FLUX.2 [klein] 4B weights: Apache 2.0, "Open weights available for commercial use under the Apache 2.0 license"; ~13 GB VRAM; 4-step distilled (Diffusers example: 4 steps, guidance 1.0); outputs may carry pixel watermark/C2PA when using BFL's code/API. — [HF model card FLUX.2-klein-4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B)
- FLUX.2 [klein] 9B and FLUX.2 [dev] are under the FLUX Non-Commercial License; one guide says outputs may be used commercially while serving the model commercially needs a BFL license, while another summary only stresses the model-use restriction (sources disagree on output rights). — [invideo FLUX guide, Aug 2026](https://invideo.io/blog/flux-ai-image-generator/); [canirun.ai FLUX non-commercial license](https://canirun.ai/license/flux-non-commercial/); [VentureBeat on klein launch](https://venturebeat.com/technology/black-forest-labs-launches-open-source-flux-2-klein-to-generate-ai-images-in)

### Inferences
- **Free images/day (my arithmetic from the official unit prices; 10,000 N/day):**
  - flux-1-schnell, 1024x1024, 4 steps: 4×4.8 + 4×9.6 = 57.6 N → **~173/day**; 1024x1536 (6 tiles), 4 steps: 67.2 N → ~148/day. Text-to-image only on CF (no reference image) → useless for "match this exact painting", OK for throwaway sprite ideas.
  - **flux-2-klein-4b**, 1024x1024 text-to-image: 4×26.05 = 104.2 N → **~95/day**; edit with one 1024x1024 reference (4 input tiles, +21.5 N) → ~126 N → **~79/day**; with four 1-MP references → ~190 N → ~52/day. Paid overflow would be ~$0.0011–0.002 per image.
  - flux-2-klein-9b, 1 MP: 1,363.64 N → **~7/day**; with one 1-MP reference → ~1,545 N → ~6/day.
  - flux-2-dev, 1024x1024 at 25 steps: 4×25×37.5 = 3,750 N → **~2/day** (with one 512² reference +469 N → still 2/day; four refs → 1/day). Effectively unusable on free tier.
  - lucid-origin 1024² @25 steps ≈ 2,844 N → ~3/day; phoenix-1.0 ≈ 2,370 N → ~4/day.
  - SD 1.5 inpainting / SDXL / SDXL Lightning / DreamShaper: apparently unbilled while in Beta (based on the "$0.00 per step" label and absence from pricing table) → effectively unlimited within rate limits, but these are 2022–2023-era models whose painterly fidelity at ~1000 px is far below FLUX.2.
- Because FLUX.2 on Workers AI exposes no mask parameter, "inpainting" with klein-4b is prompt-driven editing of the whole frame; to keep the original art bit-exact outside the hole, the result must be composited back through your own mask (standard practice; easy in any image tool).
- The 512x512 reference-image cap documented for flux-2-dev means a ~1000 px card portrait must be downscaled as a reference, which weakens texture/brushstroke matching; for klein the cap is undocumented — test it.
- The Cloudflare free allowance on the Workers Free plan should not require a card (usage above 10k simply fails rather than bills) — this is how the pricing page reads ("billed on Workers Paid for usage above"), but I did not find an explicit "no card required" statement.
- For a free, non-commercial mod, even the FLUX non-commercial licenses are probably not a blocker, but klein 4B (Apache 2.0) is the cleanest choice. Not legal advice.

### Gaps
- Exact klein-4b/9b input-image size limits and max output resolution on Workers AI (schemas are behind `schema-input.json`, not rendered on the pages).
- Whether Workers AI enforces per-minute rate limits on Beta image models that would cap the "free" SD/SDXL usage.
- Full Workers AI catalog for non-image tasks (e.g., object detection) was not re-checked; I found no segmentation-mask or monocular-depth model.
- BFL's own terms (bfl.ai/legal/terms-of-service) regarding output ownership via partner hosting were not fetched.

---

## 2. Other free hosted options (Google AI Studio/Gemini, Hugging Face ZeroGPU, Replicate/fal, Stability, Krea/Leonardo)

### Takeaway
As of 2026-10-16 the Gemini API has **no free tier for any image or video model** (Nano Banana family, Veo), so Google is not a zero-cost option via API; Hugging Face ZeroGPU gives a free account only **3.5 GPU-minutes/day**, enough for a few trial runs of hosted Spaces (e.g., the official Qwen-Image-Layered demo) but not a production pipeline. Other commercial hosts were not verified in this pass.

### Cited Findings
- Gemini API (Standard tier) free-tier column shows "Not available" for Gemini 2.5 Flash Image (paid $0.039/image), Nano Banana 2.1, Gemini 3.1 Flash Image (Nano Banana 2, $0.067 per 1K image), 3.1 Flash Lite Image, Gemini 3 Pro Image (Nano Banana Pro, $0.134 per 1K/2K image), Veo 3.1 Standard/Fast/Lite, and Gemini Omni Flash video. Page last updated 2026-10-16. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Same page: free-tier data is marked "Used to improve our products: Yes", paid "No"; Gemini 2.5 Flash Image is listed as deprecated with shutdown scheduled for October 2, 2026 (the page still lists it after that date — possibly stale). — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Hugging Face ZeroGPU daily quota: 2 min unauthenticated, 3.5 min free account, 25 min PRO; larger GPU sizes (`xlarge`) consume 2× quota; PRO can extend with prepaid credits ($1 per 10 min) per official docs (a forum thread disputes the credits detail). Quota resets 24 h after first use (forum). — [HF ZeroGPU docs](https://huggingface.co/docs/hub/spaces-zerogpu); [HF forum on reset](https://discuss.huggingface.co/t/what-is-the-daily-quota-for-zerogpu-for-pro-users/133470)
- An official Qwen-Image-Layered demo Space exists (huggingface.co/spaces/Qwen/Qwen-Image-Layered), plus a ModelScope Studio demo. — [Qwen-Image-Layered GitHub](https://github.com/QwenLM/Qwen-Image-Layered)

### Inferences
- Gemini image editing (Nano Banana) is arguably the strongest "edit this exact painting" tool among hosted services, but via API it costs money (~$0.04–0.13/image); it fails the "truly free" priority unless the consumer Gemini app/AI Studio playground offers free generations (unverified here) — and free-tier inputs may be used for training, which is an extra concern when uploading Mega Crit's art.
- ZeroGPU's 3.5 min/day is best used for one-off evaluation of heavy models you cannot run well locally (Qwen-Image-Layered, Qwen-Image-Edit) before deciding whether to run them locally.

### Gaps
- Replicate, fal.ai, Stability AI, Krea, Leonardo.ai free plans/credits were **not verified** in this research pass (time budget); do not cite figures for them without checking.
- Whether the consumer Gemini app or the AI Studio web playground currently allows free Nano Banana image edits, and with what daily cap.
- Hugging Face Inference Providers monthly free credits (separate from ZeroGPU) not verified.

---

## 3. Local free options on Apple M3 / 24 GB unified memory

### Takeaway
On a base M3 with 24 GB, **image** tasks are practical (FLUX.2 klein 4B ~13 GB, deterministic matting/depth models are light), while **image-to-video is impractical**: the best Mac data points found are tens of minutes per few-second clip even on much faster M1 Max/64 GB machines. Draw Things (free, Mac-native) already supports FLUX.2, Qwen Image and Qwen Image Edit 2511; layer decomposition (Qwen-Image-Layered), matting (BiRefNet, SAM 2), depth (Depth Anything V2 Small) and RIFE interpolation are all open source.

### Cited Findings
**Image generation / editing**
- Draw Things (free Mac/iOS app) lists SDXL, FLUX.1, Qwen Image, Z Image and FLUX.2 among supported models, added Qwen Image Edit 2511 for editing, and states it is optimized for Apple Silicon (M1/M2/M3) — no timings given. — [Draw Things App Store](https://apps.apple.com/us/app/draw-things-offline-ai-art/id6444050820)
- FLUX.2 klein 4B on an **M1 Max**: 1024 px image in ~30–40 s with mflux / iris.c (one log: 41.5 s total for a 4-step run). — [lilting.ch klein 4B on M1 Max](https://lilting.ch/en/articles/flux2-klein-4b-mflux-iris-m1-max)
- FLUX.2 klein 9B at 1024x1024: M3 Max 105 s, M4 Max 85 s, M2 Max 145 s (tool/quantization not clearly stated — treat as rough). — [lilting.ch klein on Apple Silicon](https://lilting.ch/en/articles/flux2-klein-apple-silicon)
- FLUX.2 klein 4B needs "as little as 13GB VRAM". — [HF FLUX.2-klein-4B](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B)

**Layer decomposition / segmentation**
- Qwen-Image-Layered (Alibaba/HKUST; arXiv 2512.15603, CVPR 2026): decomposes a single RGB image into a variable number of semantically separated RGBA layers (examples with 3, 4, 8 layers; any layer can be recursively decomposed); Apache 2.0; weights released 2025-12-19; recommended resolution 640 (1024 bucket also exists); text prompt describes the whole image and "does not control the content of individual layers"; README quick-start targets CUDA bf16 and gives no VRAM figure; ComfyUI not mentioned. — [Qwen-Image-Layered GitHub](https://github.com/QwenLM/Qwen-Image-Layered); [arXiv 2512.15603](https://arxiv.org/html/2512.15603v1); [CVPR 2026 paper](https://openaccess.thecvf.com/content/CVPR2026/html/Yin_Qwen-Image-Layered_Towards_Inherent_Editability_via_Layer_Decomposition_CVPR_2026_paper.html)
- The paper's training data came from layered Photoshop (PSD) files, and it claims advantages over segmentation-based or recursive pipelines that propagate errors. — [arXiv 2512.15603](https://arxiv.org/html/2512.15603v1)
- BiRefNet (high-resolution dichotomous segmentation) is MIT-licensed; trained on DIS5K. — [BiRefNet paper](https://arxiv.org/pdf/2401.03407); [promptlayer BiRefNet listing](https://www.promptlayer.com/models/birefnet)
- SAM 2: code Apache 2.0; a secondary (Japanese) license summary flags the Hiera backbone weights as CC-BY-NC-4.0 and a bundled cctorch component — verify on the official repo. A compiled Apple Silicon app "SAM 2 Studio" is published under apache-2.0. — [zenn.dev SAM 2 license notes](https://zenn.dev/bilzard/scraps/06885684bba0ba); [SAM 2 Studio (Core ML)](https://huggingface.co/coreml-projects/sam-2-studio/discussions/1/files)

**Depth**
- Depth Anything V2: Small model Apache-2.0; Base/Large/Giant CC-BY-NC-4.0 (official README; Roboflow's listing contradicts this for Base/Large — official README is authoritative). — [Depth Anything V2 README](https://cdn.jsdelivr.net/gh/depthanything/depth-anything-v2@main/README.md); [Roboflow listing (conflicting)](https://playground.roboflow.com/models/bytedance/depth-anything-v2)

**Image-to-video**
- On an **M1 Max 64 GB**, Wan 2.2 (14B-class, GGUF) took **82 minutes for a 2-second clip**; FP8 weights error on Metal/MPS in ComfyUI (workaround: GGUF); a 1.3B model on M1 Pro took ~10 min for 8 frames at 480p. — [lilting.ch LTX-2 vs Wan 2.2 on M1 Max](https://lilting.ch/en/articles/ltx2-wan22-mac-local-video-gen)
- Wan 2.2 5B image-to-video needs ~8 GB VRAM and takes ~6 min on an RTX 4090. — [stable-diffusion-art Wan 2.2 i2v](https://stable-diffusion-art.com/wan-2-2-image-to-video/)
- No published Wan 2.2 5B timing on a base M3/24 GB was found. — [vLLM forum (Mac Wan question, unanswered re: speed)](https://discuss.vllm.ai/t/anyone-knows-that-can-i-run-alibaba-wan2-2-model-in-mac-m3-m4-m5/1822)

**Frame interpolation**
- Practical-RIFE model downloads are under MIT (per README text seen via a fork); RIFE's macOS support in ECCV2022-RIFE is via a community PR; rife-ncnn-vulkan ships a macOS executable; SVP says RIFE runs on macOS with the Vulkan loader from Homebrew. — [Practical-RIFE-ffmpeg fork](https://github.com/GrIgar45/Practical-RIFE-ffmpeg); [ECCV2022-RIFE](https://github.com/megvii-research/ECCV2022-RIFE); [SVP RIFE wiki](https://svp-team.com/wiki/RIFE_AI_interpolation)

### Inferences
- A base M3 (10-core GPU) has far less GPU throughput than an M1 Max/M3 Max, so expect klein 4B 1-MP edits at roughly **1–2+ minutes each** and klein 9B at several minutes (with quantization to fit 24 GB alongside the text encoder). That is still effectively unlimited free volume overnight, so **local klein 4B is the volume workhorse; Workers AI klein-4b (~79–95/day) is the fast lane**.
- Qwen-Image-Edit / Qwen-Image-Layered (20B-class Qwen-Image backbone) will need heavy quantization (GGUF Q4-ish) to fit 24 GB and will be slow; Qwen-Image-Layered's 640 px recommended resolution is below the ~1000 px source, so its layers are best used as **guides/masks**, re-cut from the original full-res pixels.
- Video: scaling the M1 Max figures down to a base M3 suggests hours per few-second clip for 14B models and tens of minutes+ for 5B — not viable for iterative art direction. Treat i2v as out of scope locally.
- Matting (BiRefNet/SAM 2) and depth (DA-V2 Small) are small models and should run in seconds to tens of seconds per image on M3 (not benchmarked here).

### Gaps
- No measured M3 (base)/24 GB benchmarks found for FLUX.2 klein, Qwen-Image-Edit, Qwen-Image-Layered, Wan 2.2 5B, LTX-Video, AnimateDiff, or CogVideoX — user should benchmark one run each.
- Whether Qwen-Image-Layered runs on MPS at all (README is CUDA-only) — unverified.
- LTX-Video / LTX-2 on Mac: only the comparison headline (FP8 fails on Metal) was seen; no clean timing extracted.
- Official SAM 2 weight licensing (secondary source only); FILM interpolation license not checked.

---

## 4. Style fidelity: techniques that best preserve the painterly STS2 style (and IP/ethics of LoRA training on Mega Crit art)

### Takeaway
The highest-fidelity approach is to **generate as few new pixels as possible**: deterministic cut-outs of the original art + small inpainted bands + compositing back through masks, using reference-conditioned editors (FLUX.2 klein multi-reference, low-strength img2img) only for the hidden/extended regions. Training a style LoRA on official Mega Crit art is technically the strongest style lock but directly contradicts Mega Crit's publicly stated anti-generative-AI position on its art and is the highest community/IP risk.

### Cited Findings
- FLUX.2 on Workers AI supports multi-reference prompting such as "take the subject of image 2 and style it like image 1" and editing background/lighting/pose while keeping a subject consistent. — [Cloudflare blog: FLUX.2 on Workers AI](https://blog.cloudflare.com/flux-2-workers-ai)
- SD 1.5 inpainting on Workers AI exposes `strength` (lower = closer to input) and a mask for inpainting — the classic "low-denoise img2img / masked inpaint with the original as context" controls. — [SD 1.5 inpainting model page](https://developers.cloudflare.com/workers-ai/models/stable-diffusion-v1-5-inpainting/index.md)
- Qwen-Image-Layered is designed so each RGBA layer "can be independently manipulated without affecting other content", supporting high-fidelity resizing, repositioning, recoloring. — [arXiv 2512.15603](https://arxiv.org/html/2512.15603v1)
- Mega Crit co-founder Casey Yano (GameSpot interview, reported July 2026) rejected generative AI for STS2 art, arguing artists would feel sadness seeing AI mimic their style and that the game already has a distinct style so there is little point in AI replicating it; EA placeholders were deliberately crude rather than AI-made. — [PCGamesN on STS2 art direction](https://www.pcgamesn.com/slay-the-spire-2/art-direction); [PauseHardware](https://pausehardware.com/slay-the-spire-2-ia/); [foro3d, 2026-07-15](https://foro3d.com/2026/julio/slay-the-spire-2-usa-arte-feo-a-proposito-y-odia-la-ia.html)

### Inferences
- Ranking of fidelity techniques for "vanilla-believable" output (best → worst): (1) no generation — re-use/cut original pixels and existing game VFX textures; (2) masked inpainting of narrow regions with the full original as context, composited back; (3) reference-image editing (klein 4B/9B multi-ref, Qwen-Image-Edit, Nano Banana) for larger fills; (4) low-strength img2img over the whole image (risks subtly altering the original everywhere — avoid on the final asset); (5) pure text-to-image (cannot match a specific painter's hand).
- Generated regions should be small and partly occluded by moving layers; viewers notice AI texture most in large, in-focus, newly invented areas (faces, hands, frame-breaking extensions).
- A LoRA trained on Mega Crit art would give the best style lock but (a) uses copyrighted art as training data without permission, (b) is exactly the use Yano criticized, and (c) if discovered in a public mod would likely draw strong backlash. Non-training alternatives (reference images at inference time, manual paint-over) are the defensible route.

### Gaps
- No empirical comparison found of klein vs. Qwen-Image-Edit vs. Nano Banana on matching a specific painterly style; needs hands-on A/B tests on 2–3 cards.
- Whether STS2 source art exists at higher resolution or with extra canvas beyond the visible frame (would remove the need for outpainting) — not investigated.

---

## 5. Honest feasibility verdict per task + recommended free pipeline

### Takeaway
Layer separation, depth, and small sprites are **feasible at vanilla-believable quality for $0**; background inpainting is **feasible if limited to narrow bands** revealed by small parallax motion; outpainting for frame-breaking and AI image-to-video loops are **not reliably vanilla-believable** for free and should be replaced by deterministic in-engine animation of separated layers. Recommended stack: local BiRefNet/SAM 2 + Depth Anything V2 Small + Workers AI FLUX.2 klein-4b (fast lane, ~79–95/day) + local klein 4B via Draw Things/mflux (unlimited, slow) + manual paint-over.

### Cited Findings
(Supporting facts are cited in sections 1–4; key ones repeated.)
- Workers AI free 10k Neurons/day; klein-4b at 26.05 N per output tile and 5.37 N per input tile. — [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- Workers AI has no video/depth/segmentation models in the image catalog; the only mask inpainting model is SD 1.5 (Beta). — [Workers AI models](https://developers.cloudflare.com/workers-ai/models/?tasks=Text-to-Image)
- Mac i2v speeds: 82 min per 2-s clip (Wan 2.2 14B GGUF, M1 Max 64 GB). — [lilting.ch](https://lilting.ch/en/articles/ltx2-wan22-mac-local-video-gen)
- Licenses of recommended components: FLUX.2 klein 4B Apache 2.0 ([HF](https://huggingface.co/black-forest-labs/FLUX.2-klein-4B)); Qwen-Image-Layered Apache 2.0 ([GitHub](https://github.com/QwenLM/Qwen-Image-Layered)); BiRefNet MIT ([promptlayer](https://www.promptlayer.com/models/birefnet)); Depth Anything V2 Small Apache-2.0 vs Base/Large CC-BY-NC ([README](https://cdn.jsdelivr.net/gh/depthanything/depth-anything-v2@main/README.md)); Practical-RIFE MIT ([fork README](https://github.com/GrIgar45/Practical-RIFE-ffmpeg)).

### Inferences
**Per-task verdicts (for "indistinguishable from official STS2 art")**
| Task | Verdict | Why / how |
|---|---|---|
| Layer separation (character vs. background) | **High** | BiRefNet / SAM 2 masks keep 100% original pixels; hand-refine soft painterly edges (smoke, hair, glow). Qwen-Image-Layered (640 px) useful as a multi-layer guide or via the free HF Space; re-cut at full res. |
| Inpainting hidden background | **Medium–High if narrow** | Only inpaint a dilated band equal to the max parallax offset (a few–tens of px), not the whole silhouette. Use klein-4b edit (Workers AI or local) with the original as reference, composite through mask; manual brush cleanup. Large holes → visible "AI look". SD 1.5 inpainting (free Beta on CF) is a fallback but weaker at ~1000 px. |
| Outpainting / frame-breaking | **Low–Medium** | Large invented areas in a specific artist's hand are where AI tells show. Prefer letting the *existing* cut-out character overflow the frame (no new pixels) and only outpaint small fringes. |
| Small matching sprites (particles, debris, smoke, slashes) | **Medium–High** | Small and low-detail; best sources in order: crops from the original painting, the game's own VFX textures, then klein-4b generations using the card art as reference + paint-over. |
| Depth maps for parallax | **High** | Depth Anything V2 **Small** (Apache-2.0; avoid NC Large for licensing cleanliness) on M3; coarse depth is enough for 2–3-plane parallax; hand-correct. |
| Image-to-video loops | **Low** | No free hosted i2v (Workers AI none; Gemini/Veo no free tier); local Wan/LTX on M3 24 GB too slow for iteration and i2v re-renders every pixel each frame (style drift/flicker, non-seamless loops). Replace with deterministic animation: layer parallax, mesh/UV-warp shaders, particle emitters in-engine. |
| Frame interpolation | **High but rarely needed** | RIFE (MIT) runs on macOS via ncnn-vulkan; only needed if you generate sparse frames. |

**Recommended $0 pipeline**
1. Matte: BiRefNet (MIT) or SAM 2 Studio on M3 → character/foreground alpha; manual edge cleanup in a free editor (Krita/GIMP/Photopea).
2. Depth: Depth Anything V2 Small → depth map; split into 2–4 planes.
3. Hidden-background fill: Workers AI `@cf/black-forest-labs/flux-2-klein-4b` edit with original + masked-hole image as references (~79/day free at 1 MP; well within budget for a card set), composite back through the mask; overflow/variations locally with klein 4B (Draw Things or mflux). Avoid flux-2-dev / klein-9b / Leonardo on the free tier (2–7 images/day).
4. Sprites: crop from art / game VFX first; klein-4b with reference second; paint-over.
5. Animation: in-engine parallax + shader warps + particles; skip i2v. RIFE only if producing frame sequences.
6. Licensing hygiene: prefer Apache/MIT components (klein 4B, Qwen-Image-Layered, BiRefNet, DA-V2 Small, RIFE); don't upload art to services whose free tier trains on inputs (Gemini free tier) and don't train a LoRA on Mega Crit art.

**Licensing / community-risk notes (brief)**
- Model licenses: the recommended components are permissive (Apache/MIT); FLUX.2 dev/klein 9B and DA-V2 Base/Large are non-commercial — likely acceptable for a free mod but avoidable.
- The bigger risk is not model licensing but distributing AI-altered Mega Crit art: the studio's co-founder has publicly opposed generative AI mimicking its art style, so a mod that visibly uses AI fills on official art may face backlash even if generated areas are small. Disclosing exactly what was AI-assisted (e.g., "background fills behind cut-outs") and keeping generation minimal reduces this risk. (Community sentiment is covered by another researcher.)

### Gaps
- Mega Crit's formal modding/asset-redistribution policy for STS2 (EULA / modding guidelines) was not checked here.
- No hands-on validation; every quality verdict above is an informed estimate and should be confirmed by a 1–2 card pilot (one Workers AI klein-4b fill, one local fill, side-by-side with the original at 100% zoom).
