<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

// Print the 3D renderer here as a reliable fallback for WordPress admin screens.
$preview_assets = new LM_AI_Office_Assets();
$preview_assets->npc_test_assets( false );
?>
<div class="wrap lm-ai-office-admin"><h1>Xem trước văn phòng 3D</h1><?php echo do_shortcode( '[lm_ai_office_3d height="760"]' ); ?></div>
<?php
wp_print_scripts(
	array(
		'lm-ai-office-npc-test-scene',
	)
);
?>
