# STS2 카드 아트 프레임 안 AI 생성 루프 영상: 제작 파이프라인과 인게임 재생 (2026-10 기준)

> 조사 범위와 기준
> - 기준일 2026-10-21. 엔진은 게임과 같은 MegaDot 4.5.1(`4.5.1.m.14.mono.custom_build`), Metal Forward+, .NET 9.
> - 로컬 저장소 `/Users/flavono123/P/slseoun-mods`(CLAUDE.md, docs/feasibility.md, docs/poc-stage1.md, `mods/SlseounLivingArt/SlseounLivingArtCode/*.cs`)는 읽기만 했다. 게임 설치본은 바이너리 문자열과 PCK 경로만 읽기 전용으로 확인했다.
> - Godot 소스 인용은 GitHub `4.5-stable` 태그다. MegaDot은 커스텀 빌드라 차이가 있을 수 있다.
> - 영상 생성 모델의 비교·가격은 이 노트의 범위가 아니다. 파이프라인 설계에 필요한 입력 조건(첫/끝 프레임, 화면비, fps)만 다룬다.
> - 실측 인코딩은 하지 못했다. 로컬 Homebrew ffmpeg 8.1에 libtheora 인코더가 없고, 환경을 바꾸지 말라는 조건 때문에 `ffmpeg-full`을 설치하지 않았다. 따라서 Theora 용량과 디코드 비용은 모두 추정이며 Inferences에 따로 표시했다.

## 1. Godot 4.5.1에서 UI 카드 안 영상 재생: 방식, 성능, 포맷·해상도·용량

### Takeaway
엔진 내장 코덱은 Ogg Theora 하나뿐이다. 게임 엔진 바이너리에 Theora 모듈이 들어 있으므로 모드는 `.ogv`를 PCK에 실어 `VideoStreamPlayer`로 재생할 수 있다. 권장 구성은 다음과 같다. 플레이어는 화면에 그리지 않는 디코더로만 쓰고, 그 `get_video_texture()`를 기존 레이어의 셰이더가 게임 아틀라스와 섞어 그린다. 영상은 250×190, 24 fps, yuv444p 하나만 만든다. 이 구성은 디스크와 VRAM 모두에서 플립북보다 한 자릿수 이상 싸다. 600장 전체 용량은 대략 50~130 MB로 추정되지만 실측이 필요하다.

### Cited Findings

**코덱과 엔진 지원**
- Godot 코어가 지원하는 영상 포맷은 Ogg Theora(선택적으로 Vorbis 오디오)뿐이다. H.264/H.265는 소프트웨어 특허 때문에 코어에 넣을 수 없다. AV1은 로열티는 없지만 CPU 디코딩이 느리다. WebM은 4.0에서 제거됐다. 다른 포맷은 확장으로만 추가할 수 있다. — [Godot 4.5 docs: Playing videos](https://docs.godotengine.org/en/4.5/tutorials/animation/playing_videos.html); [stable](https://docs.godotengine.org/en/stable/tutorials/animation/playing_videos.html)
- 디코딩은 CPU에서 한다. GPU에는 Theora 하드웨어 가속이 없다. 문서는 현대 데스크톱 CPU가 "1440p @ 60 FPS or more"를 디코드한다고 하며, 데스크톱 권장값은 최대 1080p, 30 FPS다. — [Godot 4.5 docs](https://docs.godotengine.org/en/4.5/tutorials/animation/playing_videos.html)
- 4.5 클래스 레퍼런스에 따르면 `VideoStreamPlayer`에는 `loop`, `expand`, `buffering_msec`(기본 500), `stream_position`, `speed_scale`, `paused`가 있다. `get_video_texture()`의 설명은 "Returns the current frame as a Texture2D"다. `stop()`은 위치를 0으로 돌리지만 "첫 프레임이 현재 프레임이 되지는 않는다". Web에서는 아키텍처별 어셈블리 최적화가 없어 성능이 나쁘다. — [Godot 4.5 class ref: VideoStreamPlayer](https://docs.godotengine.org/en/4.5/classes/class_videostreamplayer.html)
- 로컬 확인(2026-10-21):
  - 게임 실행 파일 `SlayTheSpire2.app/Contents/MacOS/Slay the Spire 2`의 문자열에 `VideoStreamTheora`, `26ResourceFormatLoaderTheora`, `VideoStreamPlayer`, `audio/video/video_delay_compensation_ms`, `4.5.1.m.14.mono.custom_build`가 있다. 즉 MegaDot에 Theora 모듈이 컴파일돼 있다.
  - 게임 PCK에서는 `.ogv`·`.webm`·`.mp4` 경로와 `VideoStream*` 참조를 찾지 못했다. 게임 자체는 영상을 쓰지 않는 것으로 보인다.
  - — 로컬 게임 설치본 `~/Library/Application Support/Steam/steamapps/common/Slay the Spire 2/` (strings/grep 결과)

**4.5 소스에서 본 재생 경로** (`4.5-stable`)
- `VideoStreamPlayer` — [video_stream_player.cpp](https://raw.githubusercontent.com/godotengine/godot/4.5-stable/scene/gui/video_stream_player.cpp)
  - `NOTIFICATION_INTERNAL_PROCESS`는 가시성을 검사하지 않는다. 노드를 숨겨도 디코딩은 계속된다.
  - `play()` 직후 첫 틱은 `first_frame`이므로 delta 0으로 `playback->update()`를 부른다.
  - 재생이 끝났을 때 `loop`가 켜져 있으면 `play()`를 다시 부르고 `finished`를 내지 않는다.
  - 트리가 일시정지(`NOTIFICATION_PAUSED`)되면 플레이어도 멈추고, 트리를 나가면 `stop()`한다.
  - 그리기는 `draw_texture_rect(texture, Rect2(Point2(), expand ? get_size() : texture_size), false)`다.
  - 오디오 믹스 콜백은 트리에 들어갈 때 항상 등록된다.
- `VideoStreamPlaybackTheora` — [video_stream_theora.cpp](https://raw.githubusercontent.com/godotengine/godot/4.5-stable/modules/theora/video_stream_theora.cpp)
  - 스레드를 만들지 않는다. 디코딩은 `update()` 안에서 한다.
  - YUV→RGB 변환은 CPU의 `yuv444_2_rgb8888`, `yuv422_2_rgb8888`, `yuv420_2_rgb8888`로 하고, 결과는 RGBA8 버퍼다.
  - 매 프레임 `texture->update(img)`로 `ImageTexture`를 갱신한다.
  - 스트림 끝에 이르면 `stop()` → `seek(0)`으로 처음으로 돌아간다. 파일을 다시 열거나 헤더를 다시 읽지 않는다.
  - `set_file()`은 파일 열기, 스트림·헤더 파싱, `th_decode_alloc`, 파일 끝 근처를 탐색해 길이 추정, `seek(0)`을 한 번에 한다. 그래서 스트림을 지정할 때 비용이 든다.
- Godot의 `yuv2rgb.h`는 4:2:0 크로마를 보간하지 않고 2×2로 복제한다(nearest). 444·422·420을 모두 지원하고, 알파는 255로 고정한다. 색 행렬(BT.601/709)은 테이블만 있어서 확인하지 못했다. `y_table[16]`이 0점이라 제한 범위(16–235)로 보인다(추정). — [yuv2rgb.h](https://raw.githubusercontent.com/godotengine/godot/4.5-stable/thirdparty/misc/yuv2rgb.h)

**루프 이음새**
- 4.5 문서는 Loop 속성이 영상 끝에서 "seamlessly restart"한다고 한다. 다만 프로젝트 설정 Video Delay Compensation이 0이 아니면 매 루프 시작에 A/V 동기를 맞추느라 프레임이 빠질 수 있으니 0으로 두라고 한다. — [Godot 4.5 docs](https://docs.godotengine.org/en/4.5/tutorials/animation/playing_videos.html)
- 과거 이슈 #25216은 루프 지점에서 프레임이 빠지고 배경이 비치는 문제였다. 문서 PR #7479에 따르면 4.1의 godot#77856 이후 `finished`→`play()` 루프가 이음새 없이 동작한다. — [Issue #25216](https://github.com/godotengine/godot/issues/25216); [godot-docs PR #7479](https://github.com/godotengine/godot-docs/pull/7479)
- PR #101958 "Fix Theora video issues"(4.4, 2025-02-17 머지) — [PR #101958](https://github.com/godotengine/godot/pull/101958)
  - 고친 것: 중복 프레임(TH_DUPFRAME) 무시, 프레임이 예정보다 일찍 표시되는 문제, 원래 그림 크기·오프셋으로 자르지 않아 생기던 아티팩트, 루프 사이 오디오 버퍼 미비움.
  - 비활성 상태이던 Theora 스레드 스트리밍 코드는 제거했다.
  - 리뷰에서 DeeJayLSP는 Godot의 Theora에 ARM SIMD가 없다고 지적했다. Calinou가 본 성능 저하는 디버그 빌드에서만 나타났다.
- PR #102360(4.5, 2025-05-22 머지)은 Theora seek(`set_stream_position`)를 구현했다. 정지할 때 현재 프레임을 지우지 않게 해서 루프를 매끄럽게 했다. seek 시간은 GOP가 길수록 늘어난다. — [PR #102360](https://github.com/godotengine/godot/pull/102360)

**인코딩 권장값**
- Godot 문서 권장 명령은 `ffmpeg -i input.mp4 -q:v 6 -q:a 6 -g:v 64 output.ogv`다. `-q:v`는 1–10이고 6이 균형점이다. GOP 기본값 12는 너무 낮으며 64–512가 압축에 좋다. 64부터는 2의 거듭제곱을 넘을 때마다 seek 시간이 늘어난다. 문서는 ffmpeg가 libtheora를 포함해야 하고, 내장 Theora exporter보다 VBR 외부 인코더를 쓰라고 권한다. — [Godot 4.5 docs](https://docs.godotengine.org/en/4.5/tutorials/animation/playing_videos.html); [stable](https://docs.godotengine.org/en/stable/tutorials/animation/playing_videos.html)
- ffmpeg libtheora — [ffmpeg-codecs: libtheora](https://ffmpeg.org/ffmpeg-codecs.html#libtheora); [libtheoraenc.c](https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavcodec/libtheoraenc.c)
  - `-q:v`는 [0–10]으로 잘린 뒤 6.3을 곱해 libtheora 품질 [0–63]이 된다. `flags +qscale`(VBR) 아니면 `-b:v`(CBR)를 쓴다.
  - 입력 픽셀 포맷은 `yuv420p`, `yuv422p`, `yuv444p`이고 각각 TH_PF_420/422/444에 대응한다.
  - 코딩 프레임은 16의 배수로 패딩되고(`frame_width = FFALIGN(width,16)`), 실제 그림 크기는 `pic_width`로 보존된다.
- 로컬 확인: Homebrew `ffmpeg` 8.1에는 `--enable-libtheora`가 없다(encoders 목록에 theora 0건). keg-only인 `ffmpeg-full` 9.0.2는 의존성에 `theora`, `libvorbis`, `webp`를 포함한다. — 로컬 `ffmpeg -version`, `brew info ffmpeg-full`; Homebrew가 2026-01-14에 ffmpeg 포뮬러를 슬림화하고 `ffmpeg-full`을 추가한 PR: [homebrew-core #261303](https://github.com/Homebrew/homebrew-core/pull/261303)

**영상 외 대안: 플립북**
- `AnimatedTexture`는 4.5에서 deprecated다. 문서는 "does not work properly in current versions and may be removed", "not efficient for the modern renderers"라고 하고 대안이 없다고 한다. `MAX_FRAMES`는 256이다. — [Godot 4.5 class ref: AnimatedTexture](https://docs.godotengine.org/en/4.5/classes/class_animatedtexture.html)
- 텍스처 임포트 모드 — [Godot 4.5 docs: Importing images](https://docs.godotengine.org/en/4.5/tutorials/assets_pipeline/importing_images.html)
  - Lossless·Lossy는 디스크만 줄이고 VRAM은 무압축과 같다.
  - VRAM Compressed는 VRAM을 4–6배 줄이지만 저해상도 2D에서 아티팩트가 보인다. High Quality는 데스크톱에서 BPTC(BC7)이고 Forward+/Mobile에서만 쓸 수 있다.
  - Basis Universal은 파일이 매우 작지만 품질이 낮고 압축이 느리다.
  - `Texture2DArray`는 내장 셰이더로 표시할 수 없어 커스텀 셰이더가 필요하다.
- 단계 1 PoC 측정(잿불 3초, 20 fps, 60장, 250×190) — [docs/poc-stage1.md](/Users/flavono123/P/slseoun-mods/docs/poc-stage1.md)
  - 디스크: PNG 1.48 MB, WebP 무손실 1.78 MB, WebP q85 0.62 MB. 598장으로 환산하면 370~1,060 MB다.
  - VRAM: 카드당 RGBA8 11.4 MB, BC7 2.9 MB.
  - 검사 화면(1.75배)에서는 구운 프레임을 한 번 더 필터링하므로 덜 선명하다.
  - 손패 10장을 실시간·플립북으로 재생해도 GPU 증가분은 0.6 ms 이하로 측정 잡음 수준이다. MoltenVK 타임스탬프 기준이며, Metal은 GPU 시간을 0으로 보고한다.

**카드 쪽 구조(현재 PoC)**
- 초상화는 `CardContainer/PortraitCanvasGroup/Portrait`의 250×190 `TextureRect`이고 텍스처는 아틀라스의 `AtlasTexture`다. 아틀라스 스프라이트 자체도 250×190이다(예: `ironclad/bash.png` region (2017,2875,250,190)). 기준 뷰포트 너비는 1920이고 `stretch/mode = canvas_items`다. PCK에는 `images/packed/card_portraits/**.png` 910개(대체 경로)가 있다. — [sts2_card_rendering_internals.md](/Users/flavono123/P/scare-the-spire/research_notes/슬더스2%20카드%20아트%20모드%20타당성/sts2_card_rendering_internals.md)
- 사이트 저장소의 STS2 카드 초상화 WebP는 1000×760이다(로컬 `sips` 확인, `public/images/sts2/cards/abrasive.webp`). 게임 PCK에서 추출하는 스크립트는 `scripts/extract-card-portraits.py`다. — 로컬 저장소 `/Users/flavono123/P/scare-the-spire`
- 현재 레이어는 `%Portrait` 자식으로 `ClipContents` 250×190 Control을 붙이고, 그 안의 `Polygon2D`가 셰이더로 게임 아틀라스 페이지를 샘플한다. `intensity`는 0.25초에 걸쳐 0→1로 페이드인하고 0.3초에 걸쳐 1→0으로 페이드아웃한 뒤 레이어를 해제한다. intensity 0은 바닐라와 같다(최대 차 1/255). — [LivingArtLayer.cs](/Users/flavono123/P/slseoun-mods/mods/SlseounLivingArt/SlseounLivingArtCode/LivingArtLayer.cs); [docs/poc-stage1.md](/Users/flavono123/P/slseoun-mods/docs/poc-stage1.md)
- 양보 판정은 그대로 쓸 수 있다. `%Portrait.Material`이 null이 아니거나, 텍스처가 매니페스트의 아틀라스·영역이 아니거나, BC7 블록 해시가 다르면 정지 초상화로 남는다. — [PortraitGate.cs](/Users/flavono123/P/slseoun-mods/mods/SlseounLivingArt/SlseounLivingArtCode/PortraitGate.cs)

**GDExtension 코덱**
- `GDExtensionManager.load_extension(path)`는 절대 경로를 받아 `LoadStatus`(OK, FAILED, ALREADY_LOADED, NOT_LOADED, NEEDS_RESTART)를 돌려준다. 클래스 설명은 "do not worry about GDExtension unless you know what you are doing"이라고 한다. — [GDExtensionManager (4.4)](https://docs.godotengine.org/de/4.4/classes/class_gdextensionmanager.html); [4.2](https://docs.godotengine.org/en/4.2/classes/class_gdextensionmanager.html)

### Inferences

**재생 구조 권장안**
- `VideoStreamPlayer`는 디코더로만 쓰고 그리지 않는다.
  - 모드 소유의 숨긴 노드 아래에 플레이어 몇 개를 풀로 둔다. 카드 트리 바깥에 둬도 된다. 숨겨도 internal process가 돌기 때문이다.
  - `get_video_texture()`가 돌려주는 `ImageTexture`를 카드 레이어 셰이더의 uniform으로 넘긴다.
  - 셰이더는 `mix(atlas_sample, video_sample, w)`로 그린다. `w`는 기존 intensity 트윈이다.
  - 이렇게 하면 쉬는 상태와 페이드 경계에서 화면은 항상 게임 아틀라스 그대로의 픽셀이다. 손실 코덱의 0번 프레임이 원작과 완전히 같지 않아도 팝이 생기지 않는다.
  - PoC의 `Polygon2D`+아틀라스 샘플 셰이더, 클립, CanvasGroup 경로를 그대로 재사용한다.
- hover 직후 빈 프레임을 보이지 않게 한다.
  - `set_file()` 전에는 텍스처가 빈 이미지다. `play()` 후 첫 틱(delta 0)에 0번 프레임이 디코드된다.
  - 따라서 스트림 지정 → `play()` → 한 프레임 대기 → `w` 페이드인 순서로 한다. 대기는 `IsPlaying`이 참이고 텍스처가 갱신된 다음 틱으로 판정한다.
  - `set_stream`(파일 열기, 헤더 파싱, 끝 탐색)은 PCK 안의 작은 파일이라 수 ms 이하일 것으로 보인다(미실측). 손패 카드는 `NCard.Reload` 때 미리 해 둘 수 있다.
- 같은 카드 ID는 디코더 하나를 공유한다. 손패의 타격 5장, 덱 보기의 중복 카드가 텍스처 하나를 같이 쓴다. 그러면 "평소에도 재생"의 비용이 화면 위 고유 카드 수에 비례한다.
- 동시 재생 수에 상한을 둔다.
  - hover·집기·사용만 할 때는 실질적으로 1~3개다.
  - "평소에도"는 손패와 플레이 영역의 고유 카드로 한정하고, 덱 보기 같은 그리드는 정지로 둔다.

**CPU·메모리 추정** (문서 수치에서 계산, 미실측)
- 250×190 @ 24 fps는 약 1.14 Mpx/s다. 문서의 "1440p@60 이상"은 약 221 Mpx/s이므로, 플레이어 하나가 디코드 여력의 약 0.5%를 쓴다. 500×380 @ 24 fps는 약 4.6 Mpx/s로 약 2%다.
- Apple Silicon에서는 ARM SIMD가 없으니 x86보다 느리다. 여기에 메인 스레드 YUV→RGB 변환과 텍스처 업로드가 더해진다. 1×에서는 프레임당 190 KB, 10개 동시면 초당 약 45 MB를 올린다.
- 1× 10개는 메인 스레드에서 프레임당 1 ms 안팎, 2× 10개는 수 ms로 예상한다. 게임 안에서 재야 한다.
- 활성 플레이어당 메모리는 RGBA 버퍼 190 KB, `ImageTexture` 190 KB, Theora 참조 프레임(256×192 패딩, 4:4:4 세 평면 × 2~3장 ≈ 0.3–0.45 MB)을 더해 약 1 MB다(1× 기준). 2×는 약 4 MB다. 플립북은 카드당 2.9–11.4 MB이므로 영상이 한 자릿수 작다.

**해상도·fps·픽셀 포맷 권장**
- 해상도는 250×190 하나다.
  - 게임은 손패·hover·검사 화면 모두 같은 250×190 아틀라스 스프라이트를 확대해 그린다. 그래서 바닐라의 선명도 자체가 250×190이다.
  - 500×380 영상은 검사 화면(1.75배)이나 4K(2배)에서 정지 초상화보다 선명해진다. 그러면 정지↔영상 전환 때 선명도가 튀고, CPU·업로드는 4배, 디스크는 약 2.5–3배가 된다.
  - 2×는 정지 초상화까지 고해상도로 바꿀 때에만 의미가 있다. 이는 이번 범위 밖이다.
- fps는 24로 한다. Veo가 24 fps로 낸다. RIFE로 48 fps를 만드는 것은 느린 움직임이 계단처럼 보일 때만 쓴다. 인터 프레임 코덱이라 용량은 2배보다 덜 늘지만 디코드 비용은 2배다.
- 픽셀 포맷은 `yuv444p`로 한다. Godot의 4:2:0은 크로마를 2×2로 복제하므로 250×190에서는 빨강·금색 가장자리에 크로마 계단이 보일 가능성이 크다. 4:4:4는 크로마 비트를 더 쓰지만 이 크기에서는 절대량이 작다.
- GOP는 128, 또는 클립 길이 이상으로 둔다. 루프는 항상 0번 프레임(키프레임)에서 다시 시작하므로 seek가 필요 없고, GOP가 클수록 압축이 잘 된다. "평소에도" 모드에서 카드마다 위상을 무작위로 주려면 seek를 쓰고 GOP를 24로 줄인다.
- 250×190은 16의 배수가 아니라 256×192로 패딩된다. 그림 영역 자르기는 4.4의 #101958에서 고쳐졌으므로 4.5.1에서는 문제없을 것으로 본다.

**용량 추정** (가정 기반, 반드시 실측)
- Theora q7–8을 저해상도에 쓸 때 0.2–0.5 bit/pixel을 쓴다고 가정했다.
  - 250×190 × 24 fps × 3초 ≈ 3.4 Mpx이므로 카드당 85–215 KB다. 600장이면 약 50–130 MB다.
  - 500×380이면 카드당 200–500 KB, 600장이면 120–300 MB다.
- 비교 대상
  - WebP q85 플립북: 72프레임 ≈ 0.75 MB/카드, 600장 ≈ 450 MB. VRAM은 카드마다 RGBA8로 풀린다.
  - BC7 `.ctex` 플립북: 252×192 × 1 B/px × 72 ≈ 3.5 MB/카드, 600장 ≈ 2.1 GB.
  - 참고로 Workshop 인기 연출 모드 More Ironclad Animations의 파일 크기는 59 MB다([similar_mods_originality.md](/Users/flavono123/P/scare-the-spire/research_notes/슬더스2%20카드%20아트%20모드%20타당성/similar_mods_originality.md)).

**대안 순위**
1. Theora + 아틀라스 합성 셰이더(권장).
2. `Texture2DArray` 또는 아틀라스 플립북 + 커스텀 셰이더. 프레임 단위 제어(역재생, 무작위 위상, 정확한 0번 프레임)가 꼭 필요한 소수의 희귀 카드에만 쓴다.
3. `SpriteFrames`/`AnimatedSprite2D`. 동작하지만 VRAM이 플립북과 같다.
4. `AnimatedTexture`. deprecated이므로 쓰지 않는다.
5. GDExtension 코덱(VP9/AV1). 쓰지 않는 것이 맞다.
   - 플랫폼별 네이티브 바이너리, macOS 서명·라이브러리 검증, 공식 로더의 등록 경로가 모두 미확인이다.
   - Workshop 사용자 신뢰 문제도 있다.
   - 250×190에서는 Theora로 충분하다.

**macOS·CanvasGroup**
- 디코딩은 엔진 내부 C 코드라 VideoToolbox 같은 OS 의존성이 없다. 같은 `.ogv`가 Windows·Linux·Steam Deck에서도 돈다.
- 셰이더 합성이라면 CanvasGroup 아래의 그리기는 PoC와 같은 경로다. 영상 텍스처는 Texture2D uniform 하나가 늘어날 뿐이다.

### Gaps
- Theora 실측이 없다. 250×190·500×380 클립의 파일 크기, M3에서 플레이어당 디코드 ms, 10개 동시 비용을 재지 못했다. 로컬 ffmpeg에 libtheora가 없고, 설치는 조건상 하지 않았다. `ffmpeg-full`로 3~5장을 샘플 인코딩해 게임 안에서 재는 것이 다음 단계다.
- Godot `yuv2rgb.h`의 색 행렬(BT.601/709)을 확정하지 못했다. 테스트 차트를 왕복해 인코더 쪽 `out_color_matrix`를 맞춰야 한다.
- 루프가 다시 시작될 때 프레임 하나가 한 틱 더 머무는지는 실측하지 못했다. 소스상으로는 같은 틱에 재시작한다.
- `VideoStreamPlayer`를 여러 개 동시에 돌린 성능 보고는 찾지 못했다.
- 게임의 Video Delay Compensation 값은 PCK 문자열에서 키를 찾지 못했다. 기본값으로 추정하지만, 런타임에 `ProjectSettings.GetSetting`으로 읽어 확인해야 한다.
- `.ogv`가 모드 PCK export에 자동으로 포함되는지, 모드 PCK 경로의 `ResourceLoader.Load<VideoStream>`이 되는지는 미확인이다(추정상 가능).
- 공식 로더 환경에서 모드가 GDExtension을 로드할 수 있는지는 확인하지 않았다.

## 2. 공식 아트에 고정된 이음새 없는 루프 만들기

### Takeaway
공식 아트(O)를 항상 0번 프레임에 둔다. 중간 키프레임으로 생성했다면 클립을 회전시킨다. 저장 프레임에서는 닫는 O를 빼고, 이음새는 몇 프레임 블렌드로 메운다. 생성 구간마다 O에 맞춰 색을 매칭하고 디플리커한 뒤 4배 축소한다. 쉬는 상태의 "정확한 바닐라 픽셀"은 영상이 아니라 런타임 아틀라스 합성(`w=0`)으로 보장한다. 250×190 목표에서는 업스케일러가 필요 없다.

### Cited Findings
- Veo 3.1 API — [Gemini API: Veo](https://ai.google.dev/gemini-api/docs/veo); [Gemini API: Video](https://ai.google.dev/gemini-api/docs/video)
  - 입력: `image`(첫 프레임), `lastFrame`(끝 프레임, `image`와 함께만 쓸 수 있다), `referenceImages`(최대 3장).
  - 화면비: `aspectRatio`는 "16:9"(기본) 또는 "9:16"뿐이다.
  - 해상도: 720p(기본), 1080p, 4k. 1080p·4k는 8초에서만 된다.
  - 길이: 4/6/8초. 프레임레이트: 24 fps.
  - 오디오는 항상 생성된다. SynthID 워터마크가 들어간다. 생성물은 2일간 보관된다. 지연은 11초~최대 6분이다.
  - Veo 3.1 Preview 모델 ID 3종은 2026-10-22에 종료된다. 문서는 `gemini-omni-1.1-flash` 또는 GA 모델로 옮기라고 한다. Omni의 첫/끝 프레임 지원 여부는 문서에서 확인하지 못했다.
  - `lastFrame` 지원 모델 목록은 요약 과정에서 모호했다(Veo 3.1 Lite·Veo 3로 표기). 재확인이 필요하다.
- Wan 2.2 FLF2V(Fun Inpaint)는 시작 이미지, 끝 이미지, 프롬프트를 받아 영상을 만든다. ComfyUI 워크플로 출력은 720p다. Kling 3.0도 ComfyUI API 노드로 First-Last-Frame-to-Video를 제공한다. — [stable-diffusion-art: Wan 2.2 FLF](https://stable-diffusion-art.com/wan-2-2-first-last-frame-video/); [comfy.org Kling 3.0 FLF2V](https://comfy.org/workflows/api_kling_v3_flf2v-351e79d06ae1/); [runcomfy Wan 2.2 FLF](https://www.runcomfy.com/playground/community/wan-2-2/first-last-frame)
- Practical-RIFE — [GitHub hzwer/Practical-RIFE](https://github.com/hzwer/Practical-RIFE)
  - 최신은 4.26(2024-09)이다. 기본 권장은 4.25이고, 애니메 장면이 크게 개선됐다고 한다.
  - 사용법: `inference_video.py --multi=2`, `--img=`로 PNG 시퀀스 입력, `--scale`(4K는 0.5).
  - 라이선스는 MIT다.
- Real-ESRGAN `realesr-animevideov3`는 애니메 영상용 XS 모델이다. X4 모델이지만 X1–X3에도 쓸 수 있다(`-n realesr-animevideov3 -s 2`). ncnn-vulkan 실행 파일은 Intel/AMD/Nvidia GPU용이라고 되어 있고 Apple GPU는 언급이 없다. — [Real-ESRGAN anime_video_model.md](https://github.com/xinntao/Real-ESRGAN/blob/master/docs/anime_video_model.md)
- Godot 4:2:0 크로마 복제, 제한 범위 추정 — [yuv2rgb.h](https://raw.githubusercontent.com/godotengine/godot/4.5-stable/thirdparty/misc/yuv2rgb.h)
- PoC가 정한 "바닐라로 읽히는" 변위 한도는 대비가 강한 가장자리 3 px, 부드러운 영역 5 px다(250×190 기준). 영상에서 강체(인물, 손, 무기)가 흔들리지 않게 할 기준으로도 쓸 수 있다. — [docs/poc-stage1.md](/Users/flavono123/P/slseoun-mods/docs/poc-stage1.md)
- 후처리 필터는 ffmpeg 문서에 있다: `deflicker`(mode·size), `lut3d`/`haldclut`, `reverse`, `xfade`, `scale` flags(lanczos 등), `ssim`/`psnr`. — [ffmpeg-filters](https://ffmpeg.org/ffmpeg-filters.html#deflicker), [lut3d](https://ffmpeg.org/ffmpeg-filters.html#lut3d), [reverse](https://ffmpeg.org/ffmpeg-filters.html#reverse), [xfade](https://ffmpeg.org/ffmpeg-filters.html#xfade), [ssim](https://ffmpeg.org/ffmpeg-filters.html#ssim)
- 색 전이 라이브러리 color-matcher는 histogram matching, Reinhard, MVGD, MKL과 그 조합을 제공한다. — [GitHub hahnec/color-matcher](https://github.com/hahnec/color-matcher)

### Inferences

**루프 형태** (카드 재질별로 고른다)
- A. 왕복 생성 O→K→O
  - 이미지 편집으로 중간 키프레임 K를 만든다(불길이 더 높다, 빛이 더 밝다 등 구도는 같게). 그리고 O→K, K→O 두 구간을 첫/끝 프레임 조건으로 생성해 잇는다.
  - 첫=끝=O 한 번으로 생성하는 방법도 있다. 다만 첫/끝이 같으면 움직임이 거의 없는 결과가 나오기 쉽다고 알려져 있다(미확인).
  - K 지점에서 속도가 꺾일 수 있으므로 K 전후 2~4프레임을 블렌드하거나 RIFE로 다시 만든다.
  - 불·연기·물처럼 흐르는 재질의 기본형이다.
- B. 핑퐁 O→K + 역재생
  - 생성 한 번으로 위치는 이음새 없이 이어진다.
  - 속도가 반대로 바뀌므로 흐르는 재질(불이 아래로 흐름)에는 부자연스럽다. 숨쉬기·발광·흔들림에 맞다.
  - 프레임 수가 약 2배가 된다. 엔진이 역재생을 못 하므로 파일에 구워야 한다.
- C. 정지에서 시작해 한 번 돌고 정지로 복귀(루프 없음)
  - '사용' 상태(PoC `PlayHold` 1.2초)에 맞다. 마지막 프레임이 O이므로 끝나고 정지 초상화로 바로 넘어간다.
- D. 긴 클립에서 창을 잘라 꼬리를 머리로 크로스페이드
  - 형태가 있는 물체는 겹쳐 보이는 고스팅이 생긴다. 안개·빛무리 같은 확산 재질에만 쓴다.

**이음새 규칙**
- 저장 프레임은 0..N−1이고, 닫는 O(프레임 N)는 넣지 않는다. 넣으면 O가 두 번 연속 나와 1/24초 정지처럼 보인다.
- 중간 키프레임으로 O를 썼다면 클립을 회전해서 O가 0번이 되게 한다. hover 순간 화면이 O이기 때문이다.
- 생성 모델은 조건 이미지를 그대로 재현하지 않고 색 이동, 미세 흐림, 재인코딩 손실을 남긴다(모델별 미확인).
- 그래서 다음 순서로 고친다.
  1. 구간 0번 프레임에서 O로 가는 색 변환(LUT)을 구해 구간 전체에 적용한다. 다른 구간에는 따로 구한다.
  2. 0번 프레임을 O로 바꾼다.
  3. 앞뒤 k(3~6)프레임은 `f_i' = lerp(O, f_i, i/k)`로 O 쪽으로 끌어당긴다.
- 강체 영역(인물·손·무기)에는 마스크를 두고 O로 고정 합성한다. 생성 모델의 미세 떨림(boiling)을 지우고 "바닐라로 읽히는" 정도를 높인다. PoC의 마스크 공정(OpenCV)을 재사용할 수 있다.

**쉬는 상태의 정확한 픽셀**
- 손실 코덱의 0번 프레임은 O와 몇 단계 차이가 난다. 정확성은 셰이더 합성으로 보장한다.
  - `w=0`이면 아틀라스 그대로다.
  - 페이드인 0.25초 동안 차이가 섞이며 사라진다.
  - 원하면 루프 경계마다 `w`를 살짝 내리는 엔벨로프도 줄 수 있다.
- 더 나아간 변형이 잔차(residual) 영상이다. 셰이더가 `atlas + (video − 0.5)·2`처럼 아틀라스에 잔차를 더해 복원한다.
  - 정지 영역은 평탄한 회색이라 압축이 아주 잘 될 것이다.
  - 데드존을 두면 움직이지 않는 곳은 재생 중에도 바닐라 픽셀이 된다.
  - 공식 픽셀을 그대로 싣지 않는다는 원칙에도 가까워진다(§4).
  - 단점은 가장자리 링잉이 헤일로로 보일 수 있다는 것이다. 실험이 필요하다.

**색·밝기, 축소, 화면비**
- 처리 순서: 구간별 LUT 매칭(color-matcher MKL 또는 히스토그램 매칭으로 `.cube`를 만들고 ffmpeg `lut3d`로 적용) → `deflicker`(pm 또는 median, size 5–9) → 이음새 처리 → 축소.
- 생성은 720p/1080p로 하고 1000×760 마스터에서 처리한 뒤 Lanczos로 250×190까지 4배 축소한다. 축소가 AI 텍스처 노이즈와 시간축 반짝임을 크게 줄인다.
- 업스케일(Real-ESRGAN)은 250×190 목표에서는 필요 없다. 2× 변형이나 저해상도 생성기에서만 고려한다.
- 화면비: 아트는 1000:760 ≈ 1.316이다.
  - 16:9만 받는 Veo에서는 O를 947×720으로 맞춰 1280×720 가운데에 놓는다. 좌우 약 166 px는 거울 반사·가장자리 연장·아웃페인팅으로 채운다. 생성 뒤 가운데 948×720을 잘라낸다. 채운 영역은 버린다.
  - 임의 해상도를 받는 오픈 모델(Wan via ComfyUI)은 16의 배수 1008×768(1.3125)로 바로 생성할 수 있다.
  - 카메라 이동은 프레임 정렬을 깬다. 프롬프트에 "static camera, no zoom, no pan"을 넣는다. 테두리 영역 SSIM으로 검사해 걸러낸다.
- 보간(RIFE/FILM)은 이음새를 건너서도 해야 한다. 0..N(닫는 O 포함)에 보간한 뒤 마지막 O를 떼어 내야 경계 프레임도 보간된다.

### Gaps
- Veo·Kling·Wan이 첫 프레임을 얼마나 정확히 재현하는지, 첫=끝이 같을 때 움직임이 죽는지에 대한 1차 자료를 찾지 못했다(영상 모델 담당 노트와 교차 확인).
- `gemini-omni-1.1-flash`의 첫/끝 프레임 지원 여부, Veo `lastFrame` 지원 모델 목록(문서 요약이 모호)은 확인이 필요하다.
- 손그림 화풍에서 RIFE와 FILM 품질을 비교한 자료는 찾지 못했다.
- 잔차 영상 방식의 링잉·헤일로는 실험 전이다.

## 3. 자동화: CLI 배치 파이프라인

### Takeaway
카드별로 멱등인 단계 함수를 만든다: 원본 추출 → 분류 → 키프레임 생성 → 영상 생성(API) → 정규화·색 매칭·디플리커·이음새 → 250×190 yuv444p Theora 인코딩 → 검증·검수 자료 → 매니페스트. 이를 내용 해시로 캐시하는 Python CLI로 돌린다. Theora 인코딩에는 libtheora가 든 ffmpeg(`ffmpeg-full`)가 필요하다.

### Cited Findings
- 기존 공정의 원본 단계 — [docs/poc-stage1.md](/Users/flavono123/P/slseoun-mods/docs/poc-stage1.md); [CardManifest.cs](/Users/flavono123/P/slseoun-mods/mods/SlseounLivingArt/SlseounLivingArtCode/CardManifest.cs)
  - `tools/art/extract_atlas.py`가 게임 PCK의 BC7 아틀라스와 카드별 영역·해시를 뽑는다.
  - `tools/card-art-sandbox/crop.gd`가 게임이 그리는 250×190 픽셀을 PNG로 만든다.
  - 매니페스트(`scene`, `rarity`, `atlas`, `region`, `portrait_hash`, `phobia`)를 C#에서 읽는다.
- 검수 영상은 샌드박스를 Movie Maker 모드로 CLI 실행해 뽑고, 사람은 검수만 한다. — [CLAUDE.md (slseoun-mods)](/Users/flavono123/P/slseoun-mods/CLAUDE.md)
- 운영상 Veo 제약: 생성물 2일 보관, 지연 11초~6분, 요청당 영상 1개, 오디오 항상 생성. — [Gemini API: Veo](https://ai.google.dev/gemini-api/docs/veo)
- Godot 권장 인코딩 파라미터, libtheora `-q:v` 매핑, 픽셀 포맷 — §1에 인용한 [Godot docs](https://docs.godotengine.org/en/4.5/tutorials/animation/playing_videos.html), [ffmpeg-codecs](https://ffmpeg.org/ffmpeg-codecs.html#libtheora), [libtheoraenc.c](https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/libavcodec/libtheoraenc.c)
- RIFE `--img` PNG 시퀀스 입력 — [Practical-RIFE](https://github.com/hzwer/Practical-RIFE)
- 로컬 Homebrew `ffmpeg`에는 libtheora가 없다. `ffmpeg-full`은 keg-only다(`/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg`에 설치되며, PATH에 링크되지 않음). — 로컬 `brew info ffmpeg-full`; [homebrew-core #261303](https://github.com/Homebrew/homebrew-core/pull/261303)

### Inferences

**단계 개요** (`tools/video/` 아래 Python CLI, 카드별 작업 디렉터리 `work/<CARD_ID>/`, gitignore)

| 단계 | 입력 → 출력 | 도구 | 캐시 키 |
|---|---|---|---|
| 0 원본 | 게임 PCK → `O_1000.png`(1000×760), `O_250.png`(게임 그대로 250×190), 아틀라스 해시 | 사이트 `scripts/extract-card-portraits.py`, 모드 `extract_atlas.py`, `crop.gd` | 게임 빌드 ID + 카드 ID |
| 1 분류 | 카드 메타 → `plan.json`(재질, 루프 형태 A/B/C/D, 길이, 강체 마스크, phobia) | 규칙 + 사람 검수 | O 해시 |
| 2 키프레임 | O → K1(·K2) | 이미지 편집 API. 구도 고정 프롬프트. 강체 영역 SSIM 하한 검사 | O 해시 + 프롬프트 + 모델 버전 |
| 3 캔버스 | O, K → 모델 화면비 캔버스(Veo 1280×720 거울 패딩 / Wan 1008×768) | Python(Pillow/OpenCV) | |
| 4 영상 생성 | (첫, 끝, 프롬프트) → `seg_*.mp4` | 영상 API 비동기 작업 + 폴링. 보관 기한 안에 즉시 내려받는다. 요청·응답 JSON, 모델 ID, seed 저장 | 입력 해시 + 모델 ID |
| 5 정규화 | mp4 → 1000×760 16bit PNG 시퀀스 | ffmpeg crop/scale/fps | |
| 6 색·디플리커 | 구간별 LUT(O 기준) → 적용 → deflicker | color-matcher → `.cube`, ffmpeg `lut3d`, `deflicker` | |
| 7 이음새 | 0번=O 교체, 경계 k프레임 블렌드, 강체 마스크 합성, (선택) RIFE ×2, 닫는 O 제거 | Python, Practical-RIFE | |
| 8 인코딩 | 250×190 yuv444p Theora `.ogv`(무음) | `ffmpeg-full` | |
| 9 검증 | 프레임 수·fps·크기·픽셀 포맷, 0번 vs `O_250` PSNR/SSIM, 이음새 차이, 밝기 표준편차(플리커), 용량 예산 | ffprobe, ffmpeg `ssim`/`psnr`, Python | |
| 10 검수 자료 | 루프 4회 MP4, 2배 nearest 확대, 콘택트 시트, 샌드박스 Movie Maker 녹화 | ffmpeg, Godot `--write-movie` | |
| 11 매니페스트·빌드 | `cards/manifest.json`에 영상 항목 추가 → `dotnet publish`(PCK에 `.ogv` 포함) | 기존 빌드 | |

**ffmpeg 명령 예시** (`FF=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg`. 경로·필터 인자는 실행 전 확인)

```sh
# 5) Veo 1280x720 결과에서 가운데 1.316 영역을 잘라 1000x760 마스터 PNG로 (오디오 버림)
$FF -i seg_a.mp4 -an -vf "crop=948:720:(iw-948)/2:0,scale=1000:760:flags=lanczos,fps=24" \
    -pix_fmt rgb48be master/a_%04d.png
#    1080p 출력이면 crop=1422:1080:(iw-1422)/2:0

# 6) 구간별 LUT 적용 후 디플리커
$FF -framerate 24 -i master/a_%04d.png \
    -vf "lut3d=file=a_match.cube,deflicker=mode=pm:size=7" -pix_fmt rgb48be graded/a_%04d.png

# 8) 최종 Theora: 250x190, 4:4:4, 무음. 닫는 O는 7단계에서 이미 뺐다.
$FF -framerate 24 -i loop/%04d.png \
    -vf "scale=250:190:flags=lanczos+accurate_rnd+full_chroma_int:out_color_matrix=bt601:out_range=tv,format=yuv444p" \
    -c:v libtheora -q:v 8 -g:v 128 -an out/CINDER.ogv
#    -q:v 7~9 범위에서 용량과 0번 프레임 PSNR을 보고 고른다(문서 기본 6은 1080p 기준).
#    색 행렬은 Godot yuv2rgb와 맞는지 테스트 차트로 확인한 뒤 고정한다.

# 핑퐁(B형): 0..N-1 정방향 + N-2..1 역방향, 총 2N-2프레임 (N은 정방향 프레임 수)
$FF -framerate 24 -i fwd/%04d.png -filter_complex \
    "[0:v]split[f][b];[b]reverse,trim=start_frame=1:end_frame=N_MINUS_1,setpts=PTS-STARTPTS[r];[f][r]concat=n=2:v=1:a=0[out]" \
    -map "[out]" -pix_fmt rgb48be pingpong/%04d.png

# 9) 검증
ffprobe -v error -count_frames -select_streams v:0 \
    -show_entries stream=width,height,pix_fmt,r_frame_rate,nb_read_frames -of json out/CINDER.ogv
$FF -i out/CINDER.ogv -i O_250.png -lavfi "[0:v]trim=end_frame=1,format=yuv444p[a];[1:v]format=yuv444p[b];[a][b]ssim" -f null -

# 10) 검수용: 4회 루프, 2배 nearest 확대 MP4와 콘택트 시트
$FF -stream_loop 3 -i out/CINDER.ogv -vf "scale=500:380:flags=neighbor" \
    -c:v libx264 -crf 14 -pix_fmt yuv420p review/CINDER_loop.mp4
$FF -i out/CINDER.ogv -vf "select=not(mod(n\,6)),tile=6x2" -frames:v 1 review/CINDER_sheet.png
```

**매니페스트 확장안** (기존 `CardEntry`에 덧붙임)

```json
"CINDER": {
  "atlas": "...", "region": [x, y, 250, 190], "portrait_hash": "...", "rarity": "common", "phobia": false,
  "video": "res://SlseounLivingArt/video/ironclad/cinder.ogv",
  "video_sha256": "...", "frames": 72, "fps": 24, "loop": "roundtrip",
  "states": {"hover": "loop", "drag": "loop", "play": "once"},
  "qc": {"frame0_ssim": 0.99, "seam_delta": 0.8, "flicker_std": 0.6},
  "provenance": {"keyframe_model": "...", "video_model": "...", "prompt_sha": "...", "generated": "2026-10-..", "ai": "generated"}
}
```

- 런타임은 기존 `portrait_hash` 게이트를 그대로 쓴다. 해시가 다르면(게임 패치로 그림이 바뀌면) 그 카드는 정지 초상화로 돌아간다. 패치 뒤에는 바뀐 카드만 파이프라인을 다시 돌린다(캐시 키가 O 해시).
- 배치 운영
  - API 동시성과 쿼터에 맞춘 작업 큐를 쓰고, 실패하면 지수 백오프로 재시도한다.
  - 내려받은 원본 mp4와 요청 JSON을 보관해 재현성을 확보한다. Veo는 2일 뒤 삭제된다.
  - 카드당 후보를 2~3개 생성하고 QC 점수로 자동 1차 선별한 뒤 사람이 고른다.
- `.ogv` 읽기는 `ResourceLoader.Load<VideoStream>("res://...ogv")`로 한다. Theora 로더가 `FileAccess`로 열기 때문에 PCK 안에서도 될 것으로 보인다(미확인). export 프리셋의 include filter에 `*.ogv`가 필요한지 확인한다.

### Gaps
- 영상 API의 비용, 쿼터, 동시성 수치는 이 노트 범위 밖이라 조사하지 않았다.
- Wan·Kling 등 Veo 이외 모델의 출력 해상도·fps·화면비 옵션은 확인하지 않았다.
- 위 ffmpeg 명령은 문서상 옵션으로 구성했고 실행 검증은 하지 않았다(libtheora 부재).

## 4. 배포·IP·커뮤니티: 이 방향으로 바뀌는 점

### Takeaway
이 방향은 저장소의 현재 아트 정책을 정면으로 뒤집는다. 지금 정책은 출하 픽셀 100% 원작, 생성 이미지 금지, 구운 프레임 배포 금지, "AI Assisted" 공시다. 이제 배포물에 공식 아트에서 파생된 픽셀과 AI 생성 픽셀이 함께 들어간다. Nexus 태그는 "AI-Generated Content"가 맞다. Mega Crit 공동 창업자가 공개적으로 반대한 바로 그 사용(AI가 화풍을 흉내 냄)에 해당하므로 반발 위험이 크게 오른다. 커뮤니티 데이터로 보면 AI 애니 교체 팩은 대량으로 받아들여졌지만, 공식 아트를 AI로 움직인 유일한 선례는 DL 608에 그쳤다.

### Cited Findings
- 저장소 아트 정책 — [CLAUDE.md (slseoun-mods)](/Users/flavono123/P/slseoun-mods/CLAUDE.md); [docs/feasibility.md](/Users/flavono123/P/slseoun-mods/docs/feasibility.md)
  - "출하 픽셀은 100% 원작이다", "인페인팅, 덧칠, 생성 이미지를 쓰지 않는다", "Mega Crit 아트로 모델을 학습하지 않는다", 배포 페이지에는 "AI Assisted"로 공시한다.
  - feasibility는 공식 아트를 싣지 않으므로 "AI-Generated Content"·"AI Media"에는 해당하지 않는다고 판정했다.
- PoC 문서는 구운 프레임이 원작 픽셀을 다시 담으므로 "공식 아트를 싣지 않고 런타임에 참조한다"는 원칙과 충돌한다고 판정했다. 그래서 배포 PCK에는 실시간 방식만 싣기로 했다. — [docs/poc-stage1.md](/Users/flavono123/P/slseoun-mods/docs/poc-stage1.md)
- Nexus Mods AI 태그(2026-07-31 보도) — [Shacknews](https://www.shacknews.com/article/150216/nexus-mods-gen-ai-tagging-moderation); [PC Gamer](https://pcgamer.com/gaming-industry/nexus-mods-finally-tightens-the-screws-on-ai-though-its-still-playing-softball-with-the-tide-of-slop)
  - "AI-Generated Content": AI가 만든 코드, UI, 음성, 대사, 번역, 음악, "in-game AI-generated assets".
  - "AI Media": 모드 밖의 홍보 이미지, 썸네일, 영상, 설명.
  - "AI Assisted": "Developer-led code, content, or mod assets, with limited AI involvement". AI 텍스처 업스케일링이 여기에 든다.
  - 잘못 태그하면 중재 대상이고, 고의 남용은 "immediate punishment if proven"이다.
- Steam은 2026년 1월 AI 공시 규칙을 다시 썼다. 플레이어가 소비하는 생성형 AI 콘텐츠만 공시하고, 스토어 페이지에 'AI Generated Content Disclosure'를 표시한다. 이는 게임 스토어 규칙이며, Workshop 항목에 대한 별도 AI 규칙은 찾지 못했다. — [VGC](https://videogameschronicle.com/news/valve-has-significantly-rewritten-steams-rules-for-how-developers-much-disclose-ai-use); [Outlook Respawn](https://respawn.outlookindia.com/amp/story/gaming/gaming-news/valve-clarifies-steam-ai-policy-focus-shifts-to-content-consumed)
- Mega Crit Content Policy는 모드를 허용한다. 유료화는 금지다. 생성형 AI는 굿즈와 Gallery 제출물에서만 명시적으로 금지한다. 모드 안에서 게임 아트를 변형하는 데 대한 조항은 찾지 못했다(이전 조사, 요약 fetch). — [Mega Crit Content Policy](https://www.megacrit.com/content-policy) via [sts2_modding_ecosystem.md](/Users/flavono123/P/scare-the-spire/research_notes/슬더스2%20카드%20아트%20모드%20타당성/sts2_modding_ecosystem.md)
- Casey Yano(GameSpot, 2026-07 보도)는 STS2 아트에 생성형 AI를 쓰지 않았고 임시 아트도 일부러 조잡하게 그렸다고 했다. 아티스트는 AI가 자기 화풍을 흉내 내는 것을 보면 슬플 것이고, 게임은 이미 고유한 화풍이 있어 AI로 복제할 의미가 없다고 했다. — [GameSpot](https://www.gamespot.com/articles/slay-the-spire-2-is-choosing-shit-art-over-generative-ai/); [PCGamesN](https://www.pcgamesn.com/slay-the-spire-2/art-direction) via [free_ai_art_pipeline.md](/Users/flavono123/P/scare-the-spire/research_notes/슬더스2%20카드%20아트%20모드%20타당성/free_ai_art_pipeline.md)
- 커뮤니티 반응 데이터(이전 조사, 2026-10-18 기준) — [similar_mods_originality.md](/Users/flavono123/P/scare-the-spire/research_notes/슬더스2%20카드%20아트%20모드%20타당성/similar_mods_originality.md)
  - Animated Rare Cards (AI generated)(Nexus #851)는 "dynamic animations (produced by AI)"를 내세웠다. 2026-06-05 등록 뒤 갱신이 없고, DL 608, 추천 4다. — [Nexus #851](https://www.nexusmods.com/slaythespire2/mods/851)
  - 정적 AI 애니 교체 팩:
    - Regent Cards Anime Rework: Stable Diffusion·Nanobanana 2로 만들었다. Nexus DL 93,597, Workshop 구독 75,797. — [Nexus #344](https://www.nexusmods.com/slaythespire2/mods/344)
    - SilentCardAnimerRework: AI와 Photoshop. 구독 57,860.
  - 반대편:
    - Crimson Blade Valkyrie는 "No AI-generated content"를 내세운다(구독 206,227).
    - Nightveil Nekoninja는 라이선스로 AI 학습을 금지한다.
    - KaguyaSilentRavenSkin 설명에는 남의 작품을 AI로 낙인찍지 말라는 문구가 있다.

### Inferences
- 공시는 "AI-Generated Content"로 올려야 한다. 인게임 에셋 자체가 AI 생성이고 "limited AI involvement"가 아니기 때문이다. 기존 판정("AI Assisted")은 이 방향에서는 성립하지 않는다. 모드 이름이나 첫 줄에 생성 방식과 원작 0번 프레임 고정을 투명하게 적는 편이 Nexus 중재와 커뮤니티 낙인 위험을 함께 줄인다.
- "델타만 싣는다"는 정책과의 거리를 줄이는 기술적 선택지가 있다.
  - 잔차 영상(§2): 공식 픽셀을 그대로 싣지 않고, 런타임 아틀라스에 AI 차분을 더한다.
  - 강체 마스크 고정: 인물·손·무기 영역은 재생 중에도 바닐라 픽셀로 둔다.
  - 둘 다 법적 성격(파생물)을 바꾸지는 못한다. 다만 "공식 아트를 재배포하지 않는다"는 주장, 그리고 해시 게이트로 원작이 바뀌면 끈다는 설계는 유지된다.
- 정책 문구 중 "Mega Crit 아트로 모델을 학습하지 않는다"는 추론 시점 조건 입력(image-to-video)과는 다르다. 그러나 공식 아트를 제3자 API에 올리게 되므로, 제공자가 입력을 학습에 쓰는지(무료/유료 등급 차이)를 확인해야 한다. 이 부분은 미확인이다.
- Yano 발언의 핵심은 "AI가 화풍을 흉내 내는 것"이다. 원작 아트를 첫 프레임으로 쓰고 그 화풍으로 움직임을 생성하는 일이 바로 여기에 해당한다. 셰이더 방식보다 Mega Crit·아티스트 측 반감이 생길 가능성이 크게 높다.
- 수요 신호는 갈린다. 정적 AI 팩이 수만~십만 단위로 받아들여졌으므로 AI 자체가 배포를 막지는 않는다. 그러나 "공식 아트를 AI로 움직인" 유일한 선례는 반응이 미미했다(품질·노출·Workshop 부재 요인을 분리하지 못함).
- 셰이더 방식(AI Assisted)과 영상 방식(AI-Generated)은 별도 모드 ID로 분리해 배포하는 편이 낫다. 사용자가 고를 수 있고, 반AI 사용자층이 셰이더 판까지 외면하는 것을 막는다. 멀티모드 저장소 구조가 이미 이를 전제로 한다(feasibility의 "AI 보조 콘텐츠를 별도 모드로 떼어 공시").

### Gaps
- Steam Workshop 항목에 대한 Valve의 AI 콘텐츠 규칙(공시 의무 여부)은 이번에도 찾지 못했다.
- Nexus 공식 공지 원문(news/14850)은 403이라 보도 기사로만 확인했다.
- Mega Crit Content Policy 원문의 정확한 문구와, 모드 안 AI 변형에 대한 공식 입장은 이전 조사 이후 새로 확인하지 않았다.
- 영상 생성 API 제공자의 입력 데이터 학습 사용 조항(무료/유료 등급)은 조사하지 않았다.
- Animated Rare Cards의 실제 화면, 댓글, 생성 도구는 이전 조사와 마찬가지로 확인하지 못했다.
