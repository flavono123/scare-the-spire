# 배포 매뉴얼

## 1. GitHub 인증 (한 번만)

```bash
gh auth login
```

## 2. GitHub 레포 생성 + 푸시

```bash
gh repo create flavono123/scare-the-spire \
  --public \
  --description "슬서운 이야기 - Slay the Spire balance change history" \
  --source /Users/hansuk.hong/P/scare-the-spire \
  --push \
  --disable-issues \
  --disable-wiki
```

## 3. GitHub 권한 설정

Settings > Actions > General:
- Fork pull request workflows: "Require approval for all outside collaborators"

## 4. Vercel 배포

1. https://vercel.com/new 접속
2. "Import Git Repository" > `flavono123/scare-the-spire` 선택
3. Framework: Next.js (자동 감지)
4. Project Name: `scare-the-spire`
5. "Deploy" 클릭

## 5. 확인

- `https://scare-the-spire.vercel.app/` — 이야기 피드
- `https://scare-the-spire.vercel.app/cards` — 카드 브라우저

## 이미지

- WebP 340w, 총 28MB — git 직접 커밋 (LFS 불필요)
- 프로덕션 이미지는 Vercel Image Optimization을 사용하지 않음
- 이미지 컴포넌트는 `src/components/ui/static-image.tsx`를 기준으로 유지
