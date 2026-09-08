import type { CSSProperties } from "react";
import Image from "@/components/ui/static-image";
import { parseSts1CardText, type Sts1TextSpan } from "@/lib/sts1/description";
import { sts1CardUiUrl } from "@/lib/sts1/paths";
import type { Sts1CardStats, Sts1Keyword } from "@/lib/sts1/types";

const ORB_SRC = {
  red: sts1CardUiUrl("card_red_orb"),
  green: sts1CardUiUrl("card_green_orb"),
  blue: sts1CardUiUrl("card_blue_orb"),
  purple: sts1CardUiUrl("card_purple_orb"),
  colorless: sts1CardUiUrl("card_colorless_orb"),
} as const;

function Sts1TextSpanView({ span }: { span: Sts1TextSpan }) {
  if (span.kind === "break") return <br />;
  if (span.kind === "energy") {
    return (
      <Image
        src={ORB_SRC[span.orb]}
        alt=""
        width={18}
        height={18}
        className="mx-px inline-block h-[1em] w-[1em] align-[-0.15em] object-contain"
      />
    );
  }
  return (
    <span style={span.color ? { color: span.color } : undefined}>
      {span.text}
    </span>
  );
}

export function Sts1CardText({
  text,
  stats,
  keywords = [],
  className,
  style,
}: {
  text: string;
  stats: Sts1CardStats;
  keywords?: readonly Sts1Keyword[];
  className?: string;
  style?: CSSProperties;
}) {
  const spans = parseSts1CardText(text, stats, keywords);
  return (
    <p className={className} style={style}>
      {spans.map((span, index) => (
        <Sts1TextSpanView key={index} span={span} />
      ))}
    </p>
  );
}
