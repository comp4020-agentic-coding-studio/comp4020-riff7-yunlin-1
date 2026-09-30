import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// The building page's day calendar, checked over HTTP against the running
// app. It claims: each library building lists its real rooms, one table row
// per room; a booking made through the API shows up as booked cells with no
// book link, while the slots either side stay bookable; picking a free cell
// renders the booking form filled in, with end times that stop at the room's
// next booking; and the day strip offers exactly the 14 bookable days, with
// a date outside that window pulled back into it. A red run here means the
// calendar is showing students the wrong picture of a day.
const baseUrl = inject("baseUrl");

// Canberra wall-clock date, the same clock the page and API judge by.
const canberraToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const TODAY = canberraToday();
// A week out: always inside the window and never "past", whatever the hour.
const DATE = addDays(TODAY, 7);
const BUILDING = "chifley";
// booking.test.ts books chifley-3-04, so this file keeps to 3.05.
const ROOM = "chifley-3-05";

const load = async (path: string) => {
  const res = await fetch(new URL(path, baseUrl));
  expect(res.status).toBe(200);
  return new JSDOM(await res.text()).window.document;
};

const roomNames = (doc: Document) =>
  Array.from(doc.querySelectorAll(".calendar tbody th[scope=row] .room-name")).map((el) => el.textContent?.trim());

const cell = (doc: Document, roomId: string, start: string) => {
  const td = doc.querySelector(`.calendar tr[data-room-id="${roomId}"] td[data-start="${start}"]`);
  expect(td, `expected a ${start} cell for ${roomId}`).not.toBeNull();
  return td!;
};

describe("availability calendar", () => {
  it("lists one row per room: Marie Reay 12, Chifley 10, Hancock 9", async () => {
    const marieReay = roomNames(await load("/building/marie-reay/"));
    expect(marieReay).toEqual(
      ["2.01", "2.02", "2.03", "2.04", "3.01", "3.02", "3.03", "3.04", "4.01", "4.02", "4.03", "4.04"].map(
        (n) => `Room ${n}`,
      ),
    );
    expect(roomNames(await load("/building/chifley/"))).toHaveLength(10);
    expect(roomNames(await load("/building/hancock/"))).toHaveLength(9);
  });

  // The GET checks below depend on this booking, and vitest runs the tests
  // in one file in order.
  it("shows a booking as booked cells with no link, and leaves its neighbours bookable", async () => {
    const res = await fetch(new URL("/api/bookings", baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({
        roomId: ROOM,
        buildingId: BUILDING,
        bookedBy: "calendar probe",
        date: DATE,
        start: "10:00",
        end: "11:00",
      }),
    });
    expect(res.status).toBe(200);

    const doc = await load(`/building/${BUILDING}/?date=${DATE}`);
    for (const start of ["10:00", "10:30"]) {
      const td = cell(doc, ROOM, start);
      expect(td.classList.contains("slot-booked")).toBe(true);
      expect(td.querySelector("a")).toBeNull();
    }
    for (const start of ["09:30", "11:00"]) {
      const td = cell(doc, ROOM, start);
      expect(td.classList.contains("slot-free")).toBe(true);
      expect(td.querySelector("a")?.getAttribute("href")).toContain(`room=${ROOM}&start=${start}`);
    }
  });

  it("prefills the form from a picked cell, with end times up to the next booking", async () => {
    const doc = await load(`/building/${BUILDING}/?date=${DATE}&room=${ROOM}&start=09:00`);
    const form = doc.querySelector<HTMLFormElement>("form#book");
    expect(form, "expected the booking form").not.toBeNull();
    expect(form!.hasAttribute("hidden")).toBe(false);
    const value = (name: string) => form!.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value;
    expect(value("roomId")).toBe(ROOM);
    expect(value("start")).toBe("09:00");
    expect(value("date")).toBe(DATE);
    const ends = Array.from(form!.querySelectorAll("select[name=end] option")).map((o) => o.getAttribute("value"));
    expect(ends).toEqual(["09:30", "10:00"]);
  });

  it("confirms a no-JS booking from the redirect, but only for a room in this building", async () => {
    const doc = await load(`/building/${BUILDING}/?date=${DATE}&booked=${ROOM}&from=10:00&to=11:00`);
    const feedback = doc.querySelector(".booking-feedback[role=status]");
    expect(feedback?.classList.contains("success")).toBe(true);
    expect(feedback?.textContent).toMatch(/Booked .*3\.05.*10:00–11:00/);

    const other = await load(`/building/${BUILDING}/?date=${DATE}&booked=hancock-3-27&from=10:00&to=11:00`);
    expect(other.querySelector(".booking-feedback[role=status]")?.textContent).toBe("");
  });

  it("offers the 14 bookable days and clamps a date outside them", async () => {
    const doc = await load(`/building/${BUILDING}/`);
    const days = Array.from(doc.querySelectorAll(".day-strip .day-link")).map((a) => a.getAttribute("href"));
    expect(days).toHaveLength(14);
    expect(days[0]).toBe(`?date=${TODAY}`);
    expect(days[13]).toBe(`?date=${addDays(TODAY, 13)}`);

    const clamped = await load(`/building/${BUILDING}/?date=2000-01-01`);
    expect(clamped.querySelector(".day-link[aria-current=date]")?.getAttribute("href")).toBe(`?date=${TODAY}`);
    const far = await load(`/building/${BUILDING}/?date=2099-01-01`);
    expect(far.querySelector(".day-link[aria-current=date]")?.getAttribute("href")).toBe(
      `?date=${addDays(TODAY, 13)}`,
    );
  });
});
