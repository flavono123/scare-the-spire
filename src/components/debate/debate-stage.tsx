"use client";

import Image from "@/components/ui/static-image";
import Link from "next/link";
import { ContentLoadingNotice } from "@/components/content-loading-notice";
import { StorageUnavailableNotice } from "@/components/storage-unavailable-notice";
import { useOpenDebateCycle } from "@/hooks/use-open-debate-cycle";
import { DEBATE_TOKEN_SRC } from "@/lib/debate";

export function DebateStage({
  emptyLabel,
  loadingLabel,
  unavailableTitle,
}: {
  emptyLabel: string;
  loadingLabel: string;
  unavailableTitle: string;
}) {
  const { subject, loading, unavailable, missing } = useOpenDebateCycle();

  if (loading) {
    return (
      <section data-debate-stage="">
        <ContentLoadingNotice label={loadingLabel} />
      </section>
    );
  }

  if (unavailable) {
    return (
      <section data-debate-stage="">
        <StorageUnavailableNotice title={unavailableTitle} />
      </section>
    );
  }

  if (!subject || missing) {
    return (
      <section
        className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-black/35 px-4 py-10 text-center"
        data-debate-stage=""
      >
        <Image
          src={DEBATE_TOKEN_SRC}
          alt=""
          width={72}
          height={72}
          className="object-contain"
        />
        <p className="font-service text-sm text-zinc-300">{emptyLabel}</p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-white/10 bg-black/35 px-4 py-6"
      data-debate-stage=""
      data-debate-subject={subject.resourceId}
    >
      <Link href={subject.href} className="flex items-center gap-4">
        <Image
          src={subject.imageUrl ?? DEBATE_TOKEN_SRC}
          alt=""
          width={72}
          height={72}
          className="object-contain"
        />
        <span className="min-w-0">
          <span className="block truncate font-service text-lg font-semibold text-primary">
            {subject.nameKo}
          </span>
          <span className="block truncate text-sm text-zinc-400">{subject.nameEn}</span>
          <span className="mt-1 block font-service text-xs text-zinc-500">{`v${subject.gameVersion}`}</span>
        </span>
      </Link>
    </section>
  );
}
