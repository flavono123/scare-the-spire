import { notFound } from "next/navigation";

export const metadata = {
  title: "이벤트 — DEV",
  description: "DEV — STS2 이벤트 데이터/이미지 미리보기",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EventsDevPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { default: EventsDevDashboard } = await import("./events-dev-page");
  return <EventsDevDashboard />;
}
