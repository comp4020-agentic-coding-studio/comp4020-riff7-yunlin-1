import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// The homepage map's promises: markers for the mapped buildings that link to
// their building pages, availability counts that reflect live bookings and
// match the room panel, a Help section below the map, and tiles served by
// this app (range requests included) rather than a third-party tile service.
const baseUrl = inject("baseUrl");

interface MarkerData {
  id: string;
  lngLat: [number, number];
  total: number;
  available: number;
}

const loadHome = async () => {
  const res = await fetch(new URL("/", baseUrl));
  expect(res.status).toBe(200);
  const doc = new JSDOM(await res.text()).window.document;
  const map = doc.getElementById("campus-map");
  expect(map, "expected a #campus-map container on /").not.toBeNull();
  const markers = JSON.parse(map!.getAttribute("data-markers") ?? "[]") as MarkerData[];
  return { doc, markers };
};

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
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
};

// The 30-minute slot containing "now", e.g. 14:17 -> 14:00-14:30.
const pad = (n: number) => String(n).padStart(2, "0");
const currentSlot = (now: ReturnType<typeof canberraNow>) => {
  const startMin = now.hour * 60 + (now.minute < 30 ? 0 : 30);
  const endMin = startMin + 30;
  return {
    start: `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`,
    end: `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`,
  };
};

const NOW = canberraNow();

describe("campus map", () => {
  it("has a marker for each mapped building, each with a building page", async () => {
    const { markers } = await loadHome();
    const ids = markers.map((m) => m.id).sort();
    expect(ids).toEqual(["birch", "chifley", "copland", "hancock", "marie-reay", "menzies"]);
    for (const m of markers) {
      expect(m.lngLat).toHaveLength(2);
      const page = await fetch(new URL(`/building/${m.id}/`, baseUrl), { redirect: "manual" });
      expect(page.status, `/building/${m.id}/`).toBe(200);
    }
  });

  it("puts one Help section after the map, with the building links in it", async () => {
    const { doc } = await loadHome();
    const help = doc.getElementById("help");
    expect(help, "expected a #help section on /").not.toBeNull();
    expect(help!.querySelector("h2")?.textContent?.trim()).toBe("Help");
    const map = doc.getElementById("campus-map")!;
    // DOCUMENT_POSITION_FOLLOWING: the help section comes after the map.
    expect(map.compareDocumentPosition(help!) & 4).toBeTruthy();
    expect(help!.querySelectorAll(".building-links a").length).toBeGreaterThan(0);
    expect(doc.querySelector(".map-legend"), "legend copy now lives in Help").toBeNull();
  });

  // The full-screen map hides the Help section below the fold, so a plain
  // link over the map points to it (works without scripts).
  it("links to the Help section from over the map", async () => {
    const { doc } = await loadHome();
    const link = doc.querySelector<HTMLAnchorElement>('.map-overlay a[href="#help"]');
    expect(link, "expected a #help link in the map overlay").not.toBeNull();
    expect(link!.textContent?.trim()).toBeTruthy();
    expect(doc.querySelector("h1")?.classList.contains("visually-hidden")).toBe(true);
  });

  // The hover card and the room panel must tell the same story. Birch, as no
  // spec books there, so nothing shifts between the two requests.
  it("gives each marker the same free-room count as the room panel's API", async () => {
    const marker = (await loadHome()).markers.find((m) => m.id === "birch")!;
    const { rooms } = (await (await fetch(new URL("/api/rooms.json?building=birch", baseUrl))).json()) as {
      rooms: { status: string }[];
    };
    expect(marker.total).toBe(rooms.length);
    expect(marker.available).toBe(rooms.filter((r) => r.status === "available").length);
  });

  it("serves the map tiles itself, with range request support", async () => {
    const res = await fetch(new URL("/maps/anu.pmtiles", baseUrl), { headers: { range: "bytes=0-126" } });
    expect(res.status).toBe(206);
    const magic = new TextDecoder().decode((await res.arrayBuffer()).slice(0, 7));
    expect(magic).toBe("PMTiles");
  });

  it("loads no scripts, stylesheets or images from other origins", async () => {
    const { doc } = await loadHome();
    const urls = [
      ...[...doc.querySelectorAll("script[src]")].map((e) => e.getAttribute("src")!),
      ...[...doc.querySelectorAll('link[rel="stylesheet"][href]')].map((e) => e.getAttribute("href")!),
      ...[...doc.querySelectorAll("img[src]")].map((e) => e.getAttribute("src")!),
    ];
    for (const u of urls) {
      expect(new URL(u, baseUrl).origin, u).toBe(new URL(baseUrl).origin);
    }
  });

  // Rooms can only be booked 08:00-22:00 Canberra time, so outside those
  // hours there is no slot containing "now" to book and the claim can't be
  // exercised. The API's rules are still covered at any hour by booking.test.ts.
  it.skipIf(NOW.hour < 8 || NOW.hour >= 22)("drops a building's available count when one of its rooms is booked now", async () => {
    const before = (await loadHome()).markers.find((m) => m.id === "chifley")!;
    const res = await fetch(new URL("/api/bookings", baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({
        roomId: "chifley-3-04",
        buildingId: "chifley",
        bookedBy: "map spec probe",
        date: NOW.date,
        ...currentSlot(NOW),
      }),
    });
    expect(res.status).toBe(200);
    const after = (await loadHome()).markers.find((m) => m.id === "chifley")!;
    expect(after.available).toBe(before.available - 1);
  });
});
