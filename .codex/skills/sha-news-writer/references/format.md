# 섀 소식 Format Reference

## Canonical Markdown

```md
# 2026-06-09

## 공통
- 홈에 [gold]섀 소식[/gold] 진입점을 추가했다
- 섀 소식은 패치노트와 별도의 서비스 업데이트 알림판으로 분리했다

## 역사 강의서
- 공유 런 목록을 더 쉽게 확인할 수 있게 정리했다
```

Rules:

- The H1 is exactly the deployment date in `YYYY-MM-DD`.
- H2 headings are service areas.
- Bullets are one line each.
- No intro paragraph.
- No nested bullets.
- No empty sections.

## Allowed Service Sections

Prefer these exact Korean headings:

- `공통`
- `섀 소식`
- `역사 강의서`
- `백과사전`
- `케미컬X`
- `프로필`
- `댓글`
- `개발/운영`

Use `기타` only when no section fits.

## User Prompt Template

```md
섀 소식 작성해줘.

배포일: 2026-06-09

원문:
공통
- 홈에 섀 소식 진입점 만듦
- byrdpip 아이콘 쓰고 패치노트랑 분리되게 함

역사 강의서
- 공유 런 목록 개선
- 개발용 런 조회 API 추가

규칙:
- 최종 결과는 data/sha-news/2026-06-09.md
- # 2026-06-09
- ## 서비스명
- bullet은 한 줄
- 필요한 게임/서비스 항목은 기존 rich patch 문법으로 링크/툴팁 처리
- 확실하지 않은 레퍼런스는 태그를 만들지 말고 평문으로 둬
```

## Rich Reference Examples

Use typed tags only when verified:

```md
- [gold:relic]역사 강의서[/gold] 화면에 공유 런 목록을 추가했다
- [gold:card]광기[/gold]와 [gold:potion]광기의 포션[/gold]을 함께 보여주는 이야기를 추가했다
- [gold:monster]섀도니스[/gold] 관련 소식을 홈에서 구분해 볼 수 있게 했다
```

Use plain gold for service-only terms with no Codex target:

```md
- 홈에 [gold]섀 소식[/gold] 진입점을 추가했다
```

Keep plain text when uncertain:

```md
- 개발용 런 조회 API를 추가했다
```

## Media Metadata

Default:

```md
미디어:
- 필요 없음
```

Screenshot request:

```md
미디어:
- 홈 섀 소식 진입점 모바일 스크린샷
- route: /
- viewport: iPhone 13 mini
- output: /images/sha-news/2026-06-09/home-entry-mobile.png
```

Markdown reference:

```md
![홈 섀 소식 진입점](/images/sha-news/2026-06-09/home-entry-mobile.png)
```

## Normalization Examples

Input:

```md
공통
- sha news 만들었음
- 패치노트랑 헷갈리지 않게 함
```

Output:

```md
## 공통
- 홈에 [gold]섀 소식[/gold] 진입점을 추가했다
- 섀 소식을 패치노트와 별도의 서비스 업데이트 알림판으로 구분했다
```
