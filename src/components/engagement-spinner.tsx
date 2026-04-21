import Image from "@/components/ui/static-image";

export function EngagementSpinner({ size = 16 }: { size?: number }) {
  return (
    <Image
      src="/images/sts2/icons/star_icon.webp"
      alt=""
      width={size}
      height={size}
      className="animate-[spin_2s_linear_infinite]"
    />
  );
}
