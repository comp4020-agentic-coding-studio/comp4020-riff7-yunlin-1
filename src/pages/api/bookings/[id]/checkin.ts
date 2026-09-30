import type { APIRoute } from "astro";
import { canberraParts } from "../../../../lib/clock";
import { checkIn } from "../../../../lib/db";
import { bus } from "../../../../lib/events";

// Time is read on the server, in Canberra — the client only names the booking.
export const POST: APIRoute = async ({ params, request, redirect }) => {
  const id = Number(params.id);
  const form = await request.formData();
  const date = String(form.get("date") ?? "");
  if (Number.isInteger(id)) {
    const { date: today, time } = canberraParts(new Date());
    const changed = checkIn(id, today, time);
    if (changed) bus.emit("booking", { date: changed });
  }
  return redirect(`/?${new URLSearchParams({ date })}`, 303);
};
