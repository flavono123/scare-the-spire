import {
  getPageOgStatus,
  pageOgStatusLabel,
} from "../src/lib/page-og-status";

const showAllPages = process.argv.includes("--all");

async function main() {
  const status = await getPageOgStatus();

  console.log("OG image status");
  console.log(`Default: ${status.defaultImage.url} (${pageOgStatusLabel(status.defaultExists)})`);
  console.log("");
  console.log("Rules:");
  for (const { rule, exists } of status.rules) {
    console.log(`- ${rule.pattern} -> ${rule.image.url} (${rule.label}, ${pageOgStatusLabel(exists)})`);
  }
  console.log("");
  console.log(`Pages: ${status.rows.length} total, ${status.mappedRows.length} mapped, ${status.defaultRows.length} default`);

  if (status.mappedRows.length > 0) {
    console.log("");
    console.log("Mapped pages:");
    for (const row of status.mappedRows) {
      console.log(`- ${row.route} -> ${row.image.url} (${row.rule!.label}, ${pageOgStatusLabel(row.exists)})`);
    }
  }

  if (showAllPages && status.defaultRows.length > 0) {
    console.log("");
    console.log("Default pages:");
    for (const row of status.defaultRows) {
      console.log(`- ${row.route} -> ${row.image.url} (${pageOgStatusLabel(row.exists)})`);
    }
  } else if (status.defaultRows.length > 0) {
    console.log("");
    console.log("Default pages hidden. Run `pnpm og:status -- --all` to list them.");
  }

  if (status.missingCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
