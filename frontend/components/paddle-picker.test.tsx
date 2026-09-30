import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PaddlePicker } from "./paddle-picker";

const LABEL = "Tyler Cameron & Sharna Burgess";

function setup(onSubmit = vi.fn(async () => {}), airsOn: string | null = null) {
  render(<PaddlePicker label={LABEL} airsOn={airsOn} onSubmit={onSubmit} />);
  return onSubmit;
}

const paddle = (n: number) => screen.getByRole("button", { name: `Score ${n} for ${LABEL}` });

describe("PaddlePicker", () => {
  it("offers ten paddles", () => {
    setup();
    for (let n = 1; n <= 10; n++) expect(paddle(n)).toHaveProperty("disabled", false);
  });

  it("asks for a final confirm before sending a score", async () => {
    const onSubmit = setup();
    fireEvent.click(paddle(7));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Scores are final")).toBeTruthy();
    const lock = screen.getByRole("button", { name: "Lock in 7" });
    expect(document.activeElement).toBe(lock);

    fireEvent.click(lock);
    expect(onSubmit).toHaveBeenCalledWith({ value: 7 });
    expect(await screen.findByRole("button", { name: "Saving..." })).toHaveProperty("disabled", true);
  });

  it("goes back to the paddles on Change, focused on the one picked", () => {
    const onSubmit = setup();
    fireEvent.click(paddle(4));
    fireEvent.click(screen.getByRole("button", { name: "Change" }));

    expect(document.activeElement).toBe(paddle(4));
    fireEvent.click(paddle(9));
    fireEvent.click(screen.getByRole("button", { name: "Lock in 9" }));
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ value: 9 });
  });

  it("confirms a reveal without scoring as a forfeit", () => {
    const onSubmit = setup();
    fireEvent.click(screen.getByRole("button", { name: "Reveal without scoring" }));

    expect(screen.getByText("Reveal without scoring?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reveal" }));
    expect(onSubmit).toHaveBeenCalledWith({ forfeit: true });
  });

  it("can back out of a reveal", () => {
    const onSubmit = setup();
    fireEvent.click(screen.getByRole("button", { name: "Reveal without scoring" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Reveal without scoring" }));
  });

  it("shows a failed save and lets the same answer be retried", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("Network down")).mockResolvedValue(undefined);
    setup(onSubmit);
    fireEvent.click(paddle(6));
    fireEvent.click(screen.getByRole("button", { name: "Lock in 6" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Not saved: Network down");
    fireEvent.click(screen.getByRole("button", { name: "Lock in 6" }));
    expect(onSubmit).toHaveBeenLastCalledWith({ value: 6 });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("locks every paddle before the episode airs", () => {
    setup(vi.fn(), "Tue, Oct 13");
    expect(paddle(5)).toHaveProperty("disabled", true);
    expect(screen.getByText("Airs Tue, Oct 13")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reveal without scoring" })).toBeNull();
  });
});
