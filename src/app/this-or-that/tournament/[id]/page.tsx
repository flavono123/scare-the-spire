import type { Metadata } from "next";
import {
  generateFavoriteTournamentPostMetadata,
  renderFavoriteTournamentPostPage,
} from "./page-content";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return generateFavoriteTournamentPostMetadata(id);
}

export default async function FavoriteTournamentPostPage({ params }: Props) {
  const { id } = await params;
  return renderFavoriteTournamentPostPage(id);
}
