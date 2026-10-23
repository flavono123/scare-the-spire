import Image from "@/components/ui/static-image";
import { RichText } from "@/components/rich-text";
import type {
  CompendiumStaticDetailModel,
  StaticDetailLink,
} from "@/lib/compendium-static-detail";

// Server-rendered Compendium detail: the text and links crawlers read without
// running JavaScript. Plain anchors keep the RSC payload small.

function StaticLink({ link }: { link: StaticDetailLink }) {
  return (
    <a
      href={link.href}
      className="font-game-title font-semibold spire-gold underline decoration-primary/30 underline-offset-2 transition-colors hover:text-primary"
    >
      {link.label}
    </a>
  );
}

export function CompendiumStaticDetail({ model }: { model: CompendiumStaticDetailModel }) {
  return (
    <main className="min-h-screen bg-background text-foreground" data-compendium-static-detail="">
      <article className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-6">
        <a
          href={model.back.href}
          className="w-fit text-sm text-gray-400 transition-colors hover:text-gray-200"
        >
          ← {model.back.label}
        </a>

        <header className="flex items-center gap-4">
          {model.imageUrl && (
            <Image
              src={model.imageUrl}
              alt={model.title}
              width={96}
              height={96}
              loading="eager"
              className="max-h-24 max-w-24 shrink-0 object-contain drop-shadow-lg"
            />
          )}
          <div className="min-w-0">
            <p className="font-service text-xs text-gray-500">{model.kindLabel}</p>
            <h1 className="font-game-title text-3xl font-bold text-gray-100 sm:text-4xl">
              {model.title}
            </h1>
            {model.altTitle && (
              <p className="font-game-text text-sm text-gray-400">{model.altTitle}</p>
            )}
          </div>
        </header>

        {model.facts.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-border bg-compendium-rail p-4 sm:grid-cols-4">
            {model.facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="font-service text-xs text-gray-500">{fact.label}</dt>
                <dd className="font-game-text text-sm text-gray-200">
                  {fact.href ? <StaticLink link={{ href: fact.href, label: fact.value }} /> : fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {model.texts.map((block) => (
          <section key={block.heading} className="flex flex-col gap-1.5">
            <h2 className="font-game-title text-base font-bold text-foreground">{block.heading}</h2>
            <p className="font-game-text text-sm leading-relaxed text-gray-300 sm:text-base">
              <RichText text={block.text} />
            </p>
          </section>
        ))}

        {model.linkGroups.length > 0 && (
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-compendium-rail p-4">
            <h2 className="font-game-title text-base font-bold text-foreground">{model.labels.related}</h2>
            {model.linkGroups.map((group) => (
              <nav key={group.heading} aria-label={group.heading} className="flex flex-col gap-1">
                <h3 className="font-service text-xs text-gray-500">{group.heading}</h3>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <StaticLink link={link} />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="font-game-title text-base font-bold text-foreground">{model.labels.history}</h2>
          {model.history.length > 0 ? (
            <ul className="space-y-1">
              {model.history.map((line) => (
                <li
                  key={line.id}
                  className="ml-4 list-outside list-disc whitespace-pre-line py-1 font-game-text text-sm leading-relaxed text-gray-300"
                >
                  {line.segments.map((segment, index) => (
                    typeof segment === "string"
                      ? <span key={index}>{segment}</span>
                      : <StaticLink key={index} link={segment} />
                  ))}
                  {" "}
                  <a
                    href={line.href}
                    className="whitespace-nowrap spire-gold transition-colors hover:text-primary"
                  >
                    {line.date} {line.versionLabel}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-game-text text-sm text-gray-500">{model.labels.noHistory}</p>
          )}
        </section>
      </article>
    </main>
  );
}
