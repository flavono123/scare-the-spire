# 캐릭터 형상 VFX 구현 상태

이 문서는 STS2 v0.110.0 캐릭터 형상 VFX의 게임 원본 대비 브라우저 구현 상태를 추적한다.

## 원본 기준

- PCK 장면: `scenes/vfx/forms/{form}/vfx_{form}_form_idle_vfx.tscn`
- 캐릭터 배치: `scenes/creature_visuals/{character}.tscn`의 `Visuals.position`과 `Visuals.scale`
- 게임 코드: `NFormVfx`, 각 `N*FormVfx`, `NSpineSpriteBoneFollower`, `NSpineSpriteCopier`, `NCreatureVisuals.AddFormVfx`
- 추출기: `scripts/extract-character-form-vfx.py`
- 브라우저 렌더러: `public/event-vfx-player.js`

현재 위치는 5개 형상 × 5개 캐릭터 조합의 원본 뼈 이름과 캐릭터 Visuals 변환을 추출해 사용한다. `snap`과 공허의 형상 보간도 `NSpineSpriteBoneFollower`를 따른다.

## 현재 추출 한계

기본 형상 추출 경로는 원본 장면에서 `Node2D`와 `Sprite2D`만 남긴다. 악마의 형상부터 실제 필요가 확인된 기능만 단계적으로 공용 경로에 추가하고 있다.

- 악마·구렁이·공허·사신의 형상은 packed scene을 펼쳐 부모 장면과 자식 노드의 오버라이드를 적용하고, 사용 중인 `GPUParticles2D`, subresource, 텍스처를 정적 JSON에 보존한다.
- 메아리의 형상은 아직 packed scene, 파티클 노드, subresource를 제거한다.
- `SubViewport`와 복제 SpineSprite
- Godot/C# 스크립트가 담당하는 값 보간, 흔들림, 활성 상태, 발동 이벤트

공용 브라우저 렌더러는 악마의 형상이 사용하는 원형·링 방출, 방향·방사 속도, 감쇠, 수명 랜덤, XYZ 크기 곡선, 색상 ramp, 외부 ShaderMaterial 플립북 메타데이터를 Canvas 2D로 모사한다. 노드 속성과 배치는 게임 원본이지만 GPU 파티클 적분과 셰이더 픽셀 결과는 근사다.

## 형상별 상태

| 형상 | 구현됨 | 미구현 또는 근사 |
| --- | --- | --- |
| 악마의 형상 | 원점 배치, idle glow/noise 근사, 원본 packed scene의 common clouds·반복 slash·embers와 로컬 위치 | 발동 전용 slash/embers/glow, `OnEffectTriggered()` 파티클 재시작, ShaderMaterial LUT·erosion·hue shift의 정확한 픽셀 결과 |
| 구렁이의 형상 | 캐릭터별 뼈 부착, idle glow/noise/snakes 근사, 원본 idle scream ring 노드·수명·크기/알파 곡선 | 발동 scream/common ring, `NShaker`, `NValueRamp`, 발동 후 snakes fade, polar shader의 정확한 픽셀 결과. snakes 위치·색·스케일은 수동 근사 |
| 공허의 형상 | `head` 추적과 0.2 보간, 원본 네 spike 계층·회전·자식 오버라이드, constellation/ray/chain shards/sparkles 파티클 | 각 ShaderMaterial의 정확한 픽셀 결과, `NShaker`, swords scale ramp, glow ramp, active particle lifecycle |
| 사신의 형상 | 캐릭터별 뼈 부착, idle glow/noise 근사, 발동 polar ring A/B 원본 노드·속성을 비활성 상태로 보존 | `OnEffectTriggered()` 파티클 재시작과 미리보기 입력, polar shader의 정확한 픽셀 결과 |
| 메아리의 형상 | 캐릭터별 뼈 부착, 푸른 잔상 근사 | common specks, lines 파티클, `SubViewport`, `NSpineSpriteCopier`의 실제 Spine 복제, active/inactive `NValueRamp`. 현재 잔상은 무대 캔버스 tint |

미구현 요소는 사용자 UI에 별도 상태로 표시하지 않고 렌더에서 생략된다.

## Godot 셰이더의 웹/JS·TS 구현체 조사

조사일: 2026-08-02

### 결론

Godot `canvas_item` 셰이더를 입력받아 현재 Canvas 2D 렌더러에서 그대로 실행하는 성숙한 범용 JS/TS 구현체는 찾지 못했다.

- Godot의 공식 웹 실행 경로는 셰이더만 분리 실행하는 JS 라이브러리가 아니라 엔진 전체를 WebAssembly와 WebGL로 export하는 방식이다. 이 상세 페이지에 넣으면 현재 정적 JSON + 클라이언트 렌더 구조보다 번들·초기화 비용이 훨씬 커진다.
- Godot 엔진의 셰이더 파서와 컴파일러는 C++ 구현이다. Godot Shading Language를 GLSL과 플랫폼 셰이더로 변환하면서 Godot built-in, render mode, material 상태를 함께 처리한다.
- `@shaderfrog/glsl-parser`는 TypeScript 선언을 제공하는 JavaScript GLSL ES 1.00/3.00 parser/generator다. 표준 GLSL AST 변환에는 쓸 수 있지만 Godot 문법, `COLOR`/`UV`/`TEXTURE` 같은 built-in 의미, CanvasItem blend, particle process를 대신 구현하지 않는다.
- PixiJS/Three.js/WebGL shader API는 변환이 끝난 GLSL을 실행할 수 있을 뿐 Godot 셰이더 호환 계층은 아니다. 현재 프로젝트에는 이 렌더러들도 설치되어 있지 않다.

### 확인한 1차 자료

- [Godot 셰이더 소개](https://docs.godotengine.org/en/stable/tutorials/shaders/introduction_to_shaders.html)
- [Godot 셰이더 컴파일 파이프라인](https://docs.godotengine.org/en/stable/tutorials/performance/pipeline_compilations.html)
- [Godot Web 플랫폼 문서](https://docs.godotengine.org/en/stable/tutorials/platform/web/index.html)
- [Godot `shader_language.cpp`](https://github.com/godotengine/godot/blob/master/servers/rendering/shader_language.cpp)
- [Godot `shader_compiler.cpp`](https://github.com/godotengine/godot/blob/master/servers/rendering/shader_compiler.cpp)
- [`@shaderfrog/glsl-parser`](https://github.com/ShaderFrog/glsl-parser)

## 다음 구현 순서

1. 악마의 형상에서 확인한 packed root 펼치기와 Canvas 파티클 경로를 다음 형상에 하나씩 적용한다.
2. `NValueRamp`, `NShaker`, `SetActive`, `OnEffectTriggered`를 원본 C# 동작 단위로 옮긴다. 상세 페이지에는 전투 이벤트가 없으므로 발동 VFX는 명시적인 미리보기 입력이 필요하다.
3. 실제 차이가 남는 소수의 `canvas_item` 셰이더만 WebGL2 GLSL로 수동 이식한다. 범용 Godot 셰이더 transpiler나 새 렌더링 엔진은 만들지 않는다.
4. 메아리의 형상은 기존 Spine 런타임에서 같은 skeleton/animation state를 복제하는 별도 경로로 구현한다.

이 순서는 원본 장면 구조를 최대한 보존하면서도 Cloudflare Worker에 요청 시 작업을 추가하지 않는다. 추출은 빌드 전 정적으로 수행하고 런타임 비용은 선택된 형상 하나의 클라이언트 렌더로 제한한다.
