import Image from "@/components/ui/static-image";

export function ContentLoadingNotice({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <Image
        src="/images/sts2/powers/knockdown_power.webp"
        alt={label}
        width={48}
        height={48}
        className="object-contain animate-pulse"
      />
      <span className="text-sm text-gray-500">{label}</span>
    </div>
  );
}
