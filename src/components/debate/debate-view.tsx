import Image from "@/components/ui/static-image";
import { DebateStage } from "@/components/debate/debate-stage";
import { ToyBoxIndexHeading } from "@/components/toybox-index-heading";
import { DEBATE_TOKEN_SRC } from "@/lib/debate";

export function DebateView({
  title,
  subtitle,
  hero,
  emptyLabel,
  loadingLabel,
  unavailableTitle,
}: {
  title: string;
  subtitle: string;
  hero: string;
  emptyLabel: string;
  loadingLabel: string;
  unavailableTitle: string;
}) {
  return (
    <div className="space-y-6" data-debate-view="">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Image
            src={DEBATE_TOKEN_SRC}
            alt={title}
            width={32}
            height={32}
            className="object-contain"
          />
          <h1 className="font-service text-xl font-bold text-primary">{title}</h1>
        </div>
        <ToyBoxIndexHeading subtitle={subtitle} hero={hero} />
      </header>
      <DebateStage
        emptyLabel={emptyLabel}
        loadingLabel={loadingLabel}
        unavailableTitle={unavailableTitle}
      />
    </div>
  );
}
