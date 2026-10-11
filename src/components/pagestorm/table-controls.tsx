"use client";

import type { Editor } from "@tiptap/react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { GameUiHoverTip, GAME_UI_HOVER_TIP_NAV_DELAY_MS } from "@/components/game-ui-hover-tip";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";

type Grip = { x: number; y: number };

type TableGrips = {
  addRow: Grip;
  addColumn: Grip;
  deleteRow: Grip;
  deleteColumn: Grip;
  deleteTable: Grip;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function tableGrips(editor: Editor, frame: HTMLElement): TableGrips | null {
  if (!editor.isEditable || !editor.isActive("table")) return null;
  const { $from } = editor.state.selection;
  let tableDepth = -1;
  let cellDepth = -1;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (tableDepth < 0 && name === "table") tableDepth = depth;
    if (cellDepth < 0 && (name === "tableCell" || name === "tableHeader")) cellDepth = depth;
  }
  if (tableDepth < 0) return null;
  const tableDom = editor.view.nodeDOM($from.before(tableDepth));
  if (!(tableDom instanceof HTMLElement)) return null;
  const frameRect = frame.getBoundingClientRect();
  const tableRect = tableDom.getBoundingClientRect();
  const cellDom = cellDepth > 0 ? editor.view.nodeDOM($from.before(cellDepth)) : null;
  const cellRect = cellDom instanceof HTMLElement ? cellDom.getBoundingClientRect() : tableRect;
  const pad = 14;
  const maxX = Math.max(pad, frame.clientWidth - pad);
  const maxY = Math.max(pad, frame.clientHeight - pad);
  const point = (x: number, y: number): Grip => ({
    x: clamp(x - frameRect.left, pad, maxX),
    y: clamp(y - frameRect.top, pad, maxY),
  });
  return {
    addRow: point(tableRect.left + tableRect.width / 2, tableRect.bottom),
    addColumn: point(tableRect.right, tableRect.top + tableRect.height / 2),
    deleteRow: point(tableRect.left, cellRect.top + cellRect.height / 2),
    deleteColumn: point(cellRect.left + cellRect.width / 2, tableRect.top),
    deleteTable: point(tableRect.right, tableRect.top),
  };
}

function GripButton({
  label,
  grip,
  className,
  onClick,
  children,
}: {
  label: string;
  grip: Grip;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <span
      className="pagestorm-table-grip-anchor"
      style={{ left: grip.x, top: grip.y }}
    >
      <GameUiHoverTip label={label} delayMs={GAME_UI_HOVER_TIP_NAV_DELAY_MS}>
        <button
          type="button"
          aria-label={label}
          className={className}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClick}
        >
          {children}
        </button>
      </GameUiHoverTip>
    </span>
  );
}

export function PagestormTableControls({
  editor,
  frameRef,
}: {
  editor: Editor;
  frameRef: RefObject<HTMLElement | null>;
}) {
  const copy = serviceMessages[useServiceLocale()].pagestorm;
  const [grips, setGrips] = useState<TableGrips | null>(null);

  useEffect(() => {
    const update = () => {
      const frame = frameRef.current;
      setGrips(frame ? tableGrips(editor, frame) : null);
    };
    update();
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [editor, frameRef]);

  if (!grips) return null;

  return (
    <div className="pagestorm-table-controls" contentEditable={false}>
      <GripButton
        label={copy.tableAddRow}
        grip={grips.addRow}
        className="pagestorm-table-grip pagestorm-table-grip-add pagestorm-table-grip-row"
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        <Plus aria-hidden className="h-3.5 w-3.5" />
      </GripButton>
      <GripButton
        label={copy.tableAddColumn}
        grip={grips.addColumn}
        className="pagestorm-table-grip pagestorm-table-grip-add pagestorm-table-grip-col"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        <Plus aria-hidden className="h-3.5 w-3.5" />
      </GripButton>
      <GripButton
        label={copy.tableDeleteRow}
        grip={grips.deleteRow}
        className="pagestorm-table-grip pagestorm-table-grip-delete"
        onClick={() => editor.chain().focus().deleteRow().run()}
      >
        <Minus aria-hidden className="h-3.5 w-3.5" />
      </GripButton>
      <GripButton
        label={copy.tableDeleteColumn}
        grip={grips.deleteColumn}
        className="pagestorm-table-grip pagestorm-table-grip-delete"
        onClick={() => editor.chain().focus().deleteColumn().run()}
      >
        <Minus aria-hidden className="h-3.5 w-3.5" />
      </GripButton>
      <GripButton
        label={copy.tableDelete}
        grip={grips.deleteTable}
        className="pagestorm-table-grip pagestorm-table-grip-delete"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        <Trash2 aria-hidden className="h-3.5 w-3.5" />
      </GripButton>
    </div>
  );
}
