import type { EpisodeState } from "@/lib/api/show";
import { closesOn } from "@/lib/show/window";

interface OrderNoteProps {
  state: Pick<EpisodeState, "runningOrder" | "orderSource" | "orderAt" | "orderFrom">;
  tz: string;
}

/** One line over the cards on where their order comes from, or that it isn't out yet. */
export function OrderNote({ state, tz }: OrderNoteProps) {
  const { runningOrder, orderSource, orderAt, orderFrom } = state;
  const when = orderAt ? ` at ${closesOn(orderAt, tz)}` : "";
  const text = !runningOrder
    ? orderFrom === "last-week"
      ? "Order not announced yet. Showing last week's order."
      : "Order not announced yet."
    : orderSource === "live"
      ? "Running order from the live show."
      : orderSource === "admin"
        ? `Running order confirmed by Armchair Judge${when}.`
        : `Running order confirmed via Wikipedia${when}.`;
  return <p className="text-sm text-silver-dim">{text}</p>;
}
