<?php if ( ! defined( 'ABSPATH' ) ) { exit; } ?>
<section id="<?php echo esc_attr( $config['id'] ); ?>" class="dat-npc-test" data-dat-npc-test data-npc-model="<?php echo esc_url( $config['model_url'] ); ?>" data-npc-animations="<?php echo esc_url( $config['anims_url'] ); ?>" data-npc-version="<?php echo esc_attr( $config['version'] ); ?>" style="--dat-npc-height:<?php echo esc_attr( $config['height'] ); ?>px">
	<div class="dat-npc-test__canvas-wrap" data-npc-canvas></div>
	<aside class="dat-npc-test__panel" data-npc-debug aria-label="NPC debug panel">
		<h2>employee_001 · NPC Test</h2>
		<dl>
			<div><dt>Current State</dt><dd data-npc-state>Đang tải…</dd></div>
			<div><dt>Current Animation</dt><dd data-npc-animation>—</dd></div>
			<div><dt>Character Position</dt><dd data-npc-position>—</dd></div>
			<div><dt>Target</dt><dd data-npc-target>—</dd></div>
			<div><dt>Status</dt><dd data-npc-status>Đang tải FBX…</dd></div>
		</dl>
		<div class="dat-npc-test__actions" aria-label="NPC movement controls">
			<button type="button" data-npc-action="IDLE">Idle</button>
			<button type="button" data-npc-action="A">Walk A</button>
			<button type="button" data-npc-action="B">Walk B</button>
			<button type="button" data-npc-action="C">Walk C</button>
		</div>
		<details class="dat-npc-test__clips" open>
			<summary>Animation clips (xem thêm trong Console)</summary>
			<ul data-npc-clips><li>Đang đọc animations.fbx…</li></ul>
		</details>
		<p class="dat-npc-test__hint">Kéo chuột trái để xoay · chuột phải để pan · cuộn để zoom.</p>
	</aside>
	<p class="dat-npc-test__error" data-npc-error hidden></p>
</section>
