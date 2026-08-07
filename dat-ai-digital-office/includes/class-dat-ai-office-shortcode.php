<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class DAT_AI_Office_Shortcode {
	public function __construct() { add_shortcode( 'dat_ai_office', array( $this, 'render' ) ); }

	public function render( $atts ) {
		$atts = shortcode_atts( array( 'height' => '760', 'mode' => 'demo', 'theme' => 'dark', 'fullscreen' => 'no', 'show_dashboard' => 'yes', 'show_log' => 'yes', 'show_controls' => 'yes', 'sound' => 'no', 'auto_camera' => 'yes' ), $atts, 'dat_ai_office' );
		$height = min( 1200, max( 360, absint( $atts['height'] ) ) );
		$config = array(
			'id' => 'dat-ai-office-' . wp_generate_uuid4(), 'height' => $height,
			'mode' => in_array( $atts['mode'], array( 'demo', 'realtime' ), true ) ? $atts['mode'] : 'demo',
			'theme' => 'light' === $atts['theme'] ? 'light' : 'dark',
			'fullscreen' => 'yes' === $atts['fullscreen'], 'showDashboard' => 'yes' === $atts['show_dashboard'],
			'showLog' => 'yes' === $atts['show_log'], 'showControls' => 'yes' === $atts['show_controls'],
			'sound' => 'yes' === $atts['sound'], 'autoCamera' => 'no' !== $atts['auto_camera'], 'canManage' => current_user_can( 'manage_options' ),
			'data' => DAT_AI_Office::dataset(), 'logs' => DAT_AI_Office::recent_logs(),
		);
		DAT_AI_Office::instance();
		$assets = new DAT_AI_Office_Assets();
		$assets->public_assets();
		ob_start();
		include DAT_AI_OFFICE_DIR . 'templates/digital-office.php';
		return ob_get_clean();
	}
}
