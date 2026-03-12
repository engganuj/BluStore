<?php
/**
 * Blu Store Stripe Controller
 *
 * Stripe Connect OAuth flow + Stripe Product Sync management.
 * Converted from: api/src/routes/stripe.js & api/src/routes/stripe-sync.js
 *
 * Routes: /wp-json/blu/v1/store/stripe/*
 *
 * NOTE: Requires stripe/stripe-php via composer, or manual include.
 *       For now, methods that call the Stripe API check for the library
 *       and return an error if it isn't loaded.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_Stripe_Controller {

	/* ───── register ───── */
	public static function register_routes() {
		$ns    = 'blu/v1';
		$admin = array( 'permission_callback' => function () { return current_user_can( 'manage_options' ); } );

		/* ── Connect OAuth ── */
		register_rest_route( $ns, '/store/stripe/connect',    array( 'methods' => 'GET',  'callback' => array( __CLASS__, 'connect' ),    'permission_callback' => $admin['permission_callback'] ) );
		register_rest_route( $ns, '/store/stripe/callback',   array( 'methods' => 'GET',  'callback' => array( __CLASS__, 'callback' ),   'permission_callback' => '__return_true' ) );
		register_rest_route( $ns, '/store/stripe/status',     array( 'methods' => 'GET',  'callback' => array( __CLASS__, 'status' ),     'permission_callback' => $admin['permission_callback'] ) );
		register_rest_route( $ns, '/store/stripe/onboarding', array( 'methods' => 'GET',  'callback' => array( __CLASS__, 'onboarding' ), 'permission_callback' => $admin['permission_callback'] ) );
		register_rest_route( $ns, '/store/stripe/disconnect', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'disconnect' ), 'permission_callback' => $admin['permission_callback'] ) );

		/* ── Sync management ── */
		register_rest_route( $ns, '/store/stripe/sync/status',         array( 'methods' => 'GET',  'callback' => array( __CLASS__, 'sync_status' ),         'permission_callback' => $admin['permission_callback'] ) );
		register_rest_route( $ns, '/store/stripe/sync/enable',         array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'sync_enable' ),         'permission_callback' => $admin['permission_callback'] ) );
		register_rest_route( $ns, '/store/stripe/sync/disable',        array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'sync_disable' ),        'permission_callback' => $admin['permission_callback'] ) );
		register_rest_route( $ns, '/store/stripe/sync/webhook-secret', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'sync_webhook_secret' ), 'permission_callback' => $admin['permission_callback'] ) );
		register_rest_route( $ns, '/store/stripe/sync/all',            array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'sync_all' ),            'permission_callback' => $admin['permission_callback'] ) );
		register_rest_route( $ns, '/store/stripe/sync/import',         array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'sync_import' ),         'permission_callback' => $admin['permission_callback'] ) );
		register_rest_route( $ns, '/store/stripe/sync/events',         array( 'methods' => 'GET',  'callback' => array( __CLASS__, 'sync_events' ),         'permission_callback' => $admin['permission_callback'] ) );

		/* ── Per-product sync ── */
		register_rest_route( $ns, '/store/stripe/sync/product/(?P<id>[a-f0-9\-]{36})',         array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'sync_product' ),         'permission_callback' => $admin['permission_callback'] ) );
		register_rest_route( $ns, '/store/stripe/sync/product/(?P<id>[a-f0-9\-]{36})/enable',  array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'sync_product_enable' ),  'permission_callback' => $admin['permission_callback'] ) );
		register_rest_route( $ns, '/store/stripe/sync/product/(?P<id>[a-f0-9\-]{36})/disable', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'sync_product_disable' ), 'permission_callback' => $admin['permission_callback'] ) );
	}

	/* ─────────────────────── helpers ─────────────────────── */

	private static function merchant_id() {
		return blu_merchant_id();
	}

	private static function merchant_table() {
		return blu_table( 'merchants' );
	}

	private static function get_stripe() {
		if ( ! class_exists( '\Stripe\Stripe' ) ) {
			return null;
		}
		$key = defined( 'BLU_STRIPE_SECRET_KEY' ) ? BLU_STRIPE_SECRET_KEY : get_option( 'blu_stripe_secret_key', '' );
		if ( empty( $key ) ) return null;
		return new \Stripe\StripeClient( $key );
	}

	private static function frontend_url() {
		return admin_url( 'admin.php?page=blu-store' );
	}

	/* ══════════════════════════════════════════════════
	 *  CONNECT OAUTH
	 * ══════════════════════════════════════════════════ */

	/**
	 * GET /store/stripe/connect — Generate OAuth URL
	 */
	public static function connect( $request ) {
		$mt = self::merchant_table();
		$m  = Blu_DB::get_row( "SELECT email, name FROM {$mt} WHERE id = %s", array( self::merchant_id() ) );
		if ( ! $m ) return blu_error( 'Merchant not found', 404 );

		$client_id = defined( 'BLU_STRIPE_CLIENT_ID' ) ? BLU_STRIPE_CLIENT_ID : get_option( 'blu_stripe_client_id', '' );
		if ( empty( $client_id ) ) return blu_error( 'Stripe Client ID not configured', 400 );

		$redirect_uri = rest_url( 'blu/v1/store/stripe/callback' );
		$state        = base64_encode( wp_json_encode( array( 'merchantId' => self::merchant_id() ) ) );

		$params = array(
			'response_type'              => 'code',
			'client_id'                  => $client_id,
			'scope'                      => 'read_write',
			'redirect_uri'               => $redirect_uri,
			'state'                      => $state,
			'stripe_user[email]'         => $m->email,
			'stripe_user[business_name]' => $m->name,
		);

		return blu_success( array( 'url' => 'https://connect.stripe.com/oauth/authorize?' . http_build_query( $params ) ) );
	}

	/**
	 * GET /store/stripe/callback — Handle OAuth redirect
	 */
	public static function callback( $request ) {
		$error = $request->get_param( 'error' );
		$code  = $request->get_param( 'code' );
		$state = $request->get_param( 'state' );

		$frontend = self::frontend_url();

		if ( $error ) {
			wp_redirect( add_query_arg( 'stripe_error', urlencode( $request->get_param( 'error_description' ) ?: $error ), $frontend ) );
			exit;
		}

		if ( ! $code || ! $state ) {
			wp_redirect( add_query_arg( 'stripe_error', 'Missing authorization code', $frontend ) );
			exit;
		}

		$decoded = json_decode( base64_decode( $state ), true );
		$mid     = $decoded['merchantId'] ?? '';

		$stripe = self::get_stripe();
		if ( ! $stripe ) {
			wp_redirect( add_query_arg( 'stripe_error', 'Stripe library not loaded', $frontend ) );
			exit;
		}

		try {
			$response  = $stripe->oauth->token( array( 'grant_type' => 'authorization_code', 'code' => $code ) );
			$acct_id   = $response->stripe_user_id;

			$mt = self::merchant_table();
			Blu_DB::query(
				"UPDATE {$mt} SET stripe_account_id = %s, stripe_onboarding_complete = 1, stripe_connected_at = NOW(), updated_at = NOW() WHERE id = %s",
				array( $acct_id, $mid )
			);

			wp_redirect( add_query_arg( 'stripe_success', 'true', $frontend ) );
			exit;

		} catch ( \Exception $e ) {
			wp_redirect( add_query_arg( 'stripe_error', urlencode( $e->getMessage() ), $frontend ) );
			exit;
		}
	}

	/**
	 * GET /store/stripe/status
	 */
	public static function status( $request ) {
		$mt = self::merchant_table();
		$m  = Blu_DB::get_row(
			"SELECT stripe_account_id, stripe_onboarding_complete, stripe_connected_at FROM {$mt} WHERE id = %s",
			array( self::merchant_id() )
		);
		if ( ! $m ) return blu_error( 'Merchant not found', 404 );

		if ( ! $m->stripe_account_id ) {
			return blu_success( array( 'connected' => false, 'account_id' => null, 'onboarding_complete' => false ) );
		}

		$account_details = null;
		$stripe = self::get_stripe();
		if ( $stripe ) {
			try {
				$acct = $stripe->accounts->retrieve( $m->stripe_account_id );
				$account_details = array(
					'charges_enabled'  => $acct->charges_enabled,
					'payouts_enabled'  => $acct->payouts_enabled,
					'details_submitted' => $acct->details_submitted,
				);
			} catch ( \Exception $e ) { /* ignore */ }
		}

		return blu_success( array(
			'connected'            => true,
			'account_id'           => $m->stripe_account_id,
			'onboarding_complete'  => (bool) $m->stripe_onboarding_complete,
			'connected_at'         => $m->stripe_connected_at,
			'account_details'      => $account_details,
		));
	}

	/**
	 * GET /store/stripe/onboarding
	 */
	public static function onboarding( $request ) {
		$mt = self::merchant_table();
		$m  = Blu_DB::get_row(
			"SELECT stripe_account_id FROM {$mt} WHERE id = %s",
			array( self::merchant_id() )
		);
		if ( ! $m || ! $m->stripe_account_id ) return blu_error( 'No Stripe account connected', 400 );

		$stripe = self::get_stripe();
		if ( ! $stripe ) return blu_error( 'Stripe library not configured', 500 );

		try {
			$link = $stripe->accountLinks->create( array(
				'account'     => $m->stripe_account_id,
				'refresh_url' => add_query_arg( 'stripe_refresh', 'true', self::frontend_url() ),
				'return_url'  => add_query_arg( 'stripe_onboarding', 'complete', self::frontend_url() ),
				'type'        => 'account_onboarding',
			));
			return blu_success( array( 'url' => $link->url ) );
		} catch ( \Exception $e ) {
			return blu_error( $e->getMessage(), 500 );
		}
	}

	/**
	 * POST /store/stripe/disconnect
	 */
	public static function disconnect( $request ) {
		$mt = self::merchant_table();
		$m  = Blu_DB::get_row(
			"SELECT stripe_account_id FROM {$mt} WHERE id = %s",
			array( self::merchant_id() )
		);

		if ( $m && $m->stripe_account_id ) {
			$stripe = self::get_stripe();
			if ( $stripe ) {
				$client_id = defined( 'BLU_STRIPE_CLIENT_ID' ) ? BLU_STRIPE_CLIENT_ID : get_option( 'blu_stripe_client_id', '' );
				try {
					$stripe->oauth->deauthorize( array(
						'client_id'      => $client_id,
						'stripe_user_id' => $m->stripe_account_id,
					));
				} catch ( \Exception $e ) { /* continue */ }
			}
		}

		Blu_DB::query(
			"UPDATE {$mt} SET stripe_account_id = NULL, stripe_onboarding_complete = 0, stripe_connected_at = NULL, updated_at = NOW() WHERE id = %s",
			array( self::merchant_id() )
		);

		return blu_success( array( 'success' => true, 'message' => 'Stripe account disconnected' ) );
	}

	/* ══════════════════════════════════════════════════
	 *  SYNC MANAGEMENT
	 * ══════════════════════════════════════════════════ */

	/**
	 * GET /store/stripe/sync/status
	 */
	public static function sync_status( $request ) {
		$mid = self::merchant_id();
		$mt  = self::merchant_table();
		$pt  = blu_table('products');

		$m = Blu_DB::get_row(
			"SELECT stripe_account_id, stripe_onboarding_complete, stripe_product_sync_enabled, stripe_webhook_secret FROM {$mt} WHERE id = %s",
			array( $mid )
		);
		if ( ! $m ) return blu_error( 'Merchant not found', 404 );

		$stats = Blu_DB::get_row(
			"SELECT
				SUM(CASE WHEN stripe_sync_status = 'synced'  THEN 1 ELSE 0 END) AS synced_count,
				SUM(CASE WHEN stripe_sync_status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
				SUM(CASE WHEN stripe_sync_status = 'error'   THEN 1 ELSE 0 END) AS error_count,
				SUM(CASE WHEN stripe_sync_enabled = 0        THEN 1 ELSE 0 END) AS disabled_count,
				COUNT(*) AS total_count
			 FROM {$pt} WHERE merchant_id = %s",
			array( $mid )
		);

		return blu_success( array(
			'stripe_connected'           => ! empty( $m->stripe_account_id ),
			'stripe_onboarding_complete' => (bool) $m->stripe_onboarding_complete,
			'sync_enabled'               => (bool) $m->stripe_product_sync_enabled,
			'webhook_configured'         => ! empty( $m->stripe_webhook_secret ),
			'stats' => array(
				'synced'   => (int) ( $stats->synced_count ?? 0 ),
				'pending'  => (int) ( $stats->pending_count ?? 0 ),
				'errors'   => (int) ( $stats->error_count ?? 0 ),
				'disabled' => (int) ( $stats->disabled_count ?? 0 ),
				'total'    => (int) ( $stats->total_count ?? 0 ),
			),
		));
	}

	public static function sync_enable( $request ) {
		$mid = self::merchant_id();
		$mt  = self::merchant_table();
		$m   = Blu_DB::get_row( "SELECT stripe_account_id FROM {$mt} WHERE id = %s", array( $mid ) );
		if ( ! $m || ! $m->stripe_account_id ) return blu_error( 'Stripe account not connected', 400 );

		Blu_DB::query( "UPDATE {$mt} SET stripe_product_sync_enabled = 1, updated_at = NOW() WHERE id = %s", array( $mid ) );
		return blu_success( array( 'success' => true, 'sync_enabled' => true ) );
	}

	public static function sync_disable( $request ) {
		$mt = self::merchant_table();
		Blu_DB::query( "UPDATE {$mt} SET stripe_product_sync_enabled = 0, updated_at = NOW() WHERE id = %s", array( self::merchant_id() ) );
		return blu_success( array( 'success' => true, 'sync_enabled' => false ) );
	}

	public static function sync_webhook_secret( $request ) {
		$body   = $request->get_json_params();
		$secret = $body['webhook_secret'] ?? '';
		if ( empty( $secret ) ) return blu_error( 'webhook_secret is required', 400 );

		$mt = self::merchant_table();
		Blu_DB::query( "UPDATE {$mt} SET stripe_webhook_secret = %s, updated_at = NOW() WHERE id = %s", array( $secret, self::merchant_id() ) );
		return blu_success( array( 'success' => true, 'message' => 'Webhook secret saved' ) );
	}

	/* ── Per-product sync toggle ── */

	public static function sync_product_enable( $request ) {
		$pt = blu_table('products');
		Blu_DB::query(
			"UPDATE {$pt} SET stripe_sync_enabled = 1, stripe_sync_status = 'pending', updated_at = NOW() WHERE id = %s AND merchant_id = %s",
			array( $request['id'], self::merchant_id() )
		);
		return blu_success( array( 'success' => true, 'message' => 'Sync enabled for product' ) );
	}

	public static function sync_product_disable( $request ) {
		$pt = blu_table('products');
		Blu_DB::query(
			"UPDATE {$pt} SET stripe_sync_enabled = 0, stripe_sync_status = 'disabled', updated_at = NOW() WHERE id = %s AND merchant_id = %s",
			array( $request['id'], self::merchant_id() )
		);
		return blu_success( array( 'success' => true, 'message' => 'Sync disabled for product' ) );
	}

	/* ── Single product sync ── */

	public static function sync_product( $request ) {
		$mid = self::merchant_id();
		$id  = $request['id'];
		$mt  = self::merchant_table();
		$pt  = blu_table('products');
		$et  = blu_table('stripe_sync_events');

		$m = Blu_DB::get_row( "SELECT stripe_account_id, stripe_product_sync_enabled FROM {$mt} WHERE id = %s", array( $mid ) );
		if ( ! $m || ! $m->stripe_account_id ) return blu_error( 'Stripe not connected', 400 );

		$product = Blu_DB::get_row( "SELECT * FROM {$pt} WHERE id = %s AND merchant_id = %s", array( $id, $mid ) );
		if ( ! $product ) return blu_error( 'Product not found', 404 );
		if ( ! $product->stripe_sync_enabled ) return blu_error( 'Sync disabled for this product', 400 );

		$stripe = self::get_stripe();
		if ( ! $stripe ) return blu_error( 'Stripe library not configured', 500 );

		try {
			$result = self::push_product_to_stripe( $stripe, $m->stripe_account_id, $product );

			Blu_DB::query(
				"UPDATE {$pt} SET stripe_product_id = %s, stripe_price_id = %s, stripe_sync_status = 'synced', stripe_last_synced_at = NOW(), updated_at = NOW() WHERE id = %s",
				array( $result['product_id'], $result['price_id'], $id )
			);

			Blu_DB::query(
				"INSERT INTO {$et} (id, merchant_id, product_id, event_type, direction, status, payload) VALUES (%s, %s, %s, %s, 'blu_to_stripe', 'success', %s)",
				array( blu_uuid(), $mid, $id, $product->stripe_product_id ? 'product.updated' : 'product.created', wp_json_encode( $result ) )
			);

			return blu_success( array( 'success' => true, 'stripe_product_id' => $result['product_id'], 'stripe_price_id' => $result['price_id'] ) );

		} catch ( \Exception $e ) {
			Blu_DB::query( "UPDATE {$pt} SET stripe_sync_status = 'error', updated_at = NOW() WHERE id = %s", array( $id ) );
			Blu_DB::query(
				"INSERT INTO {$et} (id, merchant_id, product_id, event_type, direction, status, error_message) VALUES (%s, %s, %s, 'sync_attempt', 'blu_to_stripe', 'failed', %s)",
				array( blu_uuid(), $mid, $id, $e->getMessage() )
			);
			return blu_error( $e->getMessage(), 500 );
		}
	}

	/* ── Sync all products ── */

	public static function sync_all( $request ) {
		$mid = self::merchant_id();
		$mt  = self::merchant_table();
		$pt  = blu_table('products');

		$m = Blu_DB::get_row( "SELECT stripe_account_id, stripe_product_sync_enabled FROM {$mt} WHERE id = %s", array( $mid ) );
		if ( ! $m || ! $m->stripe_account_id ) return blu_error( 'Stripe not connected', 400 );
		if ( ! $m->stripe_product_sync_enabled ) return blu_error( 'Stripe sync is disabled', 400 );

		$stripe = self::get_stripe();
		if ( ! $stripe ) return blu_error( 'Stripe library not configured', 500 );

		$products = Blu_DB::get_results(
			"SELECT * FROM {$pt} WHERE merchant_id = %s AND stripe_sync_enabled = 1 AND status = 'active' ORDER BY created_at ASC",
			array( $mid )
		);

		$results = array( 'synced' => 0, 'failed' => 0, 'errors' => array() );

		foreach ( $products as $product ) {
			try {
				$result = self::push_product_to_stripe( $stripe, $m->stripe_account_id, $product );
				Blu_DB::query(
					"UPDATE {$pt} SET stripe_product_id = %s, stripe_price_id = %s, stripe_sync_status = 'synced', stripe_last_synced_at = NOW() WHERE id = %s",
					array( $result['product_id'], $result['price_id'], $product->id )
				);
				$results['synced']++;
			} catch ( \Exception $e ) {
				$results['failed']++;
				$results['errors'][] = array( 'product_id' => $product->id, 'name' => $product->name, 'error' => $e->getMessage() );
				Blu_DB::query( "UPDATE {$pt} SET stripe_sync_status = 'error' WHERE id = %s", array( $product->id ) );
			}
		}

		return blu_success( array_merge( array( 'success' => true, 'total' => count( $products ) ), $results ) );
	}

	/* ── Import from Stripe ── */

	public static function sync_import( $request ) {
		$mid = self::merchant_id();
		$mt  = self::merchant_table();
		$pt  = blu_table('products');

		$m = Blu_DB::get_row( "SELECT stripe_account_id FROM {$mt} WHERE id = %s", array( $mid ) );
		if ( ! $m || ! $m->stripe_account_id ) return blu_error( 'Stripe not connected', 400 );

		$stripe = self::get_stripe();
		if ( ! $stripe ) return blu_error( 'Stripe library not configured', 500 );

		try {
			$stripe_products = $stripe->products->all( array( 'active' => true, 'limit' => 100 ), array( 'stripe_account' => $m->stripe_account_id ) );
		} catch ( \Exception $e ) {
			return blu_error( $e->getMessage(), 500 );
		}

		$results = array( 'imported' => 0, 'updated' => 0, 'skipped' => 0, 'errors' => array() );

		foreach ( $stripe_products->data as $sp ) {
			try {
				if ( ! empty( $sp->metadata['source'] ) && in_array( $sp->metadata['source'] ?? '', array( 'blu', 'oxide' ), true ) ) {
					$results['skipped']++;
					continue;
				}

				$price_amount = 0;
				$price_id     = null;
				if ( $sp->default_price ) {
					$pid = is_string( $sp->default_price ) ? $sp->default_price : $sp->default_price->id;
					try {
						$price_obj    = $stripe->prices->retrieve( $pid, array(), array( 'stripe_account' => $m->stripe_account_id ) );
						$price_amount = ( $price_obj->unit_amount ?? 0 ) / 100;
						$price_id     = $price_obj->id;
					} catch ( \Exception $e ) { /* ignore */ }
				}

				$status = $sp->active ? 'active' : 'archived';
				$images = array();
				foreach ( $sp->images ?? array() as $url ) {
					$images[] = array( 'url' => $url );
				}

				$existing = Blu_DB::get_row(
					"SELECT id FROM {$pt} WHERE stripe_product_id = %s AND merchant_id = %s",
					array( $sp->id, $mid )
				);

				if ( $existing ) {
					Blu_DB::query(
						"UPDATE {$pt} SET name = %s, description = %s, status = %s, price = %s, stripe_price_id = %s, stripe_sync_status = 'synced', stripe_last_synced_at = NOW(), updated_at = NOW() WHERE stripe_product_id = %s AND merchant_id = %s",
						array( $sp->name, $sp->description ?? '', $status, $price_amount, $price_id, $sp->id, $mid )
					);
					$results['updated']++;
				} else {
					Blu_DB::query(
						"INSERT INTO {$pt} (id, merchant_id, name, description, price, status, stripe_product_id, stripe_price_id, stripe_sync_status, stripe_last_synced_at, images) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'synced', NOW(), %s)",
						array( blu_uuid(), $mid, $sp->name, $sp->description ?? '', $price_amount, $status, $sp->id, $price_id, wp_json_encode( $images ) )
					);
					$results['imported']++;
				}
			} catch ( \Exception $e ) {
				$results['errors'][] = array( 'stripe_product_id' => $sp->id, 'name' => $sp->name, 'error' => $e->getMessage() );
			}
		}

		return blu_success( array_merge( array( 'success' => true, 'total' => count( $stripe_products->data ) ), $results ) );
	}

	/* ── Sync event log ── */

	public static function sync_events( $request ) {
		$mid   = self::merchant_id();
		$limit = (int) ( $request->get_param('limit') ?: 50 );
		$pid   = $request->get_param('product_id');
		$et    = blu_table('stripe_sync_events');
		$pt    = blu_table('products');

		$sql    = "SELECT e.*, p.name AS product_name, p.sku AS product_sku FROM {$et} e LEFT JOIN {$pt} p ON e.product_id = p.id WHERE e.merchant_id = %s";
		$params = array( $mid );

		if ( $pid ) {
			$sql     .= ' AND e.product_id = %s';
			$params[] = $pid;
		}

		$sql     .= ' ORDER BY e.created_at DESC LIMIT %d';
		$params[] = $limit;

		$events = Blu_DB::get_results( $sql, $params );
		foreach ( $events as &$e ) {
			$e->payload = json_decode( $e->payload ?? 'null' );
		}

		return blu_success( array( 'events' => $events ) );
	}

	/* ─────────────────────── internal: push to Stripe ─────────────────────── */

	private static function push_product_to_stripe( $stripe, $account_id, $product ) {
		$opts = array( 'stripe_account' => $account_id );

		$images = json_decode( $product->images ?? '[]', true ) ?: array();
		$image_urls = array_column( $images, 'url' );

		$product_data = array(
			'name'        => $product->name,
			'description' => $product->description ?? '',
			'images'      => array_slice( $image_urls, 0, 8 ),
			'metadata'    => array( 'source' => 'blu', 'blu_product_id' => $product->id ),
		);

		$price_data = array(
			'currency'    => 'usd',
			'unit_amount' => (int) round( (float) $product->price * 100 ),
		);

		if ( $product->stripe_product_id ) {
			// Update existing
			$stripe->products->update( $product->stripe_product_id, $product_data, $opts );

			// Create new price and set as default
			$price_data['product'] = $product->stripe_product_id;
			$new_price = $stripe->prices->create( $price_data, $opts );
			$stripe->products->update( $product->stripe_product_id, array( 'default_price' => $new_price->id ), $opts );

			// Archive old price
			if ( $product->stripe_price_id ) {
				try {
					$stripe->prices->update( $product->stripe_price_id, array( 'active' => false ), $opts );
				} catch ( \Exception $e ) { /* ignore */ }
			}

			return array( 'product_id' => $product->stripe_product_id, 'price_id' => $new_price->id );

		} else {
			// Create new
			$sp = $stripe->products->create( $product_data, $opts );
			$price_data['product'] = $sp->id;
			$new_price = $stripe->prices->create( $price_data, $opts );
			$stripe->products->update( $sp->id, array( 'default_price' => $new_price->id ), $opts );

			return array( 'product_id' => $sp->id, 'price_id' => $new_price->id );
		}
	}
}
