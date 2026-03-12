<?php
/**
 * Blu Store – WooCommerce Auto Sync
 *
 * Bidirectional synchronisation between Blu Store's custom tables and WooCommerce
 * using NATIVE PHP functions — no HTTP API, no API keys, no webhooks needed.
 *
 * WC → Blu: Listens on WooCommerce action hooks (product/order save, delete, stock change).
 * Blu Store → WC: Public static methods called by Blu Store controllers after CUD operations.
 * Bulk Import: One-time import of all existing WC products/orders into Blu Store tables.
 *
 * @package Blu_Commerce
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_Woo_Auto_Sync {

    /* ──────────────────────────────────────────
     * INITIALISATION — hook into WooCommerce
     * ────────────────────────────────────────── */

    /** @var bool Guard against re-entrant loops */
    private static bool $syncing = false;

    /**
     * Register all WC hooks.  Called from blu-store.php on `plugins_loaded`.
     */
    public static function init(): void {
        if ( ! class_exists( 'WooCommerce' ) ) {
            return;
        }

        // ── WC product saved / updated → push into Blu Store tables ──
        add_action( 'woocommerce_update_product',  [ __CLASS__, 'on_wc_product_saved' ], 20, 1 );
        add_action( 'woocommerce_new_product',      [ __CLASS__, 'on_wc_product_saved' ], 20, 1 );

        // ── WC product deleted ──
        add_action( 'woocommerce_before_delete_product', [ __CLASS__, 'on_wc_product_deleted' ], 10, 1 );
        add_action( 'woocommerce_trash_product',         [ __CLASS__, 'on_wc_product_deleted' ], 10, 1 );

        // ── WC stock changed ──
        add_action( 'woocommerce_product_set_stock', [ __CLASS__, 'on_wc_stock_changed' ], 20, 1 );

        // ── WC order created / status changed → push into Blu Store tables ──
        add_action( 'woocommerce_new_order',           [ __CLASS__, 'on_wc_order_saved' ], 20, 1 );
        add_action( 'woocommerce_update_order',        [ __CLASS__, 'on_wc_order_saved' ], 20, 1 );
        add_action( 'woocommerce_order_status_changed', [ __CLASS__, 'on_wc_order_status_changed' ], 20, 3 );

        // ── Abandoned cart tracking ──
        add_action( 'woocommerce_add_to_cart',          [ __CLASS__, 'on_cart_updated' ], 20 );
        add_action( 'woocommerce_cart_item_removed',    [ __CLASS__, 'on_cart_updated' ], 20 );
        add_action( 'woocommerce_after_cart_item_quantity_update', [ __CLASS__, 'on_cart_updated' ], 20 );
        add_action( 'woocommerce_checkout_order_processed', [ __CLASS__, 'on_checkout_complete' ], 20, 1 );
        add_action( 'woocommerce_checkout_update_order_review', [ __CLASS__, 'on_checkout_email_captured' ], 20, 1 );
    }

    /* ──────────────────────────────────────────────────────────
     * DIRECTION 1 : WooCommerce → Blu Store
     * (WC hooks fire → we upsert into blu_* tables)
     * ────────────────────────────────────────────────────────── */

    public static function on_wc_product_saved( int $wc_product_id ): void {
        if ( self::$syncing ) return;

        $product = wc_get_product( $wc_product_id );
        if ( ! $product || $product->get_type() === 'variation' ) return;

        self::upsert_blu_product_from_wc( $product );
    }

    public static function on_wc_product_deleted( int $wc_product_id ): void {
        if ( self::$syncing ) return;

        $mid = blu_merchant_id();
        $t   = blu_table( 'products' );

        Blu_DB::query(
            "UPDATE {$t} SET status = 'archived', updated_at = NOW() WHERE woo_product_id = %d AND merchant_id = %s",
            [ $wc_product_id, $mid ]
        );
    }

    public static function on_wc_stock_changed( \WC_Product $product ): void {
        if ( self::$syncing ) return;

        $mid = blu_merchant_id();
        $t   = blu_table( 'products' );

        Blu_DB::query(
            "UPDATE {$t} SET inventory_qty = %d, updated_at = NOW() WHERE woo_product_id = %d AND merchant_id = %s",
            [ $product->get_stock_quantity() ?? 0, $product->get_id(), $mid ]
        );
    }

    public static function on_wc_order_saved( int $wc_order_id ): void {
        if ( self::$syncing ) return;

        $order = wc_get_order( $wc_order_id );
        if ( ! $order ) return;

        self::upsert_blu_order_from_wc( $order );
    }

    public static function on_wc_order_status_changed( int $order_id, string $from, string $to ): void {
        if ( self::$syncing ) return;

        $mid = blu_merchant_id();
        $t   = blu_table( 'orders' );

        $status_map = [
            'pending'    => 'pending',
            'processing' => 'paid',
            'on-hold'    => 'pending',
            'completed'  => 'fulfilled',
            'cancelled'  => 'cancelled',
            'refunded'   => 'refunded',
            'failed'     => 'cancelled',
        ];

        $blu_status = $status_map[ $to ] ?? $to;

        Blu_DB::query(
            "UPDATE {$t} SET status = %s, updated_at = NOW() WHERE woo_order_id = %d AND merchant_id = %s",
            [ $blu_status, $order_id, $mid ]
        );
    }

    /* ──────────────────────────────────────────────────────────
     * DIRECTION 2 : Blu Store → WooCommerce
     * ────────────────────────────────────────────────────────── */

    public static function push_product_to_wc( object $blu_product ): ?int {
        if ( ! class_exists( 'WooCommerce' ) ) return null;

        self::$syncing = true;

        try {
            $wc_id = $blu_product->woo_product_id ?? null;

            if ( $wc_id ) {
                $wc_product = wc_get_product( (int) $wc_id );
                if ( ! $wc_product ) {
                    $wc_product = new \WC_Product_Simple();
                }
            } else {
                $wc_product = new \WC_Product_Simple();
            }

            $wc_product->set_name( $blu_product->name );
            $wc_product->set_slug( $blu_product->slug ?? '' );
            $wc_product->set_description( $blu_product->description ?? '' );
            $wc_product->set_short_description( $blu_product->short_description ?? '' );
            $wc_product->set_sku( $blu_product->sku ?? '' );

            $price = (float) ( $blu_product->price ?? 0 );
            $compare = $blu_product->compare_at_price
                ? (float) $blu_product->compare_at_price
                : null;

            if ( $compare && $compare > $price ) {
                $wc_product->set_regular_price( (string) $compare );
                $wc_product->set_sale_price( (string) $price );
            } else {
                $wc_product->set_regular_price( (string) $price );
                $wc_product->set_sale_price( '' );
            }

            $track = (bool) ( $blu_product->track_inventory ?? true );
            $wc_product->set_manage_stock( $track );
            if ( $track ) {
                $wc_product->set_stock_quantity( (int) ( $blu_product->inventory_qty ?? 0 ) );
            }
            $wc_product->set_backorders( ! empty( $blu_product->allow_backorders ) ? 'yes' : 'no' );

            $status_map = [
                'active'   => 'publish',
                'draft'    => 'draft',
                'archived' => 'private',
            ];
            $wc_product->set_status( $status_map[ $blu_product->status ] ?? 'draft' );

            if ( ! empty( $blu_product->weight ) ) {
                $wc_product->set_weight( (string) $blu_product->weight );
            }

            $dims = $blu_product->dimensions ?? '{}';
            if ( is_string( $dims ) ) {
                $dims = json_decode( $dims, true );
            }
            if ( is_array( $dims ) ) {
                if ( ! empty( $dims['length'] ) ) $wc_product->set_length( (string) $dims['length'] );
                if ( ! empty( $dims['width'] ) )  $wc_product->set_width( (string) $dims['width'] );
                if ( ! empty( $dims['height'] ) ) $wc_product->set_height( (string) $dims['height'] );
            }

            // Categories
            $cats = json_decode( $blu_product->categories ?? '[]', true );
            if ( is_array( $cats ) && ! empty( $cats ) ) {
                $cat_ids = [];
                foreach ( $cats as $cat_name ) {
                    if ( ! is_string( $cat_name ) || empty( trim( $cat_name ) ) ) continue;
                    $cat_name = trim( $cat_name );

                    $term = get_term_by( 'name', $cat_name, 'product_cat' );
                    if ( ! $term ) {
                        $term = get_term_by( 'slug', sanitize_title( $cat_name ), 'product_cat' );
                    }

                    if ( $term && ! is_wp_error( $term ) ) {
                        $cat_ids[] = (int) $term->term_id;
                    } else {
                        $inserted = wp_insert_term( $cat_name, 'product_cat' );
                        if ( is_wp_error( $inserted ) ) {
                            $existing_id = $inserted->get_error_data( 'term_exists' );
                            if ( $existing_id ) {
                                $cat_ids[] = (int) $existing_id;
                            } else {
                                error_log( 'Blu category creation failed for "' . $cat_name . '": ' . $inserted->get_error_message() );
                            }
                        } else {
                            $cat_ids[] = (int) $inserted['term_id'];
                        }
                    }
                }
                if ( ! empty( $cat_ids ) ) {
                    $wc_product->set_category_ids( $cat_ids );
                }
            }

            // Tags
            $tags = json_decode( $blu_product->tags ?? '[]', true );
            if ( is_array( $tags ) && ! empty( $tags ) ) {
                $tag_ids = [];
                foreach ( $tags as $tag_name ) {
                    if ( ! is_string( $tag_name ) || empty( trim( $tag_name ) ) ) continue;
                    $tag_name = trim( $tag_name );

                    $term = get_term_by( 'name', $tag_name, 'product_tag' );
                    if ( ! $term ) {
                        $term = get_term_by( 'slug', sanitize_title( $tag_name ), 'product_tag' );
                    }

                    if ( $term && ! is_wp_error( $term ) ) {
                        $tag_ids[] = (int) $term->term_id;
                    } else {
                        $inserted = wp_insert_term( $tag_name, 'product_tag' );
                        if ( is_wp_error( $inserted ) ) {
                            $existing_id = $inserted->get_error_data( 'term_exists' );
                            if ( $existing_id ) {
                                $tag_ids[] = (int) $existing_id;
                            } else {
                                error_log( 'Blu tag creation failed for "' . $tag_name . '": ' . $inserted->get_error_message() );
                            }
                        } else {
                            $tag_ids[] = (int) $inserted['term_id'];
                        }
                    }
                }
                if ( ! empty( $tag_ids ) ) {
                    $wc_product->set_tag_ids( $tag_ids );
                }
            }

            // Images
            $images = json_decode( $blu_product->images ?? '[]', true );
            if ( is_array( $images ) && ! empty( $images ) ) {
                $attachment_ids = [];
                $updated_images = [];
                foreach ( $images as $img ) {
                    $url = is_string( $img ) ? $img : ( $img['url'] ?? '' );
                    if ( empty( $url ) ) continue;
                    $att_id = self::sideload_image_to_media_library( $url, $blu_product->name );
                    if ( $att_id ) {
                        $attachment_ids[] = $att_id;
                        $real_url = wp_get_attachment_url( $att_id );
                        $updated_images[] = [
                            'url'      => $real_url ?: $url,
                            'alt_text' => is_array( $img ) ? ( $img['alt_text'] ?? $img['alt'] ?? '' ) : '',
                            'position' => count( $updated_images ),
                        ];
                    }
                }
                if ( ! empty( $attachment_ids ) ) {
                    $wc_product->set_image_id( $attachment_ids[0] );
                    if ( count( $attachment_ids ) > 1 ) {
                        $wc_product->set_gallery_image_ids( array_slice( $attachment_ids, 1 ) );
                    }
                }
                if ( ! empty( $updated_images ) ) {
                    $t = blu_table( 'products' );
                    Blu_DB::query(
                        "UPDATE {$t} SET images = %s WHERE id = %s",
                        [ wp_json_encode( $updated_images ), $blu_product->id ]
                    );
                }
            }

            $wc_product->update_meta_data( '_blu_id', $blu_product->id );

            $new_wc_id = $wc_product->save();

            if ( $new_wc_id && ( ! $wc_id || $wc_id !== $new_wc_id ) ) {
                $t = blu_table( 'products' );
                Blu_DB::query(
                    "UPDATE {$t} SET woo_product_id = %d, updated_at = NOW() WHERE id = %s",
                    [ $new_wc_id, $blu_product->id ]
                );
            }

            return $new_wc_id;

        } catch ( \Exception $e ) {
            error_log( 'Blu Store → WC product sync failed: ' . $e->getMessage() );
            return null;
        } finally {
            self::$syncing = false;
        }
    }

    public static function push_order_to_wc( object $blu_order ): ?int {
        if ( ! class_exists( 'WooCommerce' ) ) return null;

        self::$syncing = true;

        try {
            $wc_order_id = $blu_order->woo_order_id ?? null;

            if ( $wc_order_id ) {
                $wc_order = wc_get_order( (int) $wc_order_id );
                if ( ! $wc_order ) {
                    $wc_order = wc_create_order();
                }
            } else {
                $wc_order = wc_create_order();
            }

            $wc_order->set_billing_email( $blu_order->customer_email ?? '' );

            $name_parts = explode( ' ', $blu_order->customer_name ?? '', 2 );
            $wc_order->set_billing_first_name( $name_parts[0] ?? '' );
            $wc_order->set_billing_last_name( $name_parts[1] ?? '' );

            $shipping = json_decode( $blu_order->shipping_address ?? '{}', true );
            if ( is_array( $shipping ) ) {
                $wc_order->set_shipping_address_1( $shipping['line1'] ?? $shipping['address_line1'] ?? '' );
                $wc_order->set_shipping_address_2( $shipping['line2'] ?? $shipping['address_line2'] ?? '' );
                $wc_order->set_shipping_city( $shipping['city'] ?? '' );
                $wc_order->set_shipping_state( $shipping['state'] ?? '' );
                $wc_order->set_shipping_postcode( $shipping['postal_code'] ?? $shipping['postcode'] ?? '' );
                $wc_order->set_shipping_country( $shipping['country'] ?? '' );
            }

            $wc_order->set_currency( strtoupper( $blu_order->currency ?? 'USD' ) );
            $wc_order->set_total( ( (float) ( $blu_order->total_cents ?? 0 ) ) / 100 );

            $status_map = [
                'pending'   => 'pending',
                'paid'      => 'processing',
                'shipped'   => 'completed',
                'fulfilled' => 'completed',
                'cancelled' => 'cancelled',
                'refunded'  => 'refunded',
            ];
            $wc_status = $status_map[ $blu_order->status ] ?? 'pending';

            $wc_order->update_meta_data( '_blu_order_id', $blu_order->id );
            if ( ! empty( $blu_order->stripe_payment_intent ) ) {
                $wc_order->update_meta_data( '_stripe_payment_intent', $blu_order->stripe_payment_intent );
            }

            if ( ! $wc_order_id ) {
                $items_table = blu_table( 'order_items' );
                $items = Blu_DB::get_results(
                    "SELECT * FROM {$items_table} WHERE order_id = %s",
                    [ $blu_order->id ]
                );

                foreach ( $items as $item ) {
                    $wc_product = null;

                    if ( ! empty( $item->product_id ) ) {
                        $pt = blu_table( 'products' );
                        $blu_prod = Blu_DB::get_row(
                            "SELECT woo_product_id FROM {$pt} WHERE id = %s",
                            [ $item->product_id ]
                        );
                        if ( $blu_prod && $blu_prod->woo_product_id ) {
                            $wc_product = wc_get_product( (int) $blu_prod->woo_product_id );
                        }
                    }

                    $line_item = new \WC_Order_Item_Product();
                    $line_item->set_name( $item->product_name ?? 'Product' );
                    $line_item->set_quantity( (int) ( $item->quantity ?? 1 ) );
                    $line_item->set_subtotal( ( (float) ( $item->total_cents ?? 0 ) ) / 100 );
                    $line_item->set_total( ( (float) ( $item->total_cents ?? 0 ) ) / 100 );

                    if ( $wc_product ) {
                        $line_item->set_product( $wc_product );
                    }

                    $wc_order->add_item( $line_item );
                }
            }

            $new_wc_order_id = $wc_order->save();

            // Use update_status() after save to fire WC status transition hooks
            // which trigger transactional emails (order confirmation, shipping, etc.)
            $wc_order->update_status( $wc_status, 'Status synced from Blu Store.' );

            if ( $new_wc_order_id && ( ! $wc_order_id || $wc_order_id !== $new_wc_order_id ) ) {
                $t = blu_table( 'orders' );
                Blu_DB::query(
                    "UPDATE {$t} SET woo_order_id = %d, updated_at = NOW() WHERE id = %s",
                    [ $new_wc_order_id, $blu_order->id ]
                );
            }

            return $new_wc_order_id;

        } catch ( \Exception $e ) {
            error_log( 'Blu Store → WC order sync failed: ' . $e->getMessage() );
            return null;
        } finally {
            self::$syncing = false;
        }
    }

    public static function delete_wc_product( int $wc_product_id ): void {
        if ( ! class_exists( 'WooCommerce' ) ) return;

        self::$syncing = true;

        try {
            $product = wc_get_product( $wc_product_id );
            if ( $product ) {
                $product->delete( false );
            }
        } catch ( \Exception $e ) {
            error_log( 'Blu Store → WC product delete failed: ' . $e->getMessage() );
        } finally {
            self::$syncing = false;
        }
    }

    /* ──────────────────────────────────────────────────────────
     * DIRECTION 3 : Bulk Import (one-time)
     * ────────────────────────────────────────────────────────── */

    public static function import_all_products(): array {
        $mid      = blu_merchant_id();
        $t        = blu_table( 'products' );
        $imported = 0;
        $skipped  = 0;
        $errors   = 0;
        $page     = 1;

        while ( true ) {
            $args = [
                'status'  => [ 'publish', 'draft', 'private' ],
                'limit'   => 50,
                'page'    => $page,
                'orderby' => 'ID',
                'order'   => 'ASC',
                'type'    => [ 'simple', 'variable', 'grouped', 'external' ],
            ];

            $products = wc_get_products( $args );

            if ( empty( $products ) ) break;

            foreach ( $products as $wc_product ) {
                try {
                    $result = self::upsert_blu_product_from_wc( $wc_product );
                    if ( $result === 'skipped' ) {
                        $skipped++;
                    } else {
                        $imported++;
                    }
                } catch ( \Exception $e ) {
                    $errors++;
                    error_log( 'Blu bulk import product error (WC #' . $wc_product->get_id() . '): ' . $e->getMessage() );
                }
            }

            $page++;
        }

        return [
            'imported' => $imported,
            'skipped'  => $skipped,
            'errors'   => $errors,
        ];
    }

    public static function import_all_orders(): array {
        $mid      = blu_merchant_id();
        $imported = 0;
        $skipped  = 0;
        $errors   = 0;
        $page     = 1;

        while ( true ) {
            $args = [
                'status'  => array_keys( wc_get_order_statuses() ),
                'limit'   => 50,
                'page'    => $page,
                'orderby' => 'ID',
                'order'   => 'ASC',
            ];

            $orders = wc_get_orders( $args );

            if ( empty( $orders ) ) break;

            foreach ( $orders as $wc_order ) {
                try {
                    $result = self::upsert_blu_order_from_wc( $wc_order );
                    if ( $result === 'skipped' ) {
                        $skipped++;
                    } else {
                        $imported++;
                    }
                } catch ( \Exception $e ) {
                    $errors++;
                    error_log( 'Blu bulk import order error (WC #' . $wc_order->get_id() . '): ' . $e->getMessage() );
                }
            }

            $page++;
        }

        return [
            'imported' => $imported,
            'skipped'  => $skipped,
            'errors'   => $errors,
        ];
    }

    /* ──────────────────────────────────────────────────────────
     * INTERNAL HELPERS
     * ────────────────────────────────────────────────────────── */

    private static function upsert_blu_product_from_wc( \WC_Product $wc ): string {
        $mid = blu_merchant_id();
        $t   = blu_table( 'products' );

        $existing = Blu_DB::get_row(
            "SELECT id FROM {$t} WHERE woo_product_id = %d AND merchant_id = %s",
            [ $wc->get_id(), $mid ]
        );

        $blu_id_meta = $wc->get_meta( '_blu_id' );
        if ( ! $existing && $blu_id_meta ) {
            $existing = Blu_DB::get_row(
                "SELECT id FROM {$t} WHERE id = %s AND merchant_id = %s",
                [ $blu_id_meta, $mid ]
            );
        }

        $regular = (float) $wc->get_regular_price();
        $sale    = (float) $wc->get_sale_price();

        if ( $sale > 0 && $sale < $regular ) {
            $price_dollars      = $sale;
            $compare_at_dollars = $regular;
        } else {
            $price_dollars      = $regular;
            $compare_at_dollars = null;
        }

        $status_map = [
            'publish' => 'active',
            'draft'   => 'draft',
            'private' => 'archived',
            'pending' => 'draft',
            'trash'   => 'archived',
        ];
        $blu_status = $status_map[ $wc->get_status() ] ?? 'draft';

        $cat_ids = $wc->get_category_ids();
        $cats    = [];
        foreach ( $cat_ids as $cid ) {
            $term = get_term( $cid, 'product_cat' );
            if ( $term && ! is_wp_error( $term ) ) {
                $cats[] = $term->name;
            }
        }

        $tag_ids = $wc->get_tag_ids();
        $tags    = [];
        foreach ( $tag_ids as $tid ) {
            $term = get_term( $tid, 'product_tag' );
            if ( $term && ! is_wp_error( $term ) ) {
                $tags[] = $term->name;
            }
        }

        $images       = [];
        $main_img_id  = $wc->get_image_id();
        $gallery_ids  = $wc->get_gallery_image_ids();
        $all_img_ids  = $main_img_id ? array_merge( [ $main_img_id ], $gallery_ids ) : $gallery_ids;
        $pos          = 0;
        foreach ( $all_img_ids as $att_id ) {
            $url = wp_get_attachment_url( $att_id );
            if ( $url ) {
                $images[] = [
                    'url'      => $url,
                    'alt_text' => get_post_meta( $att_id, '_wp_attachment_image_alt', true ) ?: '',
                    'position' => $pos++,
                ];
            }
        }

        $type_map = [
            'simple'   => 'simple',
            'variable' => 'variable',
            'grouped'  => 'grouped',
            'external' => 'external',
        ];
        $product_type = $type_map[ $wc->get_type() ] ?? 'simple';

        $data = [
            'merchant_id'       => $mid,
            'sku'               => $wc->get_sku() ?: null,
            'name'              => $wc->get_name(),
            'slug'              => $wc->get_slug(),
            'description'       => $wc->get_description(),
            'short_description' => $wc->get_short_description(),
            'price'             => $price_dollars,
            'compare_at_price'  => $compare_at_dollars,
            'inventory_qty'     => $wc->get_stock_quantity() ?? 0,
            'track_inventory'   => $wc->get_manage_stock() ? 1 : 0,
            'status'            => $blu_status,
            'product_type'      => $product_type,
            'tags'              => wp_json_encode( $tags ),
            'categories'        => wp_json_encode( $cats ),
            'images'            => wp_json_encode( $images ),
            'weight'            => $wc->get_weight() ?: null,
            'dimensions'        => wp_json_encode( [
                'length' => $wc->get_length() ?: null,
                'width'  => $wc->get_width()  ?: null,
                'height' => $wc->get_height() ?: null,
            ] ),
            'woo_product_id'    => $wc->get_id(),
        ];

        if ( $existing ) {
            $sets   = [];
            $values = [];
            foreach ( $data as $col => $val ) {
                if ( $col === 'merchant_id' ) continue;
                $sets[]   = "{$col} = %s";
                $values[] = $val;
            }
            $sets[]   = 'updated_at = NOW()';
            $values[] = $existing->id;
            $values[] = $mid;

            Blu_DB::query(
                "UPDATE {$t} SET " . implode( ', ', $sets ) . " WHERE id = %s AND merchant_id = %s",
                $values
            );
            return 'updated';
        } else {
            $data['id'] = blu_uuid();
            Blu_DB::insert( $t, $data );
            return 'inserted';
        }
    }

    private static function upsert_blu_order_from_wc( \WC_Order $wc ): string {
        $mid = blu_merchant_id();
        $t   = blu_table( 'orders' );
        $ti  = blu_table( 'order_items' );

        $existing = Blu_DB::get_row(
            "SELECT id FROM {$t} WHERE woo_order_id = %d AND merchant_id = %s",
            [ $wc->get_id(), $mid ]
        );

        $status_map = [
            'pending'    => 'pending',
            'processing' => 'paid',
            'on-hold'    => 'pending',
            'completed'  => 'fulfilled',
            'cancelled'  => 'cancelled',
            'refunded'   => 'refunded',
            'failed'     => 'cancelled',
        ];
        $blu_status = $status_map[ $wc->get_status() ] ?? $wc->get_status();

        $shipping = [
            'address_line1' => $wc->get_shipping_address_1(),
            'address_line2' => $wc->get_shipping_address_2(),
            'city'          => $wc->get_shipping_city(),
            'state'         => $wc->get_shipping_state(),
            'postal_code'   => $wc->get_shipping_postcode(),
            'country'       => $wc->get_shipping_country(),
        ];

        $customer_name = trim( $wc->get_billing_first_name() . ' ' . $wc->get_billing_last_name() );

        $data = [
            'merchant_id'        => $mid,
            'customer_email'     => $wc->get_billing_email(),
            'customer_name'      => $customer_name,
            'shipping_address'   => wp_json_encode( $shipping ),
            'subtotal_cents'     => (int) round( (float) $wc->get_subtotal() * 100 ),
            'shipping_cents'     => (int) round( (float) $wc->get_shipping_total() * 100 ),
            'tax_cents'          => (int) round( (float) $wc->get_total_tax() * 100 ),
            'total_cents'        => (int) round( (float) $wc->get_total() * 100 ),
            'currency'           => strtolower( $wc->get_currency() ),
            'status'             => $blu_status,
            'woo_order_id'       => $wc->get_id(),
            'paid_at'            => $wc->get_date_paid() ? $wc->get_date_paid()->format( 'Y-m-d H:i:s' ) : null,
        ];

        if ( $existing ) {
            Blu_DB::query(
                "UPDATE {$t} SET status = %s, total_cents = %d, updated_at = NOW() WHERE id = %s",
                [ $blu_status, $data['total_cents'], $existing->id ]
            );
            return 'updated';
        }

        $order_id = blu_uuid();
        $data['id'] = $order_id;

        $count = Blu_DB::get_var(
            "SELECT COUNT(*) FROM {$t} WHERE merchant_id = %s",
            [ $mid ]
        );
        $data['order_number'] = 'OX-' . str_pad( ( (int) $count ) + 1, 5, '0', STR_PAD_LEFT );

        Blu_DB::insert( $t, $data );

        foreach ( $wc->get_items() as $wc_item ) {
            $product_id = $wc_item->get_product_id();

            $blu_prod_id = null;
            if ( $product_id ) {
                $pt = blu_table( 'products' );
                $blu_prod = Blu_DB::get_row(
                    "SELECT id FROM {$pt} WHERE woo_product_id = %d AND merchant_id = %s",
                    [ $product_id, $mid ]
                );
                if ( $blu_prod ) {
                    $blu_prod_id = $blu_prod->id;
                }
            }

            $wc_product = $wc_item->get_product();
            $img_url    = null;
            if ( $wc_product ) {
                $img_id = $wc_product->get_image_id();
                if ( $img_id ) {
                    $img_url = wp_get_attachment_url( $img_id );
                }
            }

            $item_data = [
                'id'              => blu_uuid(),
                'order_id'        => $order_id,
                'product_id'      => $blu_prod_id,
                'product_name'    => $wc_item->get_name(),
                'product_sku'     => $wc_product ? $wc_product->get_sku() : null,
                'product_image'   => $img_url,
                'options'         => wp_json_encode( new stdClass ),
                'unit_price_cents'=> (int) round( ( (float) $wc_item->get_subtotal() / max( $wc_item->get_quantity(), 1 ) ) * 100 ),
                'quantity'        => $wc_item->get_quantity(),
                'total_cents'     => (int) round( (float) $wc_item->get_total() * 100 ),
            ];

            Blu_DB::insert( $ti, $item_data );
        }

        return 'inserted';
    }

    private static function sideload_image_to_media_library( string $url, string $product_name = '' ): ?int {
        if ( str_starts_with( $url, 'data:' ) ) {
            return self::save_base64_image( $url, $product_name );
        }

        if ( ! str_starts_with( $url, 'http' ) ) {
            error_log( 'Blu image: unsupported URL scheme — ' . substr( $url, 0, 80 ) );
            return null;
        }

        global $wpdb;
        $existing = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_blu_source_url' AND meta_value = %s LIMIT 1",
                $url
            )
        );
        if ( $existing ) {
            return (int) $existing;
        }

        if ( ! function_exists( 'media_sideload_image' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }

        $desc    = $product_name ?: 'Blu Store product image';
        $att_id  = media_sideload_image( $url, 0, $desc, 'id' );

        if ( is_wp_error( $att_id ) ) {
            error_log( 'Blu image sideload failed for ' . $url . ': ' . $att_id->get_error_message() );
            return null;
        }

        update_post_meta( $att_id, '_blu_source_url', $url );

        return (int) $att_id;
    }

    private static function save_base64_image( string $data_uri, string $product_name = '' ): ?int {
        $hash = md5( $data_uri );
        global $wpdb;
        $existing = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_blu_image_hash' AND meta_value = %s LIMIT 1",
                $hash
            )
        );
        if ( $existing ) {
            return (int) $existing;
        }

        if ( ! preg_match( '#^data:image/([a-zA-Z0-9+.-]+);base64,(.+)$#s', $data_uri, $m ) ) {
            error_log( 'Blu image: could not parse data URI' );
            return null;
        }

        $mime_sub = strtolower( $m[1] );
        $decoded  = base64_decode( $m[2], true );
        if ( ! $decoded || strlen( $decoded ) < 100 ) {
            error_log( 'Blu image: base64 decode failed or image too small' );
            return null;
        }

        $ext_map = [
            'jpeg' => 'jpg', 'jpg' => 'jpg', 'png' => 'png',
            'gif'  => 'gif', 'webp' => 'webp', 'svg+xml' => 'svg',
        ];
        $ext = $ext_map[ $mime_sub ] ?? $mime_sub;

        if ( ! function_exists( 'media_handle_sideload' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }

        $tmp = wp_tempnam( 'blu_img_' );
        file_put_contents( $tmp, $decoded );

        $file_array = [
            'name'     => sanitize_file_name( ( $product_name ?: 'product' ) . '-' . substr( $hash, 0, 8 ) . '.' . $ext ),
            'tmp_name' => $tmp,
            'error'    => 0,
            'size'     => strlen( $decoded ),
        ];

        $att_id = media_handle_sideload( $file_array, 0, $product_name ?: 'Blu Store product image' );

        if ( file_exists( $tmp ) ) {
            @unlink( $tmp );
        }

        if ( is_wp_error( $att_id ) ) {
            error_log( 'Blu base64 image save failed: ' . $att_id->get_error_message() );
            return null;
        }

        update_post_meta( (int) $att_id, '_blu_image_hash', $hash );

        return (int) $att_id;
    }

    /* ──────────────────────────────────────────────────────────
     * ABANDONED CART TRACKING
     * ────────────────────────────────────────────────────────── */

    /**
     * Capture or update the current cart in the abandoned_carts table.
     */
    public static function on_cart_updated(): void {
        if ( ! function_exists( 'WC' ) || ! WC()->cart ) return;

        $cart = WC()->cart;
        $items = $cart->get_cart();

        if ( empty( $items ) ) {
            // Cart emptied — remove the active row
            $session_id = self::get_cart_session_id();
            if ( $session_id ) {
                $t = blu_table( 'abandoned_carts' );
                Blu_DB::query(
                    "DELETE FROM {$t} WHERE session_id = %s AND status = 'active'",
                    [ $session_id ]
                );
            }
            return;
        }

        $session_id = self::get_cart_session_id();
        if ( ! $session_id ) return;

        $mid  = blu_merchant_id();
        $t    = blu_table( 'abandoned_carts' );

        // Build cart contents JSON
        $cart_contents = [];
        foreach ( $items as $item ) {
            $product = $item['data'] ?? null;
            $image_url = '';
            if ( $product && method_exists( $product, 'get_image_id' ) ) {
                $img_id = $product->get_image_id();
                $image_url = $img_id ? wp_get_attachment_url( $img_id ) : '';
            }

            $cart_contents[] = [
                'product_id'  => $item['product_id'] ?? 0,
                'variant_id'  => $item['variation_id'] ?? 0,
                'name'        => $product ? $product->get_name() : 'Product',
                'image_url'   => $image_url ?: '',
                'price_cents' => $product ? (int) round( (float) $product->get_price() * 100 ) : 0,
                'quantity'    => (int) ( $item['quantity'] ?? 1 ),
            ];
        }

        $total_cents = (int) round( (float) $cart->get_total( 'edit' ) * 100 );

        // Get customer email if available
        $email = '';
        $name  = '';
        $customer_id = null;
        if ( is_user_logged_in() ) {
            $user  = wp_get_current_user();
            $email = $user->user_email;
            $name  = trim( $user->first_name . ' ' . $user->last_name ) ?: $user->display_name;

            // Try to find Blu customer by email
            $ct = blu_table( 'customers' );
            $blu_cust = Blu_DB::get_row(
                "SELECT id FROM {$ct} WHERE email = %s AND merchant_id = %s LIMIT 1",
                [ $email, $mid ]
            );
            if ( $blu_cust ) {
                $customer_id = $blu_cust->id;
            }
        }

        // Check for existing active cart for this session
        $existing = Blu_DB::get_row(
            "SELECT id, recovery_token FROM {$t} WHERE session_id = %s AND status = 'active' AND merchant_id = %s LIMIT 1",
            [ $session_id, $mid ]
        );

        $store_t = blu_table( 'store_settings' );
        $currency_row = Blu_DB::get_row(
            "SELECT currency FROM {$store_t} WHERE merchant_id = %s",
            [ $mid ]
        );
        $currency = $currency_row->currency ?? 'USD';

        if ( $existing ) {
            // Update existing cart
            Blu_DB::query(
                "UPDATE {$t} SET
                    cart_contents = %s,
                    cart_total_cents = %d,
                    customer_email = COALESCE(NULLIF(%s, ''), customer_email),
                    customer_name = COALESCE(NULLIF(%s, ''), customer_name),
                    customer_id = COALESCE(%s, customer_id),
                    currency = %s,
                    updated_at = NOW()
                WHERE id = %s",
                [
                    wp_json_encode( $cart_contents ),
                    $total_cents,
                    $email,
                    $name,
                    $customer_id,
                    $currency,
                    $existing->id,
                ]
            );
        } else {
            // Create new cart
            $id    = blu_uuid();
            $token = bin2hex( random_bytes( 16 ) );

            Blu_DB::insert( $t, [
                'id'              => $id,
                'merchant_id'     => $mid,
                'session_id'      => $session_id,
                'customer_email'  => $email ?: null,
                'customer_name'   => $name ?: null,
                'customer_id'     => $customer_id,
                'cart_contents'   => wp_json_encode( $cart_contents ),
                'cart_total_cents' => $total_cents,
                'currency'        => $currency,
                'recovery_token'  => $token,
                'status'          => 'active',
                'ip_address'      => sanitize_text_field( $_SERVER['REMOTE_ADDR'] ?? '' ),
                'user_agent'      => sanitize_text_field( substr( $_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500 ) ),
            ] );
        }
    }

    /**
     * Capture email from checkout form before order is placed.
     */
    public static function on_checkout_email_captured( $posted_data ): void {
        if ( ! is_string( $posted_data ) ) return;

        parse_str( $posted_data, $data );
        $email = sanitize_email( $data['billing_email'] ?? '' );
        if ( ! $email ) return;

        $session_id = self::get_cart_session_id();
        if ( ! $session_id ) return;

        $t   = blu_table( 'abandoned_carts' );
        $mid = blu_merchant_id();
        $name = trim( sanitize_text_field( $data['billing_first_name'] ?? '' ) . ' ' . sanitize_text_field( $data['billing_last_name'] ?? '' ) );

        Blu_DB::query(
            "UPDATE {$t} SET customer_email = %s, customer_name = %s, updated_at = NOW()
             WHERE session_id = %s AND status = 'active' AND merchant_id = %s",
            [ $email, $name, $session_id, $mid ]
        );
    }

    /**
     * Mark the cart as converted when checkout completes.
     */
    public static function on_checkout_complete( int $order_id ): void {
        $wc_order = wc_get_order( $order_id );
        if ( ! $wc_order ) return;

        $session_id = self::get_cart_session_id();
        $email      = $wc_order->get_billing_email();
        $t          = blu_table( 'abandoned_carts' );
        $mid        = blu_merchant_id();

        // Find the matching cart by session or email
        $cart = null;
        if ( $session_id ) {
            $cart = Blu_DB::get_row(
                "SELECT id, status FROM {$t} WHERE session_id = %s AND status IN ('active', 'abandoned', 'recovered') AND merchant_id = %s LIMIT 1",
                [ $session_id, $mid ]
            );
        }
        if ( ! $cart && $email ) {
            $cart = Blu_DB::get_row(
                "SELECT id, status FROM {$t} WHERE customer_email = %s AND status IN ('active', 'abandoned', 'recovered') AND merchant_id = %s ORDER BY updated_at DESC LIMIT 1",
                [ $email, $mid ]
            );
        }

        if ( ! $cart ) return;

        // Find the Blu order ID (may have been created by now via order sync)
        $ot = blu_table( 'orders' );
        $blu_order = Blu_DB::get_row(
            "SELECT id FROM {$ot} WHERE woo_order_id = %d AND merchant_id = %s LIMIT 1",
            [ $order_id, $mid ]
        );

        Blu_DB::query(
            "UPDATE {$t} SET status = 'converted', recovered_at = NOW(), recovered_order_id = %s, updated_at = NOW() WHERE id = %s",
            [ $blu_order->id ?? null, $cart->id ]
        );
    }

    /**
     * Get a stable session identifier for cart tracking.
     */
    private static function get_cart_session_id(): ?string {
        if ( ! function_exists( 'WC' ) || ! WC()->session ) return null;

        $session_id = WC()->session->get_customer_id();
        if ( ! $session_id ) return null;

        return 'wc_' . $session_id;
    }
}
