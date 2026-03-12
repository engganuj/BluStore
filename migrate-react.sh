#!/bin/bash
# Copy remaining React source files to blu-store/src/
# Skip: flux/, OrbitPage.jsx, modules/appointments/
# Apply oxide→blu find/replace where needed

SRC="/Users/jhendrickson/Projects/oxide/plugin/oxide-commerce/ui/src"
DST="/Users/jhendrickson/Projects/blu-store/src"

# Create directories
mkdir -p "$DST/components/platforms"
mkdir -p "$DST/components/products"
mkdir -p "$DST/components/shared"
mkdir -p "$DST/pages"
mkdir -p "$DST/utils"

# index.css (straight copy — no oxide references expected)
cp "$SRC/index.css" "$DST/index.css"

# utils
cp "$SRC/utils/helpers.js" "$DST/utils/helpers.js"

# components (skip flux/)
cp "$SRC/components/VariantEditor.jsx" "$DST/components/VariantEditor.jsx"
cp "$SRC/components/platforms/PlatformCard.jsx" "$DST/components/platforms/PlatformCard.jsx"
cp "$SRC/components/products/ProductCard.jsx" "$DST/components/products/ProductCard.jsx"
cp "$SRC/components/products/ProductForm.jsx" "$DST/components/products/ProductForm.jsx"
cp "$SRC/components/products/ProductList.jsx" "$DST/components/products/ProductList.jsx"
cp "$SRC/components/shared/Badge.jsx" "$DST/components/shared/Badge.jsx"
cp "$SRC/components/shared/Button.jsx" "$DST/components/shared/Button.jsx"
cp "$SRC/components/shared/Card.jsx" "$DST/components/shared/Card.jsx"
cp "$SRC/components/shared/EmptyState.jsx" "$DST/components/shared/EmptyState.jsx"
cp "$SRC/components/shared/Input.jsx" "$DST/components/shared/Input.jsx"
cp "$SRC/components/shared/LoadingSpinner.jsx" "$DST/components/shared/LoadingSpinner.jsx"
cp "$SRC/components/shared/SearchBar.jsx" "$DST/components/shared/SearchBar.jsx"
cp "$SRC/components/shared/StatCard.jsx" "$DST/components/shared/StatCard.jsx"

# pages (skip OrbitPage.jsx — ChannelsPage already handled manually)
cp "$SRC/pages/CreateProductPage.jsx" "$DST/pages/CreateProductPage.jsx"
cp "$SRC/pages/CustomersPage.jsx" "$DST/pages/CustomersPage.jsx"
cp "$SRC/pages/DashboardPage.jsx" "$DST/pages/DashboardPage.jsx"
cp "$SRC/pages/EditProductPage.jsx" "$DST/pages/EditProductPage.jsx"
cp "$SRC/pages/OrdersPage.jsx" "$DST/pages/OrdersPage.jsx"
cp "$SRC/pages/PagesPage.jsx" "$DST/pages/PagesPage.jsx"
cp "$SRC/pages/ProductsPage.jsx" "$DST/pages/ProductsPage.jsx"
cp "$SRC/pages/SettingsPage.jsx" "$DST/pages/SettingsPage.jsx"
cp "$SRC/pages/ShippingPage.jsx" "$DST/pages/ShippingPage.jsx"

echo "✅ Files copied."

# Now apply find/replace for any oxide references in copied files
# (The manually-edited files are already clean)
COPIED_FILES=(
  "$DST/utils/helpers.js"
  "$DST/components/VariantEditor.jsx"
  "$DST/components/platforms/PlatformCard.jsx"
  "$DST/components/products/ProductCard.jsx"
  "$DST/components/products/ProductForm.jsx"
  "$DST/components/products/ProductList.jsx"
  "$DST/components/shared/Badge.jsx"
  "$DST/components/shared/Button.jsx"
  "$DST/components/shared/Card.jsx"
  "$DST/components/shared/EmptyState.jsx"
  "$DST/components/shared/Input.jsx"
  "$DST/components/shared/LoadingSpinner.jsx"
  "$DST/components/shared/SearchBar.jsx"
  "$DST/components/shared/StatCard.jsx"
  "$DST/pages/CreateProductPage.jsx"
  "$DST/pages/CustomersPage.jsx"
  "$DST/pages/DashboardPage.jsx"
  "$DST/pages/EditProductPage.jsx"
  "$DST/pages/OrdersPage.jsx"
  "$DST/pages/PagesPage.jsx"
  "$DST/pages/ProductsPage.jsx"
  "$DST/pages/SettingsPage.jsx"
  "$DST/pages/ShippingPage.jsx"
)

for f in "${COPIED_FILES[@]}"; do
  if [ -f "$f" ]; then
    # Apply replacements (most specific first)
    sed -i '' \
      -e 's/window\.oxideSettings/window.bluSettings/g' \
      -e 's/oxideSettings/bluSettings/g' \
      -e "s/oxide-root/blu-root/g" \
      -e "s|oxide/v1|blu/v1|g" \
      -e "s/oxide-commerce/blu-store/g" \
      -e "s/oxide-ui/blu-store-ui/g" \
      -e "s/'Oxide'/'Blu Store'/g" \
      -e 's/"Oxide"/"Blu Store"/g' \
      -e "s/Oxide Commerce/Blu Store/g" \
      -e "s/Oxide/Blu Store/g" \
      "$f"
  fi
done

echo "✅ Find/replace applied."

# Verify — check for any remaining oxide references
echo ""
echo "=== Checking for remaining 'oxide' references in src/ ==="
grep -rn -i "oxide" "$DST/" --include="*.js" --include="*.jsx" --include="*.css" || echo "✅ No oxide references found — clean!"

echo ""
echo "Done! React source migration complete."
