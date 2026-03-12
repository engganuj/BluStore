<?php
/**
 * Blu Store – Database helper
 *
 * Thin wrapper around $wpdb that mirrors the query( $text, $params ) pattern
 * from the Node.js pg driver, making route conversion easier.
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_DB {

    /**
     * Run a SELECT and return rows (array of objects).
     */
    public static function get_results( string $sql, array $params = [] ): array {
        global $wpdb;
        if ( ! empty( $params ) ) {
            $sql = $wpdb->prepare( $sql, ...$params );
        }
        return $wpdb->get_results( $sql );
    }

    /**
     * Run a SELECT and return a single row (object or null).
     */
    public static function get_row( string $sql, array $params = [] ) {
        global $wpdb;
        if ( ! empty( $params ) ) {
            $sql = $wpdb->prepare( $sql, ...$params );
        }
        return $wpdb->get_row( $sql );
    }

    /**
     * Run a SELECT and return a single value (scalar).
     */
    public static function get_var( string $sql, array $params = [] ) {
        global $wpdb;
        if ( ! empty( $params ) ) {
            $sql = $wpdb->prepare( $sql, ...$params );
        }
        return $wpdb->get_var( $sql );
    }

    /**
     * Run a SELECT and return a single column (array of scalars).
     */
    public static function get_col( string $sql, array $params = [] ): array {
        global $wpdb;
        if ( ! empty( $params ) ) {
            $sql = $wpdb->prepare( $sql, ...$params );
        }
        return $wpdb->get_col( $sql );
    }

    /**
     * Run an INSERT/UPDATE/DELETE and return rows affected.
     */
    public static function query( string $sql, array $params = [] ): int {
        global $wpdb;
        if ( ! empty( $params ) ) {
            $sql = $wpdb->prepare( $sql, ...$params );
        }
        return (int) $wpdb->query( $sql );
    }

    /**
     * Convenience INSERT using $wpdb->insert().
     */
    public static function insert( string $table, array $data ) {
        global $wpdb;
        return $wpdb->insert( $table, $data );
    }

    /**
     * Convenience UPDATE using $wpdb->update().
     */
    public static function update( string $table, array $data, array $where ) {
        global $wpdb;
        return $wpdb->update( $table, $data, $where );
    }

    /**
     * Convenience DELETE using $wpdb->delete().
     */
    public static function delete( string $table, array $where ) {
        global $wpdb;
        return $wpdb->delete( $table, $where );
    }

    /**
     * Start transaction.
     */
    public static function begin(): void {
        global $wpdb;
        $wpdb->query( 'START TRANSACTION' );
    }

    /**
     * Commit transaction.
     */
    public static function commit(): void {
        global $wpdb;
        $wpdb->query( 'COMMIT' );
    }

    /**
     * Rollback transaction.
     */
    public static function rollback(): void {
        global $wpdb;
        $wpdb->query( 'ROLLBACK' );
    }

    /**
     * Get the next order number.
     */
    public static function next_order_number(): string {
        global $wpdb;
        $t = blu_table( 'order_number_seq' );

        $wpdb->query( "UPDATE {$t} SET next_val = LAST_INSERT_ID(next_val), next_val = next_val + 1" );
        $val = $wpdb->get_var( 'SELECT LAST_INSERT_ID()' );

        return 'ORD-' . str_pad( $val, 6, '0', STR_PAD_LEFT );
    }
}
