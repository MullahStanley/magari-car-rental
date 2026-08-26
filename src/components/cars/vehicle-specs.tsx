import {
  Fuel,
  Gauge,
  Calendar,
  Cog,
  Users,
  Palette,
  Car,
  Zap,
} from "lucide-react";
import type { Vehicle } from "@/types/database";

interface VehicleSpecsProps {
  vehicle: Pick<
    Vehicle,
    | "engine_type"
    | "engine_capacity"
    | "horsepower"
    | "drivetrain"
    | "transmission"
    | "fuel_type"
    | "seats"
    | "year"
    | "color"
  >;
}

interface SpecItem {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

export function VehicleSpecs({ vehicle }: VehicleSpecsProps) {
  const allSpecs: (SpecItem | null)[] = [
    vehicle.year != null
      ? { label: "Year", value: vehicle.year, icon: <Calendar className="h-5 w-5" /> }
      : null,
    vehicle.engine_type != null
      ? { label: "Engine", value: vehicle.engine_type, icon: <Car className="h-5 w-5" /> }
      : null,
    vehicle.engine_capacity != null
      ? { label: "Capacity", value: vehicle.engine_capacity, icon: <Gauge className="h-5 w-5" /> }
      : null,
    vehicle.horsepower != null
      ? { label: "Power", value: vehicle.horsepower, icon: <Zap className="h-5 w-5" /> }
      : null,
    vehicle.drivetrain != null
      ? { label: "Drivetrain", value: vehicle.drivetrain, icon: <Cog className="h-5 w-5" /> }
      : null,
    vehicle.transmission != null
      ? { label: "Transmission", value: vehicle.transmission, icon: <Cog className="h-5 w-5" /> }
      : null,
    vehicle.fuel_type != null
      ? { label: "Fuel", value: vehicle.fuel_type, icon: <Fuel className="h-5 w-5" /> }
      : null,
    vehicle.seats != null
      ? { label: "Seats", value: vehicle.seats, icon: <Users className="h-5 w-5" /> }
      : null,
    vehicle.color != null
      ? { label: "Color", value: vehicle.color, icon: <Palette className="h-5 w-5" /> }
      : null,
  ];

  const specs = allSpecs.filter((s): s is SpecItem => s !== null);

  if (specs.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold">Specifications</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {specs.map((spec) => (
          <div key={spec.label} className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {spec.icon}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{spec.label}</p>
              <p className="text-sm font-medium">{spec.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
