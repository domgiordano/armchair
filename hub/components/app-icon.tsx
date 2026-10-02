import type { AppId } from "@armchair/app-core/apps";

import { ChairMark } from "@/components/chair-mark";
import { ShowIcon } from "@/components/show-icon";

interface AppIconProps {
  id: AppId;
  size?: number;
  locked?: boolean;
}

/** An Armchair app's icon: the chair on a tile for the hub, the show's own tile for the rest. Decorative. */
export function AppIcon({ id, size = 44, locked = false }: AppIconProps) {
  if (id !== "hub") return <ShowIcon show={id} size={size} locked={locked} />;
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: size * 0.225 }}
      className="flex shrink-0 items-center justify-center border border-line bg-night-2"
    >
      <ChairMark className="size-[78%]" />
    </span>
  );
}
