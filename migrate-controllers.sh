#!/bin/bash
# Migrate controllers from oxide to blu
set -e

SRC="/Users/jhendrickson/Projects/oxide/plugin/oxide-commerce/includes/controllers"
DEST="/Users/jhendrickson/Projects/blu-store/includes/controllers"

# File mapping (old:new)
FILES=(
  "class-oxide-products-controller.php:class-blu-products-controller.php"
  "class-oxide-orders-controller.php:class-blu-orders-controller.php"
  "class-oxide-variants-controller.php:class-blu-variants-controller.php"
  "class-oxide-stripe-controller.php:class-blu-stripe-controller.php"
  "class-oxide-ucp-controller.php:class-blu-ucp-controller.php"
  "class-oxide-channels-platforms-sync.php:class-blu-channels-platforms-sync.php"
  "class-oxide-store-customers-shipping-discounts.php:class-blu-store-customers-shipping-discounts.php"
)

for pair in "${FILES[@]}"; do
  old="${pair%%:*}"
  new="${pair##*:}"
  
  echo "Migrating: $old → $new"
  
  sed \
    -e 's/OXIDE_STRIPE_SECRET_KEY/BLU_STRIPE_SECRET_KEY/g' \
    -e 's/OXIDE_STRIPE_CLIENT_ID/BLU_STRIPE_CLIENT_ID/g' \
    -e 's/oxide-commerce/blu-store/g' \
    -e 's/Oxide Commerce/Blu Store/g' \
    -e 's/oxide_commerce/blu_store/g' \
    -e 's/Oxide_Products_Controller/Blu_Products_Controller/g' \
    -e 's/Oxide_Orders_Controller/Blu_Orders_Controller/g' \
    -e 's/Oxide_Variants_Controller/Blu_Variants_Controller/g' \
    -e 's/Oxide_Stripe_Controller/Blu_Stripe_Controller/g' \
    -e 's/Oxide_UCP_Controller/Blu_UCP_Controller/g' \
    -e 's/Oxide_Channels_Controller/Blu_Channels_Controller/g' \
    -e 's/Oxide_Platforms_Controller/Blu_Platforms_Controller/g' \
    -e 's/Oxide_Sync_Controller/Blu_Sync_Controller/g' \
    -e 's/Oxide_Store_Controller/Blu_Store_Controller/g' \
    -e 's/Oxide_Customers_Controller/Blu_Customers_Controller/g' \
    -e 's/Oxide_Shipping_Controller/Blu_Shipping_Controller/g' \
    -e 's/Oxide_Discounts_Controller/Blu_Discounts_Controller/g' \
    -e 's/Oxide_REST_API/Blu_REST_API/g' \
    -e 's/Oxide_Woo_Auto_Sync/Blu_Woo_Auto_Sync/g' \
    -e 's/Oxide_DB/Blu_DB/g' \
    -e 's/oxide_merchant_id/blu_merchant_id/g' \
    -e 's/oxide_table/blu_table/g' \
    -e 's/oxide_success/blu_success/g' \
    -e 's/oxide_error/blu_error/g' \
    -e 's/oxide_uuid/blu_uuid/g' \
    -e 's/oxide_slugify/blu_slugify/g' \
    -e 's/oxide_to_numeric_or_null/blu_to_numeric_or_null/g' \
    -e 's/oxide_prefixed_id/blu_prefixed_id/g' \
    -e 's/oxide_store_phone/blu_store_phone/g' \
    -e 's/oxide_store_website_url/blu_store_website_url/g' \
    -e 's/oxide_stripe_secret_key/blu_stripe_secret_key/g' \
    -e 's/oxide_stripe_client_id/blu_stripe_client_id/g' \
    -e 's|oxide/v1|blu/v1|g' \
    -e 's/Oxide Variants Controller/Blu Store Variants Controller/g' \
    -e 's/Oxide Stripe Controller/Blu Store Stripe Controller/g' \
    -e 's/Oxide UCP Controller/Blu Store UCP Controller/g' \
    -e 's/oxide_to_stripe/blu_to_stripe/g' \
    -e 's/oxide_product_id/blu_product_id/g' \
    -e 's/Oxide list_products/Blu list_products/g' \
    -e 's/Oxide insert/Blu insert/g' \
    -e 's/Oxide update_product/Blu update_product/g' \
    -e 's/Oxide WC sync/Blu WC sync/g' \
    -e 's/Oxide WC delete/Blu WC delete/g' \
    -e 's/Oxide logo sideload/Blu logo sideload/g' \
    -e "s/Hydrate Oxide row/Hydrate Blu Store row/g" \
    -e "s/from the Oxide UI/from the Blu Store UI/g" \
    -e 's/SYNC: Oxide/SYNC: Blu Store/g' \
    -e 's/Fills in the Oxide merchant/Fills in the Blu Store merchant/g' \
    -e 's/Oxide: insert reported/Blu: insert reported/g' \
    -e "s/WordPress \/ WooCommerce → Oxide (read direction)/WordPress \/ WooCommerce → Blu Store (read direction)/g" \
    "$SRC/$old" > "$DEST/$new"
done

# Fix the Stripe import backward-compat check (check both 'oxide' and 'blu' source tags)
sed -i '' "s/\\\$sp->metadata\['source'\] === 'oxide'/in_array( \$sp->metadata['source'] ?? '', array( 'blu', 'oxide' ), true )/g" \
  "$DEST/class-blu-stripe-controller.php"

# Fix metadata source in push_product_to_stripe
sed -i '' "s/'source' => 'oxide'/'source' => 'blu'/g" \
  "$DEST/class-blu-stripe-controller.php"

echo ""
echo "✅ All controllers migrated!"
echo ""
echo "Checking for remaining 'oxide' references (excluding backward-compat)..."
grep -rn "oxide" "$DEST/" | grep -v "in_array.*oxide" | grep -v "^Binary" || echo "None found - clean!"
