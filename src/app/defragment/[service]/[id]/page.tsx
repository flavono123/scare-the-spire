import type { Metadata } from "next";
import {
  generateDefragmentFederatedPostMetadata,
  renderDefragmentFederatedPostPage,
} from "./page-content";

type Props = {
  params: Promise<{ service: string; id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { service, id } = await params;
  return generateDefragmentFederatedPostMetadata(service, id);
}

export default async function DefragmentFederatedPostPage({ params }: Props) {
  const { service, id } = await params;
  return renderDefragmentFederatedPostPage(service, id);
}
