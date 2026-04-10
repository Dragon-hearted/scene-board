#!/usr/bin/env bash
# generate-pdf.sh — Convert a SceneBoard markdown storyboard to PDF
# Usage: ./generate-pdf.sh <input.md> [output.pdf]
#
# Dependencies: md-to-pdf (installed via package.json)
# Install: cd systems/scene-board && bun install

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENE_BOARD_DIR="$(dirname "$SCRIPT_DIR")"
STYLES_CSS="$SCENE_BOARD_DIR/templates/pdf-styles.css"

# --- Args ---
if [ $# -lt 1 ]; then
  echo "Usage: $(basename "$0") <input.md> [output.pdf]"
  echo ""
  echo "Converts a SceneBoard markdown storyboard to a professional PDF."
  echo ""
  echo "Arguments:"
  echo "  input.md    Path to the markdown storyboard file"
  echo "  output.pdf  Path for the output PDF (default: same name as input with .pdf extension)"
  exit 1
fi

INPUT_MD="$1"

if [ ! -f "$INPUT_MD" ]; then
  echo "Error: Input file not found: $INPUT_MD"
  exit 1
fi

# Default output: same path/name as input but .pdf
if [ $# -ge 2 ]; then
  OUTPUT_PDF="$2"
else
  OUTPUT_PDF="${INPUT_MD%.md}.pdf"
fi

# Ensure output directory exists
OUTPUT_DIR="$(dirname "$OUTPUT_PDF")"
mkdir -p "$OUTPUT_DIR"

# Check for md-to-pdf
if ! command -v md-to-pdf &>/dev/null; then
  # Try via bunx
  if command -v bunx &>/dev/null; then
    MD_TO_PDF="bunx md-to-pdf"
  elif command -v npx &>/dev/null; then
    MD_TO_PDF="npx md-to-pdf"
  else
    echo "Error: md-to-pdf not found. Install it with: cd $SCENE_BOARD_DIR && bun install"
    exit 1
  fi
else
  MD_TO_PDF="md-to-pdf"
fi

echo "Converting: $INPUT_MD"
echo "Output:     $OUTPUT_PDF"
echo "Styles:     $STYLES_CSS"
echo ""

# Run md-to-pdf with custom stylesheet
# md-to-pdf reads stylesheet from frontmatter or we pass it via --stylesheet
$MD_TO_PDF "$INPUT_MD" \
  --stylesheet "$STYLES_CSS" \
  --pdf-options '{"format": "A4", "margin": {"top": "20mm", "bottom": "20mm", "left": "20mm", "right": "20mm"}, "printBackground": true}' \
  --dest "$OUTPUT_PDF"

if [ -f "$OUTPUT_PDF" ]; then
  echo ""
  echo "PDF generated successfully: $OUTPUT_PDF"
  echo "Size: $(du -h "$OUTPUT_PDF" | cut -f1)"
else
  echo "Error: PDF generation failed."
  exit 1
fi
