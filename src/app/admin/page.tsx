import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VehicleImageManager } from "@/components/admin/vehicle-image-manager";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Admin — Magari",
};

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?redirect=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("brand", { ascending: true });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">Manage vehicle images</p>
        </div>
      </div>

      <div className="space-y-4">
        {vehicles?.map((vehicle) => (
          <Card key={vehicle.id}>
            <CardContent className="p-4">
              <VehicleImageManager
                vehicleId={vehicle.id}
                vehicleName={vehicle.name}
                brand={vehicle.brand}
                currentImageUrl={vehicle.image_url}
              />
              <div className="mt-3 flex items-center gap-2 border-t pt-3">
                <span className="text-sm font-medium">
                  {vehicle.brand} {vehicle.name}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {vehicle.category}
                </Badge>
                {!vehicle.is_available && (
                  <Badge variant="destructive" className="text-xs">
                    Unavailable
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {(!vehicles || vehicles.length === 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground">
                No vehicles found
              </CardTitle>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
