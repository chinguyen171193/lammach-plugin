<?php
/**
 * Plugin Name: LM AI Digital Office
 * Description: Văn phòng số 2.5D mô phỏng nhân viên và AI Agent phối hợp vận hành doanh nghiệp.
 * Version: 1.7.0
 * Requires at least: 6.4
 * Requires PHP: 8.0
 * Author: DAT
 * Text Domain: LM-ai-digital-office
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'DAT_AI_OFFICE_VERSION', '1.7.0' );
define( 'DAT_AI_OFFICE_BUILD', '2026.08.08-npc-test-11' );
define( 'DAT_AI_OFFICE_FILE', __FILE__ );
define( 'DAT_AI_OFFICE_DIR', plugin_dir_path( __FILE__ ) );
define( 'DAT_AI_OFFICE_URL', plugin_dir_url( __FILE__ ) );
define( 'DAT_AI_OFFICE_OPTION', 'dat_ai_office_settings' );
define( 'DAT_AI_OFFICE_NONCE', 'dat_ai_office_admin' );

require_once DAT_AI_OFFICE_DIR . 'includes/class-dat-ai-office.php';
require_once DAT_AI_OFFICE_DIR . 'includes/class-dat-ai-office-assets.php';
require_once DAT_AI_OFFICE_DIR . 'includes/class-dat-ai-office-shortcode.php';
require_once DAT_AI_OFFICE_DIR . 'includes/class-dat-ai-office-api.php';
require_once DAT_AI_OFFICE_DIR . 'includes/class-dat-ai-office-events.php';
require_once DAT_AI_OFFICE_DIR . 'includes/class-dat-ai-office-admin.php';

register_activation_hook( __FILE__, array( 'DAT_AI_Office', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'DAT_AI_Office', 'deactivate' ) );

add_action(
	'plugins_loaded',
	static function () {
		DAT_AI_Office::instance();
	}
);
