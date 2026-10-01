import { fireEvent, screen } from "@testing-library/react";

/** Opens a custom Select and clicks the named option, as a user would. */
export function choose(combobox: HTMLElement, option: string | RegExp) {
  fireEvent.click(combobox);
  fireEvent.click(screen.getByRole("option", { name: option }));
}
