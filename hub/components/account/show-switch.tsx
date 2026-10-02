"use client";

import type { Edition } from "@/lib/api/traitors";

import { Segmented, step } from "./ui";

export type HubShow = "dwts" | "tus" | "tuk";

/** The Traitors editions behind each switch position. UK covers the celebrity edition too. */
export const EDITIONS: Record<Exclude<HubShow, "dwts">, Edition[]> = { tus: ["tus"], tuk: ["tuk", "tukc"] };

const OPTIONS: { value: HubShow; label: string }[] = [
  { value: "dwts", label: "DWTS" },
  { value: "tus", label: "Traitors US" },
  { value: "tuk", label: "Traitors UK" },
];

export function ShowSwitch({ value, onChange }: { value: HubShow; onChange: (show: HubShow) => void }) {
  return (
    <div className="rise mt-6" style={step(0)}>
      <Segmented label="Show" options={OPTIONS} value={value} onChange={onChange} />
    </div>
  );
}
