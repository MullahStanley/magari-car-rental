import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getModelUrl(path: string): string {
  // Serve 3D models from the public folder instead of Supabase Storage.
  // DB values look like "models/foo.glb"; be tolerant of leading slashes too.
  const file = (path || "").replace(/^\/?models\//, "");
  return `/models/${file}`;
}

export function calculateRentalDays(startDate: Date, endDate: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
}

export function calculateTotalPrice(
  dailyRate: number,
  startDate: Date,
  endDate: Date
): number {
  return dailyRate * calculateRentalDays(startDate, endDate);
}