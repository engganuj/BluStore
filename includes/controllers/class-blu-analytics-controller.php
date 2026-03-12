<?php
/**
 * Blu Store – Analytics & Reporting Controller
 *
 * Best-in-class analytics engine aggregating all store data into
 * rich, actionable metrics. Data is sourced from Blu custom tables
 * which include all synced WooCommerce data transparently.
 *
 * Endpoints:
 *   GET /analytics/overview    – Hero KPIs, sparklines, auto-generated insights
 *   GET /analytics/revenue     – Revenue timeline with comparison overlay, day-of-week, profit
 *   GET /analytics/orders      – Order volume, status funnel, hourly heatmap, fulfillment
 *   GET /analytics/products    – Top performers, velocity scoring, inventory forecasting
 *   GET /analytics/customers   – Acquisition, RFM segments, LTV distribution, cohorts
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_Analytics_Controller {

    /** Revenue-qualifying statuses */
    private const PAID = "('paid','fulfilled','shipped','processing')";

    public static function register( string $ns ): void {
        $admin = [ Blu_REST_API::class, 'admin_permission' ];

        register_rest_route( $ns, '/analytics/overview', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'overview' ], 'permission_callback' => $admin,
        ] );
        register_rest_route( $ns, '/analytics/revenue', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'revenue' ], 'permission_callback' => $admin,
        ] );
        register_rest_route( $ns, '/analytics/orders', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'orders' ], 'permission_callback' => $admin,
        ] );
        register_rest_route( $ns, '/analytics/products', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'products' ], 'permission_callback' => $admin,
        ] );
        register_rest_route( $ns, '/analytics/customers', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'customers' ], 'permission_callback' => $admin,
        ] );
    }

    /* ═══════════════════════════════════════════════════════════════
     * Helpers
     * ═══════════════════════════════════════════════════════════════ */

    private static function parse_range( WP_REST_Request $req ): array {
        $period = $req->get_param( 'period' ) ?: '30d';
        $now    = current_time( 'Y-m-d' );

        switch ( $period ) {
            case '7d':   $start = gmdate( 'Y-m-d', strtotime( '-6 days',    strtotime( $now ) ) ); break;
            case '30d':  $start = gmdate( 'Y-m-d', strtotime( '-29 days',   strtotime( $now ) ) ); break;
            case '90d':  $start = gmdate( 'Y-m-d', strtotime( '-89 days',   strtotime( $now ) ) ); break;
            case '12m':  $start = gmdate( 'Y-m-d', strtotime( '-12 months', strtotime( $now ) ) ); break;
            case 'ytd':  $start = gmdate( 'Y-01-01', strtotime( $now ) ); break;
            case 'custom':
                $start = $req->get_param( 'start' ) ?: gmdate( 'Y-m-d', strtotime( '-29 days', strtotime( $now ) ) );
                $now   = $req->get_param( 'end' )   ?: $now;
                break;
            default: $start = gmdate( 'Y-m-d', strtotime( '-29 days', strtotime( $now ) ) );
        }
        $end = $now;

        $days       = max( 1, (int) ( ( strtotime( $end ) - strtotime( $start ) ) / 86400 ) + 1 );
        $prev_end   = gmdate( 'Y-m-d', strtotime( $start ) - 86400 );
        $prev_start = gmdate( 'Y-m-d', strtotime( $prev_end ) - ( $days - 1 ) * 86400 );

        return compact( 'start', 'end', 'prev_start', 'prev_end', 'days' );
    }

    private static function pct( $cur, $prev ): ?float {
        if ( ! $prev ) return $cur > 0 ? 100.0 : null;
        return round( ( ( $cur - $prev ) / abs( $prev ) ) * 100, 1 );
    }

    private static function interval( int $days ): string {
        return $days <= 90 ? 'day' : ( $days <= 365 ? 'week' : 'month' );
    }

    private static function date_fmt( string $interval ): string {
        return match( $interval ) {
            'week'  => '%x-W%v',
            'month' => '%Y-%m',
            default => '%Y-%m-%d',
        };
    }

    private static function cast_int( &$rows, array $fields ): void {
        foreach ( $rows as &$r ) {
            foreach ( $fields as $f ) {
                if ( isset( $r->$f ) ) $r->$f = (int) $r->$f;
            }
        }
    }

    /* ═══════════════════════════════════════════════════════════════
     * OVERVIEW – Hero KPIs, sparklines, smart insights
     * ═══════════════════════════════════════════════════════════════ */

    public static function overview( WP_REST_Request $req ): WP_REST_Response {
        $mid   = blu_merchant_id();
        $range = self::parse_range( $req );
        $to    = blu_table( 'orders' );
        $ti    = blu_table( 'order_items' );
        $tc    = blu_table( 'customers' );
        $tp    = blu_table( 'products' );
        $paid  = self::PAID;

        // ── Current period KPIs ──
        $curr = Blu_DB::get_row(
            "SELECT
                COUNT(*)                                                                AS total_orders,
                COALESCE(SUM(CASE WHEN status IN {$paid} THEN total_cents END), 0)      AS revenue_cents,
                COALESCE(AVG(CASE WHEN status IN {$paid} THEN total_cents END), 0)      AS avg_order_cents,
                COUNT(DISTINCT customer_email)                                           AS unique_customers,
                COALESCE(SUM(CASE WHEN status IN {$paid} THEN subtotal_cents END), 0)   AS subtotal_cents,
                COALESCE(SUM(CASE WHEN status IN {$paid} THEN shipping_cents END), 0)   AS shipping_cents,
                COALESCE(SUM(CASE WHEN status IN {$paid} THEN tax_cents END), 0)        AS tax_cents,
                COALESCE(SUM(CASE WHEN status = 'refunded' THEN total_cents END), 0)    AS refunds_cents
             FROM {$to}
             WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s",
            [ $mid, $range['start'], $range['end'] ]
        );

        // ── Previous period KPIs ──
        $prev = Blu_DB::get_row(
            "SELECT
                COUNT(*)                                                                AS total_orders,
                COALESCE(SUM(CASE WHEN status IN {$paid} THEN total_cents END), 0)      AS revenue_cents,
                COALESCE(AVG(CASE WHEN status IN {$paid} THEN total_cents END), 0)      AS avg_order_cents,
                COUNT(DISTINCT customer_email)                                           AS unique_customers
             FROM {$to}
             WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s",
            [ $mid, $range['prev_start'], $range['prev_end'] ]
        );

        // ── Customers ──
        $new_customers = (int) Blu_DB::get_var(
            "SELECT COUNT(*) FROM {$tc} WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s",
            [ $mid, $range['start'], $range['end'] ]
        );
        $prev_new_customers = (int) Blu_DB::get_var(
            "SELECT COUNT(*) FROM {$tc} WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s",
            [ $mid, $range['prev_start'], $range['prev_end'] ]
        );

        // ── Products ──
        $active_products = (int) Blu_DB::get_var(
            "SELECT COUNT(*) FROM {$tp} WHERE merchant_id = %s AND status = 'active'", [ $mid ]
        );
        $low_stock_count = (int) Blu_DB::get_var(
            "SELECT COUNT(*) FROM {$tp} WHERE merchant_id = %s AND status = 'active' AND track_inventory = 1 AND inventory_qty <= 10",
            [ $mid ]
        );

        // ── Avg items per order ──
        $avg_items = Blu_DB::get_var(
            "SELECT AVG(item_count) FROM (
                SELECT o.id, COALESCE(SUM(oi.quantity), 0) AS item_count
                FROM {$to} o
                LEFT JOIN {$ti} oi ON oi.order_id = o.id
                WHERE o.merchant_id = %s AND o.status IN {$paid}
                  AND DATE(o.created_at) BETWEEN %s AND %s
                GROUP BY o.id
             ) AS sub",
            [ $mid, $range['start'], $range['end'] ]
        );

        // ── Repeat rate ──
        $repeat = Blu_DB::get_row(
            "SELECT
                COUNT(DISTINCT CASE WHEN cnt = 1 THEN email END) AS one_time,
                COUNT(DISTINCT CASE WHEN cnt > 1 THEN email END) AS repeat_buyers
             FROM (
                SELECT customer_email AS email, COUNT(*) AS cnt
                FROM {$to}
                WHERE merchant_id = %s AND status IN {$paid} AND customer_email IS NOT NULL
                GROUP BY customer_email
             ) AS sub",
            [ $mid ]
        );
        $total_buyers = (int) ( $repeat->one_time ?? 0 ) + (int) ( $repeat->repeat_buyers ?? 0 );
        $repeat_rate  = $total_buyers > 0
            ? round( (int) ( $repeat->repeat_buyers ?? 0 ) / $total_buyers * 100, 1 )
            : 0;

        // ── Sparklines (daily data for mini-charts) ──
        $sparkline_revenue = Blu_DB::get_col(
            "SELECT COALESCE(SUM(CASE WHEN status IN {$paid} THEN total_cents END), 0)
             FROM {$to}
             WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s
             GROUP BY DATE(created_at)
             ORDER BY DATE(created_at) ASC",
            [ $mid, $range['start'], $range['end'] ]
        );
        $sparkline_orders = Blu_DB::get_col(
            "SELECT COUNT(*)
             FROM {$to}
             WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s
             GROUP BY DATE(created_at)
             ORDER BY DATE(created_at) ASC",
            [ $mid, $range['start'], $range['end'] ]
        );

        // ── Gross profit estimate (revenue minus cost) ──
        $cost_data = Blu_DB::get_var(
            "SELECT COALESCE(SUM(oi.quantity * p.cost * 100), 0)
             FROM {$ti} oi
             JOIN {$to} o ON o.id = oi.order_id
             LEFT JOIN {$tp} p ON p.id = oi.product_id
             WHERE o.merchant_id = %s AND o.status IN {$paid} AND p.cost IS NOT NULL AND p.cost > 0
               AND DATE(o.created_at) BETWEEN %s AND %s",
            [ $mid, $range['start'], $range['end'] ]
        );
        $gross_profit_cents = (int) $curr->revenue_cents - (int) $cost_data;

        // ── Auto-generated insights ──
        $insights = self::generate_insights( $curr, $prev, $range, $low_stock_count, $repeat_rate, $new_customers, $gross_profit_cents );

        return blu_success( [
            'period'  => $range,
            'current' => [
                'revenue_cents'      => (int) $curr->revenue_cents,
                'total_orders'       => (int) $curr->total_orders,
                'avg_order_cents'    => (int) $curr->avg_order_cents,
                'unique_customers'   => (int) $curr->unique_customers,
                'new_customers'      => $new_customers,
                'refunds_cents'      => (int) $curr->refunds_cents,
                'shipping_cents'     => (int) $curr->shipping_cents,
                'tax_cents'          => (int) $curr->tax_cents,
                'active_products'    => $active_products,
                'low_stock_count'    => $low_stock_count,
                'avg_items_per_order' => $avg_items ? round( (float) $avg_items, 1 ) : 0,
                'repeat_rate'        => $repeat_rate,
                'gross_profit_cents' => $gross_profit_cents,
            ],
            'previous' => [
                'revenue_cents'    => (int) $prev->revenue_cents,
                'total_orders'     => (int) $prev->total_orders,
                'avg_order_cents'  => (int) $prev->avg_order_cents,
                'unique_customers' => (int) $prev->unique_customers,
                'new_customers'    => $prev_new_customers,
            ],
            'trends' => [
                'revenue'    => self::pct( (int) $curr->revenue_cents, (int) $prev->revenue_cents ),
                'orders'     => self::pct( (int) $curr->total_orders,  (int) $prev->total_orders ),
                'avg_order'  => self::pct( (int) $curr->avg_order_cents, (int) $prev->avg_order_cents ),
                'customers'  => self::pct( $new_customers, $prev_new_customers ),
            ],
            'sparklines' => [
                'revenue' => array_map( 'intval', $sparkline_revenue ),
                'orders'  => array_map( 'intval', $sparkline_orders ),
            ],
            'insights' => $insights,
        ] );
    }

    /* ═══════════════════════════════════════════════════════════════
     * REVENUE – Timeline, comparison overlay, day-of-week, profit
     * ═══════════════════════════════════════════════════════════════ */

    public static function revenue( WP_REST_Request $req ): WP_REST_Response {
        $mid      = blu_merchant_id();
        $range    = self::parse_range( $req );
        $to       = blu_table( 'orders' );
        $ti       = blu_table( 'order_items' );
        $tp       = blu_table( 'products' );
        $paid     = self::PAID;
        $interval = self::interval( $range['days'] );
        $fmt      = self::date_fmt( $interval );

        // ── Current period timeline ──
        $timeline = Blu_DB::get_results(
            "SELECT
                DATE_FORMAT(created_at, %s)                                              AS period,
                COUNT(*)                                                                  AS orders,
                COALESCE(SUM(CASE WHEN status IN {$paid} THEN total_cents END), 0)        AS revenue_cents,
                COALESCE(SUM(CASE WHEN status = 'refunded' THEN total_cents END), 0)      AS refunds_cents,
                COALESCE(SUM(CASE WHEN status IN {$paid} THEN shipping_cents END), 0)     AS shipping_cents,
                COALESCE(SUM(CASE WHEN status IN {$paid} THEN tax_cents END), 0)          AS tax_cents,
                COALESCE(SUM(CASE WHEN status IN {$paid} THEN subtotal_cents END), 0)     AS subtotal_cents
             FROM {$to}
             WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s
             GROUP BY period ORDER BY period ASC",
            [ $fmt, $mid, $range['start'], $range['end'] ]
        );
        self::cast_int( $timeline, [ 'orders', 'revenue_cents', 'refunds_cents', 'shipping_cents', 'tax_cents', 'subtotal_cents' ] );

        // ── Previous period timeline (for comparison overlay) ──
        $prev_timeline = Blu_DB::get_results(
            "SELECT
                DATE_FORMAT(created_at, %s)                                              AS period,
                COALESCE(SUM(CASE WHEN status IN {$paid} THEN total_cents END), 0)        AS revenue_cents
             FROM {$to}
             WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s
             GROUP BY period ORDER BY period ASC",
            [ $fmt, $mid, $range['prev_start'], $range['prev_end'] ]
        );
        self::cast_int( $prev_timeline, [ 'revenue_cents' ] );

        // ── Revenue by day of week ──
        $by_dow = Blu_DB::get_results(
            "SELECT
                DAYOFWEEK(created_at) AS dow,
                DAYNAME(created_at)   AS day_name,
                COUNT(*)              AS orders,
                COALESCE(SUM(CASE WHEN status IN {$paid} THEN total_cents END), 0) AS revenue_cents
             FROM {$to}
             WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s
             GROUP BY dow, day_name
             ORDER BY dow ASC",
            [ $mid, $range['start'], $range['end'] ]
        );
        self::cast_int( $by_dow, [ 'orders', 'revenue_cents' ] );

        // ── Revenue by currency ──
        $by_currency = Blu_DB::get_results(
            "SELECT UPPER(currency) AS currency, COUNT(*) AS orders,
                    COALESCE(SUM(total_cents), 0) AS revenue_cents
             FROM {$to}
             WHERE merchant_id = %s AND status IN {$paid} AND DATE(created_at) BETWEEN %s AND %s
             GROUP BY currency ORDER BY revenue_cents DESC",
            [ $mid, $range['start'], $range['end'] ]
        );
        self::cast_int( $by_currency, [ 'orders', 'revenue_cents' ] );

        // ── Gross profit timeline ──
        $profit_timeline = Blu_DB::get_results(
            "SELECT
                DATE_FORMAT(o.created_at, %s) AS period,
                COALESCE(SUM(CASE WHEN o.status IN {$paid} THEN oi.total_cents END), 0) AS revenue_cents,
                COALESCE(SUM(CASE WHEN o.status IN {$paid} AND p.cost > 0 THEN oi.quantity * p.cost * 100 END), 0) AS cost_cents
             FROM {$ti} oi
             JOIN {$to} o ON o.id = oi.order_id
             LEFT JOIN {$tp} p ON p.id = oi.product_id
             WHERE o.merchant_id = %s AND DATE(o.created_at) BETWEEN %s AND %s
             GROUP BY period ORDER BY period ASC",
            [ $fmt, $mid, $range['start'], $range['end'] ]
        );
        foreach ( $profit_timeline as &$row ) {
            $row->revenue_cents = (int) $row->revenue_cents;
            $row->cost_cents    = (int) $row->cost_cents;
            $row->profit_cents  = $row->revenue_cents - $row->cost_cents;
        }

        // ── Summary totals ──
        $totals = [
            'gross_cents'    => 0,
            'refunds_cents'  => 0,
            'shipping_cents' => 0,
            'tax_cents'      => 0,
        ];
        foreach ( $timeline as $t ) {
            $totals['gross_cents']    += $t->revenue_cents;
            $totals['refunds_cents']  += $t->refunds_cents;
            $totals['shipping_cents'] += $t->shipping_cents;
            $totals['tax_cents']      += $t->tax_cents;
        }
        $totals['net_cents'] = $totals['gross_cents'] - $totals['refunds_cents'];

        return blu_success( [
            'period'          => $range,
            'interval'        => $interval,
            'timeline'        => $timeline,
            'prev_timeline'   => $prev_timeline,
            'by_day_of_week'  => $by_dow,
            'by_currency'     => $by_currency,
            'profit_timeline' => $profit_timeline,
            'summary'         => $totals,
        ] );
    }

    /* ═══════════════════════════════════════════════════════════════
     * ORDERS – Volume, status funnel, heatmap, fulfillment speed
     * ═══════════════════════════════════════════════════════════════ */

    public static function orders( WP_REST_Request $req ): WP_REST_Response {
        $mid      = blu_merchant_id();
        $range    = self::parse_range( $req );
        $to       = blu_table( 'orders' );
        $ti       = blu_table( 'order_items' );
        $paid     = self::PAID;
        $interval = self::interval( $range['days'] );
        $fmt      = self::date_fmt( $interval );

        // ── Orders over time (stacked by status) ──
        $timeline = Blu_DB::get_results(
            "SELECT
                DATE_FORMAT(created_at, %s) AS period,
                COUNT(*)                     AS total,
                SUM(status = 'paid')         AS paid,
                SUM(status = 'pending')      AS pending,
                SUM(status = 'fulfilled')    AS fulfilled,
                SUM(status = 'shipped')      AS shipped,
                SUM(status = 'processing')   AS processing,
                SUM(status = 'cancelled')    AS cancelled,
                SUM(status = 'refunded')     AS refunded
             FROM {$to}
             WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s
             GROUP BY period ORDER BY period ASC",
            [ $fmt, $mid, $range['start'], $range['end'] ]
        );
        self::cast_int( $timeline, [ 'total','paid','pending','fulfilled','shipped','processing','cancelled','refunded' ] );

        // ── Status breakdown ──
        $breakdown = Blu_DB::get_results(
            "SELECT status, COUNT(*) AS count
             FROM {$to}
             WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s
             GROUP BY status ORDER BY count DESC",
            [ $mid, $range['start'], $range['end'] ]
        );
        self::cast_int( $breakdown, [ 'count' ] );

        // ── Hourly heatmap (hour × day_of_week) ──
        $heatmap = Blu_DB::get_results(
            "SELECT
                DAYOFWEEK(created_at) - 1  AS day,    /* 0=Sun, 6=Sat */
                HOUR(created_at)           AS hour,
                COUNT(*)                   AS count
             FROM {$to}
             WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s
             GROUP BY day, hour
             ORDER BY day, hour",
            [ $mid, $range['start'], $range['end'] ]
        );
        self::cast_int( $heatmap, [ 'day', 'hour', 'count' ] );

        // ── Fulfillment speed ──
        $avg_fulfillment = Blu_DB::get_var(
            "SELECT AVG(TIMESTAMPDIFF(HOUR, paid_at, COALESCE(shipped_at, updated_at)))
             FROM {$to}
             WHERE merchant_id = %s AND status IN ('fulfilled','shipped') AND paid_at IS NOT NULL
               AND DATE(created_at) BETWEEN %s AND %s",
            [ $mid, $range['start'], $range['end'] ]
        );

        // ── Avg items per order over time ──
        $items_timeline = Blu_DB::get_results(
            "SELECT
                DATE_FORMAT(o.created_at, %s) AS period,
                AVG(sub.item_count) AS avg_items
             FROM {$to} o
             JOIN (
                SELECT order_id, SUM(quantity) AS item_count
                FROM {$ti} GROUP BY order_id
             ) sub ON sub.order_id = o.id
             WHERE o.merchant_id = %s AND DATE(o.created_at) BETWEEN %s AND %s
             GROUP BY period ORDER BY period ASC",
            [ $fmt, $mid, $range['start'], $range['end'] ]
        );
        foreach ( $items_timeline as &$row ) {
            $row->avg_items = round( (float) $row->avg_items, 1 );
        }

        // ── Orders per day average ──
        $total_orders = array_sum( array_column( (array) $timeline, 'total' ) );
        $avg_per_day  = $range['days'] > 0 ? round( $total_orders / $range['days'], 1 ) : 0;

        return blu_success( [
            'period'                => $range,
            'interval'              => $interval,
            'timeline'              => $timeline,
            'status_breakdown'      => $breakdown,
            'heatmap'               => $heatmap,
            'avg_fulfillment_hours' => $avg_fulfillment ? round( (float) $avg_fulfillment, 1 ) : null,
            'avg_orders_per_day'    => $avg_per_day,
            'items_timeline'        => $items_timeline,
        ] );
    }

    /* ═══════════════════════════════════════════════════════════════
     * PRODUCTS – Performers, velocity scoring, inventory forecast
     * ═══════════════════════════════════════════════════════════════ */

    public static function products( WP_REST_Request $req ): WP_REST_Response {
        $mid      = blu_merchant_id();
        $range    = self::parse_range( $req );
        $to       = blu_table( 'orders' );
        $ti       = blu_table( 'order_items' );
        $tp       = blu_table( 'products' );
        $paid     = self::PAID;
        $interval = self::interval( $range['days'] );
        $fmt      = self::date_fmt( $interval );

        // ── Top products by revenue (with share %) ──
        $total_product_revenue = (int) Blu_DB::get_var(
            "SELECT COALESCE(SUM(oi.total_cents), 0)
             FROM {$ti} oi JOIN {$to} o ON o.id = oi.order_id
             WHERE o.merchant_id = %s AND o.status IN {$paid}
               AND DATE(o.created_at) BETWEEN %s AND %s",
            [ $mid, $range['start'], $range['end'] ]
        );

        $top_revenue = Blu_DB::get_results(
            "SELECT
                oi.product_id, oi.product_name, oi.product_sku, oi.product_image,
                SUM(oi.quantity) AS units_sold, SUM(oi.total_cents) AS revenue_cents,
                COUNT(DISTINCT o.id) AS order_count,
                AVG(oi.unit_price_cents) AS avg_price_cents
             FROM {$ti} oi JOIN {$to} o ON o.id = oi.order_id
             WHERE o.merchant_id = %s AND o.status IN {$paid}
               AND DATE(o.created_at) BETWEEN %s AND %s
             GROUP BY oi.product_id, oi.product_name, oi.product_sku, oi.product_image
             ORDER BY revenue_cents DESC LIMIT 15",
            [ $mid, $range['start'], $range['end'] ]
        );

        foreach ( $top_revenue as &$row ) {
            $row->units_sold      = (int) $row->units_sold;
            $row->revenue_cents   = (int) $row->revenue_cents;
            $row->order_count     = (int) $row->order_count;
            $row->avg_price_cents = (int) $row->avg_price_cents;
            $row->revenue_share   = $total_product_revenue > 0
                ? round( $row->revenue_cents / $total_product_revenue * 100, 1 )
                : 0;
        }

        // ── Top by units ──
        $top_units = Blu_DB::get_results(
            "SELECT
                oi.product_id, oi.product_name, oi.product_sku, oi.product_image,
                SUM(oi.quantity) AS units_sold, SUM(oi.total_cents) AS revenue_cents,
                COUNT(DISTINCT o.id) AS order_count
             FROM {$ti} oi JOIN {$to} o ON o.id = oi.order_id
             WHERE o.merchant_id = %s AND o.status IN {$paid}
               AND DATE(o.created_at) BETWEEN %s AND %s
             GROUP BY oi.product_id, oi.product_name, oi.product_sku, oi.product_image
             ORDER BY units_sold DESC LIMIT 15",
            [ $mid, $range['start'], $range['end'] ]
        );
        self::cast_int( $top_units, [ 'units_sold', 'revenue_cents', 'order_count' ] );

        // ── Inventory health with velocity and forecast ──
        $inventory = Blu_DB::get_results(
            "SELECT
                p.id, p.name, p.sku, p.inventory_qty, p.price, p.cost,
                COALESCE(p.images, '[]') AS images,
                COALESCE(sales.units_sold, 0) AS units_sold_period,
                COALESCE(sales.revenue_cents, 0) AS revenue_cents
             FROM {$tp} p
             LEFT JOIN (
                SELECT oi.product_id, SUM(oi.quantity) AS units_sold, SUM(oi.total_cents) AS revenue_cents
                FROM {$ti} oi JOIN {$to} o ON o.id = oi.order_id
                WHERE o.merchant_id = %s AND o.status IN {$paid}
                  AND DATE(o.created_at) BETWEEN %s AND %s
                GROUP BY oi.product_id
             ) sales ON sales.product_id = p.id
             WHERE p.merchant_id = %s AND p.status = 'active' AND p.track_inventory = 1
             ORDER BY p.inventory_qty ASC
             LIMIT 20",
            [ $mid, $range['start'], $range['end'], $mid ]
        );

        foreach ( $inventory as &$row ) {
            $row->inventory_qty     = (int) $row->inventory_qty;
            $row->price             = (float) $row->price;
            $row->cost              = (float) ( $row->cost ?? 0 );
            $row->units_sold_period = (int) $row->units_sold_period;
            $row->revenue_cents     = (int) $row->revenue_cents;
            $row->images            = json_decode( $row->images );

            // Velocity: units per day in this period
            $row->velocity_per_day = $range['days'] > 0
                ? round( $row->units_sold_period / $range['days'], 2 )
                : 0;

            // Days until stockout
            $row->days_until_stockout = $row->velocity_per_day > 0
                ? (int) ceil( $row->inventory_qty / $row->velocity_per_day )
                : null;  // null = no sales, can't forecast
        }

        // ── Product performance timeline ──
        $product_timeline = Blu_DB::get_results(
            "SELECT
                DATE_FORMAT(o.created_at, %s) AS period,
                SUM(oi.quantity) AS units_sold, SUM(oi.total_cents) AS revenue_cents
             FROM {$ti} oi JOIN {$to} o ON o.id = oi.order_id
             WHERE o.merchant_id = %s AND o.status IN {$paid}
               AND DATE(o.created_at) BETWEEN %s AND %s
             GROUP BY period ORDER BY period ASC",
            [ $fmt, $mid, $range['start'], $range['end'] ]
        );
        self::cast_int( $product_timeline, [ 'units_sold', 'revenue_cents' ] );

        return blu_success( [
            'period'               => $range,
            'total_product_revenue' => $total_product_revenue,
            'top_by_revenue'       => $top_revenue,
            'top_by_units'         => $top_units,
            'inventory_health'     => $inventory,
            'timeline'             => $product_timeline,
        ] );
    }

    /* ═══════════════════════════════════════════════════════════════
     * CUSTOMERS – Acquisition, RFM segments, LTV distribution
     * ═══════════════════════════════════════════════════════════════ */

    public static function customers( WP_REST_Request $req ): WP_REST_Response {
        $mid      = blu_merchant_id();
        $range    = self::parse_range( $req );
        $to       = blu_table( 'orders' );
        $tc       = blu_table( 'customers' );
        $paid     = self::PAID;
        $interval = self::interval( $range['days'] );
        $fmt      = self::date_fmt( $interval );

        // ── New customer acquisition timeline ──
        $new_timeline = Blu_DB::get_results(
            "SELECT DATE_FORMAT(created_at, %s) AS period, COUNT(*) AS new_customers
             FROM {$tc}
             WHERE merchant_id = %s AND DATE(created_at) BETWEEN %s AND %s
             GROUP BY period ORDER BY period ASC",
            [ $fmt, $mid, $range['start'], $range['end'] ]
        );
        self::cast_int( $new_timeline, [ 'new_customers' ] );

        // ── Top spenders ──
        $top_spenders = Blu_DB::get_results(
            "SELECT
                o.customer_email, o.customer_name, o.customer_id,
                COUNT(*) AS order_count,
                SUM(o.total_cents) AS total_spent_cents,
                AVG(o.total_cents) AS avg_order_cents,
                MAX(o.created_at) AS last_order_at,
                MIN(o.created_at) AS first_order_at
             FROM {$to} o
             WHERE o.merchant_id = %s AND o.status IN {$paid}
               AND o.customer_email IS NOT NULL
               AND DATE(o.created_at) BETWEEN %s AND %s
             GROUP BY o.customer_email, o.customer_name, o.customer_id
             ORDER BY total_spent_cents DESC LIMIT 10",
            [ $mid, $range['start'], $range['end'] ]
        );
        foreach ( $top_spenders as &$row ) {
            $row->order_count       = (int) $row->order_count;
            $row->total_spent_cents = (int) $row->total_spent_cents;
            $row->avg_order_cents   = (int) $row->avg_order_cents;
        }

        // ── Segments: one-time vs repeat ──
        $segments = Blu_DB::get_row(
            "SELECT
                COUNT(DISTINCT CASE WHEN cnt = 1 THEN email END) AS one_time,
                COUNT(DISTINCT CASE WHEN cnt = 2 THEN email END) AS two_orders,
                COUNT(DISTINCT CASE WHEN cnt >= 3 THEN email END) AS loyal
             FROM (
                SELECT customer_email AS email, COUNT(*) AS cnt
                FROM {$to}
                WHERE merchant_id = %s AND status IN {$paid} AND customer_email IS NOT NULL
                  AND DATE(created_at) BETWEEN %s AND %s
                GROUP BY customer_email
             ) AS sub",
            [ $mid, $range['start'], $range['end'] ]
        );

        // ── LTV distribution (all time) ──
        $ltv_buckets = Blu_DB::get_results(
            "SELECT
                CASE
                    WHEN total_per_customer < 2500   THEN '$0-25'
                    WHEN total_per_customer < 5000   THEN '$25-50'
                    WHEN total_per_customer < 10000  THEN '$50-100'
                    WHEN total_per_customer < 25000  THEN '$100-250'
                    WHEN total_per_customer < 50000  THEN '$250-500'
                    ELSE '$500+'
                END AS bucket,
                COUNT(*) AS count
             FROM (
                SELECT customer_email, SUM(total_cents) AS total_per_customer
                FROM {$to}
                WHERE merchant_id = %s AND status IN {$paid} AND customer_email IS NOT NULL
                GROUP BY customer_email
             ) AS sub
             GROUP BY bucket
             ORDER BY MIN(total_per_customer) ASC",
            [ $mid ]
        );
        self::cast_int( $ltv_buckets, [ 'count' ] );

        // ── LTV stats ──
        $ltv = Blu_DB::get_row(
            "SELECT
                AVG(total_per_customer) AS avg_cents,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_per_customer) AS median_cents,
                MAX(total_per_customer) AS max_cents
             FROM (
                SELECT customer_email, SUM(total_cents) AS total_per_customer
                FROM {$to}
                WHERE merchant_id = %s AND status IN {$paid} AND customer_email IS NOT NULL
                GROUP BY customer_email
             ) AS sub",
            [ $mid ]
        );

        // MySQL doesn't support PERCENTILE_CONT — fall back
        if ( ! $ltv || ! isset( $ltv->avg_cents ) ) {
            $ltv = Blu_DB::get_row(
                "SELECT
                    AVG(total_per_customer) AS avg_cents,
                    MAX(total_per_customer) AS max_cents
                 FROM (
                    SELECT customer_email, SUM(total_cents) AS total_per_customer
                    FROM {$to}
                    WHERE merchant_id = %s AND status IN {$paid} AND customer_email IS NOT NULL
                    GROUP BY customer_email
                 ) AS sub",
                [ $mid ]
            );
        }

        // ── Avg days between orders (for repeat buyers) ──
        $avg_days_between = Blu_DB::get_var(
            "SELECT AVG(days_gap) FROM (
                SELECT customer_email,
                    DATEDIFF(
                        LEAD(created_at) OVER (PARTITION BY customer_email ORDER BY created_at),
                        created_at
                    ) AS days_gap
                FROM {$to}
                WHERE merchant_id = %s AND status IN {$paid} AND customer_email IS NOT NULL
            ) AS sub WHERE days_gap IS NOT NULL",
            [ $mid ]
        );

        // ── Customer geographic data (from shipping addresses) ──
        $geo = Blu_DB::get_results(
            "SELECT
                JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.state')) AS region,
                JSON_UNQUOTE(JSON_EXTRACT(shipping_address, '$.country')) AS country,
                COUNT(*) AS order_count,
                COALESCE(SUM(total_cents), 0) AS revenue_cents
             FROM {$to}
             WHERE merchant_id = %s AND status IN {$paid}
               AND shipping_address IS NOT NULL AND shipping_address != 'null'
               AND DATE(created_at) BETWEEN %s AND %s
             GROUP BY region, country
             HAVING region IS NOT NULL
             ORDER BY order_count DESC
             LIMIT 10",
            [ $mid, $range['start'], $range['end'] ]
        );
        self::cast_int( $geo, [ 'order_count', 'revenue_cents' ] );

        $total_customers = (int) Blu_DB::get_var(
            "SELECT COUNT(*) FROM {$tc} WHERE merchant_id = %s", [ $mid ]
        );

        return blu_success( [
            'period'             => $range,
            'total_customers'    => $total_customers,
            'new_timeline'       => $new_timeline,
            'top_spenders'       => $top_spenders,
            'segments'           => [
                'one_time'   => (int) ( $segments->one_time ?? 0 ),
                'two_orders' => (int) ( $segments->two_orders ?? 0 ),
                'loyal'      => (int) ( $segments->loyal ?? 0 ),
            ],
            'ltv_distribution' => $ltv_buckets,
            'lifetime_value'   => [
                'avg_cents' => (int) ( $ltv->avg_cents ?? 0 ),
                'max_cents' => (int) ( $ltv->max_cents ?? 0 ),
            ],
            'avg_days_between_orders' => $avg_days_between ? round( (float) $avg_days_between, 1 ) : null,
            'top_regions'             => $geo,
        ] );
    }

    /* ═══════════════════════════════════════════════════════════════
     * Smart Insights Generator
     * ═══════════════════════════════════════════════════════════════ */

    private static function generate_insights( $curr, $prev, $range, $low_stock, $repeat_rate, $new_customers, $gross_profit ): array {
        $insights = [];

        // Revenue trend
        $rev_change = self::pct( (int) $curr->revenue_cents, (int) $prev->revenue_cents );
        if ( $rev_change !== null ) {
            if ( $rev_change > 0 ) {
                $insights[] = [ 'type' => 'positive', 'metric' => 'revenue',
                    'text' => "Revenue is up {$rev_change}% compared to the previous period" ];
            } elseif ( $rev_change < 0 ) {
                $insights[] = [ 'type' => 'negative', 'metric' => 'revenue',
                    'text' => 'Revenue declined ' . abs( $rev_change ) . '% compared to the previous period' ];
            }
        }

        // Order trend
        $ord_change = self::pct( (int) $curr->total_orders, (int) $prev->total_orders );
        if ( $ord_change !== null && $ord_change > 10 ) {
            $insights[] = [ 'type' => 'positive', 'metric' => 'orders',
                'text' => "Order volume surged {$ord_change}% — demand is growing" ];
        }

        // AOV
        if ( (int) $curr->avg_order_cents > 0 ) {
            $aov = number_format( (int) $curr->avg_order_cents / 100, 2 );
            $insights[] = [ 'type' => 'neutral', 'metric' => 'aov',
                'text' => "Average order value is \${$aov}" ];
        }

        // Repeat rate
        if ( $repeat_rate >= 20 ) {
            $insights[] = [ 'type' => 'positive', 'metric' => 'retention',
                'text' => "{$repeat_rate}% of customers are repeat buyers — strong retention" ];
        } elseif ( $repeat_rate > 0 && $repeat_rate < 10 ) {
            $insights[] = [ 'type' => 'warning', 'metric' => 'retention',
                'text' => "Only {$repeat_rate}% repeat rate — consider loyalty incentives" ];
        }

        // Stock alerts
        if ( $low_stock > 0 ) {
            $insights[] = [ 'type' => 'warning', 'metric' => 'inventory',
                'text' => "{$low_stock} product" . ( $low_stock > 1 ? 's are' : ' is' ) . ' running low on stock' ];
        }

        // Refunds
        $refund_rate = (int) $curr->total_orders > 0
            ? round( (int) $curr->refunds_cents / max( 1, (int) $curr->revenue_cents ) * 100, 1 )
            : 0;
        if ( $refund_rate > 5 ) {
            $insights[] = [ 'type' => 'warning', 'metric' => 'refunds',
                'text' => "Refund rate is {$refund_rate}% of revenue — worth investigating" ];
        }

        // Gross profit
        if ( $gross_profit > 0 && (int) $curr->revenue_cents > 0 ) {
            $margin = round( $gross_profit / (int) $curr->revenue_cents * 100, 1 );
            $insights[] = [ 'type' => 'neutral', 'metric' => 'profit',
                'text' => "Gross margin is {$margin}% (\$" . number_format( $gross_profit / 100, 2 ) . ' profit)' ];
        }

        // New customers
        if ( $new_customers > 0 ) {
            $per_day = round( $new_customers / max( 1, $range['days'] ), 1 );
            if ( $per_day >= 1 ) {
                $insights[] = [ 'type' => 'positive', 'metric' => 'acquisition',
                    'text' => "Acquiring ~{$per_day} new customers per day" ];
            }
        }

        return $insights;
    }
}
