// Stored times are 24-hour "HH:MM"; people read "4:00 PM". Pure and
// dependency-free so the browser scripts can import it too.
export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}
