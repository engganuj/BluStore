<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/* ═══════════════════════════════════════════════════════════
 *  STORE CONTROLLER
 * ═══════════════════════════════════════════════════════════ */
class Blu_Store_Controller {
    public static function register( string $ns ): void {
        $admin = [ Blu_REST_API::class, 'admin_permission' ];

        register_rest_route( $ns, '/store', [
            [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'get_store' ], 'permission_callback' => $admin ],
            [ 'methods' => 'PUT', 'callback' => [ __CLASS__, 'update_store' ], 'permission_callback' => $admin ],
        ] );
        register_rest_route( $ns, '/store/public', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'get_public' ], 'permission_callback' => '__return_true',
        ] );

        // ── Tax configuration ──
        register_rest_route( $ns, '/store/tax', [
            [ 'methods' => 'GET', 'callback' => [ __CLASS__, 'get_tax' ], 'permission_callback' => $admin ],
            [ 'methods' => 'PUT', 'callback' => [ __CLASS__, 'update_tax' ], 'permission_callback' => $admin ],
        ] );
    }

    public static function get_store(): WP_REST_Response {
        $t   = blu_table( 'merchants' );
        $mid = blu_merchant_id();
        $row = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $mid ] );

        if ( ! $row ) {
            return blu_error( 'Store not found', 404 );
        }

        // Hydrate Blu Store row with current WP/WC values so the Settings page
        // always reflects what WordPress actually has — even if the merchant
        // row was never explicitly saved from the Blu Store UI.
        if ( class_exists( 'WooCommerce' ) ) {
            self::hydrate_from_wp( $row );
        }

        return blu_success( [ 'store' => $row ] );
    }

    public static function get_public(): WP_REST_Response {
        $t   = blu_table( 'merchants' );
        $row = Blu_DB::get_row(
            "SELECT name, slug, logo_url, tagline, support_email, website_url, currency, pdp_template FROM {$t} WHERE id = %s",
            [ blu_merchant_id() ]
        );
        return blu_success( [ 'store' => $row ] );
    }

    public static function update_store( WP_REST_Request $req ): WP_REST_Response {
        $body = $req->get_json_params();
        $t    = blu_table( 'merchants' );
        $mid  = blu_merchant_id();

        $fields = [
            'name', 'logo_url', 'tagline', 'support_email', 'website_url',
            'currency', 'address_line1', 'address_line2', 'city', 'state',
            'postal_code', 'country', 'phone', 'pdp_template',
        ];

        $update = [];
        foreach ( $fields as $f ) {
            if ( array_key_exists( $f, $body ) ) {
                $update[ $f ] = $body[ $f ] ?: null;
            }
        }

        // Also update slug when name changes
        if ( ! empty( $update['name'] ) ) {
            $update['slug'] = blu_slugify( $update['name'] );
        }

        if ( ! empty( $update ) ) {
            Blu_DB::update( $t, $update, [ 'id' => $mid ] );
        }

        // ── Push to WordPress / WooCommerce options ──
        self::sync_to_wp( $body );

        $row = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $mid ] );
        return blu_success( [ 'store' => $row, 'message' => 'Settings saved' ] );
    }

    /* ──────────────────────────────────────────────────────────
     * TAX CONFIGURATION
     *
     * Stored in wp_options (not merchant table) since these are
     * global store settings.  Synced to WooCommerce when active.
     *
     * Options:
     *   blu_store_tax_enabled     – 0/1
     *   blu_store_tax_rate        – decimal (e.g. 8.25)
     *   blu_store_tax_inclusive   – 0/1 (prices include tax)
     *   blu_store_tax_label       – string (e.g. "Sales Tax")
     *   blu_store_tax_shipping    – 0/1 (apply tax to shipping)
     * ────────────────────────────────────────────────────────── */

    public static function get_tax(): WP_REST_Response {
        $tax = self::read_tax_settings();

        // Hydrate from WooCommerce if available and we've never saved
        if ( class_exists( 'WooCommerce' ) && get_option( 'blu_store_tax_enabled' ) === false ) {
            $wc_enabled = get_option( 'woocommerce_calc_taxes', 'no' ) === 'yes';
            $tax['enabled'] = $wc_enabled;
            $tax['inclusive'] = get_option( 'woocommerce_prices_include_tax', 'no' ) === 'yes';
            $tax['shipping_taxable'] = get_option( 'woocommerce_shipping_tax_class', '' ) !== 'zero-rate';

            // Try to get default rate from WC tax table
            if ( $wc_enabled ) {
                global $wpdb;
                $rate = $wpdb->get_var(
                    "SELECT tax_rate FROM {$wpdb->prefix}woocommerce_tax_rates WHERE tax_rate_priority = 1 ORDER BY tax_rate_id LIMIT 1"
                );
                if ( $rate ) {
                    $tax['rate'] = (float) $rate;
                }
            }
        }

        return blu_success( [ 'tax' => $tax ] );
    }

    public static function update_tax( WP_REST_Request $req ): WP_REST_Response {
        $body = $req->get_json_params();

        if ( isset( $body['enabled'] ) ) {
            update_option( 'blu_store_tax_enabled', $body['enabled'] ? '1' : '0' );
        }
        if ( isset( $body['rate'] ) ) {
            $rate = max( 0, min( 100, (float) $body['rate'] ) );
            update_option( 'blu_store_tax_rate', (string) $rate );
        }
        if ( isset( $body['inclusive'] ) ) {
            update_option( 'blu_store_tax_inclusive', $body['inclusive'] ? '1' : '0' );
        }
        if ( isset( $body['label'] ) ) {
            update_option( 'blu_store_tax_label', sanitize_text_field( $body['label'] ) );
        }
        if ( isset( $body['shipping_taxable'] ) ) {
            update_option( 'blu_store_tax_shipping', $body['shipping_taxable'] ? '1' : '0' );
        }

        // ── Sync to WooCommerce ──
        self::sync_tax_to_wc();

        return blu_success( [
            'tax'     => self::read_tax_settings(),
            'message' => 'Tax settings saved',
        ] );
    }

    private static function read_tax_settings(): array {
        return [
            'enabled'          => (bool) get_option( 'blu_store_tax_enabled', false ),
            'rate'             => (float) get_option( 'blu_store_tax_rate', 0 ),
            'inclusive'        => (bool) get_option( 'blu_store_tax_inclusive', false ),
            'label'            => get_option( 'blu_store_tax_label', 'Tax' ),
            'shipping_taxable' => (bool) get_option( 'blu_store_tax_shipping', false ),
        ];
    }

    /**
     * Push Blu Store tax settings into WooCommerce.
     *
     * - Toggles woocommerce_calc_taxes
     * - Sets prices-include-tax mode
     * - Upserts the default tax rate row (priority 1, country *, rate = our %)
     */
    private static function sync_tax_to_wc(): void {
        if ( ! class_exists( 'WooCommerce' ) ) return;

        $enabled   = (bool) get_option( 'blu_store_tax_enabled', false );
        $rate      = (float) get_option( 'blu_store_tax_rate', 0 );
        $inclusive = (bool) get_option( 'blu_store_tax_inclusive', false );
        $label     = get_option( 'blu_store_tax_label', 'Tax' );
        $ship_tax  = (bool) get_option( 'blu_store_tax_shipping', false );

        update_option( 'woocommerce_calc_taxes', $enabled ? 'yes' : 'no' );
        update_option( 'woocommerce_prices_include_tax', $inclusive ? 'yes' : 'no' );
        update_option( 'woocommerce_shipping_tax_class', $ship_tax ? '' : 'zero-rate' );
        update_option( 'woocommerce_tax_display_shop', $inclusive ? 'incl' : 'excl' );
        update_option( 'woocommerce_tax_display_cart', $inclusive ? 'incl' : 'excl' );

        // Upsert default tax rate in WC tax rates table
        global $wpdb;
        $table = $wpdb->prefix . 'woocommerce_tax_rates';

        // Check if table exists (WC may not have been set up yet)
        if ( $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ) !== $table ) return;

        $existing = $wpdb->get_row(
            "SELECT tax_rate_id FROM {$table} WHERE tax_rate_name = 'Blu Store Default' LIMIT 1"
        );

        $data = [
            'tax_rate_country'  => '',
            'tax_rate_state'    => '',
            'tax_rate'          => (string) $rate,
            'tax_rate_name'     => 'Blu Store Default',
            'tax_rate_priority' => 1,
            'tax_rate_compound' => 0,
            'tax_rate_shipping' => $ship_tax ? 1 : 0,
            'tax_rate_order'    => 0,
            'tax_rate_class'    => '',
        ];

        if ( $existing ) {
            $wpdb->update( $table, $data, [ 'tax_rate_id' => $existing->tax_rate_id ] );
        } else if ( $enabled && $rate > 0 ) {
            $wpdb->insert( $table, $data );
        }

        // Clear WC tax transients
        \WC_Tax::_delete_tax_rate_caches();
    }

    /* ──────────────────────────────────────────────────────────
     * SYNC: Blu Store → WordPress / WooCommerce options
     *
     * Mapping:
     *   name           → blogname (WP site title)
     *   tagline        → blogdescription (WP tagline)
     *   logo_url       → custom_logo theme mod (sideload to media library)
     *   support_email  → woocommerce_email_from_address
     *   phone          → blu_store_phone (custom, WC has no native phone)
     *   website_url    → blu_store_website_url (don't touch siteurl/home)
     *   address_line1  → woocommerce_store_address
     *   address_line2  → woocommerce_store_address_2
     *   city           → woocommerce_store_city
     *   state+country  → woocommerce_default_country  (format: "US:CA")
     *   postal_code    → woocommerce_store_postcode
     *   currency       → woocommerce_currency
     * ────────────────────────────────────────────────────────── */
    private static function sync_to_wp( array $body ): void {

        // ── WordPress core ──
        if ( ! empty( $body['name'] ) ) {
            update_option( 'blogname', sanitize_text_field( $body['name'] ) );
        }

        if ( array_key_exists( 'tagline', $body ) ) {
            update_option( 'blogdescription', sanitize_text_field( $body['tagline'] ?? '' ) );
        }

        // Logo: sideload URL to media library → set as custom_logo
        if ( ! empty( $body['logo_url'] ) ) {
            self::sync_logo( $body['logo_url'] );
        }

        // ── WooCommerce options (only if WC is active) ──
        if ( ! class_exists( 'WooCommerce' ) ) {
            return;
        }

        if ( ! empty( $body['support_email'] ) ) {
            update_option( 'woocommerce_email_from_address', sanitize_email( $body['support_email'] ) );
            // Also set the "from name" to store name if we have it
            if ( ! empty( $body['name'] ) ) {
                update_option( 'woocommerce_email_from_name', sanitize_text_field( $body['name'] ) );
            }
        }

        if ( array_key_exists( 'phone', $body ) ) {
            update_option( 'blu_store_phone', sanitize_text_field( $body['phone'] ?? '' ) );
        }

        if ( array_key_exists( 'website_url', $body ) ) {
            update_option( 'blu_store_website_url', esc_url_raw( $body['website_url'] ?? '' ) );
        }

        if ( array_key_exists( 'address_line1', $body ) ) {
            update_option( 'woocommerce_store_address', sanitize_text_field( $body['address_line1'] ?? '' ) );
        }

        if ( array_key_exists( 'address_line2', $body ) ) {
            update_option( 'woocommerce_store_address_2', sanitize_text_field( $body['address_line2'] ?? '' ) );
        }

        if ( array_key_exists( 'city', $body ) ) {
            update_option( 'woocommerce_store_city', sanitize_text_field( $body['city'] ?? '' ) );
        }

        if ( array_key_exists( 'postal_code', $body ) ) {
            update_option( 'woocommerce_store_postcode', sanitize_text_field( $body['postal_code'] ?? '' ) );
        }

        // Country + State → woocommerce_default_country in "US:CA" format
        if ( array_key_exists( 'country', $body ) || array_key_exists( 'state', $body ) ) {
            $country = sanitize_text_field( $body['country'] ?? get_option( 'woocommerce_default_country', 'US' ) );
            $state   = sanitize_text_field( $body['state'] ?? '' );

            // WC stores as "US:CA" if state is present, "US" if not
            // But current value may already have "US:XX" — extract country if we only got state
            $current = get_option( 'woocommerce_default_country', 'US' );
            if ( ! array_key_exists( 'country', $body ) && str_contains( $current, ':' ) ) {
                $country = explode( ':', $current )[0];
            }

            $wc_location = $state ? "{$country}:{$state}" : $country;
            update_option( 'woocommerce_default_country', $wc_location );
        }

        if ( array_key_exists( 'currency', $body ) ) {
            $currency = strtoupper( sanitize_text_field( $body['currency'] ?? 'USD' ) );
            update_option( 'woocommerce_currency', $currency );
        }
    }

    /* ──────────────────────────────────────────────────────────
     * SYNC: WordPress / WooCommerce → Blu Store (read direction)
     *
     * Fills in the Blu Store merchant row with current WP/WC values
     * so the Settings page always shows what's really configured.
     * ────────────────────────────────────────────────────────── */
    private static function hydrate_from_wp( object &$row ): void {

        // WordPress core
        if ( empty( $row->name ) ) {
            $row->name = get_option( 'blogname', '' );
        }
        if ( empty( $row->tagline ) ) {
            $row->tagline = get_option( 'blogdescription', '' );
        }

        // Logo: get URL from custom_logo attachment
        if ( empty( $row->logo_url ) ) {
            $custom_logo_id = get_theme_mod( 'custom_logo' );
            if ( $custom_logo_id ) {
                $row->logo_url = wp_get_attachment_url( $custom_logo_id );
            }
        }

        // WooCommerce options
        if ( empty( $row->support_email ) ) {
            $row->support_email = get_option( 'woocommerce_email_from_address', get_option( 'admin_email', '' ) );
        }
        if ( empty( $row->phone ) ) {
            $row->phone = get_option( 'blu_store_phone', '' );
        }
        if ( empty( $row->website_url ) ) {
            $row->website_url = get_option( 'blu_store_website_url', get_option( 'siteurl', '' ) );
        }
        if ( empty( $row->address_line1 ) ) {
            $row->address_line1 = get_option( 'woocommerce_store_address', '' );
        }
        if ( empty( $row->address_line2 ) ) {
            $row->address_line2 = get_option( 'woocommerce_store_address_2', '' );
        }
        if ( empty( $row->city ) ) {
            $row->city = get_option( 'woocommerce_store_city', '' );
        }
        if ( empty( $row->postal_code ) ) {
            $row->postal_code = get_option( 'woocommerce_store_postcode', '' );
        }

        // Country/State — WC stores as "US:CA"
        $wc_location = get_option( 'woocommerce_default_country', 'US' );
        if ( str_contains( $wc_location, ':' ) ) {
            [ $wc_country, $wc_state ] = explode( ':', $wc_location, 2 );
        } else {
            $wc_country = $wc_location;
            $wc_state   = '';
        }
        if ( empty( $row->country ) ) {
            $row->country = $wc_country;
        }
        if ( empty( $row->state ) ) {
            $row->state = $wc_state;
        }

        if ( empty( $row->currency ) ) {
            $row->currency = get_option( 'woocommerce_currency', 'USD' );
        }
    }

    /* ──────────────────────────────────────────────────────────
     * Logo sideload: download URL → WP media library → theme mod
     * ────────────────────────────────────────────────────────── */
    private static function sync_logo( string $url ): void {
        // If it's already a local WP upload URL, just find its attachment ID
        $upload_dir = wp_get_upload_dir();
        if ( str_starts_with( $url, $upload_dir['baseurl'] ) ) {
            $att_id = attachment_url_to_postid( $url );
            if ( $att_id ) {
                set_theme_mod( 'custom_logo', $att_id );
                return;
            }
        }

        // Skip base64 data URIs for logo (too large for theme mod)
        if ( str_starts_with( $url, 'data:' ) ) {
            return;
        }

        // Sideload external URL into media library
        if ( ! function_exists( 'media_sideload_image' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }

        $att_id = media_sideload_image( $url, 0, 'Store Logo', 'id' );
        if ( ! is_wp_error( $att_id ) ) {
            set_theme_mod( 'custom_logo', $att_id );
        } else {
            error_log( 'Blu logo sideload failed: ' . $att_id->get_error_message() );
        }
    }
}

/* ═══════════════════════════════════════════════════════════
 *  CUSTOMERS CONTROLLER  (CRM)
 *
 *  Uses the dedicated wp_blu_customers table for profile data
 *  (contact info, tags, notes) and derives order statistics
 *  from wp_blu_orders in real-time — no sync lag.
 *
 *  Auto-creates customer records for every unique order email
 *  so the two tables stay in lockstep automatically.
 * ═══════════════════════════════════════════════════════════ */
class Blu_Customers_Controller {

    public static function register( string $ns ): void {
        $admin = [ Blu_REST_API::class, 'admin_permission' ];

        // List & Create
        register_rest_route( $ns, '/customers', [
            [ 'methods' => 'GET',  'callback' => [ __CLASS__, 'list_customers' ],  'permission_callback' => $admin ],
            [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'create_customer' ], 'permission_callback' => $admin ],
        ] );

        // Email lookup (used by Order detail → "View profile" link)
        register_rest_route( $ns, '/customers/lookup', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'lookup_by_email' ], 'permission_callback' => $admin,
        ] );

        // Sync from orders (bulk back-fill)
        register_rest_route( $ns, '/customers/sync', [
            'methods' => 'POST', 'callback' => [ __CLASS__, 'sync_from_orders' ], 'permission_callback' => $admin,
        ] );

        // Single customer CRUD
        register_rest_route( $ns, '/customers/(?P<id>[a-f0-9-]+)', [
            [ 'methods' => 'GET',    'callback' => [ __CLASS__, 'get_customer' ],    'permission_callback' => $admin ],
            [ 'methods' => 'PUT',    'callback' => [ __CLASS__, 'update_customer' ], 'permission_callback' => $admin ],
            [ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'delete_customer' ], 'permission_callback' => $admin ],
        ] );

        // Notes
        register_rest_route( $ns, '/customers/(?P<id>[a-f0-9-]+)/notes', [
            'methods' => 'POST', 'callback' => [ __CLASS__, 'add_note' ], 'permission_callback' => $admin,
        ] );
        register_rest_route( $ns, '/customers/(?P<id>[a-f0-9-]+)/notes/(?P<note_id>[a-f0-9-]+)', [
            'methods' => 'DELETE', 'callback' => [ __CLASS__, 'delete_note' ], 'permission_callback' => $admin,
        ] );
    }

    /* ── List ──────────────────────────────────────────────────
     *
     * Params: search, segment (all|vip|repeat|new|at_risk),
     *         sort (last_order|total_spent|order_count|name|created),
     *         order (ASC|DESC), limit, offset, tag
     * ──────────────────────────────────────────────────────── */

    public static function list_customers( WP_REST_Request $req ): WP_REST_Response {
        $mid     = blu_merchant_id();
        $search  = $req->get_param( 'search' );
        $segment = $req->get_param( 'segment' ) ?: 'all';
        $sort    = $req->get_param( 'sort' ) ?: 'last_order';
        $dir     = strtoupper( $req->get_param( 'order' ) ?: 'DESC' ) === 'ASC' ? 'ASC' : 'DESC';
        $limit   = (int) ( $req->get_param( 'limit' ) ?: 25 );
        $offset  = (int) ( $req->get_param( 'offset' ) ?: 0 );
        $tag     = $req->get_param( 'tag' );

        $to = blu_table( 'orders' );
        $tc = blu_table( 'customers' );

        // Auto-create customer records for any new order emails
        self::ensure_customer_records( $mid );

        // ── Build query ──
        $os_sub = "(SELECT customer_email,
                           COUNT(*) AS order_count,
                           SUM(total_cents) AS total_spent_cents,
                           MAX(created_at) AS last_order_at,
                           MIN(created_at) AS first_order_at,
                           AVG(total_cents) AS avg_order_cents
                    FROM {$to}
                    WHERE merchant_id = %s AND customer_email IS NOT NULL
                    GROUP BY customer_email)";

        $select = "c.id, c.email, c.first_name, c.last_name, c.phone,
                   c.city, c.state, c.country, c.tags, c.created_at AS customer_since,
                   COALESCE(os.order_count, 0)       AS order_count,
                   COALESCE(os.total_spent_cents, 0)  AS total_spent_cents,
                   os.last_order_at, os.first_order_at,
                   COALESCE(os.avg_order_cents, 0)    AS avg_order_cents";

        $from = "{$tc} c LEFT JOIN {$os_sub} os ON os.customer_email = c.email";

        // params[0] = subquery merchant_id, params[1] = outer WHERE merchant_id
        $where  = [ 'c.merchant_id = %s' ];
        $params = [ $mid, $mid ];

        if ( $search ) {
            $like     = '%' . $search . '%';
            $where[]  = "(c.email LIKE %s OR c.first_name LIKE %s OR c.last_name LIKE %s
                          OR CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,'')) LIKE %s)";
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        if ( $tag ) {
            $where[]  = "JSON_CONTAINS(c.tags, %s)";
            $params[] = wp_json_encode( $tag );
        }

        // Segment filters
        switch ( $segment ) {
            case 'vip':
                $where[] = "(COALESCE(os.total_spent_cents,0) >= 50000 OR COALESCE(os.order_count,0) >= 5)";
                break;
            case 'repeat':
                $where[] = "COALESCE(os.order_count,0) >= 2";
                break;
            case 'new':
                $where[] = "os.first_order_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
                break;
            case 'at_risk':
                $where[] = "COALESCE(os.order_count,0) >= 2 AND os.last_order_at < DATE_SUB(NOW(), INTERVAL 90 DAY)";
                break;
        }

        $w = implode( ' AND ', $where );

        $sort_map = [
            'last_order'  => 'os.last_order_at',
            'total_spent' => 'COALESCE(os.total_spent_cents,0)',
            'order_count' => 'COALESCE(os.order_count,0)',
            'name'        => "CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,''))",
            'created'     => 'c.created_at',
        ];
        $sort_col = $sort_map[ $sort ] ?? 'os.last_order_at';

        $total = (int) Blu_DB::get_var(
            "SELECT COUNT(*) FROM {$from} WHERE {$w}",
            $params
        );

        $rows = Blu_DB::get_results(
            "SELECT {$select} FROM {$from} WHERE {$w} ORDER BY {$sort_col} {$dir} LIMIT %d OFFSET %d",
            array_merge( $params, [ $limit, $offset ] )
        );

        foreach ( $rows as &$row ) {
            $row->tags = $row->tags ? json_decode( $row->tags, true ) : [];
        }

        // Segment counts (unfiltered — always show all segment badges)
        $segment_counts = Blu_DB::get_row( "
            SELECT
                COUNT(*)                                                                                     AS all_count,
                SUM(CASE WHEN COALESCE(os.total_spent_cents,0) >= 50000
                           OR COALESCE(os.order_count,0) >= 5             THEN 1 ELSE 0 END)                 AS vip_count,
                SUM(CASE WHEN COALESCE(os.order_count,0) >= 2            THEN 1 ELSE 0 END)                 AS repeat_count,
                SUM(CASE WHEN os.first_order_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END)      AS new_count,
                SUM(CASE WHEN COALESCE(os.order_count,0) >= 2
                          AND os.last_order_at < DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 ELSE 0 END)        AS at_risk_count
            FROM {$from} WHERE c.merchant_id = %s
        ", [ $mid, $mid ] );

        $stats = Blu_DB::get_row(
            "SELECT COUNT(DISTINCT customer_email) AS total_customers,
                    COUNT(*) AS total_orders, SUM(total_cents) AS total_revenue_cents
             FROM {$to} WHERE merchant_id = %s AND customer_email IS NOT NULL",
            [ $mid ]
        );

        return blu_success( [
            'customers'      => $rows,
            'total'          => $total,
            'limit'          => $limit,
            'offset'         => $offset,
            'stats'          => $stats,
            'segment_counts' => $segment_counts,
        ] );
    }

    /* ── Single ───────────────────────────────────────────── */

    public static function get_customer( WP_REST_Request $req ): WP_REST_Response {
        $id  = $req->get_param( 'id' );
        $mid = blu_merchant_id();
        $to  = blu_table( 'orders' );
        $ti  = blu_table( 'order_items' );
        $tc  = blu_table( 'customers' );

        $customer = Blu_DB::get_row(
            "SELECT * FROM {$tc} WHERE id = %s AND merchant_id = %s",
            [ $id, $mid ]
        );
        if ( ! $customer ) return blu_error( 'Customer not found', 404 );

        $ostats = Blu_DB::get_row(
            "SELECT COUNT(*) AS order_count,
                    SUM(total_cents)  AS total_spent_cents,
                    MAX(created_at)   AS last_order_at,
                    MIN(created_at)   AS first_order_at,
                    AVG(total_cents)  AS avg_order_cents
             FROM {$to} WHERE merchant_id = %s AND customer_email = %s",
            [ $mid, $customer->email ]
        );

        $orders = Blu_DB::get_results(
            "SELECT id, order_number, status, total_cents, shipping_address, created_at
             FROM {$to}
             WHERE merchant_id = %s AND customer_email = %s
             ORDER BY created_at DESC",
            [ $mid, $customer->email ]
        );

        $top_products = Blu_DB::get_results(
            "SELECT oi.product_name, SUM(oi.quantity) AS total_quantity, COUNT(DISTINCT o.id) AS order_count
             FROM {$ti} oi JOIN {$to} o ON oi.order_id = o.id
             WHERE o.merchant_id = %s AND o.customer_email = %s
             GROUP BY oi.product_name ORDER BY total_quantity DESC LIMIT 5",
            [ $mid, $customer->email ]
        );

        $customer->tags          = $customer->tags  ? json_decode( $customer->tags, true )  : [];
        $customer->notes         = $customer->notes ? json_decode( $customer->notes, true ) : [];
        $customer->order_count       = (int) ( $ostats->order_count ?? 0 );
        $customer->total_spent_cents = (int) ( $ostats->total_spent_cents ?? 0 );
        $customer->avg_order_cents   = (int) ( $ostats->avg_order_cents ?? 0 );
        $customer->last_order_at     = $ostats->last_order_at  ?? null;
        $customer->first_order_at    = $ostats->first_order_at ?? null;
        $customer->orders            = $orders;
        $customer->top_products      = $top_products;

        return blu_success( [ 'customer' => $customer ] );
    }

    /* ── Create ───────────────────────────────────────────── */

    public static function create_customer( WP_REST_Request $req ): WP_REST_Response {
        $body = $req->get_json_params();
        $tc   = blu_table( 'customers' );
        $mid  = blu_merchant_id();

        if ( empty( $body['email'] ) ) return blu_error( 'Email is required', 400 );

        $existing = Blu_DB::get_var(
            "SELECT id FROM {$tc} WHERE merchant_id = %s AND email = %s",
            [ $mid, $body['email'] ]
        );
        if ( $existing ) return blu_error( 'A customer with this email already exists', 409 );

        $id = blu_uuid();
        Blu_DB::insert( $tc, [
            'id'            => $id,
            'merchant_id'   => $mid,
            'email'         => sanitize_email( $body['email'] ),
            'first_name'    => sanitize_text_field( $body['first_name'] ?? '' ) ?: null,
            'last_name'     => sanitize_text_field( $body['last_name'] ?? '' ) ?: null,
            'phone'         => sanitize_text_field( $body['phone'] ?? '' ) ?: null,
            'address_line1' => sanitize_text_field( $body['address_line1'] ?? '' ) ?: null,
            'address_line2' => sanitize_text_field( $body['address_line2'] ?? '' ) ?: null,
            'city'          => sanitize_text_field( $body['city'] ?? '' ) ?: null,
            'state'         => sanitize_text_field( $body['state'] ?? '' ) ?: null,
            'postal_code'   => sanitize_text_field( $body['postal_code'] ?? '' ) ?: null,
            'country'       => sanitize_text_field( $body['country'] ?? 'US' ),
            'tags'          => wp_json_encode( $body['tags'] ?? [] ),
            'notes'         => '[]',
        ] );

        $row = Blu_DB::get_row( "SELECT * FROM {$tc} WHERE id = %s", [ $id ] );
        $row->tags  = json_decode( $row->tags, true )  ?: [];
        $row->notes = json_decode( $row->notes, true ) ?: [];

        return blu_success( [ 'customer' => $row ], 201 );
    }

    /* ── Update ───────────────────────────────────────────── */

    public static function update_customer( WP_REST_Request $req ): WP_REST_Response {
        $body = $req->get_json_params();
        $tc   = blu_table( 'customers' );
        $id   = $req->get_param( 'id' );
        $mid  = blu_merchant_id();

        $fields = [ 'first_name', 'last_name', 'email', 'phone',
                     'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country' ];
        $update = [];
        foreach ( $fields as $f ) {
            if ( array_key_exists( $f, $body ) ) {
                $update[ $f ] = sanitize_text_field( $body[ $f ] ) ?: null;
            }
        }
        if ( array_key_exists( 'tags', $body ) ) {
            $update['tags'] = wp_json_encode( $body['tags'] ?: [] );
        }
        if ( empty( $update ) ) return blu_error( 'No fields to update' );

        Blu_DB::update( $tc, $update, [ 'id' => $id, 'merchant_id' => $mid ] );

        $row = Blu_DB::get_row( "SELECT * FROM {$tc} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
        if ( ! $row ) return blu_error( 'Customer not found', 404 );

        $row->tags  = $row->tags  ? json_decode( $row->tags, true )  : [];
        $row->notes = $row->notes ? json_decode( $row->notes, true ) : [];

        return blu_success( [ 'customer' => $row ] );
    }

    /* ── Delete ───────────────────────────────────────────── */

    public static function delete_customer( WP_REST_Request $req ): WP_REST_Response {
        $tc = blu_table( 'customers' );
        $a  = Blu_DB::delete( $tc, [ 'id' => $req->get_param( 'id' ), 'merchant_id' => blu_merchant_id() ] );
        if ( ! $a ) return blu_error( 'Customer not found', 404 );
        return blu_success( [ 'message' => 'Customer deleted' ] );
    }

    /* ── Notes ────────────────────────────────────────────── */

    public static function add_note( WP_REST_Request $req ): WP_REST_Response {
        $body = $req->get_json_params();
        $tc   = blu_table( 'customers' );
        $id   = $req->get_param( 'id' );
        $mid  = blu_merchant_id();

        if ( empty( $body['text'] ) ) return blu_error( 'Note text is required', 400 );

        $row = Blu_DB::get_row( "SELECT notes FROM {$tc} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
        if ( ! $row ) return blu_error( 'Customer not found', 404 );

        $notes = $row->notes ? json_decode( $row->notes, true ) : [];
        $note  = [
            'id'         => blu_uuid(),
            'text'       => sanitize_textarea_field( $body['text'] ),
            'created_at' => current_time( 'mysql', true ),
        ];
        array_unshift( $notes, $note );

        Blu_DB::update( $tc, [ 'notes' => wp_json_encode( $notes ) ], [ 'id' => $id ] );

        return blu_success( [ 'note' => $note, 'notes' => $notes ] );
    }

    public static function delete_note( WP_REST_Request $req ): WP_REST_Response {
        $tc      = blu_table( 'customers' );
        $id      = $req->get_param( 'id' );
        $note_id = $req->get_param( 'note_id' );
        $mid     = blu_merchant_id();

        $row = Blu_DB::get_row( "SELECT notes FROM {$tc} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
        if ( ! $row ) return blu_error( 'Customer not found', 404 );

        $notes = $row->notes ? json_decode( $row->notes, true ) : [];
        $notes = array_values( array_filter( $notes, fn( $n ) => $n['id'] !== $note_id ) );

        Blu_DB::update( $tc, [ 'notes' => wp_json_encode( $notes ) ], [ 'id' => $id ] );

        return blu_success( [ 'notes' => $notes ] );
    }

    /* ── Lookup by email ──────────────────────────────────── */

    public static function lookup_by_email( WP_REST_Request $req ): WP_REST_Response {
        $email = $req->get_param( 'email' );
        if ( ! $email ) return blu_error( 'Email parameter required', 400 );

        $mid = blu_merchant_id();
        self::ensure_customer_records( $mid );

        $tc = blu_table( 'customers' );
        $id = Blu_DB::get_var(
            "SELECT id FROM {$tc} WHERE merchant_id = %s AND email = %s",
            [ $mid, $email ]
        );
        if ( ! $id ) return blu_error( 'Customer not found', 404 );

        return blu_success( [ 'customer_id' => $id ] );
    }

    /* ── Sync from orders ─────────────────────────────────── */

    public static function sync_from_orders(): WP_REST_Response {
        $count = self::ensure_customer_records( blu_merchant_id() );
        return blu_success( [ 'synced' => $count, 'message' => "{$count} customer records created" ] );
    }

    /* ── Helpers ──────────────────────────────────────────── */

    private static function ensure_customer_records( string $mid ): int {
        $to = blu_table( 'orders' );
        $tc = blu_table( 'customers' );

        $missing = Blu_DB::get_results(
            "SELECT o.customer_email, MAX(o.customer_name) AS customer_name
             FROM {$to} o
             LEFT JOIN {$tc} c ON c.email = o.customer_email AND c.merchant_id = o.merchant_id
             WHERE o.merchant_id = %s AND o.customer_email IS NOT NULL AND o.customer_email != '' AND c.id IS NULL
             GROUP BY o.customer_email",
            [ $mid ]
        );

        $count = 0;
        foreach ( $missing as $row ) {
            $parts = array_pad( explode( ' ', trim( $row->customer_name ?? '' ), 2 ), 2, null );
            Blu_DB::insert( $tc, [
                'id'          => blu_uuid(),
                'merchant_id' => $mid,
                'email'       => $row->customer_email,
                'first_name'  => $parts[0] ?: null,
                'last_name'   => $parts[1] ?: null,
                'tags'        => '[]',
                'notes'       => '[]',
            ] );
            $count++;
        }

        return $count;
    }
}

/* ═══════════════════════════════════════════════════════════
 *  SHIPPING CONTROLLER
 * ═══════════════════════════════════════════════════════════ */
class Blu_Shipping_Controller {
    public static function register( string $ns ): void {
        $admin = [ Blu_REST_API::class, 'admin_permission' ];

        register_rest_route( $ns, '/shipping', [
            [ 'methods' => 'GET',  'callback' => [ __CLASS__, 'list_options' ],  'permission_callback' => $admin ],
            [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'create_option' ], 'permission_callback' => $admin ],
        ] );
        register_rest_route( $ns, '/shipping/(?P<id>[a-f0-9-]+)', [
            [ 'methods' => 'GET',    'callback' => [ __CLASS__, 'get_option' ],    'permission_callback' => $admin ],
            [ 'methods' => 'PUT',    'callback' => [ __CLASS__, 'update_option' ], 'permission_callback' => $admin ],
            [ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'delete_option' ], 'permission_callback' => $admin ],
        ] );
    }

    public static function list_options( WP_REST_Request $req ): WP_REST_Response {
        $t   = blu_table( 'shipping_options' );
        $mid = blu_merchant_id();
        $active = $req->get_param( 'active_only' ) === 'true' ? ' AND is_active = 1' : '';
        $rows = Blu_DB::get_results( "SELECT * FROM {$t} WHERE merchant_id = %s{$active} ORDER BY sort_order ASC", [ $mid ] );
        return blu_success( [ 'shipping_options' => $rows ] );
    }

    public static function get_option( WP_REST_Request $req ) {
        $t   = blu_table( 'shipping_options' );
        $row = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s AND merchant_id = %s", [ $req->get_param( 'id' ), blu_merchant_id() ] );
        if ( ! $row ) return blu_error( 'Shipping option not found', 404 );
        return blu_success( [ 'shipping_option' => $row ] );
    }

    public static function create_option( WP_REST_Request $req ): WP_REST_Response {
        $body = $req->get_json_params();
        $t    = blu_table( 'shipping_options' );
        $mid  = blu_merchant_id();

        if ( empty( $body['name'] ) ) return blu_success( [ 'error' => 'Name is required' ], 400 );

        if ( ! empty( $body['is_default'] ) ) {
            Blu_DB::query( "UPDATE {$t} SET is_default = 0 WHERE merchant_id = %s", [ $mid ] );
        }

        $id = blu_uuid();
        Blu_DB::insert( $t, [
            'id'          => $id, 'merchant_id' => $mid,
            'name'        => $body['name'], 'description' => $body['description'] ?? null,
            'price_cents' => (int) ( $body['price_cents'] ?? 0 ),
            'min_days'    => $body['min_days'] ?? null, 'max_days' => $body['max_days'] ?? null,
            'free_shipping_threshold_cents' => $body['free_shipping_threshold_cents'] ?? null,
            'is_default'  => ! empty( $body['is_default'] ) ? 1 : 0,
            'is_active'   => ( $body['is_active'] ?? true ) ? 1 : 0,
            'sort_order'  => (int) ( $body['sort_order'] ?? 0 ),
        ] );

        $row = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $id ] );
        return blu_success( [ 'shipping_option' => $row ], 201 );
    }

    public static function update_option( WP_REST_Request $req ) {
        $body = $req->get_json_params();
        $t    = blu_table( 'shipping_options' );
        $id   = $req->get_param( 'id' );
        $mid  = blu_merchant_id();

        if ( ! empty( $body['is_default'] ) ) {
            Blu_DB::query( "UPDATE {$t} SET is_default = 0 WHERE merchant_id = %s AND id != %s", [ $mid, $id ] );
        }

        $update = [];
        foreach ( [ 'name','description','price_cents','min_days','max_days','free_shipping_threshold_cents','is_default','is_active','sort_order' ] as $f ) {
            if ( array_key_exists( $f, $body ) ) {
                $update[ $f ] = $body[ $f ];
            }
        }
        if ( empty( $update ) ) return blu_error( 'No fields to update' );

        Blu_DB::update( $t, $update, [ 'id' => $id, 'merchant_id' => $mid ] );
        $row = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $id ] );
        if ( ! $row ) return blu_error( 'Shipping option not found', 404 );
        return blu_success( [ 'shipping_option' => $row ] );
    }

    public static function delete_option( WP_REST_Request $req ) {
        $t = blu_table( 'shipping_options' );
        $a = Blu_DB::delete( $t, [ 'id' => $req->get_param( 'id' ), 'merchant_id' => blu_merchant_id() ] );
        if ( ! $a ) return blu_error( 'Shipping option not found', 404 );
        return blu_success( [ 'message' => 'Shipping option deleted' ] );
    }
}

/* ═══════════════════════════════════════════════════════════
 *  DISCOUNTS CONTROLLER
 * ═══════════════════════════════════════════════════════════ */
class Blu_Discounts_Controller {
    public static function register( string $ns ): void {
        $admin = [ Blu_REST_API::class, 'admin_permission' ];

        register_rest_route( $ns, '/discounts', [
            [ 'methods' => 'GET',  'callback' => [ __CLASS__, 'list_discounts' ],  'permission_callback' => $admin ],
            [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'create_discount' ], 'permission_callback' => $admin ],
        ] );
        register_rest_route( $ns, '/discounts/validate', [
            'methods' => 'POST', 'callback' => [ __CLASS__, 'validate' ], 'permission_callback' => '__return_true',
        ] );
        register_rest_route( $ns, '/discounts/(?P<id>[a-f0-9-]+)', [
            [ 'methods' => 'GET',    'callback' => [ __CLASS__, 'get_discount' ],    'permission_callback' => $admin ],
            [ 'methods' => 'PUT',    'callback' => [ __CLASS__, 'update_discount' ], 'permission_callback' => $admin ],
            [ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'delete_discount' ], 'permission_callback' => $admin ],
        ] );
        register_rest_route( $ns, '/discounts/(?P<id>[a-f0-9-]+)/usage', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'usage' ], 'permission_callback' => $admin,
        ] );
    }

    public static function list_discounts( WP_REST_Request $req ): WP_REST_Response {
        $t      = blu_table( 'discounts' );
        $mid    = blu_merchant_id();
        $status = $req->get_param( 'status' );
        $limit  = (int) ( $req->get_param( 'limit' ) ?: 50 );

        $where  = [ "merchant_id = %s" ];
        $params = [ $mid ];
        if ( $status ) { $where[] = "status = %s"; $params[] = $status; }
        $w    = implode( ' AND ', $where );
        $rows = Blu_DB::get_results( "SELECT * FROM {$t} WHERE {$w} ORDER BY created_at DESC LIMIT %d", array_merge( $params, [ $limit ] ) );
        return blu_success( [ 'discounts' => $rows ] );
    }

    public static function get_discount( WP_REST_Request $req ) {
        $t   = blu_table( 'discounts' );
        $row = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s AND merchant_id = %s", [ $req->get_param( 'id' ), blu_merchant_id() ] );
        if ( ! $row ) return blu_error( 'Discount not found', 404 );
        return blu_success( [ 'discount' => $row ] );
    }

    public static function create_discount( WP_REST_Request $req ): WP_REST_Response {
        $body = $req->get_json_params();
        $t    = blu_table( 'discounts' );
        $mid  = blu_merchant_id();

        if ( empty( $body['code'] ) || ! isset( $body['value'] ) ) return blu_success( [ 'error' => 'Code and value are required' ], 400 );

        $id = blu_uuid();
        Blu_DB::insert( $t, [
            'id' => $id, 'merchant_id' => $mid,
            'code' => strtoupper( $body['code'] ), 'description' => $body['description'] ?? null,
            'type' => $body['type'] ?? 'percentage', 'value' => $body['value'],
            'minimum_order_amount'    => $body['minimum_order_amount'] ?? null,
            'maximum_discount_amount' => $body['maximum_discount_amount'] ?? null,
            'usage_limit'             => $body['usage_limit'] ?? null,
            'usage_limit_per_customer'=> $body['usage_limit_per_customer'] ?? null,
            'starts_at'  => $body['starts_at'] ?? current_time( 'mysql', true ),
            'expires_at' => $body['expires_at'] ?? null,
            'applies_to_products'   => wp_json_encode( $body['applies_to_products'] ?? null ),
            'applies_to_categories' => wp_json_encode( $body['applies_to_categories'] ?? null ),
            'excluded_products'     => wp_json_encode( $body['excluded_products'] ?? null ),
        ] );

        $row = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $id ] );

        // Sync to WooCommerce coupon
        self::sync_to_wc_coupon( $row );

        return blu_success( [ 'discount' => $row ], 201 );
    }

    public static function update_discount( WP_REST_Request $req ) {
        $body = $req->get_json_params();
        $t    = blu_table( 'discounts' );
        $id   = $req->get_param( 'id' );
        $mid  = blu_merchant_id();

        $update = [];
        foreach ( [ 'code','description','type','value','minimum_order_amount','maximum_discount_amount',
                     'usage_limit','usage_limit_per_customer','starts_at','expires_at','status' ] as $f ) {
            if ( array_key_exists( $f, $body ) ) {
                $update[ $f ] = $f === 'code' ? strtoupper( $body[ $f ] ) : $body[ $f ];
            }
        }
        foreach ( [ 'applies_to_products','applies_to_categories','excluded_products' ] as $f ) {
            if ( array_key_exists( $f, $body ) ) $update[ $f ] = wp_json_encode( $body[ $f ] );
        }

        if ( empty( $update ) ) return blu_error( 'No fields to update' );
        Blu_DB::update( $t, $update, [ 'id' => $id, 'merchant_id' => $mid ] );
        $row = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $id ] );
        if ( ! $row ) return blu_error( 'Discount not found', 404 );

        // Sync to WooCommerce coupon
        self::sync_to_wc_coupon( $row );

        return blu_success( [ 'discount' => $row ] );
    }

    public static function delete_discount( WP_REST_Request $req ) {
        $t  = blu_table( 'discounts' );
        $id = $req->get_param( 'id' );
        $mid = blu_merchant_id();

        // Get discount before deleting (need code for WC coupon lookup)
        $row = Blu_DB::get_row( "SELECT code FROM {$t} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );

        $a = Blu_DB::delete( $t, [ 'id' => $id, 'merchant_id' => $mid ] );
        if ( ! $a ) return blu_error( 'Discount not found', 404 );

        // Trash the WooCommerce coupon
        if ( $row ) {
            self::delete_wc_coupon( $row->code );
        }

        return blu_success( [ 'message' => 'Discount deleted' ] );
    }

    public static function validate( WP_REST_Request $req ): WP_REST_Response {
        $body = $req->get_json_params();
        $t    = blu_table( 'discounts' );
        $td   = blu_table( 'discount_usages' );
        $mid  = blu_merchant_id();
        $code = $body['code'] ?? '';

        if ( ! $code ) return blu_success( [ 'error' => 'Discount code is required' ], 400 );

        $discount = Blu_DB::get_row( "SELECT * FROM {$t} WHERE merchant_id = %s AND LOWER(code) = LOWER(%s)", [ $mid, $code ] );
        if ( ! $discount ) return blu_success( [ 'valid' => false, 'error' => 'Invalid discount code' ], 404 );
        if ( $discount->status !== 'active' ) return blu_success( [ 'valid' => false, 'error' => 'This discount code is no longer active' ] );

        $now = current_time( 'mysql', true );
        if ( $discount->starts_at && $discount->starts_at > $now ) return blu_success( [ 'valid' => false, 'error' => 'This discount code is not yet active' ] );
        if ( $discount->expires_at && $discount->expires_at < $now ) return blu_success( [ 'valid' => false, 'error' => 'This discount code has expired' ] );
        if ( $discount->usage_limit && $discount->usage_count >= $discount->usage_limit ) return blu_success( [ 'valid' => false, 'error' => 'Usage limit reached' ] );

        $subtotal = floatval( $body['subtotal'] ?? 0 );
        if ( $discount->minimum_order_amount && $subtotal < (float) $discount->minimum_order_amount ) {
            return blu_success( [ 'valid' => false, 'error' => "Minimum order of \${$discount->minimum_order_amount} required" ] );
        }

        $amount = 0;
        if ( $discount->type === 'percentage' ) {
            $amount = $subtotal * ( (float) $discount->value / 100 );
            if ( $discount->maximum_discount_amount ) $amount = min( $amount, (float) $discount->maximum_discount_amount );
        } elseif ( $discount->type === 'fixed_amount' ) {
            $amount = (float) $discount->value;
        }

        return blu_success( [ 'valid' => true, 'discount' => [
            'id' => $discount->id, 'code' => $discount->code, 'description' => $discount->description,
            'type' => $discount->type, 'value' => (float) $discount->value,
            'discount_amount' => round( $amount, 2 ),
        ] ] );
    }

    public static function usage( WP_REST_Request $req ): WP_REST_Response {
        $id  = $req->get_param( 'id' );
        $mid = blu_merchant_id();
        $t   = blu_table( 'discounts' );
        $tu  = blu_table( 'discount_usages' );

        $discount = Blu_DB::get_row( "SELECT id, code, usage_count, usage_limit FROM {$t} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
        if ( ! $discount ) return blu_error( 'Discount not found', 404 );

        $usages = Blu_DB::get_results( "SELECT * FROM {$tu} WHERE discount_id = %s ORDER BY created_at DESC LIMIT 20", [ $id ] );
        $stats  = Blu_DB::get_row(
            "SELECT COUNT(*) AS total_uses, SUM(discount_amount) AS total_discounted,
                    SUM(order_subtotal) AS total_order_value, COUNT(DISTINCT customer_email) AS unique_customers
             FROM {$tu} WHERE discount_id = %s",
            [ $id ]
        );

        return blu_success( [ 'discount' => $discount, 'stats' => $stats, 'recent_usages' => $usages ] );
    }

    /* ──────────────────────────────────────────────────────────
     * WooCommerce Coupon Sync
     *
     * Blu Store discounts ↔ WooCommerce coupons.
     * Uses the WC_Coupon class to create/update coupons so they
     * work at WooCommerce checkout.
     *
     * Mapping:
     *   code                  → coupon code (post_title)
     *   description           → coupon description (post_excerpt)
     *   type=percentage       → discount_type = percent
     *   type=fixed_amount     → discount_type = fixed_cart
     *   type=free_shipping    → free_shipping = yes + amount = 0
     *   value                 → coupon_amount
     *   minimum_order_amount  → minimum_amount
     *   maximum_discount_amount → maximum_amount (percent only)
     *   usage_limit           → usage_limit
     *   usage_limit_per_customer → usage_limit_per_user
     *   expires_at            → date_expires
     *   status=active         → post_status = publish
     *   status=disabled       → post_status = draft
     * ────────────────────────────────────────────────────────── */

    private static function sync_to_wc_coupon( object $discount ): void {
        if ( ! class_exists( 'WooCommerce' ) || ! class_exists( 'WC_Coupon' ) ) return;

        $code = strtolower( $discount->code );

        // Find existing WC coupon by code
        $existing_id = wc_get_coupon_id_by_code( $code );
        $coupon = new \WC_Coupon( $existing_id ?: 0 );

        $coupon->set_code( $code );
        $coupon->set_description( $discount->description ?? '' );

        // Map discount type → WC discount type
        $is_free_shipping = false;
        switch ( $discount->type ) {
            case 'percentage':
                $coupon->set_discount_type( 'percent' );
                $coupon->set_amount( (float) $discount->value );
                break;
            case 'fixed_amount':
                $coupon->set_discount_type( 'fixed_cart' );
                $coupon->set_amount( (float) $discount->value );
                break;
            case 'free_shipping':
                $coupon->set_discount_type( 'percent' );
                $coupon->set_amount( 0 );
                $is_free_shipping = true;
                break;
            default:
                $coupon->set_discount_type( 'percent' );
                $coupon->set_amount( (float) $discount->value );
        }

        $coupon->set_free_shipping( $is_free_shipping );

        // Limits
        if ( $discount->minimum_order_amount ) {
            $coupon->set_minimum_amount( (float) $discount->minimum_order_amount );
        } else {
            $coupon->set_minimum_amount( '' );
        }

        if ( $discount->maximum_discount_amount ) {
            $coupon->set_maximum_amount( (float) $discount->maximum_discount_amount );
        } else {
            $coupon->set_maximum_amount( '' );
        }

        if ( $discount->usage_limit ) {
            $coupon->set_usage_limit( (int) $discount->usage_limit );
        } else {
            $coupon->set_usage_limit( 0 );
        }

        if ( $discount->usage_limit_per_customer ?? null ) {
            $coupon->set_usage_limit_per_user( (int) $discount->usage_limit_per_customer );
        } else {
            $coupon->set_usage_limit_per_user( 0 );
        }

        // Expiry
        if ( ! empty( $discount->expires_at ) ) {
            $coupon->set_date_expires( strtotime( $discount->expires_at ) );
        } else {
            $coupon->set_date_expires( null );
        }

        // Individual use? Not currently in Blu schema, default false
        $coupon->set_individual_use( false );

        // Save coupon
        $coupon->save();

        // Set status (WC coupons use post_status)
        $status = $discount->status ?? 'active';
        $post_status = ( $status === 'active' ) ? 'publish' : 'draft';
        if ( $coupon->get_id() ) {
            wp_update_post( [
                'ID'          => $coupon->get_id(),
                'post_status' => $post_status,
            ] );
        }

        // Store Blu discount ID as meta for reverse lookup
        if ( $coupon->get_id() ) {
            update_post_meta( $coupon->get_id(), '_blu_discount_id', $discount->id );
        }
    }

    private static function delete_wc_coupon( string $code ): void {
        if ( ! class_exists( 'WooCommerce' ) ) return;

        $coupon_id = wc_get_coupon_id_by_code( strtolower( $code ) );
        if ( $coupon_id ) {
            wp_trash_post( $coupon_id );
        }
    }
}
