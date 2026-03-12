<?php
/**
 * Blu Store Stripe Webhook Handler
 *
 * Handles incoming Stripe webhook events for product sync.
 * Converted from: api/src/routes/stripe-webhooks.js
 *
 * This is NOT a REST controller — it hooks into the rewrite rule
 * registered in blu-store.php (/blu-webhook/stripe).
 *
 * Supported events:
 *  - product.created / product.updated / product.deleted
 *  - price.created / price.updated
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_Stripe_Webhook_Handler {

	/**
	 * Boot: listen for the rewrite tag added in the main plugin file.
	 */
	public static function init(): void {
		add_action( 'template_redirect', [ __CLASS__, 'maybe_handle' ] );
	}

	/**
	 * If the current request is the Stripe webhook endpoint, handle it.
	 */
	public static function maybe_handle(): void {
		if ( get_query_var( 'blu_stripe_webhook' ) !== '1' ) return;

		// Must be POST
		if ( $_SERVER['REQUEST_METHOD'] !== 'POST' ) {
			status_header( 405 );
			exit;
		}

		$raw  = file_get_contents( 'php://input' );
		$sig  = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
		$mid  = blu_merchant_id();
		$tm   = blu_table( 'merchants' );

		$merchant = Blu_DB::get_row(
			"SELECT stripe_webhook_secret, stripe_account_id, stripe_product_sync_enabled FROM {$tm} WHERE id = %s",
			[ $mid ]
		);

		if ( ! $merchant ) {
			wp_send_json( [ 'error' => 'Merchant not found' ], 400 );
		}

		// Verify signature if secret is configured
		$event = null;
		if ( $merchant->stripe_webhook_secret && $sig ) {
			$event = self::verify_signature( $raw, $sig, $merchant->stripe_webhook_secret );
			if ( ! $event ) {
				wp_send_json( [ 'error' => 'Invalid signature' ], 400 );
			}
		} else {
			$event = json_decode( $raw, true );
		}

		if ( ! $event || empty( $event['type'] ) ) {
			wp_send_json( [ 'error' => 'Invalid event' ], 400 );
		}

		$type = $event['type'];
		$obj  = $event['data']['object'] ?? [];

		// Skip product events when sync is disabled
		if ( ! $merchant->stripe_product_sync_enabled && strpos( $type, 'product.' ) === 0 ) {
			wp_send_json( [ 'received' => true, 'skipped' => true, 'reason' => 'sync_disabled' ] );
		}

		// Dispatch
		switch ( $type ) {
			case 'product.created':
				self::handle_product_created( $obj, $mid, $merchant->stripe_account_id );
				break;
			case 'product.updated':
				self::handle_product_updated( $obj, $mid, $merchant->stripe_account_id );
				break;
			case 'product.deleted':
				self::handle_product_deleted( $obj, $mid );
				break;
			case 'price.created':
			case 'price.updated':
				self::handle_price_change( $obj, $mid );
				break;
		}

		// Audit log
		self::log_event( $mid, $event );

		wp_send_json( [ 'received' => true ] );
	}

	/* ───── Signature verification (manual — avoids requiring stripe-php) ───── */

	private static function verify_signature( string $payload, string $sig_header, string $secret ) {
		$parts = [];
		foreach ( explode( ',', $sig_header ) as $piece ) {
			[ $key, $val ] = explode( '=', $piece, 2 );
			$parts[ trim( $key ) ] = trim( $val );
		}
		$timestamp = $parts['t'] ?? '';
		$v1        = $parts['v1'] ?? '';

		if ( ! $timestamp || ! $v1 ) return null;

		$signed = hash_hmac( 'sha256', "{$timestamp}.{$payload}", $secret );

		if ( ! hash_equals( $signed, $v1 ) ) return null;

		// Reject if older than 5 minutes
		if ( abs( time() - (int) $timestamp ) > 300 ) return null;

		return json_decode( $payload, true );
	}

	/* ───── Event Handlers ───── */

	private static function handle_product_created( array $sp, string $mid, ?string $account_id ): void {
		// Skip products that originated from Blu Store (prevent loops)
		if ( ( $sp['metadata']['source'] ?? '' ) === 'blu' ) return;

		$tp = blu_table( 'products' );

		// Already exists?
		$exists = Blu_DB::get_var(
			"SELECT id FROM {$tp} WHERE stripe_product_id = %s AND merchant_id = %s",
			[ $sp['id'], $mid ]
		);
		if ( $exists ) return;

		$price = 0;
		$price_id = null;
		// If default_price is an expanded object
		if ( is_array( $sp['default_price'] ?? null ) ) {
			$price    = ( $sp['default_price']['unit_amount'] ?? 0 ) / 100;
			$price_id = $sp['default_price']['id'] ?? null;
		}

		$images = [];
		foreach ( $sp['images'] ?? [] as $url ) {
			$images[] = [ 'url' => $url ];
		}

		$status = ( $sp['active'] ?? true ) ? 'active' : 'draft';

		Blu_DB::insert( $tp, [
			'id'                     => blu_uuid(),
			'merchant_id'            => $mid,
			'name'                   => $sp['name'] ?? 'Untitled',
			'description'            => $sp['description'] ?? '',
			'price'                  => $price,
			'status'                 => $status,
			'stripe_product_id'      => $sp['id'],
			'stripe_price_id'        => $price_id,
			'stripe_sync_status'     => 'synced',
			'stripe_last_synced_at'  => current_time( 'mysql', true ),
			'images'                 => wp_json_encode( $images ),
		] );
	}

	private static function handle_product_updated( array $sp, string $mid, ?string $account_id ): void {
		$tp = blu_table( 'products' );

		$existing = Blu_DB::get_row(
			"SELECT id, stripe_sync_enabled FROM {$tp} WHERE stripe_product_id = %s AND merchant_id = %s",
			[ $sp['id'], $mid ]
		);

		if ( ! $existing ) {
			if ( ( $sp['metadata']['source'] ?? '' ) !== 'blu' ) {
				self::handle_product_created( $sp, $mid, $account_id );
			}
			return;
		}

		if ( ! $existing->stripe_sync_enabled ) return;

		$price    = 0;
		$price_id = null;
		if ( is_array( $sp['default_price'] ?? null ) ) {
			$price    = ( $sp['default_price']['unit_amount'] ?? 0 ) / 100;
			$price_id = $sp['default_price']['id'] ?? null;
		}

		$images = [];
		foreach ( $sp['images'] ?? [] as $url ) {
			$images[] = [ 'url' => $url ];
		}
		$status = ( $sp['active'] ?? true ) ? 'active' : 'draft';

		Blu_DB::update( $tp, [
			'name'                   => $sp['name'] ?? 'Untitled',
			'description'            => $sp['description'] ?? '',
			'status'                 => $status,
			'price'                  => $price,
			'stripe_price_id'        => $price_id,
			'stripe_sync_status'     => 'synced',
			'stripe_last_synced_at'  => current_time( 'mysql', true ),
			'images'                 => wp_json_encode( $images ),
		], [ 'id' => $existing->id ] );
	}

	private static function handle_product_deleted( array $sp, string $mid ): void {
		$tp = blu_table( 'products' );
		$existing = Blu_DB::get_row(
			"SELECT id FROM {$tp} WHERE stripe_product_id = %s AND merchant_id = %s",
			[ $sp['id'], $mid ]
		);
		if ( ! $existing ) return;

		Blu_DB::update( $tp, [
			'status'             => 'archived',
			'stripe_sync_status' => 'deleted_in_stripe',
		], [ 'id' => $existing->id ] );
	}

	private static function handle_price_change( array $sp, string $mid ): void {
		$stripe_product_id = $sp['product'] ?? null;
		if ( ! $stripe_product_id ) return;

		$tp = blu_table( 'products' );
		$existing = Blu_DB::get_row(
			"SELECT id, stripe_sync_enabled FROM {$tp} WHERE stripe_product_id = %s AND merchant_id = %s",
			[ $stripe_product_id, $mid ]
		);
		if ( ! $existing || ! $existing->stripe_sync_enabled ) return;

		$price = ( $sp['unit_amount'] ?? 0 ) / 100;

		Blu_DB::update( $tp, [
			'price'                  => $price,
			'stripe_price_id'        => $sp['id'],
			'stripe_last_synced_at'  => current_time( 'mysql', true ),
		], [ 'id' => $existing->id ] );
	}

	/* ───── Audit Log ───── */

	private static function log_event( string $mid, array $event ): void {
		$te  = blu_table( 'stripe_sync_events' );
		$tp  = blu_table( 'products' );
		$obj = $event['data']['object'] ?? [];

		// Resolve Blu Store product ID
		$stripe_pid = null;
		if ( strpos( $event['type'], 'product.' ) === 0 ) {
			$stripe_pid = $obj['id'] ?? null;
		} elseif ( strpos( $event['type'], 'price.' ) === 0 ) {
			$stripe_pid = $obj['product'] ?? null;
		}

		$product_id = null;
		if ( $stripe_pid ) {
			$product_id = Blu_DB::get_var(
				"SELECT id FROM {$tp} WHERE stripe_product_id = %s AND merchant_id = %s",
				[ $stripe_pid, $mid ]
			);
		}

		Blu_DB::insert( $te, [
			'id'              => blu_uuid(),
			'merchant_id'     => $mid,
			'product_id'      => $product_id,
			'event_type'      => $event['type'],
			'direction'       => 'stripe_to_blu',
			'stripe_event_id' => $event['id'] ?? null,
			'status'          => 'success',
			'payload'         => wp_json_encode( $obj ),
		] );
	}
}
