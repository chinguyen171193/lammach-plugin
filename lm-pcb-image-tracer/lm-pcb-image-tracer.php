<?php
/**
 * Plugin Name: LM PCB Image Tracer
 * Description: Trình chỉnh sửa PCB từ ảnh nền Top/Bottom, vẽ pad/via/track/drill/outline theo đơn vị mm.
 * Version: 1.17.2
 * Author: LM
 * Text Domain: lm-pcb-image-tracer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LM_PCB_TRACER_VERSION', '1.17.2' );
define( 'LM_PCB_TRACER_FILE', __FILE__ );
define( 'LM_PCB_TRACER_DIR', plugin_dir_path( __FILE__ ) );
define( 'LM_PCB_TRACER_URL', plugin_dir_url( __FILE__ ) );
define( 'LM_PCB_TRACER_META_JSON', '_lm_pcb_tracer_project_json' );
define( 'LM_PCB_TRACER_META_CODE', '_lm_pcb_tracer_project_code' );
define( 'LM_PCB_TRACER_META_TOP_IMAGE', '_lm_pcb_tracer_top_image_id' );
define( 'LM_PCB_TRACER_META_BOTTOM_IMAGE', '_lm_pcb_tracer_bottom_image_id' );

require_once LM_PCB_TRACER_DIR . 'includes/class-lm-pcb-project.php';
require_once LM_PCB_TRACER_DIR . 'includes/class-lm-pcb-upload.php';
require_once LM_PCB_TRACER_DIR . 'includes/class-lm-pcb-lcsc.php';
require_once LM_PCB_TRACER_DIR . 'includes/class-lm-pcb-ai.php';
require_once LM_PCB_TRACER_DIR . 'includes/class-lm-pcb-rest-api.php';
require_once LM_PCB_TRACER_DIR . 'includes/class-lm-pcb-admin.php';
require_once LM_PCB_TRACER_DIR . 'includes/class-lm-pcb-tracer.php';

register_activation_hook(
	__FILE__,
	static function () {
		LM_PCB_Tracer::instance()->register_project_post_type();
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
		LM_PCB_Tracer::instance();
	}
);
