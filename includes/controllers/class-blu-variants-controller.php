<?php
/**
 * Blu Store Variants Controller
 *
 * Product options (Size, Color) and variants (Small/Red) CRUD.
 * Converted from: api/src/routes/variants.js
 *
 * Routes registered under /wp-json/blu/v1/products/{productId}/...
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_Variants_Controller {

	/* ───── register ───── */
	public static function register_routes() {
		$ns = 'blu/v1';
		$base = '/products/(?P<productId>[a-f0-9\-]{36})';
		$admin = array( 'permission_callback' => function () { return current_user_can( 'manage_options' ); } );

		/* Variants */
		register_rest_route( $ns, $base . '/variants', array(
			array( 'methods' => 'GET',  'callback' => array( __CLASS__, 'get_variants' ),   'permission_callback' => '__return_true' ),
			array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'create_variant' ), 'permission_callback' => $admin['permission_callback'] ),
		));
		register_rest_route( $ns, $base . '/variants/generate', array(
			array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'generate_variants' ), 'permission_callback' => $admin['permission_callback'] ),
		));
		register_rest_route( $ns, $base . '/variants/bulk', array(
			array( 'methods' => 'PUT', 'callback' => array( __CLASS__, 'bulk_update_variants' ), 'permission_callback' => $admin['permission_callback'] ),
		));
		register_rest_route( $ns, $base . '/variants/(?P<variantId>[a-f0-9\-]{36})', array(
			array( 'methods' => 'PUT', 'callback' => array( __CLASS__, 'update_variant' ), 'permission_callback' => $admin['permission_callback'] ),
			array( 'methods' => 'DELETE', 'callback' => array( __CLASS__, 'delete_variant' ), 'permission_callback' => $admin['permission_callback'] ),
		));

		/* Options */
		register_rest_route( $ns, $base . '/options', array(
			array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'create_option' ), 'permission_callback' => $admin['permission_callback'] ),
		));
		register_rest_route( $ns, $base . '/options/(?P<optionId>[a-f0-9\-]{36})', array(
			array( 'methods' => 'PUT', 'callback' => array( __CLASS__, 'update_option' ), 'permission_callback' => $admin['permission_callback'] ),
			array( 'methods' => 'DELETE', 'callback' => array( __CLASS__, 'delete_option' ), 'permission_callback' => $admin['permission_callback'] ),
		));

		/* Option values */
		register_rest_route( $ns, $base . '/options/(?P<optionId>[a-f0-9\-]{36})/values', array(
			array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'create_option_value' ), 'permission_callback' => $admin['permission_callback'] ),
		));
		register_rest_route( $ns, $base . '/options/(?P<optionId>[a-f0-9\-]{36})/values/(?P<valueId>[a-f0-9\-]{36})', array(
			array( 'methods' => 'DELETE', 'callback' => array( __CLASS__, 'delete_option_value' ), 'permission_callback' => $admin['permission_callback'] ),
		));
	}

	/* ─────────────────────── helpers ─────────────────────── */

	private static function verify_product( $product_id ) {
		$merchant_id = blu_merchant_id();
		return Blu_DB::get_row(
			'SELECT id, has_variants FROM ' . blu_table('products') . ' WHERE id = %s AND merchant_id = %s',
			array( $product_id, $merchant_id )
		);
	}

	/**
	 * Generate display string from option value IDs.
	 * Replaces pg function generate_variant_display().
	 */
	private static function variant_display( $option_value_ids ) {
		if ( empty( $option_value_ids ) ) return null;
		$t = blu_table('product_option_values');
		$placeholders = implode( ',', array_fill( 0, count( $option_value_ids ), '%s' ) );
		$rows = Blu_DB::get_results(
			"SELECT pov.value, po.position
			 FROM {$t} pov
			 JOIN " . blu_table('product_options') . " po ON po.id = pov.option_id
			 WHERE pov.id IN ({$placeholders})
			 ORDER BY po.position",
			$option_value_ids
		);
		return implode( ' / ', wp_list_pluck( $rows, 'value' ) );
	}

	/* ─────────────────────── GET variants ─────────────────────── */

	public static function get_variants( $request ) {
		$product_id = $request['productId'];
		if ( ! self::verify_product( $product_id ) ) {
			return blu_error( 'Product not found', 404 );
		}

		$opt_t = blu_table('product_options');
		$val_t = blu_table('product_option_values');
		$var_t = blu_table('product_variants');

		// Options with values
		$options = Blu_DB::get_results(
			"SELECT po.id, po.name, po.position FROM {$opt_t} po WHERE po.product_id = %s ORDER BY po.position",
			array( $product_id )
		);

		foreach ( $options as &$opt ) {
			$opt->values = Blu_DB::get_results(
				"SELECT id, value, position, color_hex, image_url FROM {$val_t} WHERE option_id = %s ORDER BY position",
				array( $opt->id )
			);
		}

		// Variants
		$variants = Blu_DB::get_results(
			"SELECT * FROM {$var_t} WHERE product_id = %s ORDER BY position, created_at",
			array( $product_id )
		);

		foreach ( $variants as &$v ) {
			$v->option_value_ids = json_decode( $v->option_value_ids ?? '[]' );
		}

		return blu_success( array( 'options' => $options, 'variants' => $variants ) );
	}

	/* ─────────────────────── OPTIONS CRUD ─────────────────────── */

	public static function create_option( $request ) {
		$product_id = $request['productId'];
		$body       = $request->get_json_params();
		$name       = $body['name'] ?? '';
		$values     = $body['values'] ?? array();

		if ( empty( $name ) ) return blu_error( 'Option name is required', 400 );
		if ( ! self::verify_product( $product_id ) ) return blu_error( 'Product not found', 404 );

		$opt_t = blu_table('product_options');
		$val_t = blu_table('product_option_values');
		$prd_t = blu_table('products');

		// Next position
		$next = (int) Blu_DB::get_var(
			"SELECT COALESCE(MAX(position), -1) + 1 FROM {$opt_t} WHERE product_id = %s",
			array( $product_id )
		);

		$option_id = blu_uuid();
		Blu_DB::query(
			"INSERT INTO {$opt_t} (id, product_id, name, position) VALUES (%s, %s, %s, %d)",
			array( $option_id, $product_id, $name, $next )
		);

		$created_values = array();
		foreach ( $values as $i => $val ) {
			$val_text  = is_array( $val ) ? ( $val['value'] ?? '' ) : $val;
			$color_hex = is_array( $val ) ? ( $val['color_hex'] ?? null ) : null;
			$image_url = is_array( $val ) ? ( $val['image_url'] ?? null ) : null;
			$vid       = blu_uuid();

			Blu_DB::query(
				"INSERT INTO {$val_t} (id, option_id, value, position, color_hex, image_url) VALUES (%s, %s, %s, %d, %s, %s)",
				array( $vid, $option_id, $val_text, $i, $color_hex, $image_url )
			);
			$created_values[] = (object) array( 'id' => $vid, 'value' => $val_text, 'position' => $i, 'color_hex' => $color_hex, 'image_url' => $image_url );
		}

		// Update product: has_variants = true, append option name
		$current_names = Blu_DB::get_var(
			"SELECT variant_option_names FROM {$prd_t} WHERE id = %s",
			array( $product_id )
		);
		$names_arr   = json_decode( $current_names ?? '[]', true ) ?: array();
		$names_arr[] = $name;

		Blu_DB::query(
			"UPDATE {$prd_t} SET has_variants = 1, variant_option_names = %s WHERE id = %s",
			array( wp_json_encode( $names_arr ), $product_id )
		);

		return blu_success( array(
			'option' => (object) array( 'id' => $option_id, 'name' => $name, 'position' => $next, 'values' => $created_values ),
		), 201 );
	}

	public static function update_option( $request ) {
		$product_id = $request['productId'];
		$option_id  = $request['optionId'];
		$body       = $request->get_json_params();

		if ( ! self::verify_product( $product_id ) ) return blu_error( 'Product not found', 404 );

		$opt_t = blu_table('product_options');

		$sets   = array( 'updated_at = NOW()' );
		$params = array();
		if ( isset( $body['name'] ) )     { $sets[] = 'name = %s';     $params[] = $body['name']; }
		if ( isset( $body['position'] ) ) { $sets[] = 'position = %d'; $params[] = $body['position']; }

		$params[] = $option_id;
		$params[] = $product_id;

		Blu_DB::query(
			"UPDATE {$opt_t} SET " . implode( ', ', $sets ) . " WHERE id = %s AND product_id = %s",
			$params
		);

		$row = Blu_DB::get_row( "SELECT * FROM {$opt_t} WHERE id = %s", array( $option_id ) );
		if ( ! $row ) return blu_error( 'Option not found', 404 );

		return blu_success( array( 'option' => $row ) );
	}

	public static function delete_option( $request ) {
		$product_id = $request['productId'];
		$option_id  = $request['optionId'];

		if ( ! self::verify_product( $product_id ) ) return blu_error( 'Product not found', 404 );

		$opt_t = blu_table('product_options');
		$prd_t = blu_table('products');

		$option = Blu_DB::get_row(
			"SELECT name FROM {$opt_t} WHERE id = %s AND product_id = %s",
			array( $option_id, $product_id )
		);
		if ( ! $option ) return blu_error( 'Option not found', 404 );

		// Delete (values cascade via FK)
		Blu_DB::query( "DELETE FROM {$opt_t} WHERE id = %s", array( $option_id ) );

		// Remove name from product's variant_option_names
		$current_names = Blu_DB::get_var(
			"SELECT variant_option_names FROM {$prd_t} WHERE id = %s",
			array( $product_id )
		);
		$names_arr = json_decode( $current_names ?? '[]', true ) ?: array();
		$names_arr = array_values( array_diff( $names_arr, array( $option->name ) ) );

		$remaining = (int) Blu_DB::get_var(
			"SELECT COUNT(*) FROM {$opt_t} WHERE product_id = %s",
			array( $product_id )
		);

		Blu_DB::query(
			"UPDATE {$prd_t} SET has_variants = %d, variant_option_names = %s WHERE id = %s",
			array( $remaining > 0 ? 1 : 0, wp_json_encode( $names_arr ), $product_id )
		);

		return blu_success( array( 'message' => 'Option deleted' ) );
	}

	/* ─────────────────────── OPTION VALUES ─────────────────────── */

	public static function create_option_value( $request ) {
		$product_id = $request['productId'];
		$option_id  = $request['optionId'];
		$body       = $request->get_json_params();
		$value      = $body['value'] ?? '';

		if ( empty( $value ) ) return blu_error( 'Value is required', 400 );

		// Verify option belongs to product + merchant
		$opt_t = blu_table('product_options');
		$prd_t = blu_table('products');
		$val_t = blu_table('product_option_values');

		$check = Blu_DB::get_row(
			"SELECT po.id FROM {$opt_t} po JOIN {$prd_t} p ON po.product_id = p.id
			 WHERE po.id = %s AND po.product_id = %s AND p.merchant_id = %s",
			array( $option_id, $product_id, blu_merchant_id() )
		);
		if ( ! $check ) return blu_error( 'Option not found', 404 );

		$next_pos = (int) Blu_DB::get_var(
			"SELECT COALESCE(MAX(position), -1) + 1 FROM {$val_t} WHERE option_id = %s",
			array( $option_id )
		);

		$vid = blu_uuid();
		Blu_DB::query(
			"INSERT INTO {$val_t} (id, option_id, value, position, color_hex, image_url) VALUES (%s, %s, %s, %d, %s, %s)",
			array( $vid, $option_id, $value, $next_pos, $body['color_hex'] ?? null, $body['image_url'] ?? null )
		);

		return blu_success( array( 'value' => (object) array(
			'id' => $vid, 'value' => $value, 'position' => $next_pos,
			'color_hex' => $body['color_hex'] ?? null, 'image_url' => $body['image_url'] ?? null,
		)), 201 );
	}

	public static function delete_option_value( $request ) {
		$product_id = $request['productId'];
		$option_id  = $request['optionId'];
		$value_id   = $request['valueId'];

		$val_t = blu_table('product_option_values');
		$opt_t = blu_table('product_options');
		$prd_t = blu_table('products');

		// Verify ownership chain
		$check = Blu_DB::get_row(
			"SELECT pov.id FROM {$val_t} pov
			 JOIN {$opt_t} po ON po.id = pov.option_id
			 JOIN {$prd_t} p ON p.id = po.product_id
			 WHERE pov.id = %s AND pov.option_id = %s AND po.product_id = %s AND p.merchant_id = %s",
			array( $value_id, $option_id, $product_id, blu_merchant_id() )
		);
		if ( ! $check ) return blu_error( 'Value not found', 404 );

		Blu_DB::query( "DELETE FROM {$val_t} WHERE id = %s", array( $value_id ) );

		return blu_success( array( 'message' => 'Value deleted' ) );
	}

	/* ─────────────────────── VARIANTS CRUD ─────────────────────── */

	public static function create_variant( $request ) {
		$product_id = $request['productId'];
		$body       = $request->get_json_params();

		if ( ! self::verify_product( $product_id ) ) return blu_error( 'Product not found', 404 );

		$var_t = blu_table('product_variants');
		$prd_t = blu_table('products');

		$option_value_ids = $body['option_value_ids'] ?? array();
		$display = self::variant_display( $option_value_ids );

		$next_pos = (int) Blu_DB::get_var(
			"SELECT COALESCE(MAX(position), -1) + 1 FROM {$var_t} WHERE product_id = %s",
			array( $product_id )
		);

		$vid = blu_uuid();
		Blu_DB::query(
			"INSERT INTO {$var_t} (
				id, product_id, sku, barcode, price, compare_at_price, cost_price,
				inventory_qty, track_inventory, allow_backorder, low_stock_threshold,
				weight, weight_unit, option_value_ids, option_values_display, image_url, position
			) VALUES (%s, %s, %s, %s, %s, %s, %s, %d, %d, %d, %d, %s, %s, %s, %s, %s, %d)",
			array(
				$vid,
				$product_id,
				$body['sku'] ?? null,
				$body['barcode'] ?? null,
				$body['price'] ?? null,
				$body['compare_at_price'] ?? null,
				$body['cost_price'] ?? null,
				$body['inventory_qty'] ?? 0,
				$body['track_inventory'] ?? 1,
				$body['allow_backorder'] ?? 0,
				$body['low_stock_threshold'] ?? 5,
				$body['weight'] ?? null,
				$body['weight_unit'] ?? 'lb',
				wp_json_encode( $option_value_ids ),
				$display,
				$body['image_url'] ?? null,
				$next_pos,
			)
		);

		Blu_DB::query( "UPDATE {$prd_t} SET has_variants = 1 WHERE id = %s", array( $product_id ) );

		$variant = Blu_DB::get_row( "SELECT * FROM {$var_t} WHERE id = %s", array( $vid ) );
		$variant->option_value_ids = json_decode( $variant->option_value_ids ?? '[]' );

		return blu_success( array( 'variant' => $variant ), 201 );
	}

	public static function update_variant( $request ) {
		$product_id = $request['productId'];
		$variant_id = $request['variantId'];
		$body       = $request->get_json_params();

		if ( ! self::verify_product( $product_id ) ) return blu_error( 'Product not found', 404 );

		$var_t = blu_table('product_variants');

		$sets   = array( 'updated_at = NOW()' );
		$params = array();

		$fields = array(
			'sku' => '%s', 'barcode' => '%s', 'price' => '%s', 'compare_at_price' => '%s',
			'cost_price' => '%s', 'inventory_qty' => '%d', 'track_inventory' => '%d',
			'allow_backorder' => '%d', 'low_stock_threshold' => '%d', 'weight' => '%s',
			'weight_unit' => '%s', 'is_active' => '%d', 'image_url' => '%s', 'position' => '%d',
		);

		foreach ( $fields as $f => $fmt ) {
			if ( isset( $body[ $f ] ) ) {
				$sets[]   = "{$f} = {$fmt}";
				$params[] = $body[ $f ];
			}
		}

		$params[] = $variant_id;
		$params[] = $product_id;

		Blu_DB::query(
			"UPDATE {$var_t} SET " . implode( ', ', $sets ) . " WHERE id = %s AND product_id = %s",
			$params
		);

		$row = Blu_DB::get_row( "SELECT * FROM {$var_t} WHERE id = %s AND product_id = %s", array( $variant_id, $product_id ) );
		if ( ! $row ) return blu_error( 'Variant not found', 404 );
		$row->option_value_ids = json_decode( $row->option_value_ids ?? '[]' );

		return blu_success( array( 'variant' => $row ) );
	}

	public static function delete_variant( $request ) {
		$product_id = $request['productId'];
		$variant_id = $request['variantId'];

		if ( ! self::verify_product( $product_id ) ) return blu_error( 'Product not found', 404 );

		$var_t = blu_table('product_variants');
		$prd_t = blu_table('products');

		$check = Blu_DB::get_row(
			"SELECT id FROM {$var_t} WHERE id = %s AND product_id = %s",
			array( $variant_id, $product_id )
		);
		if ( ! $check ) return blu_error( 'Variant not found', 404 );

		Blu_DB::query( "DELETE FROM {$var_t} WHERE id = %s", array( $variant_id ) );

		$remaining = (int) Blu_DB::get_var(
			"SELECT COUNT(*) FROM {$var_t} WHERE product_id = %s",
			array( $product_id )
		);
		if ( $remaining === 0 ) {
			Blu_DB::query( "UPDATE {$prd_t} SET has_variants = 0 WHERE id = %s", array( $product_id ) );
		}

		return blu_success( array( 'message' => 'Variant deleted' ) );
	}

	/* ─────────────────────── GENERATE ─────────────────────── */

	public static function generate_variants( $request ) {
		$product_id = $request['productId'];
		$body       = $request->get_json_params();

		$product = self::verify_product( $product_id );
		if ( ! $product ) return blu_error( 'Product not found', 404 );

		$prd_full = Blu_DB::get_row(
			'SELECT id, price, sku FROM ' . blu_table('products') . ' WHERE id = %s',
			array( $product_id )
		);

		$price      = $body['base_price'] ?? $prd_full->price;
		$sku_prefix = $body['base_sku_prefix'] ?? $prd_full->sku ?? 'VAR';

		$opt_t = blu_table('product_options');
		$val_t = blu_table('product_option_values');
		$var_t = blu_table('product_variants');

		// Options with values
		$options = Blu_DB::get_results(
			"SELECT po.id AS option_id, po.name AS option_name, po.position
			 FROM {$opt_t} po WHERE po.product_id = %s ORDER BY po.position",
			array( $product_id )
		);

		if ( empty( $options ) ) return blu_error( 'No options defined for this product', 400 );

		foreach ( $options as &$opt ) {
			$opt->values = Blu_DB::get_results(
				"SELECT id, value FROM {$val_t} WHERE option_id = %s ORDER BY position",
				array( $opt->option_id )
			);
		}

		// Generate combinations
		$combos = array( array() );
		foreach ( $options as $opt ) {
			$new_combos = array();
			foreach ( $combos as $combo ) {
				foreach ( $opt->values as $val ) {
					$new_combos[] = array_merge( $combo, array( (object) array(
						'option' => $opt->option_name,
						'id'     => $val->id,
						'value'  => $val->value,
					)));
				}
			}
			$combos = $new_combos;
		}

		$created = array();
		$pos     = 0;

		foreach ( $combos as $combo ) {
			$ov_ids  = wp_list_pluck( $combo, 'id' );
			$display = implode( ' / ', wp_list_pluck( $combo, 'value' ) );
			$suffix  = implode( '-', array_map( function( $v ) {
				return strtoupper( substr( preg_replace( '/\s/', '', $v->value ), 0, 3 ) );
			}, $combo ) );

			$sku = $sku_prefix . '-' . $suffix;

			// Skip duplicates
			$exists = Blu_DB::get_var(
				"SELECT id FROM {$var_t} WHERE sku = %s",
				array( $sku )
			);
			if ( $exists ) { $pos++; continue; }

			$vid = blu_uuid();
			Blu_DB::query(
				"INSERT INTO {$var_t} (id, product_id, sku, price, inventory_qty, option_value_ids, option_values_display, position)
				 VALUES (%s, %s, %s, %s, %d, %s, %s, %d)",
				array( $vid, $product_id, $sku, $price, 0, wp_json_encode( $ov_ids ), $display, $pos )
			);

			$row = Blu_DB::get_row( "SELECT * FROM {$var_t} WHERE id = %s", array( $vid ) );
			$row->option_value_ids = json_decode( $row->option_value_ids ?? '[]' );
			$created[] = $row;
			$pos++;
		}

		Blu_DB::query( 'UPDATE ' . blu_table('products') . ' SET has_variants = 1 WHERE id = %s', array( $product_id ) );

		return blu_success( array(
			'message'  => sprintf( 'Generated %d variants', count( $created ) ),
			'variants' => $created,
		), 201 );
	}

	/* ─────────────────────── BULK UPDATE ─────────────────────── */

	public static function bulk_update_variants( $request ) {
		$product_id = $request['productId'];
		$body       = $request->get_json_params();
		$updates    = $body['updates'] ?? array();

		if ( empty( $updates ) ) return blu_error( 'Updates array is required', 400 );
		if ( ! self::verify_product( $product_id ) ) return blu_error( 'Product not found', 404 );

		$var_t   = blu_table('product_variants');
		$results = array();

		foreach ( $updates as $upd ) {
			if ( empty( $upd['id'] ) ) continue;

			$sets   = array( 'updated_at = NOW()' );
			$params = array();

			if ( isset( $upd['price'] ) )         { $sets[] = 'price = %s';         $params[] = $upd['price']; }
			if ( isset( $upd['inventory_qty'] ) )  { $sets[] = 'inventory_qty = %d'; $params[] = $upd['inventory_qty']; }
			if ( isset( $upd['is_active'] ) )      { $sets[] = 'is_active = %d';     $params[] = $upd['is_active']; }

			$params[] = $upd['id'];
			$params[] = $product_id;

			Blu_DB::query(
				"UPDATE {$var_t} SET " . implode( ', ', $sets ) . " WHERE id = %s AND product_id = %s",
				$params
			);

			$row = Blu_DB::get_row( "SELECT * FROM {$var_t} WHERE id = %s", array( $upd['id'] ) );
			if ( $row ) {
				$row->option_value_ids = json_decode( $row->option_value_ids ?? '[]' );
				$results[] = $row;
			}
		}

		return blu_success( array(
			'message'  => sprintf( 'Updated %d variants', count( $results ) ),
			'variants' => $results,
		));
	}
}
