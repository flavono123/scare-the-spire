import type { Metadata } from "next";
import {
  generateTransfigurePostMetadata,
  renderTransfigurePostPage,
} from "./page-content";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return generateTransfigurePostMetadata(id);
}

export default async function TransfigurePostPage({ params }: Props) {
  const { id } = await params;
  return renderTransfigurePostPage(id);
}
