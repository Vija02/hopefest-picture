#!/bin/bash

# NOTE: Pass the full folder name. Eg: videos/RC26_recap_vid

set -e

RCLONE_REMOTE="Hopefest Pic"
BUCKET="hopefest-picture"
R2_PUBLIC_URL="https://hf-pics.michaelsalim.co.uk"

INPUT="$1"
FOLDER="${2:?Usage: $0 <input file> <folder name>}"
OUTPUT_DIR="transcode_output_temp"

if [ -z "$INPUT" ]; then
  echo "Usage: $0 <input file> <folder name>"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

# Get original height
ORIGINAL_HEIGHT=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$INPUT")
echo ">>> Original height: ${ORIGINAL_HEIGHT}p"

# Build renditions list based on original height
RENDITIONS=()
[ "$ORIGINAL_HEIGHT" -ge 1440 ] && RENDITIONS+=("1440 2560:1440 20 192k")
[ "$ORIGINAL_HEIGHT" -ge 1080 ] && RENDITIONS+=("1080 1920:1080 23 128k")
[ "$ORIGINAL_HEIGHT" -ge  720 ] && RENDITIONS+=("720  1280:720  23 128k")
[ "$ORIGINAL_HEIGHT" -ge  480 ] && RENDITIONS+=("480  854:480   28 96k")
[ "$ORIGINAL_HEIGHT" -ge  360 ] && RENDITIONS+=("360  640:360   32 64k")

if [ ${#RENDITIONS[@]} -eq 0 ]; then
  echo "Error: Could not determine renditions for height ${ORIGINAL_HEIGHT}p"
  exit 1
fi

echo ">>> Will transcode to: $(for r in "${RENDITIONS[@]}"; do read -r L _ _ _ <<< "$r"; printf "%sp " "$L"; done)"

echo ">>> Transcoding..."

# Build filter_complex dynamically
COUNT=${#RENDITIONS[@]}
FILTER="[v:0]split=${COUNT}"
for i in "${!RENDITIONS[@]}"; do
  FILTER+="[v${i}]"
done
FILTER+=";"
for i in "${!RENDITIONS[@]}"; do
  read -r LABEL SCALE _ _ <<< "${RENDITIONS[$i]}"
  FILTER+=" [v${i}]scale=${SCALE}[v${i}out];"
done

# Build output args dynamically
OUTPUT_ARGS=()
for i in "${!RENDITIONS[@]}"; do
  read -r LABEL SCALE CRF AUDIO_BITRATE <<< "${RENDITIONS[$i]}"
  OUTPUT_ARGS+=(
    -map "[v${i}out]" -map a:0
    -c:v libx264 -crf "$CRF" -preset medium
    -c:a aac -b:a "$AUDIO_BITRATE"
    -hls_time 6 -hls_playlist_type vod
    -hls_segment_filename "$OUTPUT_DIR/${LABEL}p_%03d.ts"
    "$OUTPUT_DIR/${LABEL}p.m3u8"
  )
done

ffmpeg -i "$INPUT" -filter_complex "$FILTER" "${OUTPUT_ARGS[@]}"

echo ">>> Writing master playlist..."

declare -A BANDWIDTHS=(
  [1440]="8000000"
  [1080]="5000000"
  [720]="2800000"
  [480]="1400000"
  [360]="800000"
)
declare -A RESOLUTIONS=(
  [1440]="2560x1440"
  [1080]="1920x1080"
  [720]="1280x720"
  [480]="854x480"
  [360]="640x360"
)

MASTER="$OUTPUT_DIR/master.m3u8"
echo "#EXTM3U" > "$MASTER"
echo "#EXT-X-VERSION:3" >> "$MASTER"
echo "" >> "$MASTER"

for RENDITION in "${RENDITIONS[@]}"; do
  read -r LABEL _ _ _ <<< "$RENDITION"
  echo "#EXT-X-STREAM-INF:BANDWIDTH=${BANDWIDTHS[$LABEL]},RESOLUTION=${RESOLUTIONS[$LABEL]}" >> "$MASTER"
  echo "${LABEL}p.m3u8" >> "$MASTER"
done

echo ">>> Uploading to R2..."

rclone copy "$OUTPUT_DIR" "${RCLONE_REMOTE}:${BUCKET}/${FOLDER}" --progress

echo ">>> Done! Point your player at:"
echo "    ${R2_PUBLIC_URL}/${FOLDER}/master.m3u8"
