# Website reference

Palette and reusable assets for the ANU Room Finder layout. Full styles live in
`src/styles.css`; this is the quick lookup.

## Colour palette

ANU's brand set. Black and white carry the page; gold is a highlight, used
sparingly (nav accent, selected day, hover and focus outlines) — never as a large fill.

| Swatch | Value | Variable | Use |
|---|---|---|---|
| ⬛ | `#000000` | `--colour-black` | Nav bar, primary text, buttons |
| ⬜ | `#FFFFFF` | `--colour-white` | Page background, button/nav text |
| 🟨 | `#BE830E` | `--colour-gold` | Highlight only — nav underline, hover states, map building outline |
| 🟫 | `#F5EDDE` | `--colour-gold-tint` | Map background wash, booking form panel |
| ⬜ | `#333333` | `--colour-unigrey` | Body text, meta text |

Status colours (not brand colours — used only for room availability):

| Status | Text | Background |
|---|---|---|
| Available | `#1E6B3D` | `#E3F0E6` |
| Busy | `#A13324` | `#F3E2DE` |
| Closed | `#5A5A5A` | `#ECECEC` |
| Past (calendar only) | n/a | `#DCDCDC` (`--colour-past-bg`) |

In the calendar, booked cells are a hatch of the busy text colour over the busy
background, and closed cells mix the closed text colour into the closed
background so they sit darker than past cells.

## Asset dictionary

Reusable components, `src/components/`:

| Asset | File | Usage |
|---|---|---|
| Layout | `Layout.astro` | Page shell: nav bar + `<main>`. Every page wraps in this. Prop `fullBleed` drops main's column so the home map runs edge to edge. |
| RoomAvailabilityPanel | `RoomAvailabilityPanel.astro` | Home page side panel: one row per room from `/api/rooms.json` (status, `until`, `bookedBy` from `roomLiveStatus`), refetched on every open, with a Schedule booking link to the building page. |
| AvailabilityCalendar | `AvailabilityCalendar.astro` | A building's day: 14-day strip, legend, room-by-slot table and the one booking form. Props: `building`, `date`, optional `selectedRoomId` / `selectedStart`, optional `booked` (`roomId`/`start`/`end` from the no-JS redirect's `?booked=&from=&to=`, shown as a success message only if the room is in this building). Works as plain links and a form POST; JS fills the form in place and books via fetch. |

Shared CSS classes, `src/styles.css`:

| Class | Usage |
|---|---|
| `.site-nav` | Black nav bar with gold underline, used on every page. Fixed height `--nav-height`, one line |
| `.card-meta` | Small grey meta line (the building code on a building page) |
| `.campus-map` | The MapLibre campus map on the homepage, filling the viewport below the nav |
| `.map-help`, `.building-links` | Help section below the home map, and its plain text links to every building page |
| `.map-marker`, `.marker-pin`, `.marker-card` | Building marker (a link to the building page), its pin, and the hover/focus card (image placeholder, name, rooms available) |
| `.back-link` | "Back to campus map" link on a building page |
| `.day-strip`, `.day-link`, `.day-step` | Day picker above the calendar; the current day (`aria-current="date"`) is filled gold |
| `.calendar-legend`, `.legend-swatch` | Legend naming each slot state in text |
| `.calendar-wrap`, `.calendar` | The day table and its wrapper; only the wrapper scrolls sideways, and the room column is sticky (narrower, with wrapping names, under 40rem) |
| `.calendar-hint` | "Scroll sideways for later times" above the table, shown only under 40rem |
| `.skip-link` | "Skip to booking form" link before the table, off-screen until focused; jumps to `#book-section` |
| `.slot`, `.slot-free`, `.slot-booked`, `.slot-closed`, `.slot-past`, `.slot-selected` | Calendar cells: free is green with a gold outline on hover/focus/selected, booked is a red hatch, past mid grey, closed darker grey. The legend swatches reuse these classes |
| `.booking-form`, `.booking-summary`, `.booking-feedback` | The booking form under the calendar and its success/error message (an always-present live region, `tabindex="-1"` so it takes focus after a JS booking; a 409 adds a "Reload this day" link) |
| `.visually-hidden` | Text for screen readers only (half-hour headers, cell states) |

## Data

Building and room data (mock, for this prototype) lives in `src/lib/campus.ts`.
Each building has a list of rooms and an optional `lngLat` (GeoJSON
`[lng, lat]` order). Only buildings with a `lngLat` get a map marker; every
building appears in the list under the map and has its own building page.

Room lists for the three mapped buildings:

- **Chifley and Hancock**: names come from the ANU Library's group study
  room door signage PDFs, because LibCal (where the rooms are booked) needs an
  ANU login and isn't publicly readable. The Library says Chifley has 15
  bookable group rooms, but only 10 names can be verified, so only those 10
  are listed. Hancock has 9, all on Level 3. The signage is old, so either
  list may be incomplete.
- **Marie Reay**: 12 rooms (2.01 to 4.04), as specified by the product owner.
- Capacities are placeholders (6 in the libraries, 30 in Marie Reay); none are
  published.

Booking rules, set in `campus.ts` and shared by the calendar and the API:
rooms open 08:00 to 22:00 (a prototype constant, not real opening hours),
bookings are in 30-minute slots, and dates run from today to 13 days ahead
(14 days, Canberra time), following the Library's public booking pages.

## Map tiles

The map is MapLibre GL JS (`src/pages/index.astro`, style in
`src/lib/map-style.ts`) reading `public/maps/anu.pmtiles`, a self-hosted
extract of the Protomaps OpenStreetMap basemap. The app's own server provides
the file, so the map makes no third-party requests at runtime. The style
has no text labels, so it needs no glyph or sprite files. To regenerate it
with the [go-pmtiles](https://github.com/protomaps/go-pmtiles) CLI:

```sh
pmtiles extract https://build.protomaps.com/20260928.pmtiles public/maps/anu.pmtiles \
  --bbox=149.100,-35.292,149.138,-35.262 --maxzoom=15
```

Keep the bbox larger than the map's `maxBounds` so the edges never go blank.
Map data © OpenStreetMap contributors (ODbL), credited in the map's
attribution control.
