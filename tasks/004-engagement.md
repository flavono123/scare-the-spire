# Task 004: 좋아요/댓글 기능

## 상태: TODO

## 설명

이야기 카드에 좋아요(♥)와 댓글(💬) 기능 추가.
Vercel 배포 기준으로 추가 인프라 검토 필요.

## 후보 스택

- **좋아요**: Vercel KV (Redis) 또는 Upstash — 무료 tier 있음
- **댓글**: Vercel Postgres 또는 Turso (SQLite edge) — 무료 tier 있음
- **인증**: 게이머 친화적 (닉네임 기반? 소셜 로그인?)

## 고려사항

- 최대한 비용 없이
- Vercel 무료 tier 범위 내
- 대량 트래픽 예상 안 함
- 스팸 방지 최소한의 인증 필요
