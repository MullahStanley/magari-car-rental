"use client";

import { ShowroomWrapper } from "@/components/showroom/showroom-wrapper";

const DEMO_MODEL =
  "https://vazxmixjsiawhamofprs.supabase.co/storage/v1/object/public/models/car.glb";

export function HeroShowroom() {
  return <ShowroomWrapper modelUrl={DEMO_MODEL} />;
}