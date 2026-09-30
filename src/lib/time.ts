// Stored times are 24-hour "HH:MM"; people read "4:00 PM". Pure and
// dependency-free so the browser scripts can import it too.
export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

// "4:00–5:00 PM", or "11:30 AM–1:00 PM" when the range crosses noon.
export function formatRange12(start: string, end: string): string {
  const [from, fromSuffix] = formatTime12(start).split(" ");
  const to = formatTime12(end);
  return to.endsWith(fromSuffix) ? `${from}–${to}` : `${from} ${fromSuffix}–${to}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
