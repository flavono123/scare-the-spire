import type { Metadata } from "next";
import {
  generateNeowsletterStaticParams,
  getNeowsletterDetailMetadata,
  NeowsletterDetailPage,
} from "@/components/patches/neowsletter-detail-page";
import {
  generateLocaleStaticParams,
  getLocalePairFromParams,
  type LocaleRouteParams,
} from "@/lib/locale-routing";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const issues = await generateNeowsletterStaticParams();
  return generateLocaleStaticParams().flatMap(({ gameLocale }) =>
    issues.map(({ issue }) => ({ gameLocale, issue })),
  );
}

type Props = {
  params: Promise<LocaleRouteParams<{ issue: string }>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { issue, serviceLocale } = await getLocalePairFromParams(params);
  return getNeowsletterDetailMetadata({ issueId: issue, serviceLocale });
}

export default async function LocalizedNeowsletterDetailPage({ params }: Props) {
  const { issue, serviceLocale, gameLocale } = await getLocalePairFromParams(params);
  return (
    <NeowsletterDetailPage
      issueId={issue}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
    />
  );
}
