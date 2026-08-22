import { COLOR_SCHEME_BOOT_SCRIPT } from "@/lib/color-scheme";

/** Blocking boot script. Must render in the root layout `<head>` before paint. */
export function ColorSchemeScript() {
  return (
    <script
      id="sts-color-scheme-boot"
      dangerouslySetInnerHTML={{ __html: COLOR_SCHEME_BOOT_SCRIPT }}
    />
  );
}
