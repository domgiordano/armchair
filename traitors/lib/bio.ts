// Wikipedia's plain-text extracts drop the IPA and audio spans but keep what was
// around them, so "Amol Rajan (/əˈməʊl/, ə-MOHL; born 4 July 1983)" arrives as
// "(, ə-MOHL; born 4 July 1983)". A parenthetical that opens on a comma, a
// semicolon or a space lost its first part that way: the rest of that part, up to
// the first semicolon, is a respelling. Nothing a person writes opens a bracket so.
const MANGLED = /\s*\(([\s,;][^()]*)\)/g;
const CITATION = /\[(?:\d+|[a-z]|citation needed|note \d+)\]/g;

/** A wiki bio's text with the extract's pronunciation leftovers and citation marks taken out. */
export function cleanBio(text: string): string {
  return text
    .replace(MANGLED, (_, inner: string) => {
      const semi = inner.indexOf(";");
      const rest = semi < 0 ? "" : inner.slice(semi + 1).trim();
      return rest ? ` (${rest})` : "";
    })
    .replace(CITATION, "")
    .replace(/ {2,}/g, " ");
}
