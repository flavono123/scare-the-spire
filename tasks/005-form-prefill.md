# Task 005: Google Form prefill 수정

## 상태: TODO

## 설명
"이야기 제보하기" 클릭 시 Google Form URL에 파라미터가 채워지지만,
실제 폼 필드에 값이 반영되지 않음.

## 원인
- 객관식(radio) 필드는 prefill 값이 선택지와 정확히 일치해야 함
- 현재 `entry.818237632=카드 (Card)` 전달 중이나 폼 내부 값 매칭 확인 필요

## 해결 방안
1. Google Form "사전 입력된 링크 가져오기"로 정확한 prefill URL 형식 확인
2. 또는 객관식 → 단답형으로 변경 (prefill 확실히 동작)
3. 장문형(이야기 문장)은 정상 동작할 가능성 높음 — 별도 확인
