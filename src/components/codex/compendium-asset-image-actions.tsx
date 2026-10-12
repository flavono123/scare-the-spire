"use client";

import type { RefObject } from "react";
import { TransfigureImageCopyButton } from "@/components/transfigure/transfigure-image-copy-button";
import { getCodexServiceMessages } from "@/lib/codex-service";
import type { ServiceLocale } from "@/lib/i18n";

/**
 * Service action for copying the detail preview. It sits in its own row under
 * the captured asset, apart from view controls such as upgrade, beta art, or wax.
 * The row has no chrome of its own; the Transfigure text buttons are the control.
 */
export function CompendiumAssetImageActions({
  serviceLocale,
  fileName,
  targetRef,
}: {
  serviceLocale: ServiceLocale;
  fileName: string;
  targetRef: RefObject<HTMLElement | null>;
}) {
  const copy = getCodexServiceMessages(serviceLocale).common;
  return (
    <div
      className="flex w-full max-w-md shrink-0 justify-center"
      data-compendium-asset-image-actions
    >
      <TransfigureImageCopyButton
        fileName={fileName}
        targetRef={targetRef}
        labels={{
          copy: copy.copyAssetImage,
          copying: copy.copyingAssetImage,
          copied: copy.copiedAssetImage,
          copyFailed: copy.assetImageCopyFailed,
          copyUnsupported: copy.assetImageCopyUnsupported,
          download: copy.downloadAssetImage,
          downloading: copy.downloadingAssetImage,
          downloaded: copy.downloadedAssetImage,
          downloadFailed: copy.assetImageDownloadFailed,
        }}
      />
    </div>
  );
}
