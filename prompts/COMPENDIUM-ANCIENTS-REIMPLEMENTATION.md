# 백과사전 고대의 존재 재구현 프롬프트

이 문서를 구현 에이전트에게 그대로 전달한다. 계획이나 목업에서 멈추지 말고, 현재 게임 원본을 다시 조사한 뒤 구현·검증·커밋까지 완료한다.

## 목표

백과사전의 고대의 존재 상세를 다음 기준으로 재구현한다.

1. 고대의 존재 8종의 정적 배경, Spine 본체, 배경/전경 효과, placeholder 또는 대체 아트 유무를 각각 보존한다.
2. 모든 고대의 존재를 한 렌더링 방식으로 처리했던 과거 회귀를 구조적으로 막는다.
3. 캐릭터와 고대의 존재의 대사를 일반 채팅 목록이 아니라 실제 게임의 고대의 존재 이벤트에 가까운 장면과 진행 방식으로 보여 준다.
4. 목록 모달과 직접 상세 URL이 같은 구현을 사용하고, 데스크톱·모바일·키보드·모션 감소 환경에서 기능 손실이 없게 한다.
5. 위 두 축을 고치는 동안 드러나는 명백한 데이터 해석, 접근성, 정보 구조 문제도 함께 정리하되 상세 페이지 전체를 불필요하게 다시 만들지는 않는다.

서비스 UI에서는 `백과사전`, `고대의 존재`, `카드`, `유물`처럼 실제 용어를 사용한다. `Codex`, `엔티티` 같은 내부 용어를 새 사용자 문구로 노출하지 않는다.

## 먼저 지킬 제약

- 저장소의 `AGENTS.md`와 관련 로컬 스킬을 먼저 읽고 따른다.
  - `.codex/skills/compendium-resource-detail/SKILL.md`
  - `.codex/skills/sts2-spine-assets/SKILL.md`
  - 실제 화면 검증 시 `.codex/skills/mobile-viewport-qa/SKILL.md`
- 게임 애셋과 데이터는 현재 설치된 게임 PCK와 DLL, 공식 로컬라이제이션을 원본으로 삼는다. 파일명이나 기존 웹 출력만 보고 추측하지 않는다.
- 작업 시작 시 `release_info.json`을 다시 읽어 게임 버전과 커밋을 기록한다. 아래 조사표는 방향을 잡는 기준이지 현재 원본을 건너뛸 근거가 아니다.
- 생성 JSON과 추출 결과를 손으로 맞추지 않는다. 추출기 또는 생성기가 SSOT여야 하며 두 번 실행했을 때 두 번째 실행은 clean diff여야 한다.
- Cloudflare 요청 시 PCK 파싱, 이미지 합성, 대형 JSON 조인, 검색 인덱싱을 하지 않는다. 추출·분류·fallback 합성은 빌드 전에 끝내고 Worker는 정적 파일과 작은 메타데이터만 전달한다.
- 새 라이브러리나 범용 Godot 렌더러를 만들기 전에 현재 캐릭터, 몬스터/전투, 이벤트 구현을 재사용한다. 8개 장면에 실제로 필요한 노드만 지원한다.
- 목록 카드마다 WebGL을 상시 마운트하지 않는다. 라이브 장면은 상세에서만 기본 활성화하고, 목록에서 꼭 필요하다면 hover/선택 및 viewport 진입 뒤에만 제한한다.
- 목록 모달과 `/compendium/ancients/[id]` 직접 페이지가 같은 `AncientDetail`과 같은 렌더러를 계속 사용해야 한다. 다국어 경로도 별도 복제하지 않는다.
- 관련 카드/유물, 구조화된 패치 이력, 댓글, 공유 가능한 리소스 URL 등 이미 잘 동작하는 상세 공통 기능은 보존한다.
- 별도 요청이 없으면 브랜치를 만들거나 배포하지 않는다. 저장소 규칙대로 의미 있는 수정 직후마다 speculative commit을 남긴다.
- 사용자가 작업 중인 변경을 건드리거나 커밋에 섞지 않는다.

## 조사 기준선

2026-08-01 조사 시 설치본의 `release_info.json`은 `v0.110.1`, commit `db5d3552`였다. 저장소에 체크인된 일부 생성 애셋은 그보다 이전 게임 빌드에서 만들어졌을 수 있으므로, 이 버전 차이도 시작 감사에서 확인한다.

### 현재 웹 구현에서 확인된 회귀

- `src/components/codex/ancient-detail.tsx`의 `ANCIENT_BACKGROUND_IDS`가 6개 ID를 한 정적 배경 경로로 묶는다.
- NEOW와 TEZCATARA는 본체가 Spine인데 현재 상세에서는 중앙이 비어 있는 배경만 보이고 본체가 사라진다.
- NONUPEIPE와 VAKUU는 배경 ID 집합에서 빠져 85×85 런 히스토리 토큰을 큰 대표 이미지처럼 확대한다.
- `data/sts2/ancient-spine-assets.json`에는 NEOW와 TEZCATARA 메타데이터가 있고 `getCodexAncientSpineAssets()`도 존재하지만 상세 렌더 경로에서 사용하지 않는다.
- `scripts/extract-sts2-ancient-assets.py`는 8개 토큰과 NEOW 배경만 책임진다. 현재 `public/images/sts2/ancients-bg/`에 남은 다른 배경은 같은 갱신 파이프라인의 보호를 받지 않아 stale 또는 누락 위험이 있다.
- Git 이력에서 고대의 존재 대표 화면이 event art → scene art → map node로 일괄 전환됐다. 8종별 능력표 없이 전역 전략을 바꾼 것이 같은 회귀가 반복된 패턴이다.

### 원본 장면에서 확인한 8종 애셋 매트릭스

원본 장면은 `scenes/events/background_scenes/<id>.tscn`에 있다. 아래 particle 개수는 조사 당시 분기를 설명하는 참고값이므로 테스트에서 숫자를 하드코딩하지 말고 현재 PCK를 다시 파싱한다.

| ID | 기본 장면/아트 | Spine | 원본 VFX 특성 | 현재 웹 문제 | 구현 방향 |
| --- | --- | --- | --- | --- | --- |
| DARV | `darv_placeholder.png` 정적 장면 | 없음 | CPU particle 3 | 정적 한 장만 표시 | 정적 장면 + 원본 기반 ambient VFX |
| NEOW | `neow_bg.png` 배경 | `neow`, `idle_loop` | CPU/GPU particle, 물·안개 shader와 sprite | 배경만 남고 본체 소실 | 정적 배경 + Spine 본체 + VFX, 완성된 정적 fallback |
| NONUPEIPE | `nonupeipe_placeholder.png` 정적 장면 | 없음 | GPU particle 13 | 작은 토큰 확대 | 정적 장면 + GPU ambient VFX |
| OROBAS | `orobas_placeholder.png` 정적 장면 | 없음 | CPU/GPU particle와 water shader | 정적 한 장만 표시 | 정적 장면 + 원본 기반 ambient VFX |
| PAEL | `pael_placeholder.png` 정적 장면 | 없음 | CPU/GPU particle | 정적 한 장만 표시 | 정적 장면 + 원본 기반 ambient VFX |
| TANX | `tanx_placeholder.png` 정적 장면 | 없음 | CPU particle와 water/smoke shader | 정적 한 장만 표시 | 정적 장면 + CPU ambient VFX |
| TEZCATARA | Spine atlas가 장면 배경까지 포함 | `tezcatara`, 현재 추출 메타의 animation | 매우 많은 CPU/GPU particle, fire sprite | 별도 배경만 남고 본체 소실 | Spine 장면 + 필요한 VFX, 완성된 정적 fallback |
| VAKUU | `vakuu_placeholder.png` 정적 장면 | 없음 | CPU/GPU particle | 작은 토큰 확대 | 정적 장면 + 원본 기반 ambient VFX |

조사 당시에는 VFX가 전혀 없는 고대의 존재가 없었다. 분기는 VFX의 존재 여부보다 CPU/GPU particle, shader, sprite, Spine 결합 방식과 웹 지원 가능 여부에 있었다. 현재 원본이 달라졌다면 생성 매트릭스와 테스트 기대값을 함께 갱신한다.

`*_placeholder.png`는 원본 리소스 이름이다. 화면이 완성돼 보인다는 이유로 `final`이라 바꾸거나, 이름만 보고 사용자에게 `베타 아트`라고 표시하지 않는다. 조사 당시 별도의 고대의 존재별 beta scene art는 확인되지 않았다. 다음처럼 처리한다.

- manifest에는 원본 상태를 `placeholder`로 보존한다.
- 별도 대체 아트가 현재 PCK에서 실제로 확인될 때만 `alternatives` 또는 동등한 optional 필드에 추가한다.
- 대체 아트가 없는 리소스에 빈 베타 탭이나 추측 토글을 만들지 않는다.
- generic 카드 atlas의 `ancient_beta` 이미지를 고대의 존재 장면 대체 아트로 오인하지 않는다.

### 최근의 좋은 렌더링 선례

- `src/components/codex/character-spine-stage.tsx`
  - 별도 런타임을 복제하지 않고 `MonsterSpineStage`를 얇게 감싼다.
- `src/components/codex/monster-spine-stage.tsx`
  - 런타임 지연 로드, 정적 우선, player success 기반 준비 상태, straight-alpha, 실패 fallback, 명시적 정리를 구현한다.
- `src/components/codex/encounter-scene-stage.tsx`
  - 정적 배경 위에 VFX와 background Spine을 서로 독립적인 레이어로 합성한다.
- `src/components/codex/fake-merchant-spine-stage.tsx`
  - 여러 Spine 레이어를 한 canvas의 게임 좌표로 조합하고 intersection, visibility, reduced motion, FPS/DPR 제한을 처리한다.
- `src/components/codex/decimillipede-spine-stage.tsx`
  - 복합 액터를 억지로 범용 단일 액터에 넣지 않고 필요한 조합을 명시한 선례다.
- `src/components/codex/event-detail.tsx`, `event-choice-frame.tsx`, `event-vfx-stage.tsx`, `event-vfx-runtime.ts`
  - 게임 장면 좌표, 순차 콘텐츠 상태, 실제 선택 프레임, 정적 배경과 VFX 레이어, 브라우저 전용 지연 로드를 참고한다.

현재 `public/event-vfx-player.js`는 Canvas2D로 Godot의 `GPUParticles2D`와 일부 sprite를 근사하고 `CPUParticles2D`, `TextureRect`, `SpineSprite`를 완전하게 처리하지 않는다. Godot 노드명의 GPU는 이 웹 런타임이 WebGL이라는 뜻이 아니다. 이를 그대로 연결하면 DARV와 TANX의 효과가 통째로 없어지고 다른 장면도 일부 유실된다. 범용 엔진을 새로 만들지 말고, 8개 원본 장면에서 실제로 보이는 효과를 목록화한 뒤 기존 event VFX 추출기와 런타임에 필요한 최소 지원만 더한다.

또한 조사 당시 NEOW atlas는 5767×4883으로 `width × height × 4` 기준 디코드 메모리 하한이 약 107 MiB였고 TEZCATARA도 같은 계산으로 약 24 MiB였다. PNG 전송량, 이 하한값, 실제 기기의 `gl.MAX_TEXTURE_SIZE`, 성공 렌더 여부를 기록한다. 축소가 필요하면 PNG만 줄이지 말고 atlas 좌표와 texture를 같은 비율로 생성 단계에서 함께 줄인다.

### 실제 고대의 존재 대사 UI에서 확인한 구조

PCK에서 다음 장면과 리소스를 직접 확인하고 구현 기준으로 삼는다.

- `scenes/events/ancient_dialogue_line.tscn`
- `scenes/events/ancient_event_layout.tscn`
- `scenes/events/ancient_event_option_button.tscn`
- `scenes/ui/ancient_name_banner.tscn`
- `themes/ancient_name_banner.tres`
- `images/ui/dialogue_nine_patch.png`
- `images/ui/dialogue_tail.png`
- 고대의 존재와 캐릭터 아이콘 및 outline

원본은 전체 배경/VFX 위에 약 1160×720의 대화·선택 영역을 두고, 대사 줄에는 화자 방향에 맞춘 아이콘과 꼬리, blue-green nine-patch, 밝은 본문을 사용한다. 현재 줄을 강조하고 이전 줄은 stale 상태로 흐리게 남기며, hover한 이전 줄 하나만 다시 선명하게 하는 동작의 근거도 게임 코드 문자열과 과거 패치 수정 내역에서 확인됐다. 초기 장면에는 중앙 이름 배너가 있고, 진행은 full-screen hitbox와 하단 continue affordance를 사용한다.

현재 `DialogueViewer`의 채팅 bubble 목록은 이 구조와 다를 뿐 아니라 데이터 의미도 잘못 해석한다.

- `AncientDialogueLine.order`의 `0-0`, `0-1`, `1-0r`, `2-0` 등은 대화 변형과 그 안의 줄 순서를 나타낸다.
- 현재 UI는 서로 다른 변형을 캐릭터 탭 하나의 연속 transcript로 평탄화한다.
- 실제 데이터는 보통 캐릭터 또는 generic 그룹마다 여러 개의 별도 대화 장면을 가진다.
- 공식 로컬라이제이션 `data/sts2/localization/<locale>/ancients.json`에는 `${ANCIENT}.talk.${GROUP}.${ORDER}.next` 형태의 실제 진행 문구가 있지만 현재 loader가 이를 버린다.
- `ancient.description`은 first visit 첫 대사에서 파생되므로 메타 rail의 `첫 조우`와 대사 탭에 같은 문장이 중복된다.
- 현재 상세의 캐릭터 탭 순서는 게임 순서와 다르다. 로컬 ID 상수를 하나 더 만들지 말고 이미 공식 순서로 정렬된 `CodexCharacter[]`를 사용한다.

## 구현 요구사항

### 1. 원본 기반 애셋 manifest를 먼저 만든다

8개 ID 각각에 대해 독립적인 능력을 표현하는 작은 생성 manifest를 둔다. 이름과 세부 구조는 기존 타입에 맞춰 정하되, `kind: "static" | "spine"` 같은 상호 배타적 단일 분기로 축약하면 안 된다. 최소한 다음 사실을 표현해야 한다.

```ts
{
  id,
  source: { gameVersion, scenePath },
  token,
  baseArt: { path, sourcePath, status },        // 없을 수 있음
  fallback: { path },                          // 고대의 존재 본체가 포함된 완성 장면
  spine: { assetId, animation, skin, viewport }, // 없을 수 있음
  vfx: { manifestPath, support, unsupported }, // full | partial | unsupported
  composition: { slots, sourceZOrder },        // 원본에서 필요한 경우
  alternatives: []                             // 원본으로 확인된 경우에만
}
```

이 예시는 필요한 의미를 보여 주는 것이며 일회성 interface나 factory를 만들라는 뜻이 아니다. 현재 `getCodexAncientSpineAssets()`가 반환하는 `MonsterSpineAsset[]`, event VFX metadata, 공통 viewport 타입을 우선 재사용하고, 기존 타입으로 원본 의미를 보존할 수 없을 때만 작은 Ancient 전용 타입을 추가한다.

구현 원칙:

- React 컴포넌트 안의 ID Set이나 파일 존재 여부로 렌더 전략을 추측하지 않는다.
- source scene을 파싱해 manifest를 생성하고, 8개 ID가 정확히 한 번씩 들어가는지 검증한다.
- base art, Spine, VFX, alternative는 독립 필드다. 한 항목이 있다고 다른 항목을 지우지 않는다.
- 브라우저가 아직 재현하지 못하는 VFX 노드도 조용히 삭제하지 않는다. 장면 전체를 boolean 하나로 켜고 끄지 말고 `full | partial | unsupported` 상태, 지원한 node, 빠진 node와 이유를 생성 결과와 최종 보고에 남긴다.
- fallback은 항상 고대의 존재 본체까지 포함한 완성된 정적 장면이어야 한다. NEOW의 빈 배경이나 Spine atlas page를 fallback으로 쓰지 않는다.
- 영구 base layer와 로딩/실패용 완성 composite fallback을 구분한다. NEOW의 `neow_bg`는 Spine 준비 뒤에도 남아야 하고, 준비 뒤 사라지는 것은 본체까지 그린 임시 composite fallback뿐이다.
- 필요한 경우 추출 단계에서 원본 scene의 기준 프레임을 정적 합성한다. 요청 처리 중 합성하지 않는다.
- 생성 결과에는 source scene 좌표, viewport/camera transform, skin, animation, track을 보존하고 React에서 감으로 보정값을 흩뿌리지 않는다.
- 본체 앞뒤로 VFX가 섞이는 장면은 `behindBody`/`inFrontOfBody` 또는 동등한 composition slot과 source z-order를 보존한다. 참조하는 외부 PackedScene도 추출 시 재귀적으로 해석하고 누락을 기록한다.
- 큰 runtime manifest를 일반 리소스 JSON payload에 통째로 중복하지 않는다. 상세가 실제로 필요한 작은 descriptor 또는 정적 URL만 전달하고 측정으로 결정한다.

우선 다음 파일과 흐름을 조사하고, 기존 파일을 확장하는 것이 가장 작으면 그대로 사용한다.

- `scripts/extract-sts2-ancient-assets.py`
- `scripts/extract-sts2-spine-assets.py`
- `scripts/build-sts2-spine-index.mjs`
- `scripts/extract-event-vfx-scenes.py`
- `data/sts2/ancient-spine-assets.json`
- `src/lib/codex-types.ts`
- `src/lib/codex-data.ts`

새 전용 manifest가 필요하다면 `data/sts2/ancient-scene-assets.json`처럼 역할이 분명한 생성 파일 하나를 선호한다. 같은 사실을 여러 JSON에 복제하지 않는다.

### 2. capability 조합형 장면을 구현한다

`AncientSceneStage` 또는 동등한 얇은 조합 컴포넌트 하나가 manifest를 읽고 기존 stage들을 합성하게 한다.

- 정적 장면은 항상 먼저 그려 레이아웃과 fallback을 안정시킨다.
- NEOW 같은 정적 배경 + 단일 Spine은 `MonsterSpineStage`의 얇은 Ancient 어댑터 또는 같은 검증된 경로를 사용한다.
- 정적 배경 + VFX는 `EncounterSceneStage`와 event VFX의 독립 레이어 방식을 사용한다.
- 여러 Spine 레이어가 실제로 확인될 때만 `FakeMerchantSpineStage`식 공유 canvas를 사용한다.
- 특수 bone 또는 복합 구성이 실제로 필요한 항목만 명시적인 작은 조합을 둔다. 모든 항목을 위한 factory를 만들지 않는다.
- Spine 또는 scene 전체가 본체를 담당하는 항목은 live body의 준비 신호 전까지 완성된 composite fallback을 유지한다. 현재 `MonsterSpineStage`의 success callback보다 강한 첫 draw 보장이 필요하다면 작은 readiness handshake를 추가하거나 최소 한 animation frame 동안 fallback을 더 유지한다. 파일 fetch 성공만으로 숨기지 않는다.
- 복합 본체는 필수 body layer가 모두 준비된 뒤에만 composite fallback을 숨긴다. 영구 base layer는 그 뒤에도 유지한다.
- ambient VFX 실패는 정적 본체나 성공한 Spine까지 숨기지 않는다. 각 레이어가 독립적으로 fail closed 해야 한다.
- Spine은 straight-alpha를 유지하고 기존 runtime과 같은 `premultipliedAlpha: false` 경로를 사용한다.
- offscreen, hidden tab, `prefers-reduced-motion`에서는 지속 애니메이션을 멈추거나 정적 기준 프레임을 사용한다.
- unmount 시 timer, observer, player, renderer, asset manager, Spine의 WebGL context와 VFX의 Canvas/runtime를 각각 정리한다.
- Spine의 WebGL 비활성/실패와 ambient VFX의 Canvas/runtime 실패를 별도로 강제해도 빈 무대를 만들지 않는다.
- 한 고대의 존재를 열 때 다른 7종의 atlas나 VFX texture를 다운로드·디코드하지 않는다.

원본 scene별 VFX 지원 상태를 `full | partial | unsupported`로 판정한다. `full`과 `partial`은 원본에 근거한 시각적으로 중요한 효과가 실제로 움직여야 하고, `partial`은 생략한 node를 남긴다. `unsupported`는 현재 브라우저 런타임으로 안전하게 재현할 수 없다는 구체적인 근거가 있을 때만 허용하며 정적 fallback을 유지한다. 다음 대표 조합은 적어도 하나씩 라이브로 검증한다.

- CPU 중심: DARV 또는 TANX
- GPU 중심: NONUPEIPE
- 정적 배경 + Spine + 복합 VFX: NEOW
- Spine 장면 + 고밀도 VFX: TEZCATARA

장면 전체를 완전히 복제하기 어려운 unsupported shader가 남을 수는 있지만, 이를 이유로 해당 고대의 존재의 VFX 전체를 정적화하지 않는다. 사용자에게 보이는 핵심 효과를 우선 구현하고 남은 차이는 node 단위로 기록한다.

### 3. 대사를 게임식 interaction rail로 바꾼다

현재 `InfoRailSection` 안의 채팅 transcript를 제거하고, 고대의 존재 배경과 같은 game stage 안에 interaction rail을 배치한다. 서비스 메타데이터, 보상 유물, 패치 이력, 댓글은 stage 아래 기존 상세 rail에 남긴다.

#### 데이터 정규화

- `order`를 대화 변형과 줄 순서로 parse하는 작은 순수 helper를 만든다.
- 숫자 순서와 `r` suffix를 원본 그대로 보존한다. 게임 코드 근거 없이 `r`의 의미나 방문 확률을 지어내지 않는다.
- 다른 변형을 한 transcript로 합치지 않는다. UI에는 중립적인 `대화 1`, `대화 2`처럼 구분한다.
- `First Visit`, `Returning`, 다섯 캐릭터 그룹을 모두 보존한다.
- 현재 locale의 `.next` 값을 optional `nextLabel`로 loader에 보존한다. 값이 있으면 임의의 `다음` 문구로 덮지 않는다.
- 대사 본문의 BBCode와 `RichDescription` 교차 링크를 보존한다.
- raw 구조는 현재 존재하는 `data/sts2/kor/events.json`, `eng/events.json`, `kor/characters.json`, `eng/characters.json`에서 읽고, 선택 언어 문구는 `data/sts2/localization/<locale>/ancients.json`에서 읽는 기존 loader 흐름을 따른다. 존재하지 않는 locale별 raw JSON을 가정하지 않고, 참조되지 않는 역사 파일 `data/ancients.json`을 새 SSOT로 삼지 않는다.
- 같은 대사를 쓰는 `CharacterAncientInteractions` 등 모든 caller를 확인한다. 정규화 helper를 공유하면 의미 오류를 한 번에 막을 수 있는 범위까지만 공유하고 캐릭터 상세 전체를 새 디자인으로 재작성하지 않는다.

#### 상호 작용

- 캐릭터/First Visit/Returning 선택, 대화 변형 선택, 현재 줄 진행의 세 상태를 명확히 구분한다.
- 그룹이나 대화 변형을 바꾸면 첫 줄로 reset한다.
- 미래 줄은 미리 노출하지 않는다.
- 진행할 때 현재 줄을 강조하고 이미 본 줄은 게임처럼 흐린 stale 상태로 남긴다.
- pointer hover 또는 keyboard focus를 받은 stale 줄 하나만 일시적으로 선명하게 한다. 모든 이전 줄을 동시에 활성화하지 않는다.
- 실제 `.next` 문구와 원본의 진행 affordance를 사용한다. `ancient_event_layout`과 DLL 동작을 확인해 full-screen hitbox/continue가 정답이면 그것을 따른다. `GameChoiceFrame`은 시각·동작이 맞을 때만 재사용하고, 일반 event option과 ancient option을 근거 없이 혼용하지 않는다.
- full-screen continue hitbox는 interaction rail의 selector, `RichDescription` 링크, stale 줄 control과 sibling으로 두고 그 영역을 덮거나 클릭을 가로채지 않는다. interactive 요소를 큰 진행 `button` 안에 중첩하지 않는다.
- 마지막 줄에서는 진행 버튼을 비활성으로 남기지 말고 `다시 보기` 또는 변형 선택으로 돌아가는 명확한 상태를 제공한다.
- 자동 재생으로 읽는 속도를 강요하지 않는다.
- 고대의 존재와 캐릭터 아이콘, dialogue tail, nine-patch를 원본에서 추출해 사용한다. 손으로 비슷한 말풍선을 새로 그리지 않는다.
- 화자 이름을 텍스트로 항상 표시한다. 색과 좌우 방향만으로 화자를 구분하지 않는다.
- 캐릭터 순서는 `CodexCharacter[]`의 공식 정렬을 사용한다. 별도 하드코딩 배열을 만들지 않는다.
- 최초 진입의 name/epithet 배너는 원본 장면을 참고하되, 빠르게 대사를 탐색하는 백과사전 기능을 막는 강제 지연은 만들지 않는다.

#### 접근성과 모바일

- selector와 진행은 native `button`을 사용한다.
- selector에는 올바른 tabs semantics 또는 `aria-pressed`를 사용하고, 키보드만으로 전 과정을 진행할 수 있어야 한다.
- 줄 전환은 `aria-live="polite"`로 알리되 이미 읽은 전체 transcript를 매번 다시 읽지 않게 한다.
- decorative portrait는 빈 alt를 사용하고 화자 이름은 별도 텍스트로 제공한다.
- 모든 주요 터치 타깃은 최소 44px, selector는 좁은 화면에서 안전하게 수평 스크롤 또는 wrap한다.
- 360×800에서도 현재 줄과 진행 버튼에 도달할 수 있고 stage와 rail에 가로 overflow가 없어야 한다.
- hover만으로 가능한 기능을 만들지 않는다. stale 줄 복원은 focus/tap에도 동등하게 작동해야 한다.
- 흐린 stale 줄도 WCAG 텍스트 대비를 유지한다. focusable stale control에는 `이 대사 다시 보기`처럼 동작이 드러나는 accessible name을 주고, tap으로 복원한 같은 입력이 다음 줄 진행까지 일으키지 않게 한다.
- `prefers-reduced-motion`에서 대사 전환과 VFX가 읽기 불편한 모션을 만들지 않는다.

### 4. 상세와 목록에 연결한다

- `CodexAncient` 또는 별도 작은 descriptor에 생성된 scene asset 참조를 연결한다.
- 목록 모달 로더도 캐릭터 데이터를 전달해 직접 상세와 같은 공식 이름, 아이콘, 순서를 사용하게 한다. 직접 payload에 이미 있는 데이터를 불필요하게 다시 fetch하지 않는다.
- `AncientDetail`의 stage와 rail 구조를 게임 장면 우선으로 재배치하되 관련 리소스, 패치, 댓글 로직은 유지한다.
- 목록 타일은 안정적인 정적 대표 이미지 또는 map node를 사용한다. 8개의 라이브 canvas renderer를 동시에 돌리지 않는다.
- 목록 타일에 디자인 문서가 요구하는 영어 이름 보조 표기가 빠져 있다면 함께 복구한다.
- locale에 따라 pathname 또는 query를 사용하는 기존 resource URL, direct-or-modal 판정과 popstate 동작을 유지한다. `?ancient=` 하나로 일반화하지 않는다.
- modal에는 `role="dialog"`, `aria-modal`, `aria-labelledby` 또는 동등한 accessible name, focus trap, 배경 `inert`, body scroll lock, 적절한 초기 focus, Escape 닫기, 닫은 뒤 원래 타일 focus 복귀를 제공한다.
- 선택한 캐릭터나 대화 변형의 deep link가 간단히 가능한 경우에만 query/hash를 추가한다. 재생 중 `lineIndex`까지 URL 상태로 만들지는 않는다.
- THE_ARCHITECT는 character interaction source에 있더라도 현재 8종 고대의 존재 상세 범위에 몰래 합치지 않는다.

### 5. 두 핵심 축 외에 함께 고칠 사항

조사에서 다음 개선은 원인이 분명하고 범위가 작으므로 함께 반영한다.

1. `첫 조우` 문장을 메타 rail과 대사 장면에 중복 노출하지 않는다. 대사 장면 한 곳을 SSOT로 보여 준다.
2. 캐릭터 순서를 로컬 상수 대신 공식 `CodexCharacter[]` 순서로 통일한다.
3. 목록의 한국어 이름 아래 영어 이름 보조 표기를 복구한다.
4. 10~30개까지 늘어나는 `relicIds`는 단순 `관련 유물`이 아니라 고대의 존재의 보상임을 드러내는 `보상 유물` rail로 표시한다. 좁은 화면에서 끝없이 한 줄 wrap된다면 compact grid 또는 접기/더보기 중 기존 컴포넌트로 가능한 가장 작은 방식을 쓴다. 원본에 없는 분류나 확률은 추가하지 않는다.
5. 모달 dialog semantics와 focus 복귀를 보완한다.
6. 애셋 manifest 완전성과 대사 scene grouping을 각각 작은 자동 검증으로 남긴다.
7. 대사 shape를 scene 단위로 바꿔도 `src/lib/search-index-data.ts`가 모든 대사 본문 줄을 계속 검색 문서에 넣게 한다. `.next` 문구는 검색 대상일 필요가 없다.

다음은 재작성 대상이 아니다.

- 관련 카드/유물의 실제 연결 데이터
- 구조화된 패치 이력과 변화 표시
- 댓글과 댓글 수
- modal/direct 공용 상세 원칙
- 캐릭터 상세 전체 디자인
- 범용 Godot scene engine

## 예상 변경 지점

실제 흐름을 추적한 뒤 최소 파일로 결정하되, 적어도 다음 지점을 확인한다.

- `scripts/extract-sts2-ancient-assets.py`
- `scripts/extract-sts2-spine-assets.py`
- `scripts/build-sts2-spine-index.mjs`
- `scripts/extract-event-vfx-scenes.py`
- `data/sts2/ancient-spine-assets.json`
- 새 scene manifest가 필요하면 `data/sts2/ancient-scene-assets.json`
- `public/images/sts2/ancients-bg/`
- `public/spine/sts2/ancients/`
- event/ancient UI 추출 애셋 경로
- `src/lib/codex-types.ts`
- `src/lib/codex-data.ts`
- `src/components/codex/ancient-node-render.tsx`
- `src/components/codex/ancient-list.tsx`
- `src/components/codex/ancient-detail.tsx`
- 필요하면 작은 `ancient-scene-stage.tsx`, `ancient-dialogue-viewer.tsx`
- 직접 상세 payload를 만드는 `compendium-direct-detail-page.tsx` 및 해당 route loader
- 생성기/validator 테스트와 대표 브라우저 테스트

새 파일을 먼저 늘리지 말고 기존 stage와 helper가 그대로 해결하는지 확인한다. 다만 asset renderer와 dialogue state를 한 generic abstraction으로 합치지는 않는다. 서로 다른 회귀 축이므로 독립적으로 읽고 검증할 수 있어야 한다.

## 검증

### 자동 검증

최소한 다음을 실행하고 결과를 기록한다.

```bash
# 관련 추출/생성 명령: 실제 package script를 확인해 사용
# 같은 명령을 두 번 실행한 뒤 두 번째 실행이 clean diff인지 확인
pnpm codex:validate
pnpm lint
pnpm build
```

추가하는 작은 검증은 다음을 직접 실패시켜야 한다.

- 현재 원본의 고대의 존재 ID 8개가 manifest에 정확히 한 번씩 존재한다.
- 출력 URL은 대응하는 저장소 정적 파일이 존재하고, PCK `sourcePath`는 추출 시 원본 PCK 내부에 존재한다.
- 현재 조사 기준으로 NEOW와 TEZCATARA에 Spine이 연결되고 다른 6종에는 추측 Spine을 넣지 않는다. 현재 PCK가 달라졌다면 원본 기반 기대값을 명시적으로 갱신한다.
- source scene의 base art/placeholder 상태, Spine, VFX가 한 필드 때문에 다른 필드에서 유실되지 않는다.
- 모든 항목에 고대의 존재 본체가 포함된 fallback이 있다.
- Spine 항목의 atlas/skel/texture가 존재하고, 지정 animation과 skin이 생성 인덱스에 있으며, viewport 값은 finite이고 texture dimension은 정한 한계 안이다.
- `order` parser가 변형과 줄 순서 및 `r` suffix를 안정적으로 보존한다.
- 여러 대화 변형이 하나의 transcript로 평탄화되지 않는다.
- locale에 존재하는 `.next` 문구가 loader에서 보존된다.
- scene grouping 뒤에도 모든 대사 본문 줄이 검색 인덱스에 남는다.

Worker 코드나 binding/config를 바꿨다면 OpenNext build 뒤 Wrangler dry run으로 gzip bundle size와 binding도 확인한다. 정적 애셋과 클라이언트만 바꿨다면 불필요한 배포 명령은 실행하지 않는다.

### 실제 브라우저 QA

headless 환경의 WebGL 성공만 믿지 말고 실제 데스크톱과 모바일 브라우저에서 확인한다. 최소한 다음을 점검한다.

- 8종 상세를 각각 한 번씩 열어 배경, 본체, 크기, 중심, crop, VFX를 비교한다.
- NEOW와 TEZCATARA에서 Spine 본체가 실제로 보이고 idle animation이 움직인다.
- NONUPEIPE와 VAKUU가 작은 토큰 확대로 회귀하지 않는다.
- DARV/TANX의 CPU 계열, NONUPEIPE의 GPU 계열, NEOW/TEZCATARA의 Spine+VFX 조합을 별도로 확인한다.
- Spine WebGL 비활성/runtime 실패, ambient Canvas/runtime 실패, atlas/skel/texture 누락, 잘못된 animation을 각각 강제로 만들었을 때도 완성된 정적 장면이 보인다.
- 8종을 반복해서 열고 닫아도 WebGL context 누수 경고, stale Canvas, stale timer가 없다.
- NEOW 하나를 열 때 다른 7종의 atlas/VFX texture가 네트워크에서 요청되거나 디코드되지 않는다.
- `prefers-reduced-motion`에서는 장면과 대사가 안정적인 정적 상태로 읽힌다.
- First Visit, Returning, 다섯 캐릭터 그룹에서 서로 다른 대화 변형이 분리되고 실제 next 문구로 한 줄씩 진행된다.
- 이미 본 줄 하나의 hover/focus/tap 복원, 키보드 진행, 마지막 줄 reset을 확인한다.
- 첫 조우 문장이 한 번만 보인다.
- 목록 모달과 직접 URL이 같은 결과를 내고, 브라우저 back/forward와 focus 복귀가 깨지지 않는다.
- 한국어를 우선 확인하고 영어 및 다국어 직접 경로에서 누락이나 key 노출이 없는지 확인한다.

QA hook은 이름을 통일해 추가한다.

- stage: `data-ancient-art-stage`
- controls: `data-ancient-dialogue-controls`

모바일 QA 스킬의 canonical viewport 목록을 사용하고, 실제 dev server 포트에 맞춰 직접 상세를 검사한다.

```bash
node scripts/mobile-qa.mjs --list
node .codex/skills/mobile-viewport-qa/scripts/check-mobile-route.mjs \
  --route /compendium/ancients/neow \
  --render-selector '[data-ancient-art-stage]' \
  --controls-selector '[data-ancient-dialogue-controls]'
```

모달은 목록 타일을 클릭하는 별도 Playwright 흐름에서 실제로 연 뒤 같은 selector를 검사한다. 직접 상세는 대표적인 정적+VFX, Spine+VFX 항목을 각각 검사한다. 360×800에서 가로 overflow, 잘린 진행 버튼, 44px 미만 터치 타깃이 없어야 한다.

## 완료 조건

다음을 모두 만족해야 완료다.

- [ ] 현재 게임 버전과 source scene을 기록한 8행 애셋 감사표가 구현 결과와 일치한다.
- [ ] React의 하드코딩 ID Set이 아니라 생성 manifest의 독립 capability로 렌더한다.
- [ ] 8종 모두 본체가 포함된 안정적인 정적 fallback을 가진다.
- [ ] NEOW와 TEZCATARA의 Spine 본체가 복구되고, 다른 6종의 정적 본체가 유지된다.
- [ ] 원본 VFX를 `full | partial | unsupported`로 분류하고 대표 CPU/GPU/Spine 조합의 핵심 ambient 효과가 동작하며 빠진 차이는 node 단위로 기록된다.
- [ ] placeholder와 확인된 beta/alternative를 구분하며 없는 베타 UI를 발명하지 않는다.
- [ ] 큰 atlas의 전송량, `width × height × 4` 메모리 하한, 실제 기기 `gl.MAX_TEXTURE_SIZE`와 성공 렌더 여부를 기록했다.
- [ ] 대화 변형이 분리되고 현재 줄 중심의 게임식 interaction rail로 진행된다.
- [ ] 실제 `.next` 문구, 아이콘, tail, nine-patch, 공식 캐릭터 순서를 사용한다.
- [ ] 첫 조우 중복, 목록 영어명, 보상 유물 정보 구조, 모달 접근성을 정리했다.
- [ ] modal/direct/다국어/모바일/reduced-motion/failure fallback이 같은 기능을 제공한다.
- [ ] 생성기 재실행 clean diff, 자동 검증, lint, build, 실제 브라우저 QA를 통과했다.
- [ ] Cloudflare 요청 경로에 새 대형 런타임 작업을 추가하지 않았다.
- [ ] 관련 카드/유물, 패치 이력, 댓글 등 기존 기능이 회귀하지 않았다.

## 최종 보고 형식

완료 후 다음만 근거와 함께 보고한다.

1. 재확인한 게임 버전과 최종 8종 애셋 매트릭스
2. 기존 회귀의 원인과 이를 막은 데이터/렌더 구조
3. 대사 grouping 및 game-like 진행 방식
4. 두 핵심 축 외에 실제로 반영한 개선점
5. 실행한 자동 검증과 브라우저/모바일 QA 결과
6. 남아 있는 source node 단위의 시각 차이와 이유
7. 생성한 speculative commit 해시

스크린샷 또는 녹화가 실제 게임과의 차이를 판단하는 데 필요하면 대표적으로 DARV, NONUPEIPE, NEOW, TEZCATARA와 모바일 한 화면을 남긴다. 검증하지 못한 항목을 완료로 표시하지 않는다.
