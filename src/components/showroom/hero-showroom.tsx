"use client";

import { ShowroomWrapper } from "@/components/showroom/showroom-wrapper";
import { getModelUrl } from "@/lib/utils";

const HERO_MODEL = getModelUrl("models/tesla_model_x_2020.glb");

export function HeroShowroom() {
  return <ShowroomWrapper modelUrl={HERO_MODEL} />;
}
