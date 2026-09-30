# Your prototype

This is a room-booking prototype for the ANU campus. A static SVG campus map
(`src/pages/index.astro`) shows a handful of buildings; clicking one opens its
building page (`src/pages/building/[id].astro`), which lists that building's
rooms from `src/lib/campus.ts` alongside a live availability status —
available, busy, or closed — computed against a SQLite `bookings` table
(`src/lib/schema.ts`, `src/lib/bookings.ts`). Visitors can filter the room
list by date, time, and status, and book any available room through a
right-hand booking panel (`src/components/BookingPanel.astro`).

## What good looks like here

We read the brief around a lightweight, no-account booking flow for shared
teaching spaces, and looked at how the starter already separated static
campus data (`campus.ts`) from live booking state (`schema.ts`/`bookings.ts`)
before deciding how far to take it. The core decision was to keep "room data"
and "booking data" separate: buildings, rooms, and their base status
(available/closed) are fixed data describing the campus, while bookings are
the only thing that changes a room's live status to busy. `roomLiveStatus` in
`src/lib/bookings.ts` is the single place that merges the two, so the map
markers and the room panel all agree on what "available" means
at a given date and time.

We chose to make the booking panel work both with and without JavaScript:
with JS it submits via `fetch` and updates the room list in place; without
JS, the same form posts to `src/pages/api/bookings.ts`, which does the same
validation and redirects back with a 303 so the page reflects the new
booking on reload. Rejecting overlapping bookings is enforced entirely
server-side in `isOverlapping`/`createBooking`, so a double-booking is
impossible to force through the UI, a stale page, or a replayed request —
this was a judgement call to put trust only in the server, not the client.

What we chose not to build: user accounts or authentication (bookings are
attributed to a free-text name), recurring bookings, editing or cancelling
an existing booking, and a real campus data feed — the building and room
list in `campus.ts` is static seed data rather than pulled from a live
source, which is called out in that file's own comment.

Some of this is enforced by `spec/`: `spec/routes.ts` lists every page the
invariants run against (so a route without a matching entry isn't checked at
all), and `spec/readme.test.ts` checks that this file is rendered in full at
`/readme/`. Other checks assert on route status codes and basic page
structure. What isn't spec-enforced, and was a judgement call instead, is the
UI/UX split above: which parts of the booking flow live client-side for a
snappier experience versus what must be re-validated on the server, and how
much of the campus map is worth modelling versus stubbing as static data for
this prototype.
