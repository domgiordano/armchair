import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Tabs } from "./tabs";

const TABS = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Bravo", badge: 2 },
  { id: "c", label: "Charlie" },
] as const;

function Harness() {
  const [tab, setTab] = useState<"a" | "b" | "c">("a");
  return <Tabs label="Pick" tabs={TABS} value={tab} onChange={setTab} panelId="p" />;
}

const tab = (name: string | RegExp) => screen.getByRole("tab", { name });

describe("Tabs", () => {
  it("keeps one tab in the tab order and names a badge as waiting", () => {
    render(<Harness />);
    expect(tab("Alpha").tabIndex).toBe(0);
    expect(tab("Bravo, 2 waiting").tabIndex).toBe(-1);
    expect(tab("Alpha").getAttribute("aria-controls")).toBe("p");
  });

  it("selects and focuses with the arrows, wrapping, and with Home and End", () => {
    render(<Harness />);
    tab("Alpha").focus();
    fireEvent.keyDown(tab("Alpha"), { key: "ArrowLeft" });
    expect(tab("Charlie").getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tab("Charlie"));

    fireEvent.keyDown(tab("Charlie"), { key: "ArrowRight" });
    expect(document.activeElement).toBe(tab("Alpha"));
    fireEvent.keyDown(tab("Alpha"), { key: "End" });
    expect(tab("Charlie").getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tab("Charlie"), { key: "Home" });
    expect(tab("Alpha").getAttribute("aria-selected")).toBe("true");
  });
});
