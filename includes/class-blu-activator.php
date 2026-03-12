<?php
/**
 * Blu Store – Activation & DB Schema
 *
 * Converts the entire PostgreSQL schema (17 migrations) into MySQL
 * using the WordPress dbDelta() pattern.
 *
 * Key conversions:
 *  - UUID → CHAR(36)  (stored as lowercase hex-dash)
 *  - JSONB / JSON → JSON (MySQL 5.7+)
 *  - TEXT[] → JSON     (arrays stored as JSON)
 *  - TIMESTAMPTZ → DATETIME (stored as UTC)
 *  - SERIAL / sequence → AUTO_INCREMENT via auxiliary table
 *  - BOOLEAN → TINYINT(1)
 *  - DECIMAL stays DECIMAL
 *  - gen_random_uuid() → PHP blu_uuid()
 *  - Triggers → handled in PHP application layer
 */

if ( ! defined( 'ABSPATH' ) ) exit;

class Blu_Activator {

    public static function activate(): void {
        self::create_tables();
        self::maybe_upgrade();
        self::seed_demo_data();
        flush_rewrite_rules();
    }

    public static function deactivate(): void {
        flush_rewrite_rules();
    }

    /**
     * Run any necessary schema upgrades for existing installs.
     */
    public static function maybe_upgrade(): void {
        global $wpdb;
        $p = $wpdb->prefix . 'blu_';

        // Add woo_product_id if missing
        $col = $wpdb->get_results( "SHOW COLUMNS FROM {$p}products LIKE 'woo_product_id'" );
        if ( empty( $col ) ) {
            $wpdb->query( "ALTER TABLE {$p}products ADD COLUMN woo_product_id BIGINT UNSIGNED DEFAULT NULL AFTER stripe_sync_enabled" );
            $wpdb->query( "ALTER TABLE {$p}products ADD KEY idx_products_woo_id (woo_product_id)" );
        }

        // Add woo_order_id if missing
        $col = $wpdb->get_results( "SHOW COLUMNS FROM {$p}orders LIKE 'woo_order_id'" );
        if ( empty( $col ) ) {
            $wpdb->query( "ALTER TABLE {$p}orders ADD COLUMN woo_order_id BIGINT UNSIGNED DEFAULT NULL AFTER paid_at" );
            $wpdb->query( "ALTER TABLE {$p}orders ADD KEY idx_orders_woo_id (woo_order_id)" );
        }

        // Create abandoned cart tables if missing (added in 1.2.0)
        $table_exists = $wpdb->get_var( "SHOW TABLES LIKE '{$p}abandoned_carts'" );
        if ( ! $table_exists ) {
            self::create_tables();
        }

        update_option( 'blu_db_version', '1.2.0' );
    }

    /* ───────────────────────────────────────────── */
    /*  TABLE CREATION                               */
    /* ───────────────────────────────────────────── */
    public static function create_tables(): void {
        global $wpdb;
        $charset = $wpdb->get_charset_collate();
        $p       = $wpdb->prefix . 'blu_';

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        /* ── merchants ── */
        dbDelta( "CREATE TABLE {$p}merchants (
            id CHAR(36) NOT NULL,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            plan VARCHAR(50) DEFAULT 'starter',
            conflict_resolution_strategy VARCHAR(50) DEFAULT 'last_write_wins',
            logo_url TEXT,
            tagline VARCHAR(500),
            support_email VARCHAR(255),
            website_url TEXT,
            currency VARCHAR(3) DEFAULT 'USD',
            address_line1 VARCHAR(255),
            address_line2 VARCHAR(255),
            city VARCHAR(100),
            state VARCHAR(100),
            postal_code VARCHAR(20),
            country VARCHAR(2) DEFAULT 'US',
            phone VARCHAR(50),
            pdp_template VARCHAR(100) DEFAULT 'modern',
            stripe_account_id VARCHAR(255),
            stripe_onboarding_complete TINYINT(1) DEFAULT 0,
            stripe_connected_at DATETIME,
            stripe_product_sync_enabled TINYINT(1) DEFAULT 0,
            stripe_webhook_secret VARCHAR(255),
            ucp_enabled TINYINT(1) DEFAULT 0,
            ucp_profile JSON,
            terms_url TEXT,
            privacy_url TEXT,
            refund_policy_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY slug (slug),
            UNIQUE KEY email (email)
        ) {$charset};" );

        /* ── users ── */
        dbDelta( "CREATE TABLE {$p}users (
            id CHAR(36) NOT NULL,
            email VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY email (email)
        ) {$charset};" );

        /* ── platform_adapters ── */
        dbDelta( "CREATE TABLE {$p}platform_adapters (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            platform_type VARCHAR(50) NOT NULL,
            platform_name VARCHAR(255),
            config JSON NOT NULL,
            webhook_url TEXT,
            status VARCHAR(50) DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY merchant_id (merchant_id)
        ) {$charset};" );

        /* ── products ── */
        dbDelta( "CREATE TABLE {$p}products (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            sku VARCHAR(255),
            slug VARCHAR(255),
            name VARCHAR(500) NOT NULL,
            description TEXT,
            short_description TEXT,
            price DECIMAL(12,2) NOT NULL DEFAULT 0,
            compare_at_price DECIMAL(12,2),
            cost DECIMAL(12,2),
            inventory_qty INT DEFAULT 0,
            track_inventory TINYINT(1) DEFAULT 1,
            status VARCHAR(50) DEFAULT 'draft',
            product_type VARCHAR(50) DEFAULT 'simple',
            tags JSON,
            categories JSON,
            images JSON,
            weight DECIMAL(10,2),
            dimensions JSON,
            metadata JSON,
            has_variants TINYINT(1) DEFAULT 0,
            variant_option_names JSON,
            stripe_product_id VARCHAR(255),
            stripe_price_id VARCHAR(255),
            stripe_sync_status VARCHAR(50) DEFAULT 'pending',
            stripe_last_synced_at DATETIME,
            stripe_sync_enabled TINYINT(1) DEFAULT 1,
            woo_product_id BIGINT UNSIGNED,
            version INT DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_products_merchant (merchant_id),
            KEY idx_products_sku (sku),
            KEY idx_products_status (status),
            KEY idx_products_slug (merchant_id, slug),
            KEY idx_products_stripe_product_id (stripe_product_id),
            KEY idx_products_stripe_price_id (stripe_price_id),
            KEY idx_products_woo_id (woo_product_id)
        ) {$charset};" );

        /* ── product_platform_mappings ── */
        dbDelta( "CREATE TABLE {$p}product_platform_mappings (
            id CHAR(36) NOT NULL,
            product_id CHAR(36) NOT NULL,
            platform_adapter_id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            platform_id VARCHAR(255) NOT NULL,
            platform_url TEXT,
            sync_status VARCHAR(50) DEFAULT 'pending',
            last_synced_at DATETIME,
            last_blu_update_at DATETIME,
            last_platform_update_at DATETIME,
            conflict_detected TINYINT(1) DEFAULT 0,
            conflict_fields JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_product_platform (product_id, platform_adapter_id),
            KEY idx_mappings_product (product_id),
            KEY idx_mappings_adapter (platform_adapter_id)
        ) {$charset};" );

        /* ── sync_events ── */
        dbDelta( "CREATE TABLE {$p}sync_events (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id CHAR(36),
            platform_adapter_id CHAR(36),
            event_type VARCHAR(100) NOT NULL,
            status VARCHAR(50) NOT NULL,
            full_snapshot JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_sync_events_merchant (merchant_id)
        ) {$charset};" );

        /* ── orders ── */
        dbDelta( "CREATE TABLE {$p}orders (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            order_number VARCHAR(50),
            stripe_session_id VARCHAR(255),
            stripe_payment_intent VARCHAR(255),
            stripe_customer_id VARCHAR(255),
            status VARCHAR(50) DEFAULT 'pending',
            customer_email VARCHAR(255),
            customer_name VARCHAR(255),
            customer_id CHAR(36),
            shipping_address JSON,
            subtotal_cents INT NOT NULL DEFAULT 0,
            shipping_cents INT DEFAULT 0,
            tax_cents INT DEFAULT 0,
            total_cents INT NOT NULL DEFAULT 0,
            currency VARCHAR(3) DEFAULT 'usd',
            shipping_carrier VARCHAR(100),
            tracking_number VARCHAR(255),
            tracking_url TEXT,
            shipped_at DATETIME,
            shipping_option_id CHAR(36),
            shipping_option_name VARCHAR(255),
            paid_at DATETIME,
            woo_order_id BIGINT UNSIGNED,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY stripe_session_id (stripe_session_id),
            KEY idx_orders_merchant (merchant_id),
            KEY idx_orders_status (status),
            KEY idx_orders_created (created_at),
            KEY idx_orders_customer (customer_id),
            KEY idx_orders_woo_id (woo_order_id)
        ) {$charset};" );

        /* ── order_items ── */
        dbDelta( "CREATE TABLE {$p}order_items (
            id CHAR(36) NOT NULL,
            order_id CHAR(36) NOT NULL,
            product_id CHAR(36),
            variant_id CHAR(36),
            product_name VARCHAR(500) NOT NULL,
            product_sku VARCHAR(255),
            product_image TEXT,
            options JSON,
            variant_options VARCHAR(255),
            unit_price_cents INT NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            total_cents INT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_order_items_order (order_id)
        ) {$charset};" );

        /* ── order_events (timeline + notes) ── */
        dbDelta( "CREATE TABLE {$p}order_events (
            id CHAR(36) NOT NULL,
            order_id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            event_type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            detail TEXT,
            meta JSON,
            actor VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_order_events_order (order_id),
            KEY idx_order_events_created (created_at)
        ) {$charset};" );

        /* ── order_number_seq ── */
        dbDelta( "CREATE TABLE {$p}order_number_seq (
            next_val INT UNSIGNED NOT NULL DEFAULT 1001
        ) {$charset};" );

        /* ── shipping_options ── */
        dbDelta( "CREATE TABLE {$p}shipping_options (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            price_cents INT NOT NULL DEFAULT 0,
            min_days INT,
            max_days INT,
            free_shipping_threshold_cents INT,
            is_default TINYINT(1) DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            sort_order INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_shipping_merchant (merchant_id),
            KEY idx_shipping_active (merchant_id, is_active)
        ) {$charset};" );

        /* ── customers ── */
        dbDelta( "CREATE TABLE {$p}customers (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            email VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            phone VARCHAR(50),
            address_line1 VARCHAR(255),
            address_line2 VARCHAR(255),
            city VARCHAR(100),
            state VARCHAR(100),
            postal_code VARCHAR(20),
            country VARCHAR(2) DEFAULT 'US',
            order_count INT DEFAULT 0,
            total_spent_cents BIGINT DEFAULT 0,
            last_order_at DATETIME,
            notes TEXT,
            tags JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_merchant_email (merchant_id, email),
            KEY idx_customers_merchant (merchant_id),
            KEY idx_customers_email (email)
        ) {$charset};" );

        /* ── product_options ── */
        dbDelta( "CREATE TABLE {$p}product_options (
            id CHAR(36) NOT NULL,
            product_id CHAR(36) NOT NULL,
            name VARCHAR(100) NOT NULL,
            position INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_product_options_product (product_id)
        ) {$charset};" );

        /* ── product_option_values ── */
        dbDelta( "CREATE TABLE {$p}product_option_values (
            id CHAR(36) NOT NULL,
            option_id CHAR(36) NOT NULL,
            value VARCHAR(100) NOT NULL,
            position INT DEFAULT 0,
            color_hex VARCHAR(7),
            image_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_option_values_option (option_id)
        ) {$charset};" );

        /* ── product_variants ── */
        dbDelta( "CREATE TABLE {$p}product_variants (
            id CHAR(36) NOT NULL,
            product_id CHAR(36) NOT NULL,
            sku VARCHAR(100),
            barcode VARCHAR(100),
            price DECIMAL(10,2),
            compare_at_price DECIMAL(10,2),
            cost_price DECIMAL(10,2),
            inventory_qty INT DEFAULT 0,
            track_inventory TINYINT(1) DEFAULT 1,
            allow_backorder TINYINT(1) DEFAULT 0,
            low_stock_threshold INT DEFAULT 5,
            weight DECIMAL(10,3),
            weight_unit VARCHAR(10) DEFAULT 'lb',
            is_active TINYINT(1) DEFAULT 1,
            option_value_ids JSON,
            option_values_display VARCHAR(255),
            image_url TEXT,
            position INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_variants_product (product_id),
            KEY idx_variants_sku (sku),
            KEY idx_variants_active (product_id, is_active)
        ) {$charset};" );

        /* ── categories ── */
        dbDelta( "CREATE TABLE {$p}categories (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            parent_id CHAR(36),
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_merchant_slug (merchant_id, slug),
            KEY idx_categories_merchant (merchant_id),
            KEY idx_categories_parent (parent_id)
        ) {$charset};" );

        /* ── product_categories (M2M) ── */
        dbDelta( "CREATE TABLE {$p}product_categories (
            product_id CHAR(36) NOT NULL,
            category_id CHAR(36) NOT NULL,
            PRIMARY KEY (product_id, category_id)
        ) {$charset};" );

        /* ── tags ── */
        dbDelta( "CREATE TABLE {$p}tags (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(100) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_merchant_slug (merchant_id, slug),
            KEY idx_tags_merchant (merchant_id)
        ) {$charset};" );

        /* ── product_tags (M2M) ── */
        dbDelta( "CREATE TABLE {$p}product_tags (
            product_id CHAR(36) NOT NULL,
            tag_id CHAR(36) NOT NULL,
            PRIMARY KEY (product_id, tag_id)
        ) {$charset};" );

        /* ── product_images ── */
        dbDelta( "CREATE TABLE {$p}product_images (
            id CHAR(36) NOT NULL,
            product_id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            url TEXT NOT NULL,
            alt_text VARCHAR(255),
            position INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_product_images_product (product_id)
        ) {$charset};" );

        /* ── platforms (lookup) ── */
        dbDelta( "CREATE TABLE {$p}platforms (
            id CHAR(36) NOT NULL,
            name VARCHAR(100) NOT NULL,
            code VARCHAR(50) NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY code (code)
        ) {$charset};" );

        /* ── webhook_deliveries ── */
        dbDelta( "CREATE TABLE {$p}webhook_deliveries (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            platform_adapter_id CHAR(36) NOT NULL,
            event_type VARCHAR(50) NOT NULL,
            payload JSON NOT NULL,
            response_status INT,
            response_body TEXT,
            delivered_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_wh_merchant (merchant_id),
            KEY idx_wh_adapter (platform_adapter_id),
            KEY idx_wh_event (event_type)
        ) {$charset};" );

        /* ── ucp_sessions ── */
        dbDelta( "CREATE TABLE {$p}ucp_sessions (
            id VARCHAR(64) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            currency VARCHAR(3) NOT NULL DEFAULT 'USD',
            buyer_email VARCHAR(255),
            buyer_first_name VARCHAR(100),
            buyer_last_name VARCHAR(100),
            buyer_phone VARCHAR(50),
            line_items JSON,
            subtotal_cents INT NOT NULL DEFAULT 0,
            tax_cents INT NOT NULL DEFAULT 0,
            shipping_cents INT NOT NULL DEFAULT 0,
            discount_cents INT NOT NULL DEFAULT 0,
            total_cents INT NOT NULL DEFAULT 0,
            fulfillment JSON,
            payment_status VARCHAR(32) DEFAULT 'pending',
            payment_handler VARCHAR(64),
            payment_reference VARCHAR(255),
            discount_code VARCHAR(64),
            discount_details JSON,
            order_id CHAR(36),
            platform_id VARCHAR(255),
            platform_session_id VARCHAR(255),
            expires_at DATETIME,
            completed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_ucp_merchant (merchant_id),
            KEY idx_ucp_status (status),
            KEY idx_ucp_platform (platform_id)
        ) {$charset};" );

        /* ── ucp_identity_links ── */
        dbDelta( "CREATE TABLE {$p}ucp_identity_links (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            platform_id VARCHAR(255) NOT NULL,
            platform_user_id VARCHAR(255),
            access_token TEXT,
            refresh_token TEXT,
            token_type VARCHAR(32) DEFAULT 'Bearer',
            scope TEXT,
            expires_at DATETIME,
            customer_id CHAR(36),
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_ucp_il_merchant (merchant_id),
            KEY idx_ucp_il_platform (platform_id, platform_user_id)
        ) {$charset};" );

        /* ── ucp_webhook_subscriptions ── */
        dbDelta( "CREATE TABLE {$p}ucp_webhook_subscriptions (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            platform_id VARCHAR(255) NOT NULL,
            webhook_url TEXT NOT NULL,
            events JSON,
            secret VARCHAR(255),
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            failure_count INT DEFAULT 0,
            last_failure_at DATETIME,
            last_success_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_ucp_ws_merchant (merchant_id),
            KEY idx_ucp_ws_platform (platform_id)
        ) {$charset};" );

        /* ── ucp_webhook_deliveries ── */
        dbDelta( "CREATE TABLE {$p}ucp_webhook_deliveries (
            id CHAR(36) NOT NULL,
            subscription_id CHAR(36) NOT NULL,
            event_type VARCHAR(64) NOT NULL,
            payload JSON NOT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            attempts INT DEFAULT 0,
            last_attempt_at DATETIME,
            response_status INT,
            response_body TEXT,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_ucp_wd_sub (subscription_id),
            KEY idx_ucp_wd_status (status)
        ) {$charset};" );

        /* ── channels ── */
        dbDelta( "CREATE TABLE {$p}channels (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            type VARCHAR(50) NOT NULL,
            name VARCHAR(255) NOT NULL,
            credentials JSON,
            config JSON,
            status VARCHAR(32) DEFAULT 'pending',
            last_error TEXT,
            auto_sync TINYINT(1) DEFAULT 1,
            sync_interval_minutes INT DEFAULT 60,
            last_sync_at DATETIME,
            next_sync_at DATETIME,
            products_synced INT DEFAULT 0,
            products_approved INT DEFAULT 0,
            products_pending INT DEFAULT 0,
            products_disapproved INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_merchant_type (merchant_id, type),
            KEY idx_channels_merchant (merchant_id),
            KEY idx_channels_type (type),
            KEY idx_channels_status (status)
        ) {$charset};" );

        /* ── channel_products ── */
        dbDelta( "CREATE TABLE {$p}channel_products (
            id CHAR(36) NOT NULL,
            channel_id CHAR(36) NOT NULL,
            product_id CHAR(36) NOT NULL,
            external_id VARCHAR(255),
            external_url TEXT,
            sync_status VARCHAR(32) DEFAULT 'pending',
            last_sync_at DATETIME,
            last_error TEXT,
            approval_status VARCHAR(32),
            disapproval_reasons JSON,
            overrides JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_channel_product (channel_id, product_id),
            KEY idx_cp_channel (channel_id),
            KEY idx_cp_product (product_id),
            KEY idx_cp_status (sync_status)
        ) {$charset};" );

        /* ── channel_sync_logs ── */
        dbDelta( "CREATE TABLE {$p}channel_sync_logs (
            id CHAR(36) NOT NULL,
            channel_id CHAR(36) NOT NULL,
            sync_type VARCHAR(32) NOT NULL,
            status VARCHAR(32) NOT NULL,
            products_processed INT DEFAULT 0,
            products_created INT DEFAULT 0,
            products_updated INT DEFAULT 0,
            products_deleted INT DEFAULT 0,
            products_failed INT DEFAULT 0,
            errors JSON,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            duration_ms INT,
            PRIMARY KEY (id),
            KEY idx_csl_channel (channel_id),
            KEY idx_csl_started (started_at)
        ) {$charset};" );

        /* ── category_mappings ── */
        dbDelta( "CREATE TABLE {$p}category_mappings (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            source_category VARCHAR(255) NOT NULL,
            channel_type VARCHAR(50) NOT NULL,
            target_category_id VARCHAR(255),
            target_category_name TEXT,
            is_manual TINYINT(1) DEFAULT 0,
            confidence_score DECIMAL(3,2),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_cm_merchant (merchant_id),
            KEY idx_cm_source (source_category)
        ) {$charset};" );

        /* ── discounts ── */
        dbDelta( "CREATE TABLE {$p}discounts (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            code VARCHAR(50) NOT NULL,
            description TEXT,
            type VARCHAR(20) NOT NULL DEFAULT 'percentage',
            value DECIMAL(10,2) NOT NULL DEFAULT 0,
            minimum_order_amount DECIMAL(10,2),
            maximum_discount_amount DECIMAL(10,2),
            usage_limit INT,
            usage_count INT DEFAULT 0,
            usage_limit_per_customer INT,
            starts_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,
            status VARCHAR(20) DEFAULT 'active',
            applies_to_products JSON,
            applies_to_categories JSON,
            excluded_products JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_discounts_merchant (merchant_id),
            KEY idx_discounts_code (code),
            KEY idx_discounts_status (status)
        ) {$charset};" );

        /* ── discount_usages ── */
        dbDelta( "CREATE TABLE {$p}discount_usages (
            id CHAR(36) NOT NULL,
            discount_id CHAR(36) NOT NULL,
            order_id CHAR(36),
            customer_email VARCHAR(255),
            customer_id CHAR(36),
            discount_amount DECIMAL(10,2) NOT NULL,
            order_subtotal DECIMAL(10,2),
            applied_via VARCHAR(50),
            agent_platform VARCHAR(100),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_du_discount (discount_id),
            KEY idx_du_customer (customer_email),
            KEY idx_du_order (order_id)
        ) {$charset};" );

        /* ── stripe_sync_events ── */
        dbDelta( "CREATE TABLE {$p}stripe_sync_events (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36),
            product_id CHAR(36),
            event_type VARCHAR(100) NOT NULL,
            direction VARCHAR(20) NOT NULL,
            stripe_event_id VARCHAR(255),
            status VARCHAR(50) NOT NULL,
            error_message TEXT,
            payload JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_sse_product (product_id),
            KEY idx_sse_merchant (merchant_id)
        ) {$charset};" );

        /* ── abandoned_carts ── */
        dbDelta( "CREATE TABLE {$p}abandoned_carts (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            session_id VARCHAR(64),
            customer_email VARCHAR(255),
            customer_name VARCHAR(255),
            customer_id CHAR(36),
            cart_contents JSON,
            cart_total_cents BIGINT DEFAULT 0,
            currency VARCHAR(3) DEFAULT 'USD',
            recovery_token VARCHAR(64),
            status VARCHAR(32) DEFAULT 'active',
            emails_sent INT DEFAULT 0,
            last_email_sent_at DATETIME,
            email1_sent_at DATETIME,
            email2_sent_at DATETIME,
            email3_sent_at DATETIME,
            email1_opened_at DATETIME,
            email2_opened_at DATETIME,
            email3_opened_at DATETIME,
            email1_clicked_at DATETIME,
            email2_clicked_at DATETIME,
            email3_clicked_at DATETIME,
            recovered_at DATETIME,
            discount_code VARCHAR(64),
            recovered_order_id CHAR(36),
            ip_address VARCHAR(45),
            user_agent TEXT,
            abandoned_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY idx_ac_token (recovery_token),
            KEY idx_ac_merchant (merchant_id),
            KEY idx_ac_email (customer_email),
            KEY idx_ac_status (status),
            KEY idx_ac_session (session_id),
            KEY idx_ac_abandoned (abandoned_at)
        ) {$charset};" );

        /* ── abandoned_cart_settings ── */
        dbDelta( "CREATE TABLE {$p}abandoned_cart_settings (
            id CHAR(36) NOT NULL,
            merchant_id CHAR(36) NOT NULL,
            enabled TINYINT(1) DEFAULT 1,
            abandonment_timeout INT DEFAULT 60,
            email1_enabled TINYINT(1) DEFAULT 1,
            email1_delay INT DEFAULT 60,
            email1_subject VARCHAR(255) DEFAULT 'You left something behind',
            email2_enabled TINYINT(1) DEFAULT 1,
            email2_delay INT DEFAULT 1440,
            email2_subject VARCHAR(255) DEFAULT 'Still thinking it over?',
            email2_discount_pct INT DEFAULT 10,
            email3_enabled TINYINT(1) DEFAULT 1,
            email3_delay INT DEFAULT 4320,
            email3_subject VARCHAR(255) DEFAULT 'Last chance — your cart is expiring',
            email3_discount_pct INT DEFAULT 15,
            cart_expiry_days INT DEFAULT 30,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY idx_acs_merchant (merchant_id)
        ) {$charset};" );

        // Store schema version
        update_option( 'blu_db_version', BLU_VERSION );
    }

    /* ───────────────────────────────────────────── */
    /*  SEED DATA                                    */
    /* ───────────────────────────────────────────── */
    public static function seed_demo_data(): void {
        global $wpdb;
        $p = $wpdb->prefix . 'blu_';

        // Only seed if merchants table is empty
        $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$p}merchants" );
        if ( $count > 0 ) return;

        $merchant_id = blu_merchant_id();

        // Demo merchant
        $wpdb->insert( "{$p}merchants", [
            'id'            => $merchant_id,
            'name'          => 'Demo Store',
            'slug'          => 'demo-store',
            'email'         => 'demo@blu.store',
            'tagline'       => 'Your one-stop shop for quality products',
            'support_email' => 'support@demo-store.com',
        ] );

        // Demo user (password: "password")
        $wpdb->insert( "{$p}users", [
            'id'            => '00000000-0000-0000-0000-000000000002',
            'email'         => 'demo@blu.store',
            'password_hash' => '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
            'name'          => 'Demo User',
        ] );

        // Order number sequence
        $wpdb->insert( "{$p}order_number_seq", [ 'next_val' => 1001 ] );

        // Platforms
        foreach ( [
            [ 'WooCommerce', 'woocommerce', 'WordPress e-commerce platform' ],
            [ 'Shopify',     'shopify',     'Cloud-based e-commerce platform' ],
        ] as $row ) {
            $wpdb->insert( "{$p}platforms", [
                'id'          => blu_uuid(),
                'name'        => $row[0],
                'code'        => $row[1],
                'description' => $row[2],
            ] );
        }

        // Shipping options
        foreach ( [
            [ 'Standard Shipping', 'Delivered in 5-7 business days', 599, 5, 7, 1, 0, null ],
            [ 'Express Shipping',  'Delivered in 2-3 business days', 1299, 2, 3, 0, 1, null ],
            [ 'Free Shipping',     'Orders over $50 ship free (5-7 days)', 0, 5, 7, 0, 2, 5000 ],
        ] as $row ) {
            $wpdb->insert( "{$p}shipping_options", [
                'id'                          => blu_uuid(),
                'merchant_id'                 => $merchant_id,
                'name'                        => $row[0],
                'description'                 => $row[1],
                'price_cents'                 => $row[2],
                'min_days'                    => $row[3],
                'max_days'                    => $row[4],
                'is_default'                  => $row[5],
                'sort_order'                  => $row[6],
                'free_shipping_threshold_cents'=> $row[7],
            ] );
        }

        // Demo discounts
        foreach ( [
            [ 'SAVE10',     '10% off your order',          'percentage', 10, 25,   null, null, '2026-12-31 23:59:59' ],
            [ 'WELCOME20',  '20% off for new customers',   'percentage', 20, 50,   null, 100,  '2026-06-30 23:59:59' ],
            [ 'FLAT15',     '$15 off orders over $100',     'fixed_amount', 15, 100, null, null, '2026-12-31 23:59:59' ],
            [ 'FREESHIP',   'Free shipping on any order',   'free_shipping', 0, null, null, null, '2026-12-31 23:59:59' ],
        ] as $row ) {
            $wpdb->insert( "{$p}discounts", [
                'id'                   => blu_uuid(),
                'merchant_id'          => $merchant_id,
                'code'                 => $row[0],
                'description'          => $row[1],
                'type'                 => $row[2],
                'value'                => $row[3],
                'minimum_order_amount' => $row[4],
                'maximum_discount_amount' => $row[5],
                'usage_limit'          => $row[6],
                'expires_at'           => $row[7],
            ] );
        }

        // Sync shipping options to WooCommerce
        self::sync_shipping_to_woocommerce();
    }

    /**
     * Create WooCommerce shipping zone methods that mirror seed data.
     */
    private static function sync_shipping_to_woocommerce(): void {
        if ( ! class_exists( 'WC_Shipping_Zones' ) || ! class_exists( 'WC_Shipping_Zone' ) ) {
            return;
        }

        $zone = new \WC_Shipping_Zone( 0 );

        $existing = $zone->get_shipping_methods();
        if ( ! empty( $existing ) ) {
            return;
        }

        // Standard Shipping : flat_rate $5.99
        $instance_id = $zone->add_shipping_method( 'flat_rate' );
        if ( $instance_id ) {
            update_option( "woocommerce_flat_rate_{$instance_id}_settings", [
                'title'      => 'Standard Shipping',
                'tax_status' => 'taxable',
                'cost'       => '5.99',
            ] );
        }

        // Express Shipping : flat_rate $12.99
        $instance_id = $zone->add_shipping_method( 'flat_rate' );
        if ( $instance_id ) {
            update_option( "woocommerce_flat_rate_{$instance_id}_settings", [
                'title'      => 'Express Shipping',
                'tax_status' => 'taxable',
                'cost'       => '12.99',
            ] );
        }

        // Free Shipping : orders over $50
        $instance_id = $zone->add_shipping_method( 'free_shipping' );
        if ( $instance_id ) {
            update_option( "woocommerce_free_shipping_{$instance_id}_settings", [
                'title'    => 'Free Shipping',
                'requires' => 'min_amount',
                'min_amount' => '50.00',
            ] );
        }

        delete_transient( 'wc_shipping_method_count' );
        \WC_Cache_Helper::invalidate_cache_group( 'shipping' );
    }
}
