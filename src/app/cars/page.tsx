import { Suspense } from "react";
import { Car } from "lucide-react";
import { VehicleCard } from "@/components/cars/vehicle-card";
import { VehicleFilters } from "@/components/cars/vehicle-filters";
import { getVehicleCategories, getVehicles } from "@/lib/vehicles";

interface CarsPageProps {
  searchParams: Promise<{
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export const metadata = {
  title: "Fleet — Magari Car Rental",
  description: "Browse our premium vehicle fleet with advanced filtering.",
};

export default async function CarsPage({ searchParams }: CarsPageProps) {
  const params = await searchParams;

  const filters = {
    category: params.category,
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    startDate: params.startDate,
    endDate: params.endDate,
  };

  const [vehicles, categories] = await Promise.all([
    getVehicles(filters),
    getVehicleCategories(),
  ]);

  const maxPrice = Math.max(...vehicles.map((v) => v.daily_rate), 500);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Our Fleet</h1>
        <p className="mt-2 text-muted-foreground">
          {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} available
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
            <VehicleFilters categories={categories} maxPrice={maxPrice} />
          </Suspense>
        </aside>

        <div>
          {vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border bg-muted/30 py-20">
              <Car className="h-12 w-12 text-muted-foreground/50" />
              <h2 className="mt-4 text-lg font-semibold">No vehicles found</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting your filters or date range
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {vehicles.map((vehicle, index) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
