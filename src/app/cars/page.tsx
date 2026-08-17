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
//


export const metadata = {
  title: "Fleet — Magari Car Rental",
  description: "Browse our premium vehicle fleet with advanced filtering.",
};

export default async function CarsPage({ searchParams }: CarsPageProps) 
{
  const sp = await searchParams;

  const filters = {
    category: sp.category,
    minPrice: sp.minPrice ? Number(sp.minPrice) : undefined,
    maxPrice: sp.maxPrice ? Number(sp.maxPrice) : undefined,
    startDate: sp.startDate,
    endDate: sp.endDate,
  };

  const [vehicles, categories] = await Promise.all([
    getVehicles(filters),
    getVehicleCategories(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="relative mb-8 overflow-hidden rounded-3xl border bg-card px-6 py-10 md:px-10">
        {/* Decorative gradient glows to match the app theme */}
        <div className="pointer-events-none absolute -top-20 right-[-10%] h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-[-10%] h-56 w-56 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-500/15" />
        <div className="relative">
          <h1 className="text-gradient text-3xl font-bold md:text-4xl">
            Our Fleet
          </h1>
          <p className="mt-2 text-muted-foreground">
            {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} available
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
            <VehicleFilters categories={categories} />
          </Suspense>
        </aside>

        <div>
          {vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border bg-muted/30 py-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
                <Car className="h-8 w-8 text-primary" />
              </div>
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
