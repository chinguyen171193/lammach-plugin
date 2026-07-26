<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
$dat_pcb_tracer_shortcode = ! empty( $dat_pcb_tracer_shortcode );
$dat_pcb_current_user = wp_get_current_user();
$dat_pcb_phone_verified = is_user_logged_in() && class_exists( 'DAT_Esms_Phone_Auth' ) && DAT_Esms_Phone_Auth::is_phone_verified( get_current_user_id() );
$dat_pcb_user_label = is_user_logged_in() ? ( $dat_pcb_phone_verified ? 'User OK' : 'Verify phone' ) : 'Login';
?>
<div class="<?php echo $dat_pcb_tracer_shortcode ? 'dat-pcb-tracer-shortcode-wrap' : 'wrap dat-pcb-tracer-wrap'; ?>"<?php echo $dat_pcb_tracer_shortcode ? ' style="position:fixed;inset:0;width:100vw;height:100vh;max-width:none;margin:0;padding:0;overflow:hidden;z-index:2147483000;background:#10151c;"' : ''; ?>>
	<?php if ( ! $dat_pcb_tracer_shortcode ) : ?>
		<h1><?php echo esc_html__( 'DAT PCB Tracer', 'dat-pcb-image-tracer' ); ?></h1>
	<?php endif; ?>
	<div id="dat-pcb-tracer-app" class="dat-pcb-tracer-app<?php echo $dat_pcb_tracer_shortcode ? ' dat-pcb-tracer-fullscreen' : ''; ?>"<?php echo $dat_pcb_tracer_shortcode ? ' style="width:100vw;height:100vh;min-height:100vh;max-width:none;margin:0;"' : ''; ?>>
		<div class="dat-pcb-toolbar" role="toolbar">
			<span class="dat-pcb-version-badge" title="Phiên bản plugin - dùng để kiểm tra đã upload bản mới chưa">v<?php echo esc_html( DAT_PCB_TRACER_VERSION ); ?></span>
			<button type="button" class="dat-pcb-user-button<?php echo $dat_pcb_phone_verified ? ' is-verified' : ''; ?>" data-action="user-account" title="<?php echo esc_attr( $dat_pcb_user_label ); ?>" aria-label="<?php echo esc_attr( $dat_pcb_user_label ); ?>">
				<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle></svg>
				<span><?php echo esc_html( $dat_pcb_user_label ); ?></span>
			</button>
			<button type="button" data-action="new">Dự án mới</button>
			<button type="button" data-action="open">Mở dự án</button>
			<button type="button" data-action="save">Lưu</button>
			<button type="button" data-action="undo">Undo</button>
			<button type="button" data-action="redo">Redo</button>
			<button type="button" data-action="duplicate">Nhân bản</button>
			<button type="button" data-action="toggle-lock">Khóa/mở khóa</button>
			<button type="button" data-action="align-menu">Căn chỉnh</button>
			<button type="button" data-action="array-menu">Mảng</button>
			<button type="button" data-tool="select">Chọn</button>
			<button type="button" data-tool="track">Vẽ đường mạch</button>
			<div class="dat-route-mode-switch" role="group" aria-label="Routing mode">
				<button type="button" data-route-mode="free">Free</button>
				<button type="button" data-route-mode="45">45°</button>
				<button type="button" data-route-mode="90">90°</button>
				<button type="button" data-route-mode="arc">Arc</button>
			</div>
			<button type="button" data-tool="pad_round">Pad tròn</button>
			<button type="button" data-tool="pad_rect">Pad chữ nhật</button>
			<button type="button" data-tool="pad_oval">Pad oval</button>
			<button type="button" data-tool="pad_roundrect">Pad bo góc</button>
			<button type="button" data-tool="via">Via</button>
			<button type="button" data-tool="drill">Lỗ khoan</button>
			<button type="button" data-tool="outline">Viền bo</button>
			<button type="button" data-tool="region">Vùng đồng</button>
			<button type="button" data-tool="annotation">Ghi chú</button>
			<button type="button" data-tool="measure">Đo</button>
			<button type="button" data-tool="zoom_window">Zoom vùng</button>
			<button type="button" data-tool="pan">Kéo màn hình</button>
			<button type="button" data-action="calibrate">Cân chỉnh</button>
			<button type="button" data-action="fit">Fit màn hình</button>
			<button type="button" data-action="preview3d">Xem 3D</button>
			<button type="button" data-action="export">Xuất JSON</button>
			<label class="dat-tablet-mode-toggle"><input type="checkbox" data-tablet-mode> Tablet Mode</label>
			<label class="dat-upload-btn">Ảnh Top <input type="file" data-upload-side="top" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"></label>
			<label class="dat-upload-btn">Ảnh Bottom <input type="file" data-upload-side="bottom" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"></label>
		</div>
		<div class="dat-pcb-main">
			<aside class="dat-pcb-layers">
				<h2>Lớp</h2>
				<div data-layer-list></div>
				<h2>Thiết lập</h2>
				<label>Mặt vẽ <select data-active-side><option value="top">Top</option><option value="bottom">Bottom</option></select></label>
				<label>Lưới <select data-grid><option>0.1</option><option>0.25</option><option selected>0.5</option><option>1</option><option>2.54</option></select> mm</label>
				<label><input type="checkbox" data-grid-visible checked> Hiện lưới</label>
				<label><input type="checkbox" data-snap checked> Snap</label>
				<label>Rộng đường mạch <input type="number" data-track-width min="0.05" step="0.05" value="0.4"> mm</label>
				<label>Đường kính Pad/Via <input type="number" data-pad-dia min="0.1" step="0.05" value="1.6"> mm</label>
				<label>Đường kính khoan <input type="number" data-drill-dia min="0.05" step="0.05" value="0.8"> mm</label>
				<label>Opacity ảnh <input type="range" data-image-opacity min="0" max="1" step="0.05" value="0.5"></label>
				<button type="button" data-action="center-image">Căn ảnh</button>
				<button type="button" data-action="flip-bottom">Lật Bottom ngang</button>
				<button type="button" data-action="rotate-90">Xoay 90</button>
				<button type="button" data-action="rotate--90">Xoay -90</button>
				<button type="button" data-action="rotate-180">Xoay 180</button>
				<button type="button" data-action="reset-image">Reset transform</button>
			</aside>
			<section class="dat-pcb-canvas-panel">
				<canvas id="dat-pcb-tracer-canvas" width="1200" height="760"></canvas>
			</section>
			<aside class="dat-pcb-properties">
				<h2>Thuộc tính</h2>
				<div data-properties></div>
				<h2>Dự án</h2>
				<label>Tên <input type="text" data-project-name></label>
				<label>Mã <input type="text" data-project-code></label>
				<label>Rộng <input type="number" data-board-width step="0.1"> mm</label>
				<label>Cao <input type="number" data-board-height step="0.1"> mm</label>
				<button type="button" data-action="apply-board">Cập nhật kích thước</button>
				<textarea data-import-json placeholder="Dán JSON để import"></textarea>
				<button type="button" data-action="import">Nhập JSON</button>
			</aside>
		</div>
		<div class="dat-pcb-status">
			<span data-status-save>Chưa lưu</span>
			<span>Tọa độ: <strong data-status-coord>0, 0 mm</strong></span>
			<span>Zoom: <strong data-status-zoom>100%</strong></span>
			<span>Công cụ: <strong data-status-tool>select</strong></span>
			<span title="Phiên bản plugin - dùng để kiểm tra đã upload bản mới chưa">Bản: <strong>v<?php echo esc_html( DAT_PCB_TRACER_VERSION ); ?></strong></span>
		</div>
		<div class="dat-pcb-modal" data-modal hidden>
			<div class="dat-pcb-modal-box">
				<button type="button" class="dat-modal-close" data-modal-close>Đóng</button>
				<div data-modal-content></div>
			</div>
		</div>
		<div class="dat-pcb-account-template" hidden>
			<div class="dat-pcb-account-panel" data-pcb-account-panel>
				<h2>Tài khoản</h2>
				<?php if ( is_user_logged_in() ) : ?>
					<p><strong><?php echo esc_html( $dat_pcb_current_user->display_name ? $dat_pcb_current_user->display_name : $dat_pcb_current_user->user_login ); ?></strong></p>
					<?php if ( class_exists( 'DAT_Esms_Phone_Auth' ) ) : ?>
						<p>Số điện thoại: <strong><?php echo esc_html( get_user_meta( get_current_user_id(), DAT_Esms_Phone_Auth::META_PHONE, true ) ?: 'Chưa có' ); ?></strong></p>
						<p>Trạng thái: <strong><?php echo $dat_pcb_phone_verified ? 'Đã xác thực' : 'Chưa xác thực'; ?></strong></p>
						<?php if ( ! $dat_pcb_phone_verified ) : ?>
							<?php echo do_shortcode( '[dat_phone_auth]' ); ?>
						<?php endif; ?>
					<?php else : ?>
						<p>Plugin DAT eSMS Phone Auth chưa được kích hoạt.</p>
					<?php endif; ?>
					<p><a class="dat-pcb-account-link" href="<?php echo esc_url( wp_logout_url( home_url( '/' ) ) ); ?>">Đăng xuất</a></p>
				<?php else : ?>
					<?php if ( class_exists( 'DAT_Esms_Phone_Auth' ) ) : ?>
						<?php echo do_shortcode( '[dat_phone_auth]' ); ?>
					<?php else : ?>
						<p>Bạn cần đăng nhập để lưu và quản lý dự án PCB.</p>
						<p><a class="dat-pcb-account-link" href="<?php echo esc_url( wp_login_url( get_permalink() ) ); ?>">Đăng nhập WordPress</a></p>
					<?php endif; ?>
				<?php endif; ?>
			</div>
		</div>
	</div>
</div>
