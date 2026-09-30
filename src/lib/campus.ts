// Static campus + room data for the availability prototype. A real system
// would read this from the DB (see schema.ts / drizzle) and update on a
// schedule; for this layout crit it's fixed so the map and room views have
// something real to render against.

export type RoomStatus = "available" | "busy" | "closed";

export interface Room {
  id: string;
  name: string;
  capacity: number;
  status: RoomStatus;
  note: string;
  // "Level 3"; only set where the room number tells us the floor.
  level?: string;
}

export interface Building {
  id: string;
  code: string;
  name: string;
  // GeoJSON [lng, lat]; only buildings with one get a marker on the map.
  lngLat?: [number, number];
  // Path under public/ for the marker hover card photo; optional.
  image?: string;
  // Path under public/ for a floor plan image shown on the booking page;
  // only the Library buildings have a public one.
  floorplan?: string;
  rooms: Room[];
}

// Bookable hours and rules shared by the calendar grid and the booking API.
// The two-week window and 30-minute slots follow the Library's public
// booking pages; the opening hours are a prototype constant.
export const OPEN = "08:00";
export const CLOSE = "22:00";
export const SLOT_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 14;

// Builds a room list from room numbers like "3.04": id "<prefix>-3-04",
// name "<label> 3.04", note "Level 3". Capacity isn't published anywhere,
// so callers pass a placeholder.
function numberedRooms(prefix: string, label: string, capacity: number, numbers: string[]): Room[] {
  return numbers.map((n): Room => ({
    id: `${prefix}-${n.replace(".", "-")}`,
    name: `${label} ${n}`,
    capacity,
    status: "available",
    note: `Level ${n.split(".")[0]}`,
    level: `Level ${n.split(".")[0]}`,
  }));
}

export const BUILDINGS: Building[] = [
  {
    id: "chifley",
    code: "Bldg 15",
    name: "Chifley Library",
    lngLat: [149.1203952, -35.2779988],
    image: "/img/chifley.jpg",
    floorplan: "/img/chifley-floorplan.jpg",
    // Names from the Library's group study room door signage. The Library
    // says Chifley has 15 bookable group rooms, but only these 10 names are
    // publicly verifiable (LibCal needs an ANU login). Capacity 6 is a
    // placeholder.
    rooms: numberedRooms("chifley", "Group Study Room", 6, [
      "3.04", "3.05", "3.06", "3.07", "3.19", "4.02", "4.05", "4.06", "4.07", "4.17",
    ]),
  },
  {
    id: "hancock",
    code: "Bldg 43",
    name: "Hancock Library",
    lngLat: [149.1177754, -35.2769518],
    image: "/img/hancock.jpg",
    floorplan: "/img/hancock-floorplan.jpg",
    // From the Library's door signage, all on Level 3. Capacity 6 is a
    // placeholder.
    rooms: numberedRooms("hancock", "Group Study Room", 6, [
      "3.27", "3.28", "3.29", "3.33", "3.34", "3.36", "3.37", "3.38", "3.39",
    ]),
  },
  {
    id: "csit",
    code: "Bldg 108",
    name: "CSIT Building",
    rooms: [
      { id: "csit-n101", name: "N101 Tutorial Room", capacity: 30, status: "busy", note: "Class until 16:00" },
      { id: "csit-lab2", name: "Lab 2.02", capacity: 24, status: "available", note: "Free now" },
      { id: "csit-lab3", name: "Lab 2.03", capacity: 24, status: "available", note: "Free now" },
    ],
  },
  {
    id: "union-court",
    code: "Union Ct",
    name: "Union Court",
    rooms: [
      { id: "uc-quiet", name: "Quiet Corner", capacity: 15, status: "available", note: "Free now" },
      { id: "uc-bookable", name: "Bookable Room 1", capacity: 10, status: "busy", note: "Booked until 14:30" },
    ],
  },
  {
    id: "coombs",
    code: "Bldg 9",
    name: "Coombs Building",
    rooms: [
      { id: "coombs-1120", name: "Seminar Room 1120", capacity: 25, status: "available", note: "Free now" },
      { id: "coombs-1130", name: "Seminar Room 1130", capacity: 25, status: "closed", note: "Not bookable" },
    ],
  },
  {
    id: "marie-reay",
    code: "Bldg 155",
    name: "Marie Reay Teaching Centre",
    lngLat: [149.1209577, -35.2776794],
    image: "/img/marie-reay.jpg",
    // Capacity 30 is a placeholder.
    rooms: numberedRooms("marie-reay", "Room", 30, [
      "2.01", "2.02", "2.03", "2.04", "3.01", "3.02", "3.03", "3.04", "4.01", "4.02", "4.03", "4.04",
    ]),
  },
  {
    id: "copland",
    code: "Bldg 24",
    name: "Copland Building",
    lngLat: [149.1224446, -35.2778173],
    image: "/img/copland.jpg",
    rooms: [
      { id: "copland-g30", name: "G30 Study Room", capacity: 12, status: "available", note: "Free now" },
      { id: "copland-g31", name: "G31 Study Room", capacity: 12, status: "busy", note: "Booked until 17:00" },
    ],
  },
  {
    id: "menzies",
    code: "Bldg 2",
    name: "R.G. Menzies Library",
    lngLat: [149.1181285, -35.2821554],
    image: "/img/menzies.jpg",
    floorplan: "/img/menzies-floorplan.jpg",
    // Placeholder room list; no public door-signage source found yet.
    rooms: [
      { id: "menzies-g01", name: "Group Study Room G01", capacity: 6, status: "available", note: "Free now" },
      { id: "menzies-g02", name: "Group Study Room G02", capacity: 6, status: "available", note: "Free now" },
    ],
  },
  {
    id: "birch",
    code: "Bldg 35",
    name: "Birch Building",
    lngLat: [149.1193497, -35.2743674],
    image: "/img/birch.jpg",
    // Placeholder room list; no public door-signage source found yet.
    rooms: [
      { id: "birch-lt1", name: "Lecture Theatre 1", capacity: 80, status: "available", note: "Free now" },
      { id: "birch-t101", name: "Tutorial Room 101", capacity: 20, status: "available", note: "Free now" },
    ],
  },
];

export function getBuilding(id: string): Building | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

export function statusLabel(status: RoomStatus): string {
  switch (status) {
    case "available":
      return "Available";
    case "busy":
      return "Busy";
    case "closed":
      return "Closed";
  }
}
