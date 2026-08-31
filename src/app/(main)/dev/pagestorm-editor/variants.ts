export const PAGESTORM_EDITOR_VARIANTS = [
  {
    id: "tiptap-toolbar",
    label: "Tiptap · 상단 툴바",
    engine: "이미 있는 Tiptap 3",
    chrome: "문서 위 고정 GUI. Word/블로그 글쓰기 기본형.",
  },
  {
    id: "tiptap-bubble",
    label: "Tiptap · 버블/플로팅",
    engine: "이미 있는 Tiptap 3",
    chrome: "선택하면 버블, 빈 줄에서 플로팅. Medium식.",
  },
  {
    id: "blocknote",
    label: "BlockNote",
    engine: "@blocknote (Tiptap 위 Notion식 UI)",
    chrome: "슬래시 메뉴 + 블록 핸들 + 포맷 툴바가 기본 포함.",
  },
  {
    id: "lexical",
    label: "Lexical",
    engine: "Meta Lexical",
    chrome: "헤드리스. 상단 툴바는 우리가 그림. 노드 모델이 Tiptap과 다름.",
  },
  {
    id: "vanilla",
    label: "바닐라 (요구사항만)",
    engine: "React 블록 + contenteditable",
    chrome: "라이브러리 없이 필수 기능만. IME/선택 한계가 비교 포인트.",
  },
] as const;

export type PagestormEditorVariantId =
  (typeof PAGESTORM_EDITOR_VARIANTS)[number]["id"];

export function isPagestormEditorVariant(
  value: string,
): value is PagestormEditorVariantId {
  return PAGESTORM_EDITOR_VARIANTS.some((variant) => variant.id === value);
}

export function pagestormEditorVariant(id: PagestormEditorVariantId) {
  const match = PAGESTORM_EDITOR_VARIANTS.find((variant) => variant.id === id);
  if (!match) throw new Error(`unknown pagestorm editor variant: ${id}`);
  return match;
}
