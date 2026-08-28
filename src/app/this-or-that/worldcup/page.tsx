import type { Metadata } from "next";
import {
  generateFavoriteTournamentMetadata,
  renderFavoriteTournamentPage,
} from "./page-content";

export async function generateMetadata(): Promise<Metadata> {
  return generateFavoriteTournamentMetadata();
}

export default async function FavoriteTournamentPage() {
  return renderFavoriteTournamentPage();
}
