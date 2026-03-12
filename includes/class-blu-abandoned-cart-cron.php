<?php
/**
 * Blu Store – Abandoned Cart Recovery Cron
 *
 * Handles scheduled processing of abandoned carts:
 * 1. Marks idle carts as abandoned
 * 2. Sends recovery email sequence (3 emails with escalating discounts)
 * 3. Cleans up expired carts
 *
 * Recovery emails use wp_mail() — compatible with WP Mail SMTP and other
 * SMTP plugins for reliable delivery.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_Abandoned_Cart_Cron {

    const CRON_HOOK     = 'blu_process_abandoned_carts';
    const CRON_INTERVAL = 'blu_fifteen_minutes';

    /**
     * Register cron schedule and hook. Called from blu-store.php.
     */
    public static function init(): void {
        add_filter( 'cron_schedules', [ __CLASS__, 'add_cron_interval' ] );
        add_action( self::CRON_HOOK, [ __CLASS__, 'process_carts' ] );

        // Schedule if not already scheduled
        if ( ! wp_next_scheduled( self::CRON_HOOK ) ) {
            wp_schedule_event( time(), self::CRON_INTERVAL, self::CRON_HOOK );
        }
    }

    /**
     * Unschedule on plugin deactivation.
     */
    public static function deactivate(): void {
        wp_clear_scheduled_hook( self::CRON_HOOK );
    }

    /**
     * Add 15-minute interval to WP-Cron.
     */
    public static function add_cron_interval( array $schedules ): array {
        $schedules[ self::CRON_INTERVAL ] = [
            'interval' => 900, // 15 minutes
            'display'  => __( 'Every 15 minutes', 'blu-store' ),
        ];
        return $schedules;
    }

    /**
     * Main cron job: mark abandoned, send emails, cleanup.
     */
    public static function process_carts(): void {
        $mid      = blu_merchant_id();
        $t        = blu_table( 'abandoned_carts' );
        $settings = self::get_settings( $mid );

        if ( ! $settings->enabled ) return;

        $timeout = (int) $settings->abandonment_timeout;

        // 1. Mark active carts as abandoned if idle for $timeout minutes
        Blu_DB::query(
            "UPDATE {$t} SET status = 'abandoned', abandoned_at = NOW(), updated_at = NOW()
             WHERE merchant_id = %s
               AND status = 'active'
               AND customer_email IS NOT NULL
               AND customer_email != ''
               AND updated_at < DATE_SUB(NOW(), INTERVAL %d MINUTE)",
            [ $mid, $timeout ]
        );

        // 2. Send recovery emails
        if ( $settings->email1_enabled ) {
            self::send_batch( $mid, $settings, 1 );
        }
        if ( $settings->email2_enabled ) {
            self::send_batch( $mid, $settings, 2 );
        }
        if ( $settings->email3_enabled ) {
            self::send_batch( $mid, $settings, 3 );
        }

        // 3. Cleanup old carts
        $expiry_days = (int) $settings->cart_expiry_days;
        if ( $expiry_days > 0 ) {
            Blu_DB::query(
                "DELETE FROM {$t}
                 WHERE merchant_id = %s
                   AND status IN ('active', 'abandoned')
                   AND created_at < DATE_SUB(NOW(), INTERVAL %d DAY)",
                [ $mid, $expiry_days ]
            );
        }
    }

    /**
     * Send a batch of emails for a given step (1, 2, or 3).
     */
    private static function send_batch( string $mid, object $settings, int $step ): void {
        $t = blu_table( 'abandoned_carts' );

        // Determine delay for this step
        $delay_key    = "email{$step}_delay";
        $subject_key  = "email{$step}_subject";
        $delay        = (int) $settings->$delay_key;

        // Select carts ready for this email step
        $carts = Blu_DB::get_results(
            "SELECT * FROM {$t}
             WHERE merchant_id = %s
               AND status = 'abandoned'
               AND emails_sent = %d
               AND abandoned_at <= DATE_SUB(NOW(), INTERVAL %d MINUTE)
               AND customer_email IS NOT NULL
               AND customer_email != ''
             ORDER BY abandoned_at ASC
             LIMIT 50",
            [ $mid, $step - 1, $delay ]
        );

        if ( empty( $carts ) ) return;

        $store = self::get_store_info( $mid );

        foreach ( $carts as $cart ) {
            // Generate discount code for emails 2 and 3
            $discount_code = $cart->discount_code;
            if ( $step >= 2 && ! $discount_code ) {
                $discount_pct_key = "email{$step}_discount_pct";
                $discount_pct = (int) $settings->$discount_pct_key;
                if ( $discount_pct > 0 ) {
                    $discount_code = self::create_recovery_discount( $mid, $cart, $discount_pct );
                    Blu_DB::query(
                        "UPDATE {$t} SET discount_code = %s WHERE id = %s",
                        [ $discount_code, $cart->id ]
                    );
                    $cart->discount_code = $discount_code;
                }
            }

            $subject = $settings->$subject_key;
            $html    = self::build_email_html( $cart, $store, $step, $settings );

            $headers = [
                'Content-Type: text/html; charset=UTF-8',
                'From: ' . $store['name'] . ' <' . $store['email'] . '>',
            ];

            $sent = wp_mail( $cart->customer_email, $subject, $html, $headers );

            if ( $sent ) {
                $sent_col = "email{$step}_sent_at";
                Blu_DB::query(
                    "UPDATE {$t} SET
                        emails_sent = %d,
                        {$sent_col} = NOW(),
                        last_email_sent_at = NOW(),
                        updated_at = NOW()
                     WHERE id = %s",
                    [ $step, $cart->id ]
                );
            }
        }
    }

    /**
     * Create an auto-generated recovery discount code.
     */
    private static function create_recovery_discount( string $mid, object $cart, int $pct ): string {
        $code  = 'RECOVER-' . strtoupper( substr( bin2hex( random_bytes( 3 ) ), 0, 6 ) );
        $dt    = blu_table( 'discounts' );

        Blu_DB::insert( $dt, [
            'id'                       => blu_uuid(),
            'merchant_id'              => $mid,
            'code'                     => $code,
            'description'              => 'Auto-generated cart recovery discount for ' . $cart->customer_email,
            'type'                     => 'percentage',
            'value'                    => $pct,
            'usage_limit'              => 1,
            'usage_limit_per_customer' => 1,
            'starts_at'                => current_time( 'mysql', true ),
            'expires_at'               => gmdate( 'Y-m-d H:i:s', strtotime( '+7 days' ) ),
        ] );

        // Sync to WooCommerce coupon if WC is active
        if ( class_exists( 'WooCommerce' ) ) {
            $coupon = new \WC_Coupon();
            $coupon->set_code( $code );
            $coupon->set_discount_type( 'percent' );
            $coupon->set_amount( $pct );
            $coupon->set_usage_limit( 1 );
            $coupon->set_usage_limit_per_user( 1 );
            $coupon->set_date_expires( strtotime( '+7 days' ) );
            $coupon->set_description( 'Blu Store cart recovery code' );
            $coupon->save();
        }

        return $code;
    }

    /**
     * Build the recovery email HTML.
     */
    private static function build_email_html( object $cart, array $store, int $step, object $settings ): string {
        $items         = json_decode( $cart->cart_contents, true ) ?: [];
        $first_name    = explode( ' ', $cart->customer_name ?? '' )[0] ?: 'there';
        $recovery_url  = add_query_arg( [
            'blu_recover_cart' => $cart->recovery_token,
            'email'            => $step,
        ], site_url() );
        $pixel_url     = add_query_arg( [
            'blu_cart_pixel' => $cart->recovery_token,
            'email'          => $step,
        ], site_url() );

        $discount_pct  = 0;
        $discount_code = $cart->discount_code ?? '';
        if ( $step >= 2 ) {
            $pct_key      = "email{$step}_discount_pct";
            $discount_pct = (int) $settings->$pct_key;
        }

        $currency_symbol = self::get_currency_symbol( $cart->currency ?? 'USD' );

        // Build items HTML
        $items_html = '';
        foreach ( $items as $item ) {
            $img = $item['image_url']
                ? '<img src="' . esc_url( $item['image_url'] ) . '" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #E2E8F0;">'
                : '<div style="width:64px;height:64px;background:#F1F5F9;border-radius:8px;border:1px solid #E2E8F0;"></div>';
            $price = $currency_symbol . number_format( $item['price_cents'] / 100, 2 );
            $items_html .= '
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #F1F5F9;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
                  <td width="64" style="vertical-align:top;">' . $img . '</td>
                  <td style="vertical-align:top;padding-left:16px;">
                    <p style="margin:0 0 4px;font-weight:600;color:#1E293B;font-size:14px;">' . esc_html( $item['name'] ) . '</p>
                    <p style="margin:0;color:#64748B;font-size:13px;">Qty: ' . (int) $item['quantity'] . '</p>
                  </td>
                  <td width="80" style="vertical-align:top;text-align:right;">
                    <p style="margin:0;font-weight:600;color:#1E293B;font-size:14px;">' . $price . '</p>
                  </td>
                </tr></table>
              </td>
            </tr>';
        }

        $total = $currency_symbol . number_format( $cart->cart_total_cents / 100, 2 );

        // Headline and intro text per step
        switch ( $step ) {
            case 1:
                $headline = 'You left something behind';
                $intro    = "Hi {$first_name}, we noticed you didn't finish checking out. Your items are still waiting for you.";
                $cta_text = 'Complete Your Purchase';
                break;
            case 2:
                $headline = 'Still thinking it over?';
                $intro    = "Hi {$first_name}, your cart is still saved. To make it easier, here's <strong>{$discount_pct}% off</strong> your order.";
                $cta_text = "Use Code {$discount_code} &amp; Save";
                break;
            case 3:
                $headline = 'Last chance — your cart is expiring';
                $intro    = "Hi {$first_name}, your items won't be reserved much longer. Use code <strong>{$discount_code}</strong> for <strong>{$discount_pct}% off</strong> — our best offer.";
                $cta_text = "Claim Your {$discount_pct}% Off Now";
                break;
            default:
                $headline = 'Your cart is waiting';
                $intro    = "Hi {$first_name}, come back and complete your purchase.";
                $cta_text = 'Return to Cart';
        }

        $logo_html = '';
        if ( ! empty( $store['logo_url'] ) ) {
            $logo_html = '<img src="' . esc_url( $store['logo_url'] ) . '" alt="' . esc_attr( $store['name'] ) . '" style="max-height:40px;width:auto;">';
        } else {
            $logo_html = '<span style="font-size:20px;font-weight:700;color:#1E293B;">' . esc_html( $store['name'] ) . '</span>';
        }

        $discount_banner = '';
        if ( $step >= 2 && $discount_pct > 0 && $discount_code ) {
            $discount_banner = '
            <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
              <p style="margin:0 0 8px;color:#1E40AF;font-size:14px;font-weight:600;">YOUR EXCLUSIVE DISCOUNT</p>
              <p style="margin:0 0 8px;font-size:32px;font-weight:800;color:#2563EB;letter-spacing:2px;">' . esc_html( $discount_code ) . '</p>
              <p style="margin:0;color:#3B82F6;font-size:14px;">' . $discount_pct . '% off your order · Expires in 7 days</p>
            </div>';
        }

        return '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="padding:32px 40px;text-align:center;border-bottom:1px solid #F1F5F9;">
    ' . $logo_html . '
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:40px;">
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#1E293B;text-align:center;">' . esc_html( $headline ) . '</h1>
    <p style="margin:0 0 32px;font-size:15px;color:#475569;line-height:1.6;text-align:center;">' . $intro . '</p>

    ' . $discount_banner . '

    <!-- Cart Items -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      ' . $items_html . '
    </table>

    <!-- Total -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:16px 0;border-top:2px solid #E2E8F0;">
          <span style="font-size:15px;color:#64748B;">Total</span>
        </td>
        <td style="padding:16px 0;border-top:2px solid #E2E8F0;text-align:right;">
          <span style="font-size:18px;font-weight:700;color:#1E293B;">' . $total . '</span>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;">
      <tr><td align="center">
        <a href="' . esc_url( $recovery_url ) . '" style="display:inline-block;padding:16px 48px;background:#2563EB;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:600;border-radius:12px;letter-spacing:0.3px;">' . $cta_text . '</a>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 40px;background:#F8FAFC;border-top:1px solid #F1F5F9;text-align:center;">
    <p style="margin:0 0 8px;font-size:12px;color:#94A3B8;">You\'re receiving this because you started a checkout at ' . esc_html( $store['name'] ) . '.</p>
    <p style="margin:0;font-size:12px;color:#94A3B8;">' . esc_html( $store['address'] ) . '</p>
  </td></tr>

</table>
<!-- Tracking pixel -->
<img src="' . esc_url( $pixel_url ) . '" width="1" height="1" style="display:none;" alt="">
</td></tr>
</table>
</body>
</html>';
    }

    /**
     * Get store info for email templates.
     */
    private static function get_store_info( string $mid ): array {
        $st = blu_table( 'store_settings' );
        $mt = blu_table( 'merchants' );

        $store = Blu_DB::get_row( "SELECT * FROM {$st} WHERE merchant_id = %s", [ $mid ] );
        $merch = Blu_DB::get_row( "SELECT name, logo_url FROM {$mt} WHERE id = %s", [ $mid ] );

        $name  = $merch->name ?? get_bloginfo( 'name' );
        $email = $store->support_email ?? get_option( 'admin_email' );
        $logo  = $merch->logo_url ?? '';

        $address_parts = array_filter( [
            $store->address_line1 ?? '',
            $store->city ?? '',
            $store->state ?? '',
            $store->postal_code ?? '',
        ] );
        $address = implode( ', ', $address_parts ) ?: $name;

        return [
            'name'     => $name,
            'email'    => $email,
            'logo_url' => $logo,
            'address'  => $address,
        ];
    }

    /**
     * Get abandoned cart settings (with defaults).
     */
    public static function get_settings( string $mid ): object {
        $t = blu_table( 'abandoned_cart_settings' );
        $row = Blu_DB::get_row( "SELECT * FROM {$t} WHERE merchant_id = %s", [ $mid ] );

        if ( $row ) return $row;

        // Return defaults
        return (object) [
            'enabled'              => 1,
            'abandonment_timeout'  => 60,
            'email1_enabled'       => 1,
            'email1_delay'         => 60,
            'email1_subject'       => 'You left something behind',
            'email2_enabled'       => 1,
            'email2_delay'         => 1440,
            'email2_subject'       => 'Still thinking it over?',
            'email2_discount_pct'  => 10,
            'email3_enabled'       => 1,
            'email3_delay'         => 4320,
            'email3_subject'       => 'Last chance — your cart is expiring',
            'email3_discount_pct'  => 15,
            'cart_expiry_days'     => 30,
        ];
    }

    /**
     * Send a test email to the admin.
     */
    public static function send_test_email( string $mid ): bool {
        $settings = self::get_settings( $mid );
        $store    = self::get_store_info( $mid );
        $admin    = get_option( 'admin_email' );

        // Build a fake cart for preview
        $fake_cart = (object) [
            'id'               => 'test-' . time(),
            'customer_email'   => $admin,
            'customer_name'    => 'Test Customer',
            'cart_contents'    => wp_json_encode( [
                [ 'product_id' => 0, 'variant_id' => 0, 'name' => 'Sample Product', 'image_url' => '', 'price_cents' => 2999, 'quantity' => 2 ],
                [ 'product_id' => 0, 'variant_id' => 0, 'name' => 'Another Item', 'image_url' => '', 'price_cents' => 4500, 'quantity' => 1 ],
            ] ),
            'cart_total_cents'  => 10498,
            'currency'          => 'USD',
            'recovery_token'    => 'test-preview-token',
            'discount_code'     => 'RECOVER-TEST10',
        ];

        $html = self::build_email_html( $fake_cart, $store, 2, $settings );

        $headers = [
            'Content-Type: text/html; charset=UTF-8',
            'From: ' . $store['name'] . ' <' . $store['email'] . '>',
        ];

        return wp_mail( $admin, '[TEST] ' . $settings->email2_subject, $html, $headers );
    }

    /**
     * Get currency symbol from code.
     */
    private static function get_currency_symbol( string $code ): string {
        $symbols = [
            'USD' => '$', 'CAD' => '$', 'AUD' => '$', 'NZD' => '$', 'SGD' => '$', 'MXN' => '$',
            'GBP' => '£', 'EUR' => '€', 'JPY' => '¥', 'INR' => '₹', 'BRL' => 'R$',
            'SEK' => 'kr', 'NOK' => 'kr', 'DKK' => 'kr', 'CHF' => 'Fr',
        ];
        return $symbols[ $code ] ?? '$';
    }
}
