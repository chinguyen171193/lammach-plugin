<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class LM_AI_Office_Admin {
	private $pages = array( 'lm-ai-office' => 'Tổng quan', 'lm-ai-office-characters' => 'Nhân vật', 'lm-ai-office-animation-library' => 'Thư viện chuyển động', 'lm-ai-office-assets' => 'Thư viện tài sản', 'lm-ai-office-departments' => 'Phòng ban', 'lm-ai-office-agents' => 'Nhân viên và AI Agent', 'lm-ai-office-supervisor-studio' => 'Tạo Supervisor', 'lm-ai-office-workflows' => 'Workflow', 'lm-ai-office-interface' => 'Giao diện', 'lm-ai-office-connections' => 'Kết nối dữ liệu', 'lm-ai-office-logs' => 'Nhật ký', 'lm-ai-office-preview' => 'Xem trước', 'lm-ai-office-settings' => 'Cài đặt' );
	public function __construct() { add_action( 'admin_menu', array( $this, 'menu' ) ); add_action( 'admin_init', array( $this, 'settings' ) ); add_action( 'admin_post_lm_ai_office_reset', array( $this, 'reset' ) ); add_action( 'admin_post_lm_ai_office_animation_add', array( $this, 'animation_add' ) ); add_action( 'admin_post_lm_ai_office_animation_remove', array( $this, 'animation_remove' ) ); add_action( 'admin_post_lm_ai_office_character_model_save', array( $this, 'character_model_save' ) ); add_action( 'admin_post_lm_ai_office_asset_save', array( $this, 'asset_save' ) ); add_action( 'admin_post_lm_ai_office_asset_delete', array( $this, 'asset_delete' ) ); }
	public function menu() {
		add_menu_page( 'AI Office', 'AI Office', 'manage_options', 'lm-ai-office', array( $this, 'page' ), 'dashicons-building', 58 );
		foreach ( array_slice( $this->pages, 1, null, true ) as $slug => $title ) { add_submenu_page( 'lm-ai-office', $title, $title, 'manage_options', $slug, array( $this, 'page' ) ); }
	}
	public function settings() { register_setting( 'lm_ai_office_settings', LM_AI_OFFICE_OPTION, array( $this, 'sanitize' ) ); }
	public function sanitize( $input ) {
		$defaults = wp_parse_args( get_option( LM_AI_OFFICE_OPTION, array() ), LM_AI_Office::default_settings() ); $input = is_array( $input ) ? $input : array(); $out = $defaults;
		foreach ( array( 'company_name', 'model_name', 'background_color', 'ui_color', 'connection_mode', 'custom_endpoint' ) as $key ) { $out[ $key ] = 'custom_endpoint' === $key ? esc_url_raw( $input[ $key ] ?? '' ) : sanitize_text_field( $input[ $key ] ?? $defaults[ $key ] ); }
		$out['max_agents'] = min( 80, max( 4, absint( $input['max_agents'] ?? $defaults['max_agents'] ) ) ); $out['animation_speed'] = min( 3, max( 0.25, (float) ( $input['animation_speed'] ?? 1 ) ) ); $out['fps_max'] = in_array( absint( $input['fps_max'] ?? 60 ), array( 30, 45, 60 ), true ) ? absint( $input['fps_max'] ) : 60;
		foreach ( array( 'dashboard_enabled', 'log_enabled', 'auto_camera', 'sound_enabled', 'day_night_enabled', 'low_performance', 'mobile_mode', 'show_names', 'show_bubbles', 'debug', 'delete_on_uninstall' ) as $key ) { $out[ $key ] = ! empty( $input[ $key ] ); }
		$appearance = is_array( $input['supervisor_appearance'] ?? null ) ? $input['supervisor_appearance'] : array();
		$out['supervisor_appearance'] = LM_AI_Office::default_supervisor_appearance();
		foreach ( array( 'skin_color', 'hair_color', 'suit_color', 'tie_color' ) as $key ) {
			$color = sanitize_hex_color( $appearance[ $key ] ?? '' );
			if ( $color ) { $out['supervisor_appearance'][ $key ] = $color; }
		}
		return $out;
	}
	public function reset() { if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Không đủ quyền.' ); } check_admin_referer( 'lm_ai_office_reset' ); LM_AI_Office::reset_demo_data(); wp_safe_redirect( admin_url( 'admin.php?page=lm-ai-office&reset=1' ) ); exit; }
	private function animation_redirect( $notice ) { wp_safe_redirect( add_query_arg( array( 'page' => 'lm-ai-office-animation-library', 'animation_notice' => rawurlencode( $notice ) ), admin_url( 'admin.php' ) ) ); exit; }
	public function animation_add() { if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Không đủ quyền.' ); } check_admin_referer( 'lm_ai_office_animation_add' ); $result = LM_AI_Office_Animations::add( sanitize_key( $_POST['employee'] ?? '' ), strtoupper( sanitize_key( $_POST['action_key'] ?? '' ) ), absint( $_POST['attachment_id'] ?? 0 ) ); $this->animation_redirect( is_wp_error( $result ) ? $result->get_error_message() : 'Đã lưu chuyển động.' ); }
	public function animation_remove() { if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Không đủ quyền.' ); } check_admin_referer( 'lm_ai_office_animation_remove' ); $result = LM_AI_Office_Animations::remove( sanitize_key( $_POST['employee'] ?? '' ), strtoupper( sanitize_key( $_POST['action_key'] ?? '' ) ), absint( $_POST['variant_index'] ?? 0 ) ); $this->animation_redirect( is_wp_error( $result ) ? $result->get_error_message() : 'Đã xóa liên kết chuyển động.' ); }
	public function character_model_save() { if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Không đủ quyền.' ); } check_admin_referer( 'lm_ai_office_character_model_save' ); $result = LM_AI_Office_Characters::set_model( sanitize_key( $_POST['employee'] ?? '' ), absint( $_POST['attachment_id'] ?? 0 ) ); wp_safe_redirect( add_query_arg( array( 'page' => 'lm-ai-office-characters', 'character_notice' => rawurlencode( is_wp_error( $result ) ? $result->get_error_message() : 'Đã lưu model nhân vật.' ) ), admin_url( 'admin.php' ) ) ); exit; }
	private function asset_redirect( $notice, $asset_id = '' ) { $args = array( 'page' => 'lm-ai-office-assets', 'asset_notice' => $notice ); if ( $asset_id ) { $args['edit'] = $asset_id; } wp_safe_redirect( add_query_arg( $args, admin_url( 'admin.php' ) ) ); exit; }
	public function asset_save() {
		if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Không đủ quyền.' ); }
		check_admin_referer( 'lm_ai_office_asset_save' );
		$raw_asset_id = $_POST['asset_id'] ?? '';
		$asset_id = is_scalar( $raw_asset_id ) ? sanitize_key( wp_unslash( $raw_asset_id ) ) : '';
		$input = array(
			'name'                     => $_POST['name'] ?? '',
			'category'                 => $_POST['category'] ?? 'OTHER',
			'model_attachment_id'      => $_POST['model_attachment_id'] ?? 0,
			'thumbnail_id'             => $_POST['thumbnail_id'] ?? 0,
			'source'                   => $_POST['source'] ?? '',
			'author'                   => $_POST['author'] ?? '',
			'license'                  => $_POST['license'] ?? '',
			'source_url'               => $_POST['source_url'] ?? '',
			'notes'                    => $_POST['notes'] ?? '',
			'interaction_type'         => $_POST['interaction_type'] ?? '',
			'default_scale'            => $_POST['default_scale'] ?? 1,
			'default_rotation_degrees' => $_POST['default_rotation_degrees'] ?? 0,
			'floor_offset'             => $_POST['floor_offset'] ?? 0,
		);
		$result = $asset_id ? LM_AI_Office_Asset_Library::update( $asset_id, $input ) : LM_AI_Office_Asset_Library::create( $input );
		$redirect_id = ! is_wp_error( $result ) ? sanitize_key( $result['id'] ?? $asset_id ) : $asset_id;
		$this->asset_redirect( is_wp_error( $result ) ? $result->get_error_message() : ( $asset_id ? 'Đã lưu tài sản.' : 'Đã thêm tài sản.' ), $redirect_id );
	}
	public function asset_delete() { if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Không đủ quyền.' ); } check_admin_referer( 'lm_ai_office_asset_delete' ); $raw_asset_id = $_POST['asset_id'] ?? ''; $asset_id = is_scalar( $raw_asset_id ) ? sanitize_key( wp_unslash( $raw_asset_id ) ) : ''; $result = LM_AI_Office_Asset_Library::delete( $asset_id ); $this->asset_redirect( is_wp_error( $result ) ? $result->get_error_message() : 'Đã xóa tài sản khỏi Thư viện tài sản.' ); }
	public function page() {
		if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Không đủ quyền.' ); }
		$page = sanitize_key( $_GET['page'] ?? 'lm-ai-office' ); $view = str_replace( 'lm-ai-office-', '', $page ); $view = 'lm-ai-office' === $page ? 'settings' : $view;
		$data = LM_AI_Office::dataset(); $settings = LM_AI_Office::settings();
		include LM_AI_OFFICE_DIR . 'admin/views/' . ( in_array( $view, array( 'settings', 'characters', 'animation-library', 'assets', 'departments', 'agents', 'supervisor-studio', 'workflows', 'interface', 'connections', 'logs', 'preview' ), true ) ? $view : 'settings' ) . '.php';
	}
}
