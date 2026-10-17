// Quick GLB inspector — prints mesh/triangle/texture/material stats per file.
// Usage: node scripts/inspect-glb.mjs [file.glb ...]
if (typeof globalThis.self === "undefined") globalThis.self = globalThis;
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import fs from "node:fs";
import path from "node:path";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/inspect-glb.mjs <files...>");
  process.exit(1);
}

const loader = new GLTFLoader();
// Optional meshopt decode support (used to verify optimized files):
// MESHOPT=1 node scripts/inspect-glb.mjs <files...>
if (process.env.MESHOPT === "1") {
  const { MeshoptDecoder } = await import("meshoptimizer");
  loader.setMeshoptDecoder(MeshoptDecoder);
}

for (const file of files) {
  const buf = fs.readFileSync(file);
  const sizeMB = (buf.length / 1024 / 1024).toFixed(2);
  // GLTFLoader requires a real ArrayBuffer, not a Node Buffer.
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  // GLB magic: 0x46546C67 ("glTF")
  const magic = buf.slice(0, 4).toString("latin1");
  let gltf;
  try {
    gltf = await new Promise((resolve, reject) => {
      loader.parse(ab, "", resolve, reject);
    });
  } catch (err) {
    console.log(`${path.basename(file).padEnd(48)} ${sizeMB.padStart(9)}  FAILED: ${err.message} (magic=${magic})`);
    continue;
  }

  let meshes = 0;
  let triangles = 0;
  const textures = new Set();
  const materials = new Set();
  let hasDraco = false;
  let hasMeshopt = false;

  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      const g = o.geometry;
      if (g.index) triangles += g.index.count / 3;
      else if (g.attributes.position) triangles += g.attributes.position.count / 3;
    }
    if (o.isTexture) textures.add(o.image?.src || o.image?.url || "(embedded)");
  });
  for (const t of gltf.textures || []) textures.add(t.image?.src || "(embedded)");
  for (const m of gltf.materials || []) materials.add(m.name || "(unnamed)");
  if (gltf.parser?.json?.extensionsUsed?.includes("KHR_draco_mesh_compression"))
    hasDraco = true;
  if (gltf.parser?.json?.extensionsUsed?.includes("EXT_meshopt_compression"))
    hasMeshopt = true;

  console.log(
    [
      path.basename(file).padEnd(48),
      `${sizeMB} MB`.padStart(9),
      `meshes=${meshes}`.padEnd(12),
      `tri=${Math.round(triangles).toLocaleString()}`.padEnd(16),
      `tex=${textures.size}`.padEnd(8),
      `mat=${materials.size}`.padEnd(8),
      hasDraco ? "draco" : "",
      hasMeshopt ? "meshopt" : "",
    ]
      .filter(Boolean)
      .join(" ")
  );
}
