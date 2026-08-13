<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

// Print the renderer here as a reliable fallback for WordPress admin screens.
$preview_assets = new LM_AI_Office_Assets();
$preview_assets->public_assets( false );
?>
<div class="wrap lm-ai-office-admin"><h1>Xem trước văn phòng</h1><?php echo do_shortcode( '[lm_ai_office height="760" mode="demo" theme="dark" fullscreen="no"]' ); ?></div>
<?php
wp_print_scripts(
	array(
		'lm-ai-office-pixi',
		'lm-ai-office-pathfinding',
		'lm-ai-office-agents',
		'lm-ai-office-events',
		'lm-ai-office-ui',
		'lm-ai-office-engine',
		'lm-ai-office',
	)
);
?>
