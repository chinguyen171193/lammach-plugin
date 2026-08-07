<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class DAT_AI_Office_Assets {
	public function __construct() {
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_assets' ) );
	}

	public function public_assets() {
		wp_enqueue_style( 'dat-ai-office-public', DAT_AI_OFFICE_URL . 'public/css/digital-office.css', array(), DAT_AI_OFFICE_VERSION );
		wp_enqueue_style( 'dat-ai-office-public-fixes', DAT_AI_OFFICE_URL . 'public/css/digital-office-fixes.css', array( 'dat-ai-office-public' ), DAT_AI_OFFICE_VERSION );
		wp_enqueue_script( 'dat-ai-office-pixi', DAT_AI_OFFICE_URL . 'public/js/vendor/pixi.min.js', array(), '7.4.2', true );
		wp_enqueue_script( 'dat-ai-office-pathfinding', DAT_AI_OFFICE_URL . 'public/js/office-pathfinding.js', array(), DAT_AI_OFFICE_VERSION, true );
		wp_enqueue_script( 'dat-ai-office-agents', DAT_AI_OFFICE_URL . 'public/js/office-agents.js', array( 'dat-ai-office-pixi', 'dat-ai-office-pathfinding' ), DAT_AI_OFFICE_VERSION, true );
		wp_enqueue_script( 'dat-ai-office-events', DAT_AI_OFFICE_URL . 'public/js/office-events.js', array(), DAT_AI_OFFICE_VERSION, true );
		wp_enqueue_script( 'dat-ai-office-ui', DAT_AI_OFFICE_URL . 'public/js/office-ui.js', array(), DAT_AI_OFFICE_VERSION, true );
		wp_enqueue_script( 'dat-ai-office-engine', DAT_AI_OFFICE_URL . 'public/js/office-engine.js', array( 'dat-ai-office-pixi', 'dat-ai-office-agents', 'dat-ai-office-events', 'dat-ai-office-ui' ), DAT_AI_OFFICE_VERSION, true );
		wp_enqueue_script( 'dat-ai-office', DAT_AI_OFFICE_URL . 'public/js/digital-office.js', array( 'dat-ai-office-engine' ), DAT_AI_OFFICE_VERSION, true );
		wp_localize_script( 'dat-ai-office', 'DAT_AI_OFFICE', array( 'restUrl' => esc_url_raw( rest_url( 'dat-ai-office/v1/' ) ), 'nonce' => wp_create_nonce( 'wp_rest' ), 'adminUrl' => admin_url( 'admin.php?page=dat-ai-office' ) ) );
	}

	public function admin_assets( $hook ) {
		if ( false === strpos( (string) $hook, 'dat-ai-office' ) ) { return; }
		wp_enqueue_style( 'dat-ai-office-admin', DAT_AI_OFFICE_URL . 'admin/css/admin.css', array(), DAT_AI_OFFICE_VERSION );
		wp_enqueue_script( 'dat-ai-office-admin', DAT_AI_OFFICE_URL . 'admin/js/admin.js', array( 'jquery' ), DAT_AI_OFFICE_VERSION, true );
		wp_localize_script( 'dat-ai-office-admin', 'DAT_AI_OFFICE_ADMIN', array( 'nonce' => wp_create_nonce( DAT_AI_OFFICE_NONCE ), 'restUrl' => esc_url_raw( rest_url( 'dat-ai-office/v1/' ) ) ) );

		// The preview contains the shortcode but is rendered after admin_head.
		// Queue its public renderer here so both CSS and JavaScript are printed.
		if ( 'dat-ai-office_page_dat-ai-office-preview' === $hook ) {
			$this->public_assets();
		}
	}
}
