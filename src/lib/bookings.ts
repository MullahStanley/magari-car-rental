"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateRentalDays, calculateTotalPrice } from "@/lib/utils";
import type {
  AdminBookingRow,
  BookingStatus,
  BookingWithVehicle,
} from "@/types/database";
import { sendBookingStatusEmail } from "@/lib/emails";

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

// Validate dates
const [startYear, startMonth, startDay] = input.startDate.split("-").map(Number);
const startDate = new Date(startYear, startMonth - 1, startDay);

const [endYear, endMonth, endDay] = input.endDate.split("-").map(Number);
const endDate = new Date(endYear, endMonth - 1, endDay);
  
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
      vehicles (name, brand, category, daily_rate, image_url)
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

export interface AdminBookingsResult {
  bookings: AdminBookingRow[];
  error: string | null;
}

/**
 * Admin dashboard — all bookings with vehicle + user info, pending first.
 * Backed by the security-definer RPC `admin_get_bookings` (migration 006),
 * which verifies the caller is an admin and bypasses per-user RLS.
 */
export async function getAdminBookings(): Promise<AdminBookingsResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_get_bookings");

  if (error) {
    console.error("Failed to fetch admin bookings:", error.message);
    return { bookings: [], error: error.message };
  }

  return { bookings: (data ?? []) as AdminBookingRow[], error: null };
}

/**
 * Admin action — confirm / decline / complete / cancel a booking.
 * Backed by the security-definer RPC `admin_update_booking_status`.
 */
export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus
): Promise<BookingResult> {
  const supabase = await createClient();

  // Remember what the booking was before the change so we can word the
  // notification correctly (a pending booking declined vs. a confirmed
  // booking cancelled). Only needed when the change triggers an email;
  // admins can read all bookings via RLS.
  let previousStatus: BookingStatus | undefined;
  if (status === "confirmed" || status === "cancelled") {
    const { data: existing } = await supabase
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .single();
    previousStatus = existing?.status;
  }

  const { error } = await supabase.rpc("admin_update_booking_status", {
    p_booking_id: bookingId,
    p_status: status,
  });

  if (error) {
    console.error("Failed to update booking status:", error.message);
    return {
      success: false,
      error:
        error.message === "Forbidden: admin role required"
          ? "You don't have permission to do this."
          : error.message,
    };
  }

  // Notify the customer when their booking is confirmed or declined/cancelled
  // by an admin. Fire-and-forget with internal error handling — a failed
  // email must never roll back a successful status change.
  await sendBookingStatusEmail({ bookingId, newStatus: status, previousStatus });

  revalidatePath("/admin");
  revalidatePath("/bookings");
  revalidatePath("/cars");
  return { success: true };
}
