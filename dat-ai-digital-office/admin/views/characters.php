<?php if ( ! defined( 'ABSPATH' ) ) { exit; }
$actions = DAT_AI_Office_Animations::actions(); $assets = DAT_AI_Office_Animations::assets();
?>
<div class="wrap dat-ai-office-admin"><h1>Nhân vật</h1>
<section class="dat-ai-office-panel"><h2>Employee 001</h2><p><strong>Model:</strong> employee_001.fbx</p><p><a class="button button-primary" href="<?php echo esc_url( admin_url( 'admin.php?page=dat-ai-office-animation-library' ) ); ?>">Mở Thư viện chuyển động</a></p></section>
<table class="widefat striped"><thead><tr><th>Hành động</th><th>Tình trạng</th></tr></thead><tbody><?php foreach ( $actions as $key => $action ) : $ready = ! empty( $assets[ $key ] ); ?><tr><td><?php echo esc_html( $action['label'] ); ?></td><td><?php echo esc_html( $ready ? 'Sẵn sàng' : 'Chưa có chuyển động' ); ?></td></tr><?php endforeach; ?></tbody></table>
</div>
