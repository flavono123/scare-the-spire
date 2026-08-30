import type { Metadata } from "next";
import {
  generateDefragmentFederatedPostMetadata,
  renderDefragmentFederatedPostPage,
} from "./page-content";
import { generateStaticDefragmentFederatedShellParams } from "@/lib/static-detail-shell";

export const dynamic = "force-static";
export const generateStaticParams = generateStaticDefragmentFederatedShellParams;

type Props = {
  params: Promise<{ id: string; postId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: service, postId } = await params;
  return generateDefragmentFederatedPostMetadata(service, postId);
}

export default async function DefragmentFederatedPostPage({ params }: Props) {
  const { id: service } = await params;
  return renderDefragmentFederatedPostPage(service);
}
