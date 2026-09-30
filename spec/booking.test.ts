import { describe, expect, inject, it } from "vitest";

// Drives the running app over HTTP to prove the booking feature's two core
// claims hold in this repo: a booking made through the no-JS form path
// persists and flips the room's live status to busy, and the API refuses a
// second booking that overlaps an existing one for the same room, while
// still allowing a genuinely non-overlapping booking straight after it. It
// also checks the API enforces the booking rules itself (right building, open
// room, two-week window, half-hour slots, nothing already over). A red run
// here means the booking feature itself is broken.
const baseUrl = inject("baseUrl");

// Canberra wall-clock date and time, the same clock the API judges by.
const canberraNow = () => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
};

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const NOW = canberraNow();
// A week out: inside the 14-day booking window and clear of "today" logic.
// Each test run boots a fresh throwaway db, so no cross-run collision risk.
const DATE = addDays(NOW.date, 7);
const BUILDING = "chifley";
const ROOM = "chifley-3-04"; // status "available" in static campus data

// Astro checks form POSTs carry a same-origin Origin header (CSRF
// protection); browsers send it automatically, a bare fetch doesn't.
const postForm = (path: string, body: URLSearchParams) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body,
    redirect: "manual",
  });

const postJson = (path: string, body: unknown) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("booking", () => {
  it("accepts a form booking, redirects, and the room shows busy on reload", async () => {
    const res = await postForm(
      "/api/bookings",
      new URLSearchParams({
        roomId: ROOM,
        buildingId: BUILDING,
        bookedBy: "spec probe",
        date: DATE,
        start: "09:00",
        end: "10:00",
      }),
    );
    expect(res.status).toBe(303);
    // Back to the same day, with enough in the query to confirm the booking.
    expect(res.headers.get("location")).toBe(
      `/building/${BUILDING}/?date=${DATE}&booked=${ROOM}&from=09%3A00&to=10%3A00`,
    );

    // A time strictly inside the booked window should now show busy.
    const roomsRes = await fetch(
      new URL(`/api/rooms.json?building=${BUILDING}&date=${DATE}&time=09:30`, baseUrl),
    );
    expect(roomsRes.status).toBe(200);
    const { rooms } = (await roomsRes.json()) as { rooms: { id: string; status: string }[] };
    const room = rooms.find((r) => r.id === ROOM);
    expect(room, `expected ${ROOM} in the rooms response`).toBeDefined();
    expect(room?.status).toBe("busy");
  });

  it("accepts a JSON booking, then rejects an overlapping one, then accepts a non-overlapping one", async () => {
    const first = await postJson("/api/bookings", {
      roomId: ROOM,
      buildingId: BUILDING,
      bookedBy: "spec probe",
      date: DATE,
      start: "13:00",
      end: "14:00",
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as { ok: boolean };
    expect(firstBody.ok).toBe(true);

    // Overlapping window: starts before the first ends, ends after it starts.
    const overlapping = await postJson("/api/bookings", {
      roomId: ROOM,
      buildingId: BUILDING,
      bookedBy: "spec probe",
      date: DATE,
      start: "13:30",
      end: "14:30",
    });
    expect(overlapping.status).toBe(409);
    const overlapBody = (await overlapping.json()) as { ok: boolean; error?: string };
    expect(overlapBody.ok).toBe(false);
    expect(typeof overlapBody.error).toBe("string");
    expect(overlapBody.error?.length).toBeGreaterThan(0);

    // Non-overlapping window immediately after the first booking's end.
    const after = await postJson("/api/bookings", {
      roomId: ROOM,
      buildingId: BUILDING,
      bookedBy: "spec probe",
      date: DATE,
      start: "14:00",
      end: "15:00",
    });
    expect(after.status).toBe(200);
    const afterBody = (await after.json()) as { ok: boolean };
    expect(afterBody.ok).toBe(true);
  });

  // The calendar only offers valid slots, but the API must refuse bad input
  // from any client. Each case differs from a valid booking in one field.
  const valid = { roomId: ROOM, buildingId: BUILDING, bookedBy: "spec probe", date: DATE, start: "16:00", end: "16:30" };
  const rejects = async (overrides: Partial<typeof valid>) => {
    const res = await postJson("/api/bookings", { ...valid, ...overrides });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error?.length).toBeGreaterThan(0);
    return body.error!;
  };

  it("rejects a date outside the two-week booking window", async () => {
    await rejects({ date: addDays(NOW.date, 20) });
    await rejects({ date: addDays(NOW.date, -1) });
  });

  it("rejects a time that isn't on the half hour", async () => {
    await rejects({ start: "09:10", end: "10:00" });
    // Impossible clock times, even though 60 and 90 are multiples of 30.
    await rejects({ start: "08:90", end: "10:00" });
    await rejects({ start: "08:00", end: "08:60" });
  });

  it("rejects a JSON body that isn't valid JSON", async () => {
    const res = await fetch(new URL("/api/bookings", baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error?.length).toBeGreaterThan(0);
  });

  it("rejects a name that is only whitespace", async () => {
    await rejects({ bookedBy: "   " });
  });

  it("rejects a room from a different building", async () => {
    await rejects({ roomId: "hancock-3-27", buildingId: "chifley" });
  });

  it("rejects a closed room", async () => {
    await rejects({ roomId: "coombs-1130", buildingId: "coombs" });
  });

  // 08:00-08:30 is the first bookable slot, so it only counts as over once
  // Canberra time reaches 08:30. Before that there is no in-hours slot today
  // that has already ended, so the test can't be set up and is skipped.
  it.skipIf(NOW.time < "08:30")("rejects a slot today that has already ended", async () => {
    const error = await rejects({ date: NOW.date, start: "08:00", end: "08:30" });
    expect(error).toMatch(/passed/);
  });

  // A start slot that is already over is refused even when the end is still
  // ahead. Same setup limit as above: 08:00 is only over from 08:30.
  it.skipIf(NOW.time < "08:30")("rejects a booking today whose first slot has already ended", async () => {
    const error = await rejects({ date: NOW.date, start: "08:00", end: "22:00" });
    expect(error).toMatch(/passed/);
  });
});
