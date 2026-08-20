<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$notice     = sanitize_text_field( wp_unslash( $_GET['asset_notice'] ?? '' ) );
$edit_id    = sanitize_key( wp_unslash( $_GET['edit'] ?? '' ) );
$show_form  = isset( $_GET['new'] ) || (bool) $edit_id;
$editing    = $edit_id ? LM_AI_Office_Asset_Library::asset( $edit_id ) : null;
$definitions = LM_AI_Office_Asset_Library::definitions();
$by_id      = array();
foreach ( $definitions as $definition ) {
	$by_id[ $definition['id'] ] = $definition;
}

$asset = is_array( $editing ) ? $editing : array(
	'id' => '', 'name' => '', 'category' => 'TABLE', 'attachment_id' => 0, 'thumbnail_id' => 0,
	'source' => '', 'author' => '', 'license' => '', 'source_url' => '',
	'metadata' => array( 'notes' => '', 'interaction_type' => null ),
	'transform_defaults' => array( 'scale' => 1, 'rotation_y' => 0, 'floor_offset' => 0 ),
);
$current_definition = ! empty( $asset['id'] ) ? ( $by_id[ $asset['id'] ] ?? array() ) : array();
$model_url          = $current_definition['model']['url'] ?? '';
$thumbnail_url      = $current_definition['thumbnail']['url'] ?? '';
$model_label        = $asset['attachment_id'] ? ( $current_definition['name'] ?? 'Tệp GLB đã chọn' ) : 'Chưa chọn tệp GLB';
$thumbnail_label    = $asset['thumbnail_id'] ? 'Ảnh đại diện đã chọn' : 'Chưa có ảnh';
$cancel_url         = admin_url( 'admin.php?page=lm-ai-office-assets' );
?>
<div class="wrap lm-ai-office-admin lm-ai-office-assets">
	<h1 class="wp-heading-inline">Thư viện tài sản</h1>
	<?php if ( ! $show_form ) : ?>
		<a href="<?php echo esc_url( add_query_arg( array( 'page' => 'lm-ai-office-assets', 'new' => 1 ), admin_url( 'admin.php' ) ) ); ?>" class="page-title-action">Thêm tài sản</a>
	<?php endif; ?>
	<hr class="wp-header-end">
	<?php if ( $notice ) : ?><div class="notice notice-info is-dismissible"><p><?php echo esc_html( $notice ); ?></p></div><?php endif; ?>

	<?php if ( $show_form ) : ?>
		<section class="lm-ai-office-panel lm-ai-office-asset-form-panel">
			<h2><?php echo $editing ? 'Sửa tài sản' : 'Thêm tài sản'; ?></h2>
			<p>V1 chỉ hỗ trợ tệp <strong>.glb</strong>. Tệp FBX, OBJ và GLTF sẽ bị từ chối.</p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="lm-ai-office-asset-form" data-asset-form>
				<?php wp_nonce_field( 'lm_ai_office_asset_save' ); ?>
				<input type="hidden" name="action" value="lm_ai_office_asset_save">
				<input type="hidden" name="asset_id" value="<?php echo esc_attr( $asset['id'] ); ?>">
				<div class="lm-ai-office-asset-form__grid">
					<label>Tên tài sản<input type="text" name="name" required maxlength="190" value="<?php echo esc_attr( $asset['name'] ); ?>"></label>
					<label>Loại tài sản<select name="category">
						<?php foreach ( LM_AI_Office_Asset_Library::categories() as $key => $label ) : ?><option value="<?php echo esc_attr( $key ); ?>" <?php selected( $asset['category'], $key ); ?>><?php echo esc_html( $label ); ?></option><?php endforeach; ?>
					</select></label>
					<div class="lm-ai-office-asset-file-field"><span class="lm-ai-office-asset-file-field__label">Tệp mô hình 3D</span><input type="hidden" name="model_attachment_id" value="<?php echo esc_attr( $asset['attachment_id'] ); ?>" data-asset-model-id><button type="button" class="button" data-asset-select-model>Tải mô hình lên</button><span data-asset-model-label><?php echo esc_html( $model_label ); ?></span><button type="button" class="button button-secondary" data-asset-preview data-asset-preview-url="<?php echo esc_url( $model_url ); ?>" <?php disabled( ! $model_url ); ?>>Xem thử</button></div>
					<div class="lm-ai-office-asset-file-field"><span class="lm-ai-office-asset-file-field__label">Ảnh đại diện</span><input type="hidden" name="thumbnail_id" value="<?php echo esc_attr( $asset['thumbnail_id'] ); ?>" data-asset-thumbnail-id><button type="button" class="button" data-asset-select-thumbnail>Chọn ảnh đại diện</button><span data-asset-thumbnail-label><?php echo esc_html( $thumbnail_label ); ?></span></div>
					<label>Nguồn<input type="text" name="source" maxlength="190" value="<?php echo esc_attr( $asset['source'] ); ?>"></label>
					<label>Tác giả<input type="text" name="author" maxlength="190" value="<?php echo esc_attr( $asset['author'] ); ?>"></label>
					<label>Giấy phép<input type="text" name="license" maxlength="190" placeholder="Ví dụ: CC0" value="<?php echo esc_attr( $asset['license'] ); ?>"></label>
					<label>Link nguồn<input type="url" name="source_url" maxlength="500" value="<?php echo esc_attr( $asset['source_url'] ); ?>"></label>
					<label>Tỷ lệ mặc định<input type="number" name="default_scale" step="0.01" min="0.01" max="100" value="<?php echo esc_attr( $asset['transform_defaults']['scale'] ); ?>"></label>
					<label>Góc xoay mặc định<input type="number" name="default_rotation_degrees" step="1" min="-360000" max="360000" value="<?php echo esc_attr( round( (float) $asset['transform_defaults']['rotation_y'] * 180 / M_PI, 4 ) ); ?>"><small>Độ, chỉ xoay trục Y.</small></label>
					<label>Độ lệch sàn<input type="number" name="floor_offset" step="0.001" min="-1000" max="1000" data-asset-floor-offset value="<?php echo esc_attr( $asset['transform_defaults']['floor_offset'] ); ?>"><small>Dùng “Đặt xuống sàn” trong phần xem thử để tính giá trị này.</small></label>
					<label>Loại tương tác (để dành)<input type="text" name="interaction_type" maxlength="64" value="<?php echo esc_attr( $asset['metadata']['interaction_type'] ?? '' ); ?>"><small>V1 không thực thi Smart Object.</small></label>
				</div>
				<label class="lm-ai-office-asset-notes">Ghi chú<textarea name="notes" rows="4"><?php echo esc_textarea( $asset['metadata']['notes'] ?? '' ); ?></textarea></label>
				<?php if ( $thumbnail_url ) : ?><img class="lm-ai-office-asset-form__thumb" data-asset-thumbnail-preview src="<?php echo esc_url( $thumbnail_url ); ?>" alt="Ảnh đại diện đã chọn"><?php else : ?><img class="lm-ai-office-asset-form__thumb" data-asset-thumbnail-preview hidden alt="Ảnh đại diện đã chọn"><?php endif; ?>
				<p class="submit"><button type="submit" class="button button-primary">Lưu</button> <a class="button" href="<?php echo esc_url( $cancel_url ); ?>">Hủy</a></p>
			</form>
		</section>
	<?php else : ?>
		<p class="description">Tài sản được lưu bằng ID ổn định, còn model GLB luôn ở Media Library. Bạn có thể thay thế model mà không đổi asset ID.</p>
		<?php if ( empty( $definitions ) ) : ?>
			<section class="lm-ai-office-panel"><p><strong>Chưa có tài sản.</strong></p><p>Chọn <em>Thêm tài sản</em> để tải một model bàn GLB đầu tiên.</p></section>
		<?php else : ?>
			<div class="lm-ai-office-asset-list">
				<?php foreach ( $definitions as $definition ) : ?>
					<article class="lm-ai-office-asset-card" data-asset-id="<?php echo esc_attr( $definition['id'] ); ?>">
						<div class="lm-ai-office-asset-card__thumb<?php echo empty( $definition['thumbnail'] ) ? ' is-empty' : ''; ?>">
							<?php if ( ! empty( $definition['thumbnail']['url'] ) ) : ?><img src="<?php echo esc_url( $definition['thumbnail']['url'] ); ?>" alt=""><?php else : ?><span>Chưa có ảnh</span><?php endif; ?>
						</div>
						<div class="lm-ai-office-asset-card__body"><h2><?php echo esc_html( $definition['name'] ); ?></h2><p><?php echo esc_html( $definition['categoryLabel'] ); ?> · <span class="lm-ai-office-asset-status is-<?php echo esc_attr( $definition['status'] ); ?>"><?php echo esc_html( $definition['statusLabel'] ); ?></span><?php if ( $definition['isUsed'] ) : ?> · <span class="lm-ai-office-asset-status is-used">Đã sử dụng</span><?php endif; ?></p><p class="description">ID: <code><?php echo esc_html( $definition['id'] ); ?></code></p><p class="description"><?php echo esc_html( $definition['license']['type'] ? 'Giấy phép: ' . $definition['license']['type'] : 'Chưa có thông tin giấy phép' ); ?></p></div>
						<div class="lm-ai-office-asset-card__actions"><button type="button" class="button" data-asset-preview data-asset-preview-url="<?php echo esc_url( $definition['model']['url'] ); ?>" <?php disabled( empty( $definition['model']['available'] ) ); ?>>Xem thử</button><a class="button" href="<?php echo esc_url( add_query_arg( array( 'page' => 'lm-ai-office-assets', 'edit' => $definition['id'] ), admin_url( 'admin.php' ) ) ); ?>">Sửa</a><form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return window.confirm('Chỉ xóa tài sản khỏi thư viện, không xóa tệp Media. Bạn có chắc chắn?');"><?php wp_nonce_field( 'lm_ai_office_asset_delete' ); ?><input type="hidden" name="action" value="lm_ai_office_asset_delete"><input type="hidden" name="asset_id" value="<?php echo esc_attr( $definition['id'] ); ?>"><button type="submit" class="button button-link-delete">Xóa</button></form></div>
					</article>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>
	<?php endif; ?>

	<div class="lm-ai-office-asset-preview" data-asset-preview-modal hidden>
		<div class="lm-ai-office-asset-preview__dialog" role="dialog" aria-modal="true" aria-labelledby="lm-ai-office-asset-preview-title">
			<button type="button" class="button-link" data-asset-preview-close>Đóng</button>
			<h2 id="lm-ai-office-asset-preview-title">Xem thử model</h2>
			<p data-asset-preview-status>Đang kiểm tra…</p>
			<div class="lm-ai-office-asset-preview__canvas" data-asset-preview-canvas></div>
			<dl class="lm-ai-office-asset-preview__metrics"><div><dt>Rộng</dt><dd data-asset-size-x>—</dd></div><div><dt>Cao</dt><dd data-asset-size-y>—</dd></div><div><dt>Sâu</dt><dd data-asset-size-z>—</dd></div><div><dt>Mesh</dt><dd data-asset-mesh-count>—</dd></div><div><dt>Material</dt><dd data-asset-material-count>—</dd></div><div><dt>Texture</dt><dd data-asset-texture-count>—</dd></div></dl>
			<div class="lm-ai-office-asset-preview__controls"><button type="button" class="button" data-asset-preview-floor>Đặt xuống sàn</button><button type="button" class="button" data-asset-preview-control="rotate-left">Xoay trái</button><button type="button" class="button" data-asset-preview-control="rotate-right">Xoay phải</button><button type="button" class="button" data-asset-preview-control="zoom-in">Phóng to</button><button type="button" class="button" data-asset-preview-control="zoom-out">Thu nhỏ</button><button type="button" class="button" data-asset-preview-control="reset">Đặt lại góc nhìn</button></div>
			<p class="description">Kéo để xoay camera, lăn chuột để phóng to/thu nhỏ. “Đặt xuống sàn” chỉ cập nhật độ lệch sàn trong form; tệp GLB không bị chỉnh sửa.</p>
		</div>
	</div>
</div>
