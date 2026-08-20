<?php if ( ! defined( 'ABSPATH' ) ) { exit; } ?>
<section id="<?php echo esc_attr( $config['id'] ); ?>" class="lm-npc-test" data-lm-npc-test data-npc-version="<?php echo esc_attr( $config['version'] ); ?>" data-npc-model-url="<?php echo esc_url( $config['reference_model_url'] ); ?>" data-npc-model-format="<?php echo esc_attr( $config['reference_model_format'] ); ?>" data-npc-model-available="<?php echo $config['reference_model_available'] ? 'true' : 'false'; ?>" data-npc-model-path="<?php echo esc_attr( $config['reference_model_path'] ); ?>" data-npc-idle-url="<?php echo esc_url( $config['idle_animation_url'] ); ?>" data-npc-idle-available="<?php echo $config['idle_animation_available'] ? 'true' : 'false'; ?>" data-npc-walk-url="<?php echo esc_url( $config['walk_animation_url'] ); ?>" data-npc-walk-available="<?php echo $config['walk_animation_available'] ? 'true' : 'false'; ?>" style="--lm-npc-height:<?php echo esc_attr( $config['height'] ); ?>px">
	<div class="lm-npc-test__canvas-wrap" data-npc-canvas></div>
	<aside class="lm-npc-test__panel" data-npc-debug aria-label="NPC developer panel">
		<h2>REFERENCE_CHARACTER_V1</h2>
		<dl>
			<div><dt>Character</dt><dd>Nhân viên 001</dd></div><div><dt>Role</dt><dd>Chăm sóc khách hàng</dd></div>
			<div><dt>State</dt><dd data-npc-state>REST POSE</dd></div><div><dt>Animation</dt><dd data-npc-animation>Rest Pose</dd></div>
			<div><dt>Source</dt><dd data-npc-animation-source>external</dd></div><div><dt>Retarget</dt><dd data-npc-retarget>Đang tải…</dd></div>
			<div><dt>Model height</dt><dd data-npc-height>—</dd></div><div><dt>Skeleton</dt><dd data-npc-skeleton>—</dd></div>
			<div><dt>Model Forward Axis</dt><dd data-npc-model-forward>—</dd></div><div><dt>World Forward Axis</dt><dd data-npc-world-forward>+Z</dd></div>
			<div><dt>Correction Rotation</dt><dd data-npc-forward>—</dd></div><div><dt>Status</dt><dd data-npc-status>Đang chuẩn bị model…</dd></div>
		</dl>
		<div class="lm-npc-test__actions" aria-label="NPC controls">
			<button type="button" data-npc-action="REST_POSE">Rest Pose</button><button type="button" data-npc-action="IDLE">Idle</button><button type="button" data-npc-action="WALK">Walk</button><button type="button" data-npc-action="TOGGLE_SKELETON">Hiện bộ xương</button>
		</div>
		<div class="lm-npc-test__actions" aria-label="Walk retarget debug controls">
			<button type="button" data-npc-action="TOGGLE_RETARGET_SOURCE">Hiện source skeleton</button><button type="button" data-npc-action="WALK_SOURCE_REST">Walk source rest</button><button type="button" data-npc-action="WALK_FRAME_0">Walk frame 0</button><button type="button" data-npc-action="WALK_FRAME_10">Walk frame 10</button><button type="button" data-npc-action="WALK_FRAME_20">Walk frame 20</button>
		</div>
		<details class="lm-npc-test__clips" open><summary>Embedded animations</summary><ul data-npc-clips><li>Đang quét model…</li></ul></details>
		<details class="lm-npc-test__clips"><summary>Humanoid bone mapping (Developer)</summary><ul data-npc-bone-map><li>Đang map skeleton…</li></ul></details>
		<details class="lm-npc-test__clips" open><summary>Retarget debug (Source pink · Target cyan)</summary><ul data-npc-retarget-debug><li>Đang tạo debug report…</li></ul></details>
		<details class="lm-npc-test__clips"><summary>Skeleton (Developer)</summary><ul data-npc-bones><li>Chưa có skeleton.</li></ul></details>
		<p class="lm-npc-test__hint">Kéo chuột trái để xoay · chuột phải để pan · cuộn để zoom.</p>
	</aside>
	<p class="lm-npc-test__error" data-npc-error hidden></p>
</section>
