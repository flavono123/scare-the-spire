import type { Metadata } from "next";
import {
  generateDefragmentPostMetadata,
  renderDefragmentPostPage,
} from "./page-content";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return generateDefragmentPostMetadata(id);
}

export default async function DefragmentPostPage({ params }: Props) {
  const { id } = await params;
  return renderDefragmentPostPage(id);
}
