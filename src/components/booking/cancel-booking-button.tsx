"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelBooking } from "@/lib/bookings";

interface CancelBookingButtonProps {
  bookingId: string;
}

export function CancelBookingButton({ bookingId }: CancelBookingButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      await cancelBooking(bookingId);
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCancel}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        "Cancel Booking"
      )}
    </Button>
  );
}
