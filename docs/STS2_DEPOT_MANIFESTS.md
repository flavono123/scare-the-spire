# STS2 구 빌드 depot manifest (macOS depot 2868842)

SteamDB depot manifests 탭(로그인)에서 가져온 이력. 현재 manifest `5045320271505434676`이 로컬 설치(`appmanifest_2868840.acf`)와 일치해 macOS depot 2868842의 이력으로 본다.
버전 대응은 SteamDB 관측 시각(UTC)과 `data/sts2-patches.json`·wiki.gg 날짜를 맞춘 **추정**이다 (wiki.gg 날짜 + 1일 = SteamDB UTC 날짜).

- app `2868840`, macOS depot `2868842` (Linux `2868843`, Windows `2868841`)
- 브랜치: `public`, `public-beta` 둘뿐 (이름으로 구 빌드를 받을 수 없음 → manifest ID 필수)
- 목록의 브랜치 표기가 없는 행은 `public`(release 병합)

| 버전(추정) | SteamDB 관측 (UTC) | Manifest ID | 브랜치 |
|---|---|---|---|
| 0.98 출시 | 2026-03-05 17:50 | 2907078504756198574 | public |
| 0.98 출시 | 2026-03-05 17:50 | 1673197266540617643 | public-beta |
| 0.98 출시 | 2026-03-05 17:50 | 8195960991513942452 | troubleshoot |
| 0.98.1 | 2026-03-06 00:47 | 2646416021243959080 | public |
| 0.98.2 | 2026-03-07 02:36 | 7077376005054376697 | public |
| 0.98.3 | 2026-03-10 17:44 | 3447588968304758517 | public |
| 0.99 | 2026-03-13 00:35 | 2841353406247532214 | public-beta |
| 0.99.1 | 2026-03-14 04:52 | 4896221226191258992 | public |
| **0.100.0** | 2026-03-20 01:41 | 8691911314830205080 | public-beta |
| **0.101.0** | 2026-03-27 02:22 | 7335114380137289283 | public-beta |
| **0.102.0** | 2026-04-03 00:45 | 5829598223547392421 | public-beta |
| 0.103.0 | 2026-04-10 00:52 | 9097754098362819748 | public-beta |
| 0.103.1 | 2026-04-16 03:50 | 7400006254771756891 | public-beta |
| 0.103.2 | 2026-04-17 00:53 | 5723017024281513170 | public |
| 0.104.0 | 2026-04-24 00:11 | 527531085985670167 | public-beta |
| 0.105.0 | 2026-05-08 00:50 | 71256304972603072 | public-beta |
| 0.105.1 | 2026-05-09 03:11 | 3651962971927659313 | public-beta |
| 0.106.0 | 2026-05-22 00:30 | 3684325315583210884 | public-beta |
| 0.106.1 | 2026-05-23 00:42 | 5855589493078469321 | public-beta |
| (0.106.x release 병합) | 2026-05-29 21:30 | 4577611564181546473 | public |
| **0.107.0** | 2026-06-04 23:43 | 2804103258730160733 | public-beta |
| 0.107.1 | 2026-06-19 00:33 | 8653035385353091849 | public |
| 0.108.0 | 2026-07-03 03:24 | 1977841934321910790 | public-beta |
| 0.109.0 | 2026-07-17 02:54 | 7169427731078769081 | public-beta |
| 0.109.1 | 2026-07-25 18:38 | 1604261622579712050 | public-beta |
| 0.110.0 | 2026-07-31 03:24 | 7006298261873589484 | public-beta |
| 0.110.x 핫픽스 | 2026-07-31 08:44 | 6028014086612748791 | public-beta |
| 0.111.0 | 2026-08-14 01:05 | 5045320271505434676 | public-beta (현재) |

주의: `sts2-patches.json`은 0.101.0을 2026-03-24로 적었지만 SteamDB와 wiki.gg는 03-26/27이다 (확인 필요).

## 받을 빌드

| 목적 | 빌드 | 파일 |
|---|---|---|
| 문을 만드는 자 Spine (0.107.1에서 제거되기 전 마지막 빌드) | 0.107.0 `2804103258730160733` | PCK + dll |
| 0.100~0.102 몬스터 수치 (dll 디컴파일) | 0.100.0 `8691911314830205080`, 0.101.0 `7335114380137289283`, 0.102.0 `5829598223547392421` | dll만 |
| 0.103 이전 (선택) | 0.99.1 `4896221226191258992` | dll만 |

## 명령

macOS는 `DepotDownloader` 바이너리의 quarantine 속성 때문에 첫 실행이 막힐 수 있다. 공식 릴리스(SteamRE/DepotDownloader)에서 받은 것을 확인한 뒤 직접 허용한다.

```bash
# 첫 로그인 (Steam Guard 승인 필요, 이후 세션이 저장되면 비밀번호 없이 재사용)
./DepotDownloader -app 2868840 -depot 2868842 -manifest 8691911314830205080 \
  -username <계정> -remember-password \
  -filelist /Users/flavono123/P/scare-the-spire/tasks/depot-filelists/dll.txt \
  -dir ~/Downloads/sts2-old/0.100.0
```

PCK(약 1.9GB)까지 받을 때는 `-filelist .../pck-and-dll.txt`와 0.107.0 manifest를 쓴다.

## 아카이브와 도구 (2026-10-19)

- 위 표의 28개 manifest(0.96.1 ~ 0.111.0, 테스트 빌드 포함)를 모두 `~/sts2-builds/<버전>/`에 받았다 (약 49GB). 리포 밖이라 배포에 영향이 없다. 위치 규칙과 도구는 [AGENTS.md](../AGENTS.md)의 "STS2 구 빌드 아카이브"를 따른다.
- 다운로드: `STEAM_USER=<계정> python3 scripts/sts2_depot_download.py [--dll-only]` (manifest 목록은 `scripts/sts2-depot-manifests.json`). 디컴파일 `scripts/sts2_decompile_builds.py`, 정답 데이터 `scripts/sts2_canonical_extract.py`, 대조 `pnpm audit:version-api`, 회귀 테스트 `pnpm test:version-canonical`. 결과 분석: [VERSION_API_AUDIT.md](VERSION_API_AUDIT.md).
- 로그인은 `-qr`로 한 번 하면 저장된다. 이후 `-username <계정> -remember-password`로 받는다. 같은 계정으로 DepotDownloader를 동시에 두 개 돌리지 않는다.
- 0.100.0(`8691911314830205080`)은 처음에 "No manifest request code ... 401"이었으나 로그인을 새로 한 뒤 정상적으로 받아졌다. 같은 오류가 나면 로그인을 다시 해 본다.
- 0.107.0 PCK에는 문을 만드는 자 에셋이 없다. 0.104.0 PCK에는 Spine이 아니라 정지 이미지 `images/monsters/beta/door_maker_placeholder_1~4.png`(`scenes/creature_visuals/doormaker.tscn`)뿐이다. `public/images/sts2/monsters-beta/`에 추출해 두었다.
- 구 빌드의 async 메서드는 상태 기계로 디컴파일돼 `parse-monsters.py`가 파워 적용을 읽지 못하므로 손으로 확인한다.
- 29 May 2026 manifest(`4577611564181546473`)는 `release_info.json` 기준 0.103.3(public 브랜치)이다.
