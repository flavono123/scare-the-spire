import { Extension, mergeAttributes, Node } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

export const PAGESTORM_ASSET_ROW = "assetRow";

export const PAGESTORM_EMBED_NODE_NAMES = [
  "gameAsset",
  "youtubePlayer",
  "ogBookmark",
  "toyboxEmbed",
] as const;

export type PagestormDropZone = "before" | "after" | "left" | "right";

const DROP_PLUGIN_KEY = new PluginKey<PagestormDropHint | null>("pagestormAssetDrop");

type PagestormDropHint = {
  pos: number;
  zone: PagestormDropZone;
};

const EMBED_NAMES = new Set<string>(PAGESTORM_EMBED_NODE_NAMES);

export function isPagestormEmbedNode(node: PMNode | null | undefined): boolean {
  return Boolean(node && EMBED_NAMES.has(node.type.name));
}

/** Top/bottom thirds stack. The middle third splits left/right. */
export function pagestormDropZone(relX: number, relY: number): PagestormDropZone {
  if (relY < 1 / 3) return "before";
  if (relY > 2 / 3) return "after";
  return relX < 0.5 ? "left" : "right";
}

function embedPosFromCoords(view: EditorView, event: DragEvent): number | null {
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!coords) return null;
  const inside = coords.inside >= 0 ? coords.inside : coords.pos;
  const $pos = view.state.doc.resolve(Math.min(inside, view.state.doc.content.size));
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (isPagestormEmbedNode(node)) return $pos.before(depth);
    if (node.type.name === PAGESTORM_ASSET_ROW) {
      const child = node.childCount > 1 && relXInNode(view, $pos.before(depth), event.clientX) >= 0.5
        ? 1
        : 0;
      return $pos.before(depth) + 1 + childOffset(node, child);
    }
  }
  const after = $pos.nodeAfter;
  if (isPagestormEmbedNode(after)) return $pos.pos;
  const before = $pos.nodeBefore;
  if (isPagestormEmbedNode(before)) return $pos.pos - before.nodeSize;
  return null;
}

function childOffset(parent: PMNode, index: number): number {
  let offset = 0;
  for (let i = 0; i < index; i += 1) offset += parent.child(i).nodeSize;
  return offset;
}

function relXInNode(view: EditorView, pos: number, clientX: number): number {
  const dom = view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return 0;
  const rect = (dom.querySelector("[data-pagestorm-asset-box]") ?? dom).getBoundingClientRect();
  if (rect.width <= 0) return 0;
  return (clientX - rect.left) / rect.width;
}

export function pagestormPointerZone(
  relX: number,
  relY: number,
  inside: boolean,
  nodeRelY: number,
): PagestormDropZone {
  if (!inside) return nodeRelY < 0.5 ? "before" : "after";
  return pagestormDropZone(relX, relY);
}

function zoneAtEvent(view: EditorView, pos: number, event: DragEvent): PagestormDropZone | null {
  const dom = view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) return null;
  const box = (dom.querySelector("[data-pagestorm-asset-box]") ?? dom).getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return null;
  const relX = (event.clientX - box.left) / box.width;
  const relY = (event.clientY - box.top) / box.height;
  const inside = relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1;
  const nodeRect = dom.getBoundingClientRect();
  const nodeRelY = nodeRect.height > 0 ? (event.clientY - nodeRect.top) / nodeRect.height : 0.5;
  return pagestormPointerZone(relX, relY, inside, nodeRelY);
}

function selectionEmbed(state: EditorView["state"]): { pos: number; node: PMNode } | null {
  if (!(state.selection instanceof NodeSelection)) return null;
  const node = state.selection.node;
  if (!isPagestormEmbedNode(node)) return null;
  return { pos: state.selection.from, node };
}

function rowPosAround(doc: PMNode, embedPos: number): number | null {
  const $pos = doc.resolve(embedPos);
  if ($pos.parent.type.name === PAGESTORM_ASSET_ROW) return $pos.before($pos.depth);
  return null;
}

function deleteEmbed(tr: Transaction, pos: number): Transaction {
  const mapped = tr.mapping.map(pos);
  const node = tr.doc.nodeAt(mapped);
  if (!node || !isPagestormEmbedNode(node)) return tr;
  const $pos = tr.doc.resolve(mapped);
  if ($pos.parent.type.name === PAGESTORM_ASSET_ROW) {
    const rowPos = $pos.before($pos.depth);
    const row = $pos.parent;
    const remaining: PMNode[] = [];
    row.forEach((child, offset) => {
      if (rowPos + 1 + offset !== mapped) remaining.push(child);
    });
    return tr.replaceWith(rowPos, rowPos + row.nodeSize, remaining);
  }
  return tr.delete(mapped, mapped + node.nodeSize);
}

function pairEmbeds(
  view: EditorView,
  dragged: { pos: number; node: PMNode },
  targetPos: number,
  side: "left" | "right",
): boolean {
  const { state } = view;
  const target = state.doc.nodeAt(targetPos);
  if (!target || !isPagestormEmbedNode(target) || targetPos === dragged.pos) return false;

  const draggedRow = rowPosAround(state.doc, dragged.pos);
  const targetRow = rowPosAround(state.doc, targetPos);
  if (draggedRow != null && draggedRow === targetRow) {
    const row = state.doc.nodeAt(draggedRow);
    if (!row || row.childCount !== 2) return false;
    const left = side === "left" ? dragged.node : target;
    const right = side === "left" ? target : dragged.node;
    if (left === row.child(0) && right === row.child(1)) return true;
    const next = row.type.create(row.attrs, [left.copy(), right.copy()]);
    view.dispatch(state.tr.replaceWith(draggedRow, draggedRow + row.nodeSize, next));
    return true;
  }
  if (targetRow != null && draggedRow !== targetRow) return false;

  const left = side === "left" ? dragged.node : target;
  const right = side === "left" ? target : dragged.node;
  const rowType = state.schema.nodes[PAGESTORM_ASSET_ROW];
  if (!rowType) return false;
  const row = rowType.create(null, [left.copy(), right.copy()]);

  let tr = state.tr;
  const later = Math.max(dragged.pos, targetPos);
  const earlier = Math.min(dragged.pos, targetPos);
  tr = deleteEmbed(tr, later);
  tr = deleteEmbed(tr, earlier);
  const insertAt = tr.mapping.map(targetPos, targetPos > dragged.pos ? -1 : 1);
  const clamped = Math.max(0, Math.min(insertAt, tr.doc.content.size));
  tr = tr.insert(clamped, row);
  view.dispatch(tr.scrollIntoView());
  return true;
}

function moveEmbedAround(
  view: EditorView,
  dragged: { pos: number; node: PMNode },
  targetPos: number,
  zone: "before" | "after",
): boolean {
  if (targetPos === dragged.pos) return false;
  const { state } = view;
  const target = state.doc.nodeAt(targetPos);
  if (!target || !isPagestormEmbedNode(target)) return false;

  const targetRow = rowPosAround(state.doc, targetPos);
  const blockPos = targetRow ?? targetPos;
  const blockNode = state.doc.nodeAt(blockPos);
  if (!blockNode) return false;
  const insertPos = zone === "before" ? blockPos : blockPos + blockNode.nodeSize;
  if (dragged.pos === insertPos || dragged.pos + dragged.node.nodeSize === insertPos) return true;

  let tr = state.tr;
  const copy = dragged.node.copy();
  tr = deleteEmbed(tr, dragged.pos);
  const mapped = tr.mapping.map(insertPos, dragged.pos < insertPos ? -1 : 1);
  tr = tr.insert(mapped, copy);
  view.dispatch(tr.scrollIntoView());
  return true;
}

function applyDrop(
  view: EditorView,
  event: DragEvent,
  moved: boolean,
): boolean {
  if (!moved) return false;
  const dragged = selectionEmbed(view.state);
  if (!dragged) return false;
  const targetPos = embedPosFromCoords(view, event);
  if (targetPos == null) return false;
  const zone = zoneAtEvent(view, targetPos, event);
  if (!zone) return false;
  event.preventDefault();
  if (zone === "left" || zone === "right") {
    pairEmbeds(view, dragged, targetPos, zone);
  } else {
    moveEmbedAround(view, dragged, targetPos, zone);
  }
  return true;
}

export const AssetRowNode = Node.create({
  name: PAGESTORM_ASSET_ROW,
  group: "block",
  content: "(gameAsset | youtubePlayer | ogBookmark | toyboxEmbed){2}",
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: "div[data-pagestorm-asset-row]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-pagestorm-asset-row": "",
        class: "pagestorm-asset-row",
      }),
      0,
    ];
  },
});

export const PagestormAssetLayout = Extension.create({
  name: "pagestormAssetLayout",
  addProseMirrorPlugins() {
    return [
      new Plugin<PagestormDropHint | null>({
        key: DROP_PLUGIN_KEY,
        state: {
          init: () => null,
          apply(tr, current) {
            const meta = tr.getMeta(DROP_PLUGIN_KEY);
            if (meta === undefined) return tr.docChanged ? null : current;
            return meta as PagestormDropHint | null;
          },
        },
        props: {
          handleDOMEvents: {
            dragover(view, event) {
              const dragged = selectionEmbed(view.state);
              if (!dragged) return false;
              const targetPos = embedPosFromCoords(view, event);
              if (targetPos == null) {
                if (DROP_PLUGIN_KEY.getState(view.state)) {
                  view.dispatch(view.state.tr.setMeta(DROP_PLUGIN_KEY, null));
                }
                return false;
              }
              const zone = zoneAtEvent(view, targetPos, event);
              if (!zone) return false;
              event.preventDefault();
              const current = DROP_PLUGIN_KEY.getState(view.state);
              if (current?.pos === targetPos && current.zone === zone) return true;
              view.dispatch(view.state.tr.setMeta(DROP_PLUGIN_KEY, { pos: targetPos, zone }));
              return true;
            },
            dragleave(view, event) {
              if (
                event.relatedTarget instanceof HTMLElement
                && view.dom.contains(event.relatedTarget)
              ) {
                return false;
              }
              if (DROP_PLUGIN_KEY.getState(view.state)) {
                view.dispatch(view.state.tr.setMeta(DROP_PLUGIN_KEY, null));
              }
              return false;
            },
            drop(view) {
              if (DROP_PLUGIN_KEY.getState(view.state)) {
                view.dispatch(view.state.tr.setMeta(DROP_PLUGIN_KEY, null));
              }
              return false;
            },
          },
          handleDrop(view, event, _slice, moved) {
            const handled = applyDrop(view, event, moved);
            if (DROP_PLUGIN_KEY.getState(view.state)) {
              view.dispatch(view.state.tr.setMeta(DROP_PLUGIN_KEY, null));
            }
            return handled;
          },
        },
        view(view) {
          const hint = document.createElement("div");
          hint.className = "pagestorm-drop-hint";
          hint.setAttribute("aria-hidden", "true");
          hint.setAttribute("contenteditable", "false");
          hint.style.display = "none";
          const hostEl = view.dom;
          hostEl.appendChild(hint);
          const paint = () => {
            const state = DROP_PLUGIN_KEY.getState(view.state);
            if (!state) {
              hint.style.display = "none";
              return;
            }
            const dom = view.nodeDOM(state.pos);
            if (!(dom instanceof HTMLElement)) {
              hint.style.display = "none";
              return;
            }
            const boxEl = (dom.querySelector("[data-pagestorm-asset-box]") ?? dom);
            const rect = boxEl.getBoundingClientRect();
            const host = hostEl.getBoundingClientRect();
            const pad = 10;
            hint.dataset.zone = state.zone;
            hint.style.display = "block";
            hint.style.overflow = "visible";
            hint.style.padding = `${pad}px`;
            hint.style.top = `${rect.top - host.top + hostEl.scrollTop - pad}px`;
            hint.style.left = `${rect.left - host.left + hostEl.scrollLeft - pad}px`;
            hint.style.width = `${rect.width + pad * 2}px`;
            hint.style.height = `${rect.height + pad * 2}px`;
          };
          return {
            update: paint,
            destroy() {
              hint.remove();
            },
          };
        },
      }),
    ];
  },
  appendTransaction(transactions, _oldState, newState) {
    if (!transactions.some((tr) => tr.docChanged)) return null;
    const ranges: Array<{ from: number; to: number; nodes: PMNode[] }> = [];
    newState.doc.descendants((node, pos) => {
      if (node.type.name !== PAGESTORM_ASSET_ROW) return;
      if (node.childCount === 2) return;
      const nodes: PMNode[] = [];
      node.forEach((child) => nodes.push(child));
      ranges.push({ from: pos, to: pos + node.nodeSize, nodes });
    });
    if (ranges.length === 0) return null;
    let tr: Transaction | null = null;
    for (const range of ranges.sort((a, b) => b.from - a.from)) {
      tr = (tr ?? newState.tr).replaceWith(range.from, range.to, range.nodes);
    }
    return tr;
  },
});
