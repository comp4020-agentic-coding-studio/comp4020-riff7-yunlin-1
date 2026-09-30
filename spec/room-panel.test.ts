import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";
import { BUILDINGS } from "../src/lib/campus";

// The room availability panel's promises: the home page ships a hidden,
// labelled dialog with a real booking link, every building stays
// reachable as a plain link without scripts, and the rooms API the panel reads returns
// a known status for every room. Clicking and focus need a real browser, so
// they're left to manual checks.
const baseUrl = inject("baseUrl");

const STATUSES = ["available", "busy", "closed"];

const loadHome = async () => {
  const res = await fetch(new URL("/", baseUrl));
  expect(res.status).toBe(200);
  return new JSDOM(await res.text()).window.document;
};

describe("room availability panel", () => {
  it("ships a hidden dialog with an accessible name on /", async () => {
    const doc = await loadHome();
    const panel = doc.getElementById("room-panel");
    expect(panel, "expected a #room-panel on /").not.toBeNull();
    expect(panel!.hasAttribute("hidden")).toBe(true);
    expect(panel!.getAttribute("role")).toBe("dialog");
    const labelId = panel!.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(doc.getElementById(labelId!)?.textContent?.trim()).toBeTruthy();
  });

  it("has a Schedule booking link to a building page", async () => {
    const doc = await loadHome();
    const book = [...doc.querySelectorAll("#room-panel a")].find((a) => a.textContent?.includes("Schedule booking"));
    expect(book, "expected a Schedule booking link in the panel").toBeDefined();
    expect(book!.getAttribute("href")).toMatch(/^\/building\/[a-z-]+\/$/);
  });

  it("links every building as a real link carrying data-building-id", async () => {
    const doc = await loadHome();
    const links = [...doc.querySelectorAll<HTMLAnchorElement>(".building-links a")];
    for (const a of links) {
      const id = a.getAttribute("data-building-id");
      expect(id, a.outerHTML).toBeTruthy();
      expect(a.getAttribute("href")).toBe(`/building/${id}/`);
    }
    // Every building, including the ones with no map marker, stays reachable.
    const ids = links.map((a) => a.getAttribute("data-building-id")).sort();
    expect(ids).toEqual(BUILDINGS.map((b) => b.id).sort());
  });

  it("drops the old building cards", async () => {
    const doc = await loadHome();
    expect(doc.querySelector(".card-list")).toBeNull();
  });

  it("returns every room in a building with a known status", async () => {
    const res = await fetch(new URL("/api/rooms.json?building=chifley", baseUrl));
    expect(res.status).toBe(200);
    const { rooms } = (await res.json()) as { rooms: { id: string; status: string }[] };
    expect(rooms.length).toBeGreaterThan(0);
    for (const r of rooms) expect(STATUSES, r.id).toContain(r.status);
  });

  // Asks about a day a week out at 10:15, via the API's date/time overrides,
  // so this runs whatever the hour. Hancock, because campus-map.test.ts
  // counts chifley's free rooms and spec files run in parallel.
  it("reports who holds a booked room and when it frees up, and when a free one stays free", async () => {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );
    const book = (roomId: string, start: string, end: string) =>
      fetch(new URL("/api/bookings", baseUrl), {
        method: "POST",
        headers: { origin: baseUrl, "content-type": "application/json" },
        body: JSON.stringify({ roomId, buildingId: "hancock", bookedBy: "panel spec probe", date, start, end }),
      });
    // Back to back, so the room is busy until 11:30, not 11:00.
    expect((await book("hancock-3-28", "10:00", "11:00")).status).toBe(200);
    expect((await book("hancock-3-28", "11:00", "11:30")).status).toBe(200);
    expect((await book("hancock-3-29", "15:00", "16:00")).status).toBe(200);

    const res = await fetch(new URL(`/api/rooms.json?building=hancock&date=${date}&time=10:15`, baseUrl));
    expect(res.headers.get("cache-control")).toContain("no-store");
    const { rooms } = (await res.json()) as {
      rooms: { id: string; status: string; until: string | null; bookedBy: string | null }[];
    };
    const byId = Object.fromEntries(rooms.map((r) => [r.id, r]));
    expect(byId["hancock-3-28"]).toMatchObject({ status: "busy", until: "11:30", bookedBy: "panel spec probe" });
    expect(byId["hancock-3-29"]).toMatchObject({ status: "available", until: "15:00", bookedBy: null });
    expect(byId["hancock-3-33"]).toMatchObject({ status: "available", until: "22:00", bookedBy: null });
  });

  it("keeps a statically closed room closed, and shows closed outside opening hours", async () => {
    const coombs = await (await fetch(new URL("/api/rooms.json?building=coombs&time=10:15", baseUrl))).json();
    const closed = coombs.rooms.find((r: { id: string }) => r.id === "coombs-1130");
    expect(closed).toMatchObject({ status: "closed", until: null });
    const night = await (await fetch(new URL("/api/rooms.json?building=birch&time=23:00", baseUrl))).json();
    for (const r of night.rooms) expect(r, r.id).toMatchObject({ status: "closed", until: "08:00" });
  });

  it("refuses a missing building with 400 and an unknown one with 404", async () => {
    expect((await fetch(new URL("/api/rooms.json", baseUrl))).status).toBe(400);
    expect((await fetch(new URL("/api/rooms.json?building=nowhere", baseUrl))).status).toBe(404);
  });

  it("treats an empty time as now and refuses a malformed date or time with 400", async () => {
    const empty = await fetch(new URL("/api/rooms.json?building=birch&time=", baseUrl));
    expect(empty.status).toBe(200);
    expect(((await empty.json()) as { rooms: unknown[] }).rooms.length).toBeGreaterThan(0);

    const badTime = await fetch(new URL("/api/rooms.json?building=birch&time=9am", baseUrl));
    expect(badTime.status).toBe(400);
    expect(await badTime.json()).toHaveProperty("error");

    const badDate = await fetch(new URL("/api/rooms.json?building=birch&date=tomorrow", baseUrl));
    expect(badDate.status).toBe(400);
    expect(await badDate.json()).toHaveProperty("error");
  });
});
