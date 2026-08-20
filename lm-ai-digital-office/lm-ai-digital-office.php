<?php
/**
 * Plugin Name: LM AI Digital Office
 * Description: Văn phòng số 2.5D mô phỏng nhân viên và AI Agent phối hợp vận hành doanh nghiệp.
 * Version: 1.8.0
 * Requires at least: 6.4
 * Requires PHP: 8.0
 * Author: LM
 * Text Domain: lm-ai-digital-office
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LM_AI_OFFICE_VERSION', '1.8.0' );
define( 'LM_AI_OFFICE_BUILD', '2026.08.20-build-mode-v1' );
define( 'LM_AI_OFFICE_FILE', __FILE__ );
define( 'LM_AI_OFFICE_DIR', plugin_dir_path( __FILE__ ) );
define( 'LM_AI_OFFICE_URL', plugin_dir_url( __FILE__ ) );
define( 'LM_AI_OFFICE_OPTION', 'lm_ai_office_settings' );
define( 'LM_AI_OFFICE_NONCE', 'lm_ai_office_admin' );

require_once LM_AI_OFFICE_DIR . 'includes/class-lm-ai-office.php';
require_once LM_AI_OFFICE_DIR . 'includes/class-lm-ai-office-assets.php';
require_once LM_AI_OFFICE_DIR . 'includes/class-lm-ai-office-asset-library.php';
require_once LM_AI_OFFICE_DIR . 'includes/class-lm-ai-office-animations.php';
require_once LM_AI_OFFICE_DIR . 'includes/class-lm-ai-office-characters.php';
require_once LM_AI_OFFICE_DIR . 'includes/class-lm-ai-office-shortcode.php';
require_once LM_AI_OFFICE_DIR . 'includes/class-lm-ai-office-api.php';
require_once LM_AI_OFFICE_DIR . 'includes/class-lm-ai-office-events.php';
require_once LM_AI_OFFICE_DIR . 'includes/class-lm-ai-office-admin.php';

register_activation_hook( __FILE__, array( 'LM_AI_Office', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'LM_AI_Office', 'deactivate' ) );

add_action(
	'plugins_loaded',
	static function () {
		LM_AI_Office::instance();
	}
);
