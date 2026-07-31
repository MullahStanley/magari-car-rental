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
  return <VehicleShowroomInner modelUrl={modelUrl} />;
}
