<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class DAT_AI_Office_Admin {
	private $pages = array( 'dat-ai-office' => 'Tổng quan', 'dat-ai-office-characters' => 'Nhân vật', 'dat-ai-office-animation-library' => 'Thư viện chuyển động', 'dat-ai-office-departments' => 'Phòng ban', 'dat-ai-office-agents' => 'Nhân viên và AI Agent', 'dat-ai-office-supervisor-studio' => 'Tạo Supervisor', 'dat-ai-office-workflows' => 'Workflow', 'dat-ai-office-interface' => 'Giao diện', 'dat-ai-office-connections' => 'Kết nối dữ liệu', 'dat-ai-office-logs' => 'Nhật ký', 'dat-ai-office-preview' => 'Xem trước', 'dat-ai-office-settings' => 'Cài đặt' );
	public function __construct() { add_action( 'admin_menu', array( $this, 'menu' ) ); add_action( 'admin_init', array( $this, 'settings' ) ); add_action( 'admin_post_dat_ai_office_reset', array( $this, 'reset' ) ); add_action( 'admin_post_dat_ai_office_animation_add', array( $this, 'animation_add' ) ); add_action( 'admin_post_dat_ai_office_animation_remove', array( $this, 'animation_remove' ) ); }
	public function menu() {
		add_menu_page( 'DAT AI Office', 'DAT AI Office', 'manage_options', 'dat-ai-office', array( $this, 'page' ), 'dashicons-building', 58 );
		foreach ( array_slice( $this->pages, 1, null, true ) as $slug => $title ) { add_submenu_page( 'dat-ai-office', $title, $title, 'manage_options', $slug, array( $this, 'page' ) ); }
	}
	public function settings() { register_setting( 'dat_ai_office_settings', DAT_AI_OFFICE_OPTION, array( $this, 'sanitize' ) ); }
	public function sanitize( $input ) {
		$defaults = wp_parse_args( get_option( DAT_AI_OFFICE_OPTION, array() ), DAT_AI_Office::default_settings() ); $input = is_array( $input ) ? $input : array(); $out = $defaults;
		foreach ( array( 'company_name', 'model_name', 'background_color', 'ui_color', 'connection_mode', 'custom_endpoint' ) as $key ) { $out[ $key ] = 'custom_endpoint' === $key ? esc_url_raw( $input[ $key ] ?? '' ) : sanitize_text_field( $input[ $key ] ?? $defaults[ $key ] ); }
		$out['max_agents'] = min( 80, max( 4, absint( $input['max_agents'] ?? $defaults['max_agents'] ) ) ); $out['animation_speed'] = min( 3, max( 0.25, (float) ( $input['animation_speed'] ?? 1 ) ) ); $out['fps_max'] = in_array( absint( $input['fps_max'] ?? 60 ), array( 30, 45, 60 ), true ) ? absint( $input['fps_max'] ) : 60;
		foreach ( array( 'dashboard_enabled', 'log_enabled', 'auto_camera', 'sound_enabled', 'day_night_enabled', 'low_performance', 'mobile_mode', 'show_names', 'show_bubbles', 'debug', 'delete_on_uninstall' ) as $key ) { $out[ $key ] = ! empty( $input[ $key ] ); }
		$appearance = is_array( $input['supervisor_appearance'] ?? null ) ? $input['supervisor_appearance'] : array();
		$out['supervisor_appearance'] = DAT_AI_Office::default_supervisor_appearance();
		foreach ( array( 'skin_color', 'hair_color', 'suit_color', 'tie_color' ) as $key ) {
			$color = sanitize_hex_color( $appearance[ $key ] ?? '' );
			if ( $color ) { $out['supervisor_appearance'][ $key ] = $color; }
		}
		return $out;
	}
	public function reset() { if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Không đủ quyền.' ); } check_admin_referer( 'dat_ai_office_reset' ); DAT_AI_Office::reset_demo_data(); wp_safe_redirect( admin_url( 'admin.php?page=dat-ai-office&reset=1' ) ); exit; }
	private function animation_redirect( $notice ) { wp_safe_redirect( add_query_arg( array( 'page' => 'dat-ai-office-animation-library', 'animation_notice' => rawurlencode( $notice ) ), admin_url( 'admin.php' ) ) ); exit; }
	public function animation_add() { if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Không đủ quyền.' ); } check_admin_referer( 'dat_ai_office_animation_add' ); $result = DAT_AI_Office_Animations::add( sanitize_key( $_POST['employee'] ?? '' ), strtoupper( sanitize_key( $_POST['action_key'] ?? '' ) ), absint( $_POST['attachment_id'] ?? 0 ) ); $this->animation_redirect( is_wp_error( $result ) ? $result->get_error_message() : 'Đã lưu chuyển động.' ); }
	public function animation_remove() { if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Không đủ quyền.' ); } check_admin_referer( 'dat_ai_office_animation_remove' ); $result = DAT_AI_Office_Animations::remove( sanitize_key( $_POST['employee'] ?? '' ), strtoupper( sanitize_key( $_POST['action_key'] ?? '' ) ), absint( $_POST['variant_index'] ?? 0 ) ); $this->animation_redirect( is_wp_error( $result ) ? $result->get_error_message() : 'Đã xóa liên kết chuyển động.' ); }
	public function page() {
		if ( ! current_user_can( 'manage_options' ) ) { wp_die( 'Không đủ quyền.' ); }
		$page = sanitize_key( $_GET['page'] ?? 'dat-ai-office' ); $view = str_replace( 'dat-ai-office-', '', $page ); $view = 'dat-ai-office' === $page ? 'settings' : $view;
		$data = DAT_AI_Office::dataset(); $settings = DAT_AI_Office::settings();
		include DAT_AI_OFFICE_DIR . 'admin/views/' . ( in_array( $view, array( 'settings', 'characters', 'animation-library', 'departments', 'agents', 'supervisor-studio', 'workflows', 'interface', 'connections', 'logs', 'preview' ), true ) ? $view : 'settings' ) . '.php';
	}
}
