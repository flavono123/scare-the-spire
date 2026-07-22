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
      className="pointer-events-none fixed inset-x-0 bottom-0 top-12 -z-10 overflow-hidden bg-[#07070d]"
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="100vw"
        className={cn(
          "object-cover opacity-30 saturate-[0.72] contrast-90",
          imageClassName,
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#080810]/40 via-[#080810]/55 to-[#080810]/90" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#080810]/75 via-transparent to-[#080810]/75" />
    </div>
  );
}
