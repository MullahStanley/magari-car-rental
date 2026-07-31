"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const VehicleShowroomInner = dynamic(
  () =>
    import("@/components/showroom/vehicle-showroom").then(
      (mod) => mod.VehicleShowroom
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[400px] items-center justify-center rounded-2xl bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
  }
);

interface VehicleShowroomClientProps {
  modelUrl: string;
}

export function VehicleShowroomClient({ modelUrl }: VehicleShowroomClientProps) {
  // key={modelUrl} remounts the showroom per vehicle so per-model
  // preferences (paint color / zoom) are restored fresh for each car.
  return <VehicleShowroomInner key={modelUrl} modelUrl={modelUrl} />;
}
