import type { APIRoute } from "astro";
import { bookingWindow, canberraNow, createBooking, isSlotTime, toMinutes } from "../../lib/bookings";
import { CLOSE, getBuilding, OPEN, SLOT_MINUTES } from "../../lib/campus";

interface BookingFields {
  roomId: string;
  buildingId: string;
  bookedBy: string;
  date: string;
  start: string;
  end: string;
}

const FIELD_NAMES = ["roomId", "buildingId", "bookedBy", "date", "start", "end"] as const;

// Every field as a trimmed string, whichever path it came in on. Anything
// that isn't a string (a number, null, an object in JSON) becomes "", so
// validate() reports it as missing rather than the route throwing.
function normalise(get: (name: string) => unknown): BookingFields {
  const fields = {} as BookingFields;
  for (const name of FIELD_NAMES) {
    const value = get(name);
    fields[name] = typeof value === "string" ? value.trim() : "";
  }
  return fields;
}

function validate(fields: BookingFields): string | null {
  const { roomId, buildingId, bookedBy, date, start, end } = fields;
  if (!roomId || !buildingId || !bookedBy || !date || !start || !end) {
    return "All fields are required.";
  }
  // The calendar only offers valid slots, but the API can't trust the client.
  const room = getBuilding(buildingId)?.rooms.find((r) => r.id === roomId);
  if (!room) {
    return "That room isn't in this building.";
  }
  if (room.status === "closed") {
    return "That room is closed for booking.";
  }
  const now = canberraNow();
  const { first, last } = bookingWindow(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < first || date > last) {
    return `Bookings can be made from ${first} to ${last}.`;
  }
  if (!isSlotTime(start) || !isSlotTime(end)) {
    return "Times must be on the half hour.";
  }
  if (!(start < end)) {
    return "Start time must be before end time.";
  }
  if (start < OPEN || end > CLOSE) {
    return `Rooms can be booked between ${OPEN} and ${CLOSE}.`;
  }
  // Same rule as the calendar grid: a slot is past once its end is at or
  // before now, so the slot in progress can still be booked.
  if (date === now.date && toMinutes(start) + SLOT_MINUTES <= toMinutes(now.time)) {
    return "That time has already passed.";
  }
  return null;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Accepts either a plain HTML form POST (the no-JS path, mirroring
// messages.ts's redirect idiom) or a JSON POST (for client-side callers) —
// which one is in play is decided by the Content-Type header. Both paths
// validate the same fields and call the same createBooking(); they only
// differ in how success/failure is reported back.
export const POST: APIRoute = async ({ request, redirect }) => {
  const contentType = request.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  let fields: BookingFields;
  if (isJson) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Request body must be valid JSON." }, 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json({ ok: false, error: "Request body must be a JSON object." }, 400);
    }
    const record = body as Record<string, unknown>;
    fields = normalise((name) => record[name]);
  } else {
    const form = await request.formData();
    fields = normalise((name) => form.get(name));
  }

  const { roomId, buildingId, bookedBy, date, start, end } = fields;
  const back = (params: Record<string, string>) =>
    `/building/${encodeURIComponent(buildingId)}/?${new URLSearchParams({ date, ...params })}`;

  const error = validate(fields);
  if (error) {
    if (isJson) return json({ ok: false, error }, 400);
    return redirect(buildingId ? back({ error }) : `/?error=${encodeURIComponent(error)}`, 303);
  }

  const result = createBooking({ roomId, buildingId, bookedBy, date, start, end });

  if (!result.ok) {
    if (isJson) return json({ ok: false, error: result.error }, 409);
    return redirect(back({ error: result.error }), 303);
  }

  if (isJson) return json({ ok: true, booking: result.booking }, 200);
  return redirect(back({ booked: roomId, from: start, to: end }), 303);
};
