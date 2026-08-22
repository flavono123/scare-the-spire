import type { CSSProperties, ReactNode } from "react";

export function StoryStack({
  children,
  gap = 16,
}: {
  children: ReactNode;
  gap?: number;
}) {
  return (
    <div className="flex max-w-4xl flex-col" style={{ gap }}>
      {children}
    </div>
  );
}

export function StoryNote({ children }: { children: ReactNode }) {
  return <p className="font-service text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

export function StoryHeading({ children }: { children: ReactNode }) {
  return <h2 className="font-service text-lg font-semibold text-foreground">{children}</h2>;
}

export function Swatch({
  label,
  value,
  color,
  className,
}: {
  label: string;
  value: string;
  color?: string;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={className}
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          border: "1px solid rgb(255 255 255 / 0.12)",
          background: color,
          flexShrink: 0,
        }}
      />
      <span className="min-w-0">
        <span className="block font-service text-sm text-foreground">{label}</span>
        <span className="block font-mono text-[11px] text-muted-foreground">{value}</span>
      </span>
    </div>
  );
}

export function CompareTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-xs text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border/60 align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 font-service text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SampleCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="rounded-lg border border-border bg-card/30 p-4"
      style={style}
    >
      {children}
    </div>
  );
}
