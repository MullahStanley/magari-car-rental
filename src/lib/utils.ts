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

// Bump this every time the GLBs are re-uploaded (npm run upload:models) so
// browsers/CDNs that have cached a model under its plain URL can't keep
// serving the stale file. It's appended as ?v=… to every model URL the app
// builds, and also busts drei's in-memory loader cache keyed by URL.
const MODEL_ASSET_VERSION = 2;

function appendModelVersion(url: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${MODEL_ASSET_VERSION}`;
}

export function getModelUrl(path: string): string {
  // Serve 3D models from the public `vehicle-assets` bucket in Supabase
  // Storage (the app never ships the large GLB binaries in git). DB values
  // look like "models/foo.glb"; be tolerant of leading slashes and
  // already-absolute URLs.
  const trimmed = (path || "").trim();
  if (/^https?:\/\//i.test(trimmed)) return appendModelVersion(trimmed);
  const file = trimmed.replace(/^\/?models\//, "");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return appendModelVersion(
    `${base}/storage/v1/object/public/vehicle-assets/models/${file}`
  );
}

export function getImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  // Absolute URLs (Supabase Storage public URLs, Unsplash, etc.) are already
  // fully qualified — pass them through, just URL-encoding spaces/unicode.
  if (/^https?:\/\//i.test(trimmed)) return encodeURI(trimmed);
  // Root-relative paths (e.g. "/images/foo.jpg") resolve from the site root.
  if (trimmed.startsWith("/")) return encodeURI(trimmed);
  // DB seed values look like "images/foo.jpg" — serve them from the app's
  // public folder at the site root, mirroring getModelUrl().
  const file = trimmed.replace(/^images\//, "");
  return encodeURI(`/images/${file}`);
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