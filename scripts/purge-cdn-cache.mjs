#!/usr/bin/env node

/**
 * Purge Cloudflare CDN Cache
 *
 * Usage:
 *   # Purge everything
 *   CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ZONE_ID=<zone_id> npm run cdn:purge -- --all
 *
 *   # Purge specific model(s) or image(s)
 *   npm run cdn:purge -- --files models/tesla_model_x_2020.glb
 *
 * Note on Versioned Models:
 *   3D models use query parameter versioning (?v=N in src/lib/utils.ts).
 *   Bumping MODEL_ASSET_VERSION automatically bypasses edge & browser caches
 *   without requiring an explicit purge.
 */

import process from "node:process";

function arg(name, env) {
  const i = process.argv.indexOf(name);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return process.env[env] ?? null;
}

const hasAll = process.argv.includes("--all");
const filesArg = arg("--files", "PURGE_FILES");
const urlsArg = arg("--urls", "PURGE_URLS");
const token = arg("--token", "CLOUDFLARE_API_TOKEN");
const zoneId = arg("--zone", "CLOUDFLARE_ZONE_ID");
const cdnUrl = (arg("--cdn-url", "NEXT_PUBLIC_CDN_URL") || "").replace(/\/+$/, "");

console.log("Cloudflare CDN Cache Purge Utility\n");

if (!token || !zoneId) {
  console.log("ℹ️  Cloudflare credentials not provided.");
  console.log("   To purge cache via the Cloudflare API, provide:");
  console.log("     --token <CLOUDFLARE_API_TOKEN> or env CLOUDFLARE_API_TOKEN");
  console.log("     --zone <CLOUDFLARE_ZONE_ID> or env CLOUDFLARE_ZONE_ID\n");
  console.log("💡 Tip: For 3D models, you can also bump MODEL_ASSET_VERSION in src/lib/utils.ts.");
  console.log("   This instantly busts browser and Cloudflare edge caches via ?v=N with zero API calls.\n");
  process.exit(0);
}

const endpoint = `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;

let body = {};

if (hasAll) {
  body = { purge_everything: true };
  console.log(`Purging entire cache for Zone: ${zoneId}...`);
} else {
  let fileList = [];

  if (urlsArg) {
    fileList = urlsArg.split(",").map((u) => u.trim());
  } else if (filesArg) {
    if (!cdnUrl) {
      console.error("Error: --files requires NEXT_PUBLIC_CDN_URL or --cdn-url to be specified.");
      process.exit(1);
    }
    const relativePaths = filesArg.split(",").map((f) => f.trim().replace(/^\/+/, ""));
    for (const rel of relativePaths) {
      // Add both canonical Supabase path and clean CDN path to ensure full purge
      fileList.push(`${cdnUrl}/storage/v1/object/public/vehicle-assets/${rel}`);
      fileList.push(`${cdnUrl}/${rel}`);
    }
  } else {
    console.log("Specify what to purge:");
    console.log("  --all                       Purge all cached files");
    console.log("  --files <path1,path2>       Purge relative asset paths (e.g. models/car.glb)");
    console.log("  --urls <url1,url2>          Purge absolute URLs");
    process.exit(1);
  }

  body = { files: fileList };
  console.log(`Purging ${fileList.length} URL(s) for Zone: ${zoneId}:`);
  for (const url of fileList) {
    console.log(`  - ${url}`);
  }
}

try {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    console.error("\n❌ Purge failed:");
    console.error(JSON.stringify(result.errors || result, null, 2));
    process.exit(1);
  }

  console.log("\n✅ Cache purged successfully!");
} catch (error) {
  console.error("\n❌ Error sending purge request:", error.message);
  process.exit(1);
}
