// Season week 1 starts Wednesday 19 Aug 2026 at 05:00 server time (Europe/Paris).
const SEASON_START_PARIS = Date.UTC(2026, 7, 19, 5, 0, 0);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** "Now" as Paris wall-clock time, so summer/winter time doesn't shift the reset. */
function parisNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value || 0);

  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
}

/** Current raid week, rolling over every Wednesday 05:00 ST. */
export function getCurrentWeek() {
  const diff = parisNow() - SEASON_START_PARIS;
  if (diff < 0) return 1;
  return Math.floor(diff / WEEK_MS) + 1;
}