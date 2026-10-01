import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Select } from "./select";

const OPTIONS = [
  { value: "rumba", label: "Rumba" },
  { value: "foxtrot", label: "Foxtrot" },
  { value: "tango", label: "Tango" },
  { value: "tango-ar", label: "Argentine tango" },
  { value: "jive", label: "Jive" },
];

const changes = vi.fn();

function Harness({ initial = "foxtrot" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <Select
        label="Style"
        value={value}
        options={OPTIONS}
        onChange={(v) => {
          changes(v);
          setValue(v);
        }}
      />
      <button type="button">after</button>
    </>
  );
}

const combo = () => screen.getByRole("combobox", { name: "Style" });
const active = () => {
  const id = combo().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent : null;
};
const key = (k: string, init: object = {}) => fireEvent.keyDown(combo(), { key: k, ...init });

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("Select", () => {
  it("shows the chosen label and stays closed until asked", () => {
    render(<Harness />);
    expect(combo().textContent).toBe("Foxtrot");
    expect(combo().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens on ArrowDown with the selected option active, and moves with the arrows, Home and End", () => {
    render(<Harness />);
    combo().focus();
    key("ArrowDown");
    expect(combo().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("listbox", { name: "Style" })).toBeTruthy();
    expect(active()).toBe("Foxtrot");
    expect(screen.getByRole("option", { name: "Foxtrot" }).getAttribute("aria-selected")).toBe("true");

    key("ArrowDown");
    expect(active()).toBe("Tango");
    key("ArrowUp");
    key("ArrowUp");
    expect(active()).toBe("Rumba");
    key("ArrowUp");
    expect(active()).toBe("Rumba");
    key("End");
    expect(active()).toBe("Jive");
    key("Home");
    expect(active()).toBe("Rumba");
    expect(document.activeElement).toBe(combo());
  });

  it("picks the active option with Enter and closes", () => {
    render(<Harness />);
    key("Enter");
    key("ArrowDown");
    key("Enter");
    expect(changes).toHaveBeenCalledWith("tango");
    expect(combo().textContent).toBe("Tango");
    expect(combo().getAttribute("aria-expanded")).toBe("false");
  });

  it("picks with Space too, and Escape closes without changing anything", () => {
    render(<Harness />);
    key(" ");
    key("ArrowDown");
    key("Escape");
    expect(combo().getAttribute("aria-expanded")).toBe("false");
    expect(changes).not.toHaveBeenCalled();

    key(" ");
    key("End");
    key(" ");
    expect(changes).toHaveBeenCalledWith("jive");
  });

  it("does not report a change when the current option is picked again", () => {
    render(<Harness />);
    key("Enter");
    key("Enter");
    expect(changes).not.toHaveBeenCalled();
  });

  it("jumps by typeahead while open, and picks directly while closed", () => {
    vi.useFakeTimers();
    render(<Harness />);
    key("ArrowDown");
    key("a");
    expect(active()).toBe("Argentine tango");
    key("Escape");
    vi.advanceTimersByTime(700);

    key("j");
    expect(changes).toHaveBeenLastCalledWith("jive");
    expect(combo().getAttribute("aria-expanded")).toBe("false");
  });

  it("cycles through options sharing a first letter when the letter repeats", () => {
    vi.useFakeTimers();
    render(<Harness initial="rumba" />);
    key("ArrowDown");
    key("t");
    expect(active()).toBe("Tango");
    key("t");
    expect(active()).toBe("Tango");
    vi.advanceTimersByTime(700);
    key("f");
    expect(active()).toBe("Foxtrot");
  });

  it("matches a typed prefix across keystrokes", () => {
    render(<Harness initial="rumba" />);
    key("ArrowDown");
    key("f");
    key("o");
    expect(active()).toBe("Foxtrot");
  });

  it("picks the active option when Tab leaves", () => {
    render(<Harness />);
    key("ArrowDown");
    key("ArrowDown");
    key("Tab");
    expect(changes).toHaveBeenCalledWith("tango");
    expect(combo().getAttribute("aria-expanded")).toBe("false");
  });

  it("picks with a click and returns focus to the button", () => {
    render(<Harness />);
    fireEvent.click(combo());
    fireEvent.click(screen.getByRole("option", { name: "Rumba" }));
    expect(changes).toHaveBeenCalledWith("rumba");
    expect(document.activeElement).toBe(combo());
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on a pointer press outside", () => {
    render(<Harness />);
    fireEvent.click(combo());
    fireEvent.pointerDown(screen.getByRole("button", { name: "after" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
