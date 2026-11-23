"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "@/components/ui/static-image";
import { useLocalizedHref } from "@/hooks/use-localized-href";
import { fuzzyMatchCodexText } from "@/lib/codex-search";
import type { ServiceLocale } from "@/lib/i18n";
import type { Sts1Intent } from "@/lib/sts1/intents";
import { sts1DetailPath, sts1IndexPath, sts1IntentImageUrl } from "@/lib/sts1/paths";
import type { Sts1UiLabels } from "@/lib/sts1/types";
import { Sts1DetailShell, Sts1EnglishName } from "./detail-chrome";
import { Sts1EventText } from "./event-text";
import { Sts1DetailModal, Sts1ListLayout, useSts1Selection } from "./list-shell";
import { Sts1TipBox } from "./tip-box";

function IntentTip({ intent }: { intent: Sts1Intent }) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-2">
      <Image src={sts1IntentImageUrl(intent.image)} alt="" width={64} height={64} className="h-16 w-16 object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]" />
      <Sts1TipBox title={intent.name} className="min-w-0">
        <Sts1EventText text={intent.description} />
      </Sts1TipBox>
    </div>
  );
}

function IntentDetail({ intent, labels, serviceLocale, onClose }: { intent: Sts1Intent; labels: Sts1UiLabels; serviceLocale: ServiceLocale; onClose: () => void }) {
  const localizeLink = useLocalizedHref();
  const ko = serviceLocale === "ko";
  return (
    <Sts1DetailShell
      backHref={`${sts1IndexPath("monsters")}?view=intents`}
      backLabel={labels.monstersTitle}
      onClose={onClose}
      serviceLocale={serviceLocale}
      heroLayout="icon"
      hero={<div className="w-full max-w-[26rem]"><IntentTip intent={intent} /></div>}
    >
      <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
        <Sts1EnglishName name={intent.name} nameEn={intent.nameEn} serviceLocale={serviceLocale} />
        <p className="mt-2 font-game-text text-xs text-gray-500">{intent.id}</p>
      </section>
      {intent.users.length ? (
        <section className="rounded-lg border border-border bg-compendium-rail px-4 py-3">
          <h2 className="mb-2 font-game-title text-sm font-bold text-foreground">
            {ko ? `이 의도를 쓰는 몬스터 ${intent.users.length}` : `Monsters with this intent (${intent.users.length})`}
          </h2>
          <ul className="flex flex-col gap-1">
            {intent.users.map((user) => (
              <li key={user.slug}>
                <Link
                  prefetch={false}
                  href={localizeLink(sts1DetailPath("monsters", user.slug))}
                  className="block rounded px-1.5 py-1 transition-colors hover:bg-white/5"
                >
                  <span className="block truncate font-game-title text-sm text-primary">{user.name}</span>
                  <span className="block truncate font-game-text text-xs text-gray-400">{user.moves.join(", ")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Sts1DetailShell>
  );
}

/** AbstractMonster's intents: each icon beside the PowerTip it shows over a monster. */
export function Sts1IntentLibrary({
  intents,
  labels,
  serviceLocale,
  trailing,
}: {
  intents: Sts1Intent[];
  labels: Sts1UiLabels;
  serviceLocale: ServiceLocale;
  trailing?: ReactNode;
}) {
  const rows = useMemo(() => intents.map((intent) => ({ ...intent, legacySlugs: [] as string[] })), [intents]);
  const { selected, open, close } = useSts1Selection(rows, "intent");
  const [searchQuery, setSearchQuery] = useState("");
  const filtered = useMemo(() => {
    const query = searchQuery.trim();
    return rows.filter((intent) => !query || fuzzyMatchCodexText(`${intent.id} ${intent.name} ${intent.nameEn} ${intent.description}`, query));
  }, [rows, searchQuery]);
  return (
    <Sts1ListLayout
      title={labels.monstersTitle}
      count={filtered.length}
      serviceLocale={serviceLocale}
      searchQuery={searchQuery}
      onSearch={setSearchQuery}
      trailing={trailing}
      overlay={selected ? (
        <Sts1DetailModal label={selected.name} onClose={close}>
          <IntentDetail intent={selected} labels={labels} serviceLocale={serviceLocale} onClose={close} />
        </Sts1DetailModal>
      ) : null}
    >
      <div className="columns-1 gap-5 xl:columns-2">
        {filtered.map((intent) => (
          <button
            key={intent.id}
            type="button"
            onClick={() => open(intent)}
            className="mb-5 block w-full break-inside-avoid rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            data-sts1-intent={intent.id}
          >
            <IntentTip intent={intent} />
          </button>
        ))}
      </div>
    </Sts1ListLayout>
  );
}
