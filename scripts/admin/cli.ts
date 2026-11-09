/** Argument handling shared by the scripts/admin CLIs. */
import type { D1Mode } from "../lib/d1-remote";
import { AdminInputError, AdminWriteError, WritesPausedError } from "./admin-writes";

export function cliArgs(): string[] {
  const argv = process.argv.slice(2);
  // `pnpm run x -- --flag` passes the separator through.
  if (argv[0] === "--") argv.shift();
  return argv;
}

export function option(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index >= 0) return argv[index + 1];
  const inline = argv.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : undefined;
}

export function flag(argv: readonly string[], name: string): boolean {
  return argv.includes(name);
}

/** --remote (default) or --local, never both. */
export function d1Mode(argv: readonly string[], usage: (message: string) => never): D1Mode {
  const remote = flag(argv, "--remote");
  const local = flag(argv, "--local");
  if (remote && local) usage("name one target: --remote (Cloudflare, the default) or --local (wrangler dev)");
  return local ? "local" : "remote";
}

/** Runs a CLI main: exit 1 for a refused or failed write, 2 for bad input. */
export function runCli(main: () => Promise<void>): void {
  main().catch((error: unknown) => {
    if (error instanceof AdminInputError) {
      console.error(`invalid: ${error.message}`);
      process.exit(2);
    }
    if (error instanceof WritesPausedError || error instanceof AdminWriteError) {
      console.error(`refused: ${error.message}`);
      process.exit(1);
    }
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
