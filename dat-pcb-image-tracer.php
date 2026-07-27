<?php
/**
 * Plugin Name: PCB Image Tracer
 * Description: Trình chỉnh sửa PCB từ ảnh nền Top/Bottom, vẽ pad/via/track/drill/outline theo đơn vị mm.
 * Version: 1.7.1
 * Author: DAT
 * Text Domain: dat-pcb-image-tracer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'DAT_PCB_TRACER_VERSION', '1.7.1' );
define( 'DAT_PCB_TRACER_FILE', __FILE__ );
define( 'DAT_PCB_TRACER_DIR', plugin_dir_path( __FILE__ ) );
define( 'DAT_PCB_TRACER_URL', plugin_dir_url( __FILE__ ) );
define( 'DAT_PCB_TRACER_META_JSON', '_dat_pcb_tracer_project_json' );
define( 'DAT_PCB_TRACER_META_CODE', '_dat_pcb_tracer_project_code' );
define( 'DAT_PCB_TRACER_META_TOP_IMAGE', '_dat_pcb_tracer_top_image_id' );
define( 'DAT_PCB_TRACER_META_BOTTOM_IMAGE', '_dat_pcb_tracer_bottom_image_id' );

require_once DAT_PCB_TRACER_DIR . 'includes/class-dat-pcb-project.php';
require_once DAT_PCB_TRACER_DIR . 'includes/class-dat-pcb-upload.php';
require_once DAT_PCB_TRACER_DIR . 'includes/class-dat-pcb-ai.php';
require_once DAT_PCB_TRACER_DIR . 'includes/class-dat-pcb-rest-api.php';
require_once DAT_PCB_TRACER_DIR . 'includes/class-dat-pcb-admin.php';
require_once DAT_PCB_TRACER_DIR . 'includes/class-dat-pcb-tracer.php';

register_activation_hook(
	__FILE__,
	static function () {
		DAT_PCB_Tracer::instance()->register_project_post_type();
		flush_rewrite_rules();
	}
);

register_deactivation_hook(
	__FILE__,
	static function () {
		flush_rewrite_rules();
	}
);

add_action(
	'plugins_loaded',
	static function () {
		DAT_PCB_Tracer::instance();
	}
);
