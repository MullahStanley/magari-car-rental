import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getStorageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/vehicle-assets/${path}`;
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
