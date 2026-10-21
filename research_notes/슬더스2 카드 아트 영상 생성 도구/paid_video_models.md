# 유료 호스팅 AI 영상 생성 모델: 키프레임 조건부 image-to-video (2026년 10월 기준)

> 조사일: 2026-10-21. 가격은 모두 USD이며, 확인한 페이지와 날짜를 각 항목에 적었다. "(3자/벤더 블로그, 미검증)"이라고 표시한 수치는 공식 페이지에서 확인하지 못한 것이다.
> 대상 사용 사례: 슬레이 더 스파이어 2 공식 카드 일러스트(플랫 셰이딩, 페인터리 2D, 약 1000×760, 약 4:3, 게임 내 250×190으로 표시되고 hover 시 확대)를 2–5초 길이의 끊김 없는 루프로 만든다. 루프의 시작과 끝은 공식 일러스트와 정확히 같아야 하고, 중간 키프레임은 이미지 편집 모델로 만든다.

## 1. 2026년 10월 현재 first+last frame(또는 multi-keyframe) 조건부 생성과 루프를 지원하는 모델

### Takeaway
2026년 10월 기준으로 시작·끝 프레임을 모두 받는 유료 모델은 Veo 3.1(Standard/Fast/Lite), Seedance 1.5 Pro/2.0/2.0 Fast/2.0 Mini/2.5, Kling 3.0(Std/Pro/O1/Omni), MiniMax H3·H3 Max(Hailuo 3), Wan 2.7·Wan 2.2 KF2V, PixVerse V6(Transition), Vidu Q3(start-end), Luma Ray3.2, FLUX 3 Max Keyframes, LTX-2.5, p-video다. 세 장 이상의 키프레임을 시간 위치를 지정해 넣을 수 있는 모델은 FLUX 3 Max Keyframes-to-Video(최대 10장)와 Luma Ray3.2(최대 16장)뿐이다. Sora 2 API는 2026-09-24에 종료됐고, Runway Gen-4.5·Wan 3.0·Gemini Omni Flash·HappyHorse·Grok Imagine은 첫 프레임만 받는다.

### Cited Findings
**모델 지형 변화(2026년 하반기)**
- OpenRouter가 공개한 영상 모델 29개 중 15개가 last frame을 받는다. 지원 모델(길이와 해상도): veo-3.1 / 3.1-fast / 3.1-lite(4·6·8초), seedance-1-5-pro(4–12초, 480p–1080p), seedance-2.0(4–15초), seedance-2.5(4–30초, 480p/720p), kling-v3.0-std/pro(3–15초, 720p), kling-video-o1(5·10초), hailuo-3(5–15초, 2K), hailuo-3-max(5–15초, 480p/768p), wan-2.7(2–10초), wan2.2-kf2v-flash(5초 고정), flux-3-video(5–20초), ltx-2.5-fast(2–20초), p-video(1–20초). 2026-09-19 기사다 — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/)
- **이름과 달리 첫 프레임만 받는 모델**은 alibaba/wan-3, runwayml/gen-4.5, minimax/hailuo-2.3, kling-v2.6, wan-2.5-i2v-fast다. 이 모델에 두 번째 이미지를 보내도 **오류 없이 조용히 무시된다**. — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/)
- OpenRouter 비교표(2026-09-29 게시, 2026-10-15 갱신)에서는 26개 중 15개가 First+last를 지원한다. wan-3.0, wan-3.0-prime, wan-2.6, happyhorse-1.0/1.1, grok-imagine-video 1.5/1.5-lite, heygen-video-1, runway/gen-4.5, hailuo-2.3은 "First only"다. — [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/)
- 파라미터 이름이 모델마다 다르다. `first_frame_url/last_frame_url`(Alibaba kf2v), `start_image/end_image`(Kling, Luma, Vidu), `image/last_frame_image`(Seedance, PixVerse, LTX, p-video), `image/lastFrame`(Veo 3.1). — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/)

**Multi-keyframe(3장 이상)**
- **FLUX 3 Max Keyframes-to-Video**(fal, Black Forest Labs)는 이미지를 최대 10장 받는다. 각 이미지에 24fps 타임라인 기준의 `frame_index`를 고유하게 지정하고, 최댓값은 길이×24다. 길이는 5–20초(1초 단위), 해상도는 720p 기본에 1080p 옵션이 있다. 화면비는 21:9·2:1·16:9·**4:3**·1:1·3:4·9:16 중에서 고른다. 오디오는 기본 켜짐이고 끌 수 있으며 seed를 지정할 수 있다. 루프 기능은 언급이 없다. — [fal: FLUX 3 Max Keyframes to Video](https://fal.ai/models/blackforestlabs/flux-3-max/keyframes-to-video)
- **Luma Ray3.2**는 클립당 키프레임을 최대 16장 지원하고, start_frame/end_frame으로 앞뒤 확장과 이미지 간 보간을 한다. — [Luma API pricing](https://lumalabs.ai/api/pricing). 생성 길이는 최대 20초이고 API에서도 전체 컨트롤을 쓸 수 있다 — [Luma 발표](https://lumalabs.ai/news/introducing-ray-3-2). ComfyUI 노드에서는 키프레임 위치를 길이 대비 비율이나 절대 초로 지정한다 — [ComfyUI 문서](https://docs.comfy.org/built-in-nodes/LumaRay32KeyframeNode)
- Kling 3.0 Omni에는 샷 단위 스토리보드 컨트롤이 있다(벤더 블로그) — [Elser AI](https://www.elser.ai/blog/kling-vs-seedance-vs-veo-for-anime-videos-which-ai-model-wins-in-2026). Seedance 2.5는 참조 자산을 최대 50개 받지만 OpenRouter 표기는 "Ref"(참조)로, 시간 위치를 지정하는 키프레임은 아니다 — [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/)

**루프**
- 네이티브 `loop: true` 플래그는 **Luma Ray 모델에만** 있다(ray-3.2는 5·10초). 이 플래그는 `end_image`와 함께 쓸 수 없다. — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/). Luma 공식 가격 페이지와 Ray3.2 발표에서는 loop 언급을 찾지 못했다 — [Luma API pricing](https://lumalabs.ai/api/pricing)
- 첫 프레임과 끝 프레임에 **같은 이미지**를 넣으면 루프는 정확히 닫히지만 **움직임이 억제된다**. wan2.2-kf2v-flash와 Veo 3.1 Lite에서 확인됐다. 저자는 모델의 loop 기능보다 로컬 crossfade나 ping-pong으로 루프를 직접 닫는 쪽을 권한다. — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/)
- 같은 시작·끝 이미지가 매끄러운 루프를 보장하지는 않는다. 이음매는 기하 형태와 움직임이 이어지는지에 달려 있다(벤더 블로그) — [Magic Hour](https://magichour.ai/blog/how-to-make-seamless-ai-video-loops)

**사용할 수 없거나 해당하지 않는 모델**
- OpenAI는 2026-03-24에 Sora 종료를 공지했다. 앱은 2026-04-26에 닫혔고 **API(sora-2, sora-2-pro)는 2026-09-24에 제거**됐으며 후속 모델은 없다(3자 출처가 OpenAI deprecation 페이지를 인용) — [TechJack Solutions](https://techjacksolutions.com/ai-brief/openai-videos-api-sora-2-deprecated-september-2026/); [Zilliz](https://zilliz.com/ai-faq/what-is-the-sora-shutdown-timeline); [OCDevel](https://ocdevel.com/mlg/mla-26)
- Gemini API의 Veo 3.1 **preview** 모델 ID(`veo-3.1-generate-preview`, `-fast-`, `-lite-`)는 **2026-10-22에 종료**된다. Google은 Gemini Omni Flash(`gemini-omni-1.1-flash`)나 "Gemini Enterprise Agent Platform"의 GA 모델로 옮기라고 권한다(GA 모델 ID는 명시하지 않음) — [Gemini API video docs](https://ai.google.dev/gemini-api/docs/video); [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Runway API는 Gemini Omni Flash 1.1에 "start frame" 입력만 과금 항목으로 둔다. last frame 지원은 어느 모델에도 표기가 없다 — [Runway API pricing](https://docs.dev.runwayml.com/guides/pricing/). Runway 모델 문서에서 first+last를 명시한 모델은 **MiniMax H3 Max**와 **Kling 2.5 Turbo Pro**(5·10초)뿐이다 — [Runway models](https://docs.dev.runwayml.com/guides/models/)
- Runway Aleph 2.0은 키프레임 가이드를 받는 video-to-video 편집 모델이다(이미지에서 영상을 만드는 모델이 아님) — [Runway models](https://docs.dev.runwayml.com/guides/models/)
- PixVerse는 v3.5부터 V6·C1까지 Transition(first/last)을 지원한다. V6는 1–15초, 1080p까지 된다(PixVerse Platform Docs를 인용한 검색 요약) — [PixVerse docs](https://docs.platform.pixverse.ai/v6-2056814m0)
- Vidu Q3 Turbo와 Pro에는 start-end-to-video 엔드포인트가 있다(Novita 문서) — [Novita](https://blogs.novita.ai/vidu-q3-turbo-on-novita/)
- MiniMax H3(fal)는 first+last 프레임으로 두 이미지 사이의 전환을 제어할 수 있고, 출력은 입력 화면비를 따른다 — [fal: MiniMax H3](https://fal.ai/models/minimax/h3/image-to-video)
- Kling 3.0 Pro(fal)는 `end_image_url`(선택), `negative_prompt`, `cfg_scale`을 받으며 화면비는 시작 이미지를 따른다 — [fal: Kling v3 Pro](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video)

### Inferences
- "Ice Lance" 같은 연출(창이 회전하며 날아와 효과가 커지다가 공식 일러스트에서 끝남)을 **한 번의 생성으로 루프까지** 만들 수 있는 구성은 `[공식 아트 @0, 편집 키프레임 B @중간, 공식 아트 @끝]`이다. 이 구성은 multi-keyframe 모델(FLUX 3 Max Keyframes, Luma Ray3.2)에서만 바로 표현할 수 있다.
- first+last만 받는 모델로는 두 가지 방법이 있다. (a) 루프를 A→B, B→A 두 세그먼트로 나누면 클립 수가 2배가 된다. (b) "B(창이 아직 화면 밖) → 공식 아트" 한 세그먼트만 만들고, 루프 이음매는 로컬에서 crossfade나 역재생으로 처리한다.
- 시작과 끝에 공식 아트를 그대로 넣으면 움직임이 거의 없는 결과가 나오기 쉽다(Mervin Praison의 측정 결과). 그래서 이미지 편집으로 "다른" 중간·시작 키프레임을 만드는 이 프로젝트의 설계는 타당하다.
- 출력은 VAE를 거친 재생성 영상이고 해상도도 480p/720p로 낮아진다. 따라서 마지막 프레임이 공식 아트와 픽셀 단위로 같을 수는 없다. 마지막 몇 프레임을 원본 아트로 교체하거나 crossfade하는 후처리가 사실상 필요하다(Mervin Praison의 VACE 관찰 근거: 유지 영역도 VAE 왕복을 거친다).

### Gaps
- Veo 3.1 GA(Vertex/"Gemini Enterprise Agent Platform") 모델 ID와, GA Lite에서 lastFrame이 공식 지원되는지는 Google 문서에서 직접 확인하지 못했다. 서드파티 Atlas Cloud는 Lite start-end를 720p/1080p, **8초, 16:9·9:16만, 오디오 상시**로 표기한다 — [Atlas Cloud](https://www.atlascloud.ai/ko/models/google/veo3.1-lite/start-end-frame-to-video). 초기 preview에서 lastFrame 오류가 났다는 포럼 글도 있다 — [Google AI forum](https://discuss.ai.google.dev/t/veo-3-1-last-frame-parameter-not-supported/107529)
- Luma Ray3.2의 loop 플래그와 end_frame 필드명은 공식 API 레퍼런스(docs.lumalabs.ai)에서 확인하지 못했다.
- Gemini Omni Flash 1.1이 last frame을 받는지는 확인하지 못했다. AA I2V 4위 모델이라 확인할 가치가 있다.

## 2. 공식 API와 애그리게이터의 초당·클립당 가격, 최소 길이, 배치·API 제공 여부

### Takeaway
480p/720p 기준 first+last 지원 모델의 초당 가격은 약 $0.012(Seedance 1.5 Pro 480p 무음)에서 약 $0.57(Seedance 2.5 720p, fal US)까지 50배 가까이 벌어진다. 실제 비용은 **오디오 끄기**와 **최소 길이**(Veo 4초, MiniMax H3·FLUX 3·Luma 5초, Kling 3초, Wan 2.7 2초, PixVerse·p-video 1초)에 크게 좌우된다. FLUX 3 Max Keyframes는 2026-11-07까지 75% 할인 중이다($0.0425/s, 720p).

### Cited Findings
**공식 페이지(직접 확인)**
- **Gemini API(Veo 3.1, 오디오 포함, 유료 티어 전용)**: Standard는 720p·1080p $0.40/s, 4K $0.60/s. Fast는 720p $0.10, 1080p $0.12, 4K $0.30. **Lite는 720p $0.05, 1080p $0.08**(4K 미지원). 생성에 성공했을 때만 과금된다. Gemini Omni Flash 1.1은 720p 약 $0.10/s(출력 토큰 기준)다. 페이지 최종 갱신일은 2026-10-19다 — [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- **Vertex 무음(Veo)**: Lite 720p $0.03/s, Fast 720p $0.08/s, Standard 720p/1080p $0.20/s다. Gemini API에서는 오디오가 항상 켜지고 Vertex에서만 `generateAudio:false`를 쓸 수 있다. Vertex는 us-central1 리전만 지원하고 생성물은 2일 뒤 삭제된다 — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/). OpenRouter도 Lite 720p를 무음 $0.03, 오디오 $0.05로 표기한다 — [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/)
- **Veo 길이 제약**: 4·6·8초만 가능하다. 1080p는 8초가 강제되어 2초 요청도 8초로 과금된다 — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/). 1080p와 4K 출력은 8초 클립을 업스케일한 것이다 — [OCDevel](https://ocdevel.com/mlg/mla-26)
- **Runway API**(1크레딧 = $0.01, 2026-10-21 확인): Gen-4.5 $0.12/s, Gen-4 Turbo $0.05/s, Aleph 2.0 $0.28/s(56크레딧 최소), Veo 3.1 무음 $0.20/s, Veo 3.1 Fast 무음 $0.10/s, **Kling 3.0 Std 무음 $0.09 / Pro 무음 $0.12**, Kling O3 Std $0.13, **Seedance 2.5 $0.20/$0.30/$0.68(480/720/1080p)**, Seedance 2.0 $0.36(480·720p), 2.0 Fast $0.29, 2.0 Mini $0.16(64크레딧 최소), **MiniMax H3 Max $0.05(480p)/$0.08(768p)**, Hailuo 3 $0.10(768p)/$0.15(2K)에 키프레임 장당 +$0.02, WAN 3 $0.05/$0.10/$0.20, Gemini Omni Flash 1.1 $0.034(360p)/$0.10(720p) — [Runway API pricing](https://docs.dev.runwayml.com/guides/pricing/)
- **Luma Ray3.2**(공식, 날짜 없음, 영상당 SDR 기준): 5초 클립이 540p $0.15, 720p $0.30, 1080p $1.20이고, 10초 클립은 $0.45/$0.90/$3.60이다. **5초 블록 단위로 과금**하며 HDR은 2배다. FAQ 수치가 표와 일부 맞지 않는다 — [Luma API pricing](https://lumalabs.ai/api/pricing)

**애그리게이터(fal, OpenRouter, Replicate 등)**
- **FLUX 3 Max Keyframes(fal)**: 2026-10-15부터 11-07까지 75% 할인으로 720p $0.0425/s, 1080p $0.0725/s다. 정가는 **720p $0.17/s, 1080p $0.29/s**이고 최소 5초다 — [fal](https://fal.ai/models/blackforestlabs/flux-3-max/keyframes-to-video). OpenRouter의 flux-3-video 표기는 720p $0.17에서 4K $0.41까지다 — [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/)
- **MiniMax H3(fal)**: 480p $0.05/s, 768p $0.06, 2K $0.13, 4K $0.16. 길이 선택지는 페이지에 없다 — [fal](https://fal.ai/models/minimax/h3/image-to-video). H3는 4–15초 생성이 된다 — [OCDevel](https://ocdevel.com/mlg/mla-26). OpenRouter의 hailuo-3는 2K $0.13/s에 참조 이미지 장당 +$0.04, hailuo-3-max는 480p $0.05, 768p $0.08이며 5–15초다 — [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/)
- **Kling 3.0 Pro(fal)**: 무음 $0.112/s, 오디오 $0.168/s, 3–15초 — [fal](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video). OpenRouter 기준 Std 무음은 $0.084다 — [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/)
- **Seedance 2.5 US(fal)**: 480p $0.2646/s, 720p 약 $0.5676/s, 1080p 약 $1.396/s. 토큰 과금이며 tokens = 높이×너비×길이×24/1024, 단가는 $0.02568/1K tokens(480·720p)다. 기본 길이 4초, 최대 30초 — [fal](https://fal.ai/models/bytedance/seedance-2.5/us/image-to-video). OpenRouter는 480p를 "From $0.1028"로 표기하므로 **제공자마다 2.5배 이상 차이**가 난다 — [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/)
- **Seedance 계열(OpenRouter 최저가)**: 1.5 Pro 480p 무음 $0.0115(오디오 $0.0231), 2.0 Mini 480p $0.03363, 2.0 Fast 480p $0.04035, 2.0 480p $0.06726 — [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/). Seedance는 토큰 과금이고 Replicate에서는 오디오 기본값이 **켜짐**이라 비용이 2–4배로 뛸 수 있다 — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/)
- **Wan**: wan-2.7(OpenRouter) $0.10/s, 2–10초. wan2.2-kf2v-flash(Alibaba 직접) $0.07/s로 5초 고정이며 클립당 $0.35. Wan VACE(fal)는 480p $0.04, 720p $0.08 — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/)
- **초저가 first+last**: prunaai/p-video(Replicate)는 draft 720p $0.005/s, base 720p $0.02/s이고 최소 1초다. LTX-2.5-fast는 2초에 약 $0.06 — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/)
- **Vidu Q3(3자, 미검증)**: Turbo는 540p $0.0357/s(peak)이고 off-peak(48시간 내 처리) 50% 할인이다. start-end 엔드포인트는 Turbo와 Pro 모두 있다 — [Novita](https://blogs.novita.ai/vidu-q3-turbo-on-novita/). Vidu 직접 구매 시 Turbo off-peak $0.035/s — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/). CometAPI 기준 Q3는 360·540p $0.056, 720·1080p $0.1232, Turbo는 그 절반 — [CometAPI](https://www.cometapi.com/models/vidu/vidu-q3-turbo/)
- **PixVerse V6 Transition(3자, 미검증)**: Atlas Cloud는 Start-End-to-Video를 $0.025/s로 표기한다. PixVerse 자체 API 1080p는 초당 18–23크레딧, 약 $0.10–0.15라는 리뷰가 있다. EmpirioLabs는 360p 무음 $0.10/s부터로 표기한다 — [Atlas Cloud](https://www.atlascloud.ai/blog/tips/pixverse-v6-review); [EmpirioLabs](https://catalog.empiriolabs.ai/models/pixverse-v6)
- **Kling 공식 가격(3자, 서로 불일치)**: Krea는 std $0.1764, pro $0.2352, 4K $0.441/s에 오디오 +50%로 표기한다 — [Krea](https://www.krea.ai/blog/kling-3-0-api-access-guide-pricing-code-examples-for-multi-shot-ai-video). AIReiter는 V3 Std 720p 약 $0.10/s, Pro 1080p 약 $0.16/s로 Kling 개발자 가격을 인용한다 — [AIReiter](https://aireiter.com/blog/kling-3-api-pricing-guide-2026). Atlas는 V3 1080p 약 $0.168/s다 — [Atlas Cloud](https://www.atlascloud.ai/blog/guides/kling-ai-api-pricing)
- **Artificial Analysis의 1080p 1분 가격(제작사 API 기준)**: MiniMax H3(768p) $5.40, FLUX 3 Max(720p) $2.55(할인가 반영으로 추정), Seedance 2.5 $24.60, Gemini Omni Flash 1.1 $9.12, Veo 3.1 $24.00, Veo 3.1 Fast $9.00, Kling 3.0 Pro $20.16, PixVerse V6 $6.90, Vidu Q3 Pro $9.60, Vidu Q3 Turbo $3.90 — [Artificial Analysis I2V](https://artificialanalysis.ai/video/leaderboard/image-to-video)

**배치와 API 제공 여부**
- Gemini API 이미지 모델에는 Batch 50% 할인이 있다. Veo 영상의 배치 가격은 표에 없다 — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- Vidu는 off-peak(48시간 내 처리) 50% 할인을 준다(Novita 경유) — [Novita](https://blogs.novita.ai/vidu-q3-turbo-on-novita/)
- 위 모델은 모두 REST API(fal, Replicate, OpenRouter, Runway, Vertex, Gemini API, Alibaba DashScope, Vidu 직접)로 쓸 수 있다 — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/); [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/)

### Inferences
- 게임 내 표시 크기(250×190)라면 480p로 충분하고, hover 확대까지 고려해도 720p면 넉넉하다. 1080p 이상은 이 용도에서 대부분 낭비다.
- 같은 모델도 제공자에 따라 가격이 2–3배 차이 난다(Seedance 2.5: OpenRouter $0.10 vs Runway $0.20 vs fal US $0.26, 480p 기준). 반드시 엔드포인트별로 비교해야 한다.
- 4초 클립은 Veo, Seedance, Kling, Wan 2.7, PixVerse, p-video에서 그대로 과금된다. 반면 MiniMax H3 Max, FLUX 3 Max, Luma는 5초 최소라 실효 단가가 25% 오른다.

### Gaps
- Kling, PixVerse, Vidu, BytePlus(Seedance), MiniMax 공식 가격 페이지에서 직접 확인한 수치는 없다(JS 렌더링이나 검색 미노출 때문). 모두 3자 수치다.
- Veo 3.1 GA 모델이 Vertex에서 받는 가격(무음 포함)은 공식 페이지에서 직접 확인하지 못했다. Mervin Praison과 OpenRouter의 수치를 썼다.

## 3. 비용 추정: 카드 600장 × 시도 3–5회 × 약 4초

### Takeaway
오디오를 끄고 480p/720p로 돌리면, 실사용 가능한 최저 티어(Seedance 1.5 Pro, Veo 3.1 Lite, Seedance 2.0 Mini, FLUX 3 Max 할인가)로 영상만 **약 $80–$640**이 든다. 고품질 티어(FLUX 3 Max 정가, Kling 3.0 Pro, Veo 3.1 Standard, Seedance 2.5 720p)는 **약 $800–$4,800**이고, fal US의 Seedance 2.5 720p는 최대 약 $6,800이다. 키프레임 이미지 편집은 이미지 1,800–3,600장 기준으로 **$30–$500 수준**이라 전체 예산에서 비중이 작다.

### Cited Findings
- 계산 기준: 600장 × 3회 × 4초 = **7,200초**, 600장 × 5회 × 4초 = **12,000초**. 최소 5초인 모델은 9,000초와 15,000초로 계산했다. Luma는 5초 블록 1,800개와 3,000개다. 단가 출처는 2번 항목과 같다.

| 티어 | 모델 / 경로 / 해상도(무음) | 단가 | 3회 | 5회 | 단가 출처 |
|---|---|---|---|---|---|
| 최저가 | Seedance 1.5 Pro / OpenRouter / 480p | $0.0115/s | $83 | $138 | [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/) |
| 최저가 | Veo 3.1 Lite / Vertex / 720p | $0.03/s | $216 | $360 | [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/) |
| 최저가 | Veo 3.1 Lite / Gemini API(오디오 강제) / 720p | $0.05/s | $360 | $600 | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| 최저가 | Seedance 2.0 Mini / OpenRouter / 480p | $0.0336/s | $242 | $404 | [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/) |
| 최저가 | Vidu Q3 Turbo off-peak / Vidu 직접 | $0.035/s | $252 | $420 | [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/) |
| 최저가(한시) | FLUX 3 Max Keyframes / fal / 720p, 할인(~11/7), 5초 최소 | $0.0425/s | $383 | $638 | [fal](https://fal.ai/models/blackforestlabs/flux-3-max/keyframes-to-video) |
| 최저가 | Luma Ray3.2 / 공식 / 540p, 5초 블록 | $0.15/클립 | $270 | $450 | [Luma](https://lumalabs.ai/api/pricing) |
| 중간 | MiniMax H3 Max / Runway·OpenRouter / 480p, 5초 최소 | $0.05/s | $450 | $750 | [Runway](https://docs.dev.runwayml.com/guides/pricing/) |
| 중간 | MiniMax H3 / fal / 768p, 4초 가정 | $0.06/s | $432 | $720 | [fal](https://fal.ai/models/minimax/h3/image-to-video) |
| 중간 | Seedance 2.0 / OpenRouter / 480p | $0.0673/s | $484 | $807 | [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/) |
| 중간 | Luma Ray3.2 / 공식 / 720p | $0.30/클립 | $540 | $900 | [Luma](https://lumalabs.ai/api/pricing) |
| 중간 | Veo 3.1 Fast / Vertex / 720p | $0.08/s | $576 | $960 | [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/) |
| 중간 | Kling 3.0 Std / OpenRouter / 720p | $0.084/s | $605 | $1,008 | [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/) |
| 중간 | Wan 2.7 / OpenRouter / 720p | $0.10/s | $720 | $1,200 | [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/) |
| 고품질 | Seedance 2.5 / OpenRouter / 480p | $0.1028/s | $740 | $1,234 | [OpenRouter](https://openrouter.ai/blog/insights/image-to-video-models-compared/) |
| 고품질 | Kling 3.0 Pro / fal / 무음 | $0.112/s | $806 | $1,344 | [fal](https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video) |
| 고품질 | FLUX 3 Max Keyframes / fal / 720p 정가, 5초 최소 | $0.17/s | $1,530 | $2,550 | [fal](https://fal.ai/models/blackforestlabs/flux-3-max/keyframes-to-video) |
| 고품질 | Veo 3.1 Standard / Vertex / 720p | $0.20/s | $1,440 | $2,400 | [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/) |
| 고품질 | Seedance 2.5 / Runway / 720p | $0.30/s | $2,160 | $3,600 | [Runway](https://docs.dev.runwayml.com/guides/pricing/) |
| 고품질 | Veo 3.1 Standard / Gemini API(오디오) / 720p | $0.40/s | $2,880 | $4,800 | [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) |
| 고품질 | Seedance 2.5 / fal US / 720p | $0.5676/s | $4,087 | $6,811 | [fal](https://fal.ai/models/bytedance/seedance-2.5/us/image-to-video) |

- 키프레임 이미지(카드당 1–2장 × 3회 = 1,800–3,600장) 단가와 총액: Nano Banana 2.1 1K $0.0336(Batch $0.0168)이면 $60–$121(Batch $30–$60). Nano Banana Pro $0.134(Batch $0.067)이면 $241–$482. 단가 출처는 [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)이다. 다른 모델은 6번 항목을 참고한다.

### Inferences
- first+last만 받는 모델로 루프를 A→B, B→A 두 세그먼트로 만들면 위 영상 비용이 그대로 **2배**가 된다. multi-keyframe 한 클립으로 끝내는 FLUX 3 Max나 Luma Ray3.2는 이 점에서 상대적으로 유리하다.
- 현실적인 단계별 예산은 이렇다. 먼저 카드 10–20장으로 후보 3–4개 모델을 파일럿한다(수십 달러). 이어 최저가 티어로 전량을 생성하고, 실패한 카드만 고품질 티어로 재시도한다. 이렇게 하면 총 **$300–$1,500**(이미지 포함)이 합리적인 범위다(추정).
- FLUX 3 Max 할인(~2026-11-07)은 일정이 맞으면 고품질 multi-keyframe 모델을 최저가 티어 가격으로 쓸 수 있는 기회다.

### Gaps
- 실제 "수용 가능한 결과" 비율(카드당 필요한 시도 횟수)에 대한 2D 아트 기준 데이터가 없어서 3–5회는 가정이다.
- 오디오 없이 과금되는지(Gemini API Veo는 오디오 강제), 4:3 화면비 출력 시 토큰 과금 해상도가 어떻게 계산되는지는 모델별로 검증하지 않았다.

## 4. 2D 일러스트·애니·플랫 컬러에 대한 품질 근거

### Takeaway
2D 플랫 컬러 일러스트에서 스타일 보존, 키프레임 정확도, 루프 이음매를 모델 간에 통제된 조건으로 비교한 공개 벤치마크는 찾지 못했다. 일반 I2V 아레나(Artificial Analysis) 상위권은 MiniMax H3, FLUX 3 Max, Seedance 2.5, Gemini Omni Flash 1.1, Wan 3.0이고, Veo 3.1과 Kling 3.0은 중위권이다. 애니 관련 평가는 대부분 벤더 블로그다(Kling은 근소 우위, Veo는 실사 질감으로 끌려가는 경향, MiniMax는 스타일 안정성 언급). 독립 정량 테스트(Mervin Praison)에 따르면 키프레임으로 묶으면 흔들림이 1/10로 줄지만 움직임도 함께 줄고, 루프는 결국 로컬 후처리로 닫아야 했다.

### Cited Findings
- **Artificial Analysis AA-Video-I2V v1.1 리더보드(Elo, 기준점은 Kling 3.0 Pro = 1000)**: MiniMax H3(768p) 1140, **FLUX 3 Max(720p) 1138**(2026-10 출시), **Seedance 2.5 1138**, Gemini Omni Flash 1.1 1132, Wan 3.0 1127, **MiniMax H3 Max 1125**, Seedance 2.0 1121, FLUX 3 1086, Grok Imagine Video 1.5 1067, HappyHorse-1.1 1061, Wan 2.7 1034, **Veo 3.1 1028**, PixVerse V6 1024, Veo 3.1 Fast 1017, Vidu Q3 Pro 1016, Kling 3.0 Omni Pro 1004, **Kling 3.0 Pro 1000**, LTX-2.5 Fast 984, Vidu Q3 Turbo 967 — [Artificial Analysis](https://artificialanalysis.ai/video/leaderboard/image-to-video)
- **독립 정량 테스트(Mervin Praison, 2026-09)**: 키프레임(first+last) 모드는 일반 i2v(first only) 대비 영역별 churn이 약 1/10이었다(나무 2.67 vs 34.14, 천 2.94 vs 26.91). Veo 3.1 Lite에 같은 이미지를 양끝으로 넣으면 전체 drift가 2.5로, 제약 없는 모델의 29.3보다 훨씬 낮았다. LTX-2.5-fast는 drift 34.3으로 **얼굴이 다르게 재생성**되어 입력 이미지가 주체인 작업에는 부적합했다. wan-3은 얼굴 churn 9.00이었다. 테스트한 네 모델 모두 **스스로 루프가 닫히지 않았고** 로컬 crossfade나 ping-pong이 필요했다. 2초로 계획한 클립은 5초 클립의 앞 2초보다 움직임이 많고(31.6 vs 23.3) 이음매도 깨끗했다(1.05 vs 2.31). 프롬프트 문구 변경의 효과는 ±10–28%로 작았고, 저자는 양끝 고정이 지배적이라고 본다 — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/)
- **"순수 보간 = crossfade" 위험**: 순수 보간은 두 프레임의 픽셀을 섞어 crossfade처럼 보이고, Veo 3.1은 "guided interpolation"을 한다는 설명이 있다(벤더 가이드) — [veo3ai.io](https://www.veo3ai.io/blog/veo-3-1-frames-to-video-guide-2026). 마지막 프레임과의 픽셀·지각 차이와, 중간 구간에서 유사도가 꺼지는지(dissolve 징후)를 측정하라는 권고가 있다(검색 요약, 위 Mervin Praison 글 기반)
- **애니 비교(Elser AI, 2026-08-05, 자사 제품 판매 벤더)**: Kling이 애니 스타일 충실도에서 "근소하게" 우위다. Seedance는 입력 레퍼런스가 일관되면 애니 레퍼런스를 잘 따른다. Veo는 애니 출력이 가능하지만 **실사 질감과 과한 움직임**을 막으려면 추가 프롬프트가 필요하다. Kling은 빠른 회전, 가림, 손 접촉이 있을 때 drift가 생긴다. 클립 수, 프롬프트, 지표는 공개하지 않았다 — [Elser AI](https://www.elser.ai/blog/kling-vs-seedance-vs-veo-for-anime-videos-which-ai-model-wins-in-2026)
- **애니·스타일화 추천(벤더 블로그, 검색 요약이라 어느 글의 주장인지 특정 불가)**: 2026년 애니 영상 생성기 랭킹류 글에서 MiniMax Hailuo는 캐릭터 정체성과 색·스타일 안정성으로, PixVerse는 애니 컨트롤로 자주 거론된다. PixVerse는 자사 랭킹에서 스스로를 1위로 꼽는다 — [PixVerse blog](https://pixverse.ai/en/blog/best-ai-anime-video-generators-2026); [RoboNeo](https://www.roboneo.com/blog/best-ai-video-generators-anime-style-2026); [Morphed](https://morphed.app/blog/ai-video-generator-for-anime)

### Inferences
- AA 아레나는 일반 프롬프트(주로 실사) 기준 선호도라서 2D 플랫 셰이딩 보존이나 키프레임 정확도를 직접 재지 않는다. 다만 상위 모델 중 first+last 이상을 받는 모델은 FLUX 3 Max(multi-keyframe), Seedance 2.5, MiniMax H3/H3 Max다. **Wan 3.0과 Gemini Omni Flash는 first-only라서 이 용도에서는 순위와 무관하다.**
- "회전하는 창" 같은 강체 움직임은 키프레임 사이 거리가 멀수록(창이 화면 밖에서 날아옴) 모델이 dissolve나 morph로 때우기 쉽다. 그래서 중간 키프레임을 촘촘히 박는 multi-keyframe 모델이 유리할 것으로 본다(추론이며 검증되지 않음).
- 플랫 셰이딩 아트는 실사 질감으로 끌려갈 위험이 있다(Veo 관련 언급). 파일럿에서 Veo 계열과 Seedance/MiniMax/FLUX를 같은 카드로 직접 비교해 봐야 한다.

### Gaps
- 2D 플랫 컬러 아트에서 모델 간 flicker, 선 떨림, 색 번짐을 비교한 통제 실험은 찾지 못했다.
- 강체(창, 검) 회전 운동의 정확도와 형태 보존에 대한 비교 근거는 찾지 못했다.
- 마지막 프레임이 입력 이미지와 얼마나 일치하는지(PSNR이나 LPIPS) 모델별 수치는 찾지 못했다.
- Reddit 등 커뮤니티 실사용 후기는 이번 검색에서 나오지 않았다.

## 5. 출력 라이선스, 워터마크, 게임 아트 업로드 관련 정책, 입력 데이터의 학습 사용

### Takeaway
Google Gemini API 유료 티어는 소유권을 주장하지 않고 프롬프트와 응답을 학습에 쓰지 않는다고 명시하지만, Veo 출력에는 SynthID 비가시 워터마크가 들어간다. fal 약관은 **업로드하는 입력에 대한 권리를 사용자가 보증**해야 하고 "저작권 보호 자료를 권리자 허락 없이 업로드 금지"라고 명시한다. 그래서 Mega Crit의 공식 아트를 올리는 것 자체가 약관 리스크다. Kling은 3자 분석 기준으로 콘텐츠를 학습·홍보에 쓰는 넓은 라이선스를 가져간다. Seedance는 IP 필터가 강화돼 게임 아트가 오탐으로 거절될 수 있다.

### Cited Findings
- **Google Gemini API 추가 약관**(2026-04-28 갱신, 2026-03-23 발효): 생성 콘텐츠에 대해 "Google won't claim ownership"이라고 명시한다. **유료 서비스의 프롬프트와 응답은 제품 개선에 쓰지 않는다**(DPA 적용). 무료 서비스는 학습에 쓴다. 유료 서비스 로그는 정책 위반 탐지 등을 위해 "제한된 기간"만 보관한다 — [Gemini API Terms](https://ai.google.dev/gemini-api/terms). 가격 페이지에도 "paid tier 콘텐츠는 제품 개선에 사용되지 않음"이 있고, Veo와 이미지 모델에는 무료 티어가 없다 — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- **Veo와 Gemini Omni 출력에는 전부 SynthID**가 들어가고 공개 검출기는 없다 — [OCDevel](https://ocdevel.com/mlg/mla-26). Veo 생성물은 2일 뒤 삭제되고, EU·UK·스위스·MENA 지역에서는 personGeneration이 제한된다 — [Mervin Praison](https://mer.vin/2026/09/which-ai-video-models-actually-take-a-first-and-last-frame/)
- **fal 약관**(2026-09-08 갱신): 출력 소유권을 명확히 고객에게 주는 조항이 없다. 기본 라이선스는 "personal or internal business use"다. 고객은 입력에 필요한 모든 권리를 보유한다고 보증하고 **"저작권 등 보호 자료를 소유자 허락 없이 업로드하지 말 것"**(6(d))을 지켜야 하며, 고객 콘텐츠로 인한 3자 청구는 고객이 면책해야 한다. fal은 "익명화·집계된" 사용 데이터(입력에서 파생된 것 포함)를 자사 제품과 AI 모델 개발에 쓸 수 있다. 3자 모델에는 별도 약관이 적용될 수 있다 — [fal Terms](https://fal.ai/terms). fal 모델 페이지에는 "Commercial use" 태그만 있고 조건은 적혀 있지 않다 — [fal: FLUX 3 Max](https://fal.ai/models/blackforestlabs/flux-3-max/keyframes-to-video)
- **Kling(3자 분석, 공식 원문 미확인)**: 정책상 출력 소유권에 대한 언급이 없다. Kling이 콘텐츠를 홍보나 제품 업그레이드에 쓰거나 3자에게 라이선스할 수 있다. 모델 학습 라이선스는 support@kling.ai로 이메일을 보내 철회할 수 있다는 분석이 있다 — [ConductAtlas](https://conductatlas.com/platform/kling-ai/kling-ai-terms-of-service/). API 출력의 상업적 이용 여부는 경로, 모델 버전, 제공자 약관에 달려 있다 — [WaveSpeed](https://wavespeed.ai/blog/video-model-access/can-i-use-kling-ai-api-for-commercial-projects/). 유료 티어에서는 상업 권리를 주고 무료 티어에는 워터마크가 붙는다(일반론) — [OCDevel](https://ocdevel.com/mlg/mla-26)
- **Seedance 2.0 IP 필터(3자·뉴스)**: Disney, Paramount, MPA가 cease-and-desist를 보냈고 ByteDance는 안전장치를 강화하겠다고 했다. 필터는 이름 없이도 시각적 특징이 유명 IP와 비슷하면 거절할 수 있고 집행이 일관적이지 않다는 보고가 있다. 일부 3자 플랫폼은 자체 사전 심사 단계에서 "not eligible"을 반환한다 — [Segmind](https://blog.segmind.com/seedance-2-0-copyright-issues-what-happened-and-whats-next/); [MindStudio](https://mindstudio.ai/blog/seedance-2-0-content-restrictions-workarounds); [The Source](https://thesource.com/2026/04/15/seedance/)
- **MiniMax H3**은 오픈 웨이트(33B)이고 상업적 이용을 허용하는 커뮤니티 라이선스를 쓴다. 미국, EU, 영국, 한국에서는 회사 신청 절차가 있다고 한다 — [OCDevel](https://ocdevel.com/mlg/mla-26)
- Sora는 저작권 캐릭터 정책을 opt-out에서 opt-in과 수익 배분으로 바꾼 뒤 종료됐다 — [OCDevel](https://ocdevel.com/mlg/mla-26)
- BytePlus(Seedance) 영상 생성 서비스는 미국에서 제공되지 않는다는 블로그 주장이 있다(미검증) — [AI Video Bootcamp](https://aivideobootcamp.com/blog/seedance-2-0-mini-2026/)

### Inferences
- 슬레이 더 스파이어 2 아트의 저작권은 Mega Crit에 있다. fal 같은 애그리게이터 약관 기준으로는 권리자 허락 없이 업로드하는 것이 약관 위반 소지가 있다. 무료 모드로 재배포하는 경우 출력의 권리 문제는 대부분 생성 서비스가 아니라 **원작 IP 권리자(Mega Crit)의 팬 콘텐츠·모드 정책**에 달려 있다.
- 학습 사용 리스크는 Google 유료 티어가 가장 명확하게 낮다(약관에 명시). fal은 "익명·집계" 수준이고, Kling은 넓은 라이선스, ByteDance와 MiniMax는 미확인이다.
- 화면에 보이는 워터마크는 유료 API 출력에서는 일반적으로 없는 것으로 보인다(무료 티어나 소비자 앱의 이야기). SynthID 같은 비가시 워터마크는 Google 모델에 항상 들어간다.

### Gaps
- Mega Crit의 STS2 팬 콘텐츠·모드·AI 생성물 관련 공식 정책은 이번 범위에서 조사하지 않았다(별도 확인 필요).
- ByteDance(BytePlus ModelArk), MiniMax, Luma, BFL(FLUX 3), Vidu, PixVerse의 API 약관 원문(출력 소유권, 입력 학습 사용)은 직접 확인하지 못했다.
- 애그리게이터를 경유할 때 원 모델 제공자 약관이 어떻게 적용되는지(fal 14조 "additional terms")는 모델별로 확인하지 못했다.

## 6. 추가 키프레임을 같은 스타일로 만드는 유료 이미지 편집 모델과 장당 비용

### Takeaway
공식 가격으로는 Google Nano Banana 2.1(1K $0.0336, Batch $0.0168)이 가장 저렴하면서 최신이다. Nano Banana Pro(Gemini 3 Pro Image, $0.134, Batch $0.067)는 고품질 옵션이다. 애그리게이터에서는 FLUX.2 편집 계열($0.008–$0.03/MP), Seedream 5.0 Lite 편집($0.035), Qwen-Image-Edit(약 $0.021–$0.037), GPT Image 2(품질에 따라 약 $0.01–$0.22 이상)가 있다. 장당 비용은 모두 몇 센트 수준이라 전체 예산에서 비중이 작다. 결정 요인은 스타일 보존 품질이다.

### Cited Findings
- **Google 공식**(Gemini pricing, 2026-10-19 갱신, 일반 / Batch): Nano Banana 2.1은 1K $0.0336 / $0.0168, 2K $0.0504 / $0.0252. Nano Banana 2(Gemini 3.1 Flash Image)는 1K $0.067 / $0.034. Nano Banana 2 Lite는 1K $0.0336 / $0.0168. **Nano Banana Pro(Gemini 3 Pro Image)는 1K·2K $0.134 / $0.067**, 4K $0.24. Nano Banana(Gemini 2.5 Flash Image)는 2026-10-02에 종료됐다 — [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)
- **Runway API 재판매가**(장당): Gen-4 Image $0.05(720p)/$0.08(1080p), Gen-4 Image Turbo $0.02, Seedream 5 Pro $0.05(1K)/$0.09(2K), Seedream 5 Lite $0.04, Gemini Image 3 Pro $0.20, Nano Banana 2.1 $0.04(1K), GPT Image 2 $0.01–$0.41, GPT Image 2.5 $0.01–$0.76, Ideogram 4.5 $0.01–$0.25 — [Runway API pricing](https://docs.dev.runwayml.com/guides/pricing/)
- **Luma Uni-1.1**: 2K 이미지 편집 $0.0434, Uni-1.1 Max 편집 $0.1030 — [Luma API pricing](https://lumalabs.ai/api/pricing)
- **fal(검색 요약, 일부는 fal 학습 페이지)**: FLUX.2 [pro] Edit 약 $0.03/MP, FLUX.2 [dev] Turbo Edit $0.008/MP(입력+출력), FLUX.2 [klein] 9B Edit $0.015/MP, Seedream 4.5 Edit 약 $0.04, Seedream 5.0 Lite Edit 약 $0.035 — [fal learn: image editing tools](https://fal.ai/learn/tools/ai-image-editing-tools)
- **Qwen-Image-Edit**: fal에서 약 $0.021, Qwen Image Edit 2511은 $0.037(3자 애그리게이터, 날짜 불명) — [PricePerToken](https://pricepertoken.com/fal-ai-pricing)
- **GPT Image 2(3자, 서로 불일치)**: Segmind는 1024² 기준 low $0.01, medium $0.06, high $0.22이고 편집은 입력 토큰이 추가된다고 한다 — [Segmind](https://www.segmind.com/models/gpt-image-2/pricing). Atlas Cloud는 품질과 크기에 관계없이 $0.008 정액이라고 한다 — [Atlas Cloud](https://www.atlascloud.ai/pl/blog/guides/gpt-image-2-api-guide). fal은 이미지 토큰을 입력 $8, 출력 $30/1M으로 과금하고 편집 기본값은 high다 — [fal llms.txt](https://fal.ai/models/openai/gpt-image-2/edit/llms.txt)

### Inferences
- 키프레임 3,600장(카드당 2장 × 3회) 기준으로 Nano Banana 2.1 Batch는 약 $60, 일반 요금은 약 $121이다. Nano Banana Pro는 Batch 약 $241, 일반 약 $482다. Seedream 5 Lite는 약 $126–$144, Qwen-Image-Edit는 약 $76이다.
- 공식 아트의 해상도(1000×760, 약 0.76MP)는 1K 티어에 들어간다. 2K나 4K 과금은 필요 없다.
- Seedance 2.x 계열 영상과 함께 쓴다면 같은 ByteDance 계열인 Seedream 편집이 스타일 일관성 면에서 유리할 수 있다. 다만 근거는 없고 추론일 뿐이다.

### Gaps
- 플랫 셰이딩 페인터리 2D 아트에서 편집 모델 간 스타일 보존(붓 터치, 색 팔레트 유지)을 비교한 근거는 찾지 못했다.
- OpenAI 공식 가격 페이지의 GPT Image 2 편집 단가, BFL 공식 FLUX.2/FLUX 3 편집 단가, Alibaba 공식 Qwen-Image-Edit 단가는 직접 확인하지 못했다.
