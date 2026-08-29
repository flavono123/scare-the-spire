import { permanentRedirect } from "next/navigation";
import { FAVORITE_TOURNAMENT_HREF } from "@/lib/favorite-tournament";

export default function LegacyFavoriteTournamentPage() {
  permanentRedirect(FAVORITE_TOURNAMENT_HREF);
}
