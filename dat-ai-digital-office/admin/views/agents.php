<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$department_names = array();
foreach ( $data['departments'] as $department ) {
	$department_names[ $department['id'] ] = $department['name'];
}
$sprite_roles = array(
	'pcb-engineer' => 'PCB Engineering Agent',
	'sale-ai'       => 'Sales & CRM Agent',
	'supervisor-ai' => 'AI Operations Supervisor',
);
$showcase_ids = array( 'supervisor-ai', 'sale-ai', 'pcb-engineer' );
?>
<div class="wrap dat-ai-office-admin">
	<h1>Nhân viên và AI Agent</h1>

	<section class="dat-ai-office-agent-visualization" aria-label="Agent Sprite Demo">
		<div class="dat-ai-office-agent-visualization__head">
			<div><h2>Agent visualization</h2><p>Sprite sheet demo cho các AI Agent chính. Bảng dữ liệu hiện có bên dưới được giữ nguyên.</p></div>
			<button type="button" class="button button-primary" data-dat-ai-demo-agents>Demo Agent</button>
		</div>
		<div class="dat-ai-office-agent-grid">
			<?php foreach ( $data['agents'] as $agent ) : ?>
				<?php if ( ! in_array( $agent['sprite'], $showcase_ids, true ) ) { continue; } ?>
				<article class="dat-ai-office-agent-card" data-agent-card data-agent-id="<?php echo esc_attr( $agent['id'] ); ?>" data-agent-state="<?php echo esc_attr( $agent['status'] ); ?>" style="--agent-accent:<?php echo esc_attr( $agent['color'] ); ?>">
					<div class="dat-ai-office-agent-card__top"><span class="dat-ai-office-agent-card__department"><?php echo esc_html( $department_names[ $agent['department'] ] ?? $agent['department'] ); ?></span><span class="dat-ai-office-agent-card__status" data-agent-status><?php echo esc_html( $agent['status'] ); ?></span></div>
					<div class="dat-agent-sprite" data-agent-sprite data-agent-id="<?php echo esc_attr( $agent['id'] ); ?>" data-sprite-id="<?php echo esc_attr( $agent['sprite'] ); ?>" data-agent-state="<?php echo esc_attr( $agent['status'] ); ?>"><div class="dat-agent-sprite__surface" data-agent-sprite-surface></div><div class="dat-agent-sprite__fallback" aria-hidden="true"></div></div>
					<div class="dat-ai-office-agent-card__identity"><h3><?php echo esc_html( $agent['name'] ); ?></h3><p><?php echo esc_html( $sprite_roles[ $agent['sprite'] ] ?? $agent['role'] ); ?></p></div>
					<div class="dat-ai-office-agent-card__task"><small>Current Task</small><span data-agent-task><?php echo esc_html( $agent['task'] ?: 'Đang chờ nhiệm vụ' ); ?></span></div>
					<div class="dat-ai-office-agent-card__progress"><span data-agent-progress-value><?php echo esc_html( absint( $agent['progress'] ) ); ?>%</span><span class="dat-ai-office-agent-card__progress-track"><i data-agent-progress-bar style="width:<?php echo esc_attr( min( 100, max( 0, absint( $agent['progress'] ) ) ) ); ?>%"></i></span></div>
				</article>
			<?php endforeach; ?>
		</div>
		<p class="dat-ai-office-agent-demo-log" data-dat-ai-demo-log>Demo sẵn sàng.</p>
	</section>

	<table class="widefat striped"><thead><tr><th>Tên</th><th>Loại</th><th>Vai trò</th><th>Phòng</th><th>Trạng thái</th></tr></thead><tbody><?php foreach ( $data['agents'] as $agent ) : ?><tr><td><span class="dat-ai-office-dot" style="background:<?php echo esc_attr( $agent['color'] ); ?>"></span><?php echo esc_html( $agent['name'] ); ?></td><td><?php echo esc_html( 'ai' === $agent['type'] ? 'AI Agent' : 'Nhân viên' ); ?></td><td><?php echo esc_html( $agent['role'] ); ?></td><td><?php echo esc_html( $department_names[ $agent['department'] ] ?? $agent['department'] ); ?></td><td><?php echo esc_html( $agent['status'] ); ?></td></tr><?php endforeach; ?></tbody></table>
</div>
