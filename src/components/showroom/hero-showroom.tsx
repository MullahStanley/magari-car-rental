"use client";

import { ShowroomWrapper } from "@/components/showroom/showroom-wrapper";

const HERO_MODEL = "/models/tesla_model_x_2020.glb";

export function HeroShowroom() {
  return <ShowroomWrapper modelUrl={HERO_MODEL} />;
}
