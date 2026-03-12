<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_Products_Controller {

    public static function register( string $ns ): void {
        $admin = [ Blu_REST_API::class, 'admin_permission' ];

        // GET + POST /products
        register_rest_route( $ns, '/products', [
            [ 'methods' => 'GET',  'callback' => [ __CLASS__, 'list_products' ],  'permission_callback' => $admin ],
            [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'create_product' ], 'permission_callback' => $admin ],
        ] );

        // GET /products/settings
        register_rest_route( $ns, '/products/settings', [
            'methods'  => 'GET',
            'callback' => [ __CLASS__, 'get_settings' ],
            'permission_callback' => $admin,
        ] );

        // GET /products/slug/(?P<slug>[a-z0-9-]+)
        register_rest_route( $ns, '/products/slug/(?P<slug>[a-z0-9-]+)', [
            'methods'  => 'GET',
            'callback' => [ __CLASS__, 'get_by_slug' ],
            'permission_callback' => '__return_true',
        ] );

        // GET + PUT + DELETE /products/(?P<id>[a-f0-9-]+)
        register_rest_route( $ns, '/products/(?P<id>[a-f0-9-]+)', [
            [ 'methods' => 'GET',    'callback' => [ __CLASS__, 'get_product' ],    'permission_callback' => $admin ],
            [ 'methods' => 'PUT',    'callback' => [ __CLASS__, 'update_product' ], 'permission_callback' => $admin ],
            [ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'delete_product' ], 'permission_callback' => $admin ],
        ] );
    }

    /* ─── GET /products ─── */
    public static function list_products( WP_REST_Request $req ): WP_REST_Response {
        $mid    = blu_merchant_id();
        $t      = blu_table( 'products' );
        $limit  = (int) ( $req->get_param( 'limit' ) ?: 25 );
        $offset = (int) ( $req->get_param( 'offset' ) ?: 0 );
        $search = $req->get_param( 'search' );
        $status = $req->get_param( 'status' );

        // Build WHERE clause
        $where  = [ "merchant_id = %s" ];
        $params = [ $mid ];

        if ( $search ) {
            $like     = '%' . $search . '%';
            $where[]  = "(name LIKE %s OR sku LIKE %s OR description LIKE %s)";
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        if ( $status && $status !== 'all' ) {
            $where[]  = "status = %s";
            $params[] = $status;
        }

        $w = implode( ' AND ', $where );

        // Get total count for pagination
        $total = (int) Blu_DB::get_var( "SELECT COUNT(*) FROM {$t} WHERE {$w}", $params );

        if ( $total === 0 ) {
            return blu_success( [ 'products' => [], 'total' => 0, 'limit' => $limit, 'offset' => $offset ] );
        }

        // Two-step query to avoid MySQL sort_buffer overflow.
        // The images column can contain huge base64 data URIs which blow
        // the sort buffer when MySQL tries to ORDER BY with SELECT *.
        // Step 1: get sorted IDs with pagination (tiny rows, fast sort)
        $sorted_ids = Blu_DB::get_col(
            "SELECT id FROM {$t} WHERE {$w} ORDER BY updated_at DESC LIMIT %d OFFSET %d",
            array_merge( $params, [ $limit, $offset ] )
        );

        if ( empty( $sorted_ids ) ) {
            return blu_success( [ 'products' => [], 'total' => $total, 'limit' => $limit, 'offset' => $offset ] );
        }

        // Step 2: fetch full rows by ID (no ORDER BY needed)
        $placeholders = implode( ',', array_fill( 0, count( $sorted_ids ), '%s' ) );
        $rows = Blu_DB::get_results(
            "SELECT * FROM {$t} WHERE id IN ({$placeholders})",
            $sorted_ids
        );

        if ( empty( $rows ) ) {
            global $wpdb;
            if ( $wpdb->last_error ) {
                error_log( 'Blu list_products SQL error: ' . $wpdb->last_error );
            }
            return blu_success( [ 'products' => [], 'total' => $total, 'limit' => $limit, 'offset' => $offset ] );
        }

        // Restore sort order from step 1
        $id_order = array_flip( $sorted_ids );
        usort( $rows, fn( $a, $b ) => ( $id_order[ $a->id ] ?? 999 ) - ( $id_order[ $b->id ] ?? 999 ) );

        // Fetch platform mappings separately
        $tm = blu_table( 'product_platform_mappings' );
        $ta = blu_table( 'platform_adapters' );
        $product_ids = array_map( fn( $r ) => $r->id, $rows );
        $platforms_by_product = [];

        if ( ! empty( $product_ids ) ) {
            $placeholders = implode( ',', array_fill( 0, count( $product_ids ), '%s' ) );
            $platform_rows = Blu_DB::get_results(
                "SELECT ppm.product_id, ppm.id, pa.platform_type, pa.platform_name,
                        ppm.platform_id, ppm.platform_url, ppm.sync_status,
                        ppm.last_synced_at, ppm.conflict_detected
                 FROM {$tm} ppm
                 JOIN {$ta} pa ON ppm.platform_adapter_id = pa.id
                 WHERE ppm.product_id IN ({$placeholders})",
                $product_ids
            );
            foreach ( $platform_rows as $pr ) {
                $pid = $pr->product_id;
                unset( $pr->product_id );
                $platforms_by_product[ $pid ][] = $pr;
            }
        }

        // Decode JSON columns and attach platforms
        foreach ( $rows as &$r ) {
            self::decode_json_columns( $r );
            $r->platforms = $platforms_by_product[ $r->id ] ?? null;
        }

        return blu_success( [ 'products' => $rows, 'total' => $total, 'limit' => $limit, 'offset' => $offset ] );
    }

    /* ─── GET /products/settings ─── */
    public static function get_settings( WP_REST_Request $req ): WP_REST_Response {
        $mid = blu_merchant_id();
        $t   = blu_table( 'merchants' );
        $row = Blu_DB::get_row( "SELECT pdp_template FROM {$t} WHERE id = %s", [ $mid ] );
        return blu_success( [ 'template' => $row->pdp_template ?? 'modern' ] );
    }

    /* ─── GET /products/slug/:slug ─── */
    public static function get_by_slug( WP_REST_Request $req ) {
        $slug = $req->get_param( 'slug' );
        $mid  = blu_merchant_id();
        $row  = self::fetch_full_product( "p.slug = %s AND p.merchant_id = %s", [ $slug, $mid ] );
        if ( ! $row ) return blu_error( 'Product not found', 404 );
        return blu_success( [ 'product' => $row ] );
    }

    /* ─── GET /products/:id ─── */
    public static function get_product( WP_REST_Request $req ) {
        $id  = $req->get_param( 'id' );
        $mid = blu_merchant_id();
        $row = self::fetch_full_product( "p.id = %s AND p.merchant_id = %s", [ $id, $mid ] );
        if ( ! $row ) return blu_error( 'Product not found', 404 );
        return blu_success( [ 'product' => $row ] );
    }

    /* ─── POST /products ─── */
    public static function create_product( WP_REST_Request $req ) {
        $mid  = blu_merchant_id();
        $body = $req->get_json_params();
        $t    = blu_table( 'products' );

        if ( empty( $body['name'] ) || ! isset( $body['price'] ) ) {
            return blu_error( 'Missing required fields: name, price', 400 );
        }

        $id   = blu_uuid();
        $slug = $body['slug'] ?? blu_slugify( $body['name'] );

        $data = [
            'id'                => $id,
            'merchant_id'       => $mid,
            'sku'               => ! empty( $body['sku'] ) ? $body['sku'] : null,
            'name'              => $body['name'],
            'slug'              => $slug,
            'description'       => $body['description'] ?? null,
            'short_description' => $body['short_description'] ?? null,
            'price'             => blu_to_numeric_or_null( $body['price'] ) ?? 0,
            'compare_at_price'  => blu_to_numeric_or_null( $body['compare_at_price'] ?? null ),
            'cost'              => blu_to_numeric_or_null( $body['cost'] ?? null ),
            'inventory_qty'     => (int) ( $body['inventory_qty'] ?? 0 ),
            'track_inventory'   => ( $body['track_inventory'] ?? true ) ? 1 : 0,
            'status'            => $body['status'] ?? 'draft',
            'product_type'      => $body['product_type'] ?? 'simple',
            'tags'              => wp_json_encode( $body['tags'] ?? [] ),
            'categories'        => wp_json_encode( $body['categories'] ?? [] ),
            'images'            => wp_json_encode( $body['images'] ?? [] ),
            'weight'            => blu_to_numeric_or_null( $body['weight'] ?? null ),
            'dimensions'        => wp_json_encode( $body['dimensions'] ?? new stdClass ),
        ];

        global $wpdb;
        $inserted = $wpdb->insert( $t, $data );

        if ( false === $inserted ) {
            error_log( 'Blu insert failed: ' . $wpdb->last_error );
            error_log( 'Blu insert data: ' . wp_json_encode( $data ) );
            return blu_error( 'Failed to create product: ' . $wpdb->last_error, 500 );
        }

        $product = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $id ] );

        if ( ! $product ) {
            error_log( 'Blu: insert reported success but SELECT returned null for id=' . $id );
            return blu_error( 'Product created but could not be retrieved', 500 );
        }

        // ── Auto-sync to WooCommerce (never crash the create response) ──
        $wc_warning = null;
        if ( class_exists( 'Blu_Woo_Auto_Sync' ) && class_exists( 'WooCommerce' ) ) {
            try {
                Blu_Woo_Auto_Sync::push_product_to_wc( $product );
                // Refresh to pick up woo_product_id
                $product = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $id ] );
            } catch ( \Throwable $e ) {
                $wc_warning = $e->getMessage();
                error_log( 'Blu WC sync failed for product ' . $id . ': ' . $wc_warning );
            }
        }

        self::decode_json_columns( $product );

        $resp = [ 'product' => $product, 'message' => 'Product created successfully' ];
        if ( $wc_warning ) {
            $resp['wc_sync_warning'] = $wc_warning;
        }

        return blu_success( $resp, 201 );
    }

    /* ─── PUT /products/:id ─── */
    public static function update_product( WP_REST_Request $req ) {
        $id   = $req->get_param( 'id' );
        $mid  = blu_merchant_id();
        $body = $req->get_json_params();
        $t    = blu_table( 'products' );

        // Verify product exists (don't rely on affected rows — an update with
        // identical values returns 0 affected but isn't an error)
        $exists = Blu_DB::get_var(
            "SELECT COUNT(*) FROM {$t} WHERE id = %s AND merchant_id = %s",
            [ $id, $mid ]
        );
        if ( ! $exists ) {
            return blu_error( 'Product not found', 404 );
        }

        // Only columns that exist in the DB schema
        $allowed = [
            'name', 'slug', 'description', 'short_description',
            'price', 'compare_at_price', 'cost',
            'inventory_qty', 'track_inventory',
            'status', 'product_type',
            'tags', 'categories', 'images',
            'weight', 'dimensions',
        ];

        // Auto-generate slug if name updated but slug not
        if ( isset( $body['name'] ) && ! isset( $body['slug'] ) ) {
            $body['slug'] = blu_slugify( $body['name'] );
        }

        $update = [];
        foreach ( $body as $key => $val ) {
            if ( ! in_array( $key, $allowed, true ) ) continue;

            if ( in_array( $key, [ 'images', 'dimensions', 'tags', 'categories' ], true ) ) {
                $val = wp_json_encode( $val );
            }
            if ( $key === 'track_inventory' ) {
                $val = $val ? 1 : 0;
            }
            if ( in_array( $key, [ 'compare_at_price', 'cost', 'weight' ], true ) ) {
                $val = blu_to_numeric_or_null( $val );
            }
            if ( $key === 'price' ) {
                $val = blu_to_numeric_or_null( $val ) ?? 0;
            }

            $update[ $key ] = $val;
        }

        if ( empty( $update ) ) {
            return blu_error( 'No fields to update' );
        }

        // Build SET clause — handle NULLs properly
        global $wpdb;
        $sets   = [];
        $values = [];
        foreach ( $update as $col => $val ) {
            if ( $val === null ) {
                $sets[] = "`{$col}` = NULL";
            } else {
                $sets[]   = "`{$col}` = %s";
                $values[] = $val;
            }
        }
        $sets[] = 'version = version + 1';
        $sets[] = 'updated_at = NOW()';
        $values[] = $id;
        $values[] = $mid;

        $sql = "UPDATE {$t} SET " . implode( ', ', $sets ) . " WHERE id = %s AND merchant_id = %s";
        $sql = $wpdb->prepare( $sql, ...$values );
        $wpdb->query( $sql );

        if ( $wpdb->last_error ) {
            error_log( 'Blu update_product SQL error: ' . $wpdb->last_error );
            return blu_error( 'Update failed: ' . $wpdb->last_error, 500 );
        }

        $product = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $id ] );

        // ── Auto-sync to WooCommerce (non-blocking) ──
        if ( class_exists( 'Blu_Woo_Auto_Sync' ) && class_exists( 'WooCommerce' ) && $product ) {
            try {
                Blu_Woo_Auto_Sync::push_product_to_wc( $product );
                $product = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $id ] );
            } catch ( \Throwable $e ) {
                error_log( 'Blu WC sync failed for product ' . $id . ': ' . $e->getMessage() );
            }
        }

        if ( $product ) {
            self::decode_json_columns( $product );
        }

        return blu_success( [ 'product' => $product, 'message' => 'Product updated successfully' ] );
    }

    /* ─── DELETE /products/:id ─── */
    public static function delete_product( WP_REST_Request $req ) {
        $id  = $req->get_param( 'id' );
        $mid = blu_merchant_id();
        $t   = blu_table( 'products' );

        $product = Blu_DB::get_row(
            "SELECT woo_product_id FROM {$t} WHERE id = %s AND merchant_id = %s",
            [ $id, $mid ]
        );

        $affected = Blu_DB::query(
            "DELETE FROM {$t} WHERE id = %s AND merchant_id = %s",
            [ $id, $mid ]
        );

        if ( ! $affected ) {
            return blu_error( 'Product not found', 404 );
        }

        if ( $product && $product->woo_product_id && class_exists( 'Blu_Woo_Auto_Sync' ) ) {
            try {
                Blu_Woo_Auto_Sync::delete_wc_product( (int) $product->woo_product_id );
            } catch ( \Throwable $e ) {
                error_log( 'Blu WC delete sync failed: ' . $e->getMessage() );
            }
        }

        return blu_success( [ 'message' => 'Product deleted successfully' ] );
    }

    /* ─── Helper: decode JSON columns on a product object ─── */
    private static function decode_json_columns( object &$product ): void {
        $product->tags       = json_decode( $product->tags ?? '[]' );
        $product->categories = json_decode( $product->categories ?? '[]' );
        $product->images     = json_decode( $product->images ?? '[]' );
        $product->dimensions = json_decode( $product->dimensions ?? '{}' );
        // Safe defaults for nullable string fields (frontend calls .toLowerCase() on these)
        $product->sku         = $product->sku ?? '';
        $product->description = $product->description ?? '';
    }

    /* ─── Helper: full product with platforms, options, variants ─── */
    private static function fetch_full_product( string $where_clause, array $params ) {
        $tp  = blu_table( 'products' );
        $tm  = blu_table( 'product_platform_mappings' );
        $ta  = blu_table( 'platform_adapters' );
        $to  = blu_table( 'product_options' );
        $tov = blu_table( 'product_option_values' );
        $tv  = blu_table( 'product_variants' );

        $row = Blu_DB::get_row(
            "SELECT p.* FROM {$tp} p WHERE {$where_clause}",
            $params
        );

        if ( ! $row ) return null;

        self::decode_json_columns( $row );

        // Platforms
        $row->platforms = Blu_DB::get_results(
            "SELECT ppm.id, pa.platform_type, pa.platform_name,
                    ppm.platform_id, ppm.platform_url, ppm.sync_status, ppm.last_synced_at
             FROM {$tm} ppm
             JOIN {$ta} pa ON ppm.platform_adapter_id = pa.id
             WHERE ppm.product_id = %s",
            [ $row->id ]
        );

        // Options with values
        $options = Blu_DB::get_results(
            "SELECT id, name, position FROM {$to} WHERE product_id = %s ORDER BY position",
            [ $row->id ]
        );
        foreach ( $options as &$opt ) {
            $opt->values = Blu_DB::get_results(
                "SELECT id, value, position, color_hex, image_url
                 FROM {$tov} WHERE option_id = %s ORDER BY position",
                [ $opt->id ]
            );
        }
        $row->options = $options;

        // Active variants
        $row->variants = Blu_DB::get_results(
            "SELECT id, sku, price, compare_at_price, inventory_qty, track_inventory,
                    is_active, option_value_ids, option_values_display, image_url, position
             FROM {$tv} WHERE product_id = %s AND is_active = 1 ORDER BY position",
            [ $row->id ]
        );
        foreach ( $row->variants as &$v ) {
            $v->option_value_ids = json_decode( $v->option_value_ids ?? '[]' );
        }

        return $row;
    }
}
