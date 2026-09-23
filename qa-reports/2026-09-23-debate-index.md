# QA Report: 슬서운이야기

| Field | Value |
| --- | --- |
| **Date** | 2026-09-23 |
| **URL** | http://localhost:3001/debate |
| **Tier** | Quick |
| **Scope** | 토론 index only |
| **Pages visited** | `/debate`, `/en/debate` |

## Health Score: 92/100

| Category | Score |
| --- | --- |
| Console | 100 |
| Links | 100 |
| Visual | 85 |
| Functional | 100 |
| UX | 90 |
| Performance | 100 |
| Content | 100 |

## Top 3 Things to Fix

1. None blocking. Background statues sit under the empty stage; still visible on desktop.

## Summary

| Severity | Count |
| --- | --- |
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 1 |
| **Total** | **1** |

## Issues

### ISSUE-001: Event background sits low under the stage

- **Severity**: Low
- **Category**: Visual
- **URL**: `/debate`
- **Status**: open
- **Description**: `colorful_philosophers` is mostly black. After raising opacity and pinning the crop to the statues, the colored figures show below the empty stage on desktop. 390px width does not overflow.

## Checks

- Korean `h1` 토론, `h2` 이번 주 게임 요소 토론하기, hero is the Colorful Philosophers last sentence.
- English `/en/debate` uses Debate / Discuss a game element this week / You chime in with your thoughts.
- Meta and OG description are the functional subtitle template. The hero is not in the description.
- Toy Box order under 조각모음: 토론, 서류 폭풍, 어려운 결정. Token is `modifiers/draft.webp`.
- No page errors. Mobile 390px `scrollWidth` equals `clientWidth`.
