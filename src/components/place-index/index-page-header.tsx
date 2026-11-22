import { ServiceBackground } from "@/components/service-background";
import Image from "@/components/ui/static-image";

/** The area token and its gold title, over the area art like a Toy Box service. */
export function IndexPageHeader({
  title,
  token,
  art,
}: {
  title: string;
  token: string;
  art: string;
}) {
  return (
    <>
      <ServiceBackground src={art} />
      <header className="flex items-center gap-3">
        <Image src={token} alt="" width={56} height={56} className="h-12 w-12 shrink-0 object-contain drop-shadow sm:h-14 sm:w-14" />
        <h1 className="font-game-title text-2xl text-primary sm:text-3xl">{title}</h1>
      </header>
    </>
  );
}
