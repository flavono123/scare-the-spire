import { permanentRedirect } from "next/navigation";
import { FAVORITE_TOURNAMENT_HREF } from "@/lib/favorite-tournament";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LegacyFavoriteTournamentPostPage({ params }: Props) {
  const { id } = await params;
  permanentRedirect(`${FAVORITE_TOURNAMENT_HREF}/${id}`);
}
