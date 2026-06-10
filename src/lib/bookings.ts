"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateRentalDays, calculateTotalPrice } from "@/lib/utils";
import type { BookingWithVehicle } from "@/types/database";

export interface CreateBookingInput {
  vehicleId: string;
  startDate: string;
  endDate: string;
  dailyRate: number;
}

export interface BookingResult {
  success: boolean;
  error?: string;
  bookingId?: string;
}

export async function createBooking(
  input: CreateBookingInput
): Promise<BookingResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "You must be logged in to book a vehicle." };
  }

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (startDate < today) {
    return { success: false, error: "Start date cannot be in the past." };
  }

  if (endDate < startDate) {
    return { success: false, error: "End date must be after start date." };
  }

  const days = calculateRentalDays(startDate, endDate);
  if (days < 1) {
    return { success: false, error: "Rental must be at least 1 day." };
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id, daily_rate, is_available")
    .eq("id", input.vehicleId)
    .single();

  if (vehicleError || !vehicle) {
    return { success: false, error: "Vehicle not found." };
  }

  if (!vehicle.is_available) {
    return { success: false, error: "This vehicle is not available." };
  }

  if (vehicle.daily_rate !== input.dailyRate) {
    return {
      success: false,
      error: "Price mismatch. Please refresh and try again.",
    };
  }

  const totalPrice = calculateTotalPrice(vehicle.daily_rate, startDate, endDate);

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      user_id: user.id,
      vehicle_id: input.vehicleId,
      start_date: input.startDate,
      end_date: input.endDate,
      total_price: totalPrice,
      status: "pending",
    })
    .select("id")
    .single();

  if (bookingError) {
    if (bookingError.message.includes("already booked")) {
      return {
        success: false,
        error: "This vehicle is already booked for the selected dates.",
      };
    }
    return { success: false, error: bookingError.message };
  }

  revalidatePath("/bookings");
  revalidatePath("/cars");

  return { success: true, bookingId: booking.id };
}

export async function getUserBookings(): Promise<BookingWithVehicle[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      *,
      vehicles (name, brand, category, daily_rate)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch bookings:", error.message);
    return [];
  }

  return (data ?? []) as BookingWithVehicle[];
}

export async function cancelBooking(bookingId: string): Promise<BookingResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be logged in." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .in("status", ["pending", "confirmed"]);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/bookings");
  revalidatePath("/cars");

  return { success: true, bookingId };
}
