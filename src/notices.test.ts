import { afterEach, describe, expect, it, vi } from "vitest";
import { noticeHref, parseNotice, parseNotices } from "./notices";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseNotice", () => {
  it("reads text, link and window", () => {
    expect(
      parseNotice("markt", {
        text: " Staudenmarkt ",
        link: "/karriere/",
        visible_from: "2026-08-01",
        visible_until: "2026-09-06",
      }),
    ).toEqual({
      id: "markt",
      text: "Staudenmarkt",
      link: "/karriere/",
      window: { kind: "dates", from: "2026-08-01", until: "2026-09-06" },
    });
  });

  it("treats the empty strings the CMS writes as missing", () => {
    expect(
      parseNotice("n", {
        text: "Hinweis",
        link: "",
        visible_from: "",
        visible_until: "",
      }),
    ).toEqual({ id: "n", text: "Hinweis", window: { kind: "dates" } });
  });

  it.each([
    [{}, "text is required"],
    [{ text: "  " }, "text is required"],
    [{ text: "x", link: "karriere" }, "link must be"],
    [{ text: "x", visible_from: "2026-02-30" }, "visible_from must be a date"],
    [{ text: "x", visible_until: "6.9.2026" }, "visible_until must be a date"],
    [
      { text: "x", visible_from: "2026-09-07", visible_until: "2026-09-06" },
      "visible_until is before visible_from",
    ],
  ])("rejects %j", (raw, message) => {
    expect(() => parseNotice("n", raw)).toThrow(message);
  });
});

describe("parseNotices", () => {
  it("skips an invalid notice with a warning and keeps the rest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const notices = parseNotices({
      "/src/content/notices/good.json": { text: "Gut" },
      "/src/content/notices/broken.json": { text: "" },
    });
    expect(notices.map((notice) => notice.id)).toEqual(["good"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Notices: skipping broken"),
    );
  });

  it("sorts by the start of the window, open start first, then by id", () => {
    const notices = parseNotices({
      "/x/c.json": { text: "c", visible_from: "2026-09-01" },
      "/x/b.json": { text: "b" },
      "/x/a.json": { text: "a", visible_from: "2026-10-01" },
      "/x/0.json": { text: "0" },
    });
    expect(notices.map((notice) => notice.id)).toEqual(["0", "b", "c", "a"]);
  });
});

describe("noticeHref", () => {
  it("puts site paths below the base path", () => {
    expect(noticeHref("/karriere/", "/baumschule")).toBe(
      "/baumschule/karriere/",
    );
    expect(noticeHref("/karriere/", "/")).toBe("/karriere/");
  });

  it("leaves absolute URLs as they are", () => {
    expect(noticeHref("https://example.org/", "/baumschule")).toBe(
      "https://example.org/",
    );
  });
});
