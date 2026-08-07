<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

// Print the renderer here as a reliable fallback for WordPress admin screens.
$preview_assets = new DAT_AI_Office_Assets();
$preview_assets->public_assets( false );
?>
<div class="wrap dat-ai-office-admin"><h1>Xem trước văn phòng</h1><?php echo do_shortcode( '[dat_ai_office height="760" mode="demo" theme="dark" fullscreen="no"]' ); ?></div>
<?php
wp_print_scripts(
	array(
		'dat-ai-office-pixi',
		'dat-ai-office-pathfinding',
		'dat-ai-office-agents',
		'dat-ai-office-events',
		'dat-ai-office-ui',
		'dat-ai-office-engine',
		'dat-ai-office',
	)
);
?>
