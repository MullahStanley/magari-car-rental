"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { CalendarDays, Car, Check, CheckCheck, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { updateBookingStatus } from "@/lib/bookings";
import type { AdminBookingRow, BookingStatus } from "@/types/database";
import { cn, formatCurrency, getImageUrl } from "@/lib/utils";

const statusVariant: Record<
  BookingStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  confirmed: "default",
  cancelled: "destructive",
  completed: "outline",
};

interface AdminBookingsListProps {
  bookings: AdminBookingRow[];
}

export function AdminBookingsList({ bookings }: AdminBookingsListProps) {
  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-muted/30 py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm">
          <CalendarDays className="h-7 w-7 text-primary" />
        </div>
        <p className="mt-4 font-semibold">No bookings yet</p>
        <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
          Bookings will appear here for review once customers reserve a
          vehicle.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => (
        <AdminBookingRow key={booking.id} booking={booking} />
      ))}
    </div>
  );
}

function AdminBookingRow({ booking }: { booking: AdminBookingRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const update = (status: BookingStatus) => {
    setError(null);
    startTransition(async () => {
      const result = await updateBookingStatus(booking.id, status);
      if (!result.success) {
        setError(result.error ?? "Failed to update booking.");
      }
      router.refresh();
    });
  };

  const imageUrl = getImageUrl(booking.vehicle_image_url);
  const dates = `${format(parseISO(booking.start_date), "MMM d")} – ${format(
    parseISO(booking.end_date),
    "MMM d, yyyy"
  )}`;

  const showActions =
    booking.status === "pending" || booking.status === "confirmed";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center",
        booking.status === "pending" && "border-primary/40"
      )}
    >
      {/* Vehicle image */}
      <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-muted to-muted/40">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`${booking.vehicle_brand} ${booking.vehicle_name}`}
            fill
            className="object-cover"
            sizes="96px"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Car className="h-6 w-6 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Booking details */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">
            {booking.vehicle_brand} {booking.vehicle_name}
          </span>
          <Badge variant={statusVariant[booking.status]}>
            {booking.status}
          </Badge>
          {booking.status === "pending" && (
            <Badge
              variant="outline"
              className="border-primary/40 text-primary"
            >
              Awaiting review
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {booking.user_full_name ?? "Unknown user"} · {dates} ·{" "}
          {formatCurrency(booking.total_price)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground/80">
          Booked{" "}
          {formatDistanceToNow(parseISO(booking.created_at), {
            addSuffix: true,
          })}
        </p>
      </div>

      {/* Admin actions */}
      {showActions && (
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center gap-2">
          {booking.status === "pending" ? (
            <>
              <Button
                size="sm"
                onClick={() => update("confirmed")}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => update("cancelled")}
                disabled={isPending}
              >
                <X className="h-4 w-4" />
                Decline
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => update("completed")}
                disabled={isPending}
              >
                <CheckCheck className="h-4 w-4" />
                Complete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => update("cancelled")}
                disabled={isPending}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
        </div>
      )}
    </div>
  );
}
