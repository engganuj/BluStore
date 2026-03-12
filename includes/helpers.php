<?php
/**
 * Blu Store – shared helpers
 */

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Return the demo merchant UUID (single-tenant for now).
 */
function blu_merchant_id(): string {
    return '00000000-0000-0000-0000-000000000001';
}

/**
 * Generate a v4 UUID.
 */
function blu_uuid(): string {
    $data    = random_bytes( 16 );
    $data[6] = chr( ord( $data[6] ) & 0x0f | 0x40 ); // version 4
    $data[8] = chr( ord( $data[8] ) & 0x3f | 0x80 ); // variant RFC 4122
    return vsprintf( '%s%s-%s-%s-%s-%s%s%s', str_split( bin2hex( $data ), 4 ) );
}

/**
 * Generate a prefixed ID.
 */
function blu_prefixed_id( string $prefix ): string {
    return $prefix . '_' . bin2hex( random_bytes( 12 ) );
}

/**
 * Generate a URL-safe slug from a product name.
 */
function blu_slugify( string $text ): string {
    $text = strtolower( trim( $text ) );
    $text = preg_replace( '/[^a-z0-9]+/', '-', $text );
    $text = trim( $text, '-' );
    return substr( $text, 0, 255 );
}

/**
 * Safely convert an empty-string / null to null for numeric DB columns.
 */
function blu_to_numeric_or_null( $val ) {
    if ( $val === '' || $val === null ) return null;
    $num = floatval( $val );
    return is_nan( $num ) ? null : $num;
}

/**
 * Return the Blu Store custom table name (with WP prefix).
 */
function blu_table( string $short_name ): string {
    global $wpdb;
    return $wpdb->prefix . 'blu_' . $short_name;
}

/**
 * Return a success REST response.
 */
function blu_success( $data = [], int $status = 200 ): WP_REST_Response {
    return new WP_REST_Response( $data, $status );
}

/**
 * Return an error REST response.
 */
function blu_error( string $message, int $status = 400 ): WP_Error {
    return new WP_Error( 'blu_error', $message, [ 'status' => $status ] );
}
