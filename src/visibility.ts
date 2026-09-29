/**
 * The visibility window rule shared by Notices and Seasonal offers (AC-5):
 * an entry shows on a date only when that date lies inside its window.
 *
 * - A notice has a window of calendar dates (`YYYY-MM-DD`); either end may be
 *   left open.
 * - A seasonal offer has a window of month/day pairs (`MM-DD`) that recurs
 *   every year; a window whose start comes after its end (e.g. `11-15` to
 *   `01-06`) spans the turn of the year.
 *
 * Both ends are inclusive. Dates are Berlin calendar dates (`berlinClock` in
 * `src/opening-hours.ts`), so an entry disappears at midnight in Berlin for
 * every visitor.
 *
 * The site is static and only rebuilds on push and once a day (the
 * `schedule` trigger in `.github/workflows/ci.yml`). So the build renders
 * every entry that is not over yet with its window in a `data-window`
 * attribute, hidden when it is outside the window on the build date, and the
 * client script in `src/components/VisibilityWindows.astro` applies the same
 * rule with the visitor's current date. That keeps the page right between
 * builds; the daily rebuild keeps the HTML itself (no JavaScript, crawlers)
 * at most a day behind.
 */

/** Calendar dates `YYYY-MM-DD`; a missing end is open. */
export interface DateWindow {
  kind: "dates";
  from?: string;
  until?: string;
}

/** Month/day `MM-DD`, every year. */
export interface YearlyWindow {
  kind: "yearly";
  from: string;
  until: string;
}

export type VisibilityWindow = DateWindow | YearlyWindow;

/** Whether `date` (`YYYY-MM-DD`) lies inside the window, ends included. */
export function isWithinWindow(
  window: VisibilityWindow,
  date: string,
): boolean {
  if (window.kind === "dates") {
    return (
      (window.from === undefined || window.from <= date) &&
      (window.until === undefined || date <= window.until)
    );
  }
  const monthDay = date.slice(5);
  return window.from <= window.until
    ? window.from <= monthDay && monthDay <= window.until
    : window.from <= monthDay || monthDay <= window.until;
}

/**
 * Whether the window is over for good on `date`: only a date window with an
 * end before that date. A yearly window always comes back.
 */
export function isWindowOver(window: VisibilityWindow, date: string): boolean {
  return (
    window.kind === "dates" && window.until !== undefined && window.until < date
  );
}
