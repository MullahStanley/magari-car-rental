import { format, parseISO } from "date-fns";
import { CalendarDays, Car } from "lucide-react";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserBookings } from "@/lib/bookings";
import { formatCurrency } from "@/lib/utils";
import type { BookingStatus } from "@/types/database";

export const metadata = {
  title: "My Bookings — Magari",
};

const statusVariant: Record<
  BookingStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  confirmed: "default",
  cancelled: "destructive",
  completed: "outline",
};

export default async function BookingsPage() {
  const bookings = await getUserBookings();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">My Bookings</h1>
      <p className="mt-2 text-muted-foreground">
        Manage your current and past rentals
      </p>

      {bookings.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border bg-muted/30 py-20">
          <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
          <h2 className="mt-4 text-lg font-semibold">No bookings yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse our fleet and book your first ride
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-primary" />
                    {booking.vehicles.brand} {booking.vehicles.name}
                  </CardTitle>
                  <CardDescription>{booking.vehicles.category}</CardDescription>
                </div>
                <Badge variant={statusVariant[booking.status]}>
                  {booking.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Dates: </span>
                      {format(parseISO(booking.start_date), "MMM d, yyyy")} –{" "}
                      {format(parseISO(booking.end_date), "MMM d, yyyy")}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Total: </span>
                      <span className="font-semibold">
                        {formatCurrency(booking.total_price)}
                      </span>
                    </p>
                  </div>
                  {(booking.status === "pending" ||
                    booking.status === "confirmed") && (
                    <CancelBookingButton bookingId={booking.id} />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
