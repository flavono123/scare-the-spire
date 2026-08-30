import { DEFRAGMENT_FEDERATED_SERVICES } from "@/lib/defragment";
import { generateLocaleStaticParams } from "@/lib/locale-routing";

export const STATIC_DETAIL_SHELL_SEGMENT = "__id__";

export function isStaticDetailShellSegment(value: string | undefined): boolean {
  return value === STATIC_DETAIL_SHELL_SEGMENT;
}

/** Skip baked placeholder IDs so shell metadata stays generic. */
export function metadataRecordId(id: string | undefined): string | undefined {
  if (!id || isStaticDetailShellSegment(id)) return undefined;
  return id;
}

export function generateStaticDetailShellParams() {
  return [{ id: STATIC_DETAIL_SHELL_SEGMENT }];
}

export function generateStaticHistoryCourseShellParams() {
  return [{ runId: STATIC_DETAIL_SHELL_SEGMENT }];
}

export function generateLocalizedStaticDetailShellParams() {
  return generateLocaleStaticParams().map(({ gameLocale }) => ({
    gameLocale,
    id: STATIC_DETAIL_SHELL_SEGMENT,
  }));
}

export function generateLocalizedHistoryCourseShellParams() {
  return generateLocaleStaticParams().map(({ gameLocale }) => ({
    gameLocale,
    runId: STATIC_DETAIL_SHELL_SEGMENT,
  }));
}

export function generateStaticDefragmentFederatedShellParams() {
  return DEFRAGMENT_FEDERATED_SERVICES.map((id) => ({
    id,
    postId: STATIC_DETAIL_SHELL_SEGMENT,
  }));
}

export function generateLocalizedDefragmentFederatedShellParams() {
  return generateLocaleStaticParams().flatMap(({ gameLocale }) =>
    DEFRAGMENT_FEDERATED_SERVICES.map((id) => ({
      gameLocale,
      id,
      postId: STATIC_DETAIL_SHELL_SEGMENT,
    })),
  );
}
