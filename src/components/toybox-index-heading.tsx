import { RichText } from "@/components/rich-text";

export function ToyBoxIndexHeading({
  subtitle,
  hero,
  heroRich = false,
}: {
  subtitle: string;
  hero?: string;
  heroRich?: boolean;
}) {
  return (
    <div className="space-y-1">
      <h2 className="font-service text-sm font-medium text-zinc-300">
        {subtitle}
      </h2>
      {hero ? (
        heroRich ? (
          <div className="line-clamp-2 max-w-xl font-game-text text-sm leading-relaxed text-zinc-400">
            <RichText text={hero} />
          </div>
        ) : (
          <p className="line-clamp-2 max-w-2xl font-game-text text-sm leading-6 text-zinc-400">
            {hero}
          </p>
        )
      ) : null}
    </div>
  );
}
