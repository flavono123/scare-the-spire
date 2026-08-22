import Image from "@/components/ui/static-image";
import { cn } from "@/lib/utils";

interface ServiceBackgroundProps {
  src: string;
  imageClassName?: string;
}

export function ServiceBackground({
  src,
  imageClassName,
}: ServiceBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 top-12 -z-10 overflow-hidden bg-background"
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="100vw"
        className={cn(
          "object-cover opacity-30 saturate-[0.72] contrast-90 light:opacity-[0.16] light:saturate-[0.55] light:contrast-75",
          imageClassName,
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/55 to-background/90" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/75 via-transparent to-background/75" />
    </div>
  );
}
