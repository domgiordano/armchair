import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Contestant, SegmentCall } from "@/lib/api/show";
import { SegmentCalls } from "./segment-call";

const couple = (id: string, celebrity: string): Contestant => ({
  id,
  keyword: celebrity,
  members: [
    { name: celebrity, role: "celebrity", headshot: null },
    { name: "A Pro", role: "pro", headshot: null },
  ],
});
const COUPLES = [couple("amber-glenn", "Amber Glenn"), couple("connor-wood", "Connor Wood"), couple("jenna-dewan", "Jenna Dewan")];
const TZ = "America/New_York";
const SHOWTIME = "2026-11-11T01:00Z";
const BEFORE = Date.parse(SHOWTIME) - 3_600_000;
const AFTER = Date.parse(SHOWTIME) + 60_000;
const DANCE_OFF: SegmentCall = { kind: "dance-off", limit: 2, picks: null, locksAt: SHOWTIME, open: true };
const MARATHON: SegmentCall = { kind: "marathon", limit: 1, picks: null, locksAt: SHOWTIME, open: true };

const renderCalls = (calls: SegmentCall[], { now = BEFORE, reveal = true, onCall = vi.fn(async () => {}) } = {}) => {
  render(<SegmentCalls calls={calls} couples={COUPLES} tz={TZ} now={now} reveal={reveal} onCall={onCall} />);
  return onCall;
};

describe("SegmentCalls", () => {
  it("locks in up to the limit of dance-off winners", async () => {
    const onCall = renderCalls([DANCE_OFF]);
    expect(screen.getByText(/Calls lock at showtime, Tue 8:00 PM/)).toBeTruthy();
    const lock = screen.getByRole("button", { name: "Lock in call" });
    expect((lock as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("checkbox", { name: "Amber Glenn" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Jenna Dewan" }));
    expect((screen.getByRole("checkbox", { name: "Connor Wood" }) as HTMLInputElement).disabled).toBe(true);

    fireEvent.click(lock);
    await waitFor(() => expect(onCall).toHaveBeenCalledWith("dance-off", ["amber-glenn", "jenna-dewan"]));
  });

  it("takes one marathon pick, and says why a failed call didn't stick", async () => {
    const onCall = renderCalls([MARATHON], { onCall: vi.fn(async () => Promise.reject(new Error("calls have closed"))) });
    expect(screen.getByRole("group", { name: "Marathon call" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Connor Wood" }));
    fireEvent.click(screen.getByRole("radio", { name: "Amber Glenn" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock in call" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Not saved: calls have closed");
    expect(onCall).toHaveBeenCalledWith("marathon", ["amber-glenn"]);
  });

  it("offers nothing until the night's couples are set", () => {
    renderCalls([{ ...DANCE_OFF, open: false }]);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("Dance-off call")).toBeNull();
  });

  it("says no call was made once showtime passes", () => {
    renderCalls([{ ...DANCE_OFF, open: false }], { now: AFTER });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("No call made")).toBeTruthy();
  });

  it("shows the caller's call, and how it did only once the results may show", () => {
    const made: SegmentCall = { ...DANCE_OFF, picks: ["amber-glenn", "connor-wood"], outcome: { hits: 1, winners: 2 } };
    const { unmount } = render(
      <SegmentCalls calls={[made]} couples={COUPLES} tz={TZ} now={AFTER} reveal={false} onCall={vi.fn()} />,
    );
    expect(screen.getByText("Amber Glenn, Connor Wood")).toBeTruthy();
    expect(screen.queryByText(/You called/)).toBeNull();
    unmount();

    renderCalls([made, { ...MARATHON, picks: ["jenna-dewan"], outcome: { place: 2, of: 3 } }]);
    expect(screen.getByText("You called 1 of 2 dance-off winners")).toBeTruthy();
    expect(screen.getByText("Your pick finished 2nd of 3 in the marathon")).toBeTruthy();
  });
});
