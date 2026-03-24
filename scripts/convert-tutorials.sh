#!/usr/bin/env bash
# Convert all demo .webm videos to .mp4 for the tutorials page
# Strips the "demo-" prefix from filenames

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INPUT_DIR="$PROJECT_DIR/out"
OUTPUT_DIR="$PROJECT_DIR/public/tutorials"

mkdir -p "$OUTPUT_DIR"

count=0
total=$(ls "$INPUT_DIR"/demo-*.webm 2>/dev/null | wc -l)

for webm in "$INPUT_DIR"/demo-*.webm; do
  filename=$(basename "$webm" .webm)
  id="${filename#demo-}"
  output="$OUTPUT_DIR/${id}.mp4"

  count=$((count + 1))

  if [ -f "$output" ]; then
    echo "[$count/$total] Skipping $id.mp4 (already exists)"
    continue
  fi

  echo "[$count/$total] Converting $id..."
  ffmpeg -i "$webm" -c:v libx264 -crf 23 -preset medium -pix_fmt yuv420p -an -y "$output" 2>/dev/null
done

echo ""
echo "Done! Converted $total videos to $OUTPUT_DIR"
