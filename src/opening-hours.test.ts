import { describe, expect, it, vi } from "vitest";
import {
  berlinClock,
  formatDate,
  hoursOn,
  monthsLabel,
  openStatus,
  parseOpeningHours,
  statusText,
  weekRows,
  type OpeningHours,
} from "./opening-hours";

// The three season profiles of the old site (content inventory,
// /kontakt/oeffnungszeiten-2-2/), in the shape Sveltia CMS saves them.
const SEASONS = [
  {
    name: "Pflanzzeit",
    months: [3, 4, 5, 9, 10, 11],
    hours: [
      {
        days: ["mon", "tue", "wed", "thu", "fri"],
        opens: "07:00",
        closes: "18:00",
      },
      { days: ["sat"], opens: "09:00", closes: "14:00" },
    ],
  },
  {
    name: "Sommer",
    months: [6, 7, 8],
    hours: [
      { days: ["mon", "tue", "wed", "thu"], opens: "07:00", closes: "16:00" },
      { days: ["fri"], opens: "07:00", closes: "13:30" },
    ],
  },
  {
    name: "Winter",
    months: [12, 1, 2],
    hours: [
      { days: ["mon", "tue", "wed", "thu"], opens: "08:00", closes: "15:00" },
      { days: ["fri"], opens: "08:00", closes: "14:00" },
    ],
  },
];

function hoursWith(exceptions: unknown[] = []): OpeningHours {
  return parseOpeningHours({ seasons: SEASONS, exceptions });
}

/** An instant given as Berlin wall-clock time with its UTC offset. */
function at(berlinTime: string): Date {
  return new Date(berlinTime);
}

function isOpen(hours: OpeningHours, instant: Date): boolean {
  return openStatus(hours, instant).open;
}

describe("parseOpeningHours", () => {
  it("reads season profiles and exceptions as the CMS saves them", () => {
    const hours = parseOpeningHours({
      seasons: SEASONS,
      exceptions: [
        {
          type: "closed",
          from: "2026-12-24",
          until: "",
          note: "Heiligabend",
        },
        {
          type: "open",
          from: "2026-10-03",
          until: "2026-10-04",
          opens: "10:00",
          closes: "12:00",
          note: "",
        },
      ],
    });
    expect(hours.seasons.map((season) => season.name)).toEqual([
      "Pflanzzeit",
      "Sommer",
      "Winter",
    ]);
    expect(hours.exceptions).toEqual([
      {
        from: "2026-12-24",
        until: "2026-12-24",
        windows: [],
        note: "Heiligabend",
      },
      {
        from: "2026-10-03",
        until: "2026-10-04",
        windows: [{ opens: "10:00", closes: "12:00" }],
      },
    ]);
  });

  it("accepts months saved as text and times without a leading zero", () => {
    const hours = parseOpeningHours({
      seasons: [
        {
          name: "Ganzjährig",
          months: ["1", "2"],
          hours: [{ days: ["mon"], opens: "7:00", closes: "9:30" }],
        },
      ],
    });
    expect(hours.seasons[0]?.months).toEqual([1, 2]);
    expect(hours.seasons[0]?.hours[0]).toMatchObject({ opens: "07:00" });
    expect(hours.exceptions).toEqual([]);
  });

  it("rejects a month that belongs to two seasons, naming it", () => {
    expect(() =>
      parseOpeningHours({
        seasons: [...SEASONS, { name: "Doppelt", months: [6], hours: [] }],
      }),
    ).toThrow(/month 6/);
  });

  it("rejects malformed times, dates and windows, naming the field", () => {
    const broken = (hours: unknown) =>
      parseOpeningHours({
        seasons: [{ name: "X", months: [1], hours: [hours] }],
      });
    expect(() =>
      broken({ days: ["mon"], opens: "7 Uhr", closes: "18:00" }),
    ).toThrow(/seasons\[0\]\.hours\[0\]\.opens/);
    expect(() =>
      broken({ days: ["mon"], opens: "18:00", closes: "07:00" }),
    ).toThrow(/closes/);
    expect(() =>
      broken({ days: ["montag"], opens: "07:00", closes: "18:00" }),
    ).toThrow(/days/);
    expect(() => parseOpeningHours(null)).toThrow(/opening hours/);
  });

  it("skips invalid exceptions with a build warning instead of failing the whole build, naming the field", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const hours = parseOpeningHours({
      seasons: [],
      exceptions: [
        { type: "closed", from: "2026-12-20", note: "Gültig davor" },
        // The review's repro: "Geöffnet mit Zeiten" (closed unticked) with no
        // times entered. The CMS's variant fields now keep this from being
        // saved, but the parser still has to survive it if it ever reaches
        // here (hand-edited JSON, data from before this change).
        { type: "open", from: "2026-12-24" },
        { from: "2026-12-25" }, // no type at all
        { type: "closed", from: "24.12.2026" }, // malformed date
        { type: "closed", from: "2026-12-24", until: "2026-12-23" }, // until before from
        { type: "closed", from: "2026-12-28", note: "Gültig danach" },
      ],
    });
    expect(hours.exceptions.map((entry) => entry.note)).toEqual([
      "Gültig davor",
      "Gültig danach",
    ]);
    expect(warn.mock.calls.map((call) => call[0])).toEqual([
      expect.stringMatching(/exceptions\[1\]\.opens/),
      expect.stringMatching(/exceptions\[2\]\.type/),
      expect.stringMatching(/exceptions\[3\]\.from/),
      expect.stringMatching(/exceptions\[4\]\.until/),
    ]);
    warn.mockRestore();
  });
});

describe("berlinClock", () => {
  it("reads the date, weekday and time in Berlin, whatever zone the instant is written in", () => {
    // 23:30 UTC on 30 Nov is already 1 Dec in Berlin (CET, UTC+1).
    expect(berlinClock(new Date("2026-11-30T23:30:00Z"))).toEqual({
      date: "2026-12-01",
      weekday: "tue",
      minutes: 30,
    });
    expect(berlinClock(new Date("2026-07-01T09:15:00-07:00"))).toEqual({
      date: "2026-07-01",
      weekday: "wed",
      minutes: 18 * 60 + 15,
    });
  });
});

describe("hoursOn", () => {
  it("uses the season profile the date's month belongs to", () => {
    expect(hoursOn(hoursWith(), "2026-06-05").season?.name).toBe("Sommer");
    expect(hoursOn(hoursWith(), "2026-06-05").windows).toEqual([
      { opens: "07:00", closes: "13:30" },
    ]);
    expect(hoursOn(hoursWith(), "2027-01-15").season?.name).toBe("Winter");
  });

  it("is closed on Sunday in every season", () => {
    for (const sunday of ["2026-04-12", "2026-07-12", "2026-12-13"]) {
      expect(hoursOn(hoursWith(), sunday).windows).toEqual([]);
    }
  });

  it("lets an exception override the season profile for every day of its range", () => {
    const hours = hoursWith([
      {
        from: "2026-12-24",
        until: "2026-12-26",
        type: "closed",
        note: "Weihnachten",
      },
    ]);
    for (const day of ["2026-12-24", "2026-12-25", "2026-12-26"]) {
      expect(hoursOn(hours, day)).toMatchObject({
        windows: [],
        exception: { note: "Weihnachten" },
      });
      // The "gilt heute" badge follows this: an exception in effect today
      // has no season to mark, so the badge moves to the exception instead.
      expect(hoursOn(hours, day).season).toBeUndefined();
    }
    expect(hoursOn(hours, "2026-12-23").windows).toEqual([
      { opens: "08:00", closes: "15:00" },
    ]);
    expect(hoursOn(hours, "2026-12-23").exception).toBeUndefined();
  });

  it("uses the first matching exception when two cover the same date", () => {
    const hours = hoursWith([
      { from: "2026-08-01", type: "open", opens: "10:00", closes: "12:00" },
      { from: "2026-07-27", until: "2026-08-07", type: "closed" },
    ]);
    expect(hoursOn(hours, "2026-08-01").windows).toEqual([
      { opens: "10:00", closes: "12:00" },
    ]);
    expect(hoursOn(hours, "2026-08-03").windows).toEqual([]);
  });

  it("is closed in a month no season covers", () => {
    const hours = parseOpeningHours({ seasons: SEASONS.slice(0, 1) });
    expect(hoursOn(hours, "2026-07-01")).toEqual({ windows: [] });
  });
});

describe("openStatus", () => {
  it("is open from the opening minute until just before closing", () => {
    const hours = hoursWith();
    expect(isOpen(hours, at("2026-04-13T06:59:00+02:00"))).toBe(false);
    expect(isOpen(hours, at("2026-04-13T07:00:00+02:00"))).toBe(true);
    expect(isOpen(hours, at("2026-04-13T17:59:00+02:00"))).toBe(true);
    expect(isOpen(hours, at("2026-04-13T18:00:00+02:00"))).toBe(false);
  });

  it("switches profiles at the season boundaries", () => {
    const hours = hoursWith();
    // Mon 30 Nov (Pflanzzeit, until 18:00) vs. Tue 1 Dec (Winter, until 15:00)
    expect(isOpen(hours, at("2026-11-30T16:00:00+01:00"))).toBe(true);
    expect(isOpen(hours, at("2026-12-01T16:00:00+01:00"))).toBe(false);
    // Sat 30 May (Pflanzzeit) vs. Sat 6 Jun (Sommer: closed on Saturday)
    expect(isOpen(hours, at("2026-05-30T10:00:00+02:00"))).toBe(true);
    expect(isOpen(hours, at("2026-06-06T10:00:00+02:00"))).toBe(false);
    // Sat 28 Feb (Winter: closed) vs. Sat 7 Mar (Pflanzzeit)
    expect(isOpen(hours, at("2026-02-28T10:00:00+01:00"))).toBe(false);
    expect(isOpen(hours, at("2026-03-07T10:00:00+01:00"))).toBe(true);
    // Fri 28 Aug (Sommer, until 13:30) vs. Fri 4 Sep (Pflanzzeit, until 18:00)
    expect(isOpen(hours, at("2026-08-28T14:00:00+02:00"))).toBe(false);
    expect(isOpen(hours, at("2026-09-04T14:00:00+02:00"))).toBe(true);
  });

  it("picks the season from the Berlin date, not the UTC date, around midnight", () => {
    const hours = hoursWith([
      { from: "2026-12-01", type: "open", opens: "00:00", closes: "01:00" },
    ]);
    // 23:30 UTC on 30 Nov is 00:30 on 1 Dec in Berlin.
    expect(isOpen(hours, new Date("2026-11-30T23:30:00Z"))).toBe(true);
  });

  it("is closed on Sunday", () => {
    expect(isOpen(hoursWith(), at("2026-04-12T10:00:00+02:00"))).toBe(false);
  });

  it("follows an exception instead of the season profile", () => {
    const hours = hoursWith([
      { from: "2026-04-14", type: "closed", note: "Betriebsausflug" },
      { from: "2026-04-19", type: "open", opens: "10:00", closes: "16:00" },
    ]);
    // Tuesday, normally open
    expect(isOpen(hours, at("2026-04-14T10:00:00+02:00"))).toBe(false);
    // Sunday, normally closed
    expect(isOpen(hours, at("2026-04-19T11:00:00+02:00"))).toBe(true);
    expect(isOpen(hours, at("2026-04-19T16:30:00+02:00"))).toBe(false);
  });

  it("uses Berlin wall-clock time across the switch to summer time", () => {
    const hours = hoursWith();
    // Summer time starts on Sun 29 Mar 2026. 05:30 UTC is 06:30 in Berlin
    // on the Monday before (CET) but 07:30 on the Monday after (CEST).
    expect(isOpen(hours, new Date("2026-03-23T05:30:00Z"))).toBe(false);
    expect(isOpen(hours, new Date("2026-03-30T05:30:00Z"))).toBe(true);
  });

  it("uses Berlin wall-clock time across the switch back to winter time", () => {
    const hours = hoursWith();
    // Summer time ends on Sun 25 Oct 2026. 16:30 UTC is 18:30 in Berlin on
    // Fri 23 Oct (CEST) but 17:30 on Mon 26 Oct (CET).
    expect(isOpen(hours, new Date("2026-10-23T16:30:00Z"))).toBe(false);
    expect(isOpen(hours, new Date("2026-10-26T16:30:00Z"))).toBe(true);
  });

  it("tells until when it is open, or when it opens later today", () => {
    const hours = hoursWith();
    expect(openStatus(hours, at("2026-04-18T10:00:00+02:00"))).toEqual({
      open: true,
      closes: "14:00",
    });
    expect(openStatus(hours, at("2026-04-18T08:00:00+02:00"))).toEqual({
      open: false,
      opensToday: "09:00",
    });
    expect(openStatus(hours, at("2026-04-18T15:00:00+02:00"))).toEqual({
      open: false,
    });
  });
});

describe("statusText", () => {
  it("words the status in German", () => {
    expect(statusText({ open: true, closes: "13:30" })).toBe(
      "Jetzt geöffnet – bis 13:30 Uhr",
    );
    expect(statusText({ open: false, opensToday: "09:00" })).toBe(
      "Jetzt geschlossen – öffnet heute um 9:00 Uhr",
    );
    expect(statusText({ open: false })).toBe("Jetzt geschlossen");
  });
});

describe("weekRows", () => {
  it("groups consecutive weekdays with the same hours and lists closed days", () => {
    const [pflanzzeit, sommer] = hoursWith().seasons;
    expect(weekRows(pflanzzeit!)).toEqual([
      { days: "Mo–Fr", hours: "7:00–18:00 Uhr" },
      { days: "Sa", hours: "9:00–14:00 Uhr" },
      { days: "So", hours: "geschlossen" },
    ]);
    expect(weekRows(sommer!)).toEqual([
      { days: "Mo–Do", hours: "7:00–16:00 Uhr" },
      { days: "Fr", hours: "7:00–13:30 Uhr" },
      { days: "Sa–So", hours: "geschlossen" },
    ]);
  });

  it("lists every window of a day with a break", () => {
    const [season] = parseOpeningHours({
      seasons: [
        {
          name: "Mit Pause",
          months: [1],
          hours: [
            { days: ["mon"], opens: "13:00", closes: "17:00" },
            { days: ["mon"], opens: "08:00", closes: "12:00" },
          ],
        },
      ],
    }).seasons;
    expect(weekRows(season!)[0]).toEqual({
      days: "Mo",
      hours: "8:00–12:00, 13:00–17:00 Uhr",
    });
  });
});

describe("monthsLabel", () => {
  it("names month ranges, including one that runs over the turn of the year", () => {
    expect(monthsLabel([3, 4, 5, 9, 10, 11])).toBe(
      "März–Mai, September–November",
    );
    expect(monthsLabel([12, 1, 2])).toBe("Dezember–Februar");
    expect(monthsLabel([6])).toBe("Juni");
  });
});

describe("formatDate", () => {
  it("writes a date the German way", () => {
    expect(formatDate("2026-12-04")).toBe("4.12.2026");
  });
});
