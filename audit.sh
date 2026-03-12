#!/bin/bash
# Full audit of blu-store for any remaining "oxide" references
# and structural issues

echo "═══════════════════════════════════════════════════"
echo "  BLU STORE — FULL MIGRATION AUDIT"
echo "═══════════════════════════════════════════════════"
echo ""

DIR="/Users/jhendrickson/Projects/blu-store"

# 1. Check for "oxide" (case-insensitive) in all PHP/JS/JSX/CSS/JSON files
echo "── CHECK 1: Remaining 'oxide' references ──"
OXIDE_HITS=$(grep -rn -i "oxide" "$DIR" \
  --include="*.php" --include="*.js" --include="*.jsx" \
  --include="*.css" --include="*.json" --include="*.txt" \
  --include="*.md" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="migrate-*.sh" \
  --exclude="*.DS_Store" 2>/dev/null)

if [ -z "$OXIDE_HITS" ]; then
  echo "✅ No 'oxide' references found in any source file."
else
  echo "⚠️  Found 'oxide' references:"
  echo "$OXIDE_HITS"
fi
echo ""

# 2. Check for "Orbit" references  
echo "── CHECK 2: Remaining 'orbit' references ──"
ORBIT_HITS=$(grep -rn -i "orbit" "$DIR" \
  --include="*.php" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="migrate-*.sh" 2>/dev/null)

if [ -z "$ORBIT_HITS" ]; then
  echo "✅ No 'orbit' references found."
else
  echo "⚠️  Found 'orbit' references:"
  echo "$ORBIT_HITS"
fi
echo ""

# 3. Check for "Flux" references
echo "── CHECK 3: Remaining 'flux' references ──"
FLUX_HITS=$(grep -rn -i "flux" "$DIR" \
  --include="*.php" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="migrate-*.sh" 2>/dev/null)

if [ -z "$FLUX_HITS" ]; then
  echo "✅ No 'flux' references found."
else
  echo "⚠️  Found 'flux' references:"
  echo "$FLUX_HITS"
fi
echo ""

# 4. Check for "Instagram" references (should all be removed)
echo "── CHECK 4: Remaining 'instagram' references ──"
IG_HITS=$(grep -rn -i "instagram" "$DIR" \
  --include="*.php" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude="migrate-*.sh" 2>/dev/null)

if [ -z "$IG_HITS" ]; then
  echo "✅ No 'instagram' references found."
else
  echo "⚠️  Found 'instagram' references:"
  echo "$IG_HITS"
fi
echo ""

# 5. Check for "OrbitPage" import
echo "── CHECK 5: OrbitPage.jsx should NOT exist ──"
if [ -f "$DIR/src/pages/OrbitPage.jsx" ]; then
  echo "⚠️  OrbitPage.jsx still exists! Should be deleted."
else
  echo "✅ OrbitPage.jsx correctly absent."
fi
echo ""

# 6. Check flux directory should NOT exist
echo "── CHECK 6: flux/ directory should NOT exist ──"
if [ -d "$DIR/src/components/flux" ]; then
  echo "⚠️  flux/ directory still exists! Should be deleted."
else
  echo "✅ flux/ directory correctly absent."
fi
echo ""

# 7. Verify all PHP class names match file names
echo "── CHECK 7: PHP class name verification ──"
for f in $(find "$DIR" -name "class-blu-*.php" -not -path "*/node_modules/*"); do
  # Extract expected class from filename
  basename=$(basename "$f" .php)            # class-blu-admin
  classpart=${basename#class-}              # blu-admin  
  expected=$(echo "$classpart" | sed 's/-/_/g' | sed 's/\b\(.\)/\u\1/g') # Blu_Admin
  
  # Check if class declaration exists in file
  actual=$(grep -oP 'class\s+\K[A-Za-z_]+' "$f" | head -1)
  
  if [ -z "$actual" ]; then
    echo "  ⚠️  $basename: No class found"
  else
    echo "  ✅ $basename → class $actual"
  fi
done
echo ""

# 8. Check require_once paths in main plugin file
echo "── CHECK 8: require_once paths in blu-store.php ──"
grep "require_once" "$DIR/blu-store.php" | while read line; do
  # Extract the file path
  filepath=$(echo "$line" | grep -oP "BLU_PLUGIN_DIR\s*\.\s*'[^']+'" | grep -oP "'[^']+'" | tr -d "'")
  if [ -n "$filepath" ]; then
    fullpath="$DIR/$filepath"
    if [ -f "$fullpath" ]; then
      echo "  ✅ $filepath exists"
    else
      echo "  ⚠️  $filepath MISSING!"
    fi
  fi
done
echo ""

# 9. Check JS imports reference existing files
echo "── CHECK 9: Key JS import checks ──"
# Check that client.js doesn't import axios
if grep -q "axios" "$DIR/src/api/client.js" 2>/dev/null; then
  echo "  ⚠️  client.js still imports axios!"
else
  echo "  ✅ client.js uses @wordpress/api-fetch (no axios)"
fi

# Check useAPI.js doesn't import instagramConnectAPI
if grep -q "instagramConnectAPI" "$DIR/src/hooks/useAPI.js" 2>/dev/null; then
  echo "  ⚠️  useAPI.js still imports instagramConnectAPI!"
else
  echo "  ✅ useAPI.js clean (no instagramConnectAPI)"
fi

# Check App.jsx doesn't import OrbitPage
if grep -q "OrbitPage" "$DIR/src/App.jsx" 2>/dev/null; then
  echo "  ⚠️  App.jsx still imports OrbitPage!"
else
  echo "  ✅ App.jsx clean (no OrbitPage)"
fi

# Check Layout.jsx doesn't import flux
if grep -q "flux" "$DIR/src/components/Layout.jsx" 2>/dev/null; then
  echo "  ⚠️  Layout.jsx still references flux!"
else
  echo "  ✅ Layout.jsx clean (no flux)"
fi

# Check window.bluSettings (not oxideSettings)
if grep -q "oxideSettings" "$DIR/src/api/client.js" 2>/dev/null; then
  echo "  ⚠️  client.js still uses oxideSettings!"
else
  echo "  ✅ client.js uses bluSettings"
fi

# Check mount point
if grep -q "blu-root" "$DIR/src/index.jsx" 2>/dev/null; then
  echo "  ✅ index.jsx mounts to blu-root"
else
  echo "  ⚠️  index.jsx may have wrong mount point!"
fi
echo ""

# 10. Check REST namespace consistency
echo "── CHECK 10: REST namespace ──"
PHP_NS=$(grep -r "blu/v1" "$DIR" --include="*.php" -l 2>/dev/null | wc -l | tr -d ' ')
JS_NS=$(grep -r "blu/v1" "$DIR/src" --include="*.js" --include="*.jsx" -l 2>/dev/null | wc -l | tr -d ' ')
echo "  PHP files using 'blu/v1': $PHP_NS"
echo "  JS files using 'blu/v1': $JS_NS"

# Check no oxide/v1 remains
OLD_NS=$(grep -rn "oxide/v1" "$DIR" --include="*.php" --include="*.js" --include="*.jsx" 2>/dev/null)
if [ -z "$OLD_NS" ]; then
  echo "  ✅ No 'oxide/v1' namespace found"
else
  echo "  ⚠️  Old 'oxide/v1' namespace still present:"
  echo "$OLD_NS"
fi
echo ""

# 11. Check wp_localize_script key
echo "── CHECK 11: wp_localize_script key ──"
LOCALIZE=$(grep "wp_localize_script" "$DIR/admin/class-blu-admin.php" 2>/dev/null)
if echo "$LOCALIZE" | grep -q "bluSettings"; then
  echo "  ✅ wp_localize_script uses 'bluSettings'"
else
  echo "  ⚠️  wp_localize_script key may be wrong"
  echo "  $LOCALIZE"
fi
echo ""

# 12. Check build config
echo "── CHECK 12: Build configuration ──"
for f in package.json webpack.config.js tailwind.config.js postcss.config.js; do
  if [ -f "$DIR/$f" ]; then
    echo "  ✅ $f exists"
  else
    echo "  ⚠️  $f MISSING!"
  fi
done

# Check package.json has wp-scripts
if grep -q "@wordpress/scripts" "$DIR/package.json" 2>/dev/null; then
  echo "  ✅ package.json includes @wordpress/scripts"
else
  echo "  ⚠️  package.json missing @wordpress/scripts!"
fi

# Check package.json has api-fetch
if grep -q "@wordpress/api-fetch" "$DIR/package.json" 2>/dev/null; then
  echo "  ✅ package.json includes @wordpress/api-fetch"
else
  echo "  ⚠️  package.json missing @wordpress/api-fetch!"
fi

# Check package.json does NOT have vite or axios
if grep -q '"vite"' "$DIR/package.json" 2>/dev/null; then
  echo "  ⚠️  package.json still has vite!"
else
  echo "  ✅ package.json clean (no vite)"
fi
if grep -q '"axios"' "$DIR/package.json" 2>/dev/null; then
  echo "  ⚠️  package.json still has axios!"
else
  echo "  ✅ package.json clean (no axios)"
fi
echo ""

# 13. Check webpack entry point
echo "── CHECK 13: Webpack entry/output ──"
if grep -q "src/index.jsx" "$DIR/webpack.config.js" 2>/dev/null; then
  echo "  ✅ webpack entry: src/index.jsx"
else
  echo "  ⚠️  webpack entry might be wrong"
fi
if grep -q "admin/build" "$DIR/webpack.config.js" 2>/dev/null; then
  echo "  ✅ webpack output: admin/build"
else
  echo "  ⚠️  webpack output path might be wrong"
fi
echo ""

# 14. File count summary
echo "── CHECK 14: File inventory ──"
PHP_COUNT=$(find "$DIR" -name "*.php" -not -path "*/node_modules/*" | wc -l | tr -d ' ')
JS_COUNT=$(find "$DIR/src" -name "*.js" -o -name "*.jsx" 2>/dev/null | wc -l | tr -d ' ')
CSS_COUNT=$(find "$DIR/src" -name "*.css" 2>/dev/null | wc -l | tr -d ' ')
echo "  PHP files: $PHP_COUNT"
echo "  JS/JSX files: $JS_COUNT"
echo "  CSS files: $CSS_COUNT"

# Check expected file counts
echo ""
echo "  Expected: 15 PHP, ~24 JS/JSX, 1 CSS"
echo ""

# 15. Check .distignore and readme.txt
echo "── CHECK 15: Distribution files ──"
for f in .distignore readme.txt; do
  if [ -f "$DIR/$f" ]; then
    echo "  ✅ $f exists"
  else
    echo "  ⚠️  $f MISSING!"
  fi
done
echo ""

# 16. Check for import.meta.env (Vite-ism)
echo "── CHECK 16: Vite-isms that won't work in wp-scripts ──"
VITE_REFS=$(grep -rn "import\.meta\.env\|import\.meta\." "$DIR/src" --include="*.js" --include="*.jsx" 2>/dev/null)
if [ -z "$VITE_REFS" ]; then
  echo "  ✅ No import.meta.env references"
else
  echo "  ⚠️  Found Vite-specific code:"
  echo "$VITE_REFS"
fi
echo ""

echo "═══════════════════════════════════════════════════"
echo "  AUDIT COMPLETE"
echo "═══════════════════════════════════════════════════"
