import { expect, it } from "vitest";

import { cleanBio } from "./bio";

it("drops the respelling the extract left where the IPA was", () => {
  expect(cleanBio("Amol Rajan (, ə-MOHL; born 4 July 1983) is an Indian–British journalist.")).toBe(
    "Amol Rajan (born 4 July 1983) is an Indian–British journalist.",
  );
  expect(cleanBio("Bella Ramsey ( RAM-zee; born 25 September 2003) is an English actor.")).toBe(
    "Bella Ramsey (born 25 September 2003) is an English actor.",
  );
  expect(cleanBio("Myha'la (; born April 6, 1996) is an American actress.")).toBe(
    "Myha'la (born April 6, 1996) is an American actress.",
  );
  expect(cleanBio("Maya Jama ( MY-AH JAH-mə) (born 14 August 1994) is a presenter.")).toBe(
    "Maya Jama (born 14 August 1994) is a presenter.",
  );
});

it("keeps the brackets a writer meant, and drops citation marks", () => {
  const text = "Richard E. Grant (born Richard Grant Esterhuysen; 5 May 1957) starred in Withnail (1987).";
  expect(cleanBio(text)).toBe(text);
  expect(cleanBio("She hosted it (2013; 2016–2017).[3] Then QI.[citation needed]")).toBe(
    "She hosted it (2013; 2016–2017). Then QI.",
  );
});
