<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_Orders_Controller {

    public static function register( string $ns ): void {
        $admin = [ Blu_REST_API::class, 'admin_permission' ];

        register_rest_route( $ns, '/orders', [
            [ 'methods' => 'GET',  'callback' => [ __CLASS__, 'list_orders' ],  'permission_callback' => $admin ],
            [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'create_order' ], 'permission_callback' => $admin ],
        ] );

        register_rest_route( $ns, '/orders/stats', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'stats' ], 'permission_callback' => $admin,
        ] );

        register_rest_route( $ns, '/orders/(?P<id>[a-f0-9-]+)', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'get_order' ], 'permission_callback' => $admin,
        ] );

        register_rest_route( $ns, '/orders/(?P<id>[a-f0-9-]+)/status', [
            'methods' => 'PUT', 'callback' => [ __CLASS__, 'update_status' ], 'permission_callback' => $admin,
        ] );

        register_rest_route( $ns, '/orders/(?P<id>[a-f0-9-]+)/tracking', [
            'methods' => 'PUT', 'callback' => [ __CLASS__, 'update_tracking' ], 'permission_callback' => $admin,
        ] );

        register_rest_route( $ns, '/orders/(?P<id>[a-f0-9-]+)/events', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'get_events' ], 'permission_callback' => $admin,
        ] );

        register_rest_route( $ns, '/orders/(?P<id>[a-f0-9-]+)/notes', [
            'methods' => 'POST', 'callback' => [ __CLASS__, 'add_note' ], 'permission_callback' => $admin,
        ] );

        register_rest_route( $ns, '/orders/(?P<id>[a-f0-9-]+)/refund', [
            'methods' => 'POST', 'callback' => [ __CLASS__, 'create_refund' ], 'permission_callback' => $admin,
        ] );
    }

    public static function list_orders( WP_REST_Request $req ): WP_REST_Response {
        $mid    = blu_merchant_id();
        $status = $req->get_param( 'status' );
        $limit  = (int) ( $req->get_param( 'limit' ) ?: 50 );
        $offset = (int) ( $req->get_param( 'offset' ) ?: 0 );
        $to     = blu_table( 'orders' );
        $ti     = blu_table( 'order_items' );

        $where  = [ "o.merchant_id = %s" ];
        $params = [ $mid ];

        if ( $status ) {
            $where[]  = "o.status = %s";
            $params[] = $status;
        }

        $w = implode( ' AND ', $where );

        $rows = Blu_DB::get_results(
            "SELECT o.*,
                (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id',oi.id,'product_id',oi.product_id,'product_name',oi.product_name,
                    'product_sku',oi.product_sku,'product_image',oi.product_image,
                    'unit_price_cents',oi.unit_price_cents,'quantity',oi.quantity,'total_cents',oi.total_cents
                )) FROM {$ti} oi WHERE oi.order_id = o.id) AS items
             FROM {$to} o WHERE {$w} ORDER BY o.created_at DESC LIMIT %d OFFSET %d",
            array_merge( $params, [ $limit, $offset ] )
        );

        foreach ( $rows as &$r ) {
            $r->items            = json_decode( $r->items ?? 'null' );
            $r->shipping_address = json_decode( $r->shipping_address ?? 'null' );
        }

        $total = Blu_DB::get_var( "SELECT COUNT(*) FROM {$to} o WHERE {$w}", $params );

        return blu_success( [ 'orders' => $rows, 'total' => (int) $total, 'limit' => $limit, 'offset' => $offset ] );
    }

    public static function stats( WP_REST_Request $req ): WP_REST_Response {
        $mid = blu_merchant_id();
        $t   = blu_table( 'orders' );

        $row = Blu_DB::get_row(
            "SELECT
                COUNT(*) AS total_orders,
                SUM(status = 'paid') AS paid_orders,
                SUM(status = 'pending') AS pending_orders,
                SUM(status = 'fulfilled') AS fulfilled_orders,
                COALESCE(SUM(CASE WHEN status IN ('paid','fulfilled') THEN total_cents END), 0) AS total_revenue_cents,
                SUM(created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS orders_today,
                COALESCE(SUM(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) AND status IN ('paid','fulfilled') THEN total_cents END), 0) AS revenue_today_cents
             FROM {$t} WHERE merchant_id = %s",
            [ $mid ]
        );

        return blu_success( (array) $row );
    }

    public static function get_order( WP_REST_Request $req ) {
        $id  = $req->get_param( 'id' );
        $mid = blu_merchant_id();
        $to  = blu_table( 'orders' );
        $ti  = blu_table( 'order_items' );

        $row = Blu_DB::get_row(
            "SELECT o.*,
                (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'id',oi.id,'product_id',oi.product_id,'product_name',oi.product_name,
                    'product_sku',oi.product_sku,'product_image',oi.product_image,
                    'unit_price_cents',oi.unit_price_cents,'quantity',oi.quantity,'total_cents',oi.total_cents
                )) FROM {$ti} oi WHERE oi.order_id = o.id) AS items
             FROM {$to} o WHERE o.id = %s AND o.merchant_id = %s",
            [ $id, $mid ]
        );

        if ( ! $row ) return blu_error( 'Order not found', 404 );

        $row->items            = json_decode( $row->items ?? 'null' );
        $row->shipping_address = json_decode( $row->shipping_address ?? 'null' );

        return blu_success( [ 'order' => $row ] );
    }

    public static function create_order( WP_REST_Request $req ): WP_REST_Response {
        $mid  = blu_merchant_id();
        $body = $req->get_json_params();
        $to   = blu_table( 'orders' );
        $ti   = blu_table( 'order_items' );

        // Duplicate check
        if ( ! empty( $body['stripe_session_id'] ) ) {
            $exists = Blu_DB::get_var( "SELECT id FROM {$to} WHERE stripe_session_id = %s", [ $body['stripe_session_id'] ] );
            if ( $exists ) return blu_success( [ 'message' => 'Order already exists', 'order_id' => $exists ] );
        }

        Blu_DB::begin();
        try {
            $order_id     = blu_uuid();
            $order_number = Blu_DB::next_order_number();

            Blu_DB::insert( $to, [
                'id'                     => $order_id,
                'merchant_id'            => $mid,
                'order_number'           => $order_number,
                'stripe_session_id'      => $body['stripe_session_id'] ?? null,
                'stripe_payment_intent'  => $body['stripe_payment_intent'] ?? null,
                'stripe_customer_id'     => $body['stripe_customer_id'] ?? null,
                'customer_email'         => $body['customer_email'] ?? null,
                'customer_name'          => $body['customer_name'] ?? null,
                'customer_id'            => $body['customer_id'] ?? null,
                'shipping_address'       => wp_json_encode( $body['shipping_address'] ?? new stdClass ),
                'subtotal_cents'         => (int) ( $body['subtotal_cents'] ?? 0 ),
                'shipping_cents'         => (int) ( $body['shipping_cents'] ?? 0 ),
                'tax_cents'              => (int) ( $body['tax_cents'] ?? 0 ),
                'total_cents'            => (int) ( $body['total_cents'] ?? 0 ),
                'currency'               => $body['currency'] ?? 'usd',
                'status'                 => $body['status'] ?? 'paid',
                'paid_at'                => $body['paid_at'] ?? current_time( 'mysql', true ),
            ] );

            foreach ( ( $body['items'] ?? [] ) as $item ) {
                Blu_DB::insert( $ti, [
                    'id'               => blu_uuid(),
                    'order_id'         => $order_id,
                    'product_id'       => $item['product_id'] ?? null,
                    'variant_id'       => $item['variant_id'] ?? null,
                    'product_name'     => $item['product_name'],
                    'product_sku'      => $item['product_sku'] ?? null,
                    'product_image'    => $item['product_image'] ?? null,
                    'options'          => wp_json_encode( $item['options'] ?? new stdClass ),
                    'unit_price_cents' => (int) $item['unit_price_cents'],
                    'quantity'         => (int) $item['quantity'],
                    'total_cents'      => (int) $item['unit_price_cents'] * (int) $item['quantity'],
                ] );
            }

            Blu_DB::commit();

            // Log creation event
            self::log_event( $order_id, 'order_created', 'Order created', null, [
                'source'  => $body['source'] ?? 'manual',
                'status'  => $body['status'] ?? 'paid',
            ] );

            // ── Auto-sync to WooCommerce ──
            if ( class_exists( 'Blu_Woo_Auto_Sync' ) && class_exists( 'WooCommerce' ) ) {
                $order = Blu_DB::get_row( "SELECT * FROM {$to} WHERE id = %s", [ $order_id ] );
                if ( $order ) {
                    Blu_Woo_Auto_Sync::push_order_to_wc( $order );
                }
            }

            return blu_success( [ 'message' => 'Order created', 'order_id' => $order_id, 'order_number' => $order_number ], 201 );
        } catch ( \Exception $e ) {
            Blu_DB::rollback();
            return blu_error( 'Failed to create order', 500 );
        }
    }

    public static function update_status( WP_REST_Request $req ) {
        $id     = $req->get_param( 'id' );
        $mid    = blu_merchant_id();
        $status = $req->get_json_params()['status'] ?? '';
        $t      = blu_table( 'orders' );

        $valid = [ 'pending','paid','processing','shipped','fulfilled','cancelled','refunded' ];
        if ( ! in_array( $status, $valid, true ) ) {
            return blu_error( 'Invalid status. Must be one of: ' . implode( ', ', $valid ) );
        }

        $extra = $status === 'shipped' ? ", shipped_at = COALESCE(shipped_at, NOW())" : '';
        $affected = Blu_DB::query(
            "UPDATE {$t} SET status = %s, updated_at = NOW() {$extra} WHERE id = %s AND merchant_id = %s",
            [ $status, $id, $mid ]
        );

        if ( ! $affected ) return blu_error( 'Order not found', 404 );

        // Log status change event
        $old = $req->get_param( '_old_status' ); // optional, for richer logs
        self::log_event( $id, 'status_change', "Status changed to {$status}", null, [
            'new_status' => $status,
        ] );

        $order = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $id ] );

        // ── Auto-sync status to WooCommerce ──
        if ( class_exists( 'Blu_Woo_Auto_Sync' ) && class_exists( 'WooCommerce' ) && $order && ! empty( $order->woo_order_id ) ) {
            Blu_Woo_Auto_Sync::push_order_to_wc( $order );
        }

        return blu_success( [ 'order' => $order ] );
    }

    public static function update_tracking( WP_REST_Request $req ) {
        $id   = $req->get_param( 'id' );
        $mid  = blu_merchant_id();
        $body = $req->get_json_params();
        $t    = blu_table( 'orders' );

        $affected = Blu_DB::query(
            "UPDATE {$t} SET
                shipping_carrier = COALESCE(%s, shipping_carrier),
                tracking_number  = COALESCE(%s, tracking_number),
                tracking_url     = COALESCE(%s, tracking_url),
                updated_at       = NOW()
             WHERE id = %s AND merchant_id = %s",
            [ $body['shipping_carrier'] ?? null, $body['tracking_number'] ?? null, $body['tracking_url'] ?? null, $id, $mid ]
        );

        if ( ! $affected ) return blu_error( 'Order not found', 404 );

        // Log tracking event
        $parts = [];
        if ( ! empty( $body['shipping_carrier'] ) ) $parts[] = 'Carrier: ' . sanitize_text_field( $body['shipping_carrier'] );
        if ( ! empty( $body['tracking_number'] ) )  $parts[] = 'Tracking: ' . sanitize_text_field( $body['tracking_number'] );
        if ( ! empty( $parts ) ) {
            self::log_event( $id, 'tracking_updated', 'Tracking information updated', implode( "\n", $parts ) );
        }

        $order = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $id ] );
        return blu_success( [ 'order' => $order ] );
    }

    /* ─── Timeline / Events ─────────────────────── */

    private static function log_event( string $order_id, string $type, string $title, ?string $detail = null, ?array $meta = null ): void {
        $te = blu_table( 'order_events' );
        $user = wp_get_current_user();
        $actor = $user && $user->ID ? $user->display_name : 'System';

        Blu_DB::insert( $te, [
            'id'          => wp_generate_uuid4(),
            'order_id'    => $order_id,
            'merchant_id' => blu_merchant_id(),
            'event_type'  => $type,
            'title'       => $title,
            'detail'      => $detail,
            'meta'        => $meta ? wp_json_encode( $meta ) : null,
            'actor'       => $actor,
        ] );
    }

    public static function get_events( WP_REST_Request $req ): WP_REST_Response {
        $id  = $req->get_param( 'id' );
        $mid = blu_merchant_id();
        $te  = blu_table( 'order_events' );

        $events = Blu_DB::get_results(
            "SELECT * FROM {$te} WHERE order_id = %s AND merchant_id = %s ORDER BY created_at DESC",
            [ $id, $mid ]
        );

        foreach ( $events as &$e ) {
            $e->meta = json_decode( $e->meta ?? 'null' );
        }

        return blu_success( [ 'events' => $events ] );
    }

    public static function add_note( WP_REST_Request $req ): WP_REST_Response {
        $id   = $req->get_param( 'id' );
        $mid  = blu_merchant_id();
        $body = $req->get_json_params();
        $note = sanitize_textarea_field( $body['note'] ?? '' );

        if ( empty( $note ) ) {
            return blu_error( 'Note text is required' );
        }

        // Verify order exists
        $to = blu_table( 'orders' );
        $order = Blu_DB::get_row( "SELECT id FROM {$to} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
        if ( ! $order ) return blu_error( 'Order not found', 404 );

        self::log_event( $id, 'note', 'Note added', $note );

        return blu_success( [ 'message' => 'Note added' ] );
    }

    public static function create_refund( WP_REST_Request $req ): WP_REST_Response {
        $id   = $req->get_param( 'id' );
        $mid  = blu_merchant_id();
        $body = $req->get_json_params();
        $to   = blu_table( 'orders' );

        $amount_cents = absint( $body['amount_cents'] ?? 0 );
        $reason       = sanitize_text_field( $body['reason'] ?? '' );

        $order = Blu_DB::get_row( "SELECT * FROM {$to} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
        if ( ! $order ) return blu_error( 'Order not found', 404 );

        if ( $amount_cents <= 0 || $amount_cents > (int) $order->total_cents ) {
            return blu_error( 'Invalid refund amount' );
        }

        $is_full = $amount_cents === (int) $order->total_cents;

        // Update order status to refunded
        $new_status = $is_full ? 'refunded' : $order->status;
        Blu_DB::query(
            "UPDATE {$to} SET status = %s, updated_at = NOW() WHERE id = %s AND merchant_id = %s",
            [ $new_status, $id, $mid ]
        );

        // Log the event
        $label = $is_full ? 'Full refund issued' : 'Partial refund issued';
        $detail_parts = [];
        $detail_parts[] = 'Amount: ' . number_format( $amount_cents / 100, 2 );
        if ( $reason ) $detail_parts[] = 'Reason: ' . $reason;
        self::log_event( $id, 'refund', $label, implode( "\n", $detail_parts ), [
            'amount_cents' => $amount_cents,
            'reason'       => $reason,
            'full_refund'  => $is_full,
        ] );

        // Sync to WooCommerce if connected
        if ( class_exists( 'Blu_Woo_Auto_Sync' ) && class_exists( 'WooCommerce' ) && ! empty( $order->woo_order_id ) ) {
            $updated_order = Blu_DB::get_row( "SELECT * FROM {$to} WHERE id = %s", [ $id ] );
            Blu_Woo_Auto_Sync::push_order_to_wc( $updated_order );
        }

        $updated = Blu_DB::get_row( "SELECT * FROM {$to} WHERE id = %s", [ $id ] );
        return blu_success( [ 'order' => $updated, 'refund_amount_cents' => $amount_cents ] );
    }
}
