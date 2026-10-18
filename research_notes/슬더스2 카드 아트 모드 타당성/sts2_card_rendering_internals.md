# STS2 카드 렌더링·카드 사용 연출 내부 구조 (애니메이션 카드 아트 데코레이터 모드 관점)

> 조사 대상: 로컬 설치본 Slay the Spire 2 **v0.111.0** (`release_info.json`: commit `41cef1ea`, 2026-08-13).
> 디컴파일: `~/.dotnet/tools/ilspycmd -p -o /private/tmp/claude-502/sts2-src <sts2.dll>` (ilspycmd 9.1.0.7988). 아래 `sts2-src/...` 경로는 모두 `/private/tmp/claude-502/sts2-src/` 기준이다(임시 디렉터리라 재부팅 시 사라질 수 있음).
> PCK 조회: 저장소 `scripts/lib/pck.py`의 `PCKReader`를 재사용한 스크래치 스크립트(읽기 전용). `res://...` 표기는 `Slay the Spire 2.pck` 내부 경로다.
> 게임 폴더에는 아무것도 쓰지 않았고, 저장소에 커밋하지 않았다.

## Q1. 엔진 버전과 .NET 빌드 여부, 동봉된 관리형 DLL

### Takeaway
.NET 9 위에서 도는 Godot **4.5.1 Mono(C#) 커스텀 빌드**가 맞다(`4.5.1.m.14.mono.custom_build`). 게임이 **Harmony 2.4.2(`0Harmony.dll`)를 직접 동봉**하고, `sts2.dll`은 ReadyToRun이 아닌 순수 IL이라 Harmony 패치가 잘 먹는다. Spine은 관리형 DLL이 아니라 **spine-godot GDExtension 네이티브 프레임워크**로 들어 있다.

### Cited Findings
- PCK 헤더: magic `GDPC`, pack format **v3**, 엔진 **4.5.1**, 엔트리 12,450개. — [PCK 헤더 (Slay the Spire 2.pck)](file:///Users/flavono123/Library/Application%20Support/Steam/steamapps/common/Slay%20the%20Spire%202/SlayTheSpire2.app/Contents/Resources/Slay%20the%20Spire%202.pck)
- 실행 파일에 엔진 문자열 `4.5.1.m.14.mono.custom_build`가 있다. MegaCrit이 직접 빌드한 Mono 엔진이다. — [MacOS/Slay the Spire 2 바이너리](file:///Users/flavono123/Library/Application%20Support/Steam/steamapps/common/Slay%20the%20Spire%202/SlayTheSpire2.app/Contents/MacOS/Slay%20the%20Spire%202)
- `sts2.runtimeconfig.json`: `tfm net9.0`, `Microsoft.NETCore.App 9.0.7`(런타임 동봉). `project.binary`에 `dotnet/project/assembly_name`이 있다. — [sts2.runtimeconfig.json](file:///Users/flavono123/Library/Application%20Support/Steam/steamapps/common/Slay%20the%20Spire%202/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/sts2.runtimeconfig.json)
- `sts2.deps.json`의 관리형 의존성과 리소스에서 읽은 버전:

  | DLL | 버전 |
  |---|---|
  | GodotSharp | 4.5.1 (`4.5.1+f62fdbde…`) |
  | Godot.SourceGenerators | 4.5.1 |
  | 0Harmony | 2.4.2.0 (`+bceca21e…`) |
  | MonoMod.Backports | 1.1.2 |
  | MonoMod.ILHelpers | 1.1.0 |
  | Sentry | 6.7.0 |
  | Sentry.Godot | 1.0.0 |
  | SmartFormat | 3.3.0 |
  | Steamworks.NET | 1.0.0 |
  | SharpGen.Runtime / .COM | 2.2.0-beta |
  | Vortice.DirectX / DXGI | 3.6.2 |
  | Vortice.Mathematics | 1.9.2 |
  | JetBrains.Annotations | 2023.3.0 |

  `sts2.dll`의 버전은 `0.1.0+41cef1ea…`다. — [sts2.deps.json](file:///Users/flavono123/Library/Application%20Support/Steam/steamapps/common/Slay%20the%20Spire%202/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/sts2.deps.json)
- `sts2.dll`의 CLI 헤더는 CorFlags `ILONLY`, ManagedNativeHeader `(0,0)`이다. ReadyToRun 사전 컴파일이 없는 순수 IL이고 JIT로 실행된다. XML 문서 주석 파일 `sts2.xml`도 함께 배포된다. — [data_sts2_macos_arm64/](file:///Users/flavono123/Library/Application%20Support/Steam/steamapps/common/Slay%20the%20Spire%202/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/)
- 네이티브 프레임워크: `libspine_godot.macos.template_release.framework`(Spine GDExtension), `libGodotFmod.macos.template_release.framework` + `libfmod*.dylib`(FMOD 오디오), `libsentry*`. — [Contents/Frameworks](file:///Users/flavono123/Library/Application%20Support/Steam/steamapps/common/Slay%20the%20Spire%202/SlayTheSpire2.app/Contents/Frameworks)
- PCK 안의 Spine 스켈레톤(`.godot/imported/*.spskel`, 164개)에는 `4.2.x` 버전 문자열이 박혀 있다. 즉 Spine 4.2 런타임이다. C# 쪽은 `MegaCrit.Sts2.Core.Bindings.MegaSpine.MegaSprite`가 `"SpineSprite"` GDExtension 클래스를 `Call("get_animation_state")` 같은 문자열 호출로 감싼다. — [MegaSprite.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Bindings.MegaSpine/MegaSprite.cs)
- 프로젝트 설정 값: 기준 뷰포트 너비 1920, `display/window/stretch/mode = canvas_items`. — [PCK res://project.binary](res://project.binary)

### Inferences
- Harmony를 게임이 직접 싣고 있고 IL도 JIT 대상이라, 보통의 BepInEx식 주입 없이 공식 모드 로더(Q6)만으로 Harmony 패치를 걸 수 있다.
- Spine 애니메이션 초상화를 만들려면 **Spine 4.2**로 익스포트해야 하고, 런타임 생성은 `ClassDB.Instantiate("SpineSprite")`나 게임의 `MegaSprite` 래퍼를 써야 한다(GodotSharp에는 Spine 타입 바인딩이 없다).

### Gaps
- 렌더러(Forward+/Mobile/Compatibility) 설정 키가 `project.binary`에서 보이지 않았다. 기본값일 가능성이 높지만 확인하지 못했다.
- `m.14` 커스텀 엔진 패치가 업스트림 4.5.1과 무엇이 다른지는 알 수 없다.

## Q2. 카드를 그리는 클래스·씬, 초상화 노드와 텍스처 로딩, 마스크·셰이더, z-order

### Takeaway
모든 카드 UI는 풀링되는 `NCard`(`res://scenes/cards/card.tscn`) 하나로 그려진다. 초상화는 `CardContainer/PortraitCanvasGroup/Portrait`에 있는 **`TextureRect`(250×190)** 이고, 텍스처는 TexturePacker 아틀라스의 `AtlasTexture`다. 일반 카드의 초상화에는 **클립·마스크가 없다**. 프레임 계열 텍스처(`PortraitBorder`, `Frame`)가 위에 덮여 가장자리를 숨길 뿐이다. 마스크 셰이더는 고대(Ancient) 카드에만 쓰인다. 게임에는 카드 내부 VFX 전용 슬롯 `%CardVfxContainer`와 카드별 오버레이 슬롯 `%OverlayContainer`가 이미 있다.

### Cited Findings
- **`NCard`**(`MegaCrit.Sts2.Core.Nodes.Cards.NCard`)의 주요 필드: `_portrait`·`_ancientPortrait`·`_frame`·`_portraitBorder`·`_banner`(TextureRect), `_portraitCanvasGroup`(CanvasGroup), `_rareGlow`(NCardRareGlow), `_uncommonGlow`, `_sparkles`(GpuParticles2D), `_overlayContainer`, `_cardVfxContainer`. 공개 접근자는 `Body`(=`%CardContainer`), `CardHighlight`, `OverlayContainer`, `CardVfxContainer`, `Model`, `Visibility`, `DisplayingPile`, `PlayPileTween`이다. — [NCard.cs:506-662](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards/NCard.cs)
- 풀링: `NCard.InitPool()` → `NodePool.Init<NCard>("res://scenes/cards/card.tscn", 30)`. `NCard.Create(CardModel, ModelVisibility)`는 `NodePool.Get<NCard>()`으로 꺼낸다. 풀에 반환할 때는 `NodePool.Free`가 `DisconnectIncomingAndOutgoingSignals(obj)`를 호출한 뒤 `OnFreedToPool()`을 부른다. — [NCard.cs:767-791](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards/NCard.cs); [NodePool.cs:113-134](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Pooling/NodePool.cs)
- `card.tscn` 노드 순서(뒤에 올수록 위에 그려짐): `Card(Control, NCard.cs)` › `CardContainer` › `Shadow` › `Highlight`(NCardHighlight, `card_ripple.gdshader`) › **`PortraitCanvasGroup`(CanvasGroup)** › `Portrait`, `AncientPortrait` › `AncientBorderGlassOverlay` › `AncientBorder` › `AncientTextBg` › `Lock` › `Frame` › `DescriptionLabel` › `PortraitBorder` › **`OverlayContainer`** › `TitleBanner` › `AncientBanner/Fire`(AnimatedSprite2D) › `TitleLabel` › `TypePlaque/TypeLabel` › **`CardVfxContainer`** › `EnergyIcon` › `StarIcon` › `Enchantment` › `EnchantmentVfxOverride` › `CardSparkles`(`card_sparkles_vfx.tscn` 인스턴스). — [PCK res://scenes/cards/card.tscn](res://scenes/cards/card.tscn)
- 기하(카드 원점 = 카드 중심):
  - `Portrait`: offset (-125,-168)~(125,22) → 250×190, `expand_mode=2`, `stretch_mode=5`
  - `PortraitBorder`: (-137.5,-164)~(137.5,46)
  - `Frame`: (-150,-211)~(150,211) → 300×422
  - `AncientPortrait`: (-153,-215) 기준 598×842, scale 0.5

  어느 노드에도 `clip_contents`는 없다. — [PCK res://scenes/cards/card.tscn](res://scenes/cards/card.tscn)
- 아틀라스 스프라이트 크기도 250×190이다(예: `ironclad/bash.png`, region (2017,2875,250,190), `card_atlas_0.png`). `card_atlas.tpsheet`는 2페이지(4032×4070, 3780×4032)에 스프라이트 626개를 담고 있다. — [PCK res://images/atlases/card_atlas.tpsheet](res://images/atlases/card_atlas.tpsheet)
- 텍스처 로딩 경로:
  - `CardModel.PortraitPath` = `ImageHelper.GetImagePath($"atlases/card_atlas.sprites/{pool}/{id}.tres")`
  - `Portrait => ResourceLoader.Load<Texture2D>(PortraitPath, null, CacheMode.Reuse)`
  - `NCard.UpdatePortrait()`는 `_portrait.Texture = Model.Portrait`, `_portraitBorder.Texture = Model.PortraitBorder`, `_frame.Texture = Model.Frame`, `_banner.Material = Model.BannerMaterial`을 설정한다.

  — [CardModel.cs:143-157](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models/CardModel.cs); [NCard.cs:1244-1266](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards/NCard.cs)
- `.sprites/` 경로는 실제 `.tres` 파일이 아니라 커스텀 `AtlasResourceLoader : ResourceFormatLoader`가 가로챈다. 이 로더는 `OneTimeInitialization.ExecuteEssential()`에서 `ResourceLoader.AddResourceFormatLoader(_, atFront: true)`로 등록되고, `AtlasManager`가 `.tpsheet`를 파싱해 `AtlasTexture`를 만든다. — [AtlasResourceLoader.cs:181-218](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Assets/AtlasResourceLoader.cs); [OneTimeInitialization.cs:68-80](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Helpers/OneTimeInitialization.cs)
- 머티리얼과 셰이더 (`NCard.Reload()` 기준):
  - **보이는 일반 카드**: `_portraitCanvasGroup.Material = null`, `_portrait.Material = null`. 초상화 셰이더가 없다.
  - **보이는 고대 카드**: CanvasGroup에 `card_canvas_group_mask_material.tres`를 건다. 셰이더 `canvas_group_mask_blur.gdshader`, 마스크 `ancient_portrait_mask_large`, region (615,1151,600,847).
  - **미발견·잠김 카드**: blur 머티리얼(`card_portrait_blur_material.tres` 등)을 건다.
  - 프레임: `_frame.Material = Model.FrameMaterial`(캐릭터별 `materials/cards/frames/card_frame_*_mat.tres`, `hsv.gdshader`)
  - 배너·초상화 테두리: 희귀도별 `materials/cards/banners/card_banner_{rarity}_mat.tres`(`hsv.gdshader`)

  — [NCard.cs:1174-1242](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards/NCard.cs); [CardModel.cs:273-287](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models/CardModel.cs); [PCK res://scenes/cards/card_canvas_group_mask_material.tres](res://scenes/cards/card_canvas_group_mask_material.tres)
- `canvas_group_mask_blur.gdshader`는 내용물 크기를 상수 `const vec2 size = vec2(598, 842);`로 가정한다. 회전 보정도 이 크기를 기준으로 한다. — [PCK res://shaders/blur/canvas_group_mask_blur.gdshader](res://shaders/blur/canvas_group_mask_blur.gdshader)
- 카드별 오버레이 메커니즘: `NCard.ReloadOverlay()`는 `Model.Affliction?.HasOverlay`이면 `Affliction.CreateOverlay()`를, 아니면 `Model.HasBuiltInOverlay`일 때 `Model.CreateOverlay()`를 `OverlayContainer`에 붙인다.
  - `CardModel.HasBuiltInOverlay => false`(virtual), `OverlayPath => SceneHelper.GetScenePath("cards/overlays/" + id)`
  - 기본 게임에서 `HasBuiltInOverlay`를 true로 재정의하는 카드는 `Infection`뿐이다.

  — [NCard.cs:1354-1383](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards/NCard.cs); [CardModel.cs:883-885,1183](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models/CardModel.cs); [Infection.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models.Cards/Infection.cs)
- `CardVfxContainer`는 게임이 실제로 카드 내부 VFX 부착점으로 쓴다(`NCardTransformShineVfx`, `NCardExhaustQuickVfx`). 반면 `OnFreedToPool()`은 rare/uncommon glow, overlay, `_flashVfx`만 정리하고 `CardVfxContainer`의 자식은 정리하지 않는다. — [NCardTransformShineVfx.cs:223](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Vfx.Cards/NCardTransformShineVfx.cs); [NCardExhaustQuickVfx.cs:98](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Vfx.Cards/NCardExhaustQuickVfx.cs); [NCard.cs:1506-1530](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards/NCard.cs)
- 씬 수준 z-order에는 CanvasLayer가 없다(디버그 씬 2개만 예외). 순서는 Control 트리 순서와 `z_index`로 정해진다.
  - `combat_room.tscn`: `CombatSceneContainer(BgContainer, BackCombatVfxContainer, AllyContainer, EnemyContainer)` › `CombatVfxContainer` › `RadialBlur(BackBufferCopy)` › `CombatUi(z_as_relative=false)` › `ProceedButton`
  - `combat_ui.tscn`: `… Hand › PlayQueue › PlayContainer`
  - `run.tscn`: `RoomContainer` 다음에 `GlobalUi(z_as_relative=false)`(오버레이 화면·맵 등)
  - `game.tscn`: `HoverTipsContainer(z_as_relative=false)`, `ModalContainer`, `GameTransitionRect`가 위쪽에 있다.

  — [PCK res://scenes/rooms/combat_room.tscn](res://scenes/rooms/combat_room.tscn); [PCK res://scenes/combat/combat_ui.tscn](res://scenes/combat/combat_ui.tscn); [PCK res://scenes/run.tscn](res://scenes/run.tscn); [PCK res://scenes/game.tscn](res://scenes/game.tscn)
- 손패에서 hover된 홀더는 `NHandCardHolder.DoCardHoverEffects`가 `base.ZIndex = isHovered ? 1 : 0`으로 이웃 카드 위로 올린다. — [NHandCardHolder.cs:440-451](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards.Holders/NHandCardHolder.cs)

### Inferences
- **틀 안 애니메이션**을 하려면 모드가 직접 클리핑해야 한다. 가장 간단한 방법은 `ClipContents=true`인 250×190 `Control`을 `%Portrait`(TextureRect)의 자식으로 붙이는 것이다. 이렇게 하면 `Portrait.Visible`(고대 카드면 false)·transform·modulate를 그대로 상속하고, 그 위의 `PortraitBorder`/`Frame`이 원래처럼 가장자리를 덮는다.
- **고대 카드**는 `PortraitCanvasGroup`의 마스크 셰이더가 598×842 크기를 하드코딩하고 있다. 그룹 경계를 넓히는 자식(틀 밖으로 튀어나오는 요소)을 CanvasGroup 안에 넣으면 마스크 UV가 어긋난다. 틀 밖 요소는 CanvasGroup 바깥, 예컨대 `CardVfxContainer`에 두어야 한다.
- `OverlayContainer`는 `PortraitBorder`·`Frame`·설명 텍스트 위에 그려진다. 그대로 쓰면 텍스트를 가릴 수 있으니 오버레이 씬 쪽에서 자체 클립이 필요하다.
- PCK의 `images/atlases/card_atlas.sprites/*.tres`를 모드 PCK로 덮어써도 효과가 없을 것으로 보인다. `AtlasResourceLoader`가 앞단에서 경로를 가로채 `.tpsheet` 기반으로 직접 텍스처를 만들기 때문이다.

### Gaps
- 런타임에서 실제로 `PortraitCanvasGroup`이 매 프레임 오프스크린 렌더 비용을 얼마나 쓰는지(손패 10장 기준)는 측정하지 못했다(게임을 실행하지 않음).
- `card_sparkles_vfx.tscn`, `rare_glow_vfx`, `uncommon_glow_vfx` 씬의 세부 파라미터는 열어보지 않았다.

## Q3. 카드 상태 전이와 순수 연출용 Harmony 훅 지점

### Takeaway
hover → 집기(drag) → 타게팅 → 사용(플레이 영역 이동 → 효과 → 버림·소멸) 각 단계마다 **UI 계층에 공개 또는 private 메서드와 Godot 시그널이 있다.** 게임 상태 경로(`CardModel.OnPlayWrapper`, `Hook.*`, `CardPileCmd`)를 건드리지 않고 이 UI 쪽 메서드에 postfix만 걸면 연출 트리거를 모두 얻을 수 있다.

### Cited Findings
- **모든 카드 공통(보상·상점·덱·도감·인스펙트 포함)**:
  - `NCard.Model` setter → `Reload()`(private)
  - `NCardHolder.ReassignToCard(...)` → `UpdateVisuals(PileType, CardPreviewMode)`(public, hover·타깃 변경마다 자주 호출됨) → `UpdatePortrait()`(private)
  - 풀 수명주기: `OnReturnedFromPool()`(값 초기화, `_portrait.Material=null` 등), `OnFreedToPool()`(`_portrait.Texture=null`, Tween kill)

  — [NCard.cs:645-662,861-903,1174,1476-1530](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards/NCard.cs); [NCardHolder.cs:363-370](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards.Holders/NCardHolder.cs)
- **Hover (공통 홀더)**: 경로는 `NCardHolder.ConnectSignals()`(Control `FocusEntered/Exited`, `%Hitbox`의 `NClickableControl.Focused/Unfocused`) → `OnFocus()/OnUnfocus()`(virtual) → `RefreshFocusState()`(protected, non-virtual) → `DoCardHoverEffects(bool)`(virtual)다.
  - 기본 동작: hover 시 `Scale = HoverScale`(1.0)과 hover tip, 해제 시 `smallScale`(0.8)로 0.5초 Tween
  - `NGridCardHolder.OnFocus`는 `base.OnFocus()` 후 `MoveToFrontSafely()`를 호출한다.
  - `NPreviewCardHolder.OnFocus`는 base를 호출하지 않고 직접 1.1배로 키운다.

  — [NCardHolder.cs:212-230,293-470](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards.Holders/NCardHolder.cs); [NGridCardHolder.cs:225-229](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards.Holders/NGridCardHolder.cs); [NPreviewCardHolder.cs:112,161-194](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards.Holders/NPreviewCardHolder.cs)
- **손패 hover**: `NHandCardHolder.OnFocus()`가 시그널 `HolderFocused`를 emit하고 base를 호출한다. 이어서 `NPlayerHand.OnHolderFocused(holder)`(private)가 `FocusedHolder`를 설정하고, `RunManager.Instance.HoveredModelTracker.OnLocalCardHovered(...)`를 부른 뒤 `RefreshLayout()`을 실행한다. `RefreshLayout`은 포커스 카드를 각도 0·scale 1로 위로 올리고, 이웃 카드는 최대 100px 옆으로 민다. — [NHandCardHolder.cs:415-451](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards.Holders/NHandCardHolder.cs); [NPlayerHand.cs:730-747,806-872](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Combat/NPlayerHand.cs)
- `HoveredModelTracker`는 문서 주석상 "PeerInputSynchronizer와 함께 플레이어 머리 위 의도 표시를 동기화"하는 클래스다. 즉 hover/선택 상태는 **멀티플레이 피어에게 전송된다**. — [HoveredModelTracker.cs:1-30,90-125](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Multiplayer.Game.PeerInput/HoveredModelTracker.cs)
- **집기·드래그**: `NPlayerHand.StartCardPlay(NHandCardHolder holder, bool startedViaShortcut)`(private)가 다음을 순서대로 처리한다.
  1. 홀더를 `NPlayerHand`로 reparent
  2. `holder.BeginDrag()`(각도 0, `HoverScale`)
  3. `NMouseCardPlay.Create(...)` 또는 `NControllerCardPlay.Create(holder)` 생성
  4. `NCardPlay.Finished(bool success)` 시그널 연결
  5. `HoveredModelTracker.OnLocalCardSelected(...)` 호출

  취소는 `NHandCardHolder.CancelDrag()`로 처리된다. — [NPlayerHand.cs:1135-1157](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Combat/NPlayerHand.cs); [NHandCardHolder.cs:643-655](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards.Holders/NHandCardHolder.cs)
- **타게팅**: `NMouseCardPlay.StartAsync()` 흐름은 다음과 같다.
  1. `StartCardDrag()`: 매 프레임 `LerpToMouse`, 플레이 존 진입까지
  2. `CardNode.CardHighlight.AnimFlash()`
  3. `TargetSelection`
     - 단일 대상: `SingleCreatureTargeting`이 `CenterCard()`(scale 0.75)를 호출하고 `NTargetManager.StartTargeting(...)`을 시작한다. `NTargetManager`는 `CreatureHovered/CreatureUnhovered/TargetingBegan/TargetingEnded` 시그널을 낸다.
     - 다중 대상: `MultiCreatureTargeting`
  4. `TryPlayCard(target)`

  — [NMouseCardPlay.cs:263-460](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Combat/NMouseCardPlay.cs); [NCardPlay.cs:186-330](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Combat/NCardPlay.cs); [NTargetManager.cs:30-45](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Combat/NTargetManager.cs)
- **사용 확정(로컬)**: `NCardPlay.TryPlayCard` → `CardModel.TryManualPlay(Creature? target)`(public bool) → `EnqueueManualPlay`(private). 여기서 `TaskHelper.RunSafely(OnEnqueuePlayVfx(target))`로 연출을 fire-and-forget으로 띄우고, `RunManager.Instance.ActionQueueSynchronizer.RequestEnqueue(new PlayCardAction(this, target))`로 게임 액션을 큐에 넣는다. 그 뒤 `NCardPlay.Cleanup(true)`가 `Finished`를 emit한다. — [CardModel.cs:1787-1800](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models/CardModel.cs); [NCardPlay.cs:193-286](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Combat/NCardPlay.cs)
- **플레이 실행(모든 클라이언트)**: `PlayCardAction`이 `CardModel.OnPlayWrapper(...)`를 호출한다. `CardPileCmd.AddDuringManualCardPlay(card)`가 카드 노드를 찾고(원격 플레이어 카드면 `CreateCardNodeAndUpdateVisuals`가 그 플레이어의 `IntentContainer` 위치에 새 `NCard` 생성), `MoveCardNodeToNewPileBeforeTween`으로 `Ui.PlayContainer`에 붙인다. 이어 위치 Tween(0.25초 / Fast 0.1초 / Instant 0.01초)과 scale 0.8 Tween을 걸고 콜백 `NCombatRoom.Instance.Ui.AddToPlayContainer(cardNode)`를 실행한다.
  - 반복 사용 시 `NCard.AnimMultiCardPlay()`
  - 파워 카드는 `PlayPowerCardFlyVfx()`(`NCardFlyPowerVfx`)
  - 그다음 `OnPlay`, 버림·소멸(`CardPileCmd.Add`/`CardCmd.Exhaust`/`RemoveFromCombat`)
  - 마지막에 `this.Played?.Invoke()`

  — [CardModel.cs:1858-2000](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models/CardModel.cs); [CardPileCmd.cs:827-960](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Commands/CardPileCmd.cs); [NCombatUi.cs:346-355](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Combat/NCombatUi.cs); [PlayCardAction.cs:18](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.GameActions/PlayCardAction.cs)
- 버림 더미로 날아가는 연출은 `NCardFlyVfx.Create(cardNode, …, card.Owner.Character.TrailPath)`이다. 소멸 연출인 `NCardExhaustVfx.Create(NCard)`는 카드 노드를 자기 `_cardParentContainer`로 **reparent**한 뒤 침식(erosion) 셰이더로 녹인다. — [CardCmd.cs:850](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Commands/CardCmd.cs); [NCardExhaustVfx.cs:135-163](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Vfx.Cards/NCardExhaustVfx.cs)
- **카드 보상 화면**: `NCardRewardSelectionScreen.RefreshOptions(...)`(public)와 `NChooseACardSelectionScreen`이 `nCard.ActivateRewardScreenGlow()`를 호출한다. 레어는 `_sparkles.Visible=true`와 `NCardRareGlow`, 언커먼은 `NCardUncommonGlow`이고 `CardHighlight.Modulate` 색이 바뀐다. 정리는 `KillRarityGlow()`. — [NCardRewardSelectionScreen.cs:265-330](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Screens.CardSelection/NCardRewardSelectionScreen.cs); [NCard.cs:1402-1440](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards/NCard.cs)
- **상점**: `NMerchantCard.FillSlot(MerchantCardEntry)`, `UpdateVisual()`, `OnPreview()`, `OnInventoryOpened()`. **덱 보기·더미 보기**: `NDeckViewScreen`/`NCardsViewScreen`가 `NCardGrid.SetCards(...)`와 `NGridCardHolder`를 쓰고, 클릭하면 `ShowCardDetail` → `NInspectCardScreen.Open(List<CardModel>, int, bool)`이 열린다(자체 `NCard` 자식 "Card"를 1.75배로 표시). **도감**: `NCardLibrary.DisplayCards()`, `ShowCardDetail(NCardHolder)`. — [NMerchantCard.cs:119-220](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Screens.Shops/NMerchantCard.cs); [NCardGrid.cs:832](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards/NCardGrid.cs); [NInspectCardScreen.cs:181,226-262,399](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Screens/NInspectCardScreen.cs); [NCardLibrary.cs:805,1019](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Screens.CardLibrary/NCardLibrary.cs)

### Inferences
- 연출 전용 훅 후보(모두 UI 계층, 결과값을 바꾸지 않는 Postfix):

  | 이벤트 | 훅 |
  |---|---|
  | 부착·갱신 | `NCard.Reload()`(private) postfix. 모든 화면 공통, 모델 변경 시에만 호출되어 `UpdateVisuals`보다 가볍다 |
  | 정리 | `NCard.OnFreedToPool()` / `OnReturnedFromPool()` postfix |
  | hover | `NCardHolder.RefreshFocusState()` postfix(손패·그리드·보상 공통, `_isFocused`는 AccessTools로 읽음) + `NPreviewCardHolder.OnFocus/OnUnfocus` postfix |
  | 집기 | `NHandCardHolder.BeginDrag()` / `CancelDrag()` postfix, 또는 `NPlayerHand.StartCardPlay` postfix |
  | 놓기 결과 | `NMouseCardPlay.Create`·`NControllerCardPlay.Create` postfix에서 반환된 노드의 `Finished` 시그널에 연결 |
  | 대상 hover | `NTargetManager.CreatureHovered/Unhovered` 시그널 구독 |
  | 로컬 사용 확정 | `CardModel.TryManualPlay` postfix(`__result == true`일 때). 게임 자체의 `OnEnqueuePlayVfx` 호출 시점과 같다 |
  | 플레이 영역 도착(원격 포함) | `NCombatUi.AddToPlayContainer(NCard)` postfix |
  | 보상 강조 | `NCard.ActivateRewardScreenGlow()` / `KillRarityGlow()` postfix |
  | 인스펙트 | `NInspectCardScreen.Open` / `SetCard` postfix |

- 피해야 할 훅:
  - `CardModel.OnPlayWrapper`/`OnPlay`, `Hook.BeforeCardPlayed/AfterCardPlayed`, `CardPileCmd.*`: 게임 흐름이 await하는 async 경로다. Harmony postfix는 첫 await 시점에 실행되며, 예외가 나면 게임 진행이 깨진다.
  - `HoveredModelTracker.*` 호출: 네트워크 동기화 대상이다.
- 풀 반환 시 시그널이 모두 끊기므로, 모드가 NCard·홀더에 연결한 시그널은 `Reload` postfix에서 매번 다시 연결해야 한다.
- 소멸 연출은 카드를 reparent하므로 카드 자식(`%Portrait` 아래나 `CardVfxContainer`)으로 붙인 데코레이터는 함께 녹는다(자연스럽다). 반면 다른 컨테이너에 띄운 틀 밖 요소는 직접 정리해야 한다.

### Gaps
- 컨트롤러 경로(`NControllerCardPlay`)의 세부 단계는 읽지 않았다(구조는 `NCardPlay` 공통).
- `NCardGrid`가 도감처럼 큰 목록에서 홀더를 가상화(재사용)하는지는 확인하지 못했다. 성능 판단에 필요하다.

## Q4. 카드 사용 VFX 시스템과 무대·크리처 위치 얻기

### Takeaway
VFX는 대부분 `VfxCmd`의 정적 헬퍼가 **씬(`res://scenes/vfx/...`)을 Instantiate한 `Node2D`를 전투방의 `CombatVfxContainer`(크리처 앞, UI 뒤) 또는 `BackCombatVfxContainer`(크리처 뒤)에 붙이고 `GlobalPosition`만 지정하는 방식**이다. 카드별 연출 훅으로는 `CardModel.OnEnqueuePlayVfx(Creature?)`(virtual)가 있지만 오버라이드한 카드는 4장뿐이다. 크리처 좌표는 `NCombatRoom.Instance.CreatureNodes`에서 바로 읽을 수 있다.

### Cited Findings
- `VfxCmd`:
  - 경로 상수: `slashPath = "vfx/vfx_attack_slash"`, `bluntPath`, `lightningPath`, `healPath` 등
  - `PlayVfx(Vector2 position, string path, Control? vfxContainer)`: `PreloadManager.Cache.GetScene(SceneHelper.GetScenePath(path)).Instantiate<Node2D>()` → `vfxContainer.AddChildSafely(node2D)` → `node2D.GlobalPosition = position`
  - `PlayOnCreatureCenter`는 `creatureNode.VfxSpawnPosition`, `PlayOnCreature`는 `creatureNode.GlobalPosition`을 쓴다.
  - `GetSideCenter(CombatSide, ICombatState)`, `PlayFullScreenInCombat`(뷰포트 중앙)

  — [VfxCmd.cs:19-267](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Commands/VfxCmd.cs)
- `Creature.GetVfxContainer()`는 전투 중이면 `NCombatRoom.Instance.CombatVfxContainer`를, 도감(`NBestiary`)이면 `NBestiary.Instance.VfxContainer`를 반환한다. `GetBackVfxContainer()`는 `BackCombatVfxContainer`를 반환한다. — [Creature.cs:790-823](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Entities.Creatures/Creature.cs)
- `NCombatRoom`(`NRun.Instance?.CombatRoom`)의 공개 API: `Ui`(NCombatUi), `CreatureNodes`, `GetCreatureNode(Creature?)`, `SceneContainer`, `BackCombatVfxContainer`, `CombatVfxContainer`, `LastTargetedCreature`, `RadialBlur(VfxPosition)`, `PlaySplashVfx`. — [NCombatRoom.cs:268-924](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Rooms/NCombatRoom.cs)
- `NCreature`의 공개 API: `Entity`(Creature), `VfxSpawnPosition => Visuals.VfxSpawnPosition.GlobalPosition`, `PowerAppliedVfxSpawnPosition`(+(0,-200)), `Hitbox`(Control), `Visuals`(NCreatureVisuals), `Body => Visuals.GetCurrentBody()`(Node2D, Spine), `IntentContainer`, `SpineAnimation`, `IsPlayingDeathAnimation`. — [NCreature.cs:409-443](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Combat/NCreature.cs)
- `CardModel.OnEnqueuePlayVfx(Creature? target)`는 기본값 `Task.CompletedTask`(virtual)다. 오버라이드는 `Inflame`, `Hellraiser`, `FanOfKnives`, `Pyre` 4개뿐이다.
  - 예: `Inflame`은 `CombatVfxContainer.AddChildSafely(NGroundFireVfx.Create(Owner.Creature))` 후 `CreatureCmd.TriggerAnim(Owner.Creature, "PowerUp", …)`를 호출한다.
  - 카드 전용 VFX 씬은 `scenes/vfx/cards/`에 있다: `bolas_vfx`, `nightmare_hands_vfx`, `vfx_hellraiser/*`.

  — [CardModel.cs:1656-1659](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models/CardModel.cs); [Inflame.cs:35-39](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models.Cards/Inflame.cs); [Hellraiser.cs:28-32](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models.Cards/Hellraiser.cs); [PCK res://scenes/vfx/cards/](res://scenes/vfx/cards/)
- `CreatureCmd.TriggerAnim`은 크리처 노드를 찾아 Spine 트리거를 재생하고, 플레이어면 `SfxCmd.Play(character.AttackSfx/CastSfx)`도 함께 재생한다. — [CreatureCmd.cs:967-992](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Commands/CreatureCmd.cs)
- `AssetCache.GetAsset`은 프리로드 캐시에 없으면 `ResourceLoader.Load`로 동기 로드한다. 전투 인카운터는 필요한 오버레이 씬을 `ExtraAssetPaths`로 미리 로드한다(예: `PhrogParasiteElite` → `Infection.OverlayPath`). — [AssetCache.cs:23-51](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Assets/AssetCache.cs); [PhrogParasiteElite.cs:26](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models.Encounters/PhrogParasiteElite.cs)
- 시각 전용 난수는 `Rng.Chaotic`(현재 시각으로 시드)다. 예: `NCardRareGlow._Ready`의 `Rng.Chaotic.NextDouble(0.0, 0.2)`. — [Rng.cs:25](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Random/Rng.cs); [NCardRareGlow.cs:75-84](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Vfx.Cards/NCardRareGlow.cs)
- `NHitStop.SetTimeScale`은 `Engine.SetTimeScale(timeScale)`(최소 0.1)로 엔진 전체 시간을 늦춘다. 화면 흔들림 배수는 `NGame`이 `ScreenShakeOptionIndex`로 설정한다. — [NHitStop.cs:57-92](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Vfx.Utilities/NHitStop.cs); [NGame.cs:689](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes/NGame.cs)

### Inferences
- 무대 상호작용은 게임과 같은 패턴을 따르면 된다. `NCombatRoom.Instance.CombatVfxContainer`(크리처 앞) 또는 `BackCombatVfxContainer`(뒤)에 모드 씬을 붙이고, `NCreature.VfxSpawnPosition`/`Hitbox.GetGlobalRect()`로 좌표를 잡는다. 대상은 `card.CurrentTarget`(플레이 중), `NCombatRoom.Instance.LastTargetedCreature`, `NTargetManager.CreatureHovered` 인자에서 얻는다.
- `OnEnqueuePlayVfx`는 오버라이드 카드가 base를 호출하지 않으므로 base 메서드를 패치해도 4장은 빠진다. **`CardModel.TryManualPlay` postfix**가 같은 시점을 더 일관되게 잡는다. 다만 이 경로는 로컬 플레이어의 수동 사용만 잡는다. 원격·자동 사용은 `NCombatUi.AddToPlayContainer` postfix로 보완한다.
- `CreatureCmd.TriggerAnim`, `NHitStop`, 화면 흔들림 호출은 "순수 데코레이터" 원칙과 충돌한다. 사운드가 나고, 크리처 애니메이션 상태와 엔진 시간 배속이 바뀐다. 오버레이만 쓰는 것이 안전하다.
- 모드 씬은 전투방 프리로드 목록에 없어 처음 쓸 때 동기 로드 끊김(hitch)이 생길 수 있다. 전투 시작 시 모드가 직접 `ResourceLoader.LoadThreadedRequest`로 미리 데우는 것이 바람직하다(추론).

### Gaps
- `NCreatureVisuals.VfxSpawnPosition`이 크리처별로 어디(몸통 중심 등)에 놓이는지 씬별로 확인하지 않았다.
- 멀티플레이에서 원격 플레이어 카드 노드의 실제 화면 경로(`IntentContainer` → 플레이 영역)는 코드로만 확인했다.

## Q5. 기존 애니메이션 초상화·카드 위 Spine·카드별 셰이더·베타 아트 전환 메커니즘

### Takeaway
기본 게임에 **애니메이션 초상화는 없다.** 카드 위 Spine도 없다. 대신 카드에 얹히는 애니메이션 요소는 이미 있다: Infection의 31프레임 오버레이, 고통(affliction) 오버레이 셰이더 VFX, 고대 배너 불꽃, 보상 화면 희귀도 글로우·스파클. v0.111.0에는 **베타 아트를 켜고 끄는 토글이 없다.** 베타 PNG는 정식 아트가 빠졌을 때 쓰이는 로더 fallback일 뿐이다.

### Cited Findings
- `scenes/cards`, `scenes/vfx/ui/card` 아래 씬에서 `type="SpineSprite"`는 0건이다. Spine 스켈레톤은 크리처·VFX용이다. — [PCK res://scenes/cards/](res://scenes/cards/)
- `scenes/cards/overlays/infection.tscn`: `VisualLayer1/2`(Sprite2D) + `AnimationPlayer`(애니메이션 "infection", 2.0초 루프, `infection_00..29.png`를 텍스처 트랙으로 교체, autoplay) + `NPhobiaAnimationToggler`. 이 토글러는 `PrefsSave.PhobiaMode`가 켜지면 `AnimationPlayer.Active=false`로 만들고 `NGame.PhobiaModeToggled` 시그널을 구독한다. — [PCK res://scenes/cards/overlays/infection.tscn](res://scenes/cards/overlays/infection.tscn); [NPhobiaAnimationToggler.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Animation/NPhobiaAnimationToggler.cs)
- 고통 오버레이(`scenes/cards/overlays/afflictions/{bound,entangled,galvanized,hexed,ringing,smog,tainted}.tscn`)는 각각 `scenes/vfx/ui/card/afflictions/*/vfx_ui_card_affliction_*.tscn`을 인스턴스한다. 셰이더는 `shaders/vfx/ui/card/afflictions/*/…gdshader`다. `AfflictionModel.OverlayPath = "cards/overlays/afflictions/{id}"`. — [AfflictionModel.cs:62-64](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models/AfflictionModel.cs); [PCK res://scenes/vfx/ui/card/afflictions/](res://scenes/vfx/ui/card/afflictions/)
- 카드 씬에 내장된 애니메이션 요소:
  - `AncientBanner/Fire`(AnimatedSprite2D, `ancient_card_flame_0..9`, 10fps 루프)
  - `Highlight`(`card_ripple.gdshader` ShaderMaterial)
  - `EnchantmentVfxOverride`(`enchantment_tab_appear.gdshader`)
  - `CardSparkles`(GPUParticles2D, 보상 레어일 때만 표시)

  — [PCK res://scenes/cards/card.tscn](res://scenes/cards/card.tscn)
- `CardModel.BetaPortraitPath`(virtual), `HasBetaPortrait`, `BetaPortraitPngPath`, `MissingPortraitPath`는 정의되어 있지만, 디컴파일 전체에서 `BetaPortraitPath`를 **소비하는 곳이 없다**(`MadScience`의 override만 있음). `HasPortrait`/`HasBetaPortrait`도 외부 사용처가 없다. — [CardModel.cs:143-155](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models/CardModel.cs); [MadScience.cs:69-73](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models.Cards/MadScience.cs)
- 실제 베타 아트가 쓰이는 경로는 `AtlasResourceLoader.GetCardFallbackPath`다. 아틀라스에 스프라이트가 없으면 다음 순서로 시도한다.
  1. `res://images/packed/card_portraits/{sprite}.png`
  2. `…/{pool}/beta/{id}.png`
  3. 최종 `GetMissingTexture("card_atlas")` = `images/packed/card_portraits/beta.png`

  PCK에는 `images/packed/card_portraits/**.png` 910개(그중 `*/beta/*` 284개)가 있고, `card_atlas.tpsheet`의 626 스프라이트에는 `beta/` 항목이 0개다. — [AtlasResourceLoader.cs:321-370](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Assets/AtlasResourceLoader.cs); [PCK res://images/atlases/card_atlas.tpsheet](res://images/atlases/card_atlas.tpsheet)
- 개발 콘솔 `art <type>` 명령(`ArtConsoleCmd`)은 아트가 없는 카드·고통 등을 나열할 뿐 전환 기능은 없다. — [ArtConsoleCmd.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.DevConsole.ConsoleCommands/ArtConsoleCmd.cs)
- 업그레이드 단계별로 초상화가 바뀌는 카드는 `Wither`와 `MadScience`가 `PortraitPath`/`AllPortraitPaths`를 override해 구현한다. — [Wither.cs:17-26](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models.Cards/Wither.cs)

### Inferences
- 베타 아트처럼 "플래그를 켜면 다른 초상화가 나오는" 공식 메커니즘은 없다. 모드가 쓸 수 있는 선택지는 세 가지다.
  - **(a)** `CardModel.PortraitPath` getter postfix(override한 Wither·MadScience는 따로 처리). 텍스처만 바꾸므로 정적 교체에 적합하다.
  - **(b)** `NCard.UpdatePortrait` postfix에서 `_portrait.Texture`를 `AnimatedTexture`/`ViewportTexture`로 교체. 다만 `UpdatePortrait`는 `UpdateVisuals`마다 다시 호출되고 `OnFreedToPool`이 `Texture=null`로 지운다.
  - **(c)** 카드 노드에 자식 씬을 덧붙이기(권장).
- Infection 오버레이는 기존 리소스(텍스처 시퀀스 + AnimationPlayer + PhobiaMode 토글러)만으로 "카드 위 애니메이션"을 구현한 선례다. 모드 씬도 `NPhobiaAnimationToggler`를 그대로 재사용할 수 있다(스크립트 경로 `res://src/Core/Nodes/Animation/NPhobiaAnimationToggler.cs`).
- `HasBuiltInOverlay` getter를 패치하고 모드 PCK에 `scenes/cards/overlays/{id}.tscn`을 넣으면 게임의 기존 오버레이 경로로 붙일 수 있다. 다만 다음 제약이 있다.
  - 고통 오버레이가 우선이라 고통 상태에서는 사라진다. 고통 정보를 가리지 않으므로 오히려 올바른 동작이다.
  - `OverlayContainer`가 프레임·설명 위에 있어 별도 클립이 필요하다.
  - 모델 클래스 getter를 건드리는 것이라 "UI만 패치" 원칙에서 반 발짝 벗어난다(사용처는 `NCard.ReloadOverlay`뿐이라 실질 영향은 시각뿐).

### Gaps
- 다른 브랜치(public beta 등)에 베타 아트 토글이 생겼는지는 이 설치본으로 알 수 없다.

## Q6. 공식 모드 지원: 발견·로드 방식, PCK·C# 동봉 여부, 멀티플레이 모드 목록 검사

### Takeaway
게임에 **공식 모드 로더(`MegaCrit.Sts2.Core.Modding.ModManager`)** 가 있다. 실행 파일 옆 `mods/` 폴더(재귀 탐색)와 Steam Workshop에서 JSON 매니페스트를 찾아 `{id}.dll`과 `{id}.pck`를 로드하고, Harmony `PatchAll` 또는 `[ModInitializer]` 진입점을 실행한다. 멀티플레이는 **`affects_gameplay`가 true(기본값)인 모드만 양쪽 일치를 강제하고, false인 모드의 불일치는 경고만 남긴다.** 다만 모드가 하나라도 로드되면 세이브가 `modded/` 폴더로 분리되고, 지표 업로드·Sentry가 꺼지며, 개발 콘솔 명령이 열린다.

### Cited Findings
- 매니페스트(`ModManifest`) 필드:
  - `id`(필수), `name`, `author`, `description`, `version`
  - `has_pck`, `has_dll`
  - `dependencies`: `[{id, min_version}]`. 문자열 배열만 쓰는 옛 형식은 경고 후 변환한다.
  - **`affects_gameplay`(기본 `true`)**
  - `min_game_version`

  — [ModManifest.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Modding/ModManifest.cs)
- 발견 과정:
  - `ModManager.Initialize`는 `-nomods` 인자가 있으면 건너뛴다.
  - `Path.GetDirectoryName(OS.GetExecutablePath())` 기준 `mods`(`ModSource.ModsDirectory`)와 `mods_STEAMTEST`, 그리고 Steam Workshop 설치 폴더(`ReadSteamMods`, 설치 콜백 포함)를 읽는다.
  - `ReadModsInDirRecursive`는 폴더를 재귀로 돌며 **모든 `*.json`을 매니페스트로 시도**한다. `id`가 없으면 무시한다.
  - 이후 `CheckSteamBranchSupport` → `RemoveDisabledMods`(로컬·Workshop 중복 시 버전 비교) → `SortModList`(의존성 위상 정렬 + 사용자 순서) → `TryLoadMod` 순으로 진행한다.

  — [ModManager.cs:74-160,398-466](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Modding/ModManager.cs)
- 로드 과정:
  - DLL: `has_dll`이면 `{mod.path}/{id}.dll`을 `AssemblyLoadContext.GetLoadContext(Assembly.GetExecutingAssembly()).LoadFromAssemblyPath(...)`로 게임과 같은 ALC에 로드한다.
  - PCK: `has_pck`이면 `{id}.pck`를 `ProjectSettings.LoadResourcePack(text3)`로 로드한다.
  - 진입점: 어셈블리에 `[ModInitializer("Method")]` 타입이 있으면 그 static 메서드를 호출하고, 없으면 `new Harmony(author + "." + id).PatchAll(assembly)`.
  - `AppDomain.AssemblyResolve`는 `0Harmony,` 요청을 게임 동봉 Harmony로 해석한다.
  - 런타임 중 추가된 모드는 로드하지 않는다(`AddedAtRuntime`). 사용자가 경고 팝업에 동의(`PlayerAgreedToModLoading`)해야 로드된다.

  — [ModManager.cs:623-910,1017-1030](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Modding/ModManager.cs); [ModInitializerAttribute.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Modding/ModInitializerAttribute.cs); [ModLoadState.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Modding/ModLoadState.cs)
- GodotSharp 4.5.1의 시그니처는 `public static bool LoadResourcePack(string pack, bool replaceFiles = true, int offset = 0)`다. 게임은 인자 하나로 호출하므로 `replaceFiles=true`가 적용된다. — [GodotSharp.dll Godot.ProjectSettings (ilspycmd -t)](file:///Users/flavono123/Library/Application%20Support/Steam/steamapps/common/Slay%20the%20Spire%202/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/GodotSharp.dll)
- 모드 현지화 규약은 `res://{modId}/localization/{lang}/{file}`이다(`GetModdedLocTables`). 모드 모델 추가용 API로 `ModHelper.AddModelToPool<TPool,TModel>()`, `SubscribeForRunStateHooks`, `SubscribeForCombatStateHooks`가 있다. — [ModManager.cs:966-980](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Modding/ModManager.cs); [ModHelper.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Modding/ModHelper.cs)
- 초기화 시점: `OneTimeInitialization.ExecuteVeryEarly()`에서 `ModManager.Initialize(...)`를 호출한다. 이는 `AtlasResourceLoader` 등록, `LocManager.Initialize`, `AssemblyInfo.Init`, `ModelDb.Init`보다 **먼저**다. — [OneTimeInitialization.cs:43-85](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Helpers/OneTimeInitialization.cs)
- 멀티플레이 검사:
  - 핸드셰이크에서 `PeerVersionInfo`가 `version`, `idDatabaseHash`(ModelId 해시), `gameplayAffectingMods = GetGameplayRelevantModNameList()`(`affectsGameplay ?? true`인 `id-version` 목록), `otherMods`를 보낸다.
  - `HandshakeManager`의 판정:
    1. 버전 불일치 → `VersionMismatch`
    2. gameplay 모드 목록 차이 → **`ModMismatch`(접속 거부)**
    3. ID 해시 불일치 → `VersionMismatch`
    4. non-gameplay 모드 차이 → 경고 로그만: "This is allowed, but it's up to the mod authors to guarantee that it doesn't break anything."

  — [PeerVersionInfo.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Multiplayer/PeerVersionInfo.cs); [HandshakeManager.cs:95-135](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Multiplayer.Connection/HandshakeManager.cs); [ConnectionFailureExtraInfo.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Entities.Multiplayer/ConnectionFailureExtraInfo.cs)
- "모드 실행 중" 부수효과: `IsRunningModded()`는 상태가 Loaded 또는 Failed인 모드가 하나라도 있으면 true다(`affects_gameplay`와 무관). 그 결과는 다음과 같다.
  - `UserDataPathProvider.GetAccountDir()`가 `"modded"`를 반환해 프로필·진행도·런 세이브가 `modded/` 아래로 분리된다. 첫 모드 실행 때 `CopyUnmoddedSaveFilesIfNeeded`가 기존 세이브를 복사한다.
  - 지표 업로드를 건너뛴다(`"Skipping metrics upload, we're running modded."`).
  - `SentryService.DisableSentryIfModded()`가 실행된다.
  - 디버그 정보 라벨에 모드 경고가 표시된다.
  - `NDevConsole`의 `shouldAllowDebugCommands`가 `ModManager.IsRunningModded()`면 true가 된다.

  — [ModManager.cs:1075-1112](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Modding/ModManager.cs); [UserDataPathProvider.cs:41-47](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Saves/UserDataPathProvider.cs); [MetricUtilities.cs:104-107](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Runs.Metrics/MetricUtilities.cs); [NDevConsole.cs:359](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Debug/NDevConsole.cs)
- 커뮤니티 자료와의 대조: 커뮤니티 튜토리얼은 이 구조가 v0.103.3 기준이라고 밝히고 "Early Access updates can change signatures and loader contracts"라고 경고한다. 한 모드 설치 안내는 폴더 안의 모든 JSON이 매니페스트로 오인될 수 있다고 경고하는데, 이는 디컴파일 동작(`*.json` 전부 시도)과 일치한다. 퍼블릭 베타에서 모드 시스템을 재구성했다는 보도도 있다. — [fresh-milkshake/Modding-Tutorial](https://github.com/fresh-milkshake/Modding-Tutorial); [Nexus Mods STS2 mod 56](https://www.nexusmods.com/slaythespire2/mods/56); [EGW News](https://egw.news/gaming/news/33197/slay-the-spire-2-caps-hp-at-nearly-a-billion-crush-CCZa_ZVwO) (본문은 403으로 읽지 못함)

### Inferences
- 데코레이터 모드의 배포 형태는 다음과 같다: `mods/<폴더>/{id}.json` + `{id}.dll`(Harmony 패치) + `{id}.pck`(애니메이션 씬·텍스처·셰이더). 리소스는 `res://{id}/...` 아래에 두어 기본 파일을 덮어쓰지 않게 한다. `replaceFiles=true`라 같은 경로를 쓰면 원본이 가려진다.
- 멀티플레이를 막지 않으려면 매니페스트에 **`"affects_gameplay": false`를 반드시 명시**해야 한다. 기본값이 true라, 빠뜨리면 상대에게 같은 모드가 없을 때 접속이 거부된다. `AbstractModel` 서브타입(ModelDb 해시에 반영)이나 새 넷 메시지 타입은 정의하지 말아야 한다.
- 순수 데코레이터라도 "제거하면 아무것도 바뀌지 않는다"는 말에는 단서가 붙는다. 모드가 켜진 동안의 진행도는 `modded/` 세이브에 쌓이고 모드를 지우면 원래 세이브로 돌아간다. 사용자 안내가 필요하다.
- macOS에서 `mods` 폴더는 `SlayTheSpire2.app/Contents/MacOS/mods`(앱 번들 내부)로 계산된다(추론). Steam 업데이트나 코드서명 검증과의 상호작용은 확인하지 못했다.
- `[ModInitializer]`는 `NGame`·아틀라스·ModelDb가 준비되기 전에 실행된다. 초기화에서는 Harmony 패치 등록만 하고, 노드·리소스 작업은 패치된 메서드가 처음 호출될 때까지 미뤄야 한다.

### Gaps
- Steam Workshop 업로드 절차, 브랜치 지원 메타데이터(`CheckSteamBranchSupport`의 UGC 키 형식)는 자세히 보지 않았다.
- `NConfirmModLoadingPopup`, `NModdingScreen`의 UX는 읽지 않았다.
- 퍼블릭 베타 브랜치의 모드 시스템 변경 내용은 확인하지 못했다(기사 본문 접근 불가).

## Q7. 모드가 존중해야 할 기존 설정 (모션 감소·VFX 강도·빠른 모드 등)

### Takeaway
"모션 감소"나 "VFX 강도" 설정은 없다. 존중할 만한 설정은 **`FastMode`(None/Normal/Fast/Instant)**, **`PhobiaMode`**(변경 시 시그널 있음), **`ScreenShakeOptionIndex`**(0~4 → 0x~4x), **`TextEffectsEnabled`**, 그리고 그래픽 쪽 `FpsLimit`·`Msaa`다.

### Cited Findings
- `PrefsSave`:
  - `FastMode`(기본 `Normal`; enum `None, Normal, Fast, Instant`)
  - `PhobiaMode`
  - `ScreenShakeOptionIndex`(기본 2)
  - `ShowCardIndices`
  - `TextEffectsEnabled`(기본 true)
  - `ShowMultiplayerDrawings` 등

  — [PrefsSave.cs:18-54](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Saves/PrefsSave.cs); [FastModeType.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Settings/FastModeType.cs)
- `SettingsSave`: `FpsLimit`(기본 60), `VSync`, `Msaa`(기본 2), `ModSettings`. — [SettingsSave.cs:22-100](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Saves/SettingsSave.cs)
- 흔들림 배수: `NScreenshakePaginator.GetShakeMultiplier`는 0→0, 1→0.5, 2→1, 3→2, 4→4다. — [NScreenshakePaginator.cs:95-106](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Screens.Settings/NScreenshakePaginator.cs)
- 게임 연출이 FastMode를 반영하는 예:
  - 더미 이동 Tween: Instant 0.01초, Fast 0.1초, 기본 0.25초(`CardPileCmd.AppendPileLerpTween`)
  - `NCard.AnimMultiCardPlay`의 간격: Fast 0.1초, 그 외 0.2초

  — [CardPileCmd.cs:931-960](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Commands/CardPileCmd.cs); [NCard.cs:1442-1465](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards/NCard.cs)
- 설정 화면 노드 목록에 모션 감소·VFX 강도 항목은 없다. 있는 항목은 `NFastModeTickbox`, `NPhobiaModeTickbox`, `NScreenshakePaginator`, `NTextEffectsTickbox`, `NHandCardCountTickbox`, `NFpsPaginator`, `NMsaaPaginator`, `NBackgroundModeTickbox` 등이다. — [MegaCrit.Sts2.Core.Nodes.Screens.Settings/](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Screens.Settings/)
- 공포증 모드 변경은 `NGame.PhobiaModeToggled` 시그널로 전달된다. — [NGame.cs:68](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes/NGame.cs)

### Inferences
- 권장 매핑:

  | 설정 | 모드 동작 |
  |---|---|
  | `FastMode == Instant` | 틀 밖 연출 생략 |
  | `FastMode == Fast` | 재생 시간 단축 |
  | `PhobiaMode` | 생물·벌레·피 계열 애니메이션 정지 (`NPhobiaAnimationToggler` 재사용) |
  | `ScreenShakeOptionIndex == 0` | 화면·카드 흔들림 연출 금지 |
  | `TextEffectsEnabled == false` | 과한 반짝임 감소용 신호로 활용 |

- 게임 자체에 모션 감소 옵션이 없으므로, 모드 자체 설정이 필요하다(단계별 끄기·강도). 공식 모드 설정 UI API는 디컴파일에서 찾지 못했다.

### Gaps
- `NBackgroundModeTickbox`가 무엇을 제어하는지 확인하지 않았다(창 배경 동작으로 추정).

## Q8. 타당성 판정: 단계별 훅 방식, 위험, 순수 데코레이터 유지의 어려움

### Takeaway
세 단계 모두 **공식 로더 + Harmony postfix + 모드 PCK 씬**으로 구현할 수 있다.
- ① 틀 안 애니메이션: 위험이 낮다.
- ② 손패 위로 튀어나오기: 중간 위험(입력 가로채기·정렬·정리 문제).
- ③ 무대·크리처 상호작용: 중간~높은 위험. 게임 VFX와 겹치고, 정확히 무엇을 "상호작용"으로 볼지에 따라 순수성이 깨질 여지가 있다. 크리처 애니메이션 트리거, 히트스톱, 흔들림이 그 예다.

공통 최대 위험은 **Early Access 패치마다 private 메서드명과 씬 구조가 바뀔 수 있다**는 점이다.

### Cited Findings
- 훅 대상과 근거 위치는 Q2~Q4에 정리했다(`NCard.Reload`, `OnFreedToPool`, `NCardHolder.RefreshFocusState`, `NHandCardHolder.BeginDrag/CancelDrag`, `NCardPlay.Finished`, `CardModel.TryManualPlay`, `NCombatUi.AddToPlayContainer`, `NCombatRoom.CombatVfxContainer`, `NCreature.VfxSpawnPosition`). — [NCard.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards/NCard.cs); [NCardHolder.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards.Holders/NCardHolder.cs); [CardModel.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models/CardModel.cs); [NCombatRoom.cs](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Rooms/NCombatRoom.cs)
- 카드 풀은 30장 프리웜이다. 카드마다 `PortraitCanvasGroup`(CanvasGroup)이 있다. 손패 크기별 scale은 8장 0.95 … 12장 0.75다. — [NCard.cs:767-770](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Cards/NCard.cs); [HandPosHelper.cs:160-171](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Helpers/HandPosHelper.cs)
- 손패 레이아웃은 `RefreshLayout`이 `Hitbox.MouseFilter`와 포커스 이웃 경로를 매번 다시 설정한다. 입력 판정이 Control 히트박스에 의존한다는 뜻이다. — [NPlayerHand.cs:806-872](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Combat/NPlayerHand.cs)
- 게임 사용 흐름은 `Cmd.CustomScaledWait`와 Tween await로 진행 속도를 맞춘다(`OnPlayWrapper`). `NHitStop`은 `Engine.SetTimeScale`을 바꾼다. — [CardModel.cs:1858-2000](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Models/CardModel.cs); [NHitStop.cs:89-92](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Nodes.Vfx.Utilities/NHitStop.cs)
- 게임은 원격 플레이어의 카드도 로컬에서 `NCard`로 만들어 보여준다(`CreateCardNodeAndUpdateVisuals`, `!owningPlayerIsLocal` 분기). — [CardPileCmd.cs:866-884](/private/tmp/claude-502/sts2-src/MegaCrit.Sts2.Core.Commands/CardPileCmd.cs)

### Inferences

**① 틀 안 애니메이션 (Common): 쉬움, 위험 낮음**

- 구현:
  - `NCard.Reload` postfix에서 `Model.Id`로 모드 씬(`res://{modId}/portraits/{pool}/{id}.tscn`)이 있는지 보고, 있으면 `%Portrait` 자식으로 `ClipContents` 250×190 Control을 붙인다. 정지 상태에서는 원본 초상화만 보이게 한다.
  - hover·집기·사용 이벤트에서 `AnimationPlayer.Play`를 호출하고, 끝나면 정지 프레임으로 복귀한다.
  - `Visibility != Visible`(미발견·잠김 blur)과 고대 카드(`_portrait.Visible=false`)는 건너뛴다.
  - `OnFreedToPool`에서 제거한다.
- 위험:
  - private 메서드·노드 경로(`%Portrait`, `CardContainer/PortraitCanvasGroup`) 변경
  - 덱 보기·도감 그리드처럼 카드가 많은 화면에서 모든 카드를 상시 재생하면 CanvasGroup 재렌더 비용이 커진다. hover된 카드나 "활성" 카드만 재생해야 한다.
  - 첫 로드 hitch
- 순수성: 높다. 상태를 읽기만 하고 노드만 추가한다.

**② 손패 위로 튀어나오기 (Rare): 가능, 위험 중간**

- 구현:
  - 카드와 함께 움직여도 되는 요소는 `NCard.CardVfxContainer`(프레임·텍스트 위, 카드 transform 상속)에 붙인다. hover 홀더가 `ZIndex=1`이라 이웃 카드 위에 그려진다.
  - 화면 공간에 고정해야 하는 요소(카드 회전을 따르지 않는 파편 등)는 `NCombatRoom.Instance.Ui`(`z_as_relative=false`)의 자식으로 두고, 매 프레임 `card.GlobalPosition`을 따라가게 한다.
  - 손패와의 "상호작용"은 `NPlayerHand.ActiveHolders`의 위치를 **읽기만** 해서 그 위에 덧그리는 방식으로 제한한다.
- 위험:
  - **모든 모드 Control은 `MouseFilter = Ignore`여야 한다.** 그렇지 않으면 카드 클릭·드래그 입력을 가로채 결과적으로 게임 조작에 영향을 준다.
  - 이웃 홀더를 움직이면(`SetTargetPosition`) 히트박스가 이동해 오조작을 유발한다. 금지해야 한다.
  - hover tip(`HoverTipsContainer`), 타게팅 화살표, `GlobalUi` 오버레이 화면과의 그리기 순서가 꼬일 수 있다.
  - 소멸 VFX의 reparent나 풀 반환 시 고아 노드가 남을 수 있다.
  - 원격 플레이어 카드에도 같은 연출이 붙는다. 시각적 차이일 뿐 동기화 문제는 아니다.
- 순수성: 입력 필터와 정리만 지키면 유지된다.

**③ 무대·크리처 상호작용 (Rare 이상): 가능, 위험 중간~높음**

- 구현:
  - 트리거는 `CardModel.TryManualPlay` postfix(`__result==true`, 로컬)와 `NCombatUi.AddToPlayContainer` postfix(원격·자동 포함)다.
  - 모드 씬을 `CombatVfxContainer`/`BackCombatVfxContainer`에 붙이고, `NCreature.VfxSpawnPosition`/`Hitbox` 좌표와 `card.CurrentTarget`/`LastTargetedCreature`로 배치한다.
  - 크리처 "반응"은 크리처 위에 덧그리는 연출로만 한다. 크리처 노드에 셰이더를 씌우는 것도 가능하지만 원복 책임이 생긴다.
- 위험:
  - `CreatureCmd.TriggerAnim`(SFX·Spine 상태 변경), `NHitStop`(엔진 시간 배속), 화면 흔들림을 쓰면 순수성이 깨지거나 게임 연출 타이밍이 바뀐다.
  - 게임 고유 카드 VFX(Inflame·Hellraiser·Fan of Knives·Pyre·Bolas·Nightmare)와 겹친다.
  - postfix 예외가 `TryManualPlay`로 전파되면 실제 카드 사용이 실패할 수 있다. 반드시 try/catch로 감싸야 한다.
  - 게임 흐름 안에서 await나 대기를 추가하면 안 된다.
  - 난수는 `System.Random`이나 `Rng.Chaotic`만 쓰고, 런·플레이어 RNG(`PlayerRngSet` 등)는 절대 쓰지 않는다.
  - `FastMode` Instant에서는 생략한다.
- 순수성: "덧그리기"에 한정하면 유지되고, 크리처·카메라를 실제로 움직이면 흔들린다.

**공통 요구사항**

- 매니페스트에 `affects_gameplay:false`를 명시한다.
- 모델·넷 메시지를 정의하지 않는다.
- `HoveredModelTracker` 같은 동기화 API를 호출하지 않는다.
- 모드 실행 시 세이브가 `modded/`로 분리된다는 점을 사용자에게 안내한다.
- 패치 대상 메서드가 없으면(`AccessTools.Method == null`) 해당 기능만 조용히 끈다. 버전 대응 전략이다.

### Gaps
- 실제 게임에서의 프레임 비용(손패 10장 + 그리드 수백 장)은 측정하지 않았다.
- 같은 메서드를 패치하는 다른 인기 모드(예: 카드 UI 개편 모드)와의 충돌 여부는 이 조사 범위 밖이다.
- 퍼블릭 베타 브랜치에서 위 private 메서드명·씬 경로가 유지되는지 확인하지 못했다.
