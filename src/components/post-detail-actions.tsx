"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Link2, Pencil, Trash2 } from "lucide-react";
import { GameConfirmModal } from "@/components/game-confirm-modal";
import { useServiceLocale } from "@/hooks/use-service-locale";
import { serviceMessages } from "@/messages/service";
import { cn } from "@/lib/utils";

const ACTION_BTN =
  "inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-gray-400 transition-colors";

/** Detail top-right order: copy link → edit (author) → delete (author). */
export function PostDetailActions({
  copied,
  copyLabel,
  copiedLabel,
  onCopy,
  isAuthor = false,
  editLabel,
  onEdit,
  deleteLabel,
  onDelete,
  children,
  className,
}: {
  copied: boolean;
  copyLabel: string;
  copiedLabel: string;
  onCopy: () => void;
  isAuthor?: boolean;
  editLabel?: string;
  onEdit?: () => void;
  deleteLabel?: string;
  onDelete?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  const serviceLocale = useServiceLocale();
  const confirmCopy = serviceMessages[serviceLocale].deleteConfirm;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDeleteClick = useCallback(() => {
    if (!onDelete) return;
    setConfirmOpen(true);
  }, [onDelete]);

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    onDelete?.();
  }, [onDelete]);

  const handleCancel = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <button
          type="button"
          onClick={onCopy}
          className={cn(ACTION_BTN, "hover:border-[#efc851]/40 hover:text-[#efc851]")}
        >
          <Link2 size={14} />
          {copied ? copiedLabel : copyLabel}
        </button>
        {isAuthor && onEdit && editLabel && (
          <button
            type="button"
            onClick={onEdit}
            className={cn(ACTION_BTN, "hover:border-[#efc851]/40 hover:text-[#efc851]")}
          >
            <Pencil size={14} />
            {editLabel}
          </button>
        )}
        {isAuthor && onDelete && deleteLabel && (
          <button
            type="button"
            onClick={handleDeleteClick}
            className={cn(ACTION_BTN, "hover:border-red-300/40 hover:text-red-200")}
          >
            <Trash2 size={14} />
            {deleteLabel}
          </button>
        )}
        {children}
      </div>
      <GameConfirmModal
        open={confirmOpen}
        title={confirmCopy.title}
        body={confirmCopy.body}
        confirmLabel={confirmCopy.confirm}
        cancelLabel={confirmCopy.cancel}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
