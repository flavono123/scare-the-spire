"use client";

import { TextConPanel } from "@/components/text-con/text-con-panel";
import { AnchoredConPopup } from "@/components/editor/anchored-con-popup";
import {
  DEFAULT_TEXTCON_BG,
  DEFAULT_TEXTCON_TEXT,
} from "@/lib/text-con";

const TEXT_CON_POPUP_WIDTH = 360;
const TEXT_CON_POPUP_HEIGHT = 475;

export interface TextConPopupProps {
  open: boolean;
  anchor: DOMRect | null;
  triggerRef?: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onInsert: (data: { text: string; bgColor: string; textColor: string }) => void;
  initialText?: string;
  initialBgColor?: string;
  initialTextColor?: string;
  autoFocus?: boolean;
}

export function TextConPopup(props: TextConPopupProps) {
  if (!props.open) return null;
  return <TextConPopupInner {...props} />;
}

function TextConPopupInner({
  anchor,
  triggerRef,
  onClose,
  onInsert,
  initialText = "",
  initialBgColor = DEFAULT_TEXTCON_BG,
  initialTextColor = DEFAULT_TEXTCON_TEXT,
  autoFocus = true,
}: Omit<TextConPopupProps, "open">) {
  return (
    <AnchoredConPopup
      anchor={anchor}
      triggerRef={triggerRef}
      onClose={onClose}
      ariaLabel="글자콘 만들기"
      dataAttribute="data-text-con-popup"
      width={TEXT_CON_POPUP_WIDTH}
      height={TEXT_CON_POPUP_HEIGHT}
    >
      <TextConPanel
        onClose={onClose}
        onInsert={(data) => {
          onInsert(data);
          onClose();
        }}
        initialText={initialText}
        initialBgColor={initialBgColor}
        initialTextColor={initialTextColor}
        autoFocus={autoFocus}
      />
    </AnchoredConPopup>
  );
}
