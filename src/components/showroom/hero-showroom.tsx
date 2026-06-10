"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

const VehicleShowroom = dynamic(
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

const DEMO_MODEL =
  "https://vazxmixjsiawhamofprs.supabase.co/storage/v1/object/public/models/car.glb";

export function HeroShowroom() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[400px] items-center justify-center rounded-2xl bg-muted">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <VehicleShowroom modelUrl={DEMO_MODEL} />
    </Suspense>
  );
}
