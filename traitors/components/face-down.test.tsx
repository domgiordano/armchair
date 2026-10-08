import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { sealCall } from "@/lib/sealed";

import { FaceDownBefore, FaceDownNotice } from "./face-down";

it("holds a later episode while an earlier one is face down, until it's revealed", () => {
  sealCall("tus-5", 3, "RT");
  sealCall("tus-4", 1, "RT");
  render(
    <FaceDownBefore season="tus-5" ep={4}>
      <p>The table</p>
    </FaceDownBefore>,
  );
  expect(screen.getByRole("heading", { name: "Episode 3 is still face down" })).toBeTruthy();
  expect(screen.queryByText("The table")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal episode 3" }));
  expect(screen.getByText("The table")).toBeTruthy();
});

it("doesn't hold an episode for a face-down call in a later one, and the notice reveals its episode", () => {
  sealCall("tus-5", 6, "MURDER");
  render(
    <>
      <FaceDownBefore season="tus-5" ep={4}>
        <p>Episode 4</p>
      </FaceDownBefore>
      <FaceDownNotice season="tus-5" ep={6} what="The board" />
    </>,
  );
  expect(screen.getByText("Episode 4")).toBeTruthy();
  expect(screen.getByText(/The board would give away episode 6/)).toBeTruthy();
  act(() => screen.getByRole("button", { name: "Reveal episode 6" }).click());
  expect(localStorage.getItem("armchair.traitors.sealed")).toBe("[]");
});
