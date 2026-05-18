import Image from "@/components/ui/static-image";
import Link from "next/link";
import type { ReactNode } from "react";
import { localizeHref, type ServiceLocale } from "@/lib/i18n";

type CodexReferenceKind = "card" | "event";

export interface CodexReferenceTarget {
  id: string;
  href: string;
  title: string;
}

interface EntityReferenceLinksProps {
  children?: ReactNode;
  kind: CodexReferenceKind;
  serviceLocale: ServiceLocale;
  targets: readonly CodexReferenceTarget[];
}

const REFERENCE_KIND_CONFIG: Record<CodexReferenceKind, { icon: string; label: string }> = {
  card: {
    icon: "/images/sts2/nav/stats_cards.png",
    label: "관련 카드",
  },
  event: {
    icon: "/images/sts2/nav/question_mark.png",
    label: "관련 이벤트",
  },
};

export function EntityReferenceLinks({
  children,
  kind,
  serviceLocale,
  targets,
}: EntityReferenceLinksProps) {
  if (targets.length === 0) return null;
  const config = REFERENCE_KIND_CONFIG[kind];

  return (
    <section className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-bold text-gray-300">
        <Image
          src={config.icon}
          alt=""
          width={22}
          height={22}
          className="h-5 w-5 object-contain"
        />
        <span>{config.label}:</span>
        {targets.map((target, index) => (
          <span key={target.id} className="inline-flex items-center gap-1">
            {index > 0 ? <span className="text-gray-500">,</span> : null}
            <Link
              href={localizeHref(target.href, serviceLocale)}
              className="text-yellow-200 transition-colors hover:text-yellow-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300/50"
            >
              {target.title}
            </Link>
          </span>
        ))}
      </div>
      {children}
    </section>
  );
}
