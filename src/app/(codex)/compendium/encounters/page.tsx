import { redirect } from "next/navigation";

export default function CompendiumEncountersRedirect() {
  redirect("/compendium/bestiary?view=encounters");
}
