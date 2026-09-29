import { describe, expect, it } from "vitest";
import { isWindowOver, isWithinWindow } from "./visibility";

describe("isWithinWindow with calendar dates (notices)", () => {
  const window = {
    kind: "dates",
    from: "2026-09-01",
    until: "2026-09-06",
  } as const;

  it("includes both ends", () => {
    expect(isWithinWindow(window, "2026-09-01")).toBe(true);
    expect(isWithinWindow(window, "2026-09-06")).toBe(true);
  });

  it("excludes the days before and after", () => {
    expect(isWithinWindow(window, "2026-08-31")).toBe(false);
    expect(isWithinWindow(window, "2026-09-07")).toBe(false);
  });

  it("treats a missing end as open on that side", () => {
    expect(isWithinWindow({ kind: "dates" }, "1999-01-01")).toBe(true);
    expect(
      isWithinWindow({ kind: "dates", until: "2026-09-06" }, "2000-01-01"),
    ).toBe(true);
    expect(
      isWithinWindow({ kind: "dates", from: "2026-09-01" }, "2099-12-31"),
    ).toBe(true);
    expect(
      isWithinWindow({ kind: "dates", from: "2026-09-01" }, "2026-08-31"),
    ).toBe(false);
  });
});

describe("isWithinWindow with a yearly window (seasonal offers)", () => {
  const autumn = { kind: "yearly", from: "09-01", until: "11-30" } as const;

  it("applies in every year, ends included", () => {
    expect(isWithinWindow(autumn, "2026-09-01")).toBe(true);
    expect(isWithinWindow(autumn, "2031-11-30")).toBe(true);
    expect(isWithinWindow(autumn, "2026-08-31")).toBe(false);
    expect(isWithinWindow(autumn, "2027-12-01")).toBe(false);
  });

  it("spans the turn of the year when it starts after it ends", () => {
    const winter = { kind: "yearly", from: "11-15", until: "01-06" } as const;
    expect(isWithinWindow(winter, "2026-11-15")).toBe(true);
    expect(isWithinWindow(winter, "2026-12-31")).toBe(true);
    expect(isWithinWindow(winter, "2027-01-06")).toBe(true);
    expect(isWithinWindow(winter, "2027-01-07")).toBe(false);
    expect(isWithinWindow(winter, "2026-11-14")).toBe(false);
  });
});

describe("isWindowOver", () => {
  it("is true only for a date window that ended before the date", () => {
    const window = { kind: "dates", until: "2026-09-06" } as const;
    expect(isWindowOver(window, "2026-09-06")).toBe(false);
    expect(isWindowOver(window, "2026-09-07")).toBe(true);
    expect(isWindowOver({ kind: "dates" }, "2099-01-01")).toBe(false);
  });

  it("is never true for a yearly window, which comes back", () => {
    expect(
      isWindowOver(
        { kind: "yearly", from: "09-01", until: "09-02" },
        "2026-12-01",
      ),
    ).toBe(false);
  });
});
