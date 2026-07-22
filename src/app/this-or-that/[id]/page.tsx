import type { Metadata } from "next";
import {
  generateThisOrThatPostMetadata,
  renderThisOrThatPostPage,
} from "./page-content";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return generateThisOrThatPostMetadata(id);
}

export default async function ThisOrThatPostPage({ params }: Props) {
  const { id } = await params;
  return renderThisOrThatPostPage(id);
}
