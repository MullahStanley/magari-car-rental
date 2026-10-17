"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentRef, RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Center,
  Environment,
  Html,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import { Loader2, Maximize } from "lucide-react";
import { Box3, Vector3 } from "three";
import type { Group, Mesh, MeshStandardMaterial } from "three";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

// Target max dimension for every model after normalization. The GLB files
// are authored at wildly different unit scales (some ~0.04 units, some
// ~23 units), which makes some cars invisible dots and others too big for
// the camera. Normalizing to this size makes them all fit the viewport.
const NORMALIZED_MODEL_SIZE = 5;

// Camera-distance zoom bounds for the zoom slider (0–100%). The default 50%
// keeps the camera at ~6 units — the framing the normalized models fit best.
const ZOOM_MIN_DISTANCE = 2.5;
const ZOOM_MAX_DISTANCE = 9.5;
const DEFAULT_ZOOM = 50;

// Per-vehicle showroom preferences persisted in localStorage. The map is
// keyed by the model URL so each car remembers its own paint color and zoom.
const SHOWROOM_PREFS_KEY = "showroom-prefs";

interface ShowroomPrefs {
  color: string;
  zoom: number;
}

function readShowroomPrefs(): Record<string, ShowroomPrefs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SHOWROOM_PREFS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ShowroomPrefs>) : {};
  } catch {
    // Corrupted JSON or storage unavailable — fall back to defaults.
    return {};
  }
}

function writeShowroomPrefs(modelUrl: string, prefs: ShowroomPrefs) {
  if (typeof window === "undefined") return;
  try {
    const all = readShowroomPrefs();
    all[modelUrl] = prefs;
    window.localStorage.setItem(SHOWROOM_PREFS_KEY, JSON.stringify(all));
  } catch {
    // Quota exceeded or private mode — persistence is best-effort.
  }
}

type OrbitControlsHandle = ComponentRef<typeof OrbitControls>;

const PAINT_COLORS = [
  { name: "Midnight Black", value: "#1a1a2e" },
  { name: "Pearl White", value: "#f5f5f5" },
  { name: "Racing Red", value: "#c41e3a" },
  { name: "Ocean Blue", value: "#1e3a5f" },
  { name: "Forest Green", value: "#2d5a27" },
  { name: "Champagne Gold", value: "#c9a96e" },
];

// Materials that carry the actual body paint on these models
// (verified against the mesh/material names in all 10 GLBs).
const PAINT_MATERIAL_KEYWORDS = [
  "paint",
  "primary",
  "exterior",
  "color",
];

// Safety net for future models with generically-named paint materials:
// repaint meshes explicitly named as exterior body panels.
const BODY_PART_KEYWORDS = [
  "hood",
  "fender",
  "bonnet",
  "trunk",
  "wing",
  "quarter",
  "cowl",
  "sill",
  "apron",
  "mudguard",
];

// Parts that must never be repainted: glass/windows, wheels/tires,
// lights, chrome/trim, badges, interiors, plastics, rubbers, etc.
const NEVER_PAINT_KEYWORDS = [
  "glass",
  "window",
  "windshiel",
  "windscreen",
  "tire",
  "tyre",
  "wheel",
  "rims",
  "rim_",
  "hub",
  "light",
  "lamp",
  "tail",
  "indicator",
  "fog",
  "signal",
  "lens",
  "beam",
  "reflect",
  "emis",
  "mirror",
  "chrome",
  "grille",
  "grill",
  "badge",
  "emblem",
  "plate",
  "logo",
  "brand",
  "license",
  "number",
  "nummern",
  "seat",
  "dash",
  "steering",
  "carpet",
  "floor",
  "interior",
  "leather",
  "stitch",
  "belt",
  "knob",
  "pedal",
  "speedo",
  "console",
  "plastic",
  "rubber",
  "decal",
  "trim",
  "frame",
  "bracket",
  "susp",
  "spring",
  "axle",
  "disc",
  "caliper",
  "brake",
  "engine",
  "exhaust",
  "muffler",
  "antenna",
  "wiper",
  "latch",
  "handle",
  "carbon",
  "metal",
  "molding",
  "garnish",
  "strip",
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
  // useGLTF(path, useDraco, useMeshopt): the optimized GLBs ship with
  // EXT_meshopt_compression geometry (see scripts/optimize-models.sh), which
  // cuts download size ~80% with no detail loss. The meshopt WASM decoder is
  // bundled with three-stdlib, so this works offline with no extra setup.
  const { scene } = useGLTF(url, false, true);

  // Clone the scene, ensure deep isolation for materials, and normalize
  // the model to a consistent size so cars of any authored scale fill the
  // viewport (instead of being tiny dots or overflowing the camera).
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        if (mesh.material) {
          // Clone material so color mutations do not leak to shared meshes
          mesh.material = (mesh.material as MeshStandardMaterial).clone();
        }
      }
    });

    // Measure the real bounding box of the model and scale it uniformly.
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0 && Math.abs(maxDim - NORMALIZED_MODEL_SIZE) > 1e-6) {
      const scale = NORMALIZED_MODEL_SIZE / maxDim;
      const center = box.getCenter(new Vector3());
      // Scale the whole subtree, then shift it so its center sits at the
      // origin (replacing whatever transform the GLB was authored with).
      clone.scale.setScalar(scale);
      clone.position.copy(center).multiplyScalar(-scale);
    }

    return clone;
  }, [scene]);

  // Apply color changes dynamically
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        const mat = mesh.material as MeshStandardMaterial;
        const meshName = (mesh.name ?? "").toLowerCase();
        const matName = (mat?.name ?? "").toLowerCase();
        const combined = `${meshName} ${matName}`;

        // Never repaint glass, wheels, lights, trim, interior, etc.
        if (NEVER_PAINT_KEYWORDS.some((kw) => combined.includes(kw))) return;

        const isPaint =
          PAINT_MATERIAL_KEYWORDS.some((kw) => matName.includes(kw)) ||
          BODY_PART_KEYWORDS.some((kw) => combined.includes(kw));

        if (isPaint && mat) {
          mat.color.set(color);
          mat.metalness = 0.6;
          mat.roughness = 0.3;
          mat.needsUpdate = true;
        }
      }
    });
  }, [clonedScene, color]);

  // Cleanup Three.js materials from GPU memory on unmount
  useEffect(() => {
    return () => {
      clonedScene.traverse((child) => {
        if ((child as Mesh).isMesh) {
          const mesh = child as Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
    };
  }, [clonedScene]);

  return (
    <Center>
      <primitive object={clonedScene as Group} />
    </Center>
  );
}

interface SceneProps {
  modelUrl: string;
  color: string;
  zoom: number;
  controlsRef: RefObject<OrbitControlsHandle | null>;
}

function Scene({ modelUrl, color, zoom, controlsRef }: SceneProps) {
  // Move the camera along its current viewing direction to match the zoom
  // slider. Auto-rotate keeps spinning around the same orbit radius.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const dist =
      ZOOM_MAX_DISTANCE -
      (zoom / 100) * (ZOOM_MAX_DISTANCE - ZOOM_MIN_DISTANCE);
    const direction = controls.object.position
      .clone()
      .sub(controls.target)
      .normalize();
    controls.object.position
      .copy(controls.target)
      .add(direction.multiplyScalar(dist));
    controls.update();
  }, [zoom, controlsRef]);

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
        ref={controlsRef}
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
  // Restore this vehicle's saved preferences once on mount. The saved color
  // is validated against the palette so stale/corrupt values fall back.
  const [color, setColor] = useState(() => {
    const saved = readShowroomPrefs()[modelUrl]?.color;
    return saved && PAINT_COLORS.some((c) => c.value === saved)
      ? saved
      : PAINT_COLORS[0].value;
  });
  const [zoom, setZoom] = useState(() => {
    const saved = readShowroomPrefs()[modelUrl]?.zoom;
    return typeof saved === "number" && saved >= 0 && saved <= 100
      ? saved
      : DEFAULT_ZOOM;
  });
  const controlsRef = useRef<OrbitControlsHandle | null>(null);

  const handleColorChange = useCallback((newColor: string) => {
    setColor(newColor);
  }, []);

  const handleFitToView = useCallback(() => {
    setZoom(DEFAULT_ZOOM);
    const controls = controlsRef.current;
    if (controls) {
      controls.object.position.set(4, 2, 4);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, []);

  // Persist the vehicle's current color + zoom whenever either changes.
  useEffect(() => {
    writeShowroomPrefs(modelUrl, { color, zoom });
  }, [modelUrl, color, zoom]);

  // Pre-fetch GLTF file as soon as the component initializes. Meshopt is
  // enabled to match the optimized files in scripts/optimize-models.sh.
  useEffect(() => {
    useGLTF.preload(modelUrl, false, true);
  }, [modelUrl]);

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
          dpr={[1, 2]}
          camera={{ position: [4, 2, 4], fov: 45 }}
          gl={{
            antialias: true,
            alpha: true,
            // Prioritize the discrete GPU where available; combined with the
            // DPR cap above this keeps mobile fill-rate in check.
            powerPreference: "high-performance",
          }}
        >
          <Scene
            modelUrl={modelUrl}
            color={color}
            zoom={zoom}
            controlsRef={controlsRef}
          />
        </Canvas>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-2xl border bg-card p-5 lg:w-64">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Paint Color
          </Label>
          <p className="mt-1 text-base font-semibold">
            {PAINT_COLORS.find((c) => c.value === color)?.name}
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {PAINT_COLORS.map((paint) => (
            <button
              key={paint.value}
              type="button"
              title={paint.name}
              aria-label={`Select ${paint.name}`}
              onClick={() => handleColorChange(paint.value)}
              className={cn(
                "aspect-square w-full rounded-full border-2 transition-all duration-200 hover:scale-105 active:scale-95",
                color === paint.value
                  ? "border-primary shadow-sm ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "border-transparent opacity-80 hover:opacity-100"
              )}
              style={{ backgroundColor: paint.value }}
            />
          ))}
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Zoom
            </Label>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {zoom}%
            </span>
          </div>
          <Slider
            value={[zoom]}
            min={0}
            max={100}
            step={1}
            onValueChange={(value) => setZoom(value[0])}
            className="mt-3"
            aria-label="Zoom level"
          />
          <button
            type="button"
            onClick={handleFitToView}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs font-medium transition-colors hover:bg-muted hover:text-foreground"
          >
            <Maximize className="h-3.5 w-3.5" />
            Fit to view
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Drag to rotate · Colors apply to body panels
        </p>
      </div>
    </div>
  );
}