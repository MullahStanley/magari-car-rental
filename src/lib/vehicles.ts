import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/types/database";

export interface VehicleFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  startDate?: string;
  endDate?: string;
}

export async function getVehicles(
  filters: VehicleFilters = {}
): Promise<Vehicle[]> {
  const supabase = await createClient();

  let query = supabase
    .from("vehicles")
    .select("*")
    .eq("is_available", true)
    .order("daily_rate", { ascending: true });

  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }

  if (filters.minPrice !== undefined) {
    query = query.gte("daily_rate", filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    query = query.lte("daily_rate", filters.maxPrice);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch vehicles:", error.message);
    return [];
  }

  let vehicles = data ?? [];

  if (filters.startDate && filters.endDate) {
    const { data: bookings, error: bookingError } = await supabase
      .from("bookings")
      .select("vehicle_id")
      .in("status", ["pending", "confirmed"])
      .lte("start_date", filters.endDate)
      .gte("end_date", filters.startDate);

    if (bookingError) {
      console.error("Failed to fetch bookings:", bookingError.message);
    } else if (bookings) {
      const bookedIds = new Set(bookings.map((b) => b.vehicle_id));
      vehicles = vehicles.filter((v) => !bookedIds.has(v.id));
    }
  }

  return vehicles;
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Failed to fetch vehicle:", error.message);
    return null;
  }

  return data;
}

export async function getVehicleCategories(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .select("category")
    .eq("is_available", true);

  if (error) {
    console.error("Failed to fetch categories:", error.message);
    return [];
  }

  const categories = [...new Set((data ?? []).map((v) => v.category))];
  return categories.sort();
}
