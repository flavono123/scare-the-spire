# STS2 런 데이터 기부 — TLDR

`.run` 파일을 보내주시면 슬서운이야기 **런 리플레이** 정확도가 올라갑니다.

## 어떤 런?

v0.103.0+ 빌드. 특히 부족한 카테고리:

- **황금 나침반** / **모피코트** 획득
- **보물지도** 획득 후 2막 진입 (1막 보스에서 안 죽음)
- **윙부츠** 사용
- **A10 더블 보스**
- 그 외 인상 깊은 시드

## 한 줄로 history 폴더 압축

데스크탑에 `sts2-history.zip` 생성됩니다. `<steam-id>` / `<profile>` 자동 와일드카드.

### macOS

```bash
zip -r ~/Desktop/sts2-history.zip ~/Library/Application\ Support/SlayTheSpire2/steam/*/profile*/saves/history
```

### Windows (PowerShell)

```powershell
Compress-Archive -Path "$env:APPDATA\SlayTheSpire2\steam\*\profile*\saves\history" -DestinationPath "$env:USERPROFILE\Desktop\sts2-history.zip"
```

### Linux

```bash
zip -r ~/Desktop/sts2-history.zip ~/.local/share/SlayTheSpire2/steam/*/profile*/saves/history
```

## GUI로 압축하기

각 OS의 파일 탐색기로 `saves/` 폴더로 이동한 뒤 `history` 폴더를 우클릭 → 압축.

- **macOS**: Finder에서 `Cmd+Shift+G` → `~/Library/Application Support/SlayTheSpire2/steam/<steam-id>/profile1/saves/` 붙여넣기 → `history` 폴더 우클릭 → **"history" 압축**
- **Windows**: 탐색기 주소창에 `%APPDATA%\SlayTheSpire2\steam\<steam-id>\profile1\saves\` 붙여넣기 → `history` 폴더 우클릭 → **보내기 → 압축(ZIP) 폴더**
- **Linux**: 파일 매니저로 `~/.local/share/SlayTheSpire2/steam/<steam-id>/profile1/saves/` 이동 → `history` 폴더 우클릭 → **압축 / Compress**

## 보내는 곳

zip 파일을 Slack / 이메일 / DM 등으로 첨부.

## 안전한가?

`.run` 파일에는 **계정 / 이메일 / 실명 없음**. 시드, 빌드, 카드/유물 목록, 맵 노드, HP/Gold 스냅샷만 들어있습니다. Steam ID는 폴더 경로에만 있고 파일 내부엔 없음.

---

자세한 배경과 폴더 구조 → [CONTRIBUTING.md](./CONTRIBUTING.md) · English → [CONTRIBUTING.en.tldr.md](./CONTRIBUTING.en.tldr.md)
