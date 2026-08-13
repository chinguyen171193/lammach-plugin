<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class LM_AI_Office_Shortcode {
	public function __construct() {
		add_shortcode( 'lm_ai_office', array( $this, 'render' ) );
		add_shortcode( 'lm_ai_office_npc_test', array( $this, 'render_npc_test' ) );
	}

	public function render( $atts ) {
		$atts = shortcode_atts( array( 'height' => '760', 'mode' => 'demo', 'theme' => 'dark', 'fullscreen' => 'no', 'show_dashboard' => 'yes', 'show_log' => 'yes', 'show_controls' => 'yes', 'sound' => 'no', 'auto_camera' => 'yes' ), $atts, 'lm_ai_office' );
		$height = min( 1200, max( 360, absint( $atts['height'] ) ) );
		$config = array(
			'id' => 'lm-ai-office-' . wp_generate_uuid4(), 'height' => $height,
			'mode' => in_array( $atts['mode'], array( 'demo', 'realtime' ), true ) ? $atts['mode'] : 'demo',
			'theme' => 'light' === $atts['theme'] ? 'light' : 'dark',
			'fullscreen' => 'yes' === $atts['fullscreen'], 'showDashboard' => 'yes' === $atts['show_dashboard'],
			'showLog' => 'yes' === $atts['show_log'], 'showControls' => 'yes' === $atts['show_controls'],
			'sound' => 'yes' === $atts['sound'], 'autoCamera' => 'no' !== $atts['auto_camera'], 'canManage' => current_user_can( 'manage_options' ),
			'data' => LM_AI_Office::dataset(), 'logs' => LM_AI_Office::recent_logs(),
		);
		LM_AI_Office::instance();
		$assets = new LM_AI_Office_Assets();
		$assets->public_assets();
		ob_start();
		include LM_AI_OFFICE_DIR . 'templates/digital-office.php';
		return ob_get_clean();
	}

	/**
	 * Isolated 3D NPC proof-of-concept. This is intentionally separate from the
	 * 2.5D office renderer until the movement model is ready to be shared.
	 */
	public function render_npc_test( $atts ) {
		$atts = shortcode_atts( array( 'height' => '620' ), $atts, 'lm_ai_office_npc_test' );
		$config = array(
			'id'         => 'lm-ai-office-npc-' . wp_generate_uuid4(),
			'height'     => min( 1000, max( 380, absint( $atts['height'] ) ) ),
			'characters_endpoint' => rest_url( 'lm-ai-office/v1/characters' ),
			'version'    => LM_AI_OFFICE_BUILD,
		);
		$assets = new LM_AI_Office_Assets();
		$assets->npc_test_assets();
		ob_start();
		include LM_AI_OFFICE_DIR . 'templates/npc-test-scene.php';
		return ob_get_clean();
	}
}
