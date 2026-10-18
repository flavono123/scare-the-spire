# 상용 디지털 카드 게임의 애니메이션 / 프리미엄 / 프레임 브레이크 카드 아트 선례 (STS2 코스메틱 모드용)

> 조사일: 2026-10-18. 대상 모드: 카드 hover/집기/사용 시 공식 STS2 카드 아트가 짧게 애니메이션. 일반(Common)은 아트 프레임 안에서만, 희귀도가 높을수록 프레임을 뚫고 나와 손패/전투 무대/크리처와 상호작용. 바닐라 위의 순수 코스메틱 데코레이터, 지속 효과 없음, 원작 화풍과 구별 불가능한 수준을 목표. 렌더링 대상은 Godot 4 + 2D 수작업 페인팅 (3D 카드 모델 없음).
>
> 표기: "(스니펫)" = 검색 결과 요약으로만 확인했고 본문을 직접 읽지 못한 출처. "(팬/비공식)" = 개발사 공식이 아닌 출처.

## 1. Hearthstone: 골드 / 다이아몬드 / 시그니처 카드

### Takeaway
Hearthstone 골드 카드는 "원본 일러스트 + Photoshop에서 만든 색상별 마스크 + Unity의 레이어드 셰이더(카드당 최대 4개 이펙트 레이어)" 방식이고, 움직일 부위만 원본에서 지워(paint-out) 따로 움직인다. 이 방식은 원본 화풍을 거의 그대로 보존하면서 1인이 하루 3~4장을 처리할 만큼 싸다. 프레임을 뚫고 나오는 연출은 3D 모델 기반의 다이아몬드 카드에만 있으며, 전설 하수인 약 120장에 한정된 최상위 등급이다.

### Cited Findings
**골드 카드 제작 공정 (1차 출처: Jon Briggs, 2015-03-05 공식 블로그)**
- Jon Briggs는 2011년 Hearthstone 팀 최초의 QA 보조 리드로 들어왔고, 골드 카드를 프로토타이핑해 만들었으며 Goblins vs Gnomes(GvG) 골드 세트 대부분을 애니메이션했다. — [Hearthside Chat: Golden Cards with Jon Briggs (2015-03-05)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- 공정은 두 단계다. 먼저 Photoshop에서 아트에 마스크를 만들고, 그 뒤 보조 비주얼 이펙트를 만든다. 마스크가 각 이펙트가 나타날 위치를 "할당"한다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- Piloted Shredder 예시에서 마스크는 색상으로 구분됐다. 회전 톱날, 움직이는 팔, 파편, 연기/왜곡이 각각 별도 영역이다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- 골드 카드 한 장은 최대 4개 레이어를 가질 수 있다("Every golden card can have up to four layers"). 이펙트는 재사용되기도 한다. Piloted Shredder의 굴뚝 연기 레이어가 눈과 입의 불꽃도 겸한다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- 팔을 흔드는 식의 움직임은 원본 아트에서 그 부위를 먼저 지우고(paint out), 별도 요소로 다시 얹어 독립적으로 움직여야 한다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- 커뮤니티 위키에 따르면 그 결과 골드 카드의 베이스 이미지는 일반 카드보다 단순한 경우가 많다. — [Hearthstone Wiki: Card art](https://hearthstone.fandom.com/wiki/Card_art) (스니펫)
- 작업량: GvG는 120장 이상에 Boom Bot 같은 토큰까지 골드 버전이 필요했다. 약 2개월 동안 하루 평균 3~4장을 만들었고, 장당 시간은 "애니메이션 요소가 있는지"에 따라 달랐다. 즉 모든 골드 카드가 애니메이션되는 것은 아니었다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- 성능 제약: 보드 전체가 골드 하수인이고, 손패도 골드 카드이며, 골드 영웅 초상화와 영웅 능력이 양쪽에 있어도 모든 플랫폼에서 문제없이 돌아가야 한다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- 엔진과 셰이더: FX 아티스트 Hadidjah는 Reddit에서 "거의 모든 것을 Unity로 만들고, 골드 카드는 레이어드 셰이더와 마스크로 구동되며, 마스크와 텍스처는 Photoshop에서 만든다"고 했다. 또 이 역할은 전통적인 "골드 아티스트"보다 FX/셰이더/머티리얼 아티스트에 가깝다고 했다. — [outof.games devtracker (Reddit 인용)](https://outof.games/devtracker/hearthstone/reddit/r-hearthstone/2095) (스니펫)
- 셰이더는 시간이 지나며 업그레이드돼 더 섬세한 애니메이션이 가능해졌다. 구카드 애니메이션 개선은 확장팩 사이의 짧은 여유 시간에 한다. Hadidjah는 2016년 초부터 Blizzard에서 일했다. — [HearthPwn: Design Philosophy on Hearthstone's Golden Animations with Hadidjah (2017-09-19)](https://www.hearthpwn.com/news/3355-design-philosophy-on-hearthstones-golden)
- (팬/비공식) Austin Curzon은 Photoshop + After Effects로 골드 카드를 재현하면서, Blizzard는 그보다 Unity 내부 셰이더를 쓸 가능성이 높다고 적었다. — [Austin Curzon portfolio](https://austincurzon.com/hearthstone-golden-card-animations) (스니펫)

**다이아몬드 카드 (프레임 브레이크)**
- Patch 20.0.0.77662(2021-03-25), Forged in the Barrens와 함께 도입됐고, 프레임은 20.2(2021-05-04)에 갱신됐다. 설명은 "완전히 새로운 3D 애니메이션, 더 넓은 카드 아트 영역, 다이아몬드 테두리"다. — [Hearthstone Wiki (wiki.gg): Diamond card](https://hearthstone.wiki.gg/wiki/Diamond_cards)
- 범위: Patch 37.0.0.254477 기준으로 다이아몬드 버전이 있는 수집 가능 카드는 119장이고, 전부 전설이다. 제작 불가이며, 보상 트랙(주로 유료), 상점 번들, 업적으로만 얻는다. 프레임 디자인은 Luke Mancini(Chadd Nervig의 X 글 인용). — [Hearthstone Wiki: Diamond card](https://hearthstone.wiki.gg/wiki/Diamond_cards)
- 골드 카드는 반짝이는 프레임 안에서 캐릭터가 움직이지만, 다이아몬드는 인물이 움직이며 화려한 테두리 밖으로 실제로 튀어나온다. — [Hearthstone Wiki: Quality](https://hearthstone.wiki.gg/wiki/Quality) (스니펫)
- PC Gamer는 팬 아티스트들이 오래전부터 캐릭터가 카드 프레임을 뚫고 나오는 그림을 그려 왔고, 다이아몬드는 그 룩을 "3D 모델링된 아트워크가 화려한 다이아몬드 테두리 밖으로 튀어나오는" 형태로 게임에 넣은 것이라고 설명했다. — [PC Gamer: Hearthstone is getting 3D animated 'Diamond' cards](https://www.pcgamer.com/hearthstone-diamond-cards-announcement/) (스니펫, 본문 미확인); [Shacknews (2021)](https://www.shacknews.com/article/123376/hearthstone-adds-3d-animated-diamond-cards-for-next-tavern-pass)
- 다이아몬드 카드는 희귀도 단계가 아니라 순수 코스메틱 옵션이다. — [Hearthstone Wiki: Quality](https://hearthstone.wiki.gg/wiki/Quality)

**시그니처 카드**
- 일반 버전과 다른 아트워크를 쓰며, 독특한 색조나 아트 테마가 있다. March of the Lich King 이후 세트마다 여러 장이 나온다. 하단에 직업 색 리본이 있고 확장팩 워터마크가 없다. Patch 37.0.0.254477 기준 622장. — [Hearthstone Wiki: Signature card](https://hearthstone.wiki.gg/wiki/Signature_card)
- 애니메이션 수준에 대해서는 출처끼리 충돌한다. Signature 페이지는 "March of the Lich King 시그니처를 제외하면 골드처럼 애니메이션된다"고 하고, Quality 페이지는 "가볍게만 애니메이션된다(only lightly animated)"고 한다. 검색 스니펫에는 예전 판이 "애니메이션 없음"이라고 했다는 언급도 있다. — [Signature card](https://hearthstone.wiki.gg/wiki/Signature_card); [Quality (2024-08-22 편집)](https://hearthstone.wiki.gg/wiki/Premium)
- 일반 팩에서 시그니처가 나올 확률은 1/181. — [Hearthstone Wiki: Quality](https://hearthstone.wiki.gg/wiki/Quality) (스니펫)

### Inferences
- 골드 방식(원본 픽셀 유지 + 마스크 영역별 셰이더 + 일부 paint-out)은 "원작 스튜디오가 만든 것 같은" 결과를 가장 싸게 얻는 검증된 공정이다. 원본 붓터치가 화면 대부분에 그대로 남고, 움직임은 연기·불꽃·물결·톱날·망토 끝처럼 국소 부위에 한정되기 때문이다. Godot 4의 `canvas_item` 셰이더에 RGBA 마스크 텍스처 하나(채널당 효과 영역 하나, 최대 4개)를 넘기는 구조로 거의 1:1 이식할 수 있다.
- Hearthstone 계층에서 "프레임 밖으로 나오기"는 최상위 등급 전용(다이아몬드, 전설 약 120장)이고 비용이 3D 모델링 급이다. 모드의 "높은 희귀도 = 프레임 브레이크"라는 매핑은 이 구도와 일치한다. 다만 STS2 희귀(Rare) 카드는 수가 많아서 다이아몬드처럼 장당 손작업을 하면 감당할 수 없다. 프레임 브레이크는 템플릿화된 연출(예: 파티클/실루엣 레이어가 프레임 밖으로 넘침)과 소수 카드의 수작업으로 나누는 편이 현실적이다.
- 시그니처 카드는 "아트 자체를 새로 그림"이라는 정반대 축이다. 공식 아트를 유지해야 하는 이 모드에는 해당하지 않는다.

### Gaps
- Hearthstone 골드 셰이더의 정확한 기법(UV 스크롤, 플로우맵, 플립북 비율 등)을 설명한 공식 GDC 발표나 기술 글은 찾지 못했다. Hadidjah의 Reddit 언급과 Briggs 블로그가 최선이다.
- 다이아몬드 카드 제작 공정(3D 모델 해상도, 리깅 툴, 장당 공수)을 다룬 1차 출처를 찾지 못했다. PC Gamer 기사 본문도 열리지 않았다.
- 골드 카드 중 실제로 애니메이션이 있는 카드 비율에 대한 공식 통계는 없다.

## 2. Marvel Snap: 업그레이드 사다리와 프레임 브레이크

### Takeaway
Marvel Snap은 "희귀도가 올라갈수록 프레임 밖으로 나온다"는 구조에 가장 가까운 선례다. 다만 순서는 정적 프레임 브레이크(Uncommon) → 3D 패럴랙스(Rare) → 아트 애니메이션(Epic) → 로고 광택(Legendary) → 프레임 애니메이션(Ultra) → 스플릿 마감재(Infinity)다. 즉 프레임 브레이크가 가장 싸고 먼저 오며, 움직임은 그 뒤에 온다. 제작은 사내 Unity 에디터 툴 CAT으로 레이어를 분리하고 heightmap과 패럴랙스를 적용하는 방식이다.

### Cited Findings
- 7단계 등급과 비용(Credits/Boosters): Common(회색, 평면 아트) → Uncommon "Frame Break"(초록, 아트가 프레임 밖으로 확장, 25/5) → Rare "3D"(파랑, 100/10) → Epic "Animated"(보라, 아트에 미세한 애니메이션, 200/20) → Legendary "Shiny Logo"(주황/금, 이름표 광택, 300/30) → Ultra "Animated Frame"(빨강, 테두리에 에너지 펄스 애니메이션, 400/40) → Infinity "Split"(500/50). 전부 순수 코스메틱이다. — [Marvel Snap Zone: Progression Guide](https://marvelsnapzone.com/marvel-snap-progression-guide/); [MobileMatters: Card Levels Explained](https://mobilematters.gg/gaming/marvel-snap-card-levels-explained-cost-collection-level-cosmetics); [Upcomer](https://upcomer.com/what-does-upgrading-cards-do-in-marvel-snap-card-upgrades-and-levels-explained/) (스니펫)
- Infinity 스플릿은 카드를 Common으로 리셋한 사본을 만들고, 그 사본을 다시 올리면 기존 등급 효과가 스플릿 효과 위에 누적된다. — [Marvel Snap Zone](https://marvelsnapzone.com/marvel-snap-progression-guide/) (스니펫)
- 스플릿 마감재(Finish) 4종: Foil(배경 무지개 광택), Prism(무지개와 블록형 만화경 패턴), Ink(아트를 흑백으로, 4번째 스플릿부터), Gold(배경을 단색 금으로 바꾸고 캐릭터 색은 유지, 5번째부터). 플레어(Flare) 4종: Tone(점선 테두리 2줄 회전), Glimmer(작은 입자 회전 + 페이드), Stardust(별 모양 입자), Krackle(큰 원형 입자, 6번째부터). 색상 변형 8종. — [SNAP.FAN: Infinity Splits guide (2024-11-27)](https://snap.fan/guides/infinity-splits-and-frame-breaks-guide/)
- 제작 툴: Second Dinner의 사내 툴 CAT은 Unity 에디터 안에서 카드를 실시간으로 조형(sculpt)하고, heightmap을 만들고, 애니메이션과 패럴랙스를 넣는다. 에디터 밖으로 내보낼 필요가 없다. 2D 카드 아트를 3D처럼 느끼게 해서, 캐릭터가 프레임을 박차고 나오는 "frame break"를 지원하는 것이 목적이었다. — [Unity Case Study: MARVEL SNAP (2025-07-17)](https://unity.com/case-study/marvel-snap)
- 프레임 브레이크의 기원: 마블 히어로의 "실물보다 큰" 매력을 카드에 담는 것이 초기 과제였고, 아트팀이 찾은 답이 프레임 브레이크였다. — [Unity Case Study](https://unity.com/resources/marvel-snap) (스니펫)
- 규모: CAT을 잘라 80명 이상의 외부 아티스트·잉커에게 배포해 온보딩했다. 기본 카드 200장 이상, 변형 1,000개 이상, 스플릿 스타일 8종. 리드 테크니컬 아티스트 Kyle Harrison은 모바일 실기기에서 최악 시나리오(에셋 다운로드 중 포함)로 성능을 검증한다. 레이어 수, 메모리, 프레임레이트 수치는 공개하지 않았다. — [Unity Case Study](https://unity.com/case-study/marvel-snap)
- 카드 아트를 그린 Penny Arcade의 Gabe는 효과를 "엄청나게 정교한 패럴랙스"라고 했고, 그림을 "백만 개의 레이어"로 나눠 그리고 구성해야 했다고 적었다. 즉 아트 단계부터 레이어 분리를 전제로 그린다. — [Penny Arcade: Marvel Snap! (2022-07-11)](https://www.penny-arcade.com/news/post/2022/07/11/marvel-snap) (스니펫)
- 모바일에서 3D 효과는 가속도계/자이로를 사용한다. — [Seasoned Gaming: Marvel Snap: The Art of the Cards (2022-10-19)](https://seasonedgaming.com/2022/10/19/review-marvel-snap-the-art-of-the-cards/); [God is a Geek review](https://godisageek.com/reviews/marvel-snap-review/) (스니펫)
- (팬/비공식) 카드 뷰어 도구의 레이어 보기는 전체 아트를 보여 준 뒤 각 텍스처 플레인을 그리는 순서대로 보여 준다. 여러 장의 평면 레이어가 깊이별로 쌓여 있다는 정황이다. — [SnapComplete Card Lab](https://snapcomplete.com/tools/card-lab) (스니펫)
- GDC 2023 Ben Brode의 "Designing MARVEL SNAP"은 게임 디자인 발표이고, 카드 렌더링 기술은 다루지 않는 것으로 보인다. — [GDC Vault](https://gdcvault.com/play/1029024/Designing-MARVEL-SNAP) (스니펫)

### Inferences
- Snap 사다리가 주는 핵심 교훈: (a) "프레임 밖으로 나온 정적 컴포지트"는 싸고 읽기 쉬워서 낮은 단계에 둘 수 있다. (b) 움직임(아트 애니메이션, 프레임 애니메이션)은 그보다 비싼 단계다. (c) 최상위는 아트를 다시 그리지 않고 셰이더 마감재(foil/prism/ink/gold)와 플레어 파티클로 차별화한다. 이 셋은 전부 원본 아트를 건드리지 않는 템플릿 효과라서, 카드 수가 많은 STS2 모드에서 대량 적용하기 좋은 축이다.
- Snap의 3D(패럴랙스)는 "그릴 때부터 레이어로 나눈 아트"가 전제다. STS2 공식 아트는 단일 평면 PNG(게임 PCK에서 추출)이므로, 레이어 분리를 하려면 전경 컷아웃과 배경 인페인팅이 필요하다. 이 작업이 화풍 일치성의 최대 위험 요소다. 인페인팅이 티 나면 "싸구려" 인상을 준다.
- Snap에서 프레임 브레이크는 플레이 중에도 상시 보이는 정적 상태다. 모드는 "hover/사용 시 일시적"이라서 상시 가독성 부담이 Snap보다 작고, 그만큼 짧고 강한 연출이 허용된다.

### Gaps
- Second Dinner의 카드 아트 레이어 수, heightmap 작성법, 프레임 브레이크용 아트 가이드(어느 부위를 밖으로 빼는지)에 대한 공식 발표나 아티스트 인터뷰는 찾지 못했다.
- Marvel Snap에 3D/모션 효과를 끄는 설정이 있는지 확인하지 못했다.

## 3. 기타 게임: Gwent, Legends of Runeterra, Shadowverse, Pokémon TCG Pocket, Master Duel, MTG Arena

### Takeaway
고품질 "살아 있는 그림"을 노린 게임(Gwent 프리미엄, Hearthstone 다이아몬드, Pokémon Pocket 이머시브)은 2D 일러스트를 3D 부조/모델로 재구성해 리깅하는 비싼 공정을 쓴다. Gwent는 카드당 약 720인시(man-hour)로 보도됐다. 사용 시점 연출로는 LoR의 챔피언 레벨업 전체 화면 애니메이션이 대표적이다. 희귀도와 시각 강도의 매핑은 대부분 "상위 등급일수록 더 많은 움직임 + 프레임 밖 확장 + 사용 시 VFX" 순서다.

### Cited Findings
**Gwent (CD Projekt Red)**
- 프리미엄 카드 공정: 내러티브 디자이너가 대상 선정 → 게임플레이 디자이너가 능력 결정 → 일러스트레이터가 "작지만 완결된 이야기"를 담은 단일 이미지 → 3D 아티스트가 완성된 2D 일러스트를 바탕으로 "일종의 부조(bas-relief)" 모델 제작(보통 모델에 텍스처를 입히는 순서를 뒤집은 것) → 스켈레톤 삽입 → 애니메이터가 움직임 → VFX(생성·배치·피격 이펙트) → 사운드. — [playgwent.com: Gwent Cards — How They Come to Life (2017-08-11)](https://www.playgwent.com/en/news/6591/gwent-cards-how-they-come-to-life)
- 프레임 문제 처리: 자연스러운 움직임이 캐릭터를 프레임 밖으로 밀어내는 경우, Ciri 카드는 장면 마지막 순간에 시간을 멈추는 방식을, Tibor Eggebracht는 일러스트레이터가 잡은 장면 안에서 무한 루프를 만드는 방식을 택했다. — [playgwent.com (2017)](https://www.playgwent.com/en/news/6591/gwent-cards-how-they-come-to-life)
- 기원: 아트 디렉터 Katarzyna Redesiuk가 고양이 패럴랙스 GIF를 보고, 일러스트에 포일만 입히는 것 이상의 프리미엄 카드를 구상했다. — [PC Gamer: 'It all started with a gif of a cat'](https://www.pcgamer.com/it-all-started-with-a-gif-of-a-cat-how-gwent-went-from-minigame-to-gorgeous-standalone-ccg/) (스니펫, 본문 미확인)
- 비용: PAX East 2017 패널 보도에 따르면 프리미엄 카드 한 장에 720인시가 든다. 공정은 스케치, 채색, 클린업, 리깅, 오디오(짧은 사운드 스팅), 루핑이다. — [Push Square: PAX East 2017 CDPR panel](https://www.pushsquare.com/news/2017/03/pax_east_2017_cd_projekt_red_panel_delves_into_the_premium_cards_featured_in_gwent) (스니펫. 본문 요청은 403으로 미확인)
- 애니메이터 Ryan Sequeira 한 명이 30장 이상의 프리미엄 카드 키프레임 애니메이션을 맡았다. — [ryanimator.com: Gwent](https://www.ryanimator.com/gwent-the-witcher-card-game) (스니펫)
- 관련 강연: Katarzyna Redesiuk, "Creating Living Images: Premium Cards of Gwent"(2D → 3D → 애니메이션 → VFX → 사운드 파이프라인, 다학제 팀 운영). — [Game Anim (2018-09-09)](https://www.gameanim.com/2018/09/09/creating-living-images-premium-cards-of-gwent-the-witcher-card-game/)
- 2019년에 scrap으로 프리미엄 카드를 제작하는 경로를 끊는 경제 개편이 있었다. — [Variety (2019)](https://variety.com/2019/gaming/news/gwent-economy-premium-card-changes-1203097618/) (스니펫)

**Legends of Runeterra (Riot)**
- 챔피언 스킨 티어(커뮤니티 관찰 기반): Common = 레벨 1/2 카드의 새 아트와 플레이버 텍스트. Rare = 그에 더해 레벨업 애니메이션 리스킨. Epic = 완전히 새로운 레벨업 애니메이션. 위키 스스로 "관찰 기반"이라고 단서를 단다. — [League of Legends Wiki: Card style (LoR)](https://leagueoflegends.fandom.com/wiki/Card_style_(Legends_of_Runeterra)) (스니펫)
- 레벨업 애니메이션은 외주 3D 파이프라인으로 만들었다. 예: Kudos Productions의 Xerath 레벨업 크레딧은 "Champion Level Up 3D, Rig, Animation and VFX". — [ArtStation: Xerath Champion Level Up, Kudos Productions](https://www.artstation.com/artwork/r9P0VL) (스니펫)
- 예: Pulsefire Jhin 스킨의 레벨업은 건물에서 떨어져 포털로 들어갔다가 다른 포털로 나와 저격하는 새 연출이다. 일부 Rare 스킨(Bard)은 같은 애니메이션에 의상만 바꿨다. — [TheGamer: Best Champion Skins in LoR](https://www.thegamer.com/legends-of-runeterra-lor-best-champion-skins/) (스니펫)

**Shadowverse / Shadowverse: Worlds Beyond (Cygames)**
- 원작 Shadowverse에는 일러스트가 움직이는 "animated card"가 있다. 제작 비용은 골드 등급 일반 250 vials 대 애니메이티드 600, 전설 1000 대 2500으로 일반의 2.4~2.5배다. — [Shadowverse Wiki: Card](https://shadowverse.fandom.com/wiki/Card) (스니펫)
- Worlds Beyond(2025)에는 프리미엄 카드보다 정교한 애니메이션, 화려한 프레임, 사용 시 시각 효과를 갖춘 "fully animated" 등급이 따로 있다. — [Shadowverse: Worlds Beyond 공식: Infinity Evolved](https://shadowverse-wb.com/en/cards/pack/infinity-evolved/) (스니펫. 페이지 본문은 제목만 반환돼 미확인)
- Worlds Beyond의 애니메이티드 카드는 팩에서 나오지 않고, 팩 구매 포인트 250점 특별 보상으로 교환한다. — [GameWith](https://gamewith.net/shadowverse-wb/68465) (스니펫)
- Worlds Beyond에는 "전투 중 간이 카드 연출 표시(Display simple card effects during battle)" 옵션이 있어 대전 중 연출을 줄일 수 있다. — [GameWith](https://gamewith.net/shadowverse-wb/68449) (스니펫)

**Pokémon TCG Pocket (Creatures Inc. + DeNA)**
- "Immersive Card"는 별 3개 희귀도다. 길게 누르면 카드가 화면 전체로 커지고 음악과 함께 애니메이션 장면이 재생되며, 카메라가 아트워크를 훑으면서 카드 테두리 너머의 주변 환경까지 드러낸다(예: Pikachu 카드에서 숲과 Ponyta, Nidoran이 드러남). 재생은 컬렉션에서만 언급된다. — [pocketcards.net: Immersive Cards (2024-10-30)](https://pocketcards.net/blog/immersive-cards-3d-art-pokemon-tcg-pocket)
- 공식 자료는 이를 "3D 느낌의 새 일러스트"로 설명한다. 개발은 Creatures Inc.와 DeNA다. — [Sportskeeda](https://sportskeeda.com/pokemon/everything-know-pokemon-tcg-pocket-immersive-cards); [GGRecon](https://www.ggrecon.com/guides/pokemon-tcg-pocket-everything-we-know/) (스니펫)

**Yu-Gi-Oh! Master Duel (Konami)**
- 카드 아트 애니메이션 대신 마감재를 쓴다. Glossy는 테두리와 텍스트가 은색 외곽선이고 팩 개봉 때 애니메이션이 재생된다. Royal은 만화경 포일이며 SR/UR만 가능하다. — [Upcomer: Master Duel crafting guide](https://upcomer.com/the-best-and-easiest-yugioh-master-duel-crafting-guide) (스니펫)
- 움직임은 카드가 아니라 특정 몬스터의 소환 연출(예: Number 39: Utopia, Accesscode Talker)로 처리하고, 업데이트마다 대상을 늘린다. — [YGOrganization: More summon and ace monster animations](https://ygorganization.com/master-duel-more-summon-and-ace-monster-animations/) (스니펫)

**MTG Arena (Wizards)**
- 애니메이티드 카드 아트 스타일을 다룬 공식 출처는 찾지 못했다. 일부 카드는 전장 진입 시 애니메이션이 있다는 팬 글(2020년경, 의견성)만 있다. — [gamersdecide: MTG Arena best animations](https://gamersdecide.dev.weebpal.com/articles/mtg-arena-best-animations) (팬/비공식, 스니펫)

### Inferences
- "프레임 밖 환경을 드러내는" Pokémon Pocket 이머시브와 Gwent 프리미엄은 모두 원작 일러스트 바깥의 그림을 새로 만들어야 하는 연출이다. 화풍 일치성을 지키려면 원작 아티스트 수준의 추가 페인팅이 필요해 모드에는 비용이 가장 높다. 모드의 높은 등급 프레임 브레이크는 "아트 바깥 세계를 새로 그리기"보다 "아트 속 요소(불꽃, 칼날, 연기, 투사체)가 프레임 밖으로 넘쳐 나오기"로 정의하는 편이 Snap/Hearthstone 다이아몬드 계열에 가깝고 현실적이다.
- LoR 레벨업과 Master Duel 소환 연출은 이벤트에 묶인 1회성 연출이다. 모드의 "카드 사용 시 짧게"라는 구조와 일치하고, 손패에서는 조용하다가 사용할 때 폭발하는 설계의 선례다.
- Shadowverse의 비용 배율(약 2.5배)과 Hearthstone 다이아몬드의 희소성은 "최상위 연출은 소수 카드에만"이라는 업계 관행을 보여 준다.

### Gaps
- Shadowverse 애니메이티드 카드가 Spine인지, Live2D인지, 다른 툴인지 출처를 찾지 못했다(Live2D 사용 여부는 미확인).
- Pokémon Pocket 이머시브 카드 제작 공정(3D인지 2.5D 레이어인지)에 대한 개발사 인터뷰나 CEDEC 발표를 찾지 못했다.
- MTG Arena 애니메이티드 카드 스타일의 공식 정보를 찾지 못했다.
- Gwent 720인시 수치는 Push Square 보도 스니펫으로만 확인했다(본문 403).

## 4. 공통 기술 도구와 "원작 스튜디오가 만든 것 같은" 결과의 효율

### Takeaway
비용 대비 원작 화풍 보존성은 대략 (1) 마스크 기반 셰이더 효과(UV 스크롤/왜곡/글로우, Hearthstone 골드) > (2) 부분 paint-out + 2D 변형/본(Spine) 애니메이션 > (3) 레이어 분리 + 패럴랙스/heightmap(Snap) > (4) 2D→3D 부조 + 리깅(Gwent, 다이아몬드) 순이다. "프레임 위로 그리는 pop-out 레이어"와 "사용 시 트리거 파티클"은 어느 방식에도 얹을 수 있는 공통 요소다.

### Cited Findings
- 마스크 + 레이어드 셰이더: Hearthstone 골드는 색상/채널별 마스크로 이펙트 영역을 지정하고, 카드당 최대 4개 이펙트 레이어를 쓴다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/); [Hadidjah via outof.games](https://outof.games/devtracker/hearthstone/reddit/r-hearthstone/2095) (스니펫)
- 상용 Unity 에셋 "Hyper Card"(Hearthstone 스타일 카드 셰이더)는 베이스 레이어(RGB 채널 블렌드 마스크로 아트·비용·희귀도 영역 정의)와 FX 레이어(RGB 마스크 기반 왜곡/변위 효과 최대 3개)로 구성된다. — [Unity Forum: Hyper Card](https://forum.unity.com/threads/released-hyper-card-hearthstone-card-like-shaders.500442/) (스니펫)
- Timothy Bermanseder의 ArtStation 연구는 골드 카드 효과를 "주로 셰이더와 몇 장의 텍스처로 구동되는 2.5D 효과"로 재현했다(원본 셰이더 Dan Moran). — [ArtStation: Hearthstone Custom Gold Cards](https://www.artstation.com/artwork/Eg5RN) (스니펫); 관련 영상 [Shaders Case Study - Hearthstone: Golden Cards](https://www.youtube.com/watch?v=OYjMnMZe1Vg)
- 패럴랙스/heightmap: Snap CAT은 조형, heightmap, 애니메이션, 패럴랙스를 실시간으로 지원하고, 아트는 처음부터 여러 레이어로 그린다. — [Unity Case Study](https://unity.com/case-study/marvel-snap); [Penny Arcade](https://www.penny-arcade.com/news/post/2022/07/11/marvel-snap) (스니펫)
- 2D→3D 부조 + 스켈레톤: Gwent 프리미엄. — [playgwent.com](https://www.playgwent.com/en/news/6591/gwent-cards-how-they-come-to-life)
- 3D 모델 기반 pop-out: Hearthstone 다이아몬드. — [Hearthstone Wiki: Diamond card](https://hearthstone.wiki.gg/wiki/Diamond_cards); [PC Gamer](https://www.pcgamer.com/hearthstone-diamond-cards-announcement/) (스니펫)
- 셰이더 마감재와 입자 플레어(foil/prism/ink/gold, tone/glimmer/stardust/krackle)는 아트를 다시 그리지 않고 카드 전체에 일괄 적용되는 효과다. — [SNAP.FAN (2024-11-27)](https://snap.fan/guides/infinity-splits-and-frame-breaks-guide/)
- STS2 자체의 크리처(캐릭터, 몬스터, 소환수, 오브젝트)는 Godot PCK 안의 Spine 액터다(이 리포의 `codex-pet-sprite` 스킬이 이를 추출해 렌더링한다). — 로컬 리포 스킬 설명: `codex-pet-sprite`
- 참고 리드(본문 미확인): [Stoyan Dimitrov: Parallax Magic Cards (2021-07-30)](https://stoyan3d.wordpress.com/2021/07/30/parallax-magic-cards/); [Valerio Marty: Creating a card shader with 3D content (Medium)](https://valeriomarty.medium.com/creating-a-card-shader-with-3d-content-f3324ca8ffdc)

### Inferences
- **Common(프레임 안)**: Hearthstone 골드 방식을 권장한다. 카드별로 RGBA 마스크 PNG 1장(R=흐름/UV 스크롤, G=왜곡/열기, B=발광 펄스, A=플립북/입자 방출 영역)과 필요하면 플로우맵 1장을 만든다. 이것을 Godot `canvas_item` 셰이더로 원본 아트 위에서 시간에 따라 변조하면, 원본 픽셀을 대부분 그대로 쓰므로 화풍 이탈이 가장 적다. 셰이더 효과 라이브러리는 공용으로 쓰고, 마스크만 카드별로 칠하는 구조라 카드당 비용이 낮다(Briggs 기준 하루 3~4장).
- **Uncommon(경계 넘침)**: 같은 마스크 체계에 "프레임 밖 방출 영역"을 추가한다. 아트 경계에 닿은 연기, 불꽃, 칼날 궤적을 프레임 위 CanvasItem(더 높은 `z_index`, 별도 노드, 클리핑 없음)으로 이어 그린다. Snap의 정적 프레임 브레이크처럼 "실루엣 일부가 프레임을 넘는" 연출은 전경 컷아웃 1장만 있으면 된다. 배경 인페인팅이 필요 없다(원본 아트 위에 같은 픽셀의 컷아웃을 겹쳐 프레임 위로 올리기만 하면 되기 때문).
- **Rare 이상(손패, 무대, 크리처와 상호작용)**: 사용 시 트리거 파티클/투사체를 GPUParticles2D나 미리 렌더한 스프라이트 시트로 만들어 카드 위치에서 대상 크리처로 날린다. 이때 크리처 쪽은 STS2의 기존 Spine 리그와 피격 VFX를 재사용하면 "원작 같은" 결과를 가장 싸게 얻는다(추론. Spine 런타임 접근 가능 여부는 별도 검증 필요).
- 패럴랙스(Snap 3D)는 레이어 분리와 배경 인페인팅이 필요하다. STS2 아트는 단일 평면이라 인페인팅 품질이 화풍 일치성을 좌우하고, 깊이 경계에서 "종이 인형" 느낌이 나기 쉽다. 이 연출은 소수 카드에만 쓰거나, hover 시 아주 작은 오프셋으로만 쓰는 것이 안전하다.
- 3D 부조/모델 재구성(Gwent, 다이아몬드)은 장당 수백 인시 규모이고, 손그림 브러시 질감을 3D 셰이딩이 망가뜨릴 위험이 있다. 모드 목표("원작 화풍과 구별 불가")와 비용 양쪽에서 최하위 효율이다.

### Gaps
- Hearthstone이 플로우맵을 쓰는지, 순수 UV 스크롤/노이즈 왜곡인지 확인한 1차 출처가 없다(Bermanseder/YouTube 케이스 스터디 본문 미확인).
- Godot 4에서 2D 카드 아트에 이런 셰이더를 적용한 공개 사례나 성능 수치는 조사 범위 밖이어서 찾지 않았다.

## 5. 디자인 원칙: 가독성, 노이즈, 성능 예산, 접근성, "장식"으로 남기기

### Takeaway
Hearthstone 팀의 명문화된 원칙은 네 가지다. (1) 애니메이션은 카드를 꾸며야지 초점이 되면 안 된다. (2) 게임플레이 신호(은신, 격노 등)와 헷갈리면 안 된다. (3) 노출 시간이 짧을수록 더 "시끄럽게" 해도 된다(주문 > 하수인 > 무기 > 영웅). (4) 최악의 경우(보드와 손패 전체가 프리미엄)에도 성능을 보장해야 한다. 이는 hover/사용 시에만 짧게 재생하는 모드 설계를 직접 뒷받침한다.

### Cited Findings
- 애니메이션은 카드를 향상시키되 초점이 되지 않아야 한다. 회전 터빈이나 톱날 같은 작은 움직이는 부위를 선호한다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- 골드 카드는 이야기를 전해야 한다. 카드 기능을 아트에 연결하거나, 아트가 다음에 할 행동을 암시하는 식이다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- 효과가 게임플레이를 혼동시키면 안 된다. 연기 애니메이션은 은신(Stealth)으로, 과한 붉은색은 격노(Enrage)로 오인될 수 있다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- 가독성을 위해 설정(lore)을 바꾸기도 한다. Gahz'rilla의 파란 얼음 숨결은 따뜻한 색 장면과 충돌해 주황 불길과 모래폭풍으로 바뀌었다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- "시끄러움"은 속도와 밝기로 정의된다. 주문이 가장 시끄럽고(손패에서 짧게, 또는 사용 시 크게만 보이므로), 그다음 하수인, 무기, 영웅 순이다(영웅은 항상 보드에 있으므로 가장 미묘하게). 이것은 엄격한 규칙이 아니라 느슨한 가이드다. — [HearthPwn: Hadidjah (2017-09-19)](https://www.hearthpwn.com/news/3355-design-philosophy-on-hearthstones-golden)
- 주변(ambient) 효과는 초상화가 살아 있는 느낌을 주지만, 과하면 시선이 인물에서 벗어난다. 목표는 시선이 인물에 머무는 것이다. — [HearthPwn: Hadidjah](https://www.hearthpwn.com/news/3355-design-philosophy-on-hearthstones-golden)
- 성능 예산: 골드 하수인으로 가득 찬 보드, 골드 손패, 양측 골드 영웅과 영웅 능력이 동시에 있어도 전 플랫폼에서 원활해야 한다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- Snap은 모바일 실기기에서 최악 시나리오로 성능을 테스트하고, 모바일에서는 원격 에셋을 런타임에 로드/언로드한다. — [Unity Case Study](https://unity.com/case-study/marvel-snap)
- 접근성/연출 감소: Shadowverse: Worlds Beyond는 전투 중 간이 카드 연출 옵션을 제공한다. — [GameWith](https://gamewith.net/shadowverse-wb/68449) (스니펫)
- 모든 선례가 프리미엄을 "순수 코스메틱, 게임플레이 차이 없음"으로 규정한다(Hearthstone 다이아몬드/시그니처, Snap 등급). — [Hearthstone Wiki: Quality](https://hearthstone.wiki.gg/wiki/Quality); [Marvel Snap Zone](https://marvelsnapzone.com/marvel-snap-progression-guide/)

### Inferences
- STS2에 대입하면: 카드 효과와 같은 시각 언어를 피해야 한다. 예를 들어 사용 가능 카드의 테두리 글로우, 버프/디버프 아이콘 색, 독(초록)이나 약화 VFX와 비슷한 효과가 아트에서 나오면 상태 신호로 오인될 수 있다(Briggs의 연기 = 은신 사례와 같은 구조).
- Hadidjah의 계층을 모드에 적용하면: 손패에 상시 노출되는 상태에서는 무음(정지)이고, hover/집기에서는 중간, 사용 순간에는 가장 시끄럽게, 지속 효과는 0이다. 이 구조는 업계의 "노출 시간 반비례" 원칙과 정확히 일치한다.
- 접근성 기본값으로 "연출 줄이기" 토글(프레임 브레이크 끄기, 프레임 안 효과만 남기기, 또는 전부 끄기)과 OS의 reduce-motion 설정 존중을 넣는 것이 선례(Shadowverse WB)에 부합한다.
- 성능 예산은 "손패 10장 전부 효과 활성"이 아니라 "동시에 하나(hover 중인 카드) + 사용 중 하나"로 제한하면 Hearthstone의 최악 시나리오보다 훨씬 가볍다. 일시적 재생만 허용한다는 모드 제약 자체가 성능 안전장치다.

### Gaps
- Hearthstone과 Marvel Snap에 프리미엄 애니메이션을 끄는 설정이나 OS reduce-motion 대응이 있는지 확인하지 못했다.
- 카드 게임 애니메이션 아트의 정량적 성능 예산(드로우콜, 텍스처 메모리, ms)을 공개한 출처는 없었다.

## 6. 포스트모템과 비판: 애니메이션 카드 아트가 싸구려 같거나 산만하게 느껴진 경우

### Takeaway
공개된 비판은 대부분 개발자 자기 회고에서 나온다. 너무 빠른 속도(최초 대비 400%), 같은 효과의 남용("drool-tech", 나뭇잎), 프레임 밖으로 나간 인물이 빈 슬롯을 남긴 사례, 장면 색과 충돌하는 효과가 실패 패턴이다. 플레이어 측 "산만하다"는 체계적 비판은 찾지 못했다. 오히려 애니메이션이 사라진 골드 카드에 대한 불만(버그 리포트)이 보인다.

### Cited Findings
- Shadowboxer와 Goblin Auto-Barber의 애니메이션은 처음에 최종본보다 약 400% 빨라서 산만했다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- 일부 카드에서 침 흘리기 효과를 남용했고(팀 내 별명 "drool-tech"), Briggs의 나뭇잎 효과도 비판을 받았다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- Noble Sacrifice는 하수인이 뛰어오르는 애니메이션 때문에 초상화가 프레임 밖으로 나가 빈 슬롯이 남았다. 컨셉이 실제 화면에서 작동하는지 확인해야 한다는 교훈이다. — [Jon Briggs (2015)](https://hearthstone.blizzard.com/en-us/blog/18053404/)
- 시선을 다른 곳으로 끌거나, 촌스러워 보이거나(tacky), 원본 아트워크를 바꿔 버리는 효과는 문제로 간주된다. — [HearthPwn: Hadidjah (2017)](https://www.hearthpwn.com/news/3355-design-philosophy-on-hearthstones-golden)
- Gwent는 자연스러운 움직임이 캐릭터를 프레임 밖으로 밀어낼 때 시간 정지나 장면 내부 루프로 해결했다. 프레임 이탈은 의도하지 않으면 문제라는 인식이 있다. — [playgwent.com (2017)](https://www.playgwent.com/en/news/6591/gwent-cards-how-they-come-to-life)
- 플레이어 측: 패치 후 일부 골드 카드 애니메이션이 사라진 버그에 대해 "골드 카드가 일반 카드처럼 보이려고 재화를 쓴 게 아니다"라는 불만이 나왔다. 애니메이션이 프리미엄 가치의 핵심으로 인식된다는 뜻이다. — [Blizzard Forums: Some Golden cards have lost their animation](https://us.forums.blizzard.com/en/hearthstone/t/visual-some-golden-cards-have-lost-their-animation/164216) (스니펫)
- 별개 사례(애니메이션이 아닌 레이아웃): MTG의 일부 대체 아트 카드는 텍스트 배치 변경 때문에 "사실상 읽을 수 없다"는 비판을 받았다. 프리미엄 처리가 정보 가독성을 해치면 비판받는다는 일반 사례다. — [Star City Games: Ten of the Most Unreadable Magic Cards](https://articles.starcitygames.com/magic-the-gathering/whats-that-do-ten-of-the-most-unreadable-magic-cards/) (스니펫)

### Inferences
- 모드의 주요 실패 위험은 (a) 원본과 다른 질감의 효과(셰이더 글로우가 디지털 같아 손그림과 어긋남, 인페인팅 티), (b) 과속, (c) 여러 카드에 같은 효과 템플릿을 반복해 "drool-tech"처럼 패턴이 보이는 것, (d) 프레임 브레이크 요소가 카드 이름, 비용, 설명 텍스트를 가리는 것이다. 특히 (d)는 STS2 카드의 비용 오브와 설명 영역 가림 금지 규칙으로 막아야 한다.
- "느리고 작게 시작해서 키운다"(400% 사례)를 기본 튜닝 원칙으로 삼고, 효과 템플릿은 카드마다 파라미터와 마스크를 달리해 반복감을 줄이는 것이 좋다.

### Gaps
- 프리미엄/애니메이션 카드 아트가 산만하다는 플레이어 측 체계적 비판이나 개발사 포스트모템(예: 특정 효과 롤백)은 찾지 못했다.
- Marvel Snap 3D/프레임 브레이크가 "싸구려 같다"는 평가나 Hearthstone 다이아몬드에 대한 미적 비판을 담은 신뢰할 만한 출처는 찾지 못했다.
