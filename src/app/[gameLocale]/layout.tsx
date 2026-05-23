import { generateLocaleStaticParams } from "@/lib/locale-routing";

export const dynamicParams = false;

export const generateStaticParams = generateLocaleStaticParams;

export default function GameLocaleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
