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

/**
 * Checks if the Cloudflare CDN is configured via NEXT_PUBLIC_CDN_URL.
 */
export function isCDNEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CDN_URL?.trim());
}

/**
 * Rewrites a Supabase storage URL to route through the Cloudflare CDN edge cache
 * when NEXT_PUBLIC_CDN_URL is configured. External URLs (Unsplash, etc.) are kept intact.
 */
export function toCDNUrl(url: string): string {
  const cdnBase = process.env.NEXT_PUBLIC_CDN_URL?.trim().replace(/\/+$/, "");
  if (!cdnBase) return url;

  const supabaseBase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");

  // Replace configured Supabase project base URL with CDN base URL
  if (supabaseBase && url.startsWith(supabaseBase)) {
    return `${cdnBase}${url.slice(supabaseBase.length)}`;
  }

  // Also match any Supabase Storage public URL pattern: https://<project-ref>.supabase.co/storage/v1/object/public/...
  const supabasePattern = /^https:\/\/[^/]+\.supabase\.co(\/storage\/v1\/object\/public\/.*)$/i;
  const match = url.match(supabasePattern);
  if (match) {
    return `${cdnBase}${match[1]}`;
  }

  return url;
}

export function getModelUrl(path: string): string {
  // Serve 3D models from the public `vehicle-assets` bucket in Supabase
  // Storage or via Cloudflare CDN edge cache (NEXT_PUBLIC_CDN_URL). DB values
  // look like "models/foo.glb"; be tolerant of leading slashes and
  // already-absolute URLs.
  const trimmed = (path || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return appendModelVersion(toCDNUrl(trimmed));
  }
  const file = trimmed.replace(/^\/?models\//, "");
  const cdnBase = process.env.NEXT_PUBLIC_CDN_URL?.trim().replace(/\/+$/, "");
  const supabaseBase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const base = cdnBase || supabaseBase;
  return appendModelVersion(
    `${base}/storage/v1/object/public/vehicle-assets/models/${file}`
  );
}

export function getImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  // Absolute URLs (Supabase Storage public URLs, Unsplash, etc.)
  // When pointing to Supabase storage, route through Cloudflare CDN if configured.
  if (/^https?:\/\//i.test(trimmed)) return encodeURI(toCDNUrl(trimmed));
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