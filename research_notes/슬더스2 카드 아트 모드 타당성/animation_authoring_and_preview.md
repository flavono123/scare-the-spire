# 카드 아트 애니메이션 저작 도구 체인과 미리보기·검증 방법 (STS2 외형 모드)

조사일: 2026-10-18. 웹 출처는 모두 이 날짜에 확인했다. 로컬 관찰은 이 저장소와 로컬 Steam 설치본에서 읽었다.

로컬 기준 사실(이후 추론의 전제):
- 로컬 `Slay the Spire 2.pck` 헤더는 `GDPC`, 값 `(3, 4, 5, 1, …)`이다. PCK 포맷 v3, **Godot 4.5.1**로 해석된다. 출처: `~/Library/Application Support/Steam/steamapps/common/Slay the Spire 2/SlayTheSpire2.app/Contents/Resources/Slay the Spire 2.pck` 헤더를 직접 읽음(`scripts/lib/pck.py`와 같은 파싱 방식). 게임이 쓰는 렌더링 방식(Forward+/Mobile/Compatibility)은 확인하지 못했다(Gaps 참고).
- 사이트는 이미 `@esotericsoftware/spine-player` 4.2.115로 게임 Spine 에셋을 렌더한다(`package.json` 73행). 따라서 게임 skeleton 데이터는 Spine 4.2 계열로 추정한다.
- 추출한 카드 초상화 예: `abrasive.webp` 1000×760 px(358 KB), `abundance.webp` 606×852 px(60 KB). 633개 파일, 합계 49 MB(`public/images/sts2/cards`).
- 기존 웹 VFX 렌더러(`public/event-vfx-player.js`)는 Canvas 2D로 GPUParticles2D를 근사한다. 일부 셰이더는 추출 시점에 8프레임 플립북으로 굽는다. "노드 속성과 배치는 게임 원본이지만 GPU 파티클 적분과 셰이더 픽셀 결과는 근사"다. 범용 Godot canvas_item 셰이더 → 웹 transpiler는 없다는 결론(2026-08-02)이다. 출처: `docs/CHARACTER_FORM_VFX_STATUS.md`.

## 저작 도구와 라이선스·비용: 무엇이 무료이고, 네이티브 플러그인 없이 모드(.pck/.tscn/리소스)로 로드되는가

### Takeaway
무료이면서 네이티브 플러그인 없이 Godot 4 .NET 게임에 모드로 로드되는 저작 경로는 **Godot 내장 2D 애니메이션**(Polygon2D+Skeleton2D 메시 변형, AnimationPlayer, canvas_item 셰이더, GPUParticles2D)뿐이다. Krita·Aseprite·Blender로 그린 프레임을 텍스처나 플립북으로 넣는 방식이 이를 보조한다. Spine은 게임 런타임에 실을 수 있지만 메시 변형에 Professional 라이선스($379 세일가, 정가 $449)가 필요하므로 "무료" 조건을 만족하지 못한다. Rive·Live2D·Effekseer·DragonBones는 Godot 4에서 모두 네이티브 GDExtension이나 C++ 모듈이 필요하다.

### Cited Findings
**Spine Editor 가격(2026-10-18 확인)**
- Essential $69(정가 $99, 세일 표기). 기본 기능과 모든 포맷 내보내기를 포함한다. **메시와 고급 기능은 제외**되고, Professional 기능을 쓴 프로젝트는 저장·내보내기할 수 없다. — [Spine purchase](https://esotericsoftware.com/spine-purchase)
- Professional $379(정가 $449). 모든 기능을 포함한다. Essential과 Professional은 연매출 $500,000 미만 사업자용이다. Enterprise는 $2,499 기본료에 사용자당 $379이고, 1년마다 갱신한다. — [Spine purchase](https://esotericsoftware.com/spine-purchase)
- 무료 에디션은 없고 체험판만 있다. 학생 할인도 없다. — [Spine purchase](https://esotericsoftware.com/spine-purchase)
- 체험판 용도는 "testing and evaluating the Spine Editor"로 한정된다(1.4조). 런타임을 통합·배포·사용할 권리는 주지 않는다. — [Spine Editor License Agreement, 2025-04-05 개정](https://esotericsoftware.com/spine-editor-license)
- 포럼 스태프 답변에 따르면 체험판은 저장할 수 없고 저장된 적도 없다. 체험판 작업을 정식판으로 옮기는 수단도 없다. — [Esoteric 포럼 "Save project option is disabled in trial"](https://de.esotericsoftware.com/forum/d/1400-quotsave-projectquot-option-is-disabled-in-trial-version-win), [포럼 28826](https://ja.esotericsoftware.com/forum/d/28826-transfer-projects-from-trial-to-professional-version) (검색 요약으로 확인. 원문 전체는 열지 못함)

**Spine Runtimes 라이선스와 모드**
- Runtimes License(2025-04-05 개정)는 통합자의 권리를 Editor 라이선스 2조에 묶는다. 그렇지 않으면 "each user of the Products must obtain their own Spine Editor license"이다. 재배포할 때는 라이선스와 저작권 고지를 포함해야 한다. 이 문서는 모더나 Editor가 내보낸 데이터를 직접 다루지 않는다. — [Spine Runtimes License](https://esotericsoftware.com/spine-runtimes-license)
- Editor License 2.1조: 통합하는 제품은 런타임에 "significant and primary functionality"를 더해야 하고, 통합 시점에 유효한 Editor 라이선스가 있어야 한다. "user"의 정의나 플레이어·모더의 지위는 명시하지 않는다. — [Spine Editor License](https://esotericsoftware.com/spine-editor-license)
- 아래는 포럼 "Licencing for Modders" 스레드의 스태프 답변이다. 이 세션에서는 페이지 본문 로드에 실패해 검색 엔진 요약으로만 확인했다.
  - Spine에서 만들고 내보낸 JSON·바이너리·아틀라스·이미지는 만든 사람의 것이다.
  - 런타임 코드를 포함하지 않는 모드는 배포에 Spine 라이선스가 필요 없다. 다만 애니메이션을 편집하려면 사실상 Spine Editor(유료)가 필요하다.
  - 특정 게임 전용의 저가 모더 라이선스는 없다.
  - 런타임 코드를 쓰지 않고 내보낸 데이터를 직접 읽는 코드는 누구나 작성할 수 있다.
  - 출처: [Esoteric 포럼 28190 "Licencing for modders"](https://eu.esotericsoftware.com/forum/d/28190-licencing-for-modders)(본문 미확인, 검색 요약 기준)
- spine-godot GDExtension에는 C# 바인딩이 없다. C# 바인딩은 커스텀 엔진 빌드가 필요한 C++ 모듈판에만 있다. 런타임에 `load_from_file()`·`load_from_atlas_file()`로 디스크에서 skeleton과 atlas를 읽는 경로를 모딩 용도로 설명한다. 블렌드 모드별 커스텀 Material(SpineSprite Materials, SpineSlotNode 오버라이드)도 지원한다. — [spine-godot 문서](https://esotericsoftware.com/spine-godot)
- 런타임과 데이터는 major.minor 버전이 같아야 한다. — [spine-pixi 문서](https://esotericsoftware.com/spine-pixi)

**Godot 내장 2D 애니메이션(무료, MIT 엔진 코어)**
- 공식 2D skeleton 워크플로는 다섯 단계다. Polygon2D UV 편집기로 조각을 만들고, Skeleton2D/Bone2D 계층을 세운다. "Sync Bones to Polygon" 후 weight를 칠하고, 굽힘 지점에 internal vertices를 추가한 뒤, 뼈를 애니메이트한다("animating the bones (NOT the polygons!)"). 문서는 Spine과 DragonBones를 대안으로 언급하고, 4.7 기준 "work in progress"로 표시돼 있다. — [Godot 2D skeletons](https://docs.godotengine.org/en/stable/tutorials/animation/2d_skeletons.html)
- canvas_item 셰이더는 `TIME`, 블렌드 render_mode(`blend_add`·`blend_mul`·`blend_premul_alpha`), `hint_screen_texture`, `light()`, SDF 함수, `INSTANCE_CUSTOM`(파티클의 수명 위상·프레임 등)을 제공한다. — [Godot CanvasItem shaders](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/canvas_item_shader.html)
- 게임 자체 VFX가 이미 GPUParticles2D와 ShaderMaterial(플립북 메타데이터, LUT, erosion, hue shift, polar 변환)로 구성된 `.tscn`이다. — 로컬 `docs/CHARACTER_FORM_VFX_STATUS.md`

**Rive**
- Free 플랜도 .riv를 내보낼 수 있지만 런타임에서 스플래시 화면이 재생된다. 공동작업 파일 3개, 프로젝트 1개, 임포트 에셋은 개당 10 MB로 제한된다. Cadet($9/석/월)부터 스플래시가 없다. 공식 런타임 목록(JS, Flutter, iOS, Android, React, RN, C++, Defold, Unity, Unreal)에 Godot은 없다. — [Rive pricing](https://rive.app/pricing)
- Godot 지원은 커뮤니티 GDExtension(rive-cpp 래퍼)과 Rive 포럼의 기능 요청 수준이다. — [Rive 포럼 Godot runtime 요청](https://rive.app/community/forums/feature-requests/fsyCzA4A9Yar/godot-runtime/ftuSSFcZAlqR), [Godot 포럼](https://forum.godotengine.org/t/rive-animation-support-in-godot/37430)

**Live2D Cubism**
- FREE의 상업 이용은 General User와 Small-Scale Enterprise만 가능하다. 제한은 텍스처 1장(최대 2048 px), ArtMesh 100, 파라미터 30, 디포머 50, 파트 30, Warp 디포머 분할 9×9다. 영상 출력은 1280×720으로 제한되고 로고 표시가 권장된다. 제한을 넘기면 저장할 수 없다. — [Live2D FREE vs PRO](https://www.live2d.com/en/cubism/comparison/)
- PRO는 42일 체험판이 있다. — [Cubism Editor download](https://www.live2d.com/en/cubism/download/editor/)

**Effekseer**
- EffekseerForGodot4는 scons로 빌드하는 네이티브 C++ 플러그인이다(Windows/macOS/iOS/Android/Linux, MIT). Releases 섹션은 비어 있고, 2D(CanvasItem)와 C# 지원은 명시돼 있지 않다. — [GitHub effekseer/EffekseerForGodot4](https://github.com/effekseer/EffekseerForGodot4)

**DragonBones**
- Godot-DragonBones는 MIT 라이선스의 GDExtension이다. 에셋 라이브러리 기준 대상은 Godot 4.2이고, v1.2.2가 1.x의 마지막 버전이며 v2가 계획돼 있다. — [Godot Asset Library: Godot-DragonBones](https://godotengine.org/asset-library/asset/edit/16358)

**프레임 애니메이션 도구**
- Aseprite는 소스를 받아 직접 컴파일하면 개인 용도로 무료로 쓸 수 있다. 그렇게 만든 그림의 상업 이용도 허용된다. 금지 사항은 재배포뿐이다. — [Aseprite FAQ](https://aseprite.org/faq/)

### Inferences
- "무료 + 네이티브 플러그인 없음 + 모드 로드"를 모두 만족하는 것은 Godot 코어 리소스(`.tscn`, `.tres`, `.gdshader`, 텍스처)뿐이다. Rive·Live2D·Effekseer·DragonBones는 런타임이 GDExtension이거나 엔진 모듈이다. 모드가 플랫폼별 네이티브 바이너리를 동봉하고 게임이 이를 로드해 줘야 하므로 이 조건에서 탈락한다. Effekseer는 오프라인 VFX 디자인 도구로만 쓰고, 결과를 플립북 텍스처로 구워 GPUParticles2D나 셰이더 플립북에 넣는 방식은 가능하다.
- Spine은 게임에 런타임이 이미 있어서 형식상 매력적이다. 하지만 카드 초상화 애니메이션의 핵심인 메시 변형이 Professional($379) 전용이고, 체험판은 저장할 수 없다. 따라서 무료 경로는 사실상 Spine JSON을 직접(또는 자체 스크립트로) 생성하는 것뿐이다. 이는 아티스트 주도 작업에 비현실적이다. 런타임 코드를 동봉하지 않는 데이터 전용 모드라면 배포 라이선스 문제는 작다(포럼 스태프 견해, 법적 확정 아님). 게임의 C# 코드가 SpineSprite를 어떻게 생성하는지(모듈판/GDExtension판, C# 래퍼)도 모드가 새 skeleton을 붙일 수 있는지를 좌우하지만, 이 조사 범위에서는 확인하지 못했다.
- Godot 엔진(MIT)과 Blender·Krita는 무료 오픈소스로 널리 알려져 있으나, 이번 세션에서 라이선스 페이지를 다시 확인하지는 않았다. 이 셋과 Aseprite(자가 빌드)로 "브레이크아웃" 레이어(액자 밖으로 튀어나오는 손·무기·연기 조각)를 그리고, Godot Polygon2D나 Sprite2D 텍스처로 넣는 조합이 무료로 가능하다.
- Live2D FREE의 한도(텍스처 1장, ArtMesh 100)는 카드 초상화 한 장 규모에는 충분할 수 있다. 하지만 Godot용 공식 SDK가 없고 SDK 릴리스 라이선스도 따로 있어서, 게임 내 경로로는 부적합하다.

### Gaps
- Spine "Licencing for modders" 스레드 원문을 열지 못했다(사이트 로드 실패). 스태프 발언은 검색 요약 기준이다.
- STS2가 spine-godot을 C++ 모듈로 넣었는지 GDExtension으로 넣었는지, 그리고 모드 `.pck`의 `SpineSkeletonDataResource`를 그대로 인스턴스화할 수 있는지는 확인하지 못했다.
- Live2D Cubism SDK 릴리스 라이선스의 매출 기준과 Godot용 커뮤니티 SDK(GDCubism)의 상태는 확인하지 못했다.
- DragonBones Pro 에디터의 현재 배포·유지 상태, 그리고 Spine JSON 내보내기 지원 여부를 확인하지 못했다.
- Blender(Grease Pencil)와 Krita의 라이선스 페이지를 이번에 직접 확인하지 않았다.

## 런타임 비용과 품질 트레이드오프(카드 약 600장)

### Takeaway
플립북은 600장 규모에서 다운로드 크기·VRAM·공식 아트 재배포 부담이 모두 가장 크다. 기존 초상화 텍스처를 재사용하는 **셰이더 전용(UV 왜곡, flow map, 마스크)**과 **메시 변형(Polygon2D+Bone2D)**이 비용 대비 효율이 가장 좋다. 파티클은 레어 카드의 액자 밖 연출에만 공유 텍스처로 쓰는 게 맞다.

### Cited Findings
- 카드 초상화는 1000×760 px 수준이다. 633개 webp가 합계 49 MB다. — 로컬 측정(`public/images/sts2/cards`, 2026-10-18)
- canvas_item 셰이더의 `INSTANCE_CUSTOM`은 파티클별 회전, 수명 위상, 애니메이션 프레임을 실어 나른다. 플립북 파티클이 이 경로로 구현된다. — [Godot CanvasItem shaders](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/canvas_item_shader.html)
- 게임 원본 VFX도 셰이더 변환이나 플립북 메타데이터 기반으로 작성돼 있다. 사이트는 일부를 8프레임 정적 플립북으로 근사한다. — 로컬 `docs/CHARACTER_FORM_VFX_STATUS.md`
- Godot 2D 메시 변형은 internal vertices와 weight 작업이 더 필요하다. 작업이 부족하면 "unexpected bends"가 생긴다. — [Godot 2D skeletons](https://docs.godotengine.org/en/stable/tutorials/animation/2d_skeletons.html)

### Inferences
아래 수치는 로컬 측정값으로 계산한 추정이다.

**플립북**
- 1000×760 RGBA8은 프레임당 약 2.9 MiB(VRAM, 비압축)다. 24프레임이면 카드당 약 70 MiB다. 500×380으로 줄이고 12프레임만 써도 카드당 약 8.7 MiB다. 600장을 모두 상주시키는 것은 불가능하다. 재생 중인 카드만 스트리밍해야 한다.
- 다운로드 크기는 초상화 1장의 webp 크기(60~360 KB)에 프레임 수를 곱한 만큼 커진다. 12~24프레임이면 대략 0.6~1.2 GB다.
- 공식 아트를 재인코딩해서 배포하게 되므로 저작권 부담도 가장 크다.

**메시 변형(Polygon2D+Skeleton2D 또는 Spine 메시)**
- 게임에 이미 있는 초상화 텍스처를 `res://` 경로로 참조하면 추가 텍스처는 0이다. 메시와 키프레임 데이터는 카드당 수 KB 수준이다.
- 품질은 숨쉬기, 흔들림, 패럴랙스 같은 "살아 있는 그림"에 적합하다.
- 그림에 없던 부분(가려진 뒷면, 새 포즈)은 만들 수 없다. 레이어를 분리하려면 덧칠한 조각 텍스처가 필요하다.

**셰이더 전용(UV 왜곡, flow map, 노이즈, 마스크)**
- 추가 데이터가 없거나, 저해상도 마스크·flow map(예: 256×195 RG8, 약 100 KB) 정도다.
- 불꽃, 물, 빛 번짐, 일렁임 같은 "흐르는" 효과에 가장 싸다.
- 원본 텍스처를 참조만 하므로 배포 크기가 거의 0이다. 공통 셰이더 몇 개를 파라미터로 600장에 재사용할 수 있다.

**파티클(GPUParticles2D)**
- 텍스처를 공유하므로 메모리는 작다. 비용은 동시 방출 수에 비례한다.
- 액자 밖 연출(불꽃, 파편, 연기)에 적합하다.
- 웹 미리보기에서 픽셀 단위로 맞추기가 가장 어렵다(아래 웹 런타임 절 참고).

**권장 구성**
- 일반 카드: 셰이더 전용, 일부 메시 변형.
- 레어 카드: 메시 변형 + 브레이크아웃 레이어(덧칠 텍스처 몇 장) + 파티클.
- 플립북: 짧은 이펙트 조각(예: 8프레임 스파크)에만 공유 자원으로 쓴다.

### Gaps
- STS2 카드 초상화가 게임 안에서 아틀라스에 들어 있는지, 압축 포맷(VRAM 압축 여부)이 무엇인지 확인하지 못했다. 이 둘에 따라 실제 VRAM 수치가 달라진다.
- 손패 10장 이상과 드래그 중 동시 재생 같은 실제 상황의 GPU 비용은 계측하지 못했다.

## Godot 4 웹 export: C# 지원 여부, GDScript 전용 미리보기 샌드박스, 크기, 로컬 에디터 검증

### Takeaway
2026-10 기준 최신 안정판 문서(Godot 4.7)도 "C#으로 작성한 Godot 4 프로젝트는 웹으로 export할 수 없다"고 명시한다. 다만 같은 `.tscn`/`.gdshader`/Polygon2D/AnimationPlayer/GPUParticles2D를 쓰는 **GDScript 전용 샌드박스 프로젝트**는 웹으로 export할 수 있다. 조건은 Compatibility(WebGL 2) 렌더러뿐이라는 점이고, 압축 전송 기준 수 MB에서 수십 MB 크기다. 가장 정확한 검증기는 게임과 같은 버전(4.5.1)의 로컬 Godot 에디터다.

### Cited Findings
**C# 웹 export 상태**
- 4.7 안정판 문서 원문은 "Projects written in C# using Godot 4 currently cannot be exported to the web."이고, C#을 웹에서 쓰려면 Godot 3을 쓰라고 안내한다. — [Godot 4.7 Exporting for the Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
- 2025-05-09 공식 블로그 내용은 다음과 같다. Mono를 정적 링크한 C# 웹 프로토타입은 메인 `.pck`가 72 MiB(Brotli 23.8 MiB)였다. 템플릿과 같은 WASM 기능·TargetFramework가 필요하고, invariant globalization만 지원하며, 일부 .NET API(암호화 등)가 오작동할 수 있다. "we cannot commit to a specific timeline yet." — [Godot 블로그: Live from GodotCon Boston: Web .NET prototype](https://godotengine.org/article/live-from-godotcon-boston-web-dotnet-prototype/)
- 기술적 장애물은 .NET 런타임이 main module로만 빌드된다는 점이다. Godot 런타임도 main module이어야 해서 충돌한다. — [Godot 포럼(4.5 시점)](https://forum.godotengine.org/t/a-possible-solution-for-making-c-work-on-godot-web-export-by-integrating-net-into-the-engine-wasm/133555), 원 출처 [Platform state in C# for Godot 4.2](https://godotengine.org/article/platform-state-in-csharp-for-godot-4-2/#web)
- 4.7에서도 C# 웹 export가 "experimental"이라는 2차 블로그 주장이 있다. 하지만 공식 문서와 맞지 않고 출처 확인이 안 됐다. — [gtstu.com](https://gtstu.com/?p=4758)(신뢰도 낮음), 상충: [Godot 4.7 공식 문서](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)

**웹 export 렌더러·스레드 제약**
- 웹은 "Godot 4 can only target WebGL 2.0 (using the Compatibility rendering method)"이다. Forward+와 Mobile은 웹에서 지원되지 않고, WebGPU도 미지원이다. — [Godot 4.7 Exporting for the Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
- SharedArrayBuffer와 COOP/COEP 헤더는 "Use Threads"를 켤 때만 필요하다. 단일 스레드 export가 기본값이다. — [Godot 4.7 Exporting for the Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
- 크기를 줄이는 방법으로 기능을 끈 커스텀 export 템플릿과 `.wasm`/`.pck` 서버 압축을 권장한다. — 같은 문서

**웹 export 크기 실측(비공식 벤치마크)**
- Godot 4.4 기본 웹 export는 약 42.0 MB다. optimize=size로 39.1 MB, 3D를 끄면 31.5 MB, 커스텀 템플릿으로 17.4 MB, wasm-opt로 16.0 MB, Brotli 전송 시 약 2.7 MB다. — [popcar.bearblog.dev](https://popcar.bearblog.dev/how-to-minify-godots-build-size/)
- Godot 4.1.2 기본 템플릿은 27.12 MB이고, 최적화 후 Brotli로 약 4 MB다. 템플릿이 작을수록 시작도 빠르다. — [JohannesDeml/Godot-Web-LoadingTest](https://github.com/JohannesDeml/Godot-Web-LoadingTest)
- 실제 프로젝트(4.3)에서 35 MB `.wasm`에 56 MB `.pck`가 나온 사례가 있다. — [Godot 포럼](https://forum.godotengine.org/t/export-optimising-a-build-for-size/94584)

**spine-godot과 웹**
- GDExtension판은 웹을 포함해 "all platforms Godot supports"를 지원한다. C#은 업스트림 Godot이 웹 C#을 지원하기 전까지 웹에서 불가하다. — [spine-godot 문서](https://esotericsoftware.com/spine-godot)

### Inferences
**GDScript 전용 미리보기 샌드박스**
- 구성: 게임 버전에 맞춘 Godot 4.5.1 비-.NET 에디터로 별도 프로젝트를 만든다. 모드의 `.tscn`/`.gdshader`/`.tres`와 로컬에서 추출한 초상화를 같은 `res://` 경로 구조로 넣는다.
- 게임의 C# `N*` 스크립트가 맡는 트리거 로직(호버, 드래그, 플레이 이벤트)은 GDScript 목업으로 대체한다.
- 모드 씬이 C# 스크립트를 직접 붙이지 않고 AnimationPlayer 트랙, 셰이더 uniform, `emitting` 같은 데이터로만 동작하게 설계하면 같은 씬 파일을 그대로 로드할 수 있다. 이 설계 규칙을 "모드 아트 씬에는 스크립트 금지, 이름 붙은 애니메이션과 uniform 계약만 둔다"로 고정하면 게임 쪽 C# 로더와 샌드박스 GDScript 로더가 같은 계약을 공유한다.
- 웹 export 비용: 커스텀 템플릿 없이 기본 템플릿을 쓰면 수십 MB의 `.wasm`에 아트 `.pck`가 더해진다. dev 전용 검증기라 압축 서빙만 해도 감당할 만하다. 단일 스레드 기본값이면 Next.js dev 서버에 COOP/COEP 헤더가 필요 없다.

**동일성의 한계**
- 게임이 Forward+나 Mobile 렌더러를 쓴다면 웹 샌드박스(Compatibility 전용)와 블렌딩, HDR 2D, 글로우 결과가 다를 수 있다(게임 렌더러는 미확인).
- 이 경우 웹 샌드박스는 "근사 미리보기"이고, 최종 판정은 로컬 데스크톱 에디터나 게임에서 해야 한다.

**로컬 Godot 에디터를 검증기로 쓸 때**
- 장점:
  - 게임과 같은 셰이더 컴파일러, 파티클, AnimationPlayer 구현을 쓴다. 렌더러를 게임과 맞추면 사실상 완전한 일치다.
  - 다운로드나 빌드 단계가 없다.
  - 에디터에서 바로 수정하며 반복할 수 있다.
  - Movie Maker 모드 같은 기능으로 기준 프레임을 뽑을 수 있다(이 기능의 세부는 이번에 출처로 확인하지 않음).
- 단점:
  - 사이트의 카드 타일 합성기나 Spine 무대와 한 화면에 놓이지 않는다.
  - Spine 미리보기를 하려면 spine-godot 플러그인을 별도로 설치해야 하고, 그 런타임 사용은 Spine 라이선스 조건을 따른다.
  - 게임 C# 로직은 재현할 수 없다.

### Gaps
- STS2의 `rendering/renderer/rendering_method` 값을 PCK에서 찾지 못했다(문자열 검색 결과 없음. project.binary가 압축됐거나 다른 형태일 가능성).
- Compatibility 렌더러에서 GPUParticles2D와 특정 canvas_item 기능의 동작 차이를 4.5/4.7 문서로 확인하지 못했다.
- Godot 4.5/4.6/4.7 공식 릴리스 노트에서 웹 C# 관련 항목을 직접 확인하지 못했다. 4.7 안정판 문서의 명시적 문구로 대체했다.

## 미리보기용 웹 런타임: 저작 포맷별로 Godot와 거의 같은 픽셀을 내는 것은?

### Takeaway
웹에서 게임과 거의 같은 결과가 나오는 것은 **Spine**(spine-ts 계열, 같은 major.minor)과 **Godot 웹 export 자체**뿐이다. Polygon2D 스키닝과 AnimationPlayer 트랙은 직접 포팅하면 "형태·타이밍" 수준에서 근사치가 높다. canvas_item 셰이더는 소수만 GLSL ES 3.0으로 수동 포팅하는 게 현실적이다. GPUParticles2D는 근사만 가능하다. Rive와 Lottie는 게임 내 경로가 없어 동일성 비교 대상이 아니다.

### Cited Findings
- spine-pixi-v8(PixiJS 8.16 이상)과 spine-pixi-v7은 둘 다 렌더러 비의존 spine-ts core 위에 구축돼 있다. WebGL/WebGPU에서는 "support all Spine features"이고, Canvas API 렌더링에서는 블렌드 모드를 지원하지 않는다. 런타임은 major.minor가 에디터 버전과 같아야 한다. — [spine-pixi 문서](https://esotericsoftware.com/spine-pixi)
- spine-godot은 블렌드 모드별 Material을 SpineSprite나 슬롯 단위로 설정한다. tint black은 normal/additive/multiply만 지원하고 screen은 지원하지 않는다. — [spine-godot 문서](https://esotericsoftware.com/spine-godot)
- WebGL 이식이 어려운 canvas_item 요소는 다음과 같다. 블렌드 render_mode, `hint_screen_texture`(엔진이 관리하는 화면 캡처), `light()`와 라이트 내장 변수(일반 draw pass에서 처리), LightOccluder2D로 만드는 SDF, `MODEL_MATRIX`→`CANVAS_MATRIX`→`SCREEN_MATRIX` 변환 체인, 3600초마다 반복되고 `time_scale` 영향을 받는 `TIME`, 파티클 `INSTANCE_CUSTOM`. — [Godot CanvasItem shaders](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/canvas_item_shader.html)
- 사이트 현황: 범용 Godot 셰이더→웹 변환기는 없다. `@shaderfrog/glsl-parser`는 표준 GLSL AST만 다루고 Godot built-in 의미는 구현하지 않는다. 다음 단계로 "실제 차이가 남는 소수의 canvas_item 셰이더만 WebGL2 GLSL로 수동 이식"하기로 결정돼 있다. 현재 PixiJS와 Three.js는 설치돼 있지 않다. — 로컬 `docs/CHARACTER_FORM_VFX_STATUS.md`
- Rive 공식 런타임에는 JavaScript가 있지만 Godot은 없다. — [Rive pricing](https://rive.app/pricing)

### Inferences
- **Spine**
  - 사이트가 이미 쓰는 spine-player 4.2.115(spine-webgl 기반)로 게임과 같은 skeleton 포즈와 메시 변형을 재현할 수 있다.
  - 남는 차이는 PMA 처리, 블렌드 모드 Material, 텍스처 필터링 정도다. 저작 포맷 중 웹·게임 일치도가 가장 높다. 단, 저작 비용은 무료가 아니다.
- **Godot Polygon2D+Skeleton2D+AnimationPlayer**
  - Polygon2D 스키닝은 선형 블렌드 스키닝이다(정점마다 뼈 weight). 기존 VFX 추출기처럼 `.tscn`을 정적 JSON으로 추출하면 WebGL2 메시나 PixiJS v8 Mesh로 재현할 수 있다.
  - AnimationPlayer 값 트랙은 선형·큐빅 보간 정도만 지원하도록 범위를 제한해 포팅한다.
  - 형태와 타이밍은 거의 일치하겠지만 픽셀 일치를 보장하지는 않는다.
- **canvas_item 셰이더**
  - 초상화용 공통 셰이더 3~5종(UV 일렁임, flow map, 마스크 글로우, dissolve)만 GLSL ES 3.0으로 손으로 옮기면 충분하다.
  - Godot 셰이딩 언어는 GLSL ES 3.0에 가까워서 수식 부분은 그대로 옮겨지고, `UV`/`COLOR`/`TEXTURE`/`TIME` 매핑만 하면 된다.
  - `hint_screen_texture`·`light()`·SDF를 쓰는 셰이더는 포팅 대상에서 제외하고, 저작 규칙에서도 금지하는 편이 낫다.
- **GPUParticles2D**: 기존 Canvas 2D 근사기를 재사용하되 "모양·밀도 확인용"으로만 쓴다. 최종 판정은 Godot에서 한다.
- **PixiJS v8 vs Three.js/OGL**: 2D 카드 합성과 Spine(spine-pixi-v8)을 한 장면에 올리기에는 PixiJS v8이 적합하다. Three.js나 OGL은 셰이더 몇 개만 실행하기에는 과하다. 현재 사이트가 Canvas 2D와 spine-player 구조라서, 새 렌더러를 넣는 비용 자체가 판단 요소다.
- **Rive·Lottie**: 각자 포맷 안에서는 웹 재현이 정확하다. 하지만 게임에 실을 경로가 없으므로 "게임과 같은 결과"를 보증하는 검증기가 될 수 없다. 레이아웃 스케치용 이상은 의미가 없다.

### Gaps
- spine-webgl(spine-player)과 spine-godot 사이의 실제 픽셀 차이(PMA, 필터링, 블렌드)를 같은 프레임으로 비교한 자료는 찾지 못했다.
- PixiJS v8 Filter와 Godot canvas_item 사이에서 감마, 프리멀티플라이드 알파 기본값의 차이를 공식 자료로 확인하지 못했다.

## 검증기로 쓸 수 있는 서드파티 목업·미리보기 도구

### Takeaway
공식 Godot 웹 에디터는 dev 전용 서드파티 검증기로 쓸 수 있다. 다만 "preliminary"이고 Compatibility 전용이며, C#·GDExtension·export를 지원하지 않는다. 그래서 Spine 미리보기는 불가능하고, 셰이더·Polygon2D·파티클 확인용으로 제한된다. 게임 버전(4.5.1)과 웹 에디터 버전이 다를 수 있다는 점도 고려해야 한다.

### Cited Findings
- 웹 에디터 관련 공식 문서(4.4) 내용:
  - "The web editor is in a preliminary stage … not recommended for production work."
  - Compatibility 렌더링만 지원한다.
  - SharedArrayBuffer가 필요하다(Chrome 68+, Firefox 79+, Edge 79+. Safari, Opera, 모바일은 미지원).
  - C#, GDExtension, 디버깅, 프로젝트 export가 없다. 우회 방법은 "Download Project Source" 후 네이티브 에디터로 export하는 것이다.
  - 출처: [Godot 4.4 Using the Web editor](https://docs.godotengine.org/en/4.4/tutorials/editor/using_the_web_editor.html)
- spine-godot은 블렌드 모드 Material과 런타임 파일 로드를 지원한다. 웹 export는 GDExtension판으로 가능하다. — [spine-godot 문서](https://esotericsoftware.com/spine-godot)
- Rive Free 플랜은 에디터와 CLI를 포함하고, 내보낸 결과물에는 스플래시가 붙는다. — [Rive pricing](https://rive.app/pricing)

### Inferences
- **Godot 웹 에디터(editor.godotengine.org)**: 설치 없이 `.tscn`/`.gdshader`를 열어 Polygon2D 변형, 셰이더, 파티클을 확인할 수 있다. 하지만 사이트에 임베드하는 검증기로 쓰기는 어렵고, 버전 고정도 보장되지 않는다. 로컬 데스크톱 에디터가 엄격히 우월하다.
- **Spine 공식 웹 플레이어나 Skeleton Viewer류**: Spine 포맷을 택할 때만 의미가 있다. 사이트가 이미 spine-player를 갖고 있어서 추가 이점이 없다.
- **ShaderToy, godotshaders.com류**: Godot canvas_item 의미론(블렌드, 변환 체인)을 재현하지 않는다. 셰이더 아이디어를 스케치하는 용도로만 쓸 수 있고 동일성 검증기는 아니다.
- **Rive 에디터 미리보기·Lottie 미리보기**: 게임 내 경로가 없어 검증기로 부적합하다.

### Gaps
- 4.5~4.7 문서에서 웹 에디터의 현재 상태(호스팅 버전, 기능 변화)를 확인하지 못했다. 위 내용은 4.4 문서 기준이다.

## 권고: (a) 저작 포맷, (b) 검증 하네스 구조, (c) 웹에서 시도하지 말 것

### Takeaway
- (a) **Godot 네이티브 씬**(Polygon2D+Skeleton2D 메시 변형, AnimationPlayer, 소수의 공통 canvas_item 셰이더, GPUParticles2D)을 게임과 같은 버전(4.5.1)의 무료 Godot 에디터로 저작한다. 덧칠 레이어는 Krita·Aseprite·Blender로 그린다.
- (b) 검증은 두 단계다. **1차 정본**은 로컬 Godot GDScript 샌드박스이고, 필요하면 그 웹 export를 dev 전용 iframe으로 붙인다. **2차 빠른 근사**는 사이트의 카드 타일 합성기와 WebGL2(또는 PixiJS v8) 레이어다.
- (c) C# 웹 export, 범용 셰이더 변환기, 화면 읽기·라이트 셰이더, 파티클 픽셀 일치, 네이티브 플러그인 포맷은 시도하지 않는다.

### Cited Findings
- C# 프로젝트는 4.7 안정판에서도 웹 export가 불가하다. 웹은 WebGL 2와 Compatibility뿐이다. — [Godot 4.7 Exporting for the Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
- Spine 메시는 Professional 전용($379, 세일가)이고, 무료 에디션은 없다. — [Spine purchase](https://esotericsoftware.com/spine-purchase)
- Godot 내장 2D skeleton 워크플로는 엔진 코어 기능이다. — [Godot 2D skeletons](https://docs.godotengine.org/en/stable/tutorials/animation/2d_skeletons.html)
- Rive, Effekseer, DragonBones의 Godot 4 경로는 네이티브(GDExtension 또는 C++) 플러그인이다. — [Rive 포럼](https://rive.app/community/forums/feature-requests/fsyCzA4A9Yar/godot-runtime/ftuSSFcZAlqR), [EffekseerForGodot4](https://github.com/effekseer/EffekseerForGodot4), [Godot-DragonBones](https://godotengine.org/asset-library/asset/edit/16358)
- 웹 에디터는 GDExtension과 export를 지원하지 않는다. — [Godot 4.4 Using the Web editor](https://docs.godotengine.org/en/4.4/tutorials/editor/using_the_web_editor.html)
- 게임 엔진 버전은 Godot 4.5.1이다. — 로컬 PCK 헤더

### Inferences
**(a) 저작 포맷: Godot 네이티브 `.tscn` 번들**
- 카드마다 `card_art/<card_id>.tscn` 하나를 둔다. 루트에는 초상화 Polygon2D(게임 텍스처를 `res://`로 참조)를 둔다.
- 일반 카드는 클립 마스크 안에서만 움직인다. 레어 카드는 클립 밖 "breakout" 노드 그룹을 갖는다.
- AnimationPlayer에는 `hover`, `drag`, `play` 같은 이름 붙은 애니메이션을 둔다.
- 셰이더는 공통 `.gdshader` 3~5종을 uniform으로 파라미터화해 재사용한다.
- 무료이고, 게임과 같은 엔진이 렌더하며, 모드로 네이티브 플러그인 없이 로드된다. 세 조건을 모두 만족하는 유일한 포맷이다.
- Spine은 사용자가 Professional 비용을 받아들일 때만 선택지가 된다. 이때 웹 미리보기 일치도는 가장 높다.

**(b) 검증 하네스 구조**
- **Tier 1(정본, exact)**: `tools/card-art-sandbox/` Godot 4.5.1 GDScript 전용 프로젝트.
  - 모드 아트 폴더와 추출한 초상화를 로드한다.
  - 손패 부채꼴, 드래그 커서, 전투 무대(Spine 없이 실루엣이나 정적 렌더)를 목업한다.
  - 버튼으로 `hover`/`drag`/`play`를 트리거한다.
  - 데스크톱에서 F6으로 실행하는 것이 기본이다. 기준 프레임 PNG를 출력해 회귀 비교에 쓴다.
  - 필요하면 단일 스레드 웹 export를 만든다. Next.js의 dev 전용 라우트(`NODE_ENV` 가드, Cloudflare 빌드 산출물에서 제외)에서 `public/` 밖 정적 폴더를 iframe으로 띄운다.
  - 단, 게임이 Compatibility가 아닌 렌더러를 쓰면 웹 Tier 1은 근사가 된다.
- **Tier 2(빠른 근사, 사이트 통합)**:
  - 기존 `card-tile.tsx` 합성기 위에 WebGL2 캔버스 레이어를 얹는다.
  - 추출기가 `.tscn`을 JSON(정점, UV, 뼈 weight, 애니메이션 트랙, 셰이더 uniform)으로 변환하고, 레이어는 이를 재생한다.
  - 수동 포팅한 공통 셰이더 GLSL과 기존 Canvas 2D 파티클 근사기를 재사용한다.
  - 목적은 레이아웃, 타이밍, 프레임 밖으로 튀어나오는 범위가 손패·무대와 어떻게 겹치는지 확인하는 것이다.
- **회귀**: Tier 1 기준 프레임과 Tier 2 같은 시점 프레임의 차이를 수치로 기록한다. 허용 오차를 넘으면 Tier 2 포팅 쪽을 고친다.

**(c) 웹에서 시도하지 말 것**
- C#/.NET Godot 웹 export, 또는 게임 C# `N*` 로직의 웹 재현. 공식 미지원이고 프로토타입은 72 MiB였다.
- 범용 Godot canvas_item 셰이더→GLSL transpiler.
- `hint_screen_texture`, `light()`, SDF, 라이트 내장 변수를 쓰는 셰이더의 웹 포팅. 저작 규칙에서도 금지하는 편이 낫다.
- GPUParticles2D의 픽셀 단위 재현.
- Godot 웹 에디터에서 Spine(GDExtension)을 미리보기.
- Rive, Lottie, Live2D, Effekseer를 게임 내 포맷으로 채택.
- 600장 전체를 플립북으로 제작하거나 배포.
- 프로덕션 사이트에 검증기를 배포.

### Gaps
- 게임이 모드 `.pck`의 씬을 카드 초상화 노드 아래에 붙이는 훅(C# 측 로더)이 있는지는 이 조사 범위 밖이다. 저작 포맷 권고의 전제로 남는다.
- STS2 렌더링 방식이 확인되지 않아 Tier 1 웹 export의 "정본" 지위는 조건부다.
