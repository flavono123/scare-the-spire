import type { Metadata } from "next";
import { NotFoundPage } from "@/components/not-found-page";
import { serviceMessages } from "@/messages/service";

export const metadata: Metadata = {
  title: serviceMessages.ko.notFound.title,
};

export default function NotFound() {
  return <NotFoundPage />;
}
