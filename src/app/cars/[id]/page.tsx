import { notFound } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";
import { Car, Loader2 } from "lucide-react";
import { VehicleShowroomClient } from "@/components/showroom/vehicle-showroom-client";
import { BookingForm } from "@/components/cars/booking-form";
import { Badge } from "@/components/ui/badge";
import { getVehicleById } from "@/lib/vehicles";
import { auth, currentUser } from "@clerk/nextjs/server";
import { formatCurrency, getImageUrl, getModelUrl } from "@/lib/utils";

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
  const vehicle = await getVehicleById(id);

  if (!vehicle) notFound();

  const { userId } = await auth();
  const user = userId ? await currentUser() : null;

  const isVerified =
    user?.publicMetadata?.verified === true;
  const modelUrl = getModelUrl(vehicle.model_3d_url);
  const imageUrl = getImageUrl(vehicle.image_url);

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

      {imageUrl ? (
        <div className="relative mt-8 h-[300px] overflow-hidden rounded-2xl bg-gradient-to-br from-muted to-muted/50 sm:h-[400px]">
          <Image
            src={imageUrl}
            alt={`${vehicle.brand} ${vehicle.name}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 900px"
            priority
          />
        </div>
      ) : (
        <div className="mt-8 flex h-[200px] items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/50">
          <Car className="h-16 w-16 text-muted-foreground/30" />
        </div>
      )}

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
          isAuthenticated={!!userId}
          isVerified={isVerified}
        />
      </div>
    </div>
  );
}
