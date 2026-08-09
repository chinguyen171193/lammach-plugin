<?php if ( ! defined( 'ABSPATH' ) ) { exit; } ?>
<section id="<?php echo esc_attr( $config['id'] ); ?>" class="dat-npc-test" data-dat-npc-test data-npc-model="<?php echo esc_url( $config['model_url'] ); ?>" data-npc-animation-endpoint="<?php echo esc_url( $config['animations_endpoint'] ); ?>" data-npc-version="<?php echo esc_attr( $config['version'] ); ?>" style="--dat-npc-height:<?php echo esc_attr( $config['height'] ); ?>px">
	<div class="dat-npc-test__canvas-wrap" data-npc-canvas></div>
	<aside class="dat-npc-test__panel" data-npc-debug aria-label="NPC debug panel">
		<h2>employee_001 · NPC Test</h2>
		<dl>
			<div><dt>Current State</dt><dd data-npc-state>Đang tải…</dd></div>
			<div><dt>Current Animation</dt><dd data-npc-animation>—</dd></div>
			<div><dt>Current Interaction</dt><dd data-npc-interaction>—</dd></div>
			<div><dt>Target Object</dt><dd data-npc-target-object>—</dd></div>
			<div><dt>Character Position</dt><dd data-npc-position>—</dd></div>
			<div><dt>Target</dt><dd data-npc-target>—</dd></div>
			<div><dt>Status</dt><dd data-npc-status>Đang tải FBX…</dd></div>
		</dl>
		<div class="dat-npc-test__actions" aria-label="NPC movement controls">
			<button type="button" data-npc-action="GO_TO_DESK">Go To Desk</button>
			<button type="button" data-npc-action="SIT">Sit</button>
			<button type="button" data-npc-action="WORK">Work</button>
			<button type="button" data-npc-action="STOP_WORK">Stop Work</button>
			<button type="button" data-npc-action="STAND_UP">Stand Up</button>
			<button type="button" data-npc-action="IDLE">Idle</button>
		</div>
		<details class="dat-npc-test__clips" open>
			<summary>Animation clips (xem thêm trong Console)</summary>
			<ul data-npc-clips><li>Đang đọc animations.fbx…</li></ul>
		</details>
		<details class="dat-npc-test__clips" open>
			<summary>Workstation animation scan</summary>
			<ul data-npc-workstation-clips><li>Đang quét keyword…</li></ul>
			<p class="dat-npc-test__missing" data-npc-missing-animations>Đang kiểm tra Sit / Stand / Typing…</p>
		</details>
		<p class="dat-npc-test__hint">Kéo chuột trái để xoay · chuột phải để pan · cuộn để zoom.</p>
	</aside>
	<p class="dat-npc-test__error" data-npc-error hidden></p>
</section>
