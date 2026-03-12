<?php
/**
 * Blu Store – WP REST API Router
 *
 * Registers all REST endpoints under the `blu/v1` namespace.
 * Each controller file maps 1:1 to the original route file.
 *
 * React frontend calls /wp-json/blu/v1/*.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

// Load all controllers
$controllers = glob( BLU_PLUGIN_DIR . 'includes/controllers/*.php' );
foreach ( $controllers as $controller ) {
    require_once $controller;
}

class Blu_REST_API {

    const NAMESPACE = 'blu/v1';

    /**
     * Permission callback: user must be logged into WP admin.
     * For public endpoints (UCP) we use __return_true.
     */
    public static function admin_permission(): bool {
        return current_user_can( 'manage_options' );
    }

    /**
     * Register all routes. Called on `rest_api_init`.
     */
    public static function register_routes(): void {
        $ns = self::NAMESPACE;

        // ── Products ──
        Blu_Products_Controller::register( $ns );

        // ── Orders ──
        Blu_Orders_Controller::register( $ns );

        // ── Store settings ──
        Blu_Store_Controller::register( $ns );

        // ── Customers ──
        Blu_Customers_Controller::register( $ns );

        // ── Shipping ──
        Blu_Shipping_Controller::register( $ns );

        // ── Discounts ──
        Blu_Discounts_Controller::register( $ns );

        // ── Channels ──
        Blu_Channels_Controller::register( $ns );

        // ── Platforms (WooCommerce adapters) ──
        Blu_Platforms_Controller::register( $ns );

        // ── Sync ──
        Blu_Sync_Controller::register( $ns );

        // ── Variants ──
        Blu_Variants_Controller::register_routes();

        // ── Stripe Connect + Product Sync ──
        Blu_Stripe_Controller::register_routes();

        // ── UCP (public — no auth required) ──
        Blu_UCP_Controller::register( $ns );

        // ── Abandoned Carts ──
        Blu_Abandoned_Carts_Controller::register( $ns );

        // ── Analytics & Reporting ──
        Blu_Analytics_Controller::register( $ns );

        // ── Design (colors, fonts, navigation) ──
        Blu_Design_Controller::register( $ns );

        // ── Health check ──
        register_rest_route( $ns, '/health', [
            'methods'             => 'GET',
            'callback'            => function () {
                return blu_success( [
                    'status'    => 'ok',
                    'message'   => 'Blu Store API is running!',
                    'timestamp' => gmdate( 'c' ),
                    'version'   => BLU_VERSION,
                    'woocommerce' => class_exists( 'WooCommerce' ) ? 'active' : 'not installed',
                ] );
            },
            'permission_callback' => '__return_true',
        ] );

        // ── Demo status ──
        register_rest_route( $ns, '/demo/status', [
            'methods'             => 'GET',
            'callback'            => function () {
                return blu_success( [
                    'populated'     => true,
                    'mode'          => 'wordpress',
                    'message'       => 'Running as WordPress plugin — demo data seeded on activation.',
                ] );
            },
            'permission_callback' => [ __CLASS__, 'admin_permission' ],
        ] );

        // ── WooCommerce local sync (bulk import existing data) ──
        if ( class_exists( 'Blu_Woo_Auto_Sync' ) ) {
            register_rest_route( $ns, '/sync/woo/import-products', [
                'methods'             => 'POST',
                'callback'            => function () {
                    if ( ! class_exists( 'WooCommerce' ) ) {
                        return blu_error( 'WooCommerce is not active', 400 );
                    }
                    return blu_success( Blu_Woo_Auto_Sync::import_all_products() );
                },
                'permission_callback' => [ __CLASS__, 'admin_permission' ],
            ] );

            register_rest_route( $ns, '/sync/woo/import-orders', [
                'methods'             => 'POST',
                'callback'            => function () {
                    if ( ! class_exists( 'WooCommerce' ) ) {
                        return blu_error( 'WooCommerce is not active', 400 );
                    }
                    return blu_success( Blu_Woo_Auto_Sync::import_all_orders() );
                },
                'permission_callback' => [ __CLASS__, 'admin_permission' ],
            ] );

            register_rest_route( $ns, '/sync/woo/status', [
                'methods'             => 'GET',
                'callback'            => function () {
                    $woo_active = class_exists( 'WooCommerce' );
                    $product_count = 0;
                    $order_count   = 0;

                    if ( $woo_active ) {
                        $product_count = (int) wp_count_posts( 'product' )->publish;
                        $order_count   = (int) wc_orders_count( 'processing' ) + (int) wc_orders_count( 'completed' );
                    }

                    $mid = blu_merchant_id();
                    $tp  = blu_table( 'products' );
                    $to  = blu_table( 'orders' );

                    $synced_products = (int) Blu_DB::get_var(
                        "SELECT COUNT(*) FROM {$tp} WHERE merchant_id = %s AND woo_product_id IS NOT NULL",
                        [ $mid ]
                    );
                    $synced_orders = (int) Blu_DB::get_var(
                        "SELECT COUNT(*) FROM {$to} WHERE merchant_id = %s AND woo_order_id IS NOT NULL",
                        [ $mid ]
                    );

                    return blu_success( [
                        'woocommerce_active'  => $woo_active,
                        'wc_products'         => $product_count,
                        'wc_orders'           => $order_count,
                        'blu_synced_products' => $synced_products,
                        'blu_synced_orders'   => $synced_orders,
                    ] );
                },
                'permission_callback' => [ __CLASS__, 'admin_permission' ],
            ] );
        }
    }
}
