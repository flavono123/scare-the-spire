// Stage 1: writes the src/generated JSON that stage 2 (generate-static-api-data.ts)
// and the app import. Run it before anything that loads those modules.
import { writeSourceJsonFiles } from "./lib/source-json-payloads";

writeSourceJsonFiles().catch((error) => {
  console.error(error);
  process.exit(1);
});
