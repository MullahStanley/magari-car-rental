"use client";

import { Suspense, useCallback, useMemo, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Center,
  Environment,
  Html,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import { Loader2 } from "lucide-react";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

const PAINT_COLORS = [
  { name: "Midnight Black", value: "#1a1a2e" },
  { name: "Pearl White", value: "#f5f5f5" },
  { name: "Racing Red", value: "#c41e3a" },
  { name: "Ocean Blue", value: "#1e3a5f" },
  { name: "Forest Green", value: "#2d5a27" },
  { name: "Champagne Gold", value: "#c9a96e" },
];

const BODY_MATERIAL_KEYWORDS = [
  "body",
  "paint",
  "car",
  "exterior",
  "shell",
  "chassis",
  "hood",
  "door",
  "fender",
  "bumper",
];

function ShowroomLoader() {
  return (
    <Html center>
      <div className="flex flex-col items-center gap-3 rounded-xl bg-background/90 px-6 py-4 shadow-lg backdrop-blur-sm">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">
          Loading 3D model…
        </p>
      </div>
    </Html>
  );
}

interface VehicleModelProps {
  url: string;
  color: string;
}

function VehicleModel({ url, color }: VehicleModelProps) {
  const { scene } = useGLTF(url);

  // Clone the scene only ONCE
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // Apply color changes dynamically without re-cloning
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        const mat = mesh.material as MeshStandardMaterial;
        const name = (mesh.name + (mat?.name ?? "")).toLowerCase();
        
        const isBody = BODY_MATERIAL_KEYWORDS.some((kw) => name.includes(kw));

        if (isBody && mat) {
          // Directly mutate the color vector of the existing material
          mat.color.set(color);
          mat.metalness = 0.6;
          mat.roughness = 0.3;
        }
      }
    });
  }, [clonedScene, color]);

  return (
    <Center>
      <primitive object={clonedScene as Group} />
    </Center>
  );
}

interface SceneProps {
  modelUrl: string;
  color: string;
}

function Scene({ modelUrl, color }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-3, 4, -2]} intensity={0.3} />
      <Suspense fallback={<ShowroomLoader />}>
        <VehicleModel url={modelUrl} color={color} />
        <Environment preset="city" />
      </Suspense>
      <OrbitControls
        enableZoom={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        autoRotate
        autoRotateSpeed={0.8}
      />
    </>
  );
}

interface VehicleShowroomProps {
  modelUrl: string;
  className?: string;
}

export function VehicleShowroom({ modelUrl, className }: VehicleShowroomProps) {
  const [color, setColor] = useState(PAINT_COLORS[0].value);

  const handleColorChange = useCallback((newColor: string) => {
    setColor(newColor);
  }, []);

  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 lg:flex-row lg:items-stretch",
        className
      )}
    >
      <div className="relative h-[320px] flex-1 overflow-hidden rounded-2xl bg-gradient-to-b from-muted/50 to-muted sm:h-[420px] lg:h-[500px]">
        <Canvas
          shadows
          camera={{ position: [4, 2, 4], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene modelUrl={modelUrl} color={color} />
        </Canvas>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 lg:w-56">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Paint Color
          </Label>
          <p className="mt-1 text-sm font-medium">
            {PAINT_COLORS.find((c) => c.value === color)?.name}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PAINT_COLORS.map((paint) => (
            <button
              key={paint.value}
              type="button"
              title={paint.name}
              aria-label={`Select ${paint.name}`}
              onClick={() => handleColorChange(paint.value)}
              className={cn(
                "aspect-square rounded-full border-2 transition-all hover:scale-110",
                color === paint.value
                  ? "border-primary ring-2 ring-primary ring-offset-2"
                  : "border-transparent"
              )}
              style={{ backgroundColor: paint.value }}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Drag to rotate · Colors apply to body panels
        </p>
      </div>
    </div>
  );
}
