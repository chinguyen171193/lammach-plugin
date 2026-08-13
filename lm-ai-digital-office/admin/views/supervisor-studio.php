<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

$appearance = LM_AI_Office::supervisor_appearance();
?>
<div class="wrap lm-ai-office-admin lm-ai-office-supervisor-studio">
	<h1>Tạo LM Supervisor</h1>
	<p class="description">Bản đầu sử dụng chính model <code>Suit.gltf</code> có animation cơ thể gốc. Các điều khiển dưới đây đổi trực tiếp material Skin, Hair, Eyebrows, Suit và Tie của model; không tạo kiểu tóc hoặc trang phục giả.</p>

	<div class="lm-ai-office-supervisor-studio__layout">
		<section class="lm-ai-office-supervisor-studio__controls lm-ai-office-panel">
			<h2>Diện mạo</h2>
			<form method="post" action="options.php">
				<?php settings_fields( 'lm_ai_office_settings' ); ?>
				<div class="lm-ai-office-supervisor-studio__field">
					<label for="lm-supervisor-skin">Màu da</label>
					<input id="lm-supervisor-skin" type="color" name="<?php echo esc_attr( LM_AI_OFFICE_OPTION ); ?>[supervisor_appearance][skin_color]" value="<?php echo esc_attr( $appearance['skin_color'] ); ?>">
				</div>
				<div class="lm-ai-office-supervisor-studio__field">
					<label for="lm-supervisor-hair">Màu tóc và lông mày</label>
					<input id="lm-supervisor-hair" type="color" name="<?php echo esc_attr( LM_AI_OFFICE_OPTION ); ?>[supervisor_appearance][hair_color]" value="<?php echo esc_attr( $appearance['hair_color'] ); ?>">
				</div>
				<div class="lm-ai-office-supervisor-studio__field">
					<label for="lm-supervisor-suit">Màu vest</label>
					<input id="lm-supervisor-suit" type="color" name="<?php echo esc_attr( LM_AI_OFFICE_OPTION ); ?>[supervisor_appearance][suit_color]" value="<?php echo esc_attr( $appearance['suit_color'] ); ?>">
				</div>
				<div class="lm-ai-office-supervisor-studio__field">
					<label for="lm-supervisor-tie">Màu cà vạt</label>
					<input id="lm-supervisor-tie" type="color" name="<?php echo esc_attr( LM_AI_OFFICE_OPTION ); ?>[supervisor_appearance][tie_color]" value="<?php echo esc_attr( $appearance['tie_color'] ); ?>">
				</div>
				<?php submit_button( 'Lưu diện mạo Supervisor' ); ?>
			</form>
			<p class="description">Lưu xong, trang Nhân viên và AI Agent cùng mô hình ngoài frontend sẽ dùng diện mạo này. Kiểu tóc, khuôn mặt và bộ quần áo thay thế cần mesh 3D tương thích skeleton Suit nên chưa hiển thị cho đến khi có asset thật.</p>
		</section>

		<section class="lm-ai-office-supervisor-studio__preview lm-ai-office-panel" aria-label="Xem trước LM Supervisor">
			<h2>Xem trước toàn thân</h2>
			<article class="lm-ai-office-agent-card" data-agent-card data-agent-id="ai_1" data-agent-state="idle" style="--agent-accent:#b388ff">
				<div class="lm-ai-office-agent-card__top"><span class="lm-ai-office-agent-card__department">AI CENTER</span><span class="lm-ai-office-agent-card__status" data-agent-status>idle</span></div>
				<div class="lm-agent-sprite" data-agent-sprite data-agent-id="ai_1" data-sprite-id="supervisor-ai" data-agent-state="idle"><div class="lm-agent-sprite__surface" data-agent-sprite-surface></div><div class="lm-agent-sprite__fallback" aria-hidden="true"></div></div>
				<div class="lm-ai-office-agent-card__identity"><h3>LM Supervisor AI</h3><p>AI Operations Supervisor</p></div>
			</article>
		</section>
	</div>
</div>
