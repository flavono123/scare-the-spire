import type { Metadata } from "next";
import {
  generateDecisionsDecisionsPostMetadata,
  renderDecisionsDecisionsPostPage,
} from "./page-content";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return generateDecisionsDecisionsPostMetadata(id);
}

export default async function DecisionsDecisionsPostPage({ params }: Props) {
  const { id } = await params;
  return renderDecisionsDecisionsPostPage(id);
}
