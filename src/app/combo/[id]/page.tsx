import type { Metadata } from "next";
import {
  generateComboPostMetadata,
  renderComboPostPage,
} from "./page-content";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return generateComboPostMetadata(id);
}

export default async function ComboPostPage({ params }: Props) {
  const { id } = await params;
  return renderComboPostPage(id);
}
