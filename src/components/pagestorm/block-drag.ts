import { NodeSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export function startPagestormBlockDrag(
  view: EditorView,
  pos: number,
  event: { dataTransfer: DataTransfer | null },
): boolean {
  const node = view.state.doc.nodeAt(pos);
  const transfer = event.dataTransfer;
  if (!node || !transfer) return false;
  const selection = NodeSelection.create(view.state.doc, pos);
  view.dispatch(view.state.tr.setSelection(selection));
  const slice = selection.content();
  view.dragging = { slice, move: true };
  transfer.effectAllowed = "move";
  transfer.setData("text/plain", node.textContent || node.type.name);
  return true;
}
