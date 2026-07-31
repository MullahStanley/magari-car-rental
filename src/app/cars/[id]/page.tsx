import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { VehicleShowroomClient } from "@/components/showroom/vehicle-showroom-client";
import { BookingForm } from "@/components/cars/booking-form";
import { Badge } from "@/components/ui/badge";
import { getVehicleById } from "@/lib/vehicles";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, getModelUrl } from "@/lib/utils";

interface VehicleDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: VehicleDetailPageProps) {
  const { id } = (await params);
  const vehicle = await getVehicleById(id);
  if (!vehicle) 
    return { title: "Vehicle Not Found" };
  return {
    title: `${vehicle.brand} ${vehicle.name} — Magari`,
    description: vehicle.description ?? `Rent the ${vehicle.name}`,
  };
}

export default async function VehicleDetailPage({
  params,
}: VehicleDetailPageProps) {
  const { id } = await params;
  const [vehicle, supabase] = await Promise.all([
    getVehicleById(id),
    createClient(),
  ]);

  if (!vehicle) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isVerified = user?.user_metadata?.verified === true;
  const modelUrl = getModelUrl(vehicle.model_3d_url);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge variant="secondary">{vehicle.category}</Badge>
        <span className="text-sm text-muted-foreground">{vehicle.brand}</span>
      </div>

      <h1 className="text-3xl font-bold md:text-4xl">{vehicle.name}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        {vehicle.description}
      </p>
      <p className="mt-4 text-3xl font-bold">
        {formatCurrency(vehicle.daily_rate)}
        <span className="text-base font-normal text-muted-foreground">
          /day
        </span>
      </p>

      <div className="mt-8">
        <Suspense
          fallback={
            <div className="flex h-[400px] items-center justify-center rounded-2xl bg-muted">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <VehicleShowroomClient modelUrl={modelUrl} />
        </Suspense>
      </div>

      <div className="mt-8 max-w-md">
        <BookingForm
          vehicleId={vehicle.id}
          dailyRate={vehicle.daily_rate}
          vehicleName={vehicle.name}
          isAuthenticated={!!user}
          isVerified={isVerified}
        />
      </div>
    </div>
  );
}
