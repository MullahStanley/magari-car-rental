// Per-mesh triangle comparison: original vs optimized GLB, decoded with three.js.
// Usage: node scripts/verify-glb.mjs <orig.glb> <opt.glb>
if (typeof globalThis.self === "undefined") globalThis.self = globalThis;
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";
import fs from "node:fs";

const [origFile, optFile] = process.argv.slice(2);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

async function triCounts(file) {
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise((resolve, reject) => loader.parse(ab, "", resolve, reject));
  const counts = [];
  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry;
      const t = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      counts.push({ name: o.name || "(unnamed)", tri: Math.round(t) });
    }
  });
  counts.sort((a, b) => a.name.localeCompare(b.name));
  return counts;
}

const [orig, opt] = await Promise.all([triCounts(origFile), triCounts(optFile)]);
const origMap = new Map(orig.map((m) => [m.name, m.tri]));
const optMap = new Map(opt.map((m) => [m.name, m.tri]));
const allNames = new Set([...origMap.keys(), ...optMap.keys()]);

let diffs = 0;
for (const name of [...allNames].sort()) {
  const o = origMap.get(name) ?? 0;
  const p = optMap.get(name) ?? 0;
  if (o !== p) {
    diffs++;
    console.log(`  ✗ ${name}: ${o} -> ${p} tri`);
  }
}
const oTotal = orig.reduce((s, m) => s + m.tri, 0);
const pTotal = opt.reduce((s, m) => s + m.tri, 0);
console.log(`meshes: orig=${orig.length} opt=${opt.length}`);
console.log(`total tri: orig=${oTotal.toLocaleString()} opt=${pTotal.toLocaleString()}`);
console.log(diffs === 0 ? "✓ ALL MESHES IDENTICAL (no detail lost)" : `✗ ${diffs} mesh(es) differ`);
