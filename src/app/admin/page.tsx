import { redirect } from "next/navigation";
import {
  CalendarCheck2,
  CheckCheck,
  CheckCircle2,
  CircleX,
  Clock,
  FileImage,
  Shield,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { VehicleImageManager } from "@/components/admin/vehicle-image-manager";
import { AdminBookingsList } from "@/components/admin/admin-bookings-list";
import { AvailabilityCalendar } from "@/components/admin/availability-calendar";
import { getAdminBookings } from "@/lib/bookings";
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

const stats = [
  {
    label: "Pending",
    icon: Clock,
    strip: "bg-brand-gradient",
    filter: (status: string) => status === "pending",
  },
  {
    label: "Confirmed",
    icon: CheckCircle2,
    strip: "bg-green-500",
    filter: (status: string) => status === "confirmed",
  },
  {
    label: "Completed",
    icon: CheckCheck,
    strip: "bg-sky-500",
    filter: (status: string) => status === "completed",
  },
  {
    label: "Cancelled",
    icon: CircleX,
    strip: "bg-destructive",
    filter: (status: string) => status === "cancelled",
  },
];

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

  const [{ bookings, error: bookingsError }, vehicles] = await Promise.all([
    getAdminBookings(),
    supabase.from("vehicles").select("*").order("brand", { ascending: true }),
  ]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-primary/5 shadow-sm">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-gradient text-3xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">
            Review bookings and manage vehicle images
          </p>
        </div>
      </div>

      {bookingsError && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn&apos;t load bookings: {bookingsError}. If you just added this
          feature, make sure migration{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            006_admin_booking_management.sql
          </code>{" "}
          has been applied to your database.
        </div>
      )}

      {/* ── Booking stats ─────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, icon: Icon, strip, filter }) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-2xl border bg-card p-5"
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${strip}`} />
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {label}
              </p>
              <Icon className="h-5 w-5 text-muted-foreground/60" />
            </div>
            <p className="mt-1 text-3xl font-bold">
              {bookings.filter((b) => filter(b.status)).length}
            </p>
          </div>
        ))}
      </div>

      {/* ── Availability calendar ─────────────────────────────── */}
      <section className="mt-10">
        <AvailabilityCalendar
          bookings={bookings}
          vehicles={(vehicles.data ?? []).map((v) => ({
            id: v.id,
            name: v.name,
            brand: v.brand,
          }))}
        />
      </section>

      {/* ── Booking requests ──────────────────────────────────── */}
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-primary/5">
            <CalendarCheck2 className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Booking Requests</h2>
        </div>
        <div className="mt-4">
          <AdminBookingsList bookings={bookings} />
        </div>
      </section>

      {/* ── Vehicle images ────────────────────────────────────── */}
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-primary/5">
            <FileImage className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Vehicle Images</h2>
        </div>

        <div className="mt-4 space-y-4">
          {vehicles.data?.map((vehicle) => (
            <Card key={vehicle.id} className="overflow-hidden">
              <div className="h-1.5 bg-brand-gradient" aria-hidden="true" />
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

          {(!vehicles.data || vehicles.data.length === 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground">
                  No vehicles found
                </CardTitle>
              </CardHeader>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
