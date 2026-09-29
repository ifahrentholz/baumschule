/**
 * The Opening hours singleton: season profiles and exceptions edited in
 * Sveltia CMS (`/admin`) and stored in `src/content/opening-hours.json`.
 * Rendered by `src/components/OpeningHours.astro` wherever hours appear.
 *
 * A season profile applies to the months it lists; its hours are time
 * windows per weekday, and a weekday without a window is closed. An
 * exception covers one date or a date range and replaces the season
 * profile on those dates, with its own window or closed.
 *
 * All times are Berlin wall-clock times. `berlinClock` turns an instant into
 * that wall-clock time through the IANA zone, so the status is the same for
 * a visitor in any time zone and follows the daylight-saving switches.
 *
 * `parseOpeningHours` rejects anything it cannot interpret (bad times,
 * overlapping seasons, ...), so a broken season profile fails the build
 * instead of reaching the deployed site. The CMS writes empty optional
 * fields as empty strings; those count as missing.
 *
 * In the CMS, an exception is one of two variant types, "closed" or "open
 * with hours" (`src/cms-config.ts`), so the editor picks one and only the
 * fields for that choice are shown - there is no way to save an "open"
 * exception with empty times. If an exception still turns out to be invalid
 * (hand-edited JSON, data from before this change), `parseOpeningHours`
 * does not fail the whole build over it: it skips that one exception with a
 * `console.warn` and keeps the rest.
 */

export const WEEKDAYS = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/** German short names, as used on the site. */
export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Mo",
  tue: "Di",
  wed: "Mi",
  thu: "Do",
  fri: "Fr",
  sat: "Sa",
  sun: "So",
};

export const MONTH_LABELS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

/** A time window, as `HH:MM` wall-clock times; `closes` is exclusive. */
export interface TimeWindow {
  opens: string;
  closes: string;
}

export interface SeasonHours extends TimeWindow {
  days: Weekday[];
}

export interface Season {
  name: string;
  /** Months of the year, 1–12. */
  months: number[];
  hours: SeasonHours[];
}

export interface Exception {
  /** First date, `YYYY-MM-DD`. */
  from: string;
  /** Last date, `YYYY-MM-DD`; equals `from` for a single day. */
  until: string;
  /** Empty when closed. */
  windows: TimeWindow[];
  note?: string;
}

export interface OpeningHours {
  seasons: Season[];
  exceptions: Exception[];
}

export interface DayHours {
  /** Sorted by opening time; empty when closed. */
  windows: TimeWindow[];
  season?: Season;
  exception?: Exception;
}

export type OpenStatus =
  { open: true; closes: string } | { open: false; opensToday?: string };

export interface BerlinClock {
  /** `YYYY-MM-DD` */
  date: string;
  weekday: Weekday;
  /** Minutes since midnight. */
  minutes: number;
}

const TIME_ZONE = "Europe/Berlin";

type Data = Record<string, unknown>;

export function parseOpeningHours(raw: unknown): OpeningHours {
  const data = record(raw, "opening hours");
  const seasons = list(data.seasons, "seasons").map((season, i) =>
    parseSeason(season, `seasons[${i}]`),
  );
  const owner = new Map<number, string>();
  for (const season of seasons) {
    for (const month of season.months) {
      const other = owner.get(month);
      if (other !== undefined) {
        throw new Error(
          `Opening hours: month ${month} belongs to both ${other} and ${season.name}`,
        );
      }
      owner.set(month, season.name);
    }
  }
  const exceptions = list(data.exceptions, "exceptions").flatMap(
    (exception, i) => {
      try {
        return [parseException(exception, `exceptions[${i}]`)];
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(
          `Opening hours: skipping exceptions[${i}], it will not show until fixed in the CMS - ${reason}`,
        );
        return [];
      }
    },
  );
  return { seasons, exceptions };
}

/** Date, weekday and time of an instant on the clocks in Berlin. */
export function berlinClock(instant: Date): BerlinClock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    date,
    weekday: weekdayOf(date),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** The hours that apply on a date (`YYYY-MM-DD`): an exception, else the season. */
export function hoursOn(hours: OpeningHours, date: string): DayHours {
  const exception = hours.exceptions.find(
    (entry) => entry.from <= date && date <= entry.until,
  );
  if (exception) return { windows: exception.windows, exception };
  const month = Number(date.slice(5, 7));
  const season = hours.seasons.find((entry) => entry.months.includes(month));
  if (!season) return { windows: [] };
  const weekday = weekdayOf(date);
  const windows = sortWindows(
    season.hours
      .filter((entry) => entry.days.includes(weekday))
      .map(({ opens, closes }) => ({ opens, closes })),
  );
  return { windows, season };
}

export function openStatus(hours: OpeningHours, instant: Date): OpenStatus {
  const now = berlinClock(instant);
  const { windows } = hoursOn(hours, now.date);
  const current = windows.find(
    (window) =>
      minutesOf(window.opens) <= now.minutes &&
      now.minutes < minutesOf(window.closes),
  );
  if (current) return { open: true, closes: current.closes };
  const next = windows.find((window) => minutesOf(window.opens) > now.minutes);
  return next ? { open: false, opensToday: next.opens } : { open: false };
}

export function statusText(status: OpenStatus): string {
  if (status.open)
    return `Jetzt geöffnet – bis ${formatTime(status.closes)} Uhr`;
  if (status.opensToday) {
    return `Jetzt geschlossen – öffnet heute um ${formatTime(status.opensToday)} Uhr`;
  }
  return "Jetzt geschlossen";
}

/** A season's week as table rows: consecutive days with equal hours share a row. */
export function weekRows(season: Season): { days: string; hours: string }[] {
  const perDay = WEEKDAYS.map((day) =>
    windowsText(
      sortWindows(season.hours.filter((entry) => entry.days.includes(day))),
    ),
  );
  const rows: { first: number; last: number; hours: string }[] = [];
  perDay.forEach((hours, day) => {
    const previous = rows.at(-1);
    if (previous && previous.hours === hours) previous.last = day;
    else rows.push({ first: day, last: day, hours });
  });
  return rows.map(({ first, last, hours }) => ({
    days:
      first === last
        ? WEEKDAY_LABELS[WEEKDAYS[first]!]
        : `${WEEKDAY_LABELS[WEEKDAYS[first]!]}–${WEEKDAY_LABELS[WEEKDAYS[last]!]}`,
    hours,
  }));
}

/** Hours of one day as text, e.g. `7:00–18:00 Uhr` or `geschlossen`. */
export function windowsText(windows: TimeWindow[]): string {
  if (windows.length === 0) return "geschlossen";
  const spans = windows.map(
    ({ opens, closes }) => `${formatTime(opens)}–${formatTime(closes)}`,
  );
  return `${spans.join(", ")} Uhr`;
}

/** Month ranges as text, e.g. `März–Mai, September–November`. */
export function monthsLabel(months: number[]): string {
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const month of sorted) {
    const previous = runs.at(-1);
    if (previous && previous[1] === month - 1) previous[1] = month;
    else runs.push([month, month]);
  }
  // A run ending in December continues one starting in January.
  const first = runs[0];
  const last = runs.at(-1);
  if (runs.length > 1 && first && last && first[0] === 1 && last[1] === 12) {
    runs.shift();
    last[1] = first[1];
  }
  return runs
    .map(([start, end]) =>
      start === end
        ? MONTH_LABELS[start - 1]
        : `${MONTH_LABELS[start - 1]}–${MONTH_LABELS[end - 1]}`,
    )
    .join(", ");
}

/** `2026-12-04` as `4.12.2026`. */
export function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${Number(day)}.${Number(month)}.${year}`;
}

/** `07:00` as `7:00`. */
export function formatTime(time: string): string {
  return time.replace(/^0(\d)/, "$1");
}

function parseSeason(raw: unknown, field: string): Season {
  const data = record(raw, field);
  const months = list(data.months, `${field}.months`).map((month, i) =>
    parseMonth(month, `${field}.months[${i}]`),
  );
  const hours = list(data.hours, `${field}.hours`).map((entry, i) => {
    const path = `${field}.hours[${i}]`;
    const hoursData = record(entry, path);
    const days = list(hoursData.days, `${path}.days`).map((day) => {
      if (!WEEKDAYS.includes(day as Weekday)) {
        throw new Error(`Opening hours: ${path}.days has unknown day ${day}`);
      }
      return day as Weekday;
    });
    return { days, ...parseWindow(hoursData, path) };
  });
  return { name: required(data, "name", `${field}.name`), months, hours };
}

function parseException(raw: unknown, field: string): Exception {
  const data = record(raw, field);
  const from = parseDate(data.from, `${field}.from`, true);
  const until = parseDate(data.until, `${field}.until`, false) ?? from;
  if (until < from) {
    throw new Error(`Opening hours: ${field}.until is before ${field}.from`);
  }
  const type = required(data, "type", `${field}.type`);
  if (type !== "closed" && type !== "open") {
    throw new Error(`Opening hours: ${field}.type must be "closed" or "open"`);
  }
  const windows = type === "closed" ? [] : [parseWindow(data, field)];
  const note = text(data.note, `${field}.note`);
  return note === undefined
    ? { from, until, windows }
    : { from, until, windows, note };
}

function parseWindow(data: Data, field: string): TimeWindow {
  const opens = parseTime(data.opens, `${field}.opens`);
  const closes = parseTime(data.closes, `${field}.closes`);
  if (minutesOf(closes) <= minutesOf(opens)) {
    throw new Error(`Opening hours: ${field}.closes must be after opens`);
  }
  return { opens, closes };
}

function parseMonth(value: unknown, field: string): number {
  const month = typeof value === "string" ? Number(value) : value;
  if (typeof month !== "number" || !Number.isInteger(month)) {
    throw new Error(`Opening hours: ${field} must be a month number`);
  }
  if (month < 1 || month > 12) {
    throw new Error(`Opening hours: ${field} must be between 1 and 12`);
  }
  return month;
}

function parseTime(value: unknown, field: string): string {
  const time = text(value, field);
  const match = time && /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new Error(`Opening hours: ${field} must be a time (HH:MM)`);
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

function parseDate(value: unknown, field: string, isRequired: true): string;
function parseDate(
  value: unknown,
  field: string,
  isRequired: false,
): string | undefined;
function parseDate(
  value: unknown,
  field: string,
  isRequired: boolean,
): string | undefined {
  const date = text(value, field);
  if (date === undefined) {
    if (isRequired) throw new Error(`Opening hours: ${field} is required`);
    return undefined;
  }
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);
  if (!valid) {
    throw new Error(`Opening hours: ${field} must be a date (YYYY-MM-DD)`);
  }
  return date;
}

function weekdayOf(date: string): Weekday {
  // getUTCDay counts from Sunday.
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return WEEKDAYS[(day + 6) % 7]!;
}

function minutesOf(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function sortWindows(windows: TimeWindow[]): TimeWindow[] {
  return [...windows].sort((a, b) => minutesOf(a.opens) - minutesOf(b.opens));
}

function record(value: unknown, field: string): Data {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Opening hours: ${field} must be an object`);
  }
  return value as Data;
}

function list(value: unknown, field: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`Opening hours: ${field} must be a list`);
  }
  return value;
}

function text(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error(`Opening hours: ${field} must be text`);
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function required(data: Data, key: string, field = key): string {
  const value = text(data[key], field);
  if (value === undefined)
    throw new Error(`Opening hours: ${field} is required`);
  return value;
}
