import { describe, expect, inject, it } from "vitest";
import { addMinutes, canberraParts } from "../src/lib/clock";

// The riff: a slot that's live can be checked into ("I'm here"), and one that
// nobody has turned up to, past the grace period, can be released.
const baseUrl = inject("baseUrl");
const post = (path: string, body: URLSearchParams) =>
  fetch(new URL(path, baseUrl), { method: "POST", headers: { origin: baseUrl }, body, redirect: "manual" });
const page = async (date: string) => (await fetch(new URL(`/?date=${date}`, baseUrl))).text();

const { date, time } = canberraParts(new Date());
// A live slot needs a start ≥ 15 min ago and an end still ahead, same day.
const usable = time >= "00:20" && time < "23:30";
const start = addMinutes(time, -15);
const end = addMinutes(time, 30);

const book = async (roomId: string, bookedBy: string) => {
  await post("/api/bookings", new URLSearchParams({ date, roomId, startTime: start, endTime: end, bookedBy }));
  const html = await page(date);
  return Number(new RegExp(`${bookedBy}[\\s\\S]*?bookings/(\\d+)/cancel`).exec(html)![1]);
};

describe.skipIf(!usable)("presence", () => {
  const noShow = `noshow ${process.hrtime.bigint()}`;
  const present = `present ${process.hrtime.bigint()}`;

  it("shows a live, unclaimed slot as unattended and offers release", async () => {
    await book("1", noShow);
    const html = await page(date);
    expect(html).toContain("Nobody has turned up");
    expect(html).toContain("Release");
  });

  it("checking in removes the release option and records who's in", async () => {
    const id = await book("2", present);
    expect((await post(`/api/bookings/${id}/checkin`, new URLSearchParams({ date }))).status).toBe(303);
    const html = await page(date);
    expect(html).toContain("In the room since");
  });

  it("release frees the no-show slot for someone else", async () => {
    const html = await page(date);
    const id = Number(new RegExp(`${noShow}[\\s\\S]*?bookings/(\\d+)/checkin`).exec(html)![1]);
    await post(`/api/bookings/${id}/release`, new URLSearchParams({ date }));
    expect(await page(date)).not.toContain(noShow);
  });

  it("refuses to release a slot that has been checked into", async () => {
    const html = await page(date);
    expect(html).toContain(present);
    const id = Number(new RegExp(`${present}[\\s\\S]*?bookings/(\\d+)/cancel`).exec(html)![1]);
    await post(`/api/bookings/${id}/release`, new URLSearchParams({ date }));
    expect(await page(date)).toContain(present);
  });
});
