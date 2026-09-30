import type { APIRoute } from "astro";
import { getBuilding } from "../../lib/campus";
import { canberraNow, listBookingsForBuilding, roomLiveStatus } from "../../lib/bookings";

// Live room status for a building at a given date/time, for the home page's
// room panel. `date`/`time` default to "now" (computed server-side) so the
// panel doesn't have to know the current time itself. Each room carries
// `status`, `until` ("HH:MM" or null) and `bookedBy` (null unless busy), from
// roomLiveStatus. Never cached, so a new booking shows on the next open.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const GET: APIRoute = ({ url }) => {
  const buildingId = url.searchParams.get("building");
  if (!buildingId) {
    return new Response(JSON.stringify({ error: "building is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const building = getBuilding(buildingId);
  if (!building) {
    return new Response(JSON.stringify({ error: "building not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Empty values (e.g. `?time=`) count as absent and fall back to now.
  const dateParam = url.searchParams.get("date") || null;
  const timeParam = url.searchParams.get("time") || null;
  if (dateParam !== null && !DATE_RE.test(dateParam)) {
    return new Response(JSON.stringify({ error: "date must be YYYY-MM-DD" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Any real clock time, not just slot starts: the panel asks about "now".
  if (timeParam !== null && !TIME_RE.test(timeParam)) {
    return new Response(JSON.stringify({ error: "time must be HH:MM" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = canberraNow();
  const date = dateParam ?? now.date;
  const time = timeParam ?? now.time;

  const dayBookings = listBookingsForBuilding(building.id, date);
  const rooms = building.rooms.map((room) => ({
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    ...roomLiveStatus(room, dayBookings, time),
  }));

  return new Response(JSON.stringify({ rooms }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
