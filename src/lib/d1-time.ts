/**
 * Timestamps of the D1 copy (docs/supabase-exit/D1_SCHEMA_DESIGN.md 3.3). No imports: the Worker,
 * the sync, the first copy and the daily check share this file.
 *
 * Stored form: 'YYYY-MM-DDTHH:MM:SS.ffffffZ' (UTC, exactly 6 fraction digits, 27 characters), so
 * BINARY text order is time order. Conversions never go through Date, which would drop microseconds.
 */

const INPUT =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2}(?::?\d{2})?)?)$/;
const CANONICAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{6})Z$/;

const SECONDS_PER_DAY = 86_400;

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

// Days since 1970-01-01 of a proleptic Gregorian date (H. Hinnant's days_from_civil).
function daysFromCivil(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
}

function civilFromDays(days: number): [number, number, number] {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return [year, month, day];
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function offsetSeconds(offset: string): number | null {
  if (offset === "Z") return 0;
  const sign = offset[0] === "-" ? -1 : 1;
  const digits = offset.slice(1).replace(/:/g, "");
  if (digits.length !== 2 && digits.length !== 4 && digits.length !== 6) return null;
  const hours = Number(digits.slice(0, 2));
  const minutes = digits.length >= 4 ? Number(digits.slice(2, 4)) : 0;
  const seconds = digits.length === 6 ? Number(digits.slice(4, 6)) : 0;
  if (hours > 15 || minutes > 59 || seconds > 59) return null;
  return sign * (hours * 3600 + minutes * 60 + seconds);
}

/**
 * Any timestamp the Worker accepts today ('T' or a space, 0-6 fraction digits, 'Z', '+00', '+00:00'
 * or another offset) and the pg_dump text form, in the stored form. null for 'infinity', a year
 * outside 0001-9999 (before or after the offset shift), an impossible date or time, or any other
 * shape. Strict on purpose: null is a reject, never a guess.
 */
export function canonicalTs(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const match = INPUT.exec(text);
  if (!match) return null;
  const [, ys, mos, ds, hs, mis, ss, fraction = "", offset] = match;
  const year = Number(ys);
  const month = Number(mos);
  const day = Number(ds);
  const hour = Number(hs);
  const minute = Number(mis);
  const second = Number(ss);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const shift = offsetSeconds(offset);
  if (shift === null) return null;
  const total = daysFromCivil(year, month, day) * SECONDS_PER_DAY + hour * 3600 + minute * 60 + second - shift;
  const days = Math.floor(total / SECONDS_PER_DAY);
  const rest = total - days * SECONDS_PER_DAY;
  const [uy, um, ud] = civilFromDays(days);
  if (uy < 1 || uy > 9999) return null;
  const uh = Math.floor(rest / 3600);
  const umi = Math.floor((rest % 3600) / 60);
  const us = rest % 60;
  return `${pad(uy, 4)}-${pad(um, 2)}-${pad(ud, 2)}T${pad(uh, 2)}:${pad(umi, 2)}:${pad(us, 2)}.${fraction.padEnd(6, "0")}Z`;
}

/**
 * Stored form -> the PostgREST string of the same instant: trailing fraction zeros dropped (and the
 * '.' when nothing is left), 'Z' -> '+00:00'. null when the input is not in the stored form.
 */
export function postgrestTs(canonical: unknown): string | null {
  if (typeof canonical !== "string" || !CANONICAL.test(canonical)) return null;
  const fraction = canonical.slice(20, 26).replace(/0+$/, "");
  return `${canonical.slice(0, 19)}${fraction ? `.${fraction}` : ""}+00:00`;
}

/** The current time in the stored form (millisecond precision, as the Worker writes). */
export function nowTs(): string {
  const iso = new Date().toISOString();
  return `${iso.slice(0, -1)}000Z`;
}
