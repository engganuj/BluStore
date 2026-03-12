<?php
/**
 * Blu Store UCP Controller
 *
 * Universal Commerce Protocol for agentic commerce.
 * Enables AI agents (Gemini, ChatGPT, Claude, etc.) to discover and
 * transact with this store using standardised APIs.
 *
 * Converted from: api/src/routes/ucp.js
 *
 * All UCP endpoints are PUBLIC (no WP auth required) — agents are external.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_UCP_Controller {

	const UCP_VERSION = '0.1.0';

	/* ───── Registration ───── */

	public static function register( string $ns ): void {
		$pub = '__return_true';

		// Discovery profile
		register_rest_route( $ns, '/ucp/profile', [
			'methods' => 'GET', 'callback' => [ __CLASS__, 'profile' ], 'permission_callback' => $pub,
		] );

		// Checkout sessions
		register_rest_route( $ns, '/ucp/checkout/sessions', [
			'methods' => 'POST', 'callback' => [ __CLASS__, 'create_session' ], 'permission_callback' => $pub,
		] );
		register_rest_route( $ns, '/ucp/checkout/sessions/(?P<id>chk_[A-Za-z0-9_-]+)', [
			[ 'methods' => 'GET',   'callback' => [ __CLASS__, 'get_session' ],    'permission_callback' => $pub ],
			[ 'methods' => 'PATCH', 'callback' => [ __CLASS__, 'update_session' ], 'permission_callback' => $pub ],
		] );
		register_rest_route( $ns, '/ucp/checkout/sessions/(?P<id>chk_[A-Za-z0-9_-]+)/complete', [
			'methods' => 'POST', 'callback' => [ __CLASS__, 'complete_session' ], 'permission_callback' => $pub,
		] );
		register_rest_route( $ns, '/ucp/checkout/sessions/(?P<id>chk_[A-Za-z0-9_-]+)/discount', [
			[ 'methods' => 'POST',   'callback' => [ __CLASS__, 'apply_discount' ],  'permission_callback' => $pub ],
			[ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'remove_discount' ], 'permission_callback' => $pub ],
		] );

		// Orders
		register_rest_route( $ns, '/ucp/orders/(?P<id>[a-f0-9-]+)', [
			'methods' => 'GET', 'callback' => [ __CLASS__, 'get_order' ], 'permission_callback' => $pub,
		] );

		// Webhook subscriptions
		register_rest_route( $ns, '/ucp/webhooks/subscribe', [
			'methods' => 'POST', 'callback' => [ __CLASS__, 'webhook_subscribe' ], 'permission_callback' => $pub,
		] );

		// Catalog search (extension)
		register_rest_route( $ns, '/ucp/catalog/search', [
			'methods' => 'GET', 'callback' => [ __CLASS__, 'catalog_search' ], 'permission_callback' => $pub,
		] );
		register_rest_route( $ns, '/ucp/catalog/items/(?P<sku>[A-Za-z0-9_-]+)', [
			'methods' => 'GET', 'callback' => [ __CLASS__, 'catalog_item' ], 'permission_callback' => $pub,
		] );
	}

	/* ===================================================================
	 * Helpers
	 * =================================================================== */

	private static function mid(): string {
		return blu_merchant_id();
	}

	private static function base_url(): string {
		return rest_url( 'blu/v1' );
	}

	private static function merchant() {
		return Blu_DB::get_row(
			'SELECT * FROM ' . blu_table( 'merchants' ) . ' WHERE id = %s',
			[ self::mid() ]
		);
	}

	private static function shipping_options(): array {
		return Blu_DB::get_results(
			'SELECT * FROM ' . blu_table( 'shipping_options' )
			. " WHERE merchant_id = %s AND is_active = 1 ORDER BY sort_order ASC",
			[ self::mid() ]
		) ?: [];
	}

	/**
	 * Look up product by SKU — checks main SKU then variant SKUs.
	 */
	private static function product_by_sku( string $sku ): array {
		$tp  = blu_table( 'products' );
		$mid = self::mid();

		// Main SKU
		$p = Blu_DB::get_row( "SELECT * FROM {$tp} WHERE merchant_id = %s AND sku = %s", [ $mid, $sku ] );
		if ( $p ) return [ 'product' => $p, 'variant' => null ];

		// Variant SKU
		$tv = blu_table( 'product_variants' );
		$row = Blu_DB::get_row(
			"SELECT p.*, pv.id AS variant_id, pv.sku AS variant_sku, pv.price AS variant_price,
			        pv.inventory_qty AS variant_inventory, pv.option_values_display
			 FROM {$tv} pv JOIN {$tp} p ON pv.product_id = p.id
			 WHERE p.merchant_id = %s AND pv.sku = %s AND pv.is_active = 1",
			[ $mid, $sku ]
		);
		if ( $row ) {
			return [
				'product' => $row,
				'variant' => (object) [
					'id'            => $row->variant_id,
					'sku'           => $row->variant_sku,
					'price'         => $row->variant_price,
					'inventory_qty' => $row->variant_inventory,
					'display'       => $row->option_values_display,
				],
			];
		}

		return [ 'product' => null, 'variant' => null ];
	}

	private static function product_by_id( string $id ) {
		return Blu_DB::get_row(
			'SELECT * FROM ' . blu_table( 'products' ) . ' WHERE merchant_id = %s AND id = %s',
			[ self::mid(), $id ]
		);
	}

	/** Simple 8 % placeholder tax. */
	private static function calc_tax( int $subtotal_cents ): int {
		return (int) round( $subtotal_cents * 0.08 );
	}

	/**
	 * Build a UCP line-item from a product + optional variant.
	 */
	private static function build_line_item( $product, int $qty, string $li_id, $variant = null ): array {
		$price = $variant->price ?? $product->price;
		$sku   = $variant->sku   ?? $product->sku;
		$title = ( $variant && $variant->display )
			? $product->name . ' - ' . $variant->display
			: $product->name;

		$images = json_decode( $product->images ?? '[]', true );

		return [
			'id'       => $li_id,
			'item'     => [
				'id'          => $sku,
				'title'       => $title,
				'description' => $product->short_description ?: mb_substr( $product->description ?? '', 0, 200 ),
				'image_url'   => $images[0]['url'] ?? null,
				'price'       => (int) round( (float) $price * 100 ),
				'url'         => $product->permalink ?? null,
			],
			'quantity'   => $qty,
			'variant_id' => $variant->id ?? null,
		];
	}

	/**
	 * Build fulfillment options block.
	 */
	private static function build_fulfillment( array $ship_opts, array $line_items, int $subtotal_cents ) {
		if ( empty( $ship_opts ) ) return null;

		$li_ids = array_column( $line_items, 'id' );

		$options = [];
		foreach ( $ship_opts as $o ) {
			$free = $o->free_shipping_threshold_cents && $subtotal_cents >= (int) $o->free_shipping_threshold_cents;
			$amt  = $free ? 0 : (int) ( $o->price_cents ?? 0 );
			$title = $o->name;
			if ( $o->min_days && $o->max_days ) $title .= " ({$o->min_days}-{$o->max_days} business days)";

			$options[] = [
				'id'          => $o->id,
				'title'       => $title,
				'description' => $o->description ?? null,
				'totals'      => [ [ 'type' => 'total', 'amount' => $amt ] ],
			];
		}

		return [
			'methods' => [ [
				'id'            => 'method_shipping',
				'type'          => 'shipping',
				'line_item_ids' => $li_ids,
				'destinations'  => [],
				'groups'        => [ [
					'id'            => 'group_1',
					'line_item_ids' => $li_ids,
					'options'       => $options,
				] ],
			] ],
		];
	}

	/* ===================================================================
	 * DISCOVERY — /ucp/profile
	 * =================================================================== */

	public static function profile(): WP_REST_Response {
		$merchant = self::merchant();
		if ( ! $merchant ) return blu_error( 'Merchant not found', 404 );

		$base = self::base_url();

		return blu_success( [
			'ucp'      => [ 'version' => self::UCP_VERSION ],
			'business' => [
				'id'          => $merchant->id,
				'name'        => $merchant->name,
				'logo_url'    => $merchant->logo_url ?? null,
				'support_url' => $merchant->website_url ? rtrim( $merchant->website_url, '/' ) . '/support' : null,
				'terms_url'   => $merchant->terms_url ?? null,
				'privacy_url' => $merchant->privacy_url ?? null,
			],
			'capabilities' => [
				'checkout' => [
					'versions'   => [ self::UCP_VERSION ],
					'endpoints'  => [ 'rest' => "{$base}/ucp/checkout" ],
					'extensions' => [ 'fulfillment', 'discounts' ],
				],
				'order' => [
					'versions'  => [ self::UCP_VERSION ],
					'endpoints' => [ 'rest' => "{$base}/ucp/orders" ],
					'webhooks'  => [
						'events' => [
							'order.created', 'order.paid', 'order.shipped',
							'order.delivered', 'order.cancelled', 'order.refunded',
						],
					],
				],
			],
			'payment' => [
				'handlers'   => $merchant->stripe_account_id ? [ [
					'id' => 'stripe', 'type' => 'platform_tokenizer',
					'currencies' => [ 'USD' ], 'methods' => [ 'card', 'google_pay', 'apple_pay' ],
				] ] : [],
				'currencies' => [ $merchant->currency ?: 'USD' ],
			],
		] );
	}

	/* ===================================================================
	 * CREATE CHECKOUT SESSION
	 * =================================================================== */

	public static function create_session( WP_REST_Request $req ): WP_REST_Response {
		$merchant = self::merchant();
		if ( ! $merchant ) return blu_error( 'Merchant not found', 404 );

		$body  = $req->get_json_params();
		$items = $body['line_items'] ?? [];
		$buyer = $body['buyer'] ?? [];

		$processed     = [];
		$subtotal_c    = 0;

		foreach ( $items as $item ) {
			$sku = $item['item']['id'] ?? null;
			if ( ! $sku ) return blu_error( 'Missing item id', 400 );

			$res = self::product_by_sku( $sku );
			$product = $res['product'];
			$variant = $res['variant'];

			if ( ! $product ) {
				$product = self::product_by_id( $sku );
			}
			if ( ! $product ) {
				return blu_error( "Product not found: {$sku}", 400 );
			}

			$inv = $variant->inventory_qty ?? $product->inventory_qty;
			$qty = (int) ( $item['quantity'] ?? 1 );
			if ( $product->track_inventory && $inv < $qty ) {
				return blu_error( "Insufficient inventory for {$product->name}", 400 );
			}

			$li_id = blu_prefixed_id( 'li' );
			$li    = self::build_line_item( $product, $qty, $li_id, $variant );
			$processed[] = $li;
			$subtotal_c += $li['item']['price'] * $li['quantity'];
		}

		$ship_opts = self::shipping_options();
		$tax_c     = self::calc_tax( $subtotal_c );

		$ship_c = 0;
		if ( ! empty( $ship_opts ) ) {
			$def = null;
			foreach ( $ship_opts as $o ) { if ( $o->is_default ) { $def = $o; break; } }
			if ( ! $def ) $def = $ship_opts[0];
			$free   = $def->free_shipping_threshold_cents && $subtotal_c >= (int) $def->free_shipping_threshold_cents;
			$ship_c = $free ? 0 : (int) ( $def->price_cents ?? 0 );
		}

		$total_c   = $subtotal_c + $tax_c + $ship_c;
		$session_id = blu_prefixed_id( 'chk' );
		$expires    = gmdate( 'Y-m-d H:i:s', time() + 1800 );
		$status     = count( $processed ) > 0 ? 'ready_for_complete' : 'pending';

		$ts = blu_table( 'ucp_sessions' );
		Blu_DB::insert( $ts, [
			'id'                   => $session_id,
			'merchant_id'          => self::mid(),
			'status'               => $status,
			'currency'             => $merchant->currency ?: 'USD',
			'buyer_email'          => $buyer['email'] ?? null,
			'buyer_first_name'     => $buyer['first_name'] ?? null,
			'buyer_last_name'      => $buyer['last_name'] ?? null,
			'buyer_phone'          => $buyer['phone'] ?? null,
			'line_items'           => wp_json_encode( $processed ),
			'subtotal_cents'       => $subtotal_c,
			'tax_cents'            => $tax_c,
			'shipping_cents'       => $ship_c,
			'total_cents'          => $total_c,
			'fulfillment'          => isset( $body['fulfillment'] ) ? wp_json_encode( $body['fulfillment'] ) : null,
			'platform_id'          => $body['platform_id'] ?? null,
			'platform_session_id'  => $body['platform_session_id'] ?? null,
			'expires_at'           => $expires,
		] );

		$base = self::base_url();
		$fulfillment = self::build_fulfillment( $ship_opts, $processed, $subtotal_c );

		return blu_success( [
			'ucp'         => [ 'version' => self::UCP_VERSION ],
			'id'          => $session_id,
			'status'      => $status,
			'currency'    => $merchant->currency ?: 'USD',
			'buyer'       => [
				'email'      => $buyer['email'] ?? null,
				'first_name' => $buyer['first_name'] ?? null,
				'last_name'  => $buyer['last_name'] ?? null,
				'phone'      => $buyer['phone'] ?? null,
			],
			'line_items'  => $processed,
			'totals'      => [
				[ 'type' => 'subtotal', 'amount' => $subtotal_c ],
				[ 'type' => 'tax',      'amount' => $tax_c ],
				[ 'type' => 'shipping', 'amount' => $ship_c ],
				[ 'type' => 'total',    'amount' => $total_c ],
			],
			'fulfillment' => $fulfillment,
			'payment'     => [
				'status'   => 'pending',
				'handlers' => $merchant->stripe_account_id ? [ [ 'id' => 'stripe', 'type' => 'platform_tokenizer' ] ] : [],
			],
			'links' => [
				'self'     => "{$base}/ucp/checkout/sessions/{$session_id}",
				'complete' => "{$base}/ucp/checkout/sessions/{$session_id}/complete",
			],
			'expires_at' => $expires,
		], 201 );
	}

	/* ===================================================================
	 * GET CHECKOUT SESSION
	 * =================================================================== */

	public static function get_session( WP_REST_Request $req ): WP_REST_Response {
		$id  = $req->get_param( 'id' );
		$ts  = blu_table( 'ucp_sessions' );
		$mid = self::mid();

		$s = Blu_DB::get_row( "SELECT * FROM {$ts} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
		if ( ! $s ) return blu_error( 'Session not found', 404 );

		// Expire if needed
		if ( $s->status === 'pending' && strtotime( $s->expires_at ) < time() ) {
			Blu_DB::update( $ts, [ 'status' => 'expired' ], [ 'id' => $id ] );
			$s->status = 'expired';
		}

		$merchant   = self::merchant();
		$ship_opts  = self::shipping_options();
		$line_items = json_decode( $s->line_items ?: '[]', true );
		$fulfill    = $s->fulfillment
			? json_decode( $s->fulfillment, true )
			: self::build_fulfillment( $ship_opts, $line_items, (int) $s->subtotal_cents );

		$base = self::base_url();

		$resp = [
			'ucp'         => [ 'version' => self::UCP_VERSION ],
			'id'          => $s->id,
			'status'      => $s->status,
			'currency'    => $s->currency,
			'buyer'       => [
				'email'      => $s->buyer_email,
				'first_name' => $s->buyer_first_name,
				'last_name'  => $s->buyer_last_name,
				'phone'      => $s->buyer_phone,
			],
			'line_items'  => $line_items,
			'totals'      => [
				[ 'type' => 'subtotal', 'amount' => (int) $s->subtotal_cents ],
				[ 'type' => 'tax',      'amount' => (int) $s->tax_cents ],
				[ 'type' => 'shipping', 'amount' => (int) $s->shipping_cents ],
				[ 'type' => 'discount', 'amount' => (int) ( $s->discount_cents ?? 0 ) ],
				[ 'type' => 'total',    'amount' => (int) $s->total_cents ],
			],
			'fulfillment' => $fulfill,
			'payment'     => [
				'status'   => $s->payment_status ?? 'pending',
				'handlers' => ( $merchant && $merchant->stripe_account_id ) ? [ [ 'id' => 'stripe', 'type' => 'platform_tokenizer' ] ] : [],
			],
			'links' => [
				'self'     => "{$base}/ucp/checkout/sessions/{$s->id}",
				'complete' => "{$base}/ucp/checkout/sessions/{$s->id}/complete",
			],
			'expires_at' => $s->expires_at,
		];

		if ( $s->order_id ) {
			$resp['links']['order'] = "{$base}/ucp/orders/{$s->order_id}";
		}

		return blu_success( $resp );
	}

	/* ===================================================================
	 * UPDATE (PATCH) CHECKOUT SESSION
	 * =================================================================== */

	public static function update_session( WP_REST_Request $req ): WP_REST_Response {
		$id  = $req->get_param( 'id' );
		$ts  = blu_table( 'ucp_sessions' );
		$mid = self::mid();

		$s = Blu_DB::get_row( "SELECT * FROM {$ts} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
		if ( ! $s ) return blu_error( 'Session not found', 404 );
		if ( $s->status === 'completed' ) return blu_error( 'Cannot modify completed session', 400 );
		if ( $s->status === 'expired' )   return blu_error( 'Session has expired', 400 );

		$body  = $req->get_json_params();
		$buyer = $body['buyer'] ?? null;
		$items = $body['line_items'] ?? null;
		$fulfillment = $body['fulfillment'] ?? null;

		$line_items  = json_decode( $s->line_items ?: '[]', true );
		$subtotal_c  = (int) $s->subtotal_cents;

		// Re-process line items if provided
		if ( is_array( $items ) ) {
			$line_items = [];
			$subtotal_c = 0;

			foreach ( $items as $item ) {
				$sku = $item['item']['id'] ?? null;
				if ( ! $sku ) return blu_error( 'Missing item id', 400 );

				$res     = self::product_by_sku( $sku );
				$product = $res['product'];
				$variant = $res['variant'];
				if ( ! $product ) $product = self::product_by_id( $sku );
				if ( ! $product ) return blu_error( "Product not found: {$sku}", 400 );

				$li_id = $item['id'] ?? blu_prefixed_id( 'li' );
				$li    = self::build_line_item( $product, (int) ( $item['quantity'] ?? 1 ), $li_id, $variant );
				$line_items[] = $li;
				$subtotal_c  += $li['item']['price'] * $li['quantity'];
			}
		}

		// Shipping recalculation
		$ship_c = (int) $s->shipping_cents;
		if ( $fulfillment && ! empty( $fulfillment['methods'][0]['groups'][0]['selected_option_id'] ) ) {
			$sel_id    = $fulfillment['methods'][0]['groups'][0]['selected_option_id'];
			$ship_opts = self::shipping_options();
			foreach ( $ship_opts as $o ) {
				if ( $o->id === $sel_id ) {
					$free   = $o->free_shipping_threshold_cents && $subtotal_c >= (int) $o->free_shipping_threshold_cents;
					$ship_c = $free ? 0 : (int) ( $o->price_cents ?? 0 );
					break;
				}
			}
		}

		$tax_c   = self::calc_tax( $subtotal_c );
		$total_c = $subtotal_c + $tax_c + $ship_c - (int) ( $s->discount_cents ?? 0 );
		$status  = count( $line_items ) > 0 ? 'ready_for_complete' : 'pending';

		$update = [
			'line_items'    => wp_json_encode( $line_items ),
			'subtotal_cents'=> $subtotal_c,
			'tax_cents'     => $tax_c,
			'shipping_cents'=> $ship_c,
			'total_cents'   => $total_c,
			'status'        => $status,
		];
		if ( $buyer ) {
			if ( isset( $buyer['email'] ) )      $update['buyer_email']      = $buyer['email'];
			if ( isset( $buyer['first_name'] ) )  $update['buyer_first_name'] = $buyer['first_name'];
			if ( isset( $buyer['last_name'] ) )   $update['buyer_last_name']  = $buyer['last_name'];
			if ( isset( $buyer['phone'] ) )       $update['buyer_phone']      = $buyer['phone'];
		}
		if ( $fulfillment ) {
			$update['fulfillment'] = wp_json_encode( $fulfillment );
		}

		Blu_DB::update( $ts, $update, [ 'id' => $id ] );

		// Return updated session via GET
		return self::get_session( $req );
	}

	/* ===================================================================
	 * APPLY DISCOUNT
	 * =================================================================== */

	public static function apply_discount( WP_REST_Request $req ): WP_REST_Response {
		$id   = $req->get_param( 'id' );
		$body = $req->get_json_params();
		$code = $body['code'] ?? '';
		if ( ! $code ) return blu_error( 'Discount code is required', 400 );

		$ts  = blu_table( 'ucp_sessions' );
		$td  = blu_table( 'discounts' );
		$mid = self::mid();

		$s = Blu_DB::get_row( "SELECT * FROM {$ts} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
		if ( ! $s )                        return blu_error( 'Session not found', 404 );
		if ( $s->status === 'completed' )  return blu_error( 'Cannot modify completed session', 400 );

		$disc = Blu_DB::get_row(
			"SELECT * FROM {$td} WHERE merchant_id = %s AND LOWER(code) = LOWER(%s)",
			[ $mid, $code ]
		);
		if ( ! $disc ) return blu_success( [ 'valid' => false, 'error' => 'Invalid discount code' ] );

		// Validations
		if ( $disc->status !== 'active' )
			return blu_success( [ 'valid' => false, 'error' => 'This discount code is no longer active' ] );
		$now = time();
		if ( $disc->starts_at && strtotime( $disc->starts_at ) > $now )
			return blu_success( [ 'valid' => false, 'error' => 'This discount code is not yet active' ] );
		if ( $disc->expires_at && strtotime( $disc->expires_at ) < $now )
			return blu_success( [ 'valid' => false, 'error' => 'This discount code has expired' ] );
		if ( $disc->usage_limit && (int) $disc->usage_count >= (int) $disc->usage_limit )
			return blu_success( [ 'valid' => false, 'error' => 'This discount code has reached its usage limit' ] );

		$sub_dollars = (int) $s->subtotal_cents / 100;
		if ( $disc->minimum_order_amount && $sub_dollars < (float) $disc->minimum_order_amount ) {
			return blu_success( [
				'valid'            => false,
				'error'            => "Minimum order of {$disc->minimum_order_amount} required",
				'minimum_required' => (float) $disc->minimum_order_amount,
				'current_subtotal' => $sub_dollars,
			] );
		}

		$disc_c = 0;
		$ship_c = (int) $s->shipping_cents;

		if ( $disc->type === 'percentage' ) {
			$disc_c = (int) round( (int) $s->subtotal_cents * ( (float) $disc->value / 100 ) );
			if ( $disc->maximum_discount_amount ) {
				$max = (int) round( (float) $disc->maximum_discount_amount * 100 );
				$disc_c = min( $disc_c, $max );
			}
		} elseif ( $disc->type === 'fixed_amount' ) {
			$disc_c = (int) round( (float) $disc->value * 100 );
		} elseif ( $disc->type === 'free_shipping' ) {
			$ship_c = 0;
		}

		$total_c = (int) $s->subtotal_cents + (int) $s->tax_cents + $ship_c - $disc_c;

		Blu_DB::update( $ts, [
			'discount_code'    => $disc->code,
			'discount_cents'   => $disc_c,
			'discount_details' => wp_json_encode( [
				'id'          => $disc->id,
				'code'        => $disc->code,
				'type'        => $disc->type,
				'value'       => (float) $disc->value,
				'description' => $disc->description,
			] ),
			'shipping_cents' => $ship_c,
			'total_cents'    => $total_c,
		], [ 'id' => $id ] );

		$base = self::base_url();
		return blu_success( [
			'ucp'      => [ 'version' => self::UCP_VERSION ],
			'valid'    => true,
			'discount' => [
				'code'         => $disc->code,
				'type'         => $disc->type,
				'value'        => (float) $disc->value,
				'description'  => $disc->description,
				'amount_cents' => $disc_c,
			],
			'totals' => [
				[ 'type' => 'subtotal', 'amount' => (int) $s->subtotal_cents ],
				[ 'type' => 'tax',      'amount' => (int) $s->tax_cents ],
				[ 'type' => 'shipping', 'amount' => $ship_c ],
				[ 'type' => 'discount', 'amount' => $disc_c ],
				[ 'type' => 'total',    'amount' => $total_c ],
			],
			'links' => [ 'session' => "{$base}/ucp/checkout/sessions/{$id}" ],
		] );
	}

	/* ===================================================================
	 * REMOVE DISCOUNT
	 * =================================================================== */

	public static function remove_discount( WP_REST_Request $req ): WP_REST_Response {
		$id  = $req->get_param( 'id' );
		$ts  = blu_table( 'ucp_sessions' );
		$mid = self::mid();

		$s = Blu_DB::get_row( "SELECT * FROM {$ts} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
		if ( ! $s )                       return blu_error( 'Session not found', 404 );
		if ( $s->status === 'completed' ) return blu_error( 'Cannot modify completed session', 400 );

		// Recalculate shipping without discount
		$ship_opts = self::shipping_options();
		$ship_c    = 0;
		if ( ! empty( $ship_opts ) ) {
			$def = null;
			foreach ( $ship_opts as $o ) { if ( $o->is_default ) { $def = $o; break; } }
			if ( ! $def ) $def = $ship_opts[0];
			$free   = $def->free_shipping_threshold_cents && (int) $s->subtotal_cents >= (int) $def->free_shipping_threshold_cents;
			$ship_c = $free ? 0 : (int) ( $def->price_cents ?? 0 );
		}

		$total_c = (int) $s->subtotal_cents + (int) $s->tax_cents + $ship_c;

		Blu_DB::update( $ts, [
			'discount_code'    => null,
			'discount_cents'   => 0,
			'discount_details' => null,
			'shipping_cents'   => $ship_c,
			'total_cents'      => $total_c,
		], [ 'id' => $id ] );

		return blu_success( [
			'ucp'     => [ 'version' => self::UCP_VERSION ],
			'message' => 'Discount removed',
			'totals'  => [
				[ 'type' => 'subtotal', 'amount' => (int) $s->subtotal_cents ],
				[ 'type' => 'tax',      'amount' => (int) $s->tax_cents ],
				[ 'type' => 'shipping', 'amount' => $ship_c ],
				[ 'type' => 'discount', 'amount' => 0 ],
				[ 'type' => 'total',    'amount' => $total_c ],
			],
		] );
	}

	/* ===================================================================
	 * COMPLETE CHECKOUT SESSION
	 * =================================================================== */

	public static function complete_session( WP_REST_Request $req ): WP_REST_Response {
		$id  = $req->get_param( 'id' );
		$ts  = blu_table( 'ucp_sessions' );
		$to  = blu_table( 'orders' );
		$toi = blu_table( 'order_items' );
		$mid = self::mid();

		Blu_DB::begin();
		try {
			$s = Blu_DB::get_row( "SELECT * FROM {$ts} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
			if ( ! $s ) { Blu_DB::rollback(); return blu_error( 'Session not found', 404 ); }

			if ( $s->status === 'completed' ) {
				Blu_DB::rollback();
				return blu_success( [
					'ucp' => [ 'version' => self::UCP_VERSION ],
					'id'  => $s->id, 'status' => 'completed', 'order_id' => $s->order_id,
				] );
			}
			if ( $s->status !== 'ready_for_complete' ) {
				Blu_DB::rollback();
				return blu_error( 'Session not ready for completion', 400 );
			}
			if ( ! $s->buyer_email ) {
				Blu_DB::rollback();
				return blu_error( 'Buyer email is required', 400 );
			}

			$body    = $req->get_json_params();
			$pay_ref = $body['payment']['reference'] ?? $body['payment']['token'] ?? 'ucp_' . time();

			// Shipping address from fulfillment
			$fulfill = json_decode( $s->fulfillment ?? '{}', true );
			$dest    = $fulfill['methods'][0]['destinations'][0] ?? null;
			$ship_addr = $dest ? wp_json_encode( [
				'line1'       => $dest['street_address'] ?? null,
				'line2'       => $dest['street_address_2'] ?? null,
				'city'        => $dest['address_locality'] ?? null,
				'state'       => $dest['address_region'] ?? null,
				'postal_code' => $dest['postal_code'] ?? null,
				'country'     => $dest['address_country'] ?? 'US',
			] ) : null;

			// Create order
			$order_id  = blu_uuid();
			$order_num = Blu_DB::next_order_number();
			$name      = trim( ( $s->buyer_first_name ?? '' ) . ' ' . ( $s->buyer_last_name ?? '' ) ) ?: null;

			Blu_DB::insert( $to, [
				'id'                    => $order_id,
				'merchant_id'           => $mid,
				'order_number'          => $order_num,
				'status'                => 'paid',
				'customer_email'        => $s->buyer_email,
				'customer_name'         => $name,
				'shipping_address'      => $ship_addr,
				'subtotal_cents'        => $s->subtotal_cents,
				'shipping_cents'        => $s->shipping_cents,
				'tax_cents'             => $s->tax_cents,
				'total_cents'           => $s->total_cents,
				'stripe_payment_intent' => $pay_ref,
			] );

			// Create order items
			$line_items = json_decode( $s->line_items ?: '[]', true );
			foreach ( $line_items as $li ) {
				Blu_DB::insert( $toi, [
					'id'               => blu_uuid(),
					'order_id'         => $order_id,
					'product_name'     => $li['item']['title'],
					'product_sku'      => $li['item']['id'],
					'product_image'    => $li['item']['image_url'],
					'unit_price_cents' => $li['item']['price'],
					'quantity'         => $li['quantity'],
					'total_cents'      => $li['item']['price'] * $li['quantity'],
				] );
			}

			// Mark session completed
			Blu_DB::update( $ts, [
				'status'            => 'completed',
				'payment_status'    => 'captured',
				'payment_reference' => $pay_ref,
				'order_id'          => $order_id,
				'completed_at'      => current_time( 'mysql', true ),
			], [ 'id' => $id ] );

			Blu_DB::commit();

			$base = self::base_url();
			return blu_success( [
				'ucp'    => [ 'version' => self::UCP_VERSION ],
				'id'     => $s->id,
				'status' => 'completed',
				'order'  => [
					'id'       => $order_id,
					'status'   => 'paid',
					'total'    => (int) $s->total_cents,
					'currency' => $s->currency,
					'links'    => [ 'self' => "{$base}/ucp/orders/{$order_id}" ],
				],
			] );

		} catch ( \Exception $e ) {
			Blu_DB::rollback();
			return blu_error( 'Failed to complete checkout', 500 );
		}
	}

	/* ===================================================================
	 * GET ORDER (UCP format)
	 * =================================================================== */

	public static function get_order( WP_REST_Request $req ): WP_REST_Response {
		$id  = $req->get_param( 'id' );
		$to  = blu_table( 'orders' );
		$toi = blu_table( 'order_items' );
		$mid = self::mid();

		$order = Blu_DB::get_row( "SELECT * FROM {$to} WHERE id = %s AND merchant_id = %s", [ $id, $mid ] );
		if ( ! $order ) return blu_error( 'Order not found', 404 );

		$items = Blu_DB::get_results( "SELECT * FROM {$toi} WHERE order_id = %s", [ $id ] );

		$line_items = [];
		foreach ( $items as $oi ) {
			$line_items[] = [
				'id'   => $oi->id,
				'item' => [
					'id'        => $oi->product_sku,
					'title'     => $oi->product_name,
					'image_url' => $oi->product_image,
					'price'     => (int) $oi->unit_price_cents,
				],
				'quantity' => (int) $oi->quantity,
			];
		}

		$status_map = [
			'pending'    => 'pending',
			'paid'       => 'confirmed',
			'processing' => 'processing',
			'shipped'    => 'shipped',
			'fulfilled'  => 'delivered',
			'cancelled'  => 'cancelled',
			'refunded'   => 'refunded',
		];

		$ship_addr = json_decode( $order->shipping_address ?? '{}', true );
		$base = self::base_url();

		return blu_success( [
			'ucp'         => [ 'version' => self::UCP_VERSION ],
			'id'          => $order->id,
			'status'      => $status_map[ $order->status ] ?? $order->status,
			'currency'    => 'USD',
			'line_items'  => $line_items,
			'totals'      => [
				[ 'type' => 'subtotal', 'amount' => (int) $order->subtotal_cents ],
				[ 'type' => 'shipping', 'amount' => (int) $order->shipping_cents ],
				[ 'type' => 'tax',      'amount' => (int) $order->tax_cents ],
				[ 'type' => 'total',    'amount' => (int) $order->total_cents ],
			],
			'buyer' => [
				'email' => $order->customer_email,
				'name'  => $order->customer_name,
			],
			'fulfillment' => [
				'expectations' => [ [
					'id'          => 'exp_1',
					'method_type' => 'shipping',
					'destination' => $ship_addr ? [
						'street_address'   => $ship_addr['line1'] ?? null,
						'address_locality' => $ship_addr['city'] ?? null,
						'address_region'   => $ship_addr['state'] ?? null,
						'postal_code'      => $ship_addr['postal_code'] ?? null,
						'address_country'  => $ship_addr['country'] ?? null,
					] : null,
				] ],
				'events' => [],
			],
			'created_at' => $order->created_at,
			'updated_at' => $order->updated_at,
			'links'      => [ 'self' => "{$base}/ucp/orders/{$order->id}" ],
		] );
	}

	/* ===================================================================
	 * WEBHOOK SUBSCRIBE
	 * =================================================================== */

	public static function webhook_subscribe( WP_REST_Request $req ): WP_REST_Response {
		$body = $req->get_json_params();
		$pid  = $body['platform_id'] ?? '';
		$url  = $body['webhook_url'] ?? '';

		if ( ! $pid || ! $url ) return blu_error( 'platform_id and webhook_url are required', 400 );

		$events = $body['events'] ?? [ 'order.created', 'order.shipped', 'order.delivered' ];
		$secret = bin2hex( random_bytes( 32 ) );
		$tw     = blu_table( 'ucp_webhook_subscriptions' );
		$mid    = self::mid();
		$id     = blu_uuid();

		global $wpdb;
		$wpdb->query( $wpdb->prepare(
			"INSERT INTO {$tw} (id, merchant_id, platform_id, webhook_url, events, secret)
			 VALUES (%s, %s, %s, %s, %s, %s)
			 ON DUPLICATE KEY UPDATE events = VALUES(events), updated_at = NOW()",
			$id, $mid, $pid, $url, wp_json_encode( $events ), $secret
		) );

		return blu_success( [
			'id'          => $id,
			'platform_id' => $pid,
			'webhook_url' => $url,
			'events'      => $events,
			'secret'      => $secret,
			'status'      => 'active',
		], 201 );
	}

	/* ===================================================================
	 * CATALOG SEARCH (extension)
	 * =================================================================== */

	public static function catalog_search( WP_REST_Request $req ): WP_REST_Response {
		$mid    = self::mid();
		$tp     = blu_table( 'products' );
		$q      = $req->get_param( 'q' );
		$cat    = $req->get_param( 'category' );
		$limit  = min( (int) ( $req->get_param( 'limit' ) ?: 20 ), 100 );
		$offset = max( (int) ( $req->get_param( 'offset' ) ?: 0 ), 0 );

		$where  = [ "merchant_id = %s", "status = 'active'" ];
		$params = [ $mid ];

		if ( $q ) {
			$like     = '%' . $q . '%';
			$where[]  = '(name LIKE %s OR short_description LIKE %s OR sku LIKE %s)';
			$params[] = $like;
			$params[] = $like;
			$params[] = $like;
		}

		if ( $cat ) {
			$where[]  = "JSON_CONTAINS(categories, %s)";
			$params[] = wp_json_encode( $cat );
		}

		$w       = implode( ' AND ', $where );
		$params[] = $limit;
		$params[] = $offset;

		$rows = Blu_DB::get_results(
			"SELECT id, sku, name, short_description, price, compare_at_price,
			        images, categories, status, inventory_qty
			 FROM {$tp} WHERE {$w} ORDER BY name ASC LIMIT %d OFFSET %d",
			$params
		);

		$items = [];
		foreach ( $rows as $p ) {
			$imgs = json_decode( $p->images ?? '[]', true );
			$cats = json_decode( $p->categories ?? '[]', true );
			$items[] = [
				'id'               => $p->sku,
				'title'            => $p->name,
				'description'      => $p->short_description,
				'image_url'        => $imgs[0]['url'] ?? null,
				'price'            => (int) round( (float) $p->price * 100 ),
				'compare_at_price' => $p->compare_at_price ? (int) round( (float) $p->compare_at_price * 100 ) : null,
				'availability'     => (int) $p->inventory_qty > 0 ? 'in_stock' : 'out_of_stock',
				'categories'       => $cats,
			];
		}

		return blu_success( [
			'ucp'    => [ 'version' => self::UCP_VERSION ],
			'items'  => $items,
			'total'  => count( $items ),
			'limit'  => $limit,
			'offset' => $offset,
		] );
	}

	/* ===================================================================
	 * CATALOG ITEM
	 * =================================================================== */

	public static function catalog_item( WP_REST_Request $req ): WP_REST_Response {
		$sku = $req->get_param( 'sku' );
		$res = self::product_by_sku( $sku );

		if ( ! $res['product'] ) return blu_error( 'Product not found', 404 );

		$product = $res['product'];
		$variant = $res['variant'];

		$item_sku   = $variant->sku   ?? $product->sku;
		$item_price = $variant->price ?? $product->price;
		$item_inv   = $variant->inventory_qty ?? $product->inventory_qty;
		$item_title = ( $variant && $variant->display )
			? $product->name . ' - ' . $variant->display
			: $product->name;

		$images = json_decode( $product->images ?? '[]', true );
		$cats   = json_decode( $product->categories ?? '[]', true );
		$tags   = json_decode( $product->tags ?? '[]', true );

		return blu_success( [
			'ucp'  => [ 'version' => self::UCP_VERSION ],
			'item' => [
				'id'                 => $item_sku,
				'title'              => $item_title,
				'description'        => $product->description,
				'short_description'  => $product->short_description,
				'image_url'          => $images[0]['url'] ?? null,
				'images'             => $images,
				'price'              => (int) round( (float) $item_price * 100 ),
				'compare_at_price'   => $product->compare_at_price ? (int) round( (float) $product->compare_at_price * 100 ) : null,
				'availability'       => (int) $item_inv > 0 ? 'in_stock' : 'out_of_stock',
				'inventory_quantity' => (int) $item_inv,
				'categories'         => $cats,
				'tags'               => $tags,
				'variant'            => $variant ? [
					'id'      => $variant->id,
					'display' => $variant->display,
				] : null,
			],
		] );
	}
}
