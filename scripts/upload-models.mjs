// Uploads the optimized vehicle GLB files to Supabase Storage so the live
// site (which loads models from the `vehicle-assets` bucket) serves the
// meshopt-compressed versions.
//
// Usage (preferred — keeps the secret out of shell history):
//   SUPABASE_SERVICE_ROLE_KEY=<key> NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co \
//     npm run upload:models [-- --src public/models]
//
// Or via CLI flags:
//   node scripts/upload-models.mjs --service-role-key <key> --url <url> [--src dir]
//
// The service role key (not the anon key) is required to overwrite bucket
// objects; find it in Supabase Dashboard → Settings → API.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function arg(name, env) {
  const i = process.argv.indexOf(name);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return process.env[env] ?? null;
}

const serviceRoleKey = arg("--service-role-key", "SUPABASE_SERVICE_ROLE_KEY");
const url = arg("--url", "NEXT_PUBLIC_SUPABASE_URL");
const srcDir = arg("--src", "") ?? "public/models";

if (!serviceRoleKey || !url) {
  console.error(
    "Missing credentials. Provide --service-role-key and --url, or set\n" +
      "SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL."
  );
  process.exit(1);
}

const BUCKET = "vehicle-assets";
const files = fs
  .readdirSync(srcDir)
  .filter((f) => f.endsWith(".glb"))
  .sort();

if (files.length === 0) {
  console.error(`No .glb files found in ${srcDir}`);
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

console.log(`Uploading ${files.length} model(s) → ${BUCKET}/models/ …`);
for (const name of files) {
  const filePath = path.join(srcDir, name);
  const data = fs.readFileSync(filePath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`models/${name}`, data, {
      contentType: "model/gltf-binary",
      upsert: true,
      // Keep it shortish: models are replaced in place at the same URLs, so a
      // long TTL would serve stale files to returning visitors after an update.
      cacheControl: "3600",
    });
  if (error) {
    console.error(`  ✗ ${name}: ${error.message}`);
    process.exitCode = 1;
    continue;
  }
  // Verify the object landed with the expected size before moving on.
  const { data: info, error: infoError } = await supabase.storage
    .from(BUCKET)
    .info(`models/${name}`);
  if (infoError || !info || info.size !== data.length) {
    console.error(`  ✗ ${name}: uploaded but verification failed (${infoError?.message ?? "size mismatch"})`);
    process.exitCode = 1;
    continue;
  }
  const mb = (data.length / 1048576).toFixed(2);
  console.log(`  ✓ ${name} (${mb} MB, verified)`);
}

if (!process.exitCode) {
  console.log("\nDone. The 3D showroom now serves the meshopt-compressed models.");
}
