#!/bin/bash
# Blu Store Migration Script
# Copies and rebrands remaining PHP files from oxide-commerce → blu-store
# Run from: /Users/jhendrickson/Projects/

set -e

SRC="/Users/jhendrickson/Projects/oxide/plugin/oxide-commerce"
DST="/Users/jhendrickson/Projects/blu-store"

# Function to copy + rebrand a PHP file
rebrand() {
    local src_file="$1"
    local dst_file="$2"
    
    sed \
        -e 's/Oxide Commerce/Blu Store/g' \
        -e 's/oxide-commerce/blu-store/g' \
        -e 's/oxide\.dev/blu.store/g' \
        -e 's/OXIDE_VERSION/BLU_VERSION/g' \
        -e 's/OXIDE_PLUGIN_DIR/BLU_PLUGIN_DIR/g' \
        -e 's/OXIDE_PLUGIN_URL/BLU_PLUGIN_URL/g' \
        -e 's/OXIDE_PLUGIN_FILE/BLU_PLUGIN_FILE/g' \
        -e 's/OXIDE_STRIPE_SECRET_KEY/BLU_STRIPE_SECRET_KEY/g' \
        -e 's/OXIDE_STRIPE_CLIENT_ID/BLU_STRIPE_CLIENT_ID/g' \
        -e "s|'oxide/v1'|'blu/v1'|g" \
        -e 's|oxide/v1|blu/v1|g' \
        -e 's/oxide-webhook/blu-webhook/g' \
        -e 's/oxide_stripe_webhook/blu_stripe_webhook/g' \
        -e 's/oxide-admin/blu-admin/g' \
        -e 's/oxideSettings/bluSettings/g' \
        -e 's/oxide-root/blu-root/g' \
        -e 's/wp_oxide_/wp_blu_/g' \
        -e 's/_oxide_id/_blu_id/g' \
        -e 's/_oxide_source_url/_blu_source_url/g' \
        -e 's/_oxide_image_hash/_blu_image_hash/g' \
        -e 's/oxide_db_version/blu_db_version/g' \
        -e 's/oxide_store_/blu_store_/g' \
        -e "s/source: 'oxide'/source: 'blu'/g" \
        -e "s/=== 'oxide'/=== 'blu'/g" \
        -e "s/!== 'oxide'/!== 'blu'/g" \
        -e "s/'source' => 'oxide'/'source' => 'blu'/g" \
        -e 's/stripe_to_oxide/stripe_to_blu/g' \
        -e 's/oxide_product_id/blu_product_id/g' \
        -e 's/Oxide_/Blu_/g' \
        -e 's/oxide_/blu_/g' \
        -e "s/'Oxide'/'Blu Store'/g" \
        -e 's/Oxide/Blu Store/g' \
        "$src_file" > "$dst_file"
    
    echo "  ✓ $(basename "$dst_file")"
}

echo "=== Blu Store Migration: PHP Files ==="
echo ""

# --- includes/ ---
echo "Processing includes/..."
rebrand "$SRC/includes/class-oxide-woo-auto-sync.php" "$DST/includes/class-blu-woo-auto-sync.php"
rebrand "$SRC/includes/class-oxide-stripe-webhook.php" "$DST/includes/class-blu-stripe-webhook.php"

# --- includes/controllers/ ---
echo "Processing controllers/..."
rebrand "$SRC/includes/controllers/class-oxide-products-controller.php" "$DST/includes/controllers/class-blu-products-controller.php"
rebrand "$SRC/includes/controllers/class-oxide-orders-controller.php" "$DST/includes/controllers/class-blu-orders-controller.php"
rebrand "$SRC/includes/controllers/class-oxide-variants-controller.php" "$DST/includes/controllers/class-blu-variants-controller.php"
rebrand "$SRC/includes/controllers/class-oxide-stripe-controller.php" "$DST/includes/controllers/class-blu-stripe-controller.php"
rebrand "$SRC/includes/controllers/class-oxide-ucp-controller.php" "$DST/includes/controllers/class-blu-ucp-controller.php"
rebrand "$SRC/includes/controllers/class-oxide-channels-platforms-sync.php" "$DST/includes/controllers/class-blu-channels-platforms-sync.php"
rebrand "$SRC/includes/controllers/class-oxide-store-customers-shipping-discounts.php" "$DST/includes/controllers/class-blu-store-customers-shipping-discounts.php"

echo ""
echo "=== Verifying no 'oxide' references remain ==="
if grep -rn "oxide" "$DST/includes/" --include="*.php" | grep -v "Blu Store" | head -5; then
    echo "⚠️  Some oxide references may remain (check above)"
else
    echo "✅ All clean!"
fi

echo ""
echo "=== PHP migration complete ==="
