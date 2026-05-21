#!/usr/bin/env bash
# Generate BRD PDF from Markdown using pandoc + Chrome headless
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MD="$ROOT/docs/brd/AVA_Business_Requirements_Document.md"
HTML="$ROOT/docs/brd/AVA_Business_Requirements_Document.html"
PDF="$ROOT/docs/brd/AVA_Business_Requirements_Document.pdf"
CSS="$ROOT/docs/brd/brd-print.css"

cat > "$CSS" <<'EOF'
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; max-width: 800px; margin: 2cm auto; }
h1 { font-size: 22pt; border-bottom: 2px solid #4F46E5; padding-bottom: 8px; }
h2 { font-size: 16pt; color: #4F46E5; margin-top: 24px; }
h3 { font-size: 13pt; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 10pt; }
th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
th { background: #f5f5f5; }
code { background: #f4f4f5; padding: 2px 4px; border-radius: 3px; font-size: 9pt; }
pre { background: #f4f4f5; padding: 12px; overflow-x: auto; font-size: 9pt; }
@media print { body { margin: 1.5cm; } }
EOF

pandoc "$MD" -o "$HTML" --standalone \
  --metadata title="AVA Business Requirements Document" \
  --css "$CSS" \
  -V lang=en

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ ! -x "$CHROME" ]]; then
  echo "Chrome not found. HTML saved at: $HTML"
  exit 1
fi

"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$PDF" "file://$HTML"

echo "PDF generated: $PDF"
