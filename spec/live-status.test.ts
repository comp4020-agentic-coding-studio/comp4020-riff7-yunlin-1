import { describe, expect, it, vi } from "vitest";
import { type Booking, roomLiveStatus } from "../src/lib/bookings";
import { CLOSE, OPEN, type Room } from "../src/lib/campus";
import { formatTime12 } from "../src/lib/time";

// roomLiveStatus is pure over the bookings it's handed, so these run without
// the database. bookings.ts imports db.ts, which opens SQLite and migrates on
// import; mocking it keeps this file away from .data/app.db.
vi.mock("../src/lib/db", () => ({ db: {} }));

const room: Room = { id: "r1", name: "Room 1", capacity: 6, status: "available", note: "" };

let nextId = 1;
const booking = (roomId: string, startTime: string, endTime: string, bookedBy = "Sam"): Booking => ({
  id: nextId++,
  roomId,
  buildingId: "b",
  bookedBy,
  date: "2026-10-01",
  startTime,
  endTime,
  createdAt: "2026-09-30 00:00:00",
});

describe("roomLiveStatus", () => {
  it("is free until the next booking starts", () => {
    const day = [booking("r1", "16:00", "17:00"), booking("r1", "18:00", "19:00")];
    expect(roomLiveStatus(room, day, "10:15")).toEqual({ status: "available", until: "16:00", bookedBy: null });
  });

  it("is free until closing when nothing else is booked today", () => {
    const day = [booking("r1", "08:00", "09:00"), booking("other", "11:00", "12:00")];
    expect(roomLiveStatus(room, day, "10:15")).toEqual({ status: "available", until: CLOSE, bookedBy: null });
  });

  it("is booked until the covering booking ends, by whoever holds it", () => {
    const day = [booking("r1", "10:00", "11:00", "Alex"), booking("r1", "14:00", "15:00")];
    expect(roomLiveStatus(room, day, "10:15")).toEqual({ status: "busy", until: "11:00", bookedBy: "Alex" });
  });

  it("counts the start of a booking as booked and its end as free", () => {
    const day = [booking("r1", "10:00", "11:00")];
    expect(roomLiveStatus(room, day, "10:00").status).toBe("busy");
    expect(roomLiveStatus(room, day, "11:00")).toEqual({ status: "available", until: CLOSE, bookedBy: null });
  });

  it("merges back-to-back bookings so until is when the room actually frees up", () => {
    // Deliberately out of order: callers may pass any list.
    const day = [
      booking("r1", "12:00", "12:30", "Kim"),
      booking("r1", "10:00", "11:00", "Alex"),
      booking("r1", "11:00", "12:00", "Jo"),
      booking("r1", "13:00", "14:00", "Lee"),
    ];
    expect(roomLiveStatus(room, day, "10:15")).toEqual({ status: "busy", until: "12:30", bookedBy: "Alex" });
  });

  it("keeps a statically closed room closed, with no until", () => {
    const closed: Room = { ...room, status: "closed" };
    expect(roomLiveStatus(closed, [], "10:15")).toEqual({ status: "closed", until: null, bookedBy: null });
  });

  it("ignores the decorative static busy status", () => {
    const decorated: Room = { ...room, status: "busy", note: "Booked until 14:30" };
    expect(roomLiveStatus(decorated, [], "10:15").status).toBe("available");
  });

  it("is closed until opening outside opening hours", () => {
    const day = [booking("r1", "08:00", "09:00")];
    expect(roomLiveStatus(room, day, "07:59")).toEqual({ status: "closed", until: OPEN, bookedBy: null });
    expect(roomLiveStatus(room, day, CLOSE)).toEqual({ status: "closed", until: OPEN, bookedBy: null });
    expect(roomLiveStatus(room, day, "01:20")).toEqual({ status: "closed", until: OPEN, bookedBy: null });
  });
});

describe("formatTime12", () => {
  it("renders 24-hour times as 12-hour clock text", () => {
    expect(formatTime12("00:30")).toBe("12:30 AM");
    expect(formatTime12("08:00")).toBe("8:00 AM");
    expect(formatTime12("12:00")).toBe("12:00 PM");
    expect(formatTime12("16:00")).toBe("4:00 PM");
    expect(formatTime12("22:00")).toBe("10:00 PM");
  });
});
