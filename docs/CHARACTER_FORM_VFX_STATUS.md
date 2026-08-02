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

형상 전용 `compile_scene()`은 원본 장면에서 `Node2D`와 `Sprite2D`만 남기고 다음을 제거한다.

- packed scene 인스턴스
- `GPUParticles2D`와 `CPUParticles2D`
- `ShaderMaterial`을 포함한 subresource 전체
- `SubViewport`와 복제 SpineSprite
- Godot/C# 스크립트가 담당하는 값 보간, 흔들림, 활성 상태, 발동 이벤트

공용 브라우저 렌더러에는 `ParticleProcessMaterial` 기반 파티클 근사 기능이 있지만, 형상 추출기가 파티클 노드와 subresource를 넘기지 않으므로 현재 형상에서는 사용되지 않는다.

## 형상별 상태

| 형상 | 구현됨 | 미구현 또는 근사 |
| --- | --- | --- |
| 악마의 형상 | 원점 배치, idle glow/noise 근사 | common clouds, 발동 slash/embers/glow, `OnEffectTriggered()` 파티클 재시작, 실제 셰이더 |
| 구렁이의 형상 | 캐릭터별 뼈 부착, idle glow/noise/snakes 근사 | idle/발동 scream ring, `NShaker`, `NValueRamp`, 발동 후 snakes fade, 실제 셰이더. snakes 위치·색·스케일은 수동 근사 |
| 공허의 형상 | `head` 추적과 0.2 보간, glow와 네 개 spike 근사 | constellation, ray, chain shards, sparkles 파티클, 원본 spike packed scene/셰이더, swords scale ramp, glow ramp, active particle lifecycle |
| 사신의 형상 | 캐릭터별 뼈 부착, idle glow/noise 근사 | 발동 polar ring A/B, `OnEffectTriggered()` 파티클 재시작, 실제 셰이더 |
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

1. packed scene을 재귀적으로 펼치고 원본 subresource와 파티클 노드를 정적 JSON에 보존한다.
2. 기존 `event-vfx-player.js`의 bounded Canvas 2D 파티클 렌더러로 표현 가능한 노드를 먼저 연결한다.
3. `NValueRamp`, `NShaker`, `SetActive`, `OnEffectTriggered`를 원본 C# 동작 단위로 옮긴다. 상세 페이지에는 전투 이벤트가 없으므로 발동 VFX는 명시적인 미리보기 입력이 필요하다.
4. 실제 차이가 남는 소수의 `canvas_item` 셰이더만 WebGL2 GLSL로 수동 이식한다. 범용 Godot 셰이더 transpiler나 새 렌더링 엔진은 만들지 않는다.
5. 메아리의 형상은 기존 Spine 런타임에서 같은 skeleton/animation state를 복제하는 별도 경로로 구현한다.

이 순서는 원본 장면 구조를 최대한 보존하면서도 Cloudflare Worker에 요청 시 작업을 추가하지 않는다. 추출은 빌드 전 정적으로 수행하고 런타임 비용은 선택된 형상 하나의 클라이언트 렌더로 제한한다.
