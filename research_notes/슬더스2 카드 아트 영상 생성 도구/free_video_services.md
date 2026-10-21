# Free-quota hosted image-to-video (first+last frame) services for animating STS2 card art — as of 2026-10-21

Scope note: all pages below were fetched or searched on 2026-10-21 unless a different date is given. Official pages are marked (official). Third-party pricing blogs, many of them run by competing API resellers (Atlas Cloud, Magic Hour, Creatify, eesel, etc.), are marked (3rd-party) and conflict often. Nothing was signed up for, so no number here was checked inside a logged-in account. Free tiers in this category change monthly, so treat every number as a snapshot.

---

## Q1. Which services give a genuinely free quota (no card) for image-to-video, and specifically first+last frame or multi-keyframe conditioning?

### Takeaway
Only a few services combine a recurring no-card free allowance with confirmed first+last-frame conditioning. The strongest are **Google Flow** (50 credits/day, "Frames to Video: First and last" on every video model, officially documented), **Hugging Face ZeroGPU Spaces** running open-weight Wan 2.2 FLF2V (official 5 GPU-min/day for free accounts, no watermark, Apache-2.0 model), and **Dreamina (CapCut/ByteDance)** (120 credits/day officially, and its frames-to-video page offers "First and last frame" and "Multiframe" modes, but per-clip cost and free-tier watermark terms are not published). Kling, PixVerse, Vidu and Hailuo have first/last-frame features in their products, but either their free allowance is tiny or one-time, or free-tier access to those features is unconfirmed. Luma, Runway, Higgsfield and Pika's keyframe feature are effectively not free. Cloudflare Workers AI has **no video model**.

### Cited Findings

**Google Flow (Veo 3.1 / Gemini Omni) — strongest documented free FLF option**
- Non-subscribers get "only 50 Google Flow credits per day". The refresh is triggered by the first generation of the day, and unused credits don't roll over. (official, undated page, fetched 2026-10-21) — [Manage your Google Flow credits](https://support.google.com/flow/answer/16526234)
- Per-generation costs for non-subscribers: Veo 3.1 Lite 10 credits, Veo 3.1 Fast 20 credits, Veo 3.1 Quality 100 credits (8 s only, more than the 50-credit daily allowance). — [Manage your Google Flow credits](https://support.google.com/flow/answer/16526234)
- During peak hours (about 2–5 PM UTC, i.e. 23:00–02:00 KST), non-subscribers "may not be able to generate videos". Limits "are subject to change at any time." — [Manage your Google Flow credits](https://support.google.com/flow/answer/16526234)
- Video models in Flow: Veo 3.1 Lite, Veo 3.1 Fast, Veo 3.1 Quality and Gemini Omni Flash 1.1. Each is listed with "Frames to Video: First and last". Veo durations are 4/6/8 s. Omni is 4/6/8/10 s at "standard 720p and draft 360p", and "All users can access Gemini Omni models." — [Learn about Google Flow models & supported features](https://support.google.com/flow/answer/16352836)
- Start and end frames are set via Video → Frames in the prompt box. "Product feature availability may differ by country/region of use." — [Create videos in Google Flow](https://support.google.com/flow/answer/16353334)
- Flow is available in South Korea to users aged 18+. "AI credits are currently unavailable in Japan." — [Where you can use Google Flow](https://support.google.com/flow/answer/16353544?hl=en)
- No free API: in the Gemini API, Veo 3.1 Standard, Fast and Lite all show "Not available" in the Free Tier column. The page (updated 2026-10-19) also says Veo 3.1 and Gemini Omni Flash Preview API models are scheduled to shut down on **2026-10-22**. — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

**Gemini app (consumer) — no reliable free video**
- The official Gemini Apps limits page shows an unlabeled (non-checkmark) icon for video generation in the "Without a Google AI plan" column and gives no numeric video limit. It says "Video generally requires the most usage." (undated, fetched 2026-10-21) — [Gemini Apps limits & upgrades](https://support.google.com/gemini/answer/16275805)
- A one-off promo let free users make 10 Gemini Omni videos, announced 2026-07-30 and ending 2026-08-04 (single secondary blog). — [pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/9685/gemini-omni-ten-free-videos-august-4-deadline); a 2026 Brazilian guide says free Gemini has no video feature — [horadecodar.com.br](https://horadecodar.com.br/gemini-criar-videos-gratis/)

**Hugging Face Spaces on ZeroGPU — free, open-weight Wan 2.2 FLF2V**
- Official daily ZeroGPU quotas: Unauthenticated 2 min, **Free account 5 min**, PRO 40 min, Team 40 min, Enterprise 60 min. Quota "resets exactly 24 hours after your first GPU usage", and "Remaining quota directly impacts priority in ZeroGPU queues." Hardware is half an NVIDIA RTX Pro 6000 Blackwell (48 GB) by default, and the `xlarge` full GPU costs 2× quota. (official docs, fetched 2026-10-21) — [Spaces ZeroGPU docs](https://huggingface.co/docs/hub/spaces-zerogpu)
  - CONFLICT: the assignment's "~3.5 GPU-min/day" figure matches older forum posts quoting the docs (2 / 3.5 / 25 min). The current official doc says 5 min free and 40 min PRO. — [HF forum thread](https://discuss.huggingface.co/t/what-is-the-free-zerogpu-quota-for-1-space/178610); [HF forum thread](https://discuss.huggingface.co/t/free-account-zerogpu-quota-issue/175180/9). A search snippet also reported an HF staff reply (April 2026) about a request-based limit of "three times per day". I did not open that post, and the official doc doesn't mention it.
- Free personal accounts (verified email, account older than 30 days) can host up to 2 ZeroGPU Spaces of their own. — [Spaces ZeroGPU docs](https://huggingface.co/docs/hub/spaces-zerogpu)
- Space `multimodalart/wan-2-2-first-last-frame` is Running on ZeroGPU (676 likes). — [HF Space](https://huggingface.co/spaces/multimodalart/wan-2-2-first-last-frame). Its `app.py` loads `Wan-AI/Wan2.2-I2V-A14B-Diffusers` with fp8 AoTI blocks. Defaults: 8 steps, guidance 1.0, longest side capped at 832 px (shortest ≥480, multiples of 16), fixed 16 fps, 8–81 frames (0.5–5.1 s, default 2.1 s), `@spaces.GPU(duration=120)`. It also uses `multimodalart/nano-banana-private` for optional end-frame generation. — [app.py](https://huggingface.co/spaces/multimodalart/wan-2-2-first-last-frame/raw/main/app.py)
- Wan FLF2V is described as open source under Apache 2.0, outputting 720p (vendor page). — [Atlas Cloud Wan FLF2V model page](https://www.atlascloud.ai/ko/models/alibaba/wan-flf2v)
- LTX-2 supports first+last conditioning in Diffusers (`LTX2VideoCondition`, index 0 and -1; example of 121 frames at 24 fps with 8 distilled steps). I found no dedicated LTX-2 FLF ZeroGPU Space. — [Diffusers LTX-2 docs](https://huggingface.co/docs/diffusers/api/pipelines/ltx2.md); a community comment on LTX-2.3 says "two pics work, but 3 pic no" for first-middle-last — [Kijai/LTX2.3_comfy discussion](https://huggingface.co/Kijai/LTX2.3_comfy/discussions/17)

**Dreamina / CapCut (Seedance) — daily free credits and FLF + multiframe UI, but terms unclear**
- Free users get **120 credits per day** "across supported image and video generation workflows", refreshed daily, "No credit card required". Per-clip cost varies by model, duration, resolution and features, and the page doesn't list which models free users get. (official, dated 2026-09-10) — [Dreamina free image-to-video credits FAQ](https://dreamina.capcut.com/ai-video/free-image-to-video-generator-credits-faq)
  - CONFLICT: older third-party guides cite 225 daily tokens. — [CyberLink Seedance guide](https://www.cyberlink.com/blog/trending-topics/5241/seedance-2-guide); [Atlas Cloud](https://www.atlascloud.ai/blog/case-studies/how-to-use-seedance-2)
- Frames-to-video page: "First and last frame" and "Multiframe" modes plus Omni reference. It credits the Seedance 2.0 algorithm (the button links to "Seedance 2.0 mini") and says it "offers frame-to-video free generation". It gives no credit costs, multiframe count or watermark terms. (official, fetched 2026-10-21) — [Dreamina frames-to-video](https://dreamina.capcut.com/create/frames-to-video)
- Free output is reported as watermarked (3rd-party). — [CyberLink](https://www.cyberlink.com/blog/trending-topics/5241/seedance-2-guide)

**Kling AI (klingai.com → kling.ai)**
- Free allowance CONFLICT: 66 credits **per month** (claimed on login, valid 1 month) per Atlas Cloud (3rd-party, 2026-07-14) — [Atlas Cloud Kling free](https://www.atlascloud.ai/blog/guides/kling-ai-free); 66 credits **per day** per a HeyGen guide updated 2026-10-14 (search summary) — [HeyGen](https://www.heygen.com/blog/kling-ai-pricing). The official Credits Policy says daily login credits go to "Kling subscribers" and lists "Watermark removal" among "premium-only functions" (undated). — [Kling Credits Policy](https://kling.ai/docs/point-policy)
- 5 s 720p on Kling 3.0 = 30 credits. Free output is watermarked, "Personal Use Only", ≤720p, has "Standard (Long waits)" queue, and can be blocked with "The queue for the free plan is busy now". — [Atlas Cloud Kling free](https://www.atlascloud.ai/blog/guides/kling-ai-free)
- Start/end frame on the free plan: not documented in any source found. Kling's API (V3) lists start/end frame control (3rd-party listing). — [picsart Kling v3](https://picsart.com/api-platform/models/kling-v3/pricing)
- The official membership page returned empty to my fetcher (JS-rendered). — [kling.ai membership](https://kling.ai/membership/membership-plan)

**Hailuo / MiniMax**
- Free plan = "200 one-time credits" (no daily refresh), about 16 basic 512p videos. Per-clip cost is about 12–80 credits. "Hailuo 2.0 (Frames)" is listed at about 12–35 credits (512p/768p/1080p, 6 s). (3rd-party, updated 2026-08-05) — [Aiarty Hailuo pricing](https://www.aiarty.com/ai-video-generator/hailuo-ai-pricing.htm)
- A search summary of the same article said the one-time welcome grant expires 3 days after it is granted and that the old "100 free credits every day" no longer applies. I did not see the expiry in my fetch, so treat it as unverified. Another reviewer claims daily bonus credits for 2–3 videos/day (conflict). — [dupple review Jul 2026](https://dupple.com/reviews/hailuo-ai)
- 200 one-time credits, about 6 s at 768p, visible watermark, commercial use excluded on free. (Aug–Sep 2026) — [DEV Community comparison](https://dev.to/just_a_side_project/i-compared-the-free-tiers-of-google-flow-kling-ai-and-hailuo-so-you-dont-have-to-2737)
- Start/end frames work on MiniMax H3, Hailuo 2.0 and bundled Veo 3.1 (3rd-party). Free-tier availability is unconfirmed. — [dupple review](https://dupple.com/reviews/hailuo-ai)

**PixVerse**
- 90 one-time signup credits + 60 daily credits (no rollover). The cheapest clip is V6 360p 5 s no-audio at about 25 credits, and V5.6 5 s costs about 175 credits. Free output is watermarked, commercial use is not permitted, and resolution is capped low (360p–720p reported). The article notes PixVerse "does not publish its free-tier terms on an easily accessible page." (3rd-party competitor, 2026-07-14) — [Atlas Cloud PixVerse free](https://www.atlascloud.ai/blog/guides/pixverse-ai-free); CONFLICT: 100 initial + 30 daily — [Tools for Humans](https://www.toolsforhumans.ai/ai-tools/pixverse-ai)
- The "Transition" (first→last frame) mode is supported on v3.5 through V6 and C1, at 1–15 s on V6/C1 (attributed to PixVerse platform docs by a reseller, July 2026). Free-tier access is unconfirmed. — [Atlas Cloud PixVerse transition](https://www.atlascloud.ai/blog/guides/pixverse-ai-transition)
- The official subscribe page returned HTTP 403 to my fetcher. — [app.pixverse.ai/subscribe](https://app.pixverse.ai/subscribe)

**Vidu (Shengshu)**
- Vendor blog (2026-05-26): the free plan's recurring credits cover "roughly 10–16 clips per month", a 4 s standard clip costs about 5 credits, output is capped at 720p, and a visible watermark sits in the lower-right. Free output is personal, non-commercial use only. — [Vidu blog](https://www.vidu.com/blog/free-ai-animation)
- 40 credits/month plus "off-peak unlimited mode" per CostBench (3rd-party, unverified). — [CostBench Vidu free plan](https://costbench.com/software/ai-video-generators/vidu/free-plan/)
- Start/end-frame animation and 1–7 reference images are supported in the product, but free access is unconfirmed. — [Magic Hour Vidu review](https://magichour.ai/blog/vidu-ai-review)
- The official pricing page rendered only "Loading pricing plans..." to my fetcher. — [vidu.com/pricing](https://www.vidu.com/pricing)

**Pika**
- 80 credits/month free, Pika 2.5 at 480p only, no watermark-free downloads, no commercial use. "No Pikaframes on the free tier" (Pikaframes = start/end keyframe interpolation). (3rd-party 2026) — [eesel Pika pricing](https://eesel.ai/blog/pika-ai-pricing); [Magic Hour Pika pricing](https://magichour.ai/blog/pika-labs-pricing)

**Luma Dream Machine**
- The official pricing page lists no free plan. Plus is the entry tier at $30/month ($25 billed yearly) with 10,000 credits, and Ray3.14 720p text-to-video costs 20 credits/sec. (official, fetched 2026-10-21) — [Luma pricing](https://lumalabs.ai/pricing). Third-party sources mention leftover trial credits or a legacy watermarked free plan. — [aitoolcurator](https://www.aitoolcurator.com/learn/luma-guide/free-tier/)

**Runway**
- Free = 125 one-time credits. In August 2026 tests, the free plan **could not generate video**: requests hit an upgrade wall, and Runway's agent said video requires the Standard plan. (3rd-party hands-on, 2026-08-06, updated Oct 2026) — [marcandrews.com](https://marcandrews.com/runway-free-plan-2026-what-it-actually-makes/)

**Higgsfield**
- The pricing table (captured 2026-09-06) shows Free = 0 credits, with "Start and end frame control" not included on Free. No no-card trial was found. (3rd-party) — [Creatify on Higgsfield](https://creatify.ai/blog/is-higgsfield-free-free-plan-trials-and-promo-codes-explained-(2026)); CONFLICT: 10 credits/day — [Inside Verdict](https://insideverdict.bearblog.dev/higgsfield-ai-pricing-how-much-does-it-cost-20-off-discount/)

**Krea**
- Free plan gets 100 compute units/day, but "video generation [is] locked to Pro and up" per some sources, and a Seedance 2.0 video costs about 240–250 units (3rd-party, Oct 2026). — [dailyaifixs](https://dailyaifixs.com/blog/krea-ai-pricing-2026-free-units-locked-models); [hooked.so](https://www.hooked.so/compare/krea-ai-pricing)

**Alibaba Wan via Qwen Chat / wan.video**
- Qwen Chat video generation is free with no card, at about 720p and about 5 s, with no negative prompts (3rd-party tutorial, undated 2026). — [crepal.ai](https://crepal.ai/blog/aivideo/aivideo-qwen-image-to-video-tutorial/)
- Wan 2.7 supports first+last-frame in the model and API, and FLF clips are fixed at 5 s and silent in the DashScope API route. — [OpenRouter Wan 2.7](https://openrouter.ai/alibaba/wan-2.7/uptime); [claudeskills qwencloud](https://claudeskills.info/ja/skills/qwencloud/qwencloud-ai/qwencloud-video-generation/). Whether Qwen Chat's UI exposes FLF for free is unverified.

**Meta AI / Vibes**
- You can upload a photo and have Meta generate a video from it (2025 launch coverage), and one comparison lists Vibes as free. No first/last-frame control was found. — [TechRadar](https://www.techradar.com/ai-platforms-assistants/meta-launches-vibes-a-new-way-of-creating-and-remixing-ai-videos); [Meta launch post](https://about.fb.com/news/2025/09/introducing-vibes-ai-videos/amp/)

**xAI Grok Imagine (extra candidate)**
- Free tier is reportedly about 5 videos/day (garbled table) or "dead for free users" (March 2026 opinion post). No FLF found. — [Grok guide](https://clickup.com/blog/how-to-use-grok-imagine/); [budgetpixel](https://budgetpixel.com/blog/grok-imagine-is-dead-for-free-users)

**Cloudflare Workers AI**
- The model catalog (last updated 2026-08-12) lists **no text-to-video or image-to-video model**. It has image models only: flux-1-schnell, flux-2-dev, flux-2-klein-4b, flux-2-klein-9b, lucid-origin, phoenix-1.0, SD 1.5 inpainting, SDXL, SDXL-lightning, dreamshaper-8-lcm. — [Workers AI models](https://developers.cloudflare.com/workers-ai/models/)

**Replicate / fal / OpenRouter starter credits**
- fal: new-account credit reported anywhere from $1 (no card) to about $20 with a business email, and described as time-limited promo credit (aggregators, unverified). — [vantaige](https://vantaige.io/ai-tool/fal-ai); [perkstack](https://perkstack.co/catalog/fal-ai-signup-20)
- Replicate: reported as $5, $10, or "a limited number of free runs on select models" with no card (aggregators, unverified). — [yangmao.ai](https://yangmao.ai/en/deals/replicate-free-tier/)
- OpenRouter lists Wan 2.7 at $0.10/s and Wan 2.6 at $0.04/s (paid). The URL `wan-2.6:free` returned 404, so no free variant is confirmed. — [OpenRouter Wan 2.7](https://openrouter.ai/alibaba/wan-2.7/uptime); [OpenRouter wan-2.6:free (404)](https://openrouter.ai/alibaba/wan-2.6:free)

### Inferences
- For a zero-cost, repeatable pipeline, the realistic shortlist is: (1) Google Flow (web UI only, about 2–5 FLF clips/day), (2) HF ZeroGPU Wan 2.2 FLF2V (scriptable, no watermark, open license, but short daily GPU budget), (3) Dreamina (UI, generous daily credits, FLF + multiframe, but watermark/licensing unclear), and as a secondary option (4) Kling if its 66 credits really refresh daily.
- Multi-keyframe (more than 2 frames) at zero cost appears only in Dreamina's "Multiframe" mode (count unpublished). Otherwise, chain FLF segments (A→B, B→A) yourself. Luma's 16-keyframe and Pikaframes features are paid-only.
- Commercial-use bans on free tiers (Kling "Personal Use Only", Vidu, PixVerse, Pika, Hailuo) matter even for a free mod, because public distribution may exceed "personal use". The open-weight route (Wan on HF) avoids service ToS output restrictions. Separately, the card art itself is Mega Crit's IP, which is outside this research.

### Gaps
- Official, logged-in confirmation of free-tier FLF access for Kling, Hailuo, PixVerse, Vidu and Qwen Chat. Their official pricing pages were JS-rendered or blocked for the fetcher.
- Kling free credits: daily vs monthly is unresolved (official policy is silent for non-members).
- Dreamina per-clip credit cost, watermark and output licence for free accounts, and number of frames in Multiframe mode.
- Whether Flow's Gemini Omni generations cost fewer credits than Veo Lite (not stated on the credits page).
- Meta AI video availability in South Korea, and its image-to-video limits.

---

## Q2. Per-service details: what the free credits buy, resolution/fps/duration, loop support, watermark, output rights, training on uploads, account/region requirements, API on the free tier

### Takeaway
Free outputs from commercial SaaS are almost universally watermarked and restricted to personal or non-commercial use. Google Flow is the exception on watermark ambiguity (visible watermark reportedly toggleable, invisible SynthID always present) and offers a documented training opt-out. No commercial SaaS offers a free API for video. The only free, scriptable FLF route found is Hugging Face Spaces (Gradio), which produces clean, unwatermarked, Apache-2.0 output.

### Cited Findings

**Comparison snapshot (dated per source)**

| Service | Free allowance (source date) | ≈ FLF clips per refresh | Max res / duration on free | FLF on free? | Watermark | Output use on free | Free API |
|---|---|---|---|---|---|---|---|
| Google Flow | 50 credits/day (official, fetched 2026-10-21) | Veo 3.1 Lite: 5; Fast: 2; Quality: 0 | Veo 4/6/8 s; Omni up to 10 s, 720p | Yes, "First and last" on all models (official) | SynthID always; visible "made with Veo" disputed/toggle | Unclear in terms | No (Gemini API free tier "Not available", 2026-10-19) |
| HF ZeroGPU + Wan 2.2 FLF Space | 5 GPU-min/day free acct (official) | ~2–5 (inference; see Q3) | ≤832 px long side, 16 fps, ≤5.1 s | Yes | None | Apache-2.0 model | Yes, Gradio API (inference) |
| Dreamina (Seedance) | 120 credits/day (official 2026-09-10) | Unknown (cost unpublished) | Unknown | FLF + Multiframe in UI (official) | Reported yes | Unclear | No evidence |
| Kling | 66 credits, monthly or daily (conflict) | 2 × 5 s 720p (Kling 3.0) | 720p | Unconfirmed | Yes | Personal use only | No evidence |
| Hailuo | 200 one-time (2026-08-05) | ~8–16 total, ever | 512p–768p, 6 s | Unconfirmed | Yes | Non-commercial | No |
| PixVerse | 90 signup + 60/day (2026-07-14) | ~2/day at 360p (V6) | 360–720p | Unconfirmed (Transition exists) | Yes | Not commercial | No |
| Vidu | ~10–16 clips/month (vendor, 2026-05-26) | ~10–16/month | 720p | Unconfirmed | Yes, lower-right | Personal, non-commercial | No evidence |
| Pika | 80 credits/month | — | 480p, Pika 2.5 only | No (Pikaframes paid) | Yes | No commercial | No |
| Luma | No free plan (official) | 0 | — | — | — | — | — |
| Runway | 125 one-time; video blocked on free (Aug 2026 test) | 0 | — | — | — | — | — |
| Higgsfield | 0 credits (table, 2026-09-06) | 0 | — | No | — | — | — |
| Krea | 100 units/day; video paid-only (reported) | 0 | — | — | — | — | — |
| Cloudflare Workers AI | 10,000 neurons/day | No video model | — | — | — | — | (images only) |

Sources for the table rows are the citations in Q1 and below.

**Watermark and rights**
- Flow FAQ: Google One/AI Pro videos carry a visible "made with Veo" watermark and Ultra videos don't. A third-party guide says there is a "Visible watermarking" toggle under the profile picture, and all Flow outputs carry invisible SynthID (3rd-party quoting Google). — search results summarizing [labs.google Flow FAQ](https://labs.google/fx/ro/tools/flow/faq) and [Atlas Cloud Veo watermark](https://www.atlascloud.ai/fr/blog/tips/veo-watermark-remover)
- Commercial use of free-tier Flow output: "could not find a clear statement" in Google's terms. — [DEV Community](https://dev.to/just_a_side_project/i-compared-the-free-tiers-of-google-flow-kling-ai-and-hailuo-so-you-dont-have-to-2737); an unanswered forum question on the same topic — [Google AI dev forum](https://discuss.ai.google.dev/t/inquiry-about-commercial-use-of-videos-generated-via-google-labs-flow-free-tier-for-a-contest/169174)
- Kling, Hailuo: visible watermark, commercial use "explicitly excluded" on free (Kling: "documented limit, not a gray area"). — [DEV Community](https://dev.to/just_a_side_project/i-compared-the-free-tiers-of-google-flow-kling-ai-and-hailuo-so-you-dont-have-to-2737)
- Vidu: lower-right visible watermark, personal non-commercial only. — [Vidu blog](https://www.vidu.com/blog/free-ai-animation)
- PixVerse: corner watermark, no commercial use. — [Atlas Cloud](https://www.atlascloud.ai/blog/guides/pixverse-ai-free)

**Training on uploads / privacy**
- Google Flow: when "Help improve Google Flow" is on, Google may use "interactions, uploads, and generated output" to improve products and ML. These are "reviewed by trained reviewers and kept for up to 18 months". You can opt out via More → turn off "Help improve Google Flow". — [Manage your data in Google Flow](https://support.google.com/flow/answer/17025472?hl=en)
- Kling: third-party analyses say the ToS grant a broad license over uploads "for service operation and improvement", possibly including training. The verbatim clause was not recoverable. — [ConductAtlas](https://conductatlas.com/platform/kling-ai/kling-ai-terms-of-service/user-content-license/). Free-tier generations are "often shown in a public feed", with Private Mode on Pro/Premier only (3rd-party). — [CometAPI](https://www.cometapi.com/are-kling-videos-private/)

**Account / region**
- Flow: 18+, available in South Korea, with no credits in Japan. — [Where you can use Google Flow](https://support.google.com/flow/answer/16353544?hl=en)
- ZeroGPU: hosting your own Space needs a verified email and an account older than 30 days. — [ZeroGPU docs](https://huggingface.co/docs/hub/spaces-zerogpu)
- Dreamina: Google/Apple/email signup, no card. — [CyberLink](https://www.cyberlink.com/blog/trending-topics/5241/seedance-2-guide)

**Loop support**
- Luma Ray2 has a loop toggle, and using the same image as first and last frame is "only a workaround" that "can still lead to issues". A user got a "generic error" supplying two reference frames for looping with Veo 3.1 Fast (inside Adobe Firefly). — [Adobe community bug report](https://community.adobe.com/bug-reports-403/generic-error-when-using-two-reference-frames-for-video-looping-in-veo-3-1-fast-1553443)
- Kling, Wan 2.6 and LTX support first+last frame (model directory). — [Segmind FLF models](https://www.segmind.com/models/all/first-and-last-frame-video-models)

### Inferences
- The project's design ("ends on the exact official art") makes FLF with last frame = official art the natural fit. For a seamless in-game loop, use first = last = official art (same-image FLF), or chain two FLF segments (official → generated pose → official). Both are workarounds, since no free service offers a dedicated loop toggle.
- Card art is about 1000×760 (≈4:3). The Wan Space preserves aspect up to 832 px on the long side, which is enough for 250×190 in-game and hover enlargement. Veo's supported aspect ratios on Flow weren't documented in what I fetched; if it's 16:9/9:16 only, art would need padding/cropping. That's unverified.
- Watermarks are a hard blocker for a cosmetic mod (cropping a corner watermark would also crop art). That leaves Flow (if the visible watermark is off or absent for free users) and HF/open-weight as the only clean-output free paths.

### Gaps
- Whether Flow free (non-subscriber) output has a visible watermark. The FAQ snippet covered Pro vs Ultra only.
- Google's explicit licence for free Flow outputs, and the ToS for Dreamina, Vidu and PixVerse outputs and uploads. Not fetched or not found.
- Resolution/fps of Veo 3.1 outputs on free Flow.

---

## Q3. Rough throughput: how many cards per day/month at zero cost, assuming several attempts per card

### Takeaway
At about 3 attempts per card, a single account yields very roughly: Google Flow ≈ 1–2 cards/day (≈30–50/month), HF ZeroGPU Wan FLF ≈ 1 card/day (≈20–40/month), Kling ≈ 0.7 card/day if credits are daily (≈1 card/month if monthly), PixVerse ≈ 0.7 card/day at 360p, Vidu ≈ 3–5 cards/month, and Hailuo ≈ 3–5 cards total, ever. Combining Flow + HF + Dreamina might reach about 100+ cards/month, so ~600 cards takes about 6–12 months of daily manual work on one account each. Free tiers are sized for trials, not 600-card batch production.

### Cited Findings
- Flow: 50 credits/day; Lite 10, Fast 20 per generation; peak-hour video blocking for non-subscribers. — [Flow credits](https://support.google.com/flow/answer/16526234)
- ZeroGPU: 5 min/day free. The `xlarge` size costs 2× quota ("a 45s effective task duration consumes 90s of quota"). — [ZeroGPU docs](https://huggingface.co/docs/hub/spaces-zerogpu)
- The Wan 2.2 FLF Space reserves `duration=120` per call, uses 8 steps and fp8, and defaults to a 2.1 s clip (34 frames @16 fps). — [app.py](https://huggingface.co/spaces/multimodalart/wan-2-2-first-last-frame/raw/main/app.py)
- A forum thread is titled "It seems use 60 sec GPU quota instead of real time usage?", suggesting that reserved rather than actual duration may be charged (title only, not read). — [HF forum](https://discuss.huggingface.co/t/it-seems-use-60-sec-gpu-quota-instead-of-real-time-usage/175130)
- Wan 2.2 FLF with the fast LoRA takes about 3 min on a local RTX 4090 (not a ZeroGPU figure). — [stable-diffusion-art](https://stable-diffusion-art.com/wan-2-2-first-last-frame-video/)
- Kling: 30 credits per 5 s 720p on 3.0, 66 credits per refresh. — [Atlas Cloud Kling](https://www.atlascloud.ai/blog/guides/kling-ai-free)
- PixVerse: 60/day, about 25 credits per cheapest 5 s clip. — [Atlas Cloud PixVerse](https://www.atlascloud.ai/blog/guides/pixverse-ai-free)
- Vidu: about 10–16 clips/month. — [Vidu blog](https://www.vidu.com/blog/free-ai-animation)
- Hailuo: 200 one-time credits, about 16 basic 512p videos. — [Aiarty](https://www.aiarty.com/ai-video-generator/hailuo-ai-pricing.htm)
- Pay-as-you-go reference if starter credits are used: Wan 2.6 $0.04/s, so a 5 s clip ≈ $0.20 and $1 ≈ 5 clips. Wan 2.7 $0.10/s, so a 5 s clip ≈ $0.50. — [OpenRouter Wan 2.7](https://openrouter.ai/alibaba/wan-2.7/uptime)

### Inferences
- Flow: 5 Lite or 2 Fast FLF clips/day → at 3 attempts per card ≈ 1.7 or 0.7 cards/day → about 50 or 20 cards/month. 600 cards ≈ 12 months (Lite) on one account.
- HF ZeroGPU: 300 s/day ÷ 60–120 s per 2–5 s clip ≈ 2–5 clips/day (if the 120 s reservation is charged in full, ~2/day) → about 0.7–1.7 cards/day. Self-hosting a Space with shorter `duration` and fewer frames (e.g. 2–3 s at 16 fps, 4–8 steps) stretches this. ZeroGPU likely refuses calls when remaining quota is below the requested duration (my recollection, not verified in the fetched docs).
- Kling: 2 clips per refresh → daily ≈ 0.7 cards/day; monthly ≈ 0.7 cards/month.
- Running several services in parallel each day is the only way to reach roughly 100+ cards/month at zero cost, and it requires manual UI work for everything except HF. Using multiple accounts per service to multiply quotas likely violates the ToS (not checked) and isn't recommended.
- Starter credits (fal/Replicate, $1–$20 if real) would cover roughly 5–100 Wan clips once. That's useful for a pilot, not for 600 cards.

### Gaps
- Real GPU seconds per Wan 2.2 FLF call on ZeroGPU's half RTX Pro 6000 (not published), and whether quota is charged by reservation or actual runtime.
- Dreamina credit cost per FLF clip (needed to estimate its throughput, possibly the highest of all).
- Actual retry rate needed for 2D card art (depends on Q4).

---

## Q4. Known quality on 2D/flat/painterly illustration, and how well models hold an exact first/last frame

### Takeaway
I found no rigorous 2026 benchmark of FLF fidelity on flat/painterly 2D art. The evidence is vendor claims and generic guides. Expect last-frame drift, colour shift and morphing to be the main failure modes. Motions that return to the start (pulse, glow, small rotation, particles) loop best, and big-movement fly-ins like the "Ice Lance" example are the riskiest. The final frame of any generated clip should be replaced by, or cross-faded into, the exact official PNG in post.

### Cited Findings
- Wan FLF2V claims a "98%" first/last-frame matching rate, with no methodology given (vendor). — [Atlas Cloud Wan FLF2V](https://www.atlascloud.ai/ko/models/alibaba/wan-flf2v)
- Wan 2.7 FLF guide: going past about 120 frames can cause a "pingpong" effect (reaching the end frame early, then reversing). It recommends short clips, a negative prompt with "jump cut, flicker, distortion, warping, morphing, artifacts", and a check for "fidelity to the final frame". — [NemoVideo Wan 2.7 FLF guide](https://www.nemovideo.com/blog/wan-2-7-first-last-frame-control)
- Wan 2.2 FLF high-noise vs low-noise: "high noise version offers bold creative transitions and the low noise version preserves fidelity between frames." — [RunComfy Wan 2.2 FLF](https://www.runcomfy.com/models/community/wan-2-2/fun-inp/first-last-frame)
- Artlist case study: generate a matching end frame with Nano Banana, then feed both into Kling 2.1. "If your character moves between frames, your transition falls apart." — [Artlist](https://artlist.io/blog/ai-video-transitions-study-case/)
- Loop design advice: prefer motions that naturally return (slow rotation, breathing, pendulum, pulse), keep the camera locked, and judge seams over several repetitions. Shattering or leaving frame doesn't reset. — [Magic Hour loops guide](https://magichour.ai/blog/how-to-make-seamless-ai-video-loops); a seam-failure checklist — [Viggle](https://viggle.ai/blog/how-to-create-looping-meme-videos-using-ai-animation)
- Kling character animation motion is "genuinely good" (single reviewer opinion). — [DEV Community](https://dev.to/just_a_side_project/i-compared-the-free-tiers-of-google-flow-kling-ai-and-hailuo-so-you-dont-have-to-2737)
- Older Kling 1.6 Pro FLF docs described it as suited to "anime-realism blending" (dated). — [morphic glossary](https://morphic.com/de/ai-glossary/Kling-16)
- No direct anime/2D head-to-head FLF test of Kling vs Veo vs Wan vs Vidu was found. — search result summary, [rangy.ai 2026 comparison](https://rangy.ai/blog/ai-video-generators-compared-2026)

### Inferences
- Same-image FLF loops (first = last = official art) suit "idle" animations (glow, particles, slight motion) and likely hold the end frame best. The "flies in from off-screen" style needs a generated start keyframe (lance absent or small), and creates more morphing risk on flat-shaded art.
- Low frame counts (16 fps, 2–3 s) reduce drift and quota use, and fit a small in-game frame (250×190), where minor artifacts are less visible.
- In post, a hard-cut or a 2–4 frame cross-fade to the exact official PNG at loop end guarantees "ending on the exact official art" regardless of model fidelity.

### Gaps
- No quantitative FLF last-frame fidelity data (SSIM/colour drift) for flat 2D art for any model. This needs the user's own pilot on ~5 cards across Flow, Wan-HF and Dreamina.
- No evidence on how Veo 3.1 Lite (the free-affordable Flow tier) compares to Fast/Quality on 2D art.

---

## Q5. Free keyframe image generation/editing options (to make non-official keyframes in the same style)

### Takeaway
Cloudflare Workers AI's free 10,000 neurons/day is the best free **API** for keyframe edits. FLUX.2 klein 4B (generation + editing, multi-reference) costs roughly 125 neurons per ~1 MP edit, so about 80 edits/day for free. klein 9B gives about 6/day. The Gemini app gives free Nano Banana 2 edits via UI (numbers disputed), but the Gemini API has **no** free tier for any image model as of 2026-10-19. Qwen Chat image editing is free in UI, but I found no published limits.

### Cited Findings
- Workers AI includes "10,000 Neurons per day at no charge", with overage at $0.011 per 1,000 neurons on Workers Paid. (official, last updated 2026-10-20) — [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- Neuron costs per model (official, 2026-10-20):
  - flux-2-klein-4b: 5.37 per input 512×512 tile, 26.05 per output tile
  - flux-2-klein-9b: 1,363.64 for the first megapixel, 181.82 per subsequent MP, 181.82 per input-image MP
  - flux-2-dev: 18.75 per input tile per step, 37.50 per output tile per step
  - flux-1-schnell: 4.80 per tile + 9.60 per step
  - lucid-origin: 636 per tile + 12 per step
  - phoenix-1.0: 530 per tile + 10 per step

  — [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- flux-2-klein-4b is a "fast distilled model that handles both generation and editing". flux-2-klein-9b offers "text-to-image and multi-reference editing". flux-2-dev offers "multi-reference support". — [Workers AI models](https://developers.cloudflare.com/workers-ai/models/)
- Gemini API: Nano Banana 2.1, Gemini 3.1 Flash Image, 3.1 Flash Lite Image, 3 Pro Image and 2.5 Flash Image all show Free Tier "Not available". 2.5 Flash Image shut down 2026-10-02. (updated 2026-10-19) — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Gemini app: the free column has a checkmark for Nano Banana 2 image generation, with no numeric cap stated. Nano Banana Pro is shown with an unlabeled icon. — [Gemini Apps limits](https://support.google.com/gemini/answer/16275805). Third-party figures conflict: about 20 images/day (2026 guide) — [zenken](https://ai.zenken.co.jp/en/post/gemini-image-guide/); 3 Nano Banana Pro + up to 100 Nano Banana/day (Jan 2026) — [9to5Google](https://9to5google.com/2026/01/12/gemini-nano-banana-pro-milestone/). Free downloads are 1K resolution (per search summary of Google help). — [Gemini image help](https://support.google.com/gemini/answer/14286560)
- Google Flow free users can still generate images (Nano Banana Pro is the default model) during peak hours. — [Flow credits](https://support.google.com/flow/answer/16526234); [Create videos in Flow](https://support.google.com/flow/answer/16353334)
- Dreamina's 120 daily credits are shared across image and video workflows. — [Dreamina FAQ](https://dreamina.capcut.com/ai-video/free-image-to-video-generator-credits-faq)
- Krea free: 100 units/day, with image models usable but best models locked (3rd-party). — [dailyaifixs](https://dailyaifixs.com/blog/krea-ai-pricing-2026-free-units-locked-models)
- The Wan 2.2 FLF HF Space itself includes an optional Nano Banana-based end-frame generator (`multimodalart/nano-banana-private`). — [app.py](https://huggingface.co/spaces/multimodalart/wan-2-2-first-last-frame/raw/main/app.py)

### Inferences
- Neuron math (my calculation; tile rounding is assumed): a 1000×760 reference needs about 2×2 = 4 input tiles, and a ~1024×768 output about 4 output tiles.
  - klein-4b: about 4×26.05 + 4×5.37 ≈ 126 neurons/edit, so about 79 edits/day free.
  - klein-9b: about 1,364 + ~140 ≈ 1,500 neurons, so about 6/day.
  - flux-2-dev at about 28 steps: about 4×37.5×28 + 4×18.75×28 ≈ 6,300 neurons, so about 1–2/day.
  - klein-4b is the clear free-API choice for producing "lance spun / smaller / off-frame" variants of each card in batch. klein-4b's 512-tile pricing suggests output size is flexible.
- Style fidelity to flat/painterly official art is best when edits are minimal (move/scale/rotate an element, add VFX), keeping the rest of the official pixels. Masked inpainting (SD 1.5 inpainting on Workers AI) or manual compositing may beat whole-image regeneration.

### Gaps
- Qwen Chat (Qwen-Image-Edit) free daily limits: no official or third-party numbers found.
- Official numeric Gemini-app free image-edit cap for Oct 2026 (Google's page shows no number).
- Workers AI's exact tile-rounding rule for non-multiple-of-512 sizes, and klein-4b max input references and output resolution (per-model pages not fetched).
- Licence terms for FLUX.2 klein outputs via Workers AI (not checked).
