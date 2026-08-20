<?php if ( ! defined( 'ABSPATH' ) ) { exit; } ?>
<style>
/* Render after enqueued styles so the task panel is hidden until its button is pressed. */
#<?php echo esc_attr( $config['id'] ); ?> .lm-ai-office__task-modal[hidden],
#<?php echo esc_attr( $config['id'] ); ?> .lm-ai-office__agent-card[hidden] { display: none !important; }
</style>
<section id="<?php echo esc_attr( $config['id'] ); ?>" class="lm-ai-office lm-ai-office--<?php echo esc_attr( $config['theme'] ); ?>" style="--lm-ai-office-height:<?php echo esc_attr( $config['height'] ); ?>px" data-office-config="<?php echo esc_attr( wp_json_encode( $config ) ); ?>">
	<div class="lm-ai-office__stage" aria-label="Mô phỏng văn phòng số AI"></div>
	<?php if ( $config['canManage'] ) : ?>
		<section class="lm-ai-office__build" data-office-build hidden aria-label="Chế độ xây dựng văn phòng">
			<div class="lm-ai-office__build-canvas" data-office-build-canvas></div>
			<div class="lm-ai-office__live-indicator" data-office-live-indicator aria-live="polite"><span aria-hidden="true">●</span> LIVE MODE · Nhân viên 001</div>
			<aside class="lm-ai-office__build-panel" data-office-build-panel aria-label="Công cụ xây dựng văn phòng">
				<button type="button" class="lm-ai-office__build-panel-reopen" data-build-panel-state="compact" aria-label="Mở Thư viện tài sản" title="Mở Thư viện tài sản">☰</button>
				<div class="lm-ai-office__build-panel-content" data-office-build-panel-content>
					<div class="lm-ai-office__build-heading">
						<div><span>CHẾ ĐỘ XÂY DỰNG</span><h2>Thư viện tài sản</h2></div>
						<div class="lm-ai-office__build-heading-actions" aria-label="Hiển thị panel">
							<button type="button" data-build-panel-state="expanded" aria-label="Mở rộng panel" title="Mở rộng panel">↗</button>
							<button type="button" data-build-panel-state="compact" aria-label="Thu gọn panel" title="Thu gọn panel">◧</button>
							<button type="button" data-build-panel-state="collapsed" aria-label="Ẩn panel" title="Ẩn panel">›</button>
							<button type="button" data-office-action="activity" aria-label="Quay lại Hoạt động" title="Quay lại Hoạt động">×</button>
						</div>
					</div>
					<div class="lm-ai-office__build-tabs" role="tablist" aria-label="Công cụ xây dựng">
						<button type="button" id="<?php echo esc_attr( $config['id'] . '-build-library-tab' ); ?>" data-build-panel-tab="library" class="is-active" role="tab" aria-selected="true" aria-controls="<?php echo esc_attr( $config['id'] . '-build-library' ); ?>">Thư viện</button>
						<button type="button" id="<?php echo esc_attr( $config['id'] . '-build-object-tab' ); ?>" data-build-panel-tab="object" role="tab" aria-selected="false" aria-controls="<?php echo esc_attr( $config['id'] . '-build-object' ); ?>">Đối tượng</button>
					</div>
					<div class="lm-ai-office__build-panes">
						<section id="<?php echo esc_attr( $config['id'] . '-build-library' ); ?>" class="lm-ai-office__build-pane lm-ai-office__build-pane--library is-active" data-build-panel-pane="library" role="tabpanel" aria-labelledby="<?php echo esc_attr( $config['id'] . '-build-library-tab' ); ?>">
							<div class="lm-ai-office__build-categories" data-office-build-categories aria-label="Lọc loại tài sản"><button type="button" data-build-category="ALL" class="is-active">Tất cả</button><button type="button" data-build-category="TABLE">Bàn</button><button type="button" data-build-category="CHAIR">Ghế</button><button type="button" data-build-category="COMPUTER">Máy tính</button><button type="button" data-build-category="CABINET">Tủ</button><button type="button" data-build-category="LIGHT">Đèn</button><button type="button" data-build-category="PLANT">Cây</button><button type="button" data-build-category="DECORATION">Trang trí</button><button type="button" data-build-category="DEVICE">Thiết bị</button><button type="button" data-build-category="BUILDING">Công trình</button><button type="button" data-build-category="OTHER">Khác</button></div>
							<div class="lm-ai-office__build-assets" data-office-build-assets><p class="lm-ai-office__build-empty">Đang tải tài sản…</p></div>
						</section>
						<section id="<?php echo esc_attr( $config['id'] . '-build-object' ); ?>" class="lm-ai-office__build-pane lm-ai-office__build-pane--object" data-build-panel-pane="object" role="tabpanel" aria-labelledby="<?php echo esc_attr( $config['id'] . '-build-object-tab' ); ?>">
							<p class="lm-ai-office__build-no-selection" data-office-build-object-empty>Chưa chọn đối tượng.</p>
							<section class="lm-ai-office__build-selection" data-office-build-selection hidden>
								<h3 data-office-build-selection-name>Chưa chọn đối tượng</h3>
								<div class="lm-ai-office__build-move">
									<b>Di chuyển</b>
									<div class="lm-ai-office__build-move-pad" aria-label="Di chuyển đối tượng">
										<button type="button" data-build-action="move-forward" aria-label="Di chuyển lên">↑</button>
										<button type="button" data-build-action="move-left" aria-label="Di chuyển trái">←</button>
										<button type="button" data-build-action="move-back" aria-label="Di chuyển xuống">↓</button>
										<button type="button" data-build-action="move-right" aria-label="Di chuyển phải">→</button>
									</div>
								</div>
								<div class="lm-ai-office__build-object-actions"><button type="button" data-build-action="rotate-left">Xoay trái</button><button type="button" data-build-action="rotate-right">Xoay phải</button><button type="button" data-build-action="duplicate">Nhân bản</button><button type="button" data-build-action="delete" class="is-danger">Xóa</button></div>
							</section>
							<?php if ( ! empty( $config['data']['settings']['debug'] ) ) : ?>
								<details class="lm-ai-office__build-debug" data-office-build-debug>
									<summary>Chế độ phát triển</summary>
									<dl>
										<div><dt>Scene ID</dt><dd data-build-debug-scene>—</dd></div>
										<div><dt>Số object</dt><dd data-build-debug-count>0</dd></div>
										<div><dt>Instance đang chọn</dt><dd data-build-debug-instance>—</dd></div>
										<div><dt>Asset ID</dt><dd data-build-debug-asset>—</dd></div>
										<div><dt>Vị trí</dt><dd data-build-debug-position>—</dd></div>
										<div><dt>Góc xoay</dt><dd data-build-debug-rotation>—</dd></div>
										<div><dt>Tỷ lệ</dt><dd data-build-debug-scale>—</dd></div>
										<div><dt>Model cache</dt><dd data-build-debug-cache>0</dd></div>
										<div><dt>Input</dt><dd data-build-debug-input>—</dd></div>
										<div><dt>Touches</dt><dd data-build-debug-touches>0</dd></div>
										<div><dt>Gesture</dt><dd data-build-debug-gesture>—</dd></div>
										<div><dt>Camera Distance</dt><dd data-build-debug-distance>—</dd></div>
										<div><dt>Camera Target</dt><dd data-build-debug-target>—</dd></div>
									</dl>
								</details>
							<?php endif; ?>
						</section>
					</div>
					<div class="lm-ai-office__build-footer"><p data-office-build-status>Chọn một tài sản, sau đó click xuống sàn để đặt.</p><button type="button" data-build-save class="lm-ai-office__build-save">Lưu văn phòng</button></div>
				</div>
			</aside>
		</section>
	<?php endif; ?>
	<?php if ( $config['showDashboard'] ) : ?><aside class="lm-ai-office__dashboard" data-office-dashboard><button type="button" class="lm-ai-office__collapse" data-office-toggle="dashboard" aria-label="Ẩn dashboard">×</button><span class="lm-ai-office__eyebrow">LIVE OPERATIONS</span><h2><?php echo esc_html( $config['data']['settings']['model_name'] ); ?></h2><div class="lm-ai-office__metrics" data-office-metrics></div></aside><?php endif; ?>
	<?php if ( $config['showLog'] ) : ?><aside class="lm-ai-office__log" data-office-log><div class="lm-ai-office__log-head"><b>Nhật ký hoạt động</b><button type="button" data-office-toggle="log">×</button></div><select data-office-filter><option value="all">Tất cả</option><option value="sales">Sale</option><option value="pcb">Kỹ thuật</option><option value="smt">Sản xuất</option><option value="qc">QC</option><option value="warehouse">Kho</option><option value="finance">Kế toán</option><option value="ai">AI</option></select><div class="lm-ai-office__log-list" data-office-log-list></div></aside><?php endif; ?>
	<div class="lm-ai-office__agent-card" data-office-agent-card hidden></div>
	<?php if ( $config['canManage'] ) : ?><div class="lm-ai-office__task-modal" data-office-task-modal hidden><form data-office-task-form><button type="button" data-office-close-task aria-label="Đóng">×</button><h3>Giao nhiệm vụ</h3><label>Tên nhiệm vụ<input required name="title" maxlength="190"></label><label>Mô tả<textarea name="description"></textarea></label><label>Phòng ban<select name="department" data-office-departments></select></label><label>Người nhận<select name="assignee" data-office-assignees></select></label><label>Ưu tiên<select name="priority"><option value="normal">Bình thường</option><option value="high">Cao</option><option value="critical">Khẩn</option></select></label><label>Workflow<select name="workflow_key" data-office-workflows></select></label><button class="lm-ai-office__primary" type="submit">Bắt đầu giao việc</button></form></div><?php endif; ?>
	<?php if ( $config['showControls'] ) : ?><nav class="lm-ai-office__controls" aria-label="Điều khiển văn phòng"><button type="button" data-office-action="demo">Chạy mẫu</button><button type="button" data-office-action="zoom-in" aria-label="Phóng to">＋</button><button type="button" data-office-action="zoom-out" aria-label="Thu nhỏ">－</button><button type="button" data-office-action="reset" aria-label="Đặt lại góc nhìn">⌂</button><button type="button" data-office-action="tour" aria-label="Bật hoặc tắt tham quan">◎</button><button type="button" data-office-action="fullscreen" aria-label="Toàn màn hình">⛶</button><?php if ( $config['canManage'] ) : ?><button type="button" data-office-action="activity" data-office-mode="activity" class="is-active">Hoạt động</button><button type="button" data-office-action="build" data-office-mode="build">Xây dựng</button><button type="button" data-office-action="task">Nhiệm vụ</button><?php endif; ?><button type="button" data-office-action="sound">Âm thanh</button></nav><?php endif; ?>
</section>
