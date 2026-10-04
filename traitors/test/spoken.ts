/** An element's text as a screen reader gets it: a hooded portrait's stitched initials are aria-hidden. */
export function spoken(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
  return copy.textContent ?? "";
}
