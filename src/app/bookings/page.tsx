import { format, parseISO } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Car } from "lucide-react";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserBookings } from "@/lib/bookings";
import { formatCurrency, getImageUrl } from "@/lib/utils";
import type { BookingStatus } from "@/types/database";

export const metadata = {
  title: "My Bookings — Magari",
};

const statusVariant: Record<
  BookingStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  awaiting_payment: "secondary",
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
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
            <CalendarDays className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">No bookings yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse our fleet and book your first ride
          </p>
          <Button asChild className="mt-6">
            <Link href="/cars">
              Browse Fleet
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {bookings.map((booking) => {
            const imageUrl = getImageUrl(booking.vehicles.image_url);
            return (
              <Card key={booking.id} className="overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  {/* Vehicle image — object-contain keeps the whole car
                      visible and centered instead of cropping it. Fixed
                      height + width box on mobile, left column on desktop */}
                  <div className="relative mx-auto h-40 w-40 shrink-0 bg-gradient-to-br from-primary/10 via-muted to-muted/40 sm:mx-0 sm:h-auto sm:w-56">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={`${booking.vehicles.brand} ${booking.vehicles.name}`}
                        fill
                        className="object-contain p-4"
                        sizes="(min-width: 640px) 14rem, 10rem"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Car className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0">
                      <div>
                        <CardTitle>
                          {booking.vehicles.brand} {booking.vehicles.name}
                        </CardTitle>
                        <CardDescription>
                          {booking.vehicles.category}
                        </CardDescription>
                      </div>
                      <Badge variant={statusVariant[booking.status]}>
                        {booking.status}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1 text-sm">
                          <p>
                            <span className="text-muted-foreground">
                              Dates:{" "}
                            </span>
                            {format(parseISO(booking.start_date), "MMM d, yyyy")}{" "}
                            – {format(parseISO(booking.end_date), "MMM d, yyyy")}
                          </p>
                          <p>
                            <span className="text-muted-foreground">
                              Total:{" "}
                            </span>
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
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
