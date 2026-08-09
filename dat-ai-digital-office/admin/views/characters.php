<?php if ( ! defined( 'ABSPATH' ) ) { exit; }
$characters = DAT_AI_Office_Characters::definitions(); $actions = DAT_AI_Office_Animations::actions(); $notice = sanitize_text_field( wp_unslash( $_GET['character_notice'] ?? '' ) );
?>
<div class="wrap dat-ai-office-admin"><h1>Nhân vật</h1>
<?php if ( $notice ) : ?><div class="notice notice-info is-dismissible"><p><?php echo esc_html( $notice ); ?></p></div><?php endif; ?>
<p>Nhân vật dùng chung NPC engine, bộ điều khiển và Thư viện chuyển động. Mỗi nhân vật chỉ khác cấu hình model và vai trò.</p>
<div class="dat-ai-office-animation-list">
<?php foreach ( $characters as $character ) : $model = $character['model']; $assets = DAT_AI_Office_Animations::assets( $character['id'] ); $profile = DAT_AI_Office_Characters::profiles()[ $character['animation_profile'] ]; ?>
<article class="dat-ai-office-animation-card"><h2><?php echo esc_html( $character['name'] ); ?></h2>
<p><strong>Chức vụ:</strong> <?php echo esc_html( $character['role'] ); ?></p>
<p><strong>Trạng thái:</strong> Chờ việc</p>
<p><strong>Model nhân vật:</strong> <?php echo esc_html( $model['available'] ? $model['label'] : 'Chưa có model' ); ?></p>
<p><strong>Bộ chuyển động:</strong> <?php echo esc_html( $profile['label'] ); ?></p>
<p><strong>Tình trạng skeleton:</strong> <?php echo esc_html( $character['skeleton_status'] ); ?></p>
<p><strong>Hồ sơ chuyển xương:</strong> <?php echo esc_html( $character['animation_profile'] ); ?></p>
<?php if ( 'employee_002' === $character['id'] ) : ?><p class="description">Dùng nút “Xem tư thế gốc” và “Hiện bộ xương” trong NPC Test để kiểm tra model trước/sau khi áp chuyển động.</p><?php endif; ?>
<?php if ( ! $model['available'] ) : ?><p class="description">Đặt file Ultimate Modular Women Pack tại <code>public/assets/characters/employee_002/employee_002.fbx</code>, hoặc tải qua Media Library bên dưới.</p><?php endif; ?>
<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="dat-ai-office-character-model-form"><?php wp_nonce_field( 'dat_ai_office_character_model_save' ); ?><input type="hidden" name="action" value="dat_ai_office_character_model_save"><input type="hidden" name="employee" value="<?php echo esc_attr( $character['id'] ); ?>"><input type="hidden" name="attachment_id" value="" data-character-model-attachment><button type="button" class="button" data-character-model-select><?php echo esc_html( $model['available'] ? 'Thay model' : 'Tải tệp lên' ); ?></button> <span data-character-model-file><?php echo esc_html( $model['available'] ? $model['label'] : 'Chưa chọn tệp' ); ?></span> <button type="submit" class="button button-primary" disabled>Lưu</button></form>
<details><summary>Trạng thái chuyển động</summary><table class="widefat striped"><thead><tr><th>Hành động</th><th>Trạng thái</th></tr></thead><tbody><?php foreach ( $actions as $key => $action ) : ?><tr><td><?php echo esc_html( $action['label'] ); ?></td><td><?php echo esc_html( ! empty( $assets[ $key ] ) ? 'Sẵn sàng' : 'Chưa có chuyển động' ); ?></td></tr><?php endforeach; ?></tbody></table></details>
</article><?php endforeach; ?>
</div></div>
