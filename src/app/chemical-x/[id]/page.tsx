import type { Metadata } from "next";
import {
  generateChemicalXPostMetadata,
  renderChemicalXPostPage,
} from "./page-content";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return generateChemicalXPostMetadata(id);
}

export default async function ChemicalXPostPage({ params }: Props) {
  const { id } = await params;
  return renderChemicalXPostPage(id);
}
