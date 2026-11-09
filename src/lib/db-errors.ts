/**
 * A row the database refused (Postgres check_violation, 23514), which is not a
 * sign that it is down.
 *
 * An api write error carries the same code only because toyboxWriteError
 * (src/lib/toybox-api.ts POSTGREST_CODES) maps the Worker's `check_violation`
 * to 23514. Keep that mapping as it is, or this stops matching api errors.
 */
export function isCheckViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "23514";
}
