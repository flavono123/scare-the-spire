import type { CSSProperties, ReactNode } from "react";
import { sts1TipUrl } from "@/lib/sts1/paths";

function slice(part: "tipTop" | "tipMid" | "tipBot"): CSSProperties {
  return {
    borderStyle: "solid",
    borderWidth: "0 24px",
    borderImage: `url(${sts1TipUrl(part)}) 0 24 fill / 0 24px stretch`,
  };
}

/** TipHelper's box: tipTop / tipMid (repeated) / tipBot, 320 wide, gold title over cream text. */
export function Sts1TipBox({
  title,
  titleColor = "#efc851",
  icon,
  children,
  className = "",
  style,
}: {
  title: ReactNode;
  titleColor?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`relative min-w-0 ${className}`} style={style}>
      {/* 3-slice each strip so the 320px art keeps its edges at any width. */}
      <div className="absolute inset-x-0 top-0 h-8" style={slice("tipTop")} />
      <div className="absolute inset-x-0 bottom-8 top-8" style={slice("tipMid")} />
      <div className="absolute inset-x-0 bottom-0 h-8" style={slice("tipBot")} />
      <div className="relative flex gap-3 px-5 pb-5 pt-4">
        {icon ? <div className="shrink-0">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <div className="font-game-title text-[15px] font-bold leading-tight" style={{ color: titleColor }}>{title}</div>
          {children ? <div className="mt-1.5 font-game-text text-[13px] leading-snug text-[#fff6e2]">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
