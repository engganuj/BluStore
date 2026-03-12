<?php
/**
 * Blu Store – Design Controller
 *
 * REST endpoints for managing site design (brand colors/fonts, navigation menus)
 * from within the Blu Store admin UI — no Site Editor required.
 *
 * Persistence:
 *  - Brand/theme settings → wp_options  `blu_design_settings`
 *  - Design versions      → wp_options  `blu_design_versions` (array of snapshots)
 *  - Navigation menus     → `wp_navigation` CPT (block-theme native)
 *  - Applied styles       → `wp_global_styles` CPT (block-theme custom CSS/JSON)
 *
 * @package BluStore
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Blu_Design_Controller {

	/* ─── Constants ─── */

	const OPTION_KEY   = 'blu_design_settings';
	const VERSIONS_KEY = 'blu_design_versions';
	const MAX_VERSIONS = 20;

	/**
	 * Default design settings.
	 */
	private static function defaults(): array {
		return [
			'colors' => [
				'brand'       => '#6d28d9',
				'text'        => '#111827',
				'background'  => '#ffffff',
				'accent'      => '#0ea5e9',
				'link'        => '#6d28d9',
				'button'      => '#6d28d9',
				'button_text' => '#ffffff',
			],
			'fonts' => [
				'heading' => 'system-ui',
				'body'    => 'system-ui',
			],
			'applied_at' => null,
		];
	}

	/* ═══════════════════════════════════════════════════════════
	 *  ROUTE REGISTRATION
	 * ═══════════════════════════════════════════════════════════ */

	public static function register( string $ns ): void {
		$admin = [ 'Blu_REST_API', 'admin_permission' ];

		// Block theme check
		register_rest_route( $ns, '/design/capabilities', [
			'methods' => 'GET', 'callback' => [ __CLASS__, 'get_capabilities' ], 'permission_callback' => $admin,
		] );

		// Design settings (colors / fonts)
		register_rest_route( $ns, '/design/settings', [
			[ 'methods' => 'GET', 'callback' => [ __CLASS__, 'get_settings' ], 'permission_callback' => $admin ],
			[ 'methods' => 'PUT', 'callback' => [ __CLASS__, 'update_settings' ], 'permission_callback' => $admin ],
		] );

		// Apply design to theme
		register_rest_route( $ns, '/design/apply', [
			'methods' => 'POST', 'callback' => [ __CLASS__, 'apply_to_theme' ], 'permission_callback' => $admin,
		] );

		// Version history
		register_rest_route( $ns, '/design/versions', [
			'methods' => 'GET', 'callback' => [ __CLASS__, 'get_versions' ], 'permission_callback' => $admin,
		] );
		register_rest_route( $ns, '/design/versions/(?P<index>\d+)/restore', [
			'methods' => 'POST', 'callback' => [ __CLASS__, 'restore_version' ], 'permission_callback' => $admin,
			'args'    => [ 'index' => [ 'required' => true, 'sanitize_callback' => 'absint' ] ],
		] );

		// Navigation menus (wp_navigation posts)
		register_rest_route( $ns, '/design/menus', [
			[ 'methods' => 'GET',  'callback' => [ __CLASS__, 'get_menus' ],    'permission_callback' => $admin ],
			[ 'methods' => 'POST', 'callback' => [ __CLASS__, 'create_menu' ],  'permission_callback' => $admin ],
		] );
		register_rest_route( $ns, '/design/menus/(?P<menu_id>\d+)', [
			[ 'methods' => 'PUT',    'callback' => [ __CLASS__, 'update_menu' ],  'permission_callback' => $admin,
			  'args' => [ 'menu_id' => [ 'required' => true, 'sanitize_callback' => 'absint' ] ] ],
			[ 'methods' => 'DELETE', 'callback' => [ __CLASS__, 'delete_menu' ],  'permission_callback' => $admin,
			  'args' => [ 'menu_id' => [ 'required' => true, 'sanitize_callback' => 'absint' ] ] ],
		] );

		// Font catalog
		register_rest_route( $ns, '/design/fonts', [
			'methods' => 'GET', 'callback' => [ __CLASS__, 'get_font_catalog' ], 'permission_callback' => $admin,
		] );
	}

	/* ═══════════════════════════════════════════════════════════
	 *  CAPABILITIES
	 * ═══════════════════════════════════════════════════════════ */

	public static function get_capabilities(): WP_REST_Response {
		$is_block = function_exists( 'wp_is_block_theme' ) && wp_is_block_theme();
		$theme    = wp_get_theme();

		return blu_success( [
			'is_block_theme'   => $is_block,
			'theme_name'       => $theme->get( 'Name' ),
			'theme_version'    => $theme->get( 'Version' ),
			'can_apply_styles' => $is_block,
			// Simple location names for the menu editor dropdown
			'menu_locations'   => $is_block
				? [ 'header' => 'Header', 'footer' => 'Footer' ]
				: get_registered_nav_menus(),
		] );
	}

	/* ═══════════════════════════════════════════════════════════
	 *  DESIGN SETTINGS (colors / fonts)
	 * ═══════════════════════════════════════════════════════════ */

	public static function get_settings(): WP_REST_Response {
		$settings = wp_parse_args( get_option( self::OPTION_KEY, [] ), self::defaults() );
		return blu_success( [ 'settings' => $settings ] );
	}

	public static function update_settings( WP_REST_Request $request ): WP_REST_Response {
		$body    = $request->get_json_params();
		$current = wp_parse_args( get_option( self::OPTION_KEY, [] ), self::defaults() );

		if ( ! empty( $body['colors'] ) && is_array( $body['colors'] ) ) {
			foreach ( $body['colors'] as $key => $val ) {
				if ( array_key_exists( $key, $current['colors'] ) ) {
					$current['colors'][ $key ] = sanitize_hex_color( $val ) ?: $current['colors'][ $key ];
				}
			}
		}

		if ( ! empty( $body['fonts'] ) && is_array( $body['fonts'] ) ) {
			foreach ( $body['fonts'] as $key => $val ) {
				if ( array_key_exists( $key, $current['fonts'] ) ) {
					$current['fonts'][ $key ] = sanitize_text_field( $val );
				}
			}
		}

		update_option( self::OPTION_KEY, $current );
		return blu_success( [ 'settings' => $current, 'message' => 'Design settings saved.' ] );
	}

	/* ═══════════════════════════════════════════════════════════
	 *  APPLY TO THEME (publish)
	 * ═══════════════════════════════════════════════════════════ */

	public static function apply_to_theme(): WP_REST_Response {
		if ( ! function_exists( 'wp_is_block_theme' ) || ! wp_is_block_theme() ) {
			return blu_error( 'Active theme is not a block theme.', 400 );
		}

		$settings = wp_parse_args( get_option( self::OPTION_KEY, [] ), self::defaults() );

		// Snapshot before applying
		self::save_version_snapshot( $settings );

		// 1) Write global styles (colors + fonts)
		$global_styles = self::build_global_styles( $settings );
		$result        = self::write_global_styles( $global_styles );

		if ( is_wp_error( $result ) ) {
			return blu_error( $result->get_error_message(), 500 );
		}

		// 2) Wire navigation posts into theme template parts
		$nav_notes = self::sync_navigation_to_template_parts();

		// 3) Timestamp
		$settings['applied_at'] = current_time( 'mysql', true );
		update_option( self::OPTION_KEY, $settings );

		return blu_success( [
			'message'    => 'Design published to your store.',
			'settings'   => $settings,
			'applied_at' => $settings['applied_at'],
			'navigation' => $nav_notes,
		] );
	}

	/* ═══════════════════════════════════════════════════════════
	 *  NAVIGATION MENUS — wp_navigation CPT
	 *
	 *  Each menu is a wp_navigation post.
	 *  Items are stored as block markup (core/navigation-link).
	 *  Location is stored in post meta (_blu_nav_location).
	 * ═══════════════════════════════════════════════════════════ */

	/**
	 * GET /design/menus
	 */
	public static function get_menus(): WP_REST_Response {
		$posts = get_posts( [
			'post_type'      => 'wp_navigation',
			'post_status'    => 'publish',
			'posts_per_page' => 50,
			'orderby'        => 'date',
			'order'          => 'ASC',
			'meta_query'     => [ // phpcs:ignore WordPress.DB.SlowDBQuery
				[
					'key'     => '_blu_managed',
					'value'   => '1',
					'compare' => '=',
				],
			],
		] );

		$menus = [];
		foreach ( $posts as $post ) {
			$menus[] = self::format_nav_post( $post );
		}

		// Determine available locations
		$is_block = function_exists( 'wp_is_block_theme' ) && wp_is_block_theme();

		return blu_success( [
			'menus'                => $menus,
			'registered_locations' => $is_block
				? [ 'header' => 'Header', 'footer' => 'Footer' ]
				: get_registered_nav_menus(),
		] );
	}

	/**
	 * POST /design/menus
	 */
	public static function create_menu( WP_REST_Request $request ): WP_REST_Response {
		$body = $request->get_json_params();
		$name = sanitize_text_field( $body['name'] ?? '' );

		if ( empty( $name ) ) {
			return blu_error( 'Menu name is required.', 400 );
		}

		$content = '';
		if ( ! empty( $body['items'] ) && is_array( $body['items'] ) ) {
			$content = self::items_to_block_markup( $body['items'] );
		}

		$post_id = wp_insert_post( [
			'post_type'    => 'wp_navigation',
			'post_title'   => $name,
			'post_content' => $content,
			'post_status'  => 'publish',
		], true );

		if ( is_wp_error( $post_id ) ) {
			return blu_error( $post_id->get_error_message(), 400 );
		}

		// Mark as Blu-managed so we don't show random nav posts
		update_post_meta( $post_id, '_blu_managed', '1' );

		if ( ! empty( $body['location'] ) ) {
			update_post_meta( $post_id, '_blu_nav_location', sanitize_text_field( $body['location'] ) );
		}

		return blu_success( [ 'menu_id' => $post_id, 'message' => 'Menu created.' ] );
	}

	/**
	 * PUT /design/menus/{menu_id}
	 */
	public static function update_menu( WP_REST_Request $request ): WP_REST_Response {
		$menu_id = (int) $request->get_param( 'menu_id' );
		$body    = $request->get_json_params();

		$post = get_post( $menu_id );
		if ( ! $post || $post->post_type !== 'wp_navigation' ) {
			return blu_error( 'Menu not found.', 404 );
		}

		$update = [ 'ID' => $menu_id ];

		if ( ! empty( $body['name'] ) ) {
			$update['post_title'] = sanitize_text_field( $body['name'] );
		}

		if ( isset( $body['items'] ) && is_array( $body['items'] ) ) {
			$update['post_content'] = self::items_to_block_markup( $body['items'] );
		}

		wp_update_post( $update );

		if ( isset( $body['location'] ) ) {
			if ( empty( $body['location'] ) ) {
				delete_post_meta( $menu_id, '_blu_nav_location' );
			} else {
				update_post_meta( $menu_id, '_blu_nav_location', sanitize_text_field( $body['location'] ) );
			}
		}

		return blu_success( [ 'message' => 'Menu updated.' ] );
	}

	/**
	 * DELETE /design/menus/{menu_id}
	 */
	public static function delete_menu( WP_REST_Request $request ): WP_REST_Response {
		$menu_id = (int) $request->get_param( 'menu_id' );

		$post = get_post( $menu_id );
		if ( ! $post || $post->post_type !== 'wp_navigation' ) {
			return blu_error( 'Menu not found.', 404 );
		}

		wp_delete_post( $menu_id, true );

		return blu_success( [ 'message' => 'Menu deleted.' ] );
	}

	/* ─── Navigation helpers ─── */

	/**
	 * Convert a wp_navigation post into the REST response shape
	 * that the frontend expects.
	 */
	private static function format_nav_post( WP_Post $post ): array {
		$items    = self::block_markup_to_items( $post->post_content );
		$location = get_post_meta( $post->ID, '_blu_nav_location', true ) ?: '';

		return [
			'id'       => (int) $post->ID,
			'name'     => $post->post_title,
			'slug'     => $post->post_name,
			'location' => $location,
			'count'    => count( $items ),
			'items'    => $items,
		];
	}

	/**
	 * Convert an items array into wp:navigation-link block markup.
	 *
	 * Input: [{ label: "Home", url: "/", page_id?: 5 }, ...]
	 * Output: <!-- wp:navigation-link {"label":"Home","url":"/",...} /-->
	 */
	private static function items_to_block_markup( array $items ): string {
		$blocks = [];

		foreach ( $items as $item ) {
			$label = sanitize_text_field( $item['label'] ?? 'Link' );
			$url   = esc_url_raw( $item['url'] ?? '/' );

			$attrs = [
				'label'          => $label,
				'url'            => $url,
				'isTopLevelLink' => true,
			];

			// Link to a WP page by ID
			if ( ! empty( $item['page_id'] ) ) {
				$page_id = absint( $item['page_id'] );
				$attrs['id']   = $page_id;
				$attrs['type'] = 'page';
				$attrs['kind'] = 'post-type';
				$page_url      = get_permalink( $page_id );
				if ( $page_url ) {
					$attrs['url'] = $page_url;
				}
			}

			$json     = wp_json_encode( $attrs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
			$blocks[] = '<!-- wp:navigation-link ' . $json . ' /-->';
		}

		return implode( "\n", $blocks );
	}

	/**
	 * Parse wp:navigation-link blocks back into a flat items array.
	 */
	private static function block_markup_to_items( string $content ): array {
		if ( empty( trim( $content ) ) ) {
			return [];
		}

		$blocks = parse_blocks( $content );
		$items  = [];
		$pos    = 0;

		foreach ( $blocks as $block ) {
			if ( empty( $block['blockName'] ) ) {
				continue; // skip freeform / whitespace
			}

			if ( $block['blockName'] === 'core/navigation-link' ) {
				$a       = $block['attrs'] ?? [];
				$items[] = [
					'id'        => $pos,
					'label'     => $a['label'] ?? '',
					'url'       => $a['url'] ?? '',
					'type'      => $a['kind'] ?? 'custom',
					'object'    => $a['type'] ?? 'custom',
					'object_id' => (int) ( $a['id'] ?? 0 ),
					'parent_id' => 0,
					'position'  => $pos,
				];
				$pos++;
			} elseif ( $block['blockName'] === 'core/navigation-submenu' ) {
				// Top-level parent
				$a         = $block['attrs'] ?? [];
				$parent_id = $pos;
				$items[]   = [
					'id'        => $pos,
					'label'     => $a['label'] ?? '',
					'url'       => $a['url'] ?? '',
					'type'      => $a['kind'] ?? 'custom',
					'object'    => $a['type'] ?? 'custom',
					'object_id' => (int) ( $a['id'] ?? 0 ),
					'parent_id' => 0,
					'position'  => $pos,
				];
				$pos++;

				// Children
				foreach ( $block['innerBlocks'] ?? [] as $child ) {
					if ( $child['blockName'] !== 'core/navigation-link' ) continue;
					$ca      = $child['attrs'] ?? [];
					$items[] = [
						'id'        => $pos,
						'label'     => $ca['label'] ?? '',
						'url'       => $ca['url'] ?? '',
						'type'      => $ca['kind'] ?? 'custom',
						'object'    => $ca['type'] ?? 'custom',
						'object_id' => (int) ( $ca['id'] ?? 0 ),
						'parent_id' => $parent_id,
						'position'  => $pos,
					];
					$pos++;
				}
			}
		}

		return $items;
	}

	/* ═══════════════════════════════════════════════════════════
	 *  SYNC NAVIGATION → TEMPLATE PARTS
	 *
	 *  On publish, find each Blu-managed wp_navigation post that
	 *  has a location (header / footer).  Then locate the matching
	 *  template part and update its core/navigation block ref.
	 *
	 *  Uses parse_blocks() / serialize_blocks() — no regex.
	 * ═══════════════════════════════════════════════════════════ */

	private static function sync_navigation_to_template_parts(): array {
		if ( ! function_exists( 'wp_is_block_theme' ) || ! wp_is_block_theme() ) {
			return [ 'skipped' => 'Not a block theme.' ];
		}

		$notes = [];

		// Get all Blu-managed nav posts with a location
		$nav_posts = get_posts( [
			'post_type'      => 'wp_navigation',
			'post_status'    => 'publish',
			'posts_per_page' => 10,
			'meta_query'     => [ // phpcs:ignore WordPress.DB.SlowDBQuery
				[
					'key'     => '_blu_managed',
					'value'   => '1',
				],
				[
					'key'     => '_blu_nav_location',
					'compare' => 'EXISTS',
				],
			],
		] );

		foreach ( $nav_posts as $nav_post ) {
			$location = get_post_meta( $nav_post->ID, '_blu_nav_location', true );
			if ( empty( $location ) ) continue;

			$result = self::update_template_part_nav_ref( $location, $nav_post->ID );
			$notes[ $location ] = $result;
		}

		return $notes;
	}

	/**
	 * Find the template part for a given area (header/footer) and
	 * update the first core/navigation block's `ref` to our nav post.
	 */
	private static function update_template_part_nav_ref( string $area, int $nav_post_id ): string {
		$stylesheet = get_stylesheet();

		// 1) Check for an existing customised template part post
		$existing = get_posts( [
			'post_type'      => 'wp_template_part',
			'post_status'    => [ 'publish', 'draft' ],
			'posts_per_page' => 1,
			'tax_query'      => [ // phpcs:ignore WordPress.DB.SlowDBQuery
				[
					'taxonomy' => 'wp_theme',
					'field'    => 'name',
					'terms'    => $stylesheet,
				],
			],
			'meta_query'     => [ // phpcs:ignore WordPress.DB.SlowDBQuery
				[
					'key'   => 'wp_template_part_area',
					'value' => $area,    // "header" or "footer"
				],
			],
		] );

		// Also try by slug if meta_query returned nothing
		if ( empty( $existing ) ) {
			$existing = get_posts( [
				'post_type'      => 'wp_template_part',
				'post_status'    => [ 'publish', 'draft' ],
				'posts_per_page' => 1,
				'name'           => $area,
				'tax_query'      => [ // phpcs:ignore WordPress.DB.SlowDBQuery
					[
						'taxonomy' => 'wp_theme',
						'field'    => 'name',
						'terms'    => [ $stylesheet, get_template() ],
					],
				],
			] );
		}

		if ( ! empty( $existing ) ) {
			$tp      = $existing[0];
			$content = $tp->post_content;
			$updated = self::replace_nav_ref_in_blocks( $content, $nav_post_id );

			if ( $updated !== $content ) {
				wp_update_post( [ 'ID' => $tp->ID, 'post_content' => $updated ] );
				return 'Updated existing template part (ID ' . $tp->ID . ')';
			}

			return 'Template part found but no navigation block to update.';
		}

		// 2) No customised post — read from theme file
		$theme_dirs = [ get_stylesheet_directory(), get_template_directory() ];
		$file_found = null;

		foreach ( $theme_dirs as $dir ) {
			foreach ( [ "parts/{$area}.html", "template-parts/{$area}.html" ] as $rel ) {
				$path = $dir . '/' . $rel;
				if ( file_exists( $path ) ) {
					$file_found = $path;
					break 2;
				}
			}
		}

		if ( ! $file_found ) {
			return "No template part found for area '{$area}'.";
		}

		$content = file_get_contents( $file_found ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		$updated = self::replace_nav_ref_in_blocks( $content, $nav_post_id );

		if ( $updated === $content ) {
			return "Template part file found but contains no navigation block.";
		}

		// Create a customised template part post
		$post_id = wp_insert_post( [
			'post_type'    => 'wp_template_part',
			'post_title'   => ucfirst( $area ),
			'post_name'    => $area,
			'post_content' => $updated,
			'post_status'  => 'publish',
		], true );

		if ( is_wp_error( $post_id ) ) {
			return 'Failed to create template part: ' . $post_id->get_error_message();
		}

		// Associate with current theme
		wp_set_object_terms( $post_id, $stylesheet, 'wp_theme' );

		// Set the area term (WP uses a flat 'wp_template_part_area' taxonomy
		// but also stores it as post meta — do both for compatibility)
		update_post_meta( $post_id, 'wp_template_part_area', $area );

		return 'Created customised template part from theme file (ID ' . $post_id . ')';
	}

	/**
	 * Walk a block tree (via parse_blocks / serialize_blocks)
	 * and replace the `ref` in the FIRST core/navigation block found.
	 *
	 * Returns the updated serialized content, or the original if nothing changed.
	 */
	private static function replace_nav_ref_in_blocks( string $content, int $nav_post_id ): string {
		$blocks  = parse_blocks( $content );
		$changed = false;

		self::walk_replace_nav( $blocks, $nav_post_id, $changed );

		if ( ! $changed ) {
			return $content;
		}

		return serialize_blocks( $blocks );
	}

	/**
	 * Recursive walk — sets `ref` on the first core/navigation block.
	 */
	private static function walk_replace_nav( array &$blocks, int $nav_post_id, bool &$changed ): void {
		foreach ( $blocks as &$block ) {
			if ( $changed ) return;

			if ( ( $block['blockName'] ?? '' ) === 'core/navigation' ) {
				$block['attrs']['ref'] = $nav_post_id;
				$changed = true;
				return;
			}

			if ( ! empty( $block['innerBlocks'] ) ) {
				self::walk_replace_nav( $block['innerBlocks'], $nav_post_id, $changed );
			}
		}
	}

	/* ═══════════════════════════════════════════════════════════
	 *  GLOBAL STYLES (colors + fonts → wp_global_styles CPT)
	 * ═══════════════════════════════════════════════════════════ */

	private static function build_global_styles( array $settings ): array {
		$c = $settings['colors'];
		$f = $settings['fonts'];

		return [
			'version'  => 3,
			'settings' => [
				'color' => [
					'palette' => [
						[ 'slug' => 'brand',       'color' => $c['brand'],       'name' => 'Brand'       ],
						[ 'slug' => 'accent',      'color' => $c['accent'],      'name' => 'Accent'      ],
						[ 'slug' => 'text',        'color' => $c['text'],        'name' => 'Text'        ],
						[ 'slug' => 'background',  'color' => $c['background'],  'name' => 'Background'  ],
						[ 'slug' => 'link',        'color' => $c['link'],        'name' => 'Link'        ],
						[ 'slug' => 'button',      'color' => $c['button'],      'name' => 'Button'      ],
						[ 'slug' => 'button-text', 'color' => $c['button_text'], 'name' => 'Button Text' ],
					],
				],
				'typography' => [
					'fontFamilies' => [
						[ 'slug' => 'heading', 'fontFamily' => self::font_stack( $f['heading'] ), 'name' => 'Heading' ],
						[ 'slug' => 'body',    'fontFamily' => self::font_stack( $f['body'] ),    'name' => 'Body'    ],
					],
				],
			],
			'styles' => [
				'color'      => [ 'background' => $c['background'], 'text' => $c['text'] ],
				'typography' => [ 'fontFamily' => 'var(--wp--preset--font-family--body)' ],
				'elements'   => [
					'link'    => [ 'color'      => [ 'text' => $c['link'] ] ],
					'button'  => [ 'color'      => [ 'background' => $c['button'], 'text' => $c['button_text'] ] ],
					'heading' => [ 'typography'  => [ 'fontFamily' => 'var(--wp--preset--font-family--heading)' ] ],
					'h1'      => [ 'typography'  => [ 'fontFamily' => 'var(--wp--preset--font-family--heading)' ] ],
					'h2'      => [ 'typography'  => [ 'fontFamily' => 'var(--wp--preset--font-family--heading)' ] ],
					'h3'      => [ 'typography'  => [ 'fontFamily' => 'var(--wp--preset--font-family--heading)' ] ],
				],
			],
		];
	}

	private static function write_global_styles( array $styles ) {
		$post_id = self::get_global_styles_post_id();
		$content = wp_json_encode( $styles, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );

		if ( $post_id ) {
			$existing = json_decode( get_post_field( 'post_content', $post_id ), true );
			if ( is_array( $existing ) ) {
				$content = wp_json_encode(
					self::deep_merge( $existing, $styles ),
					JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
				);
			}
			return wp_update_post( [ 'ID' => $post_id, 'post_content' => $content ], true );
		}

		$stylesheet = get_stylesheet();
		$result     = wp_insert_post( [
			'post_content' => $content,
			'post_status'  => 'publish',
			'post_title'   => 'Custom Styles',
			'post_type'    => 'wp_global_styles',
			'post_name'    => 'wp-global-styles-' . sanitize_title( $stylesheet ),
		], true );

		if ( ! is_wp_error( $result ) ) {
			wp_set_object_terms( $result, $stylesheet, 'wp_theme' );
		}
		return $result;
	}

	private static function get_global_styles_post_id(): ?int {
		if ( function_exists( 'wp_get_global_styles_custom_post_id' ) ) {
			$id = wp_get_global_styles_custom_post_id();
			return $id ?: null;
		}
		$posts = get_posts( [
			'post_type'      => 'wp_global_styles',
			'post_status'    => 'publish',
			'posts_per_page' => 1,
			'tax_query'      => [ // phpcs:ignore WordPress.DB.SlowDBQuery
				[ 'taxonomy' => 'wp_theme', 'field' => 'name', 'terms' => get_stylesheet() ],
			],
		] );
		return ! empty( $posts ) ? $posts[0]->ID : null;
	}

	private static function deep_merge( array $base, array $override ): array {
		foreach ( $override as $key => $value ) {
			if ( is_array( $value ) && isset( $base[ $key ] ) && is_array( $base[ $key ] ) ) {
				$base[ $key ] = array_is_list( $value ) ? $value : self::deep_merge( $base[ $key ], $value );
			} else {
				$base[ $key ] = $value;
			}
		}
		return $base;
	}

	private static function font_stack( string $font ): string {
		$stacks = [
			'system-ui'        => 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
			'Inter'            => '"Inter", system-ui, sans-serif',
			'DM Sans'          => '"DM Sans", system-ui, sans-serif',
			'Poppins'          => '"Poppins", system-ui, sans-serif',
			'Roboto'           => '"Roboto", system-ui, sans-serif',
			'Open Sans'        => '"Open Sans", system-ui, sans-serif',
			'Lato'             => '"Lato", system-ui, sans-serif',
			'Montserrat'       => '"Montserrat", system-ui, sans-serif',
			'Playfair Display' => '"Playfair Display", Georgia, serif',
			'Merriweather'     => '"Merriweather", Georgia, serif',
			'Lora'             => '"Lora", Georgia, serif',
			'Source Serif Pro' => '"Source Serif Pro", Georgia, serif',
			'Georgia'          => 'Georgia, "Times New Roman", serif',
			'JetBrains Mono'   => '"JetBrains Mono", "Fira Code", monospace',
			'Fira Code'        => '"Fira Code", "JetBrains Mono", monospace',
		];
		return $stacks[ $font ] ?? '"' . $font . '", system-ui, sans-serif';
	}

	/* ═══════════════════════════════════════════════════════════
	 *  VERSION HISTORY
	 * ═══════════════════════════════════════════════════════════ */

	private static function save_version_snapshot( array $settings ): void {
		$versions   = get_option( self::VERSIONS_KEY, [] );
		$versions[] = [
			'settings'   => $settings,
			'created_at' => current_time( 'mysql', true ),
			'user'       => wp_get_current_user()->user_login,
		];
		if ( count( $versions ) > self::MAX_VERSIONS ) {
			$versions = array_slice( $versions, -self::MAX_VERSIONS );
		}
		update_option( self::VERSIONS_KEY, $versions );
	}

	public static function get_versions(): WP_REST_Response {
		return blu_success( [ 'versions' => array_reverse( get_option( self::VERSIONS_KEY, [] ) ) ] );
	}

	public static function restore_version( WP_REST_Request $request ): WP_REST_Response {
		$index    = (int) $request->get_param( 'index' );
		$versions = array_reverse( get_option( self::VERSIONS_KEY, [] ) );

		if ( ! isset( $versions[ $index ] ) ) {
			return blu_error( 'Version not found.', 404 );
		}

		$snapshot = $versions[ $index ]['settings'];
		update_option( self::OPTION_KEY, $snapshot );

		return blu_success( [
			'message'  => 'Version restored. Publish to push changes live.',
			'settings' => $snapshot,
		] );
	}

	/* ═══════════════════════════════════════════════════════════
	 *  FONT CATALOG
	 * ═══════════════════════════════════════════════════════════ */

	public static function get_font_catalog(): WP_REST_Response {
		return blu_success( [ 'fonts' => [
			[ 'name' => 'system-ui',         'category' => 'sans-serif', 'label' => 'System Default'    ],
			[ 'name' => 'Inter',             'category' => 'sans-serif', 'label' => 'Inter'             ],
			[ 'name' => 'DM Sans',           'category' => 'sans-serif', 'label' => 'DM Sans'           ],
			[ 'name' => 'Poppins',           'category' => 'sans-serif', 'label' => 'Poppins'           ],
			[ 'name' => 'Roboto',            'category' => 'sans-serif', 'label' => 'Roboto'            ],
			[ 'name' => 'Open Sans',         'category' => 'sans-serif', 'label' => 'Open Sans'         ],
			[ 'name' => 'Lato',              'category' => 'sans-serif', 'label' => 'Lato'              ],
			[ 'name' => 'Montserrat',        'category' => 'sans-serif', 'label' => 'Montserrat'        ],
			[ 'name' => 'Playfair Display',  'category' => 'serif',      'label' => 'Playfair Display'  ],
			[ 'name' => 'Merriweather',      'category' => 'serif',      'label' => 'Merriweather'      ],
			[ 'name' => 'Lora',              'category' => 'serif',      'label' => 'Lora'              ],
			[ 'name' => 'Source Serif Pro',  'category' => 'serif',      'label' => 'Source Serif Pro'  ],
			[ 'name' => 'Georgia',           'category' => 'serif',      'label' => 'Georgia'           ],
			[ 'name' => 'JetBrains Mono',   'category' => 'monospace',  'label' => 'JetBrains Mono'    ],
			[ 'name' => 'Fira Code',         'category' => 'monospace',  'label' => 'Fira Code'         ],
		] ] );
	}
}
