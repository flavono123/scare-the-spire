import type { Metadata } from "next";
import { loadAllEntities } from "@/lib/load-all-entities";
import { ChemicalXPostView } from "@/components/chemicalx/post-view";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { CHEMICAL_X_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  getServiceMetadataCopy,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import { supabase, supabaseEnabled, supabaseEnv } from "@/lib/supabase";
import { withSupabaseTimeout } from "@/lib/supabase-timeout";
import { blocksToPlainText } from "@/lib/chemical-utils";
import type { ChemicalPost, PostBlock } from "@/lib/chemical-types";

function isPostBlockArray(value: unknown): value is PostBlock[] {
  return Array.isArray(value)
    && value.every((block) =>
      block
      && typeof block === "object"
      && "type" in block,
    );
}

function normalizeOgDescription(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function getChemicalXPostOgDescription(id: string): Promise<string | null> {
  if (!supabaseEnabled) return null;

  const result = await withSupabaseTimeout(
    "chemical_posts.metadata",
    supabase
      .from("chemical_posts")
      .select("content, content_text")
      .eq("id", id)
      .eq("env", supabaseEnv)
      .single(),
  ).catch(() => null);

  if (!result?.data) return null;

  const post = result.data as Pick<ChemicalPost, "content" | "content_text">;
  const richText = isPostBlockArray(post.content)
    ? blocksToPlainText(post.content)
    : "";
  const fallbackText = typeof post.content_text === "string" ? post.content_text : "";
  return normalizeOgDescription(richText || fallbackText) || null;
}

export async function generateChemicalXPostMetadata(
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = getServiceMetadataCopy(serviceLocale);
  const description = id
    ? await getChemicalXPostOgDescription(id) ?? copy.chemicalXDescription
    : copy.chemicalXDescription;

  return getServiceOgMetadata({
    serviceLocale,
    title: copy.chemicalXTitle,
    description,
    image: CHEMICAL_X_PAGE_OG_IMAGE,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return generateChemicalXPostMetadata(id);
}

export async function renderChemicalXPostPage(
  id: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const entities = await loadAllEntities({ gameLocale });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <ChemicalXPostView postId={id} entities={entities} />
    </div>
  );
}

export default async function ChemicalXPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return renderChemicalXPostPage(id);
}
