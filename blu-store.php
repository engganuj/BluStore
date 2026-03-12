<?php
/**
 * Plugin Name: Blu Store
 * Plugin URI:  https://blu.store
 * Description: AI-first composable commerce platform — products, orders, channels, Stripe sync, and more — with a React admin dashboard.
 * Version:     1.0.0
 * Author:      Blu Store
 * Author URI:  https://blu.store
 * License:     GPL-2.0+
 * Text Domain: blu-store
 *
 * Requires PHP: 7.4
 * Requires at least: 5.9
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'BLU_VERSION', '1.0.0' );
define( 'BLU_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'BLU_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'BLU_PLUGIN_FILE', __FILE__ );

/* ─── Autoload helpers ─── */
require_once BLU_PLUGIN_DIR . 'includes/helpers.php';

/* ─── Activation / Deactivation ─── */
require_once BLU_PLUGIN_DIR . 'includes/class-blu-activator.php';
register_activation_hook( __FILE__, [ 'Blu_Activator', 'activate' ] );
register_deactivation_hook( __FILE__, [ 'Blu_Activator', 'deactivate' ] );
register_deactivation_hook( __FILE__, [ 'Blu_Abandoned_Cart_Cron', 'deactivate' ] );

/* ─── Database abstraction ─── */
require_once BLU_PLUGIN_DIR . 'includes/class-blu-db.php';

/* ─── REST API ─── */
require_once BLU_PLUGIN_DIR . 'includes/class-blu-rest-api.php';
add_action( 'rest_api_init', [ 'Blu_REST_API', 'register_routes' ] );

/* ─── Admin page (React shell) ─── */
require_once BLU_PLUGIN_DIR . 'admin/class-blu-admin.php';
Blu_Admin::init();

/* ─── WooCommerce Auto Sync (bidirectional, native PHP) ─── */
require_once BLU_PLUGIN_DIR . 'includes/class-blu-woo-auto-sync.php';
add_action( 'plugins_loaded', [ 'Blu_Woo_Auto_Sync', 'init' ] );

/* ─── Stripe webhook listener (front-end POST) ─── */
require_once BLU_PLUGIN_DIR . 'includes/class-blu-stripe-webhook.php';

add_action( 'init', function () {
    add_rewrite_rule( '^blu-webhook/stripe/?$', 'index.php?blu_stripe_webhook=1', 'top' );
} );

add_filter( 'query_vars', function ( $vars ) {
    $vars[] = 'blu_stripe_webhook';
    return $vars;
} );

Blu_Stripe_Webhook_Handler::init();

/* ─── Abandoned Cart Recovery (cron + email) ─── */
require_once BLU_PLUGIN_DIR . 'includes/class-blu-abandoned-cart-cron.php';
add_action( 'plugins_loaded', [ 'Blu_Abandoned_Cart_Cron', 'init' ] );

/* ─── Cart recovery link handler ─── */
add_filter( 'query_vars', function ( $vars ) {
    $vars[] = 'blu_recover_cart';
    $vars[] = 'blu_cart_pixel';
    $vars[] = 'blu_cart_click';
    return $vars;
} );

add_action( 'template_redirect', function () {
    // ── Recovery link: restore WC cart and redirect to checkout ──
    $token = sanitize_text_field( $_GET['blu_recover_cart'] ?? '' );
    if ( $token ) {
        $t    = blu_table( 'abandoned_carts' );
        $cart = Blu_DB::get_row(
            "SELECT * FROM {$t} WHERE recovery_token = %s AND status IN ('abandoned', 'recovered') LIMIT 1",
            [ $token ]
        );

        if ( $cart && class_exists( 'WooCommerce' ) && WC()->cart ) {
            WC()->cart->empty_cart();

            $items = json_decode( $cart->cart_contents, true ) ?: [];
            foreach ( $items as $item ) {
                $product_id   = (int) $item['product_id'];
                $variation_id = (int) ( $item['variant_id'] ?? 0 );
                $quantity     = (int) ( $item['quantity'] ?? 1 );

                if ( $product_id > 0 ) {
                    // Map Blu product ID to WC product ID
                    $pt = blu_table( 'products' );
                    $blu_prod = Blu_DB::get_row(
                        "SELECT woo_product_id FROM {$pt} WHERE id = %s",
                        [ $product_id ]
                    );
                    $wc_pid = $blu_prod->woo_product_id ?? $product_id;
                    WC()->cart->add_to_cart( (int) $wc_pid, $quantity, $variation_id > 0 ? $variation_id : 0 );
                }
            }

            // Auto-apply discount code if present
            if ( ! empty( $cart->discount_code ) ) {
                WC()->cart->apply_coupon( $cart->discount_code );
            }

            // Track click if email param present
            $email_step = (int) ( $_GET['email'] ?? 0 );
            if ( $email_step >= 1 && $email_step <= 3 ) {
                $click_col = "email{$email_step}_clicked_at";
                Blu_DB::query(
                    "UPDATE {$t} SET {$click_col} = COALESCE({$click_col}, NOW()), updated_at = NOW() WHERE id = %s",
                    [ $cart->id ]
                );
            }

            // Mark as recovered
            Blu_DB::query(
                "UPDATE {$t} SET status = 'recovered', recovered_at = NOW(), updated_at = NOW() WHERE id = %s",
                [ $cart->id ]
            );

            wp_safe_redirect( wc_get_checkout_url() );
            exit;
        }

        // Cart not found or expired — redirect to shop
        wp_safe_redirect( wc_get_page_permalink( 'shop' ) ?: site_url() );
        exit;
    }

    // ── Tracking pixel: record email opens ──
    $pixel_token = sanitize_text_field( $_GET['blu_cart_pixel'] ?? '' );
    if ( $pixel_token ) {
        $email_step = (int) ( $_GET['email'] ?? 0 );
        if ( $email_step >= 1 && $email_step <= 3 ) {
            $t = blu_table( 'abandoned_carts' );
            $open_col = "email{$email_step}_opened_at";
            Blu_DB::query(
                "UPDATE {$t} SET {$open_col} = COALESCE({$open_col}, NOW()), updated_at = NOW() WHERE recovery_token = %s",
                [ $pixel_token ]
            );
        }

        // Serve 1x1 transparent GIF
        header( 'Content-Type: image/gif' );
        header( 'Cache-Control: no-cache, no-store, must-revalidate' );
        echo base64_decode( 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' );
        exit;
    }
} );
