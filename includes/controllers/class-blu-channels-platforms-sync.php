<?php
if ( ! defined( 'ABSPATH' ) ) exit;

/* ═══════════════════════════════════════════════════════════
 *  CHANNELS CONTROLLER  (channels.js)
 * ═══════════════════════════════════════════════════════════ */
class Blu_Channels_Controller {
    public static function register( string $ns ): void {
        $admin = [ Blu_REST_API::class, 'admin_permission' ];

        register_rest_route( $ns, '/channels', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'list_channels' ], 'permission_callback' => $admin,
        ] );
        register_rest_route( $ns, '/channels/available', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'available' ], 'permission_callback' => $admin,
        ] );
        register_rest_route( $ns, '/channels/(?P<id>[a-f0-9-]+)', [
            [ 'methods' => 'GET',    'callback' => [ __CLASS__, 'get_channel' ],    'permission_callback' => $admin ],
            [ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'disconnect' ],     'permission_callback' => $admin ],
        ] );
        register_rest_route( $ns, '/channels/(?P<id>[a-f0-9-]+)/configure', [
            'methods' => 'POST', 'callback' => [ __CLASS__, 'configure' ], 'permission_callback' => $admin,
        ] );
        register_rest_route( $ns, '/channels/(?P<id>[a-f0-9-]+)/sync', [
            'methods' => 'POST', 'callback' => [ __CLASS__, 'sync' ], 'permission_callback' => $admin,
        ] );
        register_rest_route( $ns, '/channels/(?P<id>[a-f0-9-]+)/status', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'status' ], 'permission_callback' => $admin,
        ] );
        register_rest_route( $ns, '/channels/(?P<id>[a-f0-9-]+)/logs', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'logs' ], 'permission_callback' => $admin,
        ] );
        register_rest_route( $ns, '/channels/(?P<id>[a-f0-9-]+)/products', [
            'methods' => 'GET', 'callback' => [ __CLASS__, 'products' ], 'permission_callback' => $admin,
        ] );

        // OAuth starters (demo mode)
        foreach ( [ 'google', 'meta', 'etsy', 'tiktok' ] as $platform ) {
            register_rest_route( $ns, "/channels/{$platform}/auth", [
                'methods' => 'POST', 'callback' => [ __CLASS__, 'demo_auth' ], 'permission_callback' => $admin,
            ] );
        }
    }

    public static function list_channels(): WP_REST_Response {
        $t    = blu_table( 'channels' );
        $rows = Blu_DB::get_results(
            "SELECT id, type, name, status, config, auto_sync, sync_interval_minutes,
                    last_sync_at, next_sync_at, products_synced, products_approved,
                    products_pending, products_disapproved, last_error, created_at, updated_at
             FROM {$t} WHERE merchant_id = %s ORDER BY created_at DESC",
            [ blu_merchant_id() ]
        );
        foreach ( $rows as &$r ) $r->config = json_decode( $r->config ?? '{}' );
        return blu_success( [ 'channels' => $rows ] );
    }

    public static function available(): WP_REST_Response {
        return blu_success( [ 'channels' => [
            [ 'type'=>'google_merchant','name'=>'Google Merchant Center','description'=>'Sync products to Google Shopping','status'=>'available','features'=>['Free product listings','Google Shopping Ads'] ],
            [ 'type'=>'meta_commerce','name'=>'Meta Commerce','description'=>'Sell on Facebook and Instagram Shops','status'=>'available','features'=>['Facebook Shop','Instagram Shopping','Batch catalog sync'] ],
            [ 'type'=>'etsy','name'=>'Etsy','description'=>'List products on Etsy marketplace','status'=>'available','features'=>['Listing management','Inventory sync','Order import'] ],
            [ 'type'=>'tiktok_shop','name'=>'TikTok Shop','description'=>'Sell directly on TikTok','status'=>'available','features'=>['Product catalog sync','Order fulfillment','Live shopping ready'] ],
            [ 'type'=>'pinterest','name'=>'Pinterest','description'=>'Show products in Pinterest feeds','status'=>'coming_soon','features'=>['Product pins','Shopping ads'] ],
        ] ] );
    }

    public static function get_channel( WP_REST_Request $req ) {
        $t   = blu_table( 'channels' );
        $row = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s AND merchant_id = %s", [ $req->get_param( 'id' ), blu_merchant_id() ] );
        if ( ! $row ) return blu_error( 'Channel not found', 404 );
        unset( $row->credentials );
        $row->config = json_decode( $row->config ?? '{}' );
        return blu_success( [ 'channel' => $row ] );
    }

    public static function disconnect( WP_REST_Request $req ) {
        $t = blu_table( 'channels' );
        $a = Blu_DB::query( "UPDATE {$t} SET status='disconnected', credentials='{}', updated_at=NOW() WHERE id=%s AND merchant_id=%s",
            [ $req->get_param( 'id' ), blu_merchant_id() ] );
        if ( ! $a ) return blu_error( 'Channel not found', 404 );
        return blu_success( [ 'message' => 'Channel disconnected' ] );
    }

    public static function configure( WP_REST_Request $req ): WP_REST_Response {
        $body = $req->get_json_params();
        $t    = blu_table( 'channels' );
        $id   = $req->get_param( 'id' );
        $mid  = blu_merchant_id();

        $update = [];
        if ( isset( $body['config'] ) )               $update['config']               = wp_json_encode( $body['config'] );
        if ( isset( $body['auto_sync'] ) )             $update['auto_sync']            = $body['auto_sync'] ? 1 : 0;
        if ( isset( $body['sync_interval_minutes'] ) ) $update['sync_interval_minutes']= (int) $body['sync_interval_minutes'];

        if ( ! empty( $update ) ) Blu_DB::update( $t, $update, [ 'id' => $id, 'merchant_id' => $mid ] );
        $row = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $id ] );
        if ( ! $row ) return blu_error( 'Channel not found', 404 );
        unset( $row->credentials );
        $row->config = json_decode( $row->config ?? '{}' );
        return blu_success( [ 'channel' => $row ] );
    }

    public static function sync( WP_REST_Request $req ): WP_REST_Response {
        $id  = $req->get_param( 'id' );
        $mid = blu_merchant_id();
        $tc  = blu_table( 'channels' );
        $tp  = blu_table( 'products' );
        $tcp = blu_table( 'channel_products' );
        $tl  = blu_table( 'channel_sync_logs' );

        $channel = Blu_DB::get_row( "SELECT * FROM {$tc} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
        if ( ! $channel ) return blu_error( 'Channel not found', 404 );
        if ( $channel->status !== 'connected' ) return blu_error( 'Channel not connected' );

        $products = Blu_DB::get_results( "SELECT * FROM {$tp} WHERE merchant_id = %s AND status = 'active'", [ $mid ] );
        $start    = microtime( true );
        $logId    = blu_uuid();

        Blu_DB::insert( $tl, [ 'id' => $logId, 'channel_id' => $id, 'sync_type' => 'full', 'status' => 'started' ] );

        // Demo mode: simulate sync
        foreach ( $products as $p ) {
            global $wpdb;
            $wpdb->query( $wpdb->prepare(
                "INSERT INTO {$tcp} (id, channel_id, product_id, external_id, sync_status, approval_status, last_sync_at)
                 VALUES (%s, %s, %s, %s, 'synced', 'approved', NOW())
                 ON DUPLICATE KEY UPDATE sync_status='synced', approval_status='approved', last_sync_at=NOW()",
                blu_uuid(), $id, $p->id, 'demo-' . ( $p->sku ?: $p->id )
            ) );
        }

        $duration = (int) ( ( microtime( true ) - $start ) * 1000 );
        Blu_DB::update( $tl, [
            'status'             => 'completed',
            'products_processed' => count( $products ),
            'products_created'   => count( $products ),
            'completed_at'       => current_time( 'mysql', true ),
            'duration_ms'        => $duration,
        ], [ 'id' => $logId ] );

        Blu_DB::update( $tc, [ 'last_sync_at' => current_time( 'mysql', true ), 'products_synced' => count( $products ), 'products_approved' => count( $products ) ], [ 'id' => $id ] );

        return blu_success( [ 'sync_id' => $logId, 'status' => 'completed', 'demo_mode' => true, 'results' => [ 'total' => count( $products ), 'synced' => count( $products ), 'failed' => 0, 'duration_ms' => $duration ] ] );
    }

    public static function status( WP_REST_Request $req ): WP_REST_Response {
        $tcp = blu_table( 'channel_products' );
        $id  = $req->get_param( 'id' );
        $row = Blu_DB::get_row(
            "SELECT SUM(sync_status='synced' AND approval_status='approved') AS approved,
                    SUM(sync_status='synced' AND (approval_status='pending' OR approval_status IS NULL)) AS pending,
                    SUM(sync_status='error' OR approval_status='disapproved') AS disapproved,
                    COUNT(*) AS total
             FROM {$tcp} WHERE channel_id = %s",
            [ $id ]
        );
        return blu_success( [ 'summary' => $row, 'total_products' => (int) ( $row->total ?? 0 ) ] );
    }

    public static function logs( WP_REST_Request $req ): WP_REST_Response {
        $t    = blu_table( 'channel_sync_logs' );
        $rows = Blu_DB::get_results( "SELECT * FROM {$t} WHERE channel_id = %s ORDER BY started_at DESC LIMIT 20", [ $req->get_param( 'id' ) ] );
        return blu_success( [ 'logs' => $rows ] );
    }

    public static function products( WP_REST_Request $req ): WP_REST_Response {
        $tcp = blu_table( 'channel_products' );
        $tp  = blu_table( 'products' );
        $rows = Blu_DB::get_results(
            "SELECT cp.*, p.name AS product_name, p.sku AS product_sku, p.images
             FROM {$tcp} cp JOIN {$tp} p ON cp.product_id = p.id
             WHERE cp.channel_id = %s ORDER BY cp.updated_at DESC LIMIT 50",
            [ $req->get_param( 'id' ) ]
        );
        foreach ( $rows as &$r ) $r->images = json_decode( $r->images ?? '[]' );
        return blu_success( [ 'products' => $rows ] );
    }

    public static function demo_auth( WP_REST_Request $req ): WP_REST_Response {
        $mid  = blu_merchant_id();
        $tc   = blu_table( 'channels' );
        $path = $req->get_route();

        // Determine type from route
        $type_map = [ 'google' => 'google_merchant', 'meta' => 'meta_commerce', 'etsy' => 'etsy', 'tiktok' => 'tiktok_shop' ];
        $name_map = [ 'google' => 'Google Merchant Center', 'meta' => 'Meta Commerce', 'etsy' => 'Etsy', 'tiktok' => 'TikTok Shop' ];
        $key = '';
        foreach ( $type_map as $k => $v ) { if ( strpos( $path, $k ) !== false ) { $key = $k; break; } }

        $type   = $type_map[ $key ] ?? 'unknown';
        $name   = $name_map[ $key ] ?? 'Unknown';
        $config = wp_json_encode( [ 'demo_mode' => true ] );
        $id     = blu_uuid();

        global $wpdb;
        $wpdb->query( $wpdb->prepare(
            "INSERT INTO {$tc} (id, merchant_id, type, name, status, config) VALUES (%s, %s, %s, %s, 'connected', %s)
             ON DUPLICATE KEY UPDATE status='connected', config=%s, updated_at=NOW()",
            $id, $mid, $type, $name, $config, $config
        ) );

        $row = Blu_DB::get_row( "SELECT id FROM {$tc} WHERE merchant_id = %s AND type = %s", [ $mid, $type ] );
        return blu_success( [ 'success' => true, 'channelId' => $row->id, 'demo_mode' => true ] );
    }
}

/* ═══════════════════════════════════════════════════════════
 *  PLATFORMS CONTROLLER  (platforms.js)
 * ═══════════════════════════════════════════════════════════ */
class Blu_Platforms_Controller {
    public static function register( string $ns ): void {
        $admin = [ Blu_REST_API::class, 'admin_permission' ];

        register_rest_route( $ns, '/platforms', [
            [ 'methods' => 'GET',  'callback' => [ __CLASS__, 'list_platforms' ],  'permission_callback' => $admin ],
            [ 'methods' => 'POST', 'callback' => [ __CLASS__, 'connect' ],         'permission_callback' => $admin ],
        ] );
        register_rest_route( $ns, '/platforms/(?P<id>[a-f0-9-]+)', [
            'methods' => 'DELETE', 'callback' => [ __CLASS__, 'disconnect' ], 'permission_callback' => $admin,
        ] );
    }

    public static function list_platforms(): WP_REST_Response {
        $t    = blu_table( 'platform_adapters' );
        $rows = Blu_DB::get_results( "SELECT * FROM {$t} WHERE merchant_id = %s ORDER BY created_at DESC", [ blu_merchant_id() ] );
        foreach ( $rows as &$r ) $r->config = json_decode( $r->config ?? '{}' );
        return blu_success( [ 'platforms' => $rows ] );
    }

    public static function connect( WP_REST_Request $req ): WP_REST_Response {
        $body = $req->get_json_params();
        $t    = blu_table( 'platform_adapters' );
        $mid  = blu_merchant_id();

        if ( empty( $body['platform_type'] ) || empty( $body['url'] ) || empty( $body['consumer_key'] ) || empty( $body['consumer_secret'] ) ) {
            return blu_success( [ 'error' => 'Missing required fields' ], 400 );
        }

        $id = blu_uuid();
        Blu_DB::insert( $t, [
            'id'            => $id,
            'merchant_id'   => $mid,
            'platform_type' => $body['platform_type'],
            'platform_name' => $body['platform_name'] ?? $body['platform_type'],
            'config'        => wp_json_encode( [
                'url'             => rtrim( $body['url'], '/' ),
                'consumer_key'    => $body['consumer_key'],
                'consumer_secret' => $body['consumer_secret'],
            ] ),
            'status' => 'active',
        ] );

        $row = Blu_DB::get_row( "SELECT * FROM {$t} WHERE id = %s", [ $id ] );
        $row->config = json_decode( $row->config ?? '{}' );
        return blu_success( [ 'platform' => $row, 'message' => 'Platform connected successfully' ], 201 );
    }

    public static function disconnect( WP_REST_Request $req ) {
        $t = blu_table( 'platform_adapters' );
        $a = Blu_DB::delete( $t, [ 'id' => $req->get_param( 'id' ), 'merchant_id' => blu_merchant_id() ] );
        if ( ! $a ) return blu_error( 'Platform not found', 404 );
        return blu_success( [ 'message' => 'Platform disconnected' ] );
    }
}

/* ═══════════════════════════════════════════════════════════
 *  SYNC CONTROLLER  (sync.js) — placeholder for WooCommerce sync
 * ═══════════════════════════════════════════════════════════ */
class Blu_Sync_Controller {
    public static function register( string $ns ): void {
        $admin = [ Blu_REST_API::class, 'admin_permission' ];

        register_rest_route( $ns, '/sync/pull/(?P<platformId>[a-f0-9-]+)', [
            'methods' => 'POST', 'callback' => [ __CLASS__, 'pull' ], 'permission_callback' => $admin,
        ] );
        register_rest_route( $ns, '/sync/push/(?P<productId>[a-f0-9-]+)/(?P<platformId>[a-f0-9-]+)', [
            'methods' => 'POST', 'callback' => [ __CLASS__, 'push' ], 'permission_callback' => $admin,
        ] );
    }

    public static function pull( WP_REST_Request $req ): WP_REST_Response {
        // TODO: Implement WooCommerce REST API client in PHP
        // This requires a PHP HTTP client (wp_remote_get/post with HMAC auth)
        return blu_success( [ 'message' => 'WooCommerce sync via PHP not yet implemented — use the WP admin adapter or REST API directly.' ] );
    }

    public static function push( WP_REST_Request $req ): WP_REST_Response {
        return blu_success( [ 'message' => 'WooCommerce push via PHP not yet implemented.' ] );
    }
}
