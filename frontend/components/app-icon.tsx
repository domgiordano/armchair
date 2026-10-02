import Image from "next/image";

import type { App, AppId } from "@armchair/app-core/apps";

import { ShowIcon } from "@/components/show-icon";

interface AppIconProps {
  id: AppId;
  size?: number;
  locked?: boolean;
}

/** An Armchair app's icon: the chair mark for the hub, the show's own tile for the rest. Decorative. */
export function AppIcon({ id, size = 44, locked = false }: AppIconProps) {
  if (id !== "hub") return <ShowIcon show={id} size={size} locked={locked} />;
  return (
    <Image
      src="/brand/mark-96.png"
      alt=""
      width={size}
      height={size}
      unoptimized
      style={{ borderRadius: size * 0.225 }}
      className="shrink-0"
    />
  );
}

/** What a row says about an app, from this site's point of view. */
export function appNote(app: App): string {
  if (app.id === "dwts") return "You're here";
  if (app.id === "hub") return "Every show, one account";
  return app.url ? "Live now" : "Coming soon";
}
