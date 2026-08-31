"use client";

import Link from "next/link";
import { PagestormEditorShell } from "./shell";
import { PAGESTORM_EDITOR_VARIANTS } from "./variants";

export default function PagestormEditorIndex() {
  return (
    <PagestormEditorShell>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PAGESTORM_EDITOR_VARIANTS.map((variant) => (
          <li key={variant.id}>
            <Link
              href={`/dev/pagestorm-editor/${variant.id}`}
              className="block rounded-lg border border-border bg-card/30 p-4 hover:border-primary/50"
            >
              <h2 className="font-game-title text-lg">{variant.label}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{variant.engine}</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{variant.chrome}</p>
            </Link>
          </li>
        ))}
      </ul>
      <section className="rounded-lg border border-dashed border-border p-4 text-sm leading-relaxed text-muted-foreground">
        <h2 className="mb-2 font-game-title text-foreground">같은 시나리오</h2>
        <p>
          점모 리젠트 공략 톤: {"{"} 또는 삽입 바로 카드/유물 초상을 넣고, 가운데 정렬하고,
          유튜브는 플레이어, Steam URL은 OG 카드. 편집 중에는 초상이 페이지를 떠나지 않는다.
        </p>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4 text-sm leading-relaxed text-zinc-300">
        <h2 className="font-game-title text-foreground">일반 기능은 전부 구현 가능한가</h2>
        <p>
          가능하다. {"{"} 자동완성, 편집 중 비링크, 발행 링크 토글, 리사이즈, Enter로 다음
          문단, Backspace로 애셋 삭제는 엔진 기능이 아니라 노드를 어떻게 심느냐의 문제다.
          이전 목에서 안 된 이유는 atom 블록을 문단 없이 붙이고 초상을 a 태그로 감쌌기 때문이다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tiptap: @tiptap/suggestion 이 이미 케미컬X에 있다. 이 목이 그걸 빼서 Tiptap처럼 안 느껴졌다.</li>
          <li>BlockNote: 블록 모델이라 Enter/Backspace는 기본에 가깝고, {"{"} 는 슬래시 컨트롤러를 하나 더 붙이면 된다.</li>
          <li>Lexical: DecoratorNode + 커맨드. {"{"} 는 직접 리스너. 가능하지만 이 레포에 기존 스택이 없다.</li>
          <li>바닐라: 키 리스너와 드롭다운은 그릴 수 있지만 한글 IME와 선택이 먼저 무너진다.</li>
        </ul>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4 text-sm leading-relaxed text-zinc-300">
        <h2 className="font-game-title text-foreground">Cloudflare Workers Free</h2>
        <p>
          서류 작성기 본편도 에디터는 브라우저, 저장은 JSON, Worker는 껍데기만이다. 차이는
          프로덕션 클라이언트 번들과 실수로 Worker 트레이스에 큰 라이브러리가 남는 위험이다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Tiptap: 이미 케미컬X/댓글에 있다. 증분은 text-align·버블 정도. 요청 CPU 0.
            가드레일에 가장 맞다.
          </li>
          <li>
            바닐라: 새 패키지 없음. 번들은 작지만 IME를 직접 고치면 코드가 커지고, Worker와는
            무관하게 작성 품질이 먼저 막힌다.
          </li>
          <li>
            Lexical: 새 클라이언트 의존. /dev 에만 두면 prune이 자르지만, 본편 라우트에 넣는
            순간 Chemical X와 에디터가 두 개가 된다.
          </li>
          <li>
            BlockNote: 제일 크다. Ariakit·자체 Tiptap 트리. 본편 Worker/클라이언트에 넣으면
            3MiB gzip 한도에 가장 가깝다. 실험실 전용으로만 둔다.
          </li>
        </ul>
      </section>

      <section className="space-y-3 rounded-lg border border-border p-4 text-sm leading-relaxed text-zinc-300">
        <h2 className="font-game-title text-foreground">한국인 · 공략 흡수</h2>
        <p>
          슬갤/점모 전사는 카드 초상을 빠르게 많이 넣고, 한글 조합 중 팝업이 깨지면 바로
          포기한다. Notion식 /image 영어 슬래시보다 {"{케미컬"} 이 이 서비스 근육에 가깝다.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Tiptap 상단 툴바 + {"{"} : 추천. 보이는 GUI + 이미 있는 prefix. 한글 IME는 케미컬X에서 검증됨.</li>
          <li>Tiptap 버블: 파워유저용. 점모 전사에게는 툴바가 덜 숨는다.</li>
          <li>BlockNote: / 는 노션 사용자에게 편하지만, 흡수 워크플로는 {"{"} 초상이 더 짧다. 번들 대가다.</li>
          <li>Lexical: IME는 괜찮지만 학습 비용과 이중 에디터가 흡수 커뮤니티에 이득이 없다.</li>
          <li>바닐라: 한글 조합·백스페이스가 가장 약하다. 비교용으로만.</li>
        </ul>
      </section>
    </PagestormEditorShell>
  );
}
