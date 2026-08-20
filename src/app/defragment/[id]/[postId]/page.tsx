import type { Metadata } from "next";
import {
  generateDefragmentFederatedPostMetadata,
  renderDefragmentFederatedPostPage,
} from "./page-content";

type Props = {
  params: Promise<{ id: string; postId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: service, postId } = await params;
  return generateDefragmentFederatedPostMetadata(service, postId);
}

export default async function DefragmentFederatedPostPage({ params }: Props) {
  const { id: service, postId } = await params;
  return renderDefragmentFederatedPostPage(service, postId);
}
