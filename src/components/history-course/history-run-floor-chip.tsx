"use client";

import Image from "@/components/ui/static-image";
import type { HistoryRunFloorBlock } from "@/lib/chemical-types";
import {
  historyRunFloorPlainText,
  historyRunFloorSpriteSrc,
} from "@/lib/history-run-floor";
import { cn } from "@/lib/utils";
import { useServiceLocale } from "@/hooks/use-service-locale";

export function HistoryRunFloorChip({
  block,
  onClick,
  className,
}: {
  block: HistoryRunFloorBlock;
  onClick?: (block: HistoryRunFloorBlock) => void;
  className?: string;
}) {
  const serviceLocale = useServiceLocale();
  const label = historyRunFloorPlainText(block, serviceLocale);
  const spriteSrc = historyRunFloorSpriteSrc(block);
  const interactive = typeof onClick === "function";
  const classNames = cn(
    "inline-flex max-w-full items-center gap-1 rounded-md border border-amber-300/25 bg-amber-300/10 px-1.5 py-0.5 align-baseline text-xs font-semibold text-amber-100",
    interactive && "cursor-pointer hover:border-amber-300/50 hover:bg-amber-300/20",
    className,
  );

  const inner = (
    <>
      <Image
        src={spriteSrc}
        alt=""
        width={16}
        height={16}
        className="h-4 w-4 shrink-0 object-contain"
      />
      <span className="truncate">{label}</span>
    </>
  );

  if (interactive) {
    return (
      <button type="button" className={classNames} onClick={() => onClick(block)}>
        {inner}
      </button>
    );
  }

  return <span className={classNames}>{inner}</span>;
}
