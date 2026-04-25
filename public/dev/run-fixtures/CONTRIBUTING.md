# STS2 런 데이터 기부 안내

> 짧게 보고 싶다면 → [CONTRIBUTING.tldr.md](./CONTRIBUTING.tldr.md) · English → [CONTRIBUTING.en.md](./CONTRIBUTING.en.md) / [CONTRIBUTING.en.tldr.md](./CONTRIBUTING.en.tldr.md)

슬서운이야기의 **런 리플레이** 기능은 STS2 `.run` 파일을 시드로 맵을 다시 생성한 뒤 히스토리를 그 위에 얹어 보여줍니다. 다양한 상황의 실제 플레이 데이터가 많을수록 재현 정확도와 시각화 품질이 올라가니, 본인 히스토리에서 아래 조건에 맞는 런이 있다면 보내주시면 큰 도움이 됩니다.

## 어떤 런이 필요한가요

현재 v0.103.0 이상 빌드만 정확히 재현됩니다. 부족한 카테고리:

- **테즈카타라 황금 나침반** (`RELIC.GOLDEN_COMPASS`) 획득 런 — Tezcatara 고대의 존재에서 받음
- **노누파이페 모피코트** (`RELIC.FUR_COAT`) 획득 런 — Nonupeipe 고대의 존재에서 받음
- **보물지도** (`CARD.SPOILS_MAP`) 획득 후 **2막 진입까지 한** 런 — 1막 보스에서 죽지 않은 것
- **윙부츠** (`RELIC.WINGED_BOOTS`) 사용 런 — 가능한 한 다양한 캐릭터/승천
- **고승천 (A10) 더블 보스** 런 — 마지막 막에서 보스 두 마리 본 것
- 그 밖의 특이 시드 (인상 깊었던 맵, 희귀 인카운터 등)

빌드 버전은 `.run` 파일을 텍스트 에디터로 열어 `"build_id": "..."` 부분에서 확인 가능. v0.103.0 미만은 우리가 가진 게임 소스와 맞지 않아 zero match가 되니 받아도 검증 불가합니다.

## `.run` 파일 위치 (운영체제별)

`<steam-id>` 와 `<profile>` 은 본인 환경에 맞게 치환하세요. 보통 프로필이 하나면 `profile1` 입니다.

### macOS

```
~/Library/Application Support/SlayTheSpire2/steam/<steam-id>/profile1/saves/history/
```

Finder에서: `Cmd+Shift+G` → 위 경로 붙여넣기.

### Windows

```
%APPDATA%\SlayTheSpire2\steam\<steam-id>\profile1\saves\history\
```

또는

```
C:\Users\<사용자>\AppData\Roaming\SlayTheSpire2\steam\<steam-id>\profile1\saves\history\
```

탐색기 주소창에 위 경로 붙여넣기.

### Linux

```
~/.local/share/SlayTheSpire2/steam/<steam-id>/profile1/saves/history/
```

또는 Steam Proton 환경에서는 Steam compatibility data 하위:

```
~/.steam/steam/steamapps/compatdata/<app-id>/pfx/drive_c/users/steamuser/AppData/Roaming/SlayTheSpire2/...
```

## 파일 구조

각 런은 Unix timestamp 이름의 `.run` 파일 (예: `1776007587.run`) 입니다. 내용은 **JSON 텍스트** — 메모장으로도 열립니다.

## 개인정보 안전성

`.run` 파일에는 **계정/이메일/실명 등 개인정보가 들어있지 않습니다**. 들어있는 것은:

- 시드, 빌드, 승천, 게임 모드, 승패
- 캐릭터, 카드/유물 목록 + 획득 floor
- 맵 노드 타입 시퀀스 + floor별 HP/Gold 스냅샷
- 인카운터 ID, 턴 수

Steam ID는 폴더 경로에만 있고 파일 내부에는 없습니다. 안심하고 보내주셔도 됩니다.

## 보내는 방법

- 한 두 개라면 파일을 그대로 첨부 (Slack/이메일/DM 등)
- 여러 개라면 `history` 폴더 전체를 zip 압축
- `seed` 필드를 알려주시면 어떤 런인지 즉시 식별 가능

## 받은 후 처리

기부받은 런은 `public/dev/run-fixtures/` 에 의미 있는 파일명으로 옮기고 `index.json` 에 등록하면 즉시 검증 스크립트 (`scripts/verify-replay-fixtures.ts`) 와 dev 페이지 (`/dev/run-replay`) 에서 활용됩니다.
