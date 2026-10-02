import { appLink, type App } from "@armchair/app-core/apps";

/** Where an app's entry goes: home for this one, signed in for the others, nowhere before launch. */
export const appHref = (app: App): string | null => (app.id === "traitors" ? "/" : appLink(app.id));
