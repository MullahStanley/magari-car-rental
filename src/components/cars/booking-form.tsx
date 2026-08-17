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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  userEmail?: string;
}

const emptyRenter = {
  name: "",
  email: "",
  phone: "",
  nationalId: "",
  driversLicense: "",
};

export function BookingForm({
  vehicleId,
  dailyRate,
  vehicleName,
  isAuthenticated,
  userEmail,
}: BookingFormProps) {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [renter, setRenter] = useState({ ...emptyRenter, email: userEmail ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const setRenterField = (field: keyof typeof emptyRenter, value: string) => {
    setRenter((prev) => ({ ...prev, [field]: value }));
  };

  const days =
    dateRange?.from && dateRange?.to
      ? calculateRentalDays(dateRange.from, dateRange.to)
      : 0;

  const total =
    dateRange?.from && dateRange?.to
      ? calculateTotalPrice(dailyRate, dateRange.from, dateRange.to)
      : 0;

  const handleSubmit = () => {
    // Unauthenticated visitors can always head to sign-in, even before
    // picking dates — the button shouldn't be dead for them.
    if (!isAuthenticated) {
      router.push(`/auth/login?redirect=/cars/${vehicleId}`);
      return;
    }

    if (!dateRange?.from || !dateRange?.to) {
      setError("Please select rental dates.");
      return;
    }

    if (
      !renter.name.trim() ||
      !renter.email.trim() ||
      !renter.phone.trim() ||
      !renter.nationalId.trim() ||
      !renter.driversLicense.trim()
    ) {
      setError("Please fill in all renter details.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await createBooking({
        vehicleId,
        startDate: format(dateRange.from!, "yyyy-MM-dd"),
        endDate: format(dateRange.to!, "yyyy-MM-dd"),
        dailyRate,
        renterName: renter.name,
        renterEmail: renter.email,
        renterPhone: renter.phone,
        nationalId: renter.nationalId,
        driversLicense: renter.driversLicense,
      });

      if (result.success) {
        router.push("/bookings");
      } else {
        setError(result.error ?? "Booking failed. Please try again.");
      }
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-brand-gradient" aria-hidden="true" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-primary/5">
            <CalendarCheck className="h-5 w-5 text-primary" />
          </div>
          Book {vehicleName}
        </CardTitle>
        <CardDescription>
          Pick your rental dates and enter your details. Our team reviews
          your booking, then you&apos;ll pay securely via M-Pesa to confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />

        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <p className="text-sm font-semibold">Renter details</p>
          <div className="space-y-2">
            <Label htmlFor="renter-name">Full Name</Label>
            <Input
              id="renter-name"
              placeholder="John Doe"
              value={renter.name}
              onChange={(e) => setRenterField("name", e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="renter-email">Email</Label>
            <Input
              id="renter-email"
              type="email"
              placeholder="you@example.com"
              value={renter.email}
              onChange={(e) => setRenterField("email", e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="renter-phone">Phone (M-Pesa number)</Label>
            <Input
              id="renter-phone"
              type="tel"
              placeholder="0712 345 678"
              value={renter.phone}
              onChange={(e) => setRenterField("phone", e.target.value)}
              autoComplete="tel"
            />
            <p className="text-xs text-muted-foreground">
              The M-Pesa payment prompt will be sent to this number after
              your booking is approved.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="renter-national-id">National ID</Label>
            <Input
              id="renter-national-id"
              placeholder="12345678"
              value={renter.nationalId}
              onChange={(e) => setRenterField("nationalId", e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="renter-license">Driver&apos;s License</Label>
            <Input
              id="renter-license"
              placeholder="e.g. A1234567"
              value={renter.driversLicense}
              onChange={(e) =>
                setRenterField("driversLicense", e.target.value)
              }
              autoComplete="off"
            />
          </div>
        </div>

        {days > 0 && (
          <div className="space-y-2 rounded-lg bg-gradient-to-br from-primary/10 to-muted/40 p-4">
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
          disabled={
            isPending ||
            (isAuthenticated && (!dateRange?.from || !dateRange?.to))
          }
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : !isAuthenticated ? (
            "Sign in to Book"
          ) : (
            "Confirm Booking"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
