import Image from "@/components/ui/static-image";
import { ToyBoxIndexHeading } from "@/components/toybox-index-heading";
import { DEBATE_TOKEN_SRC } from "@/lib/debate";

export function DebateView({
  title,
  subtitle,
  hero,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  hero: string;
  emptyLabel: string;
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
    </div>
  );
}
