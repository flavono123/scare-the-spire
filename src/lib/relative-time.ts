export type RelativeTimeCopy = Record<
  "justNow" | "minutesAgo" | "hoursAgo" | "daysAgo",
  string
>;

export function formatRelativeTime(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

export function formatTimeAgo(
  dateString: string,
  copy: RelativeTimeCopy,
  dateLocale: string,
  now = Date.now(),
): string {
  const minutes = Math.floor((now - new Date(dateString).getTime()) / 60_000);
  if (minutes < 1) return copy.justNow;
  if (minutes < 60) return formatRelativeTime(copy.minutesAgo, minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatRelativeTime(copy.hoursAgo, hours);
  const days = Math.floor(hours / 24);
  if (days < 30) return formatRelativeTime(copy.daysAgo, days);
  return new Date(dateString).toLocaleDateString(dateLocale);
}
