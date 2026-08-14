<?php if ( ! defined( 'ABSPATH' ) ) { exit; } ?>
<section id="<?php echo esc_attr( $config['id'] ); ?>" class="lm-npc-test<?php echo $config['office_mode'] ? ' lm-npc-test--office' : ''; ?>" data-lm-npc-test data-npc-mode="<?php echo $config['office_mode'] ? 'office' : 'test'; ?>" data-npc-characters-endpoint="<?php echo esc_url( $config['characters_endpoint'] ); ?>" data-npc-version="<?php echo esc_attr( $config['version'] ); ?>" style="--lm-npc-height:<?php echo esc_attr( $config['height'] ); ?>px">
	<div class="lm-npc-test__canvas-wrap" data-npc-canvas></div>
	<?php if ( $config['office_mode'] ) : ?>
		<div class="lm-npc-test__office-title"><span>LM AI DIGITAL OFFICE</span><strong>2 nhân vật 3D đang làm việc</strong><small>build <?php echo esc_html( $config['version'] ); ?></small></div>
	<?php endif; ?>
	<aside class="lm-npc-test__panel" data-npc-debug aria-label="NPC debug panel">
		<h2>NPC Test</h2>
		<label for="lm-npc-character-select">Nhân vật đang điều khiển</label>
		<select id="lm-npc-character-select" data-npc-character-select disabled><option>Đang tải…</option></select>
		<dl>
			<div><dt>Character</dt><dd data-npc-character>Đang tải…</dd></div>
			<div><dt>Skeleton</dt><dd data-npc-skeleton>—</dd></div>
			<div><dt>Retarget Profile</dt><dd data-npc-retarget-profile>—</dd></div>
			<div><dt>Source Skeleton</dt><dd data-npc-source-skeleton>—</dd></div>
			<div><dt>Target Skeleton</dt><dd data-npc-target-skeleton>—</dd></div>
			<div><dt>Rest Pose Match</dt><dd data-npc-rest-pose-match>—</dd></div>
			<div><dt>Retarget</dt><dd data-npc-retarget>—</dd></div>
			<div><dt>Current State</dt><dd data-npc-state>Đang tải…</dd></div>
			<div><dt>Current Animation</dt><dd data-npc-animation>—</dd></div>
			<div><dt>Current Interaction</dt><dd data-npc-interaction>—</dd></div>
			<div><dt>Target Object</dt><dd data-npc-target-object>—</dd></div>
			<div><dt>Character Position</dt><dd data-npc-position>—</dd></div>
			<div><dt>Target</dt><dd data-npc-target>—</dd></div>
			<div><dt>Status</dt><dd data-npc-status>Đang tải FBX…</dd></div>
		</dl>
		<div class="lm-npc-test__actions" aria-label="NPC movement controls">
			<button type="button" data-npc-action="AUTO_WORK">Tình huống tự động</button>
			<button type="button" data-npc-action="GO_A">Đi A</button>
			<button type="button" data-npc-action="GO_B">Đi B</button>
			<button type="button" data-npc-action="GO_C">Đi C</button>
			<button type="button" data-npc-action="GO_TO_DESK">Go To Desk</button>
			<button type="button" data-npc-action="SIT">Sit</button>
			<button type="button" data-npc-action="WORK">Work</button>
			<button type="button" data-npc-action="STOP_WORK">Stop Work</button>
			<button type="button" data-npc-action="STAND_UP">Stand Up</button>
			<button type="button" data-npc-action="IDLE">Idle</button>
			<button type="button" data-npc-action="REST_POSE">Xem tư thế gốc</button>
			<button type="button" data-npc-action="PLAY_IDLE">Chạy Chờ việc</button>
			<button type="button" data-npc-action="TOGGLE_SKELETON">Hiện bộ xương</button>
		</div>
		<details class="lm-npc-test__clips">
			<summary>Bone mapping (Developer)</summary>
			<ul data-npc-bone-map><li>Chọn nhân vật để xem mapping.</li></ul>
		</details>
		<details class="lm-npc-test__clips" open>
			<summary>Animation clips (xem thêm trong Console)</summary>
			<ul data-npc-clips><li>Đang đọc animations.fbx…</li></ul>
		</details>
		<details class="lm-npc-test__clips" open>
			<summary>Workstation animation scan</summary>
			<ul data-npc-workstation-clips><li>Đang quét keyword…</li></ul>
			<p class="lm-npc-test__missing" data-npc-missing-animations>Đang kiểm tra Sit / Stand / Typing…</p>
		</details>
		<p class="lm-npc-test__hint">Kéo chuột trái để xoay · chuột phải để pan · cuộn để zoom.</p>
	</aside>
	<p class="lm-npc-test__error" data-npc-error hidden></p>
</section>
