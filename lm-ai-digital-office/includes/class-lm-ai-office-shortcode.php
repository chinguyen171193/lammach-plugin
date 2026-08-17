<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class LM_AI_Office_Shortcode {
	public function __construct() {
		add_shortcode( 'lm_ai_office', array( $this, 'render' ) );
		add_shortcode( 'lm_ai_office_npc_test', array( $this, 'render_npc_test' ) );
		add_shortcode( 'lm_ai_office_3d', array( $this, 'render_3d_office' ) );
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
		$atts = shortcode_atts( array( 'height' => '620', 'office' => 'no' ), $atts, 'lm_ai_office_npc_test' );
		$reference_model_relative_path = 'public/assets/characters/reference_character_v1/rp_claudia_rigged_002_yup_a.fbx';
		$config = array(
			'id'         => 'lm-ai-office-npc-' . wp_generate_uuid4(),
			'height'     => min( 1000, max( 380, absint( $atts['height'] ) ) ),
			'version'    => LM_AI_OFFICE_BUILD,
			'reference_model_url' => LM_AI_OFFICE_URL . $reference_model_relative_path,
			'reference_model_path' => $reference_model_relative_path,
			'reference_model_format' => 'fbx',
			'reference_model_available' => file_exists( LM_AI_OFFICE_DIR . $reference_model_relative_path ),
		);
		$assets = new LM_AI_Office_Assets();
		$assets->npc_test_assets();
		ob_start();
		include LM_AI_OFFICE_DIR . 'templates/npc-test-scene.php';
		return ob_get_clean();
	}

	/** Compatibility alias for the isolated reference-character test scene. */
	public function render_3d_office( $atts ) {
		return $this->render_npc_test( $atts );
	}
}
