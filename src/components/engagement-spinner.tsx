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

export function EngagementUnavailableIcon({ size = 16 }: { size?: number }) {
  return (
    <Image
      src="/images/sts2/powers/battleworn_dummy_time_limit_power.webp"
      alt=""
      width={size}
      height={size}
      title="데이터베이스가 응답하지 않습니다"
      className="object-contain opacity-70"
    />
  );
}
