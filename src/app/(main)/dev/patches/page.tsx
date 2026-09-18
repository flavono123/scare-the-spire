import { redirect } from "next/navigation";

export default function DevPatchesRedirect() {
  redirect("/dev/patch-types");
}
