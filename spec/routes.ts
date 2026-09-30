// The routes the invariants run against. When you add a page, add its route
// here, or the invariants stop covering it.

// Canberra tomorrow, worked out at test time so the prefilled-form route
// always sits inside the two-week booking window.
const canberraToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
const tomorrow = new Date(`${canberraToday}T00:00:00Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

export const ROUTES = [
  "/",
  "/readme/",
  "/building/chifley/",
  "/building/hancock/",
  "/building/marie-reay/",
  // A free cell picked, so the booking form renders filled in.
  `/building/chifley/?date=${tomorrow.toISOString().slice(0, 10)}&room=chifley-3-04&start=10:00`,
];
