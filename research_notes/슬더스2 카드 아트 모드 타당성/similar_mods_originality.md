# 유사 모드·팬 작품 카탈로그와 독창성 평가 ("애니메이티드 공식 카드 아트" STS2 모드)

> 조사일: 2026-10-18. 대상 기획: 카드를 집거나(hover/drag) 사용할 때 공식 STS2 카드 아트가 짧게 움직인다. 일반(Common)은 아트 프레임 안에서만 움직이고, 희귀도가 높을수록 프레임 밖으로 나와 손패·다른 카드·전투 무대·크리처와 상호작용한다. 지속 효과는 없고, 게임플레이는 바닐라와 100% 같은 순수 코스메틱 모드다.
>
> 수치 출처와 표기:
> - Steam Workshop 구독자 수와 날짜는 Steam Web API `ISteamRemoteStorage/GetPublishedFileDetails`와 Workshop 검색 페이지에 내장된 JSON으로 2026-10-18에 확인했다. "구독"은 현재 구독자, "누적"은 lifetime 구독자다.
> - Nexus 다운로드(DL)·추천(end) 수는 Nexus Mods GraphQL API v2(`api.nexusmods.com/v2/graphql`)로 2026-10-18에 확인했다. Nexus 웹페이지는 403으로 막혀 API와 sts2.gg 미러를 썼다.
> - Workshop 검색어(STS1 app 646570, STS2 app 2868840): animated, gif, card art, foil, shiny, holographic, sparkle, premium, golden, card skin, juice, vfx, living, moving, full art, beta art, anime, Balatro, shader, tilt, 3D card, Live2D, Spine, 动态卡面, 动态卡图, 卡面特效, 闪卡, card effect, card glow, hand, card animation, 카드 애니메이션, 움직이는. 검색어당 관련도 상위 30개만 받았으므로 전수 조사는 아니다.
> - "(스니펫)"은 검색 결과 요약으로만 확인하고 원문을 직접 열지 못한 출처다.
> - Steam Workshop 페이지 HTML에는 "removed from the community because it violates Steam Community & Content Guidelines"라는 문구가 숨은 템플릿으로 항상 들어 있다. 일부 검색 요약은 이 문구를 근거로 GifSpireCard와 AI Spire가 삭제됐다고 했지만, Steam API는 두 항목 모두 `banned: 0`, `result: 1`(정상 공개)로 돌려준다. 따라서 삭제된 것이 아니다.

## Q1. STS1(ModTheSpire/BaseMod, Steam Workshop)에는 카드 아트를 움직이거나 꾸미는 모드가 무엇이 있나

### Takeaway
STS1에는 GIF 카드 이미지를 지원하는 도구(GifSpireCard, 구독 197), 스프라이트시트 애니메이션 라이브러리(GifTheSpireLib, 구독 9.8만), 희귀 카드 반짝임(Rare Cards Sparkle, 구독 8.5만), Balatro식 포일(Floating & Foil Cards, 구독 1.9만), 카드 플레이 VFX(BetterAnimation, 구독 31만; Ryoiki Tenkai, 구독 7.6만)가 있다. 그러나 공식 아트 자체를 애니메이션으로 만들고 희귀도에 따라 프레임 밖까지 단계적으로 넓히는 모드는 찾지 못했다. 카드 아트 교체 팩은 대부분 정적 이미지이고, 애니메·밈 테마이거나 AI로 생성한 것이다.

### Cited Findings
**카드 아트 애니메이션(GIF·스프라이트)**
- GifSpireCard(Steam 표시명 `__name__`, GitHub `sleepyHolo/SpireMod_GifSpireCard`): BaseMod의 `basemod.abstracts.CustomCard`를 패치해 `.gif`를 카드 이미지로 쓸 수 있게 하는 도구 모드다. 예시로 아이언클래드 카드 25장을 GIPHY의 GIF로 바꿨다(75장 전부는 "좋은 GIF를 충분히 찾기 어려워" 포기했다). `gif_builder.py` 스크립트를 포함한다. 2025-07-25 등록, 현재 구독 197(누적 791), 즐겨찾기 17. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3534165833), [GitHub](https://github.com/sleepyHolo/SpireMod_GifSpireCard)
  - 댓글은 대부분 중국어 사용자의 호기심 반응이다("动态卡图吗？那很cool了", 즉 "움직이는 카드 그림? 멋지다"). — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3534165833)
- GifTheSpireLib(lobbienjonsji): "A mod that allows for easy ingame creation of animations using sprite sheets." 모드 제작자용 라이브러리다. 2019-03-17 등록, 2020-10-10 갱신, 구독 97,978. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=1685625583)
- Stuff the Spire는 카드 일부에 "custom animation"이 있다고 소개한다(초록 카드 1장, 빨강 카드 2장). 구독 7,200(2019). — Workshop 검색 결과에 내장된 JSON([검색](https://steamcommunity.com/workshop/browse/?appid=646570&searchtext=animated))

**희귀도 기반 반짝임·포일·프리미엄**
- Rare Cards Sparkle(Blank The Evil): "This mod makes Rare and Special cards sparkle." 2020-02-19 등록, 2022-07-19 갱신, 구독 85,057(누적 117,941), 즐겨찾기 2,218. 변경 기록에 "particles rendering on top of everything" 수정(2.0.1)이 있다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=2001434611), [changelog](https://steamcommunity.com/sharedfiles/filedetails/changelog/2001434611?l=dutch) (스니펫)
  - 댓글: "reminds me of my Yu Gi Oh card days... always loved the shiny rare cards", "谁会拒绝亮闪闪呢"(누가 반짝이는 걸 마다하겠나). 상위 댓글 일부는 자동 생성처럼 보이는 장문 찬사라 반응 지표로는 약하다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=2001434611)
- Floating & Foil Cards(Chaofan): "Like in Balatro, you cards now looks like floating and rotating slowly. By right clicking cards in compendium, you can toggle foil of a specific card." 2025-02-21 등록, 2025-08-24 갱신, 구독 19,197. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3431568651)
  - 댓글에 희귀도 단계화 요구가 있다. "only having the effect on rare cards!"와 "at like A5 all basic cards... foiled, then at like A10 all uncommon... A15 all Rare cards were foiled". 작성자는 STS2판을 만들지 않겠다고 답했다("应该不会做塔2版本的了"). RAM Saver·Optimize the Spire와 함께 쓰면 포일이 깨진다는 보고도 있다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3431568651)
- Card Mastery((Gk) Erasels): Monster Train에서 영감을 받았다. 심장을 잡을 때 덱에 있던 카드가 "마스터"되고, 금색 카드 뒷면, 벨벳 텍스트 영역, "a nice little shine effect"를 얻는다. "This has no gameplay impact." 2023-04-15 등록, 구독 5,954. 댓글에서 등급별 테두리(무광 금속에서 금색으로) 제안이 나왔다(스니펫). — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=2962588204), [댓글](https://steamcommunity.com/sharedfiles/filedetails/comments/2962588204)

**카드 플레이 VFX·"주스(juice)"**
- BetterAnimation(Reme, creator ID 76561198984454884): "Add visual effects to some cards." 2021-07-23 등록, 구독 313,385(누적 382,254)로 이번 조사에서 STS1 시각 모드 중 가장 컸다. 댓글을 보면 캐릭터가 회전하거나 백플립하는 장난스러운 연출이다("我战士鸽转起来了"(내 전사가 빙글빙글 돈다), "burst backflip makes you levitate"). — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=2554778215)
- Ryoiki Tenkai(领域展开, 같은 Reme 계정): "为一些能力牌添加打出时特效和持续站场特效", 즉 일부 파워 카드에 사용 시 특수효과와 지속형 필드 특수효과를 추가한다. 2025-08-16 등록, 2026-03-06 갱신, 구독 76,128. 기획이 배제한 "지속 효과" 쪽 선례다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3549855500)
- Fast Multi-Cast: 다중 시전 애니메이션을 빠르게 한다. 구독 1,618. 애니메이션이 플레이 템포를 늦추는 것을 싫어하는 수요가 있다는 신호다. — Workshop 검색 JSON([검색](https://steamcommunity.com/workshop/browse/?appid=646570&searchtext=animated))
- 2019년 STS1 Steam 토론에서 한 사용자는 플레이어들이 "fast and snappy response"에 익숙하므로 애니메이션 추가가 "really controversial"할 것이라고 썼다(스니펫). — [Steam 토론](https://steamcommunity.com/app/646570/discussions/0/1743357605565257724)

**카드 아트 교체 팩(정적)**
- AI Spire: "Turn card art into AI-drawn anime-style cards. Almost all cards are reskined." 이미지 생성 도구로 foxwhite25의 Rust 툴 `sts_card_maker`를 공개했다. 2023-01-30 등록, 2024-10-12 갱신, 구독 28,933(누적 55,670). API상 정상 공개다(`banned: 0`). — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=2926134683)
- Tom&Jerry Card Picture: 카드 이름이나 원래 그림을 기준으로 톰과 제리 스크린샷으로 교체한다(같은 sts_card_maker 사용). 2025-05-22 등록, 구독 15,857. STS2판(Jcey Lyn 제작)도 있다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3485962156)
- Girls Band Spire(Card Image MOD): 모든 카드 이미지를 애니메이션 스크린샷으로 교체하고 베타 아트 일부도 교체한다. 구독 6,402. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3453964973)
- 尖塔萌化 MoeTheSpire: 카드 3~4장만 모에화했는데도 구독 35,738을 기록했다. — Workshop 검색 JSON([검색](https://steamcommunity.com/workshop/browse/?appid=646570&searchtext=%E5%8A%A8%E6%80%81%E5%8D%A1%E9%9D%A2))
- Reskin the Spire: 리스킨 프레임워크로 애니메이션 에디터를 포함한다. 구독 24,647. 이 밖에 Kikuchiyo Mod(구독 100,345) 같은 "같은 캐릭터, 다른 애니메이션" 스킨 모드가 다수 있다. — Workshop 검색 JSON([검색](https://steamcommunity.com/workshop/browse/?appid=646570&searchtext=animated))

**바닐라 STS1 베타 아트**
- STS1은 카드별 "Beta Art" 토글을 공식 지원한다(PC에서는 카드 우클릭이나 도감). 무색·저주 카드의 베타 아트는 모든 캐릭터로 심장을 잡으면 해금된다고 한다(스니펫). — [slaythespire.wiki.gg Card](https://slaythespire.wiki.gg/wiki/Card)
- 2018년 개발자는 베타 브랜치 설정에 이 토글이 있다고 답했다(스니펫). — [Steam 토론](https://steamcommunity.com/app/646570/discussions/0/3377008022020650010)

### Inferences
- STS1에서 "카드 아트가 움직인다"는 시도는 기술 데모(GifSpireCard: 남의 GIF 25장)나 라이브러리(GifTheSpireLib)에 머물렀다. 공식 아트를 원작 화풍 그대로 애니메이션화한 대규모 작업은 없었다.
- 가장 크게 성공한 시각 모드(BetterAnimation 31만, Rare Cards Sparkle 8.5만)는 둘 다 작은 범위만 건드리고, 설치하면 바로 적용되며, 게임플레이에 영향이 없다. 범위를 좁게 시작하는 전략이 통한다는 근거다.
- Floating & Foil Cards 댓글의 "희귀 카드에만", "승천 단계별로 해금" 요구는 희귀도 단계화 연출에 실제 수요가 있음을 보여준다.

### Gaps
- STS1 Workshop 전체(수천 항목)를 전수 조사하지 못했다. 검색어당 상위 30개만 봤으므로 작은 "animated card art" 모드가 빠졌을 수 있다.
- BetterAnimation(STS1)의 정확한 연출 범위는 설명이 한 줄이라 댓글로만 추정했다.
- ModTheSpire 위키와 Discord의 모드 목록은 확인하지 못했다.

## Q2. STS2(Nexus Mods, Steam Workshop, GitHub, Thunderstore)에는 무엇이 있나

### Takeaway
STS2 모드 판은 크고 빠르다. Nexus는 2026-03부터 활성화됐고, Steam Workshop은 2026-06 v0.107.1부터 열렸다. 여기서 기획과 겹치는 갈래는 다섯 가지다.
- (a) 카드 아트 애니메이션을 직접 시도한 모드: Animated Rare Cards(AI 생성), Celestial Card Art(AI 보조, 레전트 18장).
- (b) GIF를 지원하는 아트 교체 도구: Card Art Editor, Custom Card Texture Loader SG, CardManager. 이 중 둘은 hover 때만 재생하는 옵션이 있다.
- (c) 카드 플레이 VFX 대형 장르: Regent FX Omnistar(구독 29만), "More X Animations" 시리즈(구독 6.6만, 6.3만, 4.3만, 1.2만), Better Animation(2.8만), IroncladFX(0.46만).
- (d) 포일·셰이더·3D 틸트: Balatro Effects, Pengo's Tarot의 효과 패널, 3D Card Portraits, Spire TCG.
- (e) 수십만 구독 규모의 정적 애니메·AI 아트 교체 팩.

가장 가까운 경쟁자는 두 개다. IroncladFX는 카드 아트 속 방패가 날아나와 실체화되고 손패가 날아오르는 연출로 "프레임 밖 상호작용"에 가장 근접했다. Animated Rare Cards는 레어만 대상으로 AI로 애니메이션을 만들어 "희귀도 한정 + 원작 화풍"에 가장 근접했다. 둘 다 희귀도 단계화, 공식 아트 보존과 프레임 돌파의 결합, 비지속성 원칙을 함께 갖추지는 않았다.

### Cited Findings
**플랫폼 현황**
- STS2 Steam Workshop은 메인 브랜치 v0.107.1(두 번째 대형 메인 업데이트)과 함께 열렸다고 보도됐다(기사 갱신 2026-06-19). — [allthings.how](https://allthings.how/slay-the-spire-2-update-0-107-1-steam-workshop-rng-fix-and-aeonglass/)
  - Mega Crit 엔지니어 Ed의 말로 "as of the last patch, we've deemed mod support mature enough to enable the Workshop"가 인용됐다(스니펫). — [ingamenews](https://ingamenews.com/2026/06/slay-spire-2-adds-bestiary-and-official.html)
  - Workshop 항목 대부분의 생성일은 2026-06-18~20에 몰려 있다(이번 조사 데이터). — [Workshop 검색](https://steamcommunity.com/workshop/browse/?appid=2868840&searchtext=card%20art)
- Nexus의 STS2 모드 ID는 2026-03-08(QuickRestart, ID 4)부터 시작한다. 카드 아트 팩은 2026-03~08에 집중됐다. — [Nexus API 조회 결과, 예: QuickRestart](https://www.nexusmods.com/slaythespire2/mods/4)
- Thunderstore에는 STS 커뮤니티가 없다(API 커뮤니티 목록에 "spire"는 TaleSpire뿐). — [Thunderstore API](https://thunderstore.io/api/experimental/community/)
- GitHub 검색("sts2 card vfx", "sts2 animated card" 등)은 거의 비어 있다. Ind-E/BalatroEffects(★1)와 sleepyHolo/SpireMod_GifSpireCard(★1) 정도만 나왔다. 다만 Workshop 설명에서 Tim-1e/CelestialCardArt, JerryCatJim/Sts2-CrusaderSkinMod, Railiya/CardArtFullscreenViewer 같은 저장소를 확인했다. — [GitHub Ind-E/BalatroEffects](https://github.com/Ind-E/BalatroEffects)

**(a) 카드 아트를 직접 애니메이션화한 모드**
- Animated Rare Cards (AI generated)(Nexus #851, llxs555): "Almost fully animated card art for all Rare (Gold) cards for the first three characters", "80+ Unique Assets: Each animation is handcrafted to fit the original art style", "dynamic animations (produced by AI)". Godot 기반 렌더링으로 최적화했다고 한다. 모드 메뉴에서 "Animated Gold Cards"를 켜고 F10으로 설정을 연다. "Special thanks to the developers of Harmony and Gemini." 2026-06-05 등록, 이후 갱신 없음. 버전 0.4.1, DL 608, 추천 4. — [Nexus #851](https://www.nexusmods.com/slaythespire2/mods/851), [sts2.gg 미러](https://sts2.gg/mods/mod-851)
- 天体卡面 Celestial Card Art(xy_zml, GitHub Tim-1e/CelestialCardArt): "An artwork-only pack: 18 cards, 20 animated artworks, 7 relic artworks and 13 character artworks. Both Normal and Ancient layouts support animation." 손패, 뽑을/버린 카드 더미, 덱, 도감에서 재생할 수 있고 위치별 켜기·끄기와 범위를 사용자가 고른다. "非官方同人美术，使用AI辅助生成并进行选图、修订与取景"(비공식 2차 창작 아트, AI 보조로 생성하고 선별·수정·구도 조정을 거침). 영상 변환에 FFmpeg를 쓴다. v1.2부터 개인 이미지와 짧은 영상 가져오기를 지원한다. 2026-09-17 등록, 2026-09-24 갱신, 구독 2,122, 파일 332MB. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3803362518)

**(b) GIF·영상을 지원하는 아트 교체 도구**
- Card Art Editor(p1585 / Steam 작성자 "카오", 한국인): 도감 카드 상세 화면에 편집 버튼을 추가한다. PNG, JPG, WebP, GIF를 받고, 풀아트 모드와 아트 팩 공유를 지원한다. GIF 옵션은 "limit GIF frames, use cached frames, remove duplicate frames, or set GIFs to play only when hovering/selecting a card". "This is a visual customization mod only." — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3748210488), [Nexus #293](https://www.nexusmods.com/slaythespire2/mods/293)
  - 변경 기록에는 2026-04-04 "Infection card effect toggle", 2026-04-30 "rarity-based differentiation for full-art cards ... interactive GIF setting", 2026-05-15 "interactive GIF and rarity flame settings"가 있다. 이 도구에 이미 희귀도별 장식(불꽃)이 들어 있다는 뜻이다. — [sts2.gg 미러](https://sts2.gg/mods/mod-293)
  - 규모: Steam 구독 11,831(누적 20,278), 등록 2026-06-20, 갱신 2026-10-04. Nexus DL 9,351, 추천 107(2026-03-27~). — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3748210488), [Nexus #293](https://www.nexusmods.com/slaythespire2/mods/293)
  - 댓글(2026-09-08): "vibe coded ♥♥♥♥ piece of trash that will make your game run at 240 seconds per frame". 작성자는 다른 모드와의 충돌 가능성을 들었다. GIF 방식의 성능 리스크와 AI 코딩에 대한 반감을 함께 보여준다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3748210488)
- Custom Card Texture Loader SG(Khiral/Khiralv, Nexus #471): 런타임에 카드, 유물, 파워, 포션 텍스처를 교체하고 GIF를 우선 지원한다. GIF는 SixLabors.ImageSharp로 디코딩하고 GifAnimationManager 노드로 재생한다. "Interactive GIF Playback" 옵션을 켜면 손패나 카드 선택 화면에서 hover할 때와 상세 보기 중에만 재생하고, 벗어나면 첫 프레임으로 되돌린다. 2,300개 이상의 텍스처를 내보내는 도구가 있다. 2026-04-10 등록, 2026-05-20 갱신, DL 5,919, 추천 113. — [sts2.gg 미러](https://sts2.gg/mods/mod-471), [Nexus #471](https://www.nexusmods.com/slaythespire2/mods/471)
- Cyberpunk-style Card Frame(Khiral, Nexus #562, DL 1,017)은 위 로더를 전제로 한 커스텀 카드 프레임이다. Hearthstone-Style Card Frames(Nexus #736, DL 195)도 있다. — [Nexus #562](https://www.nexusmods.com/slaythespire2/mods/562), [Nexus #736](https://www.nexusmods.com/slaythespire2/mods/736)
- CardManager(ximengyy, Nexus #799): 카드 아트 조회, 교체, 내보내기 도구로 "custom card art or GIFs(planned for the next version)"라고 적혀 있다. DL 222. — [Nexus #799](https://www.nexusmods.com/slaythespire2/mods/799)
- Card editor and Card creator(Nexus #69)는 11.1.8에서 GIF를 지원했다(스니펫). — [Nexus #69](https://www.nexusmods.com/slaythespire2/mods/69)
- 可视化卡面/音频替换(Visual Card Art & Audio Replacer, Workshop 구독 78): 카드 초상화를 교체하고 카드별 "출페 효과음"(wav, mp3, ogg, FMOD event)을 연결한다. `.cardpack`으로 Workshop에 배포한다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3755203926)
- Art Roller(Michael Mayhem): 도감 안에서 카드 아트의 색조, 채도, 밝기, 대비, 뒤집기를 바꾸거나 다른 카드의 아트를 지정한다. 모드 제작자용 라이브러리 기능도 있다. 구독 8,919(2026-09-27~). — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3809560508)
- HighResolutionCards(wecreus, Nexus #536): 게임 파일에 이미 있는 고해상도 초상화로 바꿔 불러온다. DL 1,833. — [Nexus #536](https://www.nexusmods.com/slaythespire2/mods/536), [sts2.gg](https://sts2.gg/mods/mod-536)

**(c) 카드 플레이 VFX(카드를 쓰면 무대에서 연출이 나오는 모드)**
- IroncladFX 魔焰铁甲 | 战士卡牌特效 (Beta Only): 2026-10-15 등록, 2026-10-16 갱신, 구독 4,631, 즐겨찾기 338. "Reworked play effects for 10 Ironclad cards. Visual only: no numbers are changed." v0.111.0 이상(현재는 public-beta)이 필요하고, 카드별로 끌 수 있다. 기획과 겹치는 연출은 다음과 같다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3820147809)
  - 악마의 형상(Demon Form): "pick the card up and a smoke demon gathers behind you. Play it and the card flies into its heart". 집을 때와 사용할 때를 모두 트리거로 쓴다.
  - 바리케이드(Barricade): "the shields from the card art fly out, circle, and lock together into a ghostly great shield in front of you. It glows brighter the more Block you have... when your Block breaks it cracks, shatters, then reassembles". 카드 아트가 프레임 밖으로 나오지만, 방패가 무대에 남는 반지속 연출이다.
  - 지옥불(Fiend Fire): "your hand floats up and burns around the fireball". 손패와 상호작용한다.
  - 불타는 조약(Burning Pact): "a demon hand hovers over the card you pick, crushes it". 다른 카드와 상호작용한다.
  - 분노(Anger): "the card glows red-hot and splits in two, a fist punches out of it into the enemy". 카드 밖으로 나와 크리처를 친다.
  - 포식(Feed): 거대한 입이 적을 문다. 화력 증폭(Stoke): 손패가 녹색 불 속으로 던져진다. 제물(Offering), 타락(Corruption), 발화(Inflame)도 포함된다.
- More Ironclad Animations | 更多铁甲战士动画(page_): "New defensive and card-play animations for Ironclad." 2026-09-08(UTC 09-09) 등록, 2026-10-16 갱신, 구독 66,363(누적 78,011), 즐겨찾기 4,087, 파일 59MB. 애니메이션 13종을 각각 켜고 끌 수 있고 멀티플레이에서도 보인다. 사전 모드가 필요 없다(BaseLib/JmcModLib은 설정용 선택 사항). — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3798368044)
  - 몸통 박치기(Body Slam) 돌진, 어둠의 포옹(Dark Embrace) 그림자 손, 전투 최면(Battle Trance) 종, 악마의 형상(Demon Form)의 뿔·날개·눈불, 무적(Impervious)의 금색 방어 자세가 있다.
  - 바리케이드(Barricade)는 "a shield wall that grows with Block and breaks when hit"로, 지속형이다.
  - 낙인(Brand)은 "a branding-iron hand follows the selected card and brands it"로, 손패 속 카드와 상호작용한다.
  - 혈류(Hemokinesis)는 피 줄기가 적에게, 사혈(Bloodletting)과 제물(Offering)은 피 줄기가 에너지 카운터로 날아간다. UI와 상호작용하는 연출이다.
- 같은 작성자(page_)의 후속작으로 More Defect Animations(2026-09-30 등록, 구독 62,964), More Necrobinder Animations(2026-10-09, 구독 42,611), More Silent Animations(2026-10-17, 구독 12,316)가 있다. 실렌트판은 단도 투척, 후퇴 동작 등을 넣었다. — [Defect](https://steamcommunity.com/sharedfiles/filedetails/?id=3810696310), [Necrobinder](https://steamcommunity.com/sharedfiles/filedetails/?id=3816316338), [Silent](https://steamcommunity.com/sharedfiles/filedetails/?id=3821353824)
- Regent FX Omnistar(Vitech[CN] / Nexus Vitechliu): "Add star rings and special hit/cast effect according to Regent's card images." 카드 아트의 모티프를 시전 VFX로 옮겨, 카드 아트와 무대 연출을 잇는 방식이다. Steam 구독 293,040(누적 362,912), 즐겨찾기 23,908, 2026-06-19 등록, 2026-08-14 갱신. Nexus #685는 DL 28,922, 추천 429(2026-04-26~). 0.5.0에서 Shining Strike, Solar Strike, Comet, Supermassive, Radiate VFX를 추가했고 효과음은 FMOD로 옮겼다. RitsuLib는 선택 사항이다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3747497501), [Nexus #685](https://www.nexusmods.com/slaythespire2/mods/685)
- Better Animation(Reme, STS1 BetterAnimation과 같은 계정): "Added extra visual effects to some cards and powers... enable or disable individual vfx in the RitsuLib settings." 메아리의 형상(Echo Form), 암살(Assassinate), 얼음 창(Ice Lance) 등과 네크로바인더를 지원한다. 2026-08-03 등록, 구독 27,602. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3777276296)
- MoreCharacterFX(Autuma, Nexus #663, DL 6,697): 조준 체인을 십자선과 트레일로 바꾸고, 일반·엘리트·보스 처치 VFX와 SFX를 넣는다. "no core gameplay/stat changes". 같은 계열의 Workshop판 "更多的角色特效"(구독 3,795)도 있다. — [Nexus #663](https://www.nexusmods.com/slaythespire2/mods/663)
- Grand Finale Effect(Nexus #543, DL 288), PhonkCard(카드를 쓸 때마다 이모트와 효과음, Nexus #482), I Am Invincible Title Card(Nexus #1068), [Ironclad Skin]Crusader("Has unique card anims", 카드별 애니메이션을 JSON으로 설정, 구독 12,037), Body Burst(사망 폭발, 구독 1,977)도 있다. — [Nexus #543](https://www.nexusmods.com/slaythespire2/mods/543), [Crusader](https://steamcommunity.com/sharedfiles/filedetails/?id=3801530111)

**(d) 포일·셰이더·3D 틸트·프리미엄 마감**
- Balatro Effects(GitHub Ind-E/BalatroEffects): "3D card tilt that tracks cursor movement over cards", "Ability to enable foil, polychrome, holo, or negative shaders for each card", "Bounce animation when hovering cards". 2026-06-19 등록, 구독 607(누적 1,354). — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3747874832), [GitHub](https://github.com/Ind-E/BalatroEffects)
- Pengo's Tarot Enchantments Pack(Pengonut): 게임플레이 모드(타로 인챈트 44종)이지만, 카드 상세 화면의 "PengoTarot Config Panel"에서 카드 구성요소별로 약 20종 셰이더(Balatro의 Foil, Polychrome, 외곽선, 픽셀화)를 설정할 수 있다. "All effects support dynamic 3D tilt ... and come alive when you play your cards." 셰이더 코드는 BalatroEffects(Ind_E)에서 왔다. 구독 32,000. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3747679239)
- 3D Card Portraits: "Adds a 3D effect to card hover that follows your mouse, with adjustable depth strength, tilt range, and follow speed. Works with other mods that replace card art." Windows 전용이다. 2026-09-12 등록, 구독 4,335. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3800243712)
- Spire TCG: 런 보상 크레딧으로 부스터 팩을 까서 STS2 카드, 유물, 포션, 몬스터 카드 1,000종 이상을 모으는 메타 수집 모드다. "Rares burst with light, Epics shake the screen, and foils shimmer." 포일 확률은 1/50이고, 19장의 고대의 존재 카드에는 풀아트판이 있다. 선택 옵션 "Show my foils, full arts & graded cards in game"을 켜면 실제 런의 카드에 포일 반짝임이 입혀진다. "Purely cosmetic." OSRS TCG(RuneLite) 플러그인에서 영감을 받았다. 2026-09-27 등록, 구독 728. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3808863215)
- Card Upgrader - Gamble Your Cards: 업그레이드 도박에 이기면 카드가 홀로그래픽이 된다(게임플레이 모드). 구독 3,089. CardOverhaul - Holo Cards(Nexus #905)도 게임플레이 모드다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3805727667), [Nexus #905](https://www.nexusmods.com/slaythespire2/mods/905)
- Card Star Fusion(卡牌升星): 2성은 금색, 3성은 비취색 테두리를 쓴다(게임플레이 모드). 구독 3,972. — Workshop 검색 JSON([검색](https://steamcommunity.com/workshop/browse/?appid=2868840&searchtext=%E9%97%AA%E5%8D%A1))
- Googly Eyes: 크리처, 유물, 카드, 이벤트 화면에 눈알을 붙인다. 공식 카드 아트 위에 덧씌우는 오버레이의 선례다. "this mod uses code and shaders that were written by AI." 구독 4,759. STS1 원조는 twanvl의 Googly Eyes다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3745864998)
- Mouse Parallax(배경 시차, 구독 87), Fullscreen Card Art View(구독 90)는 소규모 연출·감상 모드다. — [Mouse Parallax](https://steamcommunity.com/sharedfiles/filedetails/?id=3749354958), [Fullscreen](https://steamcommunity.com/sharedfiles/filedetails/?id=3751384083)

**(e) 정적 카드 아트 교체 팩(규모 참고)**
- Regent Cards Anime Rework(DoublePigeon): "The arts are created using Stable Diffusion and Nanobanana 2", 이후 수작업으로 수정했다. Nexus #344 DL 93,597, 추천 1,408. Steam 구독 75,797(누적 105,857). — [Nexus #344](https://www.nexusmods.com/slaythespire2/mods/344), [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3747626664)
- SilentCardAnimerRework("created with AI and Photoshop", 89장): 구독 57,860(누적 102,922). Anime Defect Cards: 구독 31,043. Card Portraits - Regent(Hatk): Nexus DL 56,604. — [Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=3747583717), [Nexus #760](https://www.nexusmods.com/slaythespire2/mods/760)
- Crimson Blade Valkyrie(IronClad Skin/CardArt): 구독 206,227, "No AI-generated content". Nightveil Nekoninja: 구독 88,433, CC BY-NC-ND 4.0으로 AI 학습 사용을 금지한다. 卡面娘化 - 储君: 구독 129,019. — [Valkyrie](https://steamcommunity.com/sharedfiles/filedetails/?id=3747952763), [Nekoninja](https://steamcommunity.com/sharedfiles/filedetails/?id=3759576970), [储君](https://steamcommunity.com/sharedfiles/filedetails/?id=3747751411)
- Chaos Zero Nightmare 시리즈(PelleasWorks): 캐릭터별 카드 아트 팩이다. Tressa는 "primarily generated with GPT Image 2"(스니펫). Nexus Tressa DL 9,987, Steam Chizuru 구독 33,969. — [Nexus #1123](https://www.nexusmods.com/slaythespire2/mods/1123)
- Full-Art 팩(tizzone, Card Art Editor로 가져오기): Necrobinder, Ironclad, Silent, Defect, Regent판이 각각 DL 1~2천이고 "Proof-of-concept"라고 밝혔다. — [Nexus #883](https://www.nexusmods.com/slaythespire2/mods/883), [Nexus #957](https://www.nexusmods.com/slaythespire2/mods/957)
- 리브2D·스파인 계열: AncientWaifus(고대의 존재 일러스트와 카드, 테즈카타라 L2D 완료, 구독 91,723), [Live Mode]KaguyaSilentRavenSkin(구독 113,452). 둘 다 공식 아트를 교체하는 2차 창작이다. — [AncientWaifus](https://steamcommunity.com/sharedfiles/filedetails/?id=3748235030), [Kaguya](https://steamcommunity.com/sharedfiles/filedetails/?id=3786286239)

### Inferences
- "공식 아트를 그대로 두고 움직이게 한다"를 표방한 STS2 모드는 Animated Rare Cards 하나뿐이다. 이 모드는 Nexus에만 있고(Workshop에는 없음), 이름에 "AI generated"를 달았으며, 출시 후 갱신이 없고, DL 608·추천 4로 반응이 매우 약하다. 같은 시기 정적 AI 애니메 팩이 수만 DL을 기록한 것과 비교하면, 공식 아트를 움직인다는 주제 자체보다는 품질, 노출, 플랫폼(Workshop 부재) 문제였을 가능성이 크다. 다만 화면을 직접 확인하지 못해 단정할 수 없다.
- 카드 플레이 VFX 장르는 이미 대규모다(Regent FX 29만, More X Animations 시리즈 합계 약 18만 구독). "카드를 쓰면 무대에서 연출이 나온다"는 축만 보면 기획은 새롭지 않다. 차별점은 연출의 소재가 카드 아트 자체이고, 단계가 희귀도로 정해진다는 점에 있어야 한다.
- IroncladFX는 기획의 상위 희귀도 거동(아트에서 튀어나옴, 손패와 다른 카드 조작, 크리처 타격, 집을 때 트리거)을 10장 규모로 이미 시연했다. 기획의 고유성은 개념보다는 다음 셋에 있다.
  - 전 카드를 희귀도 규칙으로 체계화하는 것
  - 커먼은 프레임 안에만 머문다는 위계
  - 지속 연출을 금지하는 것(IroncladFX의 바리케이드와 More Ironclad Animations의 방패 벽은 지속된다)
- More X Animations, IroncladFX, Regent FX와 같은 카드에 동시에 훅을 걸 가능성이 높다. 호환성 설계(감지 후 양보, 카드별 끄기)가 필요하다.
- Workshop의 시각 모드 수요는 중국어권 제작자와 이용자 비중이 크다(대부분 중영 병기). 한·중·영 설명이 노출에 유리하다.

### Gaps
- Animated Rare Cards의 실제 화면, 트리거(항상 재생 또는 hover), 공식 아트를 image-to-video로 만들었는지 여부는 Nexus 페이지 미디어에 접근하지 못해 확인하지 못했다. 감사 인사의 "Gemini"는 Google Gemini/Veo 사용을 시사하지만 추정이다.
- Workshop 검색은 검색어당 30개로 잘렸다. STS2 Workshop의 "动态卡面" 계열 소규모 작품이나 Bilibili에만 공개된 작업은 빠졌을 수 있다.
- More X Animations와 IroncladFX의 실제 영상 품질, 화풍 일치도는 확인하지 못했다.
- Nexus 쪽 Animated Rare Cards 댓글과 반응 텍스트는 확보하지 못했다.

## Q3. 바닐라 STS2에 이미 겹치는 기능(움직이는 카드 아트, 포일, 베타 아트 토글, 카드 플레이 VFX)이 있나

### Takeaway
바닐라 STS2에서 움직이는 카드 초상화, 포일·프리미엄 변형, 베타 아트 토글은 확인되지 않았다. 베타 아트 토글은 모드(Beta Art Enabler)로만 존재한다. 대신 기획과 겹칠 수 있는 바닐라 요소는 다섯 가지다.
- 카드 위에 셰이더로 덮는 고통(affliction) 오버레이 VFX(v0.102.0 추가)
- Infection 카드 오버레이
- 희귀도별 카드 글로우 텍스처(uncommon/rare)
- 캐릭터에 지속되는 형상(Form) VFX
- 고대의 존재 카드의 별도 레이아웃

### Cited Findings
- Beta Art Enabler(wecreus, Nexus #683): "Slay the Spire 2 has beta card art saved in game files. This mod allows it to be toggled dynamically during the run, just like Slay the Spire 1." "View Upgrade" 옆에 체크박스를 넣는다. 2026-04-25 등록, 2026-07-04 갱신, DL 448. 소스는 github.com/wecreus/STS2BetaArt에 있다. — [Nexus #683](https://www.nexusmods.com/slaythespire2/mods/683), [sts2.gg](https://sts2.gg/mods/mod-683)
- 검색으로는 Mega Crit가 STS2에 공식 베타 아트 토글을 넣었다는 발표를 찾지 못했다(스니펫 결론). — [Mega Crit X v0.104.0](https://x.com/MegaCrit/status/2047468917770334429)
- 로컬 추출 데이터에서 STS2 카드 598개 중 284개에 `beta_image_url`이 있다(공식 초상화 633장, 베타 초상화 284장). — [repo: data/sts2/eng/cards.json](file:///Users/flavono123/P/scare-the-spire/data/sts2/eng/cards.json), [repo: public/images/sts2/cards-beta](file:///Users/flavono123/P/scare-the-spire/public/images/sts2/cards-beta)
- 희귀도 분포(로컬 데이터): Uncommon 232, Rare 160, Common 101, Ancient 19, Basic 19, Event 19, Curse 18, Status 16, Token 10, Quest 4. 캐릭터별 레어는 각 27장이고 무색 레어는 25장이다. — [repo: data/sts2/eng/cards.json](file:///Users/flavono123/P/scare-the-spire/data/sts2/eng/cards.json)
- Mega Crit은 v0.102.0 베타에 "afflictions VFX"를 추가했다고 공지했다. — [Mega Crit X](https://x.com/MegaCrit/status/2039869984520982766)
  - 로컬 추출 에셋에는 고통 오버레이마다 셰이더용 텍스처가 있다(`hexed_main_shader.webp` 등; bound, entangled, galvanized, hexed, ringing, smog, tainted). 공통 텍스처로 `border_glow`, `border_vignette`, `mask`, `vfx_noise_1`이 있다. — [repo: public/images/sts2/affliction-overlays](file:///Users/flavono123/P/scare-the-spire/public/images/sts2/affliction-overlays)
- 바닐라 Infection 카드 오버레이(`card-overlays/infection/base.webp`, `overlay.webp`)가 있다. Card Art Editor는 2026-04-04에 "Infection card effect toggle"을 추가했다. — [repo](file:///Users/flavono123/P/scare-the-spire/public/images/sts2/card-overlays/infection), [sts2.gg Card Art Editor](https://sts2.gg/mods/mod-293)
- 희귀도 글로우 텍스처 `vfx/glow_card_rare.webp`와 `glow_card_uncommon.webp`가 있다. — [repo: public/images/sts2/vfx](file:///Users/flavono123/P/scare-the-spire/public/images/sts2/vfx)
- 형상 VFX 런타임 텍스처(demon, echo, reaper, serpent, void)는 캐릭터에 계속 붙어 있는 바닐라 지속 VFX다. 기획이 피하려는 대상이다. — [repo: public/images/sts2/form-vfx/runtime](file:///Users/flavono123/P/scare-the-spire/public/images/sts2/form-vfx/runtime)
- 고대의 존재 카드는 별도 레이아웃을 쓴다. Celestial Card Art가 "Both Normal and Ancient layouts support animation"과 "先古全幅"(고대의 존재 풀폭)을 구분한다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3803362518)
- v0.108.0 베타 하이라이트는 "Aeonglass animations", "More Epoch art", "Modding updates"였고, 카드 아트 애니메이션은 언급되지 않았다. — [Mega Crit X v0.108.0](https://twitter.com/MegaCrit/status/2072884691666121057)
- Mega Crit의 Casey Yano는 플레이스홀더에도 생성형 AI를 쓰지 않는다고 GameSpot에 말했다(타임라인의 "MS Paint" 같은 임시 아트 사례)(스니펫, 원문 403). — [GameSpot](https://www.gamespot.com/articles/slay-the-spire-2-is-choosing-shit-art-over-generative-ai/), [TechPowerUp](https://www.techpowerup.com/350765/slay-the-spire-2-dev-explains-why-it-used-a-bunch-of-garbage-art-instead-of-ai-placeholders)

### Inferences
- 바닐라가 이미 손패의 카드 위에 셰이더 오버레이(고통, Infection)를 그리므로, 카드 프레임 안 애니메이션 레이어는 엔진 쪽 선례가 있는 기법이다. 반대로 고통 오버레이와 같은 레이어를 쓰면 시각적으로 충돌하거나 읽기 어려워질 수 있다. 고통이 걸린 카드에서는 애니메이션을 약하게 하거나 오버레이를 우선하는 규칙이 필요해 보인다.
- 희귀도 글로우가 이미 있으므로 "희귀도가 높을수록 더 화려하다"는 문법은 바닐라 디자인 언어와 맞다. 고대의 존재 레이아웃은 바닐라에서 이미 프레임을 확장한 최상위 등급이므로, 기획의 최상위 단계를 고대의 존재 카드에 매핑하기 자연스럽다.
- 베타 아트가 284장 존재하므로 "베타 아트 상태에서도 애니메이션이 맞물리는가"라는 호환성 질문이 생긴다(Beta Art Enabler 사용자).
- Mega Crit의 강한 반AI 공개 입장은 기획의 "AI 보조 에셋, 바닐라와 구별 불가" 목표와 평판상 긴장이 있다. "공식처럼 보이는데 AI"라는 인식이 생기면 반발이 커질 수 있다.

### Gaps
- 바닐라 STS2가 카드 초상화를 일부라도 애니메이션하는지(예: 특정 이벤트, 고대의 존재 카드)는 게임을 실행하거나 디컴파일해 확인하지 않았다. 추출 에셋과 패치노트에 언급이 없다는 데 근거한 판단이다. 형제 노트 `sts2_modding_ecosystem.md`가 디컴파일 기반이므로 교차 확인을 권한다.
- 바닐라 카드 플레이 VFX의 범위(어떤 카드에 전용 VFX가 있는지)는 정리하지 못했다.
- glow_card_rare/uncommon이 실제로 어느 화면(보상 화면, 손패)에서 쓰이는지는 확인하지 못했다.

## Q4. 모드 밖 팬 작품, 그리고 AI로 만든 STS 아트에 대한 커뮤니티 반응과 플랫폼 규칙

### Takeaway
STS 카드 아트를 움직이게 만든 팬 작품(Reddit, X, YouTube, Pixiv)은 이번 검색으로 확인하지 못했다. Reddit이 차단됐고, 웹 검색으로도 사례가 나오지 않았다. AI에 대한 반응은 갈린다. 정적 AI 애니메 팩은 수만~십만 단위로 받아들여졌고, "NO AI" 표기 팩은 소수 열성층에 머문다. 공개 토론에서는 반AI 목소리가 크고 Mega Crit도 반AI 입장을 공개했다. Nexus는 AI 사용 태그를 3종으로 의무화했다.

### Cited Findings
**팬 작품**
- 웹 검색("I animated" Slay the Spire, site:reddit.com slaythespire animated card art, Live2D 등)에서 Reddit이나 X의 애니메이션 팬아트는 나오지 않았다. 대신 모드 페이지가 나왔다. — [검색 결과 예: Lovisa Malinen의 The Cursed 모드 카드 아트(정적)](https://www.artstation.com/artwork/o2BQ1k)
- 모드 쇼케이스 영상은 주로 Bilibili에 있다. 卡面娘化 시리즈와 Celestial Card Art가 Bilibili·GitHub 영상을 링크한다. — [卡面娘化 - 储君](https://steamcommunity.com/sharedfiles/filedetails/?id=3747751411), [Celestial Card Art](https://steamcommunity.com/sharedfiles/filedetails/?id=3803362518)

**AI 반응과 규칙**
- Steam STS2 토론 "Ai used in mods on the workshop"(7월 1일 게시, 답글 62개): 원글은 서툴더라도 직접 그린 아트를 원했다.
  - 반대 측: "steals from artists", 베타 아트를 보여주는 게임에서 AI는 아쉽다, 작가에게 돈을 내라.
  - 수용 측: "slop만 아니면", 대안은 모드가 아예 없는 것, AI가 아마추어 아트보다 낫다.
  - Steam 규칙이나 공시 의무는 논의되지 않았다. — [Steam 토론](https://steamcommunity.com/app/2868840/discussions/0/571542424813443618/)
- Nexus Mods 생성형 AI 정책: 태그를 "AI-Generated Content", "AI Media", "AI Assisted" 3종으로 나눴다. 잘못 태그하거나 AI 사용을 공시하지 않으면 중재 대상이고, 금지는 아니다. — [Nexus 공지](https://www.nexusmods.com/dispatch/news/14850), [PC Gamer](https://pcgamer.com/gaming-industry/nexus-mods-finally-tightens-the-screws-on-ai-though-its-still-playing-softball-with-the-tide-of-slop), [Shacknews](https://www.shacknews.com/article/150216/nexus-mods-gen-ai-tagging-moderation)
- The Artist(Nexus #722, 신규 캐릭터): 카드 아트 스타일을 설정에서 고를 수 있다. 선택지는 "AI Generated (default)", "Hand-Drawn", "Licensed"(Met Open Access 퍼블릭 도메인 명화), "Openverse"(CC0/CC-BY)다. 작성자는 "don't want to rely on AI assets"라고 썼다. DL 2,388, 추천 16. — [Nexus #722](https://www.nexusmods.com/slaythespire2/mods/722)
- "NO AI" 표기 팩은 반응이 작다.
  - Silent Full Card Art Pack (NO AI): DL 642
  - Regent Full Card Art Pack (NO AI): DL 250
  - Icewreath's Full Art Overhaul (No AI Card Art): Nexus DL 263, Workshop 구독 5,033. 작성자는 Photoshop 수작업이고, 다음 목표로 "rarity coloured card banners"를 희망한다고 적었다.
  - 출처: [Nexus #1157](https://www.nexusmods.com/slaythespire2/mods/1157), [Nexus #469](https://www.nexusmods.com/slaythespire2/mods/469), [Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3765290997)
- AI 팩은 크게 받아들여졌다.
  - Regent Cards Anime Rework(Stable Diffusion과 Nanobanana 2 생성 후 수정): Nexus DL 93,597, Workshop 구독 75,797
  - SilentCardAnimerRework(AI와 Photoshop): 구독 57,860
  - Merchant2CuteII("包含AIGC", AI 생성 콘텐츠 포함): 구독 234,389
  - 출처: [Nexus #344](https://www.nexusmods.com/slaythespire2/mods/344), [Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3747583717), [Merchant2CuteII](https://steamcommunity.com/sharedfiles/filedetails/?id=3748331824)
- AI 의심 자체가 갈등이 된다. KaguyaSilentRavenSkin(구독 113,452)의 설명에는 "Indiscriminately labeling others' artwork as AI-generated is extremely disrespectful."라는 문구가 있다. — [Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3786286239)
- 수작업을 강조하는 표기도 판매 포인트로 쓰인다. Crimson Blade Valkyrie는 "No AI-generated content", Jimbo Ancient는 "Human-Drawn Custom Art"를 내세운다. Nightveil Nekoninja는 라이선스로 AI 학습을 금지한다. — [Valkyrie](https://steamcommunity.com/sharedfiles/filedetails/?id=3747952763), [Jimbo Ancient](https://steamcommunity.com/sharedfiles/filedetails/?id=3784035988)
- AI가 만든 "애니메이션" 사례: Animated Rare Cards(AI generated)는 DL 608, 추천 4이고 출시 후 갱신이 없다. — [Nexus #851](https://www.nexusmods.com/slaythespire2/mods/851)
- AI 코딩에 대한 반감: Card Art Editor 댓글 "vibe coded ... piece of trash". Googly Eyes는 AI가 작성한 코드와 셰이더라고 스스로 밝혔다. — [Card Art Editor](https://steamcommunity.com/sharedfiles/filedetails/?id=3748210488), [Googly Eyes](https://steamcommunity.com/sharedfiles/filedetails/?id=3745864998)

### Inferences
- 커뮤니티 반응은 "AI냐 아니냐"보다 "원작을 대체하는 2차 창작(애니메·모에)이냐"에 더 크게 좌우되는 것 같다. 원작을 대체하는 애니메 테마 AI 팩은 크게 성공했다. 기획처럼 원작과 구별할 수 없는 화풍을 목표로 AI를 쓰는 경우는 "공식을 흉내 낸 AI"로 보여 더 민감할 수 있다. Mega Crit 공개 입장과 "베타 아트를 보여주는 게임에서 AI는 아쉽다"는 의견이 근거다.
- Nexus에 올릴 경우 기획은 최소 "AI Assisted"나 "AI-Generated Content" 태그가 필요하다. 공시하지 않으면 중재 위험이 있다.
- 사람이 작업한 비율을 투명하게 밝히는 편이 유리해 보인다. The Artist처럼 스타일을 고를 수 있게 하는 것은 이미 쓰이는 완화책이다.

### Gaps
- r/slaythespire와 r/slaythespire2의 실제 스레드(애니메이션 팬아트, AI 모드 논쟁)는 Reddit 차단으로 확인하지 못했다.
- X, Pixiv, YouTube에서 개인 작가가 STS 카드 아트를 움직인 작업(Live2D, 애프터이펙트)이 있는지는 확인하지 못했다. 없다는 증거가 아니다.
- Valve의 Steam Workshop 항목에 대한 AI 공시 규칙(게임 스토어 AI 공시와는 별개)은 확인하지 못했다.
- Mega Crit 공식 Discord의 #sts2-modding 분위기와 AI 모드에 대한 공식 코멘트는 접근하지 못했다.

## Q5. 인접 게임의 애니메이션 카드 아트 선례(수요 신호, 간단히)

### Takeaway
상용 카드 게임은 "희귀도·업그레이드 단계가 높을수록 아트가 프레임 밖으로 나오고 움직인다"는 문법을 이미 확립했다. Marvel Snap은 Uncommon 프레임 브레이크, Rare 3D, Epic 애니메이션 순서이고, Hearthstone은 Golden이 원본 아트를 애니메이션화하고 Diamond가 3D로 프레임을 넘는다. 그래서 개념 자체가 독창적이지는 않다. 이 문법을 STS2 공식 아트에 무료 모드로 이식한 사례가 없다는 점이 빈자리다. 자세한 상용 선례는 형제 노트 `animated_card_precedents.md`를 참조.

### Cited Findings
- Marvel Snap 카드 업그레이드 단계: Uncommon "Frame Break"(아트가 테두리를 넘음), Rare "3D", Epic "Animated", Legendary 로고 광택, Ultra 프레임 애니메이션, Infinity. — [Upcomer](https://upcomer.com/what-does-upgrading-cards-do-in-marvel-snap-card-upgrades-and-levels-explained/), [Prima Games](https://primagames.com/tips/marvel-snap-all-card-levels-listed), [Attack of the Fanboy](https://attackofthefanboy.com/guides/marvel-snap-upgrade-tiers-explained-frame-break-3d-animated-and-more/)
- Hearthstone 프리미엄 등급(golden, signature, diamond)은 순수 코스메틱이다. Golden은 "animated takes on the standard illustrations inside a gold border"이고, Diamond는 "entirely new 3D animation, give the art more room". — [hearthstone.wiki.gg Premium](https://hearthstone.wiki.gg/wiki/Premium), [Diamond card](https://hearthstone.wiki.gg/wiki/Diamond_card)
- Gwent 프리미엄 카드는 패럴랙스 GIF에서 착안했고, 카드당 약 720인시가 들었다고 보도됐다. — [PC Gamer](https://www.pcgamer.com/uk/it-all-started-with-a-gif-of-a-cat-how-gwent-went-from-minigame-to-gorgeous-standalone-ccg), [Push Square](https://www.pushsquare.com/news/2017/03/pax_east_2017_cd_projekt_red_panel_delves_into_the_premium_cards_featured_in_gwent)
- Balatro: 바닐라 에디션(foil, holo, polychrome, negative)이 STS1·STS2 포일 모드의 직접 원형이다. Godot용 CC0 "Balatro Foil card effect" 셰이더도 공개돼 있다. 텍스처팩 관리자 Malverk와 GigaJokers 등 팩은 정적 리텍스처이고, 애니메이션 조커 팩은 찾지 못했다(스니펫). — [Balatro Effects](https://steamcommunity.com/sharedfiles/filedetails/?id=3747874832), [GodotShaders](https://godotshaders.com/shader/balatro-foil-card-effect/), [Thunderstore Malverk](https://thunderstore.io/c/balatro/p/Eremel_Mods/Malverk/)
- Monster Train의 카드 마스터리가 STS1 Card Mastery의 원형이다. — [Steam Workshop Card Mastery](https://steamcommunity.com/sharedfiles/filedetails/?id=2962588204)
- OSRS TCG(RuneLite 플러그인)가 STS2 Spire TCG의 원형이다. — [Spire TCG](https://steamcommunity.com/sharedfiles/filedetails/?id=3808863215)

### Inferences
- 플레이어는 Marvel Snap과 Hearthstone을 통해 "등급이 높을수록 프레임을 넘는다"는 문법을 이미 학습했다. 기획의 단계 설계는 직관적으로 이해될 가능성이 높다. 반대로 "Snap 짝퉁"이라는 비교를 피하려면 STS다운 차별점(전투 무대와 크리처 상호작용, 사용 순간의 연출)을 강조해야 한다.
- Gwent의 720인시/카드는 수작업 애니메이션의 비용 상한을 보여준다. STS2 카드 598장을 전부 수작업하는 것은 비현실적이다. AI 보조와 범위 축소(예: 레어 160장부터 시작)가 필요하다는 근거다.

### Gaps
- Inscryption, Monster Train 2, Legends of Runeterra의 모드 판에서 애니메이션 카드 아트 모드는 조사하지 않았다(지시대로 간단히만 다룸).
- Hearthstone 비공식 클라이언트 모드의 존재는 확인하지 않았다.

## Q6. 독창성 분석: 축별 매핑, 빈자리, 가장 가까운 경쟁자의 한계

### Takeaway
개별 요소는 모두 선례가 있다. 카드 아트 애니메이션(Animated Rare Cards, Celestial, GIF 도구), 희귀도 장식(Rare Cards Sparkle, Card Art Editor의 rarity flame, Spire TCG), 프레임 밖 연출과 손패·크리처 상호작용(IroncladFX, More Ironclad Animations의 낙인), hover와 사용 트리거(CCTL interactive GIF, IroncladFX의 집기 트리거)가 모두 존재한다.

그러나 아래 다섯 조건을 동시에 만족하는 모드는 STS1과 STS2 어디에서도 찾지 못했다.
- (1) 공식 아트를 보존한 채 애니메이션화한다
- (2) 희귀도에 따라 프레임 안에서 프레임 밖으로 단계적으로 확장한다
- (3) 전 캐릭터와 전 카드에 일관된 규칙을 적용한다
- (4) 연출이 지속되지 않는다
- (5) 원작과 구별되지 않는 화풍을 목표로 한다

빈자리는 개념이 아니라 이 체계화와 결합에 있다. 가장 큰 위협은 이미 수십만 구독을 가진 카드 플레이 VFX 계열이 같은 카드와 같은 순간을 점유하고 있다는 점이다.

### Cited Findings
- 아래 표의 각 항목 근거는 Q1~Q5에 인용한 원문이다. 대표 근거는 다음과 같다.
  - IroncladFX: "the shields from the card art fly out". [Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=3820147809)
  - Animated Rare Cards: "Almost fully animated card art for all Rare (Gold) cards". [Nexus #851](https://www.nexusmods.com/slaythespire2/mods/851)
  - CCTL SG: interactive GIF는 hover와 상세 보기에서만 재생한다. [sts2.gg](https://sts2.gg/mods/mod-471)
  - Card Art Editor: "rarity flame settings". [sts2.gg](https://sts2.gg/mods/mod-293)
  - Rare Cards Sparkle. [Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=2001434611)
  - Marvel Snap 단계. [Upcomer](https://upcomer.com/what-does-upgrading-cards-do-in-marvel-snap-card-upgrades-and-levels-explained/)

#### 축별 매핑표
| 항목 | 게임 | 규모(2026-10-18) | 정적/동적 | 프레임 안/밖 | 희귀도 단계 | 손패·무대·크리처 상호작용 | 공식 아트 보존 또는 교체 | 트리거 | 지속성 | 코스메틱 전용 |
|---|---|---|---|---|---|---|---|---|---|---|
| **기획** | STS2 | – | 동적 | 커먼은 안, 상위는 밖 | **예(체계적)** | 예(상위 등급) | **보존** | 집기, hover, 드래그, 사용 | 없음 | 예 |
| Animated Rare Cards (AI) | STS2 Nexus | DL 608 / 추천 4 | 동적(AI) | 안(추정) | 레어만(단일 등급) | 아니오(추정) | 원작풍 재현을 주장(검증 불가) | 불명 | 불명 | 예 |
| Celestial Card Art | STS2 WS | 구독 2,122 | 동적(영상, AI 보조) | 안(일반·고대 레이아웃) | 아니오 | 아니오 | **교체**(2차 창작) | 위치별 재생(손패, 더미, 도감) | 없음 | 예 |
| Card Art Editor | STS2 WS·Nexus | 구독 11,831 / DL 9,351 | GIF 지원 도구 | 안(풀아트 옵션) | rarity flame 옵션 | 아니오 | 교체 도구 | 항상 또는 hover만 | 없음 | 예 |
| Custom Card Texture Loader SG | STS2 Nexus | DL 5,919 | GIF 지원 도구 | 안 | 아니오 | 아니오 | 교체 도구 | 항상 또는 hover·상세 보기만 | 없음 | 예 |
| GifSpireCard | STS1 WS | 구독 197 | GIF | 안 | 아니오 | 아니오 | 교체(GIPHY) | 항상 | 없음 | 예 |
| GifTheSpireLib | STS1 WS | 구독 97,978 | 스프라이트 라이브러리 | – | – | – | 도구 | – | – | 예 |
| Rare Cards Sparkle | STS1 WS | 구독 85,057 | 파티클 | 카드 위 | **레어·스페셜만** | 아니오 | 보존 | 항상 | 없음 | 예 |
| Floating & Foil Cards | STS1 WS | 구독 19,197 | 셰이더와 부유 | 카드 전체 | 아니오(수동 지정) | 아니오 | 보존 | 항상 | 없음 | 예 |
| Card Mastery | STS1 WS | 구독 5,954 | 광택 | 카드 전체 | 성취 기반 | 아니오 | 보존 | 항상 | 없음 | 예 |
| Balatro Effects | STS2 WS | 구독 607 | 셰이더, 3D 틸트, 바운스 | 카드 전체 | 아니오(수동 지정) | 아니오 | 보존 | hover | 없음 | 예 |
| Pengo's Tarot 효과 패널 | STS2 WS | 구독 32,000 | 셰이더(약 20종) | 카드 구성요소별 | 아니오 | 아니오 | 보존 | 항상, 사용 시 강조 | 없음 | 패널은 코스메틱(본체는 게임플레이) |
| 3D Card Portraits | STS2 WS | 구독 4,335 | 깊이와 틸트 | 안 | 아니오 | 아니오 | 보존 | hover | 없음 | 예 |
| Spire TCG | STS2 WS | 구독 728 | 포일 반짝임, 풀아트 | 카드 전체 | 수집 등급(5단계) | 개봉 연출만 | 보존 | 항상(옵션) | 없음 | 예 |
| IroncladFX | STS2 WS | 구독 4,631 | 동적 VFX | **밖**(아트에서 튀어나옴) | 아니오(10장 선별) | **예**(손패, 카드, 크리처) | 보존(아트를 소재로 씀) | **집기와 사용** | 일부 지속(바리케이드 방패) | 예 |
| More Ironclad/Defect/Necro/Silent Animations | STS2 WS | 구독 66k/63k/43k/12k | 동적 VFX와 캐릭터 동작 | 밖(무대) | 아니오 | 예(낙인은 손패 카드, 피 줄기는 UI) | 아트와 무관 | 사용, 방어 | 일부 지속(방패 벽) | 예 |
| Regent FX Omnistar | STS2 WS·Nexus | 구독 293,040 | 동적 VFX | 밖(무대) | 아니오 | 예(크리처 타격) | 카드 아트 모티프 기반 | 사용 | 별 고리 지속 | 예 |
| Better Animation / BetterAnimation | STS2 / STS1 | 2.8만 / 31만 | 동적 VFX | 밖 | 아니오 | 예 | 아트와 무관 | 사용 | 일부 | 예 |
| Ryoiki Tenkai | STS1 | 구독 76,128 | 동적 VFX | 밖 | 아니오 | 예 | 무관 | 사용 | **지속 필드** | 예 |
| Beta Art Enabler / HighResolutionCards | STS2 Nexus | DL 448 / 1,833 | 정적 | 안 | 아니오 | 아니오 | 공식 대체 아트 | 토글 | – | 예 |
| 정적 애니메·AI 아트 팩 다수 | STS1·STS2 | 최대 구독 20만 이상 | 정적 | 안(일부 풀아트) | 아니오 | 아니오 | **교체** | – | – | 예 |
| Marvel Snap(상용) | – | – | 동적 | 단계적으로 밖(Uncommon부터) | **예(업그레이드 단계)** | 아니오(카드 안) | 공식 | 항상 | – | 예 |
| Hearthstone Golden/Diamond(상용) | – | – | 동적 | Golden은 안, Diamond는 밖(3D) | 예(프리미엄 등급) | 제한적 | 공식(Golden은 원본 아트 기반) | 항상 | – | 예 |

#### 빈자리
1. **공식 아트 보존, 애니메이션, 희귀도 단계 프레임 돌파의 결합**: STS 모드 판에서 이 조합은 0건이다. 레어만 다룬 Animated Rare Cards는 단일 등급이고 프레임 밖으로 나가지 않는다. IroncladFX는 프레임 밖으로 나가지만 희귀도 체계가 없다.
2. **"커먼은 프레임 안"이라는 절제 규칙**: 경쟁작은 효과를 넣는 카드를 고르는 큐레이션(10장, 20장)이거나 전부에 같은 셰이더를 적용하는 방식이다. 희귀도로 연출 예산을 배분하는 위계 설계는 없다.
3. **비지속성 원칙**: VFX 계열은 바리케이드 방패, 방패 벽, 별 고리, 영역 전개처럼 무대에 남는 연출을 쓴다. "아무것도 남지 않는다"를 명시한 모드는 없다.
4. **바닐라와 구별되지 않는 화풍**: 교체 팩은 대부분 애니메나 밈 화풍이다. 원작풍을 표방한 것은 Animated Rare Cards뿐이고, 반응이 미미해 검증이 안 됐다.
5. **집기, hover, 드래그, 사용을 카드 아트 연출의 트리거 체계로 통합**: hover 전용 재생(CCTL, Card Art Editor)이나 사용 시 VFX(More X, Regent FX)는 각각 있지만, 같은 아트가 집을 때 시작해 사용할 때 터지는 연속 연출은 IroncladFX의 일부 카드(악마의 형상, 타락)에만 있다.

#### 가장 가까운 경쟁자의 한계
- **IroncladFX**(개념상 가장 근접): 10장, 아이언클래드만, 베타 전용이고 2026-10-15에 나온 신작이다. 희귀도 체계와 카드 아트 내부 애니메이션이 없고 일부 연출이 지속된다. 다만 같은 작성자나 다른 제작자가 빠르게 확장할 가능성이 높아 시간 경쟁 리스크가 있다(More X 시리즈는 한 달 사이 4편).
- **Animated Rare Cards**(주제상 가장 근접): Nexus에만 있고, 갱신이 없으며 반응이 미미하다(DL 608). 레어 단일 등급이고 프레임 밖으로 나가지 않는다. AI 생성을 이름에 걸었다.
- **More X Animations와 Regent FX**(규모상 최대 위협): 카드 아트를 움직이지는 않지만 사용 순간의 시선과 연출 슬롯을 이미 점유했고, 수십만 사용자를 가졌다. 같은 카드에서 겹치면 과잉 연출이 된다.
- **Celestial Card Art**: 애니메이션 품질과 설정 UX(위치별 재생 범위)가 기획과 가장 가깝지만, 원작을 교체하는 2차 창작이고 레전트 18장뿐이며 희귀도 체계가 없다.
- **Rare Cards Sparkle과 Floating & Foil Cards**: 희귀도 장식과 포일 수요를 증명했지만 STS1 전용이다. Floating & Foil은 STS2판을 만들지 않겠다고 밝혔다. STS2에서 같은 역할을 하는 Balatro Effects는 구독 607로 작다.

### Inferences
- 독창성은 "새로운 개념"보다 "체계화된 규칙과 품질 기준"에서 나온다. 홍보할 때는 "Marvel Snap식 등급 연출을 STS2 공식 아트에, 바닐라와 구별되지 않게"라는 프레이밍이 정확하다.
- 가장 현실적인 차별화 증명은 같은 카드(예: 바리케이드, 악마의 형상)에서 IroncladFX와 More Ironclad Animations와 나란히 비교되는 것이다. 이 카드들은 이미 다른 모드가 점유했으므로, 초기 쇼케이스는 경쟁 모드가 손대지 않은 카드나 캐릭터(예: 레전트를 제외한 레어, 무색 레어 25장)로 시작하는 편이 충돌과 비교 부담을 줄인다.
- 경쟁 모드와의 공존 설계(같은 카드에 다른 VFX 모드가 훅을 걸면 기획 쪽 프레임 밖 연출을 자동으로 끄고 프레임 안 연출만 남기기)는 기능이자 차별점이 될 수 있다.
- Workshop 노출이 결정적이다. Animated Rare Cards가 Nexus에만 있어 묻힌 것으로 보인다. Workshop과 Nexus 동시 배포, Bilibili 영상이 효과적이다.
- AI 사용은 Nexus에서 반드시 태그해야 한다. 원작풍 목표와 Mega Crit 반AI 입장이 겹치므로 공정을 투명하게 공개하고 수작업 비율을 밝히는 것이 평판 리스크를 줄인다.

### Gaps
- 경쟁 모드의 실제 영상을 시청하지 못했다. 품질, 화풍 일치도, 성능 비교는 하지 못했다.
- 비공개 Discord(Mega Crit #sts2-modding, 중국 QQ 그룹)에서 진행 중인 유사 프로젝트는 알 수 없다.
- 기간이 짧아(More X 시리즈가 한 달에 4편) 이 카탈로그는 몇 주 안에 낡을 수 있다. 출시 직전에 Workshop을 재검색하는 것이 필요하다.
