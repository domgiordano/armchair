import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar, initials } from "./avatar";

describe("initials", () => {
  it.each([
    ["Dominick Giordano", "DG"],
    ["  ada   lovelace  ", "AL"],
    ["Mary Ann Evans", "ME"],
    ["Cher", "C"],
    ["Émile Zola", "ÉZ"],
  ])("%s -> %s", (name, expected) => {
    expect(initials(name, "x@example.com")).toBe(expected);
  });

  it("falls back to the email when there is no name", () => {
    expect(initials(null, "viewer@example.com")).toBe("V");
    expect(initials("   ", "viewer@example.com")).toBe("V");
  });
});

describe("Avatar", () => {
  const photo = "https://lh3.googleusercontent.com/a/photo";

  it("shows the Google photo when there is one", () => {
    render(<Avatar name="Ada Lovelace" email="ada@example.com" picture={photo} />);
    const img = screen.getByRole("img", { name: "Ada Lovelace" });
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBe(photo);
  });

  it("draws initials when there is no photo", () => {
    render(<Avatar name="Ada Lovelace" email="ada@example.com" picture={null} />);
    const avatar = screen.getByRole("img", { name: "Ada Lovelace" });
    expect(avatar.tagName).toBe("SPAN");
    expect(avatar.textContent).toBe("AL");
  });

  it("falls back to initials when the photo fails to load", () => {
    render(<Avatar name="Ada Lovelace" email="ada@example.com" picture={photo} />);
    fireEvent.error(screen.getByRole("img", { name: "Ada Lovelace" }));
    expect(screen.getByRole("img", { name: "Ada Lovelace" }).textContent).toBe("AL");
  });

  it("labels itself with the email when there is no name", () => {
    render(<Avatar name={null} email="ada@example.com" picture={null} />);
    expect(screen.getByRole("img", { name: "ada@example.com" }).textContent).toBe("A");
  });
});
