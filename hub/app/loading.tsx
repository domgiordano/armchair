import { ChairLoader } from "@/components/chair-loader";

export default function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <ChairLoader className="size-24" label="Loading" />
    </div>
  );
}
