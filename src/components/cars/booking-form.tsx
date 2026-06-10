"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { CalendarCheck, Loader2 } from "lucide-react";
import { DateRangePicker } from "@/components/booking/date-range-picker";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createBooking } from "@/lib/bookings";
import {
  calculateRentalDays,
  calculateTotalPrice,
  formatCurrency,
} from "@/lib/utils";

interface BookingFormProps {
  vehicleId: string;
  dailyRate: number;
  vehicleName: string;
  isAuthenticated: boolean;
}

export function BookingForm({
  vehicleId,
  dailyRate,
  vehicleName,
  isAuthenticated,
}: BookingFormProps) {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const days =
    dateRange?.from && dateRange?.to
      ? calculateRentalDays(dateRange.from, dateRange.to)
      : 0;

  const total =
    dateRange?.from && dateRange?.to
      ? calculateTotalPrice(dailyRate, dateRange.from, dateRange.to)
      : 0;

  const handleSubmit = () => {
    if (!dateRange?.from || !dateRange?.to) {
      setError("Please select rental dates.");
      return;
    }

    if (!isAuthenticated) {
      router.push(
        `/auth/login?redirect=/cars/${vehicleId}`
      );
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await createBooking({
        vehicleId,
        startDate: format(dateRange.from!, "yyyy-MM-dd"),
        endDate: format(dateRange.to!, "yyyy-MM-dd"),
        dailyRate,
      });

      if (result.success) {
        router.push("/bookings");
      } else {
        setError(result.error ?? "Booking failed. Please try again.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" />
          Book {vehicleName}
        </CardTitle>
        <CardDescription>
          Select your rental dates to see pricing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        {days > 0 && (
          <div className="space-y-2 rounded-lg bg-muted/50 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {formatCurrency(dailyRate)} × {days} day{days !== 1 ? "s" : ""}
              </span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span className="text-lg">{formatCurrency(total)}</span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={isPending || !dateRange?.from || !dateRange?.to}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : isAuthenticated ? (
            "Confirm Booking"
          ) : (
            "Sign in to Book"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
