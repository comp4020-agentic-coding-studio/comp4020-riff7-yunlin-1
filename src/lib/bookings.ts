import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { type Booking, bookings } from "./schema";
import {
  BOOKING_WINDOW_DAYS,
  type Building,
  CLOSE,
  OPEN,
  type Room,
  type RoomStatus,
  SLOT_MINUTES,
} from "./campus";

export type { Booking };

export function listBookingsForRoom(roomId: string, date: string): Booking[] {
  return db
    .select()
    .from(bookings)
    .where(and(eq(bookings.roomId, roomId), eq(bookings.date, date)))
    .orderBy(bookings.startTime)
    .all();
}

// Every booking in a building on one day, in one query (the day grid needs
// all of them at once).
export function listBookingsForBuilding(buildingId: string, date: string): Booking[] {
  return db
    .select()
    .from(bookings)
    .where(and(eq(bookings.buildingId, buildingId), eq(bookings.date, date)))
    .orderBy(bookings.startTime)
    .all();
}

export function isOverlapping(roomId: string, date: string, start: string, end: string): boolean {
  return listBookingsForRoom(roomId, date).some(
    (b) => start < b.endTime && b.startTime < end,
  );
}

export interface NewBooking {
  roomId: string;
  buildingId: string;
  bookedBy: string;
  date: string;
  start: string;
  end: string;
}

export function createBooking(input: NewBooking): { ok: true; booking: Booking } | { ok: false; error: string } {
  if (isOverlapping(input.roomId, input.date, input.start, input.end)) {
    return { ok: false, error: "That room is already booked for part of this time slot." };
  }
  const booking = db
    .insert(bookings)
    .values({
      roomId: input.roomId,
      buildingId: input.buildingId,
      bookedBy: input.bookedBy,
      date: input.date,
      startTime: input.start,
      endTime: input.end,
    })
    .returning()
    .get();
  return { ok: true, booking };
}

// Servers run in UTC, but "now" for a booking means Canberra wall-clock time.
export function canberraNow(at: Date = new Date()): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export interface LiveStatus {
  status: RoomStatus;
  // "HH:MM". Available: when the next booking starts, or CLOSE. Busy: when
  // the room frees up (back-to-back bookings merged). Closed outside opening
  // hours: OPEN. Closed for good (static "closed"): null.
  until: string | null;
  // Who holds the booking covering `time`; only set when busy.
  bookedBy: string | null;
}

// What the home page says about a room at `time`: the panel row and the
// marker counts both come from this, so they can't disagree. Pure over the
// day's bookings (any list; it picks out this room's), so one
// listBookingsForBuilding() call covers a whole building. A static "closed"
// room stays closed, and outside opening hours every room counts as closed.
export function roomLiveStatus(room: Room, bookingsForDay: Booking[], time: string): LiveStatus {
  if (room.status === "closed") return { status: "closed", until: null, bookedBy: null };
  if (time < OPEN || time >= CLOSE) return { status: "closed", until: OPEN, bookedBy: null };

  const mine = bookingsForDay
    .filter((b) => b.roomId === room.id)
    .sort((a, b) => (a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0));

  const current = mine.find((b) => b.startTime <= time && time < b.endTime);
  if (current) {
    // Walk forward through bookings that start the moment the last one ends.
    let until = current.endTime;
    for (const b of mine) {
      if (b.startTime <= until && b.endTime > until) until = b.endTime;
    }
    return { status: "busy", until, bookedBy: current.bookedBy };
  }

  const next = mine.find((b) => b.startTime > time);
  return { status: "available", until: next ? next.startTime : CLOSE, bookedBy: null };
}

// "HH:MM" <-> minutes since midnight. Times are always zero-padded, so they
// also compare correctly as plain strings.
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// A real "HH:MM" clock time on a half-hour boundary ("08:30", "22:00"), so
// impossible times like "08:60" or "08:90" are refused.
export function isSlotTime(time: string): boolean {
  return /^([01]\d|2[0-3]):(00|30)$/.test(time);
}

export function fromMinutes(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// Slot start times for one day: "08:00", "08:30", ... "21:30".
export function daySlots(): string[] {
  const slots: string[] = [];
  for (let t = toMinutes(OPEN); t < toMinutes(CLOSE); t += SLOT_MINUTES) slots.push(fromMinutes(t));
  return slots;
}

// "YYYY-MM-DD" plus n days. Done in UTC so no local timezone or daylight
// saving change can shift the result.
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// The dates that can be booked: today through today+13, Canberra time.
export function bookingWindow(now = canberraNow()): { first: string; last: string } {
  return { first: now.date, last: addDays(now.date, BOOKING_WINDOW_DAYS - 1) };
}

export type SlotState = "free" | "booked" | "closed" | "past";

export interface GridCell {
  start: string;
  end: string;
  state: SlotState;
}

export interface GridRow {
  room: Room;
  cells: GridCell[];
}

// One row per room, one cell per 30-minute slot. A slot is past once its end
// is at or before now (so the current slot stays bookable); every slot on an
// earlier date is past too. Pure over the booking list so it's easy to test.
export function buildingDayGrid(
  building: Building,
  date: string,
  bookingsForBuilding: Booking[],
  now = canberraNow(),
): GridRow[] {
  const slots = daySlots();
  return building.rooms.map((room) => {
    const roomBookings = bookingsForBuilding.filter((b) => b.roomId === room.id && b.date === date);
    const cells = slots.map((start): GridCell => {
      const end = fromMinutes(toMinutes(start) + SLOT_MINUTES);
      let state: SlotState = "free";
      if (room.status === "closed") state = "closed";
      else if (date < now.date || (date === now.date && end <= now.time)) state = "past";
      else if (roomBookings.some((b) => start < b.endTime && b.startTime < end)) state = "booked";
      return { start, end, state };
    });
    return { room, cells };
  });
}

export type RoomOptionKind = "match" | "later" | "none" | "closed";

export interface RoomOption {
  room: Room;
  // match: free for the whole asked-for window. later: busy then, but a gap
  // that long opens further into the day. none: no such gap left. closed: not
  // bookable at all.
  kind: RoomOptionKind;
  // What the Book button offers, plus every end the free run allows.
  offer?: { start: string; end: string; ends: string[] };
  // The whole free run the offer sits in.
  free?: { from: string; until: string };
}

// The quick-booking view of a day grid: for each room, can it be booked from
// `start` for `minutes`, and if not, what's the next gap that long? A window
// running past closing is cut back to closing. Pure over the grid.
export function roomOptions(grid: GridRow[], start: string, minutes: number): RoomOption[] {
  return grid.map(({ room, cells }): RoomOption => {
    if (room.status === "closed") return { room, kind: "closed" };
    const from = cells.findIndex((c) => c.start === start);
    if (from < 0) return { room, kind: "none" };
    const need = Math.min(Math.max(1, Math.round(minutes / SLOT_MINUTES)), cells.length - from);
    const free = (i: number) => cells[i]?.state === "free";

    for (let i = from; i + need <= cells.length; i++) {
      let fits = true;
      for (let j = i; j < i + need && fits; j++) fits = free(j);
      if (!fits) continue;
      let lo = i;
      while (free(lo - 1)) lo--;
      let hi = i + need - 1;
      while (free(hi + 1)) hi++;
      return {
        room,
        kind: i === from ? "match" : "later",
        offer: {
          start: cells[i].start,
          end: cells[i + need - 1].end,
          ends: cells.slice(i, hi + 1).map((c) => c.end),
        },
        free: { from: cells[lo].start, until: cells[hi].end },
      };
    }
    return { room, kind: "none" };
  });
}

// End-time choices for a booking starting at `start`: start+30, start+60, ...
// up to and including the room's next booking start or closing time. Empty if
// `start` itself is already booked.
export function validEnds(roomBookingsForDay: Booking[], start: string): string[] {
  if (roomBookingsForDay.some((b) => b.startTime <= start && start < b.endTime)) return [];
  const limit = roomBookingsForDay
    .map((b) => b.startTime)
    .filter((t) => t > start)
    .reduce((earliest, t) => (t < earliest ? t : earliest), CLOSE);
  const ends: string[] = [];
  for (let t = toMinutes(start) + SLOT_MINUTES; t <= toMinutes(limit); t += SLOT_MINUTES) ends.push(fromMinutes(t));
  return ends;
}
