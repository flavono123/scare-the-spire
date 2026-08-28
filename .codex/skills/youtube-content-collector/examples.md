# Verified collection examples

These are one-time verification runs captured from the public gallery on
2026-08-26 KST. They demonstrate the schema and gates; rerun the skill for
current editorial decisions instead of treating this file as a live feed.
Their 2–3 candidate counts predate the current 10-candidate requirement; use
them for field and gate shape only, never as the output-size target.

## `now` verification

```yaml
mode: now
window:
  from: "2026-08-24T22:05:00+09:00"
  to: "2026-08-26T22:05:00+09:00"
  tz: KST
patch_context:
  version: "0.111.0"
  note: "레포 패치 데이터에서 확인한 최신 베타 패치는 2026-08-14 공개. 이 48시간 창에는 새 패치가 없어 패치 당일 트리거로 보지 않음."
limitations:
  - "2026-08-26 약 22:05 KST에 공개 추천글 목록과 일반글 첫 화면을 사람이 보듯 확인한 스냅샷이며 전수 아카이브가 아님."
  - "일반글 첫 화면은 슬망호가 다수여서 후보에서 제외함."
  - "디시 댓글에는 안정적인 댓글별 고유 링크가 보이지 않아 댓글 URL은 원문 글 링크를 재사용함."
  - "목록의 댓글 수에는 답글이나 현재 접힌 댓글이 포함될 수 있어 글 화면에서 바로 보이는 댓글 수와 다를 수 있음."

watchlist:
  - topic: "사무직 취업했다"
    type: "게임 상황의 현실 직업 드립"
    source: slgall
    heat: "2026-08-26 18:19 / 조회 1,047 / 추천 16 / 댓글 7"
    why: "게임 화면을 현실 취업 한 줄로 바꾸는 제목 구조가 짧고 댓글 반응이 붙음."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478846"
    flags: []
  - topic: "라이터 도박 성공했다 ㅋㅋ"
    type: "유물 도박 성공의 희소성"
    source: slgall
    heat: "2026-08-26 15:50 / 조회 1,672 / 추천 16 / 댓글 25"
    why: "라이터와 타격 시너지가 한 화면에 완성되어 성공담과 댓글 과장이 함께 붙음."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478799"
    flags: []
  - topic: "차의명인 두들겨패주는 모드"
    type: "모드 응징 드립"
    source: slgall
    heat: "2026-08-26 15:43 / 조회 1,916 / 추천 33 / 댓글 18"
    why: "강한 제목과 반응은 크지만 제작 모드의 재사용 권리를 확인하지 않은 상태."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478795"
    flags: [creative-work]
  - topic: "이카드 졸라웃기네 ㅋㅋ"
    type: "카드 이름 드립"
    source: slgall
    heat: "2026-08-26 13:29 / 조회 2,002 / 추천 21 / 댓글 13"
    why: "버디 슬램이라는 이름에 댓글이 즉시 반응했지만 카드 출처를 이 실행에서 확정하지 못함."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478758"
    flags: [unverified-origin]
  - topic: "\"3막 미지가 모두 전투인 이유가 뭐지?\""
    type: "3막 미지 전투 불운"
    source: slgall
    heat: "2026-08-26 12:36 / 조회 2,107 / 추천 26 / 댓글 6"
    why: "질문과 답 한 줄, 유물이 모두 타는 게임 화면, 댓글 세 줄로 완결됨."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478742"
    flags: []
  - topic: "슬더스 희귀카드 고점GOAT 반박안받음"
    type: "카드·유물 한줄 과대/과소"
    source: slgall
    heat: "2026-08-26 12:12 / 조회 2,134 / 추천 11 / 댓글 7"
    why: "희귀 카드 고점을 단정하는 옵평 제목이라 댓글 반박 구조가 생김."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478732"
    flags: []
  - topic: "쉽덕 리젠트 업데이트"
    type: "모드 업데이트"
    source: slgall
    heat: "2026-08-26 02:07 / 조회 3,076 / 추천 57 / 댓글 17"
    why: "열기는 높지만 제작자가 만든 모드·이미지가 중심인 업데이트 글."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478616"
    flags: [creative-work]
  - topic: "슬망호 그림일기5"
    type: "창작·팬아트"
    source: slgall
    heat: "2026-08-25 23:29 / 조회 2,205 / 추천 35 / 댓글 46"
    why: "댓글 열기는 매우 높지만 글의 가치가 작성자 그림과 서사 자체에 있음."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478563"
    flags: [creative-work, fan-art]
  - topic: "오늘 섹스함"
    type: "선정 펀치라인"
    source: slgall
    heat: "2026-08-25 22:50 / 조회 2,346 / 추천 23 / 댓글 4"
    why: "제목의 펀치라인이 성드립이어서 열기와 무관하게 후보 탈락."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478548"
    flags: [sexual-punchline]
  - topic: "체력을 2 잃습니다"
    type: "창작·팬아트"
    source: slgall
    heat: "2026-08-25 22:32 / 조회 2,726 / 추천 22 / 댓글 9"
    why: "창작 탭의 그림이 중심이라 짧은 제목만으로 재사용하지 않음."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478534"
    flags: [creative-work, fan-art]
  - topic: "모래성절대집지마세요"
    type: "멀티/고대 도박 실패의 동질감"
    source: slgall
    heat: "2026-08-25 21:06 / 조회 3,246 / 추천 51 / 댓글 22"
    why: "오로바스 보상 실패 화면과 한 단어 본문에 댓글이 상황을 완성함."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478494"
    flags: []
  - topic: "아니 오로바스 아니 시발 아니"
    type: "멀티/고대 도박 실패의 동질감"
    source: slgall
    heat: "2026-08-25 21:04 / 조회 3,532 / 추천 28 / 댓글 12"
    why: "같은 시간대에 독립된 오로바스 실패 글이 이어져 단발보다 반복 동향임을 보여 줌."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478493"
    flags: []
  - topic: "슬더스 월드 챔피언쉽 우승"
    type: "대회 결과"
    source: slgall
    heat: "2026-08-25 13:53 / 조회 3,600 / 추천 60 / 댓글 15"
    why: "열기는 높지만 이 실행에서는 원 경기·영상의 재사용 권리와 출처를 확인하지 못함."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478319"
    flags: [unverified-origin]

script_candidates:
  - topic: "라이터 도박 성공했다 ㅋㅋ"
    type: "유물 도박 성공의 희소성"
    body:
      excerpt: "상점에서 라이터 사길 잘했네. 라이터 타격용 인형 수프 렛츠고 ㅋㅋㅋㅋ"
      url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478799"
      author_label: "ㅇㅇ"
    comments:
      - text: "타격용 인형까지 있네"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478799 (댓글 고유 링크 없음)"
      - text: "미니어쳐대포 빨리 뽑으러가"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478799 (댓글 고유 링크 없음)"
      - text: "이자식 타격으로 타격을 하고있어"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478799 (댓글 고유 링크 없음)"
    flags: []
    skip_reason: null
  - topic: "\"3막 미지가 모두 전투인 이유가 뭐지?\""
    type: "3막 미지 전투 불운"
    body:
      excerpt: "\"그야... 그래야 모든 유물이 보스 전에 타니까\""
      url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478742"
      author_label: "ㅇㅇ"
    comments:
      - text: "그래도 태워도 되는 유물들이네 한잔해"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478742 (댓글 고유 링크 없음)"
      - text: "만약 전투 안 떴다면 대신 거울, 재판, 버섯 이벤트가 떴다는 거임"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478742 (댓글 고유 링크 없음)"
      - text: "널 아키텍트님께 올려보낼순 없다! 죽어랏!"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478742 (댓글 고유 링크 없음)"
    flags: []
    skip_reason: null
  - topic: "모래성절대집지마세요"
    type: "멀티/고대 도박 실패의 동질감"
    body:
      excerpt: "시발아"
      url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478494"
      author_label: "ㅇㅇ"
    comments:
      - text: "니오우가 주는 유물의 3배만큼의 값어치... 너무 강하다아앗"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478494 (댓글 고유 링크 없음)"
      - text: "모래성이 강해봤자 호부의 세배.."
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478494 (댓글 고유 링크 없음)"
      - text: "\"진리는 단순합니다\""
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=478494 (댓글 고유 링크 없음)"
    flags: []
    skip_reason: null
```

## `historical` verification

```yaml
mode: historical
window:
  from: "2026-07-20"
  to: "2026-07-26"
  tz: KST
patch_context:
  version: "0.109.0 / 0.109.1"
  note: "v0.109.0 베타 패치는 2026-07-17, 번체 중국어 복수형만 고친 v0.109.1 핫픽스는 2026-07-25. 이 창은 v0.109.0 반응의 잔여 구간과 핫픽스 당일을 포함함."
limitations:
  - "현재 공개 추천글 목록의 5·6페이지에서 날짜를 글별로 확인한 회고 스냅샷이며, 당시 일반글 전체나 삭제글은 복원하지 않음."
  - "추천글 편입 상태, 본문, 댓글은 작성 당시와 달라졌을 수 있음."
  - "디시 댓글에는 안정적인 댓글별 고유 링크가 보이지 않아 댓글 URL은 원문 글 링크를 재사용함."

watchlist:
  - topic: "슬더스 유저들이 아클에 열광하는 이유.jpg"
    type: "캐릭터 한줄 과대/과소"
    source: slgall
    heat: "2026-07-25 13:00 / 조회 8,143 / 추천 28 / 댓글 34"
    why: "아클 선호를 한 장 이미지와 댓글 반응으로 압축한 제목 구조."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=463599"
    flags: []
  - topic: "갤에 박제규정 추가 관련 건의"
    type: "갤 운영·분쟁"
    source: slgall
    heat: "2026-07-25 10:54 / 조회 3,247 / 추천 13 / 댓글 6"
    why: "화제성은 있으나 닉네임 박제와 분쟁을 다루는 운영 주제라 채널 재료가 아님."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=463533"
    flags: [nickname-harassment, party-dispute]
  - topic: "한국어 번역 끝내고 홍보차 나왔습니다"
    type: "모드 번역 홍보"
    source: slgall
    heat: "2026-07-24 23:06 / 조회 7,411 / 추천 23 / 댓글 24"
    why: "STS2와 겹치지만 번역 모드 홍보와 제작물 자체가 중심."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=463296"
    flags: [creative-work, unverified-origin]
  - topic: "오로바스 시발 새끼야!!!!!!!!!!!!!!"
    type: "멀티/고대 도박 실패의 동질감"
    source: slgall
    heat: "2026-07-24 19:44 / 조회 7,435 / 추천 30 / 댓글 27"
    why: "원한 카드를 비켜 간 무작위 강화와 호부 셋이라는 한 화면에 댓글 드립이 집중됨."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=463151"
    flags: []
  - topic: "멀티하다 그린 사일"
    type: "창작·팬아트"
    source: slgall
    heat: "2026-07-24 19:21 / 조회 3,588 / 추천 17 / 댓글 6"
    why: "멀티 반응이 아니라 작성자 그림 자체가 중심인 창작 탭 글."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=463138"
    flags: [creative-work, fan-art]
  - topic: "바위 아클 모드 바위 수급 카드 좀 추가함"
    type: "모드 업데이트"
    source: slgall
    heat: "2026-07-24 15:29 / 조회 7,860 / 추천 84 / 댓글 59"
    why: "구간 내 열기는 매우 높지만 제작 모드와 카드가 글의 본체."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=463027"
    flags: [creative-work]
  - topic: "재미로 보는 이번 패치 통계들"
    type: "패치 여론 통계"
    source: slgall
    heat: "2026-07-24 14:01 / 조회 6,730 / 추천 29 / 댓글 25"
    why: "패치 여론 관측에는 유용하지만 장문 통계·정보 성격이라 쇼츠 센티멘트와 다름."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=462989"
    flags: [guide-or-faq]
  - topic: "사일런트로 파충류 장식 뽕맛보니까 정신못차리겠네"
    type: "카드·유물 한줄 과대/과소"
    source: slgall
    heat: "2026-07-24 11:49 / 조회 4,642 / 추천 38 / 댓글 19"
    why: "유물 고점 체감을 한 줄로 과장하는 옵평 구조."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=462934"
    flags: []
  - topic: "와 만화경 금카나옴 ㄷㄷ"
    type: "보상 도박 성공"
    source: slgall
    heat: "2026-07-23 21:36 / 조회 6,713 / 추천 36 / 댓글 21"
    why: "확률 보상 한 장과 즉각적인 성공 반응이 붙은 짧은 구조."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=462680"
    flags: []
  - topic: "신성에 소멸제거 바르는 병신이 어딨음?"
    type: "런 실수의 자기박제"
    source: slgall
    heat: "2026-07-23 19:59 / 조회 6,077 / 추천 25 / 댓글 36"
    why: "제목 질문과 본문 자답, 짧은 댓글 역할극이 한 번에 완결됨."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=462609"
    flags: []
  - topic: "ㅆㄷ) 영혼 결합체 그려봣어오"
    type: "창작·팬아트"
    source: slgall
    heat: "2026-07-23 00:03 / 조회 6,501 / 추천 46 / 댓글 10"
    why: "그림 자체가 가치인 팬아트이므로 열기와 무관하게 재사용 후보에서 제외."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=462223"
    flags: [creative-work, fan-art]
  - topic: "[만화] 절대적인 힘을 줘"
    type: "창작 만화"
    source: slgall
    heat: "2026-07-22 18:25 / 조회 8,434 / 추천 214 / 댓글 88"
    why: "구간 최고 수준의 열기지만 창작 만화 전문 재배포 게이트에 걸림."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=462010"
    flags: [creative-work]
  - topic: "상스럽지만 흥분해버리고 말았습니다"
    type: "선정 펀치라인"
    source: slgall
    heat: "2026-07-22 12:25 / 조회 6,381 / 추천 30 / 댓글 18"
    why: "제목부터 선정 펀치라인 가능성이 있어 열기와 무관하게 추천하지 않음."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=461807"
    flags: [sexual-punchline]
  - topic: "미친 두루마리 상자 이거 뭐냐"
    type: "유물 첫 반응"
    source: slgall
    heat: "2026-07-21 06:19 / 조회 5,570 / 추천 24 / 댓글 14"
    why: "유물 효과를 처음 본 즉시 반응형 제목과 댓글이 붙음."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=461143"
    flags: []
  - topic: "다우징 = ㅈ병신"
    type: "카드·유물 한줄 과대/과소"
    source: slgall
    heat: "2026-07-20 15:10 / 조회 6,472 / 추천 21 / 댓글 15"
    why: "v0.109.0 구간 카드 평가를 등식 한 줄로 단정하는 옵평 구조."
    url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=460705"
    flags: []

script_candidates:
  - topic: "오로바스 시발 새끼야!!!!!!!!!!!!!!"
    type: "멀티/고대 도박 실패의 동질감"
    body:
      excerpt: "추적 차오독 촉진제 예비 중 1개도 강화 안하고... 저것들한테 강화 박으면 어떡해"
      url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=463151"
      author_label: "감붕"
    comments:
      - text: "호부가 몇개야"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=463151 (댓글 고유 링크 없음)"
      - text: "고존유물 3개가치의 고존유물 ㄷㄷ"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=463151 (댓글 고유 링크 없음)"
      - text: "감히 확률을 시험해?"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=463151 (댓글 고유 링크 없음)"
    flags: []
    skip_reason: null
  - topic: "신성에 소멸제거 바르는 병신이 어딨음?"
    type: "런 실수의 자기박제"
    body:
      excerpt: "안녕하세요 병신 1입니다"
      url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=462609"
      author_label: "ㅇㅇ"
    comments:
      - text: "왜 그런짓을"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=462609 (댓글 고유 링크 없음)"
      - text: "1 붙이지 마라. 너는 독보적인 존재야"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=462609 (댓글 고유 링크 없음)"
      - text: "얼마나 신성한지 감도안잡힘"
        url: "https://gall.dcinside.com/mgallery/board/view/?id=slay&no=462609 (댓글 고유 링크 없음)"
    flags: []
    skip_reason: null
```
