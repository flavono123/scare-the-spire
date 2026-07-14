# Monster Intent FSM Inventory

This inventory is classified from all 121 entries in `data/sts2/{kor,eng}/monsters.json` by `classifyMonsterIntentFsm`. Names use the official Korean locale followed by the English source name and canonical ID.

## Summary

| FSM kind | Korean label | Count |
| --- | --- | ---: |
| `terminal` | 종료형 | 1 |
| `one-way` | 단방향 | 0 |
| `fixed-loop` | 고정 루프 | 72 |
| `random-loop` | 무작위 루프 | 18 |
| `conditional-loop` | 조건 루프 | 9 |
| `conditional-random-loop` | 조건+무작위 루프 | 1 |
| `reversible-phases` | 가역 페이즈 | 1 |
| `progressive-phases` | 단방향 페이즈 | 7 |
| `partial` | 동적 확률·부분 추출 | 1 |
| `unknown` | FSM 없음·비정형 | 11 |

## 종료형 / Terminal (1)

- 가스 폭탄 / Gas Bomb (`GAS_BOMB`)

## 단방향 / One-way (0)

- 현재 추출 데이터에는 독립적인 단방향 FSM이 없다. 되돌아갈 수 없는 다단계 진행은 아래 단방향 페이즈로 분류한다.

## 고정 루프 / Fixed loop (72)

- 영겁의 모래시계 / Aeonglass (`AEONGLASS`)
- 아키텍트 / The Architect (`ARCHITECT`)
- 암살 습격자 / Assassin Raider (`ASSASSIN_RUBY_RAIDER`)
- 잘라봇 / Axebot (`AXEBOT`)
- 도끼 습격자 / Axe Raider (`AXE_RUBY_RAIDER`)
- 전투 친구 V1.0 / Battle Friend V1.0 (`BATTLE_FRIEND_V1`)
- 전투 친구 V2.0 / Battle Friend V2.0 (`BATTLE_FRIEND_V2`)
- 전투 친구 V3.0 / Battle Friend V3.0 (`BATTLE_FRIEND_V3`)
- 그릇벌레 (알) / Bowlbug (Egg) (`BOWLBUG_EGG`)
- 그릇벌레 (꿀) / Bowlbug (Nectar) (`BOWLBUG_NECTAR`)
- 그릇벌레 (실크) / Bowlbug (Silk) (`BOWLBUG_SILK`)
- 난폭한 습격자 / Brute Raider (`BRUTE_RUBY_RAIDER`)
- 옛 시대의 우상 / Bygone Effigy (`BYGONE_EFFIGY`)
- 섀도니스 / Byrdonis (`BYRDONIS`)
- 짹짹이 / Byrdpip (`BYRDPIP`)
- 석회화된 광신자 / Calcified Cultist (`CALCIFIED_CULTIST`)
- 먹깨비 / Chomper (`CHOMPER`)
- 시체 민달팽이 / Corpse Slug (`CORPSE_SLUG`)
- 크로스보우 습격자 / Crossbow Raider (`CROSSBOW_RUBY_RAIDER`)
- 분쇄자 / Crusher (`CRUSHER`)
- 큐브형 구조체 / Cubex Construct (`CUBEX_CONSTRUCT`)
- 흠뻑 젖은 광신자 / Damp Cultist (`DAMP_CULTIST`)
- 열정적인 조각가 / Devoted Sculptor (`DEVOTED_SCULPTOR`)
- 곤충술사 / Entomancer (`ENTOMANCER`)
- 톱니눈 / Eye with Teeth (`EYE_WITH_TEETH`)
- 뚱뚱한 그렘린 / Fat Gremlin (`FAT_GREMLIN`)
- 복슬지렁이 / Fuzzy Wurm Crawler (`FUZZY_WURM_CRAWLER`)
- 구체 머리 / Globe Head (`GLOBE_HEAD`)
- 그렘린 용병 / Gremlin Merc (`GREMLIN_MERC`)
- 막아봇 / Guardbot (`GUARDBOT`)
- 유령선 / Haunted Ship (`HAUNTED_SHIP`)
- 감염된 프리즘 / Infested Prism (`INFESTED_PRISM`)
- 혈족 추종자 / Kin Follower (`KIN_FOLLOWER`)
- 혈족 사제 / Kin Priest (`KIN_PRIEST`)
- 나뭇잎 슬라임 (중) / Leaf Slime (M) (`LEAF_SLIME_M`)
- 살아있는 안개 / Living Fog (`LIVING_FOG`)
- 태초의 공벌레 / Louse Progenitor (`LOUSE_PROGENITOR`)
- 마법 기사 / Magi Knight (`MAGI_KNIGHT`)
- 기계 기사 / Mecha Knight (`MECHA_KNIGHT`)
- 소음봇 / Noisebot (`NOISEBOT`)
- 올빼미 판관 / Owl Magistrate (`OWL_MAGISTRATE`)
- 파엘의 군체 / Pael's Legion (`PAELS_LEGION`)
- 투사된 공포 / Parafright (`PARAFRIGHT`)
- 권투형 구조체 / Punch Construct (`PUNCH_CONSTRUCT`)
- 로켓 / Rocket (`ROCKET`)
- 불량 해초 / Seapunk (`SEAPUNK`)
- 시궁창 조개 / Sewer Clam (`SEWER_CLAM`)
- 압축벌레 / Shrinker Beetle (`SHRINKER_BEETLE`)
- 잠행 군체 / Skulking Colony (`SKULKING_COLONY`)
- 슬라임 광전사 / Slimed Berserker (`SLIMED_BERSERKER`)
- 포식성 잭스프루트 / Snapping Jaxfruit (`SNAPPING_JAXFRUIT`)
- 교활한 그렘린 / Sneaky Gremlin (`SNEAKY_GREMLIN`)
- 영혼 물교기 / Soul Fysh (`SOUL_FYSH`)
- 가시두꺼비 / Spiny Toad (`SPINY_TOAD`)
- 찔러봇 / Stabbot (`STABBOT`)
- 공포 장어 / Terror Eel (`TERROR_EEL`)
- 적대자 Mk 1 / The Adversary Mk 1 (`THE_ADVERSARY_MK_ONE`)
- 적대자 Mk 3 / The Adversary Mk 3 (`THE_ADVERSARY_MK_THREE`)
- 적대자 Mk 2 / The Adversary Mk 2 (`THE_ADVERSARY_MK_TWO`)
- 잊힌 자 / The Forgotten (`THE_FORGOTTEN`)
- 탐 / The Insatiable (`THE_INSATIABLE`)
- 사라진 자 / The Lost (`THE_LOST`)
- 폴짝이 도적 / Thieving Hopper (`THIEVING_HOPPER`)
- 횃불머리 융합체 / Torch Head Amalgam (`TORCH_HEAD_AMALGAM`)
- 튼튼한 알 / Tough Egg (`TOUGH_EGG`)
- 추적 습격자 / Tracker Raider (`TRACKER_RUBY_RAIDER`)
- 땅굴충 / Tunneler (`TUNNELER`)
- 포탑 사수 / Turret Operator (`TURRET_OPERATOR`)
- 가지 슬라임 (소) / Twig Slime (S) (`TWIG_SLIME_S`)
- 밴텀 / Vantom (`VANTOM`)
- 휘청거리는 덩굴 / Vine Shambler (`VINE_SHAMBLER`)
- 파지직봇 / Zapbot (`ZAPBOT`)

## 무작위 루프 / Random loop (18)

- 만각지네 / Decimillipede (`DECIMILLIPEDE_SEGMENT`)
- 상?인 / The Merchant??? (`FAKE_MERCHANT_MONSTER`)
- 철퇴 기사 / Flail Knight (`FLAIL_KNIGHT`)
- 날개버섯 / Flyconid (`FLYCONID`)
- 현혹버섯 / Fogmog (`FOGMOG`)
- 화석 매복자 / Fossil Stalker (`FOSSIL_STALKER`)
- 사냥꾼 살해자 / Hunter Killer (`HUNTER_KILLER`)
- 잉클릿 / Inklet (`INKLET`)
- 나뭇잎 슬라임 (소) / Leaf Slime (S) (`LEAF_SLIME_S`)
- 장수아귀 / Mawler (`MAWLER`)
- 게구리 기생체 / Phrog Parasite (`PHROG_PARASITE`)
- 물어뜯는 두루마리 / Scroll of Biting (`SCROLL_OF_BITING`)
- 미끈거리는 교살마 / Slithering Strangler (`SLITHERING_STRANGLER`)
- 오물팽이 / Sludge Spinner (`SLUDGE_SPINNER`)
- 영혼 결합체 / Soul Nexus (`SOUL_NEXUS`)
- 유령 기사 / Spectral Knight (`SPECTRAL_KNIGHT`)
- 영사자 / The Obscura (`THE_OBSCURA`)
- 가지 슬라임 (중) / Twig Slime (M) (`TWIG_SLIME_M`)

## 조건 루프 / Conditional loop (9)

- 그릇벌레 (바위) / Bowlbug (Rock) (`BOWLBUG_ROCK`)
- 개구리 기사 / Frog Knight (`FROG_KNIGHT`)
- 지식의 악마 / Knowledge Demon (`KNOWLEDGE_DEMON`)
- 진듸기 / Myte (`MYTE`)
- 깨작이 / Nibbit (`NIBBIT`)
- 산란비충 / Ovicopter (`OVICOPTER`)
- 허깨비 정원사 / Phantasmal Gardener (`PHANTASMAL_GARDENER`)
- 올챙이 / Toadpole (`TOADPOLE`)
- 꿈틀벌레 / Wriggler (`WRIGGLER`)

## 조건+무작위 루프 / Conditional random loop (1)

- 갑각충 / Exoskeleton (`EXOSKELETON`)

## 가역 페이즈 / Reversible phases (1)

- 조립 전문가 / Fabricator (`FABRICATOR`)

## 단방향 페이즈 / Progressive phases (7)

- 의식의 신수 / Ceremonial Beast (`CEREMONIAL_BEAST`)
- 라가불린 대모 / Lagavulin Matriarch (`LAGAVULIN_MATRIARCH`)
- 살아있는 방패 / Living Shield (`LIVING_SHIELD`)
- 여왕 / Queen (`QUEEN`)
- 잠자는 딱정벌레 / Slumbering Beetle (`SLUMBERING_BEETLE`)
- 실험체 #C{Count} / Test Subject #C{Count} (`TEST_SUBJECT`)
- 폭포 거인 / Waterfall Giant (`WATERFALL_GIANT`)

## 동적 확률·부분 추출 / Partial (1)

- 두꼬리쥐 / Two-Tailed Rat (`TWO_TAILED_RAT`)

`Two-Tailed Rat`의 상태와 시작 전이는 추출되지만, 소환 가능 여부에 따라 런타임 가중치 식이 달라지므로 정적 확률은 확정하지 않는다.

## FSM 없음·비정형 / Unknown (11)

- 둥지 / Nest (`BYRDONIS_NEST`)
- 고치 / Cocoon (`COCOON`)
- 문 / Door (`DOOR`)
- 문을 만드는 자 / Doormaker (`DOORMAKER`)
- 응시하는 나방 / Gazing Moth (`GAZING_MOTH`)
- 보석먹이 / Gem Eater (`GEM_EATER`)
- 해츨링 / Hatchling (`HATCHLING`)
- 수수께끼의 기사 / Mysterious Knight (`MYSTERIOUS_KNIGHT`)
- 팔 / The Arm (`THE_ARM`)
- 방울 / The Bell (`THE_BELL`)
- 꿈꾸는 자 / The Dreamer (`THE_DREAMER`)

These entries do not expose a statically extracted `MonsterMoveStateMachine` graph in the current DLL source. They remain explicit in the inventory instead of being guessed or silently assigned to another kind.
