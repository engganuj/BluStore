<?php
/**
 * Blu Store – WP Admin Page
 *
 * Registers the admin menu item and renders the shell <div>
 * that React mounts into. Enqueues the compiled wp-scripts bundle
 * from /admin/build/.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_Admin {

	/**
	 * Hook into WordPress.
	 */
	public static function init(): void {
		add_action( 'admin_menu', [ __CLASS__, 'register_menu' ] );
		add_filter( 'admin_body_class', [ __CLASS__, 'body_class' ] );
		add_action( 'admin_head', [ __CLASS__, 'fullscreen_html_fix' ] );
	}

	/**
	 * Add a body class on our plugin pages so CSS can scope the takeover.
	 */
	public static function body_class( string $classes ): string {
		$screen = get_current_screen();
		if ( $screen && 'toplevel_page_blu-store' === $screen->id ) {
			$classes .= ' blu-fullscreen';
		}
		return $classes;
	}

	/**
	 * Remove the 32 px toolbar padding from <html> on our plugin page.
	 * (The body-class approach can't target the html element.)
	 */
	public static function fullscreen_html_fix(): void {
		$screen = get_current_screen();
		if ( $screen && 'toplevel_page_blu-store' === $screen->id ) {
			echo '<style>html.wp-toolbar{padding-top:0!important}</style>';
		}
	}

	/**
	 * Register a top-level WP-Admin menu item.
	 */
	public static function register_menu(): void {
		add_menu_page(
			esc_html__( 'Blu Store', 'blu-store' ),
			esc_html__( 'Blu Store', 'blu-store' ),
			'manage_options',
			'blu-store',
			[ __CLASS__, 'render_page' ],
			'dashicons-store',
			56
		);
	}

	/**
	 * Render the SPA shell and enqueue the React bundle.
	 */
	public static function render_page(): void {
		$build_dir = BLU_PLUGIN_DIR . 'admin/build/';
		$build_url = BLU_PLUGIN_URL . 'admin/build/';
		$asset_file = $build_dir . 'blu-admin.asset.php';

		if ( file_exists( $asset_file ) ) {
			$asset = require $asset_file;
		} else {
			$asset = [ 'dependencies' => [], 'version' => BLU_VERSION ];
		}

		// Enqueue WP media picker for logo upload
		wp_enqueue_media();

		wp_enqueue_style(
			'blu-admin-css',
			$build_url . 'blu-admin.css',
			[ 'wp-components' ],
			$asset['version']
		);

		wp_enqueue_script(
			'blu-admin-js',
			$build_url . 'blu-admin.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		$current_user = wp_get_current_user();
		wp_localize_script( 'blu-admin-js', 'bluSettings', [
			'nonce'    => wp_create_nonce( 'wp_rest' ),
			'restUrl'  => esc_url_raw( rest_url( 'blu/v1' ) ),
			'siteUrl'  => esc_url_raw( site_url() ),
			'version'  => BLU_VERSION,
			'theme'    => get_stylesheet(),
			'userName' => $current_user->first_name ?: $current_user->display_name ?: $current_user->user_login,
		] );

		// Remove WP admin notices inside the SPA shell
		remove_all_actions( 'admin_notices' );
		remove_all_actions( 'all_admin_notices' );

		echo '<div id="blu-root"></div>';
	}
}
