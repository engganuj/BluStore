<?php
/**
 * Blu Store – Abandoned Carts REST Controller
 *
 * Endpoints for listing abandoned carts, viewing stats/analytics,
 * managing recovery email settings, and triggering manual emails.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_Abandoned_Carts_Controller {

    public static function register( string $ns ): void {
        $admin = [ Blu_REST_API::class, 'admin_permission' ];

        // List carts (paginated, filterable)
        register_rest_route( $ns, '/abandoned-carts', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'list_carts' ],
            'permission_callback' => $admin,
        ] );

        // KPI stats
        register_rest_route( $ns, '/abandoned-carts/stats', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'get_stats' ],
            'permission_callback' => $admin,
        ] );

        // Analytics (time-series for charts)
        register_rest_route( $ns, '/abandoned-carts/analytics', [
            'methods'             => 'GET',
            'callback'            => [ __CLASS__, 'get_analytics' ],
            'permission_callback' => $admin,
        ] );

        // Settings
        register_rest_route( $ns, '/abandoned-carts/settings', [
            [ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_settings' ],    'permission_callback' => $admin ],
            [ 'methods' => 'PUT',  'callback' => [ __CLASS__, 'update_settings' ], 'permission_callback' => $admin ],
        ] );

        // Test email
        register_rest_route( $ns, '/abandoned-carts/test-email', [
            'methods'             => 'POST',
            'callback'            => [ __CLASS__, 'send_test_email' ],
            'permission_callback' => $admin,
        ] );

        // Single cart
        register_rest_route( $ns, '/abandoned-carts/(?P<id>[a-f0-9-]+)', [
            [ 'methods' => 'GET',    'callback' => [ __CLASS__, 'get_cart' ],    'permission_callback' => $admin ],
            [ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'delete_cart' ], 'permission_callback' => $admin ],
        ] );

        // Manual email send
        register_rest_route( $ns, '/abandoned-carts/(?P<id>[a-f0-9-]+)/send-email', [
            'methods'             => 'POST',
            'callback'            => [ __CLASS__, 'send_email' ],
            'permission_callback' => $admin,
        ] );
    }

    /* ─── List ─── */
    public static function list_carts( WP_REST_Request $req ): WP_REST_Response {
        $mid    = blu_merchant_id();
        $t      = blu_table( 'abandoned_carts' );
        $status = sanitize_text_field( $req->get_param( 'status' ) ?? '' );
        $search = sanitize_text_field( $req->get_param( 'search' ) ?? '' );
        $limit  = (int) ( $req->get_param( 'limit' ) ?? 50 );
        $offset = (int) ( $req->get_param( 'offset' ) ?? 0 );
        $sort   = sanitize_text_field( $req->get_param( 'sort' ) ?? 'updated_at' );
        $order  = strtoupper( $req->get_param( 'order' ) ?? 'DESC' ) === 'ASC' ? 'ASC' : 'DESC';

        $allowed_sorts = [ 'updated_at', 'created_at', 'abandoned_at', 'cart_total_cents', 'emails_sent' ];
        if ( ! in_array( $sort, $allowed_sorts, true ) ) {
            $sort = 'updated_at';
        }

        $where = "WHERE merchant_id = %s";
        $params = [ $mid ];

        if ( $status && $status !== 'all' ) {
            $where .= " AND status = %s";
            $params[] = $status;
        } else {
            // Exclude active carts from the list by default
            $where .= " AND status != 'active'";
        }

        if ( $search ) {
            $like = '%' . $GLOBALS['wpdb']->esc_like( $search ) . '%';
            $where .= " AND (customer_email LIKE %s OR customer_name LIKE %s)";
            $params[] = $like;
            $params[] = $like;
        }

        $total = (int) Blu_DB::get_var(
            "SELECT COUNT(*) FROM {$t} {$where}",
            $params
        );

        $rows = Blu_DB::get_results(
            "SELECT * FROM {$t} {$where} ORDER BY {$sort} {$order} LIMIT %d OFFSET %d",
            array_merge( $params, [ $limit, $offset ] )
        );

        // Decode cart_contents JSON
        foreach ( $rows as &$row ) {
            $row->cart_contents = json_decode( $row->cart_contents, true ) ?: [];
            $row->item_count = array_sum( array_column( $row->cart_contents, 'quantity' ) );
        }

        return blu_success( [
            'carts'  => $rows,
            'total'  => $total,
            'limit'  => $limit,
            'offset' => $offset,
        ] );
    }

    /* ─── Stats ─── */
    public static function get_stats( WP_REST_Request $req ): WP_REST_Response {
        $mid  = blu_merchant_id();
        $t    = blu_table( 'abandoned_carts' );
        $days = (int) ( $req->get_param( 'days' ) ?? 30 );

        $abandoned_count = (int) Blu_DB::get_var(
            "SELECT COUNT(*) FROM {$t}
             WHERE merchant_id = %s AND status = 'abandoned'
               AND abandoned_at >= DATE_SUB(NOW(), INTERVAL %d DAY)",
            [ $mid, $days ]
        );

        $recovered_count = (int) Blu_DB::get_var(
            "SELECT COUNT(*) FROM {$t}
             WHERE merchant_id = %s AND status IN ('recovered', 'converted')
               AND recovered_at >= DATE_SUB(NOW(), INTERVAL %d DAY)",
            [ $mid, $days ]
        );

        $converted_count = (int) Blu_DB::get_var(
            "SELECT COUNT(*) FROM {$t}
             WHERE merchant_id = %s AND status = 'converted'
               AND recovered_at >= DATE_SUB(NOW(), INTERVAL %d DAY)",
            [ $mid, $days ]
        );

        $revenue_recovered = (int) Blu_DB::get_var(
            "SELECT COALESCE(SUM(cart_total_cents), 0) FROM {$t}
             WHERE merchant_id = %s AND status = 'converted'
               AND recovered_at >= DATE_SUB(NOW(), INTERVAL %d DAY)",
            [ $mid, $days ]
        );

        $avg_cart_value = (int) Blu_DB::get_var(
            "SELECT COALESCE(AVG(cart_total_cents), 0) FROM {$t}
             WHERE merchant_id = %s AND status IN ('abandoned', 'recovered', 'converted')
               AND abandoned_at >= DATE_SUB(NOW(), INTERVAL %d DAY)",
            [ $mid, $days ]
        );

        $total_abandoned_value = (int) Blu_DB::get_var(
            "SELECT COALESCE(SUM(cart_total_cents), 0) FROM {$t}
             WHERE merchant_id = %s AND status = 'abandoned'
               AND abandoned_at >= DATE_SUB(NOW(), INTERVAL %d DAY)",
            [ $mid, $days ]
        );

        $total_for_rate = $abandoned_count + $recovered_count;
        $recovery_rate = $total_for_rate > 0
            ? round( ( $recovered_count / $total_for_rate ) * 100, 1 )
            : 0;

        // Email performance
        $email_stats = [];
        for ( $step = 1; $step <= 3; $step++ ) {
            $sent_col    = "email{$step}_sent_at";
            $opened_col  = "email{$step}_opened_at";
            $clicked_col = "email{$step}_clicked_at";

            $sent = (int) Blu_DB::get_var(
                "SELECT COUNT(*) FROM {$t} WHERE merchant_id = %s AND {$sent_col} IS NOT NULL
                   AND {$sent_col} >= DATE_SUB(NOW(), INTERVAL %d DAY)",
                [ $mid, $days ]
            );
            $opened = (int) Blu_DB::get_var(
                "SELECT COUNT(*) FROM {$t} WHERE merchant_id = %s AND {$opened_col} IS NOT NULL
                   AND {$opened_col} >= DATE_SUB(NOW(), INTERVAL %d DAY)",
                [ $mid, $days ]
            );
            $clicked = (int) Blu_DB::get_var(
                "SELECT COUNT(*) FROM {$t} WHERE merchant_id = %s AND {$clicked_col} IS NOT NULL
                   AND {$clicked_col} >= DATE_SUB(NOW(), INTERVAL %d DAY)",
                [ $mid, $days ]
            );

            $email_stats[] = [
                'step'         => $step,
                'sent'         => $sent,
                'opened'       => $opened,
                'clicked'      => $clicked,
                'open_rate'    => $sent > 0 ? round( $opened / $sent * 100, 1 ) : 0,
                'click_rate'   => $sent > 0 ? round( $clicked / $sent * 100, 1 ) : 0,
            ];
        }

        return blu_success( [
            'days'                  => $days,
            'abandoned_count'       => $abandoned_count,
            'recovered_count'       => $recovered_count,
            'converted_count'       => $converted_count,
            'recovery_rate'         => $recovery_rate,
            'revenue_recovered'     => $revenue_recovered,
            'avg_cart_value'        => $avg_cart_value,
            'total_abandoned_value' => $total_abandoned_value,
            'email_stats'           => $email_stats,
        ] );
    }

    /* ─── Analytics (time-series) ─── */
    public static function get_analytics( WP_REST_Request $req ): WP_REST_Response {
        $mid  = blu_merchant_id();
        $t    = blu_table( 'abandoned_carts' );
        $days = (int) ( $req->get_param( 'days' ) ?? 30 );

        // Daily abandoned vs recovered
        $abandoned_by_day = Blu_DB::get_results(
            "SELECT DATE(abandoned_at) as date, COUNT(*) as count, SUM(cart_total_cents) as value
             FROM {$t}
             WHERE merchant_id = %s AND abandoned_at >= DATE_SUB(NOW(), INTERVAL %d DAY)
               AND status IN ('abandoned', 'recovered', 'converted')
             GROUP BY DATE(abandoned_at) ORDER BY date",
            [ $mid, $days ]
        );

        $recovered_by_day = Blu_DB::get_results(
            "SELECT DATE(recovered_at) as date, COUNT(*) as count, SUM(cart_total_cents) as value
             FROM {$t}
             WHERE merchant_id = %s AND recovered_at >= DATE_SUB(NOW(), INTERVAL %d DAY)
               AND status IN ('recovered', 'converted')
             GROUP BY DATE(recovered_at) ORDER BY date",
            [ $mid, $days ]
        );

        // Top abandoned products
        $all_abandoned = Blu_DB::get_results(
            "SELECT cart_contents FROM {$t}
             WHERE merchant_id = %s AND status IN ('abandoned', 'recovered', 'converted')
               AND abandoned_at >= DATE_SUB(NOW(), INTERVAL %d DAY)",
            [ $mid, $days ]
        );

        $product_counts = [];
        foreach ( $all_abandoned as $row ) {
            $items = json_decode( $row->cart_contents, true ) ?: [];
            foreach ( $items as $item ) {
                $name = $item['name'] ?? 'Unknown';
                if ( ! isset( $product_counts[ $name ] ) ) {
                    $product_counts[ $name ] = [
                        'name'      => $name,
                        'count'     => 0,
                        'image_url' => $item['image_url'] ?? '',
                    ];
                }
                $product_counts[ $name ]['count'] += (int) ( $item['quantity'] ?? 1 );
            }
        }
        usort( $product_counts, fn( $a, $b ) => $b['count'] - $a['count'] );
        $top_products = array_slice( array_values( $product_counts ), 0, 10 );

        return blu_success( [
            'abandoned_by_day'  => $abandoned_by_day,
            'recovered_by_day'  => $recovered_by_day,
            'top_products'      => $top_products,
        ] );
    }

    /* ─── Single cart ─── */
    public static function get_cart( WP_REST_Request $req ): WP_REST_Response {
        $mid = blu_merchant_id();
        $t   = blu_table( 'abandoned_carts' );
        $id  = $req->get_param( 'id' );

        $cart = Blu_DB::get_row(
            "SELECT * FROM {$t} WHERE id = %s AND merchant_id = %s",
            [ $id, $mid ]
        );

        if ( ! $cart ) {
            return blu_success( [ 'error' => 'Cart not found' ], 404 );
        }

        $cart->cart_contents = json_decode( $cart->cart_contents, true ) ?: [];
        $cart->item_count = array_sum( array_column( $cart->cart_contents, 'quantity' ) );

        return blu_success( [ 'cart' => $cart ] );
    }

    /* ─── Delete ─── */
    public static function delete_cart( WP_REST_Request $req ): WP_REST_Response {
        $mid = blu_merchant_id();
        $t   = blu_table( 'abandoned_carts' );
        $id  = $req->get_param( 'id' );

        Blu_DB::query(
            "DELETE FROM {$t} WHERE id = %s AND merchant_id = %s",
            [ $id, $mid ]
        );

        return blu_success( [ 'deleted' => true ] );
    }

    /* ─── Manual email send ─── */
    public static function send_email( WP_REST_Request $req ): WP_REST_Response {
        $mid = blu_merchant_id();
        $t   = blu_table( 'abandoned_carts' );
        $id  = $req->get_param( 'id' );

        $cart = Blu_DB::get_row(
            "SELECT * FROM {$t} WHERE id = %s AND merchant_id = %s",
            [ $id, $mid ]
        );

        if ( ! $cart ) {
            return blu_success( [ 'error' => 'Cart not found' ], 404 );
        }
        if ( empty( $cart->customer_email ) ) {
            return blu_success( [ 'error' => 'No email address on this cart' ], 400 );
        }

        $step = min( (int) $cart->emails_sent + 1, 3 );
        $settings = Blu_Abandoned_Cart_Cron::get_settings( $mid );
        $store    = self::get_store_info_static( $mid );

        // Generate discount for steps 2+
        if ( $step >= 2 && empty( $cart->discount_code ) ) {
            $pct_key = "email{$step}_discount_pct";
            $pct = (int) $settings->$pct_key;
            if ( $pct > 0 ) {
                $code = 'RECOVER-' . strtoupper( substr( bin2hex( random_bytes( 3 ) ), 0, 6 ) );
                $dt = blu_table( 'discounts' );
                Blu_DB::insert( $dt, [
                    'id'                       => blu_uuid(),
                    'merchant_id'              => $mid,
                    'code'                     => $code,
                    'description'              => 'Cart recovery discount for ' . $cart->customer_email,
                    'type'                     => 'percentage',
                    'value'                    => $pct,
                    'usage_limit'              => 1,
                    'usage_limit_per_customer' => 1,
                    'starts_at'                => current_time( 'mysql', true ),
                    'expires_at'               => gmdate( 'Y-m-d H:i:s', strtotime( '+7 days' ) ),
                ] );
                Blu_DB::query(
                    "UPDATE {$t} SET discount_code = %s WHERE id = %s",
                    [ $code, $cart->id ]
                );
                $cart->discount_code = $code;
            }
        }

        // Use reflection to call the private build method — or make it public
        $subject_key = "email{$step}_subject";
        $subject = $settings->$subject_key;

        // Build email using the cron class method
        $html = self::build_recovery_email( $cart, $mid, $step, $settings );

        $headers = [
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . get_bloginfo( 'name' ) . ' <' . get_option( 'admin_email' ) . '>',
        ];

        $sent = wp_mail( $cart->customer_email, $subject, $html, $headers );

        if ( $sent ) {
            $sent_col = "email{$step}_sent_at";
            Blu_DB::query(
                "UPDATE {$t} SET emails_sent = %d, {$sent_col} = NOW(), last_email_sent_at = NOW(), updated_at = NOW() WHERE id = %s",
                [ $step, $cart->id ]
            );
        }

        return blu_success( [
            'sent'  => $sent,
            'step'  => $step,
            'email' => $cart->customer_email,
        ] );
    }

    /**
     * Build recovery email HTML — delegates to the cron class.
     */
    private static function build_recovery_email( object $cart, string $mid, int $step, object $settings ): string {
        // Use the cron class build method (it's accessible since we're in the same plugin)
        $store = self::get_store_info_static( $mid );

        $items      = json_decode( $cart->cart_contents, true ) ?: [];
        $first_name = explode( ' ', $cart->customer_name ?? '' )[0] ?: 'there';

        $recovery_url = add_query_arg( [
            'blu_recover_cart' => $cart->recovery_token,
            'email'            => $step,
        ], site_url() );

        $pixel_url = add_query_arg( [
            'blu_cart_pixel' => $cart->recovery_token,
            'email'          => $step,
        ], site_url() );

        $discount_pct  = 0;
        $discount_code = $cart->discount_code ?? '';
        if ( $step >= 2 ) {
            $pct_key      = "email{$step}_discount_pct";
            $discount_pct = (int) $settings->$pct_key;
        }

        $symbols = [
            'USD' => '$', 'CAD' => '$', 'AUD' => '$', 'NZD' => '$', 'SGD' => '$', 'MXN' => '$',
            'GBP' => '£', 'EUR' => '€', 'JPY' => '¥', 'INR' => '₹', 'BRL' => 'R$',
            'SEK' => 'kr', 'NOK' => 'kr', 'DKK' => 'kr', 'CHF' => 'Fr',
        ];
        $currency_symbol = $symbols[ $cart->currency ?? 'USD' ] ?? '$';

        // Build items HTML
        $items_html = '';
        foreach ( $items as $item ) {
            $img = $item['image_url']
                ? '<img src="' . esc_url( $item['image_url'] ) . '" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #E2E8F0;">'
                : '<div style="width:64px;height:64px;background:#F1F5F9;border-radius:8px;border:1px solid #E2E8F0;"></div>';
            $price = $currency_symbol . number_format( $item['price_cents'] / 100, 2 );
            $items_html .= '<tr><td style="padding:12px 0;border-bottom:1px solid #F1F5F9;"><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td width="64" style="vertical-align:top;">' . $img . '</td><td style="vertical-align:top;padding-left:16px;"><p style="margin:0 0 4px;font-weight:600;color:#1E293B;font-size:14px;">' . esc_html( $item['name'] ) . '</p><p style="margin:0;color:#64748B;font-size:13px;">Qty: ' . (int) $item['quantity'] . '</p></td><td width="80" style="vertical-align:top;text-align:right;"><p style="margin:0;font-weight:600;color:#1E293B;font-size:14px;">' . $price . '</p></td></tr></table></td></tr>';
        }

        $total = $currency_symbol . number_format( $cart->cart_total_cents / 100, 2 );

        switch ( $step ) {
            case 1:
                $headline = 'You left something behind';
                $intro    = "Hi {$first_name}, we noticed you didn&#39;t finish checking out. Your items are still waiting for you.";
                $cta_text = 'Complete Your Purchase';
                break;
            case 2:
                $headline = 'Still thinking it over?';
                $intro    = "Hi {$first_name}, your cart is still saved. To make it easier, here&#39;s <strong>{$discount_pct}% off</strong> your order.";
                $cta_text = "Use Code {$discount_code} &amp; Save";
                break;
            default:
                $headline = 'Last chance — your cart is expiring';
                $intro    = "Hi {$first_name}, your items won&#39;t be reserved much longer. Use code <strong>{$discount_code}</strong> for <strong>{$discount_pct}% off</strong>.";
                $cta_text = "Claim Your {$discount_pct}% Off Now";
        }

        $logo_html = ! empty( $store['logo_url'] )
            ? '<img src="' . esc_url( $store['logo_url'] ) . '" alt="' . esc_attr( $store['name'] ) . '" style="max-height:40px;width:auto;">'
            : '<span style="font-size:20px;font-weight:700;color:#1E293B;">' . esc_html( $store['name'] ) . '</span>';

        $discount_banner = '';
        if ( $step >= 2 && $discount_pct > 0 && $discount_code ) {
            $discount_banner = '<div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:20px;text-align:center;margin:24px 0;"><p style="margin:0 0 8px;color:#1E40AF;font-size:14px;font-weight:600;">YOUR EXCLUSIVE DISCOUNT</p><p style="margin:0 0 8px;font-size:32px;font-weight:800;color:#2563EB;letter-spacing:2px;">' . esc_html( $discount_code ) . '</p><p style="margin:0;color:#3B82F6;font-size:14px;">' . $discount_pct . '% off · Expires in 7 days</p></div>';
        }

        return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;padding:40px 20px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);"><tr><td style="padding:32px 40px;text-align:center;border-bottom:1px solid #F1F5F9;">' . $logo_html . '</td></tr><tr><td style="padding:40px;"><h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1E293B;text-align:center;">' . esc_html( $headline ) . '</h1><p style="margin:0 0 32px;font-size:15px;color:#475569;line-height:1.6;text-align:center;">' . $intro . '</p>' . $discount_banner . '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">' . $items_html . '</table><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:16px 0;border-top:2px solid #E2E8F0;"><span style="font-size:15px;color:#64748B;">Total</span></td><td style="padding:16px 0;border-top:2px solid #E2E8F0;text-align:right;"><span style="font-size:18px;font-weight:700;color:#1E293B;">' . $total . '</span></td></tr></table><table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;"><tr><td align="center"><a href="' . esc_url( $recovery_url ) . '" style="display:inline-block;padding:16px 48px;background:#2563EB;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:600;border-radius:12px;">' . $cta_text . '</a></td></tr></table></td></tr><tr><td style="padding:24px 40px;background:#F8FAFC;border-top:1px solid #F1F5F9;text-align:center;"><p style="margin:0;font-size:12px;color:#94A3B8;">You received this because you started a checkout at ' . esc_html( $store['name'] ) . '.</p></td></tr></table><img src="' . esc_url( $pixel_url ) . '" width="1" height="1" style="display:none;" alt=""></td></tr></table></body></html>';
    }

    private static function get_store_info_static( string $mid ): array {
        $st = blu_table( 'store_settings' );
        $mt = blu_table( 'merchants' );
        $store = Blu_DB::get_row( "SELECT * FROM {$st} WHERE merchant_id = %s", [ $mid ] );
        $merch = Blu_DB::get_row( "SELECT name, logo_url FROM {$mt} WHERE id = %s", [ $mid ] );

        return [
            'name'     => $merch->name ?? get_bloginfo( 'name' ),
            'email'    => $store->support_email ?? get_option( 'admin_email' ),
            'logo_url' => $merch->logo_url ?? '',
            'address'  => implode( ', ', array_filter( [
                $store->address_line1 ?? '', $store->city ?? '', $store->state ?? '', $store->postal_code ?? '',
            ] ) ) ?: ( $merch->name ?? 'Blu Store' ),
        ];
    }

    /* ─── Settings ─── */
    public static function get_settings( WP_REST_Request $req ): WP_REST_Response {
        $mid      = blu_merchant_id();
        $settings = Blu_Abandoned_Cart_Cron::get_settings( $mid );
        return blu_success( [ 'settings' => $settings ] );
    }

    public static function update_settings( WP_REST_Request $req ): WP_REST_Response {
        $mid  = blu_merchant_id();
        $t    = blu_table( 'abandoned_cart_settings' );
        $body = $req->get_json_params();

        $existing = Blu_DB::get_row(
            "SELECT id FROM {$t} WHERE merchant_id = %s",
            [ $mid ]
        );

        $data = [
            'merchant_id'          => $mid,
            'enabled'              => isset( $body['enabled'] ) ? (int) $body['enabled'] : 1,
            'abandonment_timeout'  => isset( $body['abandonment_timeout'] ) ? max( 15, (int) $body['abandonment_timeout'] ) : 60,
            'email1_enabled'       => isset( $body['email1_enabled'] ) ? (int) $body['email1_enabled'] : 1,
            'email1_delay'         => isset( $body['email1_delay'] ) ? max( 15, (int) $body['email1_delay'] ) : 60,
            'email1_subject'       => sanitize_text_field( $body['email1_subject'] ?? 'You left something behind' ),
            'email2_enabled'       => isset( $body['email2_enabled'] ) ? (int) $body['email2_enabled'] : 1,
            'email2_delay'         => isset( $body['email2_delay'] ) ? max( 60, (int) $body['email2_delay'] ) : 1440,
            'email2_subject'       => sanitize_text_field( $body['email2_subject'] ?? 'Still thinking it over?' ),
            'email2_discount_pct'  => isset( $body['email2_discount_pct'] ) ? min( 100, max( 0, (int) $body['email2_discount_pct'] ) ) : 10,
            'email3_enabled'       => isset( $body['email3_enabled'] ) ? (int) $body['email3_enabled'] : 1,
            'email3_delay'         => isset( $body['email3_delay'] ) ? max( 120, (int) $body['email3_delay'] ) : 4320,
            'email3_subject'       => sanitize_text_field( $body['email3_subject'] ?? 'Last chance — your cart is expiring' ),
            'email3_discount_pct'  => isset( $body['email3_discount_pct'] ) ? min( 100, max( 0, (int) $body['email3_discount_pct'] ) ) : 15,
            'cart_expiry_days'     => isset( $body['cart_expiry_days'] ) ? max( 1, (int) $body['cart_expiry_days'] ) : 30,
        ];

        if ( $existing ) {
            Blu_DB::query(
                "UPDATE {$t} SET
                    enabled = %d, abandonment_timeout = %d,
                    email1_enabled = %d, email1_delay = %d, email1_subject = %s,
                    email2_enabled = %d, email2_delay = %d, email2_subject = %s, email2_discount_pct = %d,
                    email3_enabled = %d, email3_delay = %d, email3_subject = %s, email3_discount_pct = %d,
                    cart_expiry_days = %d, updated_at = NOW()
                 WHERE id = %s",
                [
                    $data['enabled'], $data['abandonment_timeout'],
                    $data['email1_enabled'], $data['email1_delay'], $data['email1_subject'],
                    $data['email2_enabled'], $data['email2_delay'], $data['email2_subject'], $data['email2_discount_pct'],
                    $data['email3_enabled'], $data['email3_delay'], $data['email3_subject'], $data['email3_discount_pct'],
                    $data['cart_expiry_days'],
                    $existing->id,
                ]
            );
        } else {
            $data['id'] = blu_uuid();
            Blu_DB::insert( $t, $data );
        }

        $settings = Blu_Abandoned_Cart_Cron::get_settings( $mid );
        return blu_success( [ 'settings' => $settings ] );
    }

    /* ─── Test email ─── */
    public static function send_test_email( WP_REST_Request $req ): WP_REST_Response {
        $mid  = blu_merchant_id();
        $sent = Blu_Abandoned_Cart_Cron::send_test_email( $mid );

        return blu_success( [
            'sent'  => $sent,
            'email' => get_option( 'admin_email' ),
        ] );
    }
}
