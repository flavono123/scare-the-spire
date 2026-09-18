import { redirect } from "next/navigation";

export default function PatchTypesDevRedirect() {
  redirect("/dev/patches");
}
