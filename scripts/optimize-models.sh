#!/usr/bin/env bash
#
# Optimizes the vehicle GLB files for faster loading/rendering on mobile.
#
# What it does (all detail-preserving — no decimation):
#   - meshopt geometry compression (EXT_meshopt_compression + KHR_mesh_quantization)
#   - high compression level, with simplification explicitly disabled so the
#     interior detailing is kept 1:1
#   - dedup / instance / flatten / weld / resample / prune / sparse passes
#   - palette and join disabled so material + mesh NAMES are preserved — the
#     3D showroom's repaint feature matches body panels by name
#   - textures left untouched (they are small; KTX2 adds client-side overhead)
#
# The optimized files keep the same filenames, so the DB paths and storage
# URLs stay valid. Originals are preserved in supabase/models/ (identical
# copies of public/models/).
#
# Usage:
#   npm run optimize:models                  # optimize public/models in place
#   npm run optimize:models -- <src> <dest>  # optimize <src> into <dest>
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_DIR="${1:-public/models}"
DEST_DIR="${2:-$SRC_DIR}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

count=0
for f in "$SRC_DIR"/*.glb; do
  [ -e "$f" ] || { echo "No .glb files found in $SRC_DIR"; exit 1; }
  name="$(basename "$f")"
  out="$TMP_DIR/$name"
  echo "→ $name"
  npx gltf-transform optimize "$f" "$out" \
    --compress meshopt \
    --meshopt-level high \
    --simplify false \
    --texture-compress false \
    --palette false \
    --join false
  mv "$out" "$DEST_DIR/$name"
  count=$((count + 1))
done

echo
echo "Optimized $count model(s) → $DEST_DIR"
echo "Upload the resulting files to the 'vehicle-assets' bucket (models/…) so the"
echo "live site serves the compressed versions:"
echo "  node scripts/upload-models.mjs --service-role-key <KEY> --src $DEST_DIR"
