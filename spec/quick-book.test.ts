import { describe, expect, it, vi } from "vitest";
import { type GridRow, roomOptions } from "../src/lib/bookings";
import type { Room } from "../src/lib/campus";
import { formatDuration, formatRange12 } from "../src/lib/time";

// roomOptions turns a day grid into the room cards' answer to "can I book
// this room from `start` for this long, and if not, when next?". Pure over
// the grid, so no database: bookings.ts opens SQLite on import, hence the mock.
vi.mock("../src/lib/db", () => ({ db: {} }));

const room = (id: string, status: Room["status"] = "available"): Room => ({
  id,
  name: id,
  capacity: 6,
  status,
  note: "",
});

// One letter per half hour from 14:00: f free, b booked, p past, c closed.
const row = (r: Room, pattern: string): GridRow => ({
  room: r,
  cells: [...pattern].map((ch, i) => {
    const m = 14 * 60 + i * 30;
    const t = (x: number) => `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
    const state = ({ f: "free", b: "booked", p: "past", c: "closed" } as const)[ch as "f"];
    return { start: t(m), end: t(m + 30), state };
  }),
});

describe("roomOptions", () => {
  it("matches a room free for the whole window and reports its whole free run", () => {
    const [option] = roomOptions([row(room("a"), "pfffffbb")], "15:00", 60);
    expect(option.kind).toBe("match");
    expect(option.offer).toEqual({ start: "15:00", end: "16:00", ends: ["15:30", "16:00", "16:30", "17:00"] });
    expect(option.free).toEqual({ from: "14:30", until: "17:00" });
  });

  it("offers the next gap long enough when the room is busy at the start", () => {
    const [option] = roomOptions([row(room("a"), "fbbfbfff")], "14:00", 60);
    expect(option.kind).toBe("later");
    expect(option.offer).toEqual({ start: "16:30", end: "17:30", ends: ["17:00", "17:30", "18:00"] });
    expect(option.free).toEqual({ from: "16:30", until: "18:00" });
  });

  it("says none when no gap that long is left, and closed for a closed room", () => {
    const [none, closed] = roomOptions([row(room("a"), "fbfbfbfb"), row(room("b", "closed"), "cccccccc")], "14:00", 60);
    expect(none.kind).toBe("none");
    expect(none.offer).toBeUndefined();
    expect(closed.kind).toBe("closed");
  });

  it("cuts a window that runs past the last slot back to closing", () => {
    const [option] = roomOptions([row(room("a"), "bbbbbbff")], "17:00", 180);
    expect(option.kind).toBe("match");
    expect(option.offer?.end).toBe("18:00");
  });
});

describe("time labels", () => {
  it("formats ranges and durations for people", () => {
    expect(formatRange12("16:00", "17:00")).toBe("4:00–5:00 PM");
    expect(formatRange12("11:30", "13:00")).toBe("11:30 AM–1:00 PM");
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 hour");
    expect(formatDuration(90)).toBe("1.5 hours");
  });
});
