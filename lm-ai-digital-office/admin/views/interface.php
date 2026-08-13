<?php if ( ! defined( 'ABSPATH' ) ) { exit; } ?>
<div class="wrap lm-ai-office-admin"><h1>Giao diện</h1><p>Màu nền, màu UI, FPS, dashboard, log, camera, ngày/đêm và Debug được quản lý tại đây.</p><form method="post" action="options.php"><?php settings_fields( 'lm_ai_office_settings' ); include LM_AI_OFFICE_DIR . 'admin/views/settings-fields.php'; submit_button( 'Lưu giao diện' ); ?></form></div>
