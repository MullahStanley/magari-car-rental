"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const VehicleShowroom = dynamic(
  () =>
    import("@/components/showroom/vehicle-showroom").then(
      (mod) => mod.VehicleShowroom
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] items-center justify-center rounded-2xl bg-muted sm:h-[420px] lg:h-[500px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
  }
);

interface ShowroomWrapperProps {
  modelUrl: string;
  className?: string;
}

export function ShowroomWrapper({ modelUrl, className }: ShowroomWrapperProps) {
  return <VehicleShowroom modelUrl={modelUrl} className={className} />;
}