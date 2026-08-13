<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LM_PCB_Admin {
	private $project;
	private $ai;
	private $hook_suffixes = array();

	public function __construct( LM_PCB_Project $project, LM_PCB_AI $ai ) {
		$this->project = $project;
		$this->ai      = $ai;
	}

	public function render_ai_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Khong du quyen.', 'lm-pcb-image-tracer' ) );
		}
		if ( isset( $_POST['lm_pcb_tracer_save_settings'] ) ) {
			check_admin_referer( 'lm_pcb_tracer_settings' );
			$this->ai->update_settings(
				isset( $_POST['lm_pcb_openai_api_key'] ) ? wp_unslash( $_POST['lm_pcb_openai_api_key'] ) : '',
				isset( $_POST['lm_pcb_openai_model'] ) ? wp_unslash( $_POST['lm_pcb_openai_model'] ) : '',
				! empty( $_POST['lm_pcb_clear_openai_api_key'] ),
				! empty( $_POST['lm_pcb_openai_web_search'] ),
				! empty( $_POST['lm_pcb_openai_debug'] )
			);
			if ( ! empty( $_POST['lm_pcb_clear_openai_log'] ) ) {
				$this->ai->clear_debug_log();
			}
			$lcsc_setting = new LM_PCB_LCSC();
			$lcsc_setting->set_enabled( ! empty( $_POST['lm_pcb_lcsc_enabled'] ) );
			echo '<div class="notice notice-success is-dismissible"><p>Da luu cai dat.</p></div>';
		}
		$model      = esc_attr( $this->ai->get_model() );
		$web_search = $this->ai->web_search_enabled();
		$debug      = $this->ai->debug_enabled();
		$lcsc_api   = new LM_PCB_LCSC();
		$lcsc       = $lcsc_api->is_enabled();
		echo '<div class="wrap">';
		echo '<h1>LM PCB Tracer - OpenAI</h1>';
		echo '<p>Cau hinh OpenAI de tao footprint linh kien tu ten linh kien hoac URL datasheet PDF.</p>';
		echo '<form method="post">';
		wp_nonce_field( 'lm_pcb_tracer_settings' );
		echo '<table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row"><label for="lm-pcb-openai-api-key">API key</label></th><td>';
		echo '<input id="lm-pcb-openai-api-key" name="lm_pcb_openai_api_key" type="password" class="regular-text" autocomplete="off" placeholder="' . ( $this->ai->has_api_key() ? 'Da cau hinh - nhap key moi de thay doi' : 'sk-...' ) . '">';
		echo '<p class="description">Key chi luu tren server WordPress, khong dua xuong JavaScript.</p>';
		if ( $this->ai->has_api_key() ) {
			echo '<label><input type="checkbox" name="lm_pcb_clear_openai_api_key" value="1"> Xoa API key hien tai</label>';
		}
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="lm-pcb-openai-model">Model</label></th><td>';
		echo '<input id="lm-pcb-openai-model" name="lm_pcb_openai_model" type="text" class="regular-text" value="' . $model . '">';
		echo '<p class="description">Mac dinh <code>gpt-5.6</code> (thong minh nhat, $5/$30 mot trieu token). Re hon: <code>gpt-5.6-terra</code> ($2.50/$15) hoac <code>gpt-5.6-luna</code> ($1/$6). Tra datasheet tren mang chi chay tu dong gpt-5.4 tro len.</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row">Tra cuu Internet</th><td>';
		echo '<label><input id="lm-pcb-openai-web-search" name="lm_pcb_openai_web_search" type="checkbox" value="1"' . checked( $web_search, true, false ) . '> Cho AI tu tim datasheet/pinout tren mang</label>';
		echo '<p class="description">Khi bat, AI se tu tra so chan va kich thuoc package cua linh kien la thay vi doan theo tri nho. <strong>Mac dinh tat vi rat ton tien</strong>: moi luot chat cham hon nhieu va thuong het han muc token cho phan tim kiem truoc khi kip ve linh kien - luot do khong ra ket qua nhung van bi tinh tien. Chi bat khi that su can tra datasheet.</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row">Thu vien LCSC</th><td>';
		echo '<label><input name="lm_pcb_lcsc_enabled" type="checkbox" value="1"' . checked( $lcsc, true, false ) . '> Lay footprint that theo ma linh kien</label>';
		echo '<p class="description">Khi bat, neu ma linh kien AI dua ra co trong thu vien LCSC thi dung so lieu that cua nha san xuat thay vi de AI tu dung theo ho package. Khong tim thay thi tu quay ve cach cu. Ket qua duoc cache 7 ngay.</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row">Go loi</th><td>';
		echo '<label><input id="lm-pcb-openai-debug" name="lm_pcb_openai_debug" type="checkbox" value="1"' . checked( $debug, true, false ) . '> Ghi lai luot goi AI gan nhat</label>';
		echo '<p class="description">Bat khi AI tra loi nhung khong ve gi, de xem model that su gui ve nhung lenh nao. Khong ghi API key. Tat di khi da xong.</p>';
		echo '</td></tr>';
		echo '</tbody></table>';
		submit_button( 'Luu cai dat', 'primary', 'lm_pcb_tracer_save_settings' );

		$log = $this->ai->get_debug_log();
		if ( '' !== $log ) {
			echo '<h2>Luot goi AI gan nhat</h2>';
			echo '<p class="description">Sao chep toan bo o duoi day khi can nho nguoi khac xem giup.</p>';
			echo '<textarea readonly rows="20" style="width:100%;font-family:monospace;font-size:12px" onclick="this.select()">' . esc_textarea( $log ) . '</textarea>';
			echo '<p><label><input type="checkbox" name="lm_pcb_clear_openai_log" value="1"> Xoa log nay khi luu</label></p>';
		}
		echo '</form>';
		echo '</div>';
	}

	public function register_menu() {
		$this->hook_suffixes[] = add_menu_page( 'LM PCB Tracer', 'LM PCB Tracer', 'edit_posts', 'lm-pcb-tracer', array( $this, 'render_projects_page' ), 'dashicons-media-code', 58 );
		$this->hook_suffixes[] = add_submenu_page( 'lm-pcb-tracer', 'OpenAI', 'OpenAI', 'manage_options', 'lm-pcb-tracer-openai', array( $this, 'render_ai_settings_page' ) );
		$this->hook_suffixes[] = add_submenu_page( 'lm-pcb-tracer', 'Dự án', 'Dự án', 'edit_posts', 'lm-pcb-tracer', array( $this, 'render_projects_page' ) );
		$this->hook_suffixes[] = add_submenu_page( 'lm-pcb-tracer', 'Tạo dự án mới', 'Tạo dự án mới', 'edit_posts', 'lm-pcb-tracer-new', array( $this, 'render_new_page' ) );
		$this->hook_suffixes[] = add_submenu_page( 'lm-pcb-tracer', 'Cài đặt', 'Cài đặt', 'manage_options', 'lm-pcb-tracer-settings', array( $this, 'render_settings_page' ) );
	}

	public function enqueue_assets( $hook ) {
		if ( ! in_array( $hook, $this->hook_suffixes, true ) ) {
			return;
		}
		$this->enqueue_editor_assets( isset( $_GET['project_id'] ) ? absint( $_GET['project_id'] ) : 0 );
	}

	public function enqueue_shortcode_assets() {
		global $post;
		if ( ! $post || empty( $post->post_content ) || ! has_shortcode( $post->post_content, 'lm_pcb_tracer' ) ) {
			return;
		}
		$this->enqueue_editor_assets( isset( $_GET['project_id'] ) ? absint( $_GET['project_id'] ) : 0 );
	}

	public function enqueue_editor_assets( $project_id = 0 ) {
		if ( function_exists( 'wp_enqueue_media' ) && is_admin() ) {
			wp_enqueue_media();
		}
		wp_enqueue_style( 'lm-pcb-tracer-app', LM_PCB_TRACER_URL . 'assets/css/tracer-app.css', array(), LM_PCB_TRACER_VERSION );
		wp_enqueue_style( 'lm-pcb-tablet-styles', LM_PCB_TRACER_URL . 'assets/css/tablet/TabletStyles.css', array( 'lm-pcb-tracer-app' ), LM_PCB_TRACER_VERSION );
		foreach ( array( 'tracer-history', 'tracer-tools', 'tracer-canvas', 'tracer-storage' ) as $handle ) {
			wp_enqueue_script( 'lm-pcb-' . $handle, LM_PCB_TRACER_URL . 'assets/js/' . $handle . '.js', array(), LM_PCB_TRACER_VERSION, true );
		}
		foreach ( array( 'LayersPanel', 'PropertiesPanel', 'PersonalLibrary' ) as $handle ) {
			wp_enqueue_script( 'lm-pcb-component-' . strtolower( $handle ), LM_PCB_TRACER_URL . 'assets/js/components/' . $handle . '.js', array(), LM_PCB_TRACER_VERSION, true );
		}
		foreach ( array( 'CoordinateFormatter', 'GerberLayer', 'LayerMapper', 'GerberWriter', 'ExcellonWriter', 'GeometryExporter', 'GerberZip', 'GerberExporter' ) as $handle ) {
			wp_enqueue_script( 'lm-pcb-gerber-' . strtolower( $handle ), LM_PCB_TRACER_URL . 'assets/js/gerber/' . $handle . '.js', array(), LM_PCB_TRACER_VERSION, true );
		}
		wp_enqueue_script( 'lm-pcb-tracer-app', LM_PCB_TRACER_URL . 'assets/js/tracer-app.js', array(), LM_PCB_TRACER_VERSION, true );
		foreach ( array( 'PromptParser', 'CircuitGenerator', 'AIService', 'RouteEngine', 'EditorCommandExecutor' ) as $handle ) {
			wp_enqueue_script( 'lm-pcb-service-' . strtolower( $handle ), LM_PCB_TRACER_URL . 'assets/js/services/' . $handle . '.js', array(), LM_PCB_TRACER_VERSION, true );
		}
		foreach ( array( 'TabletContextMenu', 'TabletGesture', 'TabletFloatingToolbar', 'TabletToolbar', 'TabletAIPanel', 'TabletMode' ) as $handle ) {
			wp_enqueue_script( 'lm-pcb-tablet-' . strtolower( $handle ), LM_PCB_TRACER_URL . 'assets/js/tablet/' . $handle . '.js', array(), LM_PCB_TRACER_VERSION, true );
		}
		wp_localize_script(
			'lm-pcb-tracer-app',
			'LMPCBTracer',
			array(
				'restUrl'   => esc_url_raw( rest_url( 'lm-pcb-tracer/v1' ) ),
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'adminUrl'  => admin_url( 'admin.php?page=lm-pcb-tracer' ),
				'projectId' => absint( $project_id ),
				'labels'    => array( 'saved' => 'Đã lưu', 'saving' => 'Đang lưu', 'dirty' => 'Chưa lưu', 'error' => 'Lỗi lưu' ),
			)
		);
	}

	public function render_projects_page() {
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_die( esc_html__( 'Không đủ quyền.', 'lm-pcb-image-tracer' ) );
		}
		require LM_PCB_TRACER_DIR . 'templates/editor.php';
	}

	public function render_new_page() {
		$this->render_projects_page();
	}

	public function render_shortcode( $atts = array() ) {
		if ( ! is_user_logged_in() || ! current_user_can( 'edit_posts' ) ) {
			return '<p class="lm-pcb-tracer-login-required">Ban can dang nhap bang tai khoan co quyen chinh sua de dung LM PCB Tracer.</p>';
		}
		$atts = shortcode_atts(
			array(
				'project_id' => isset( $_GET['project_id'] ) ? absint( $_GET['project_id'] ) : 0,
			),
			$atts,
			'lm_pcb_tracer'
		);
		$this->enqueue_editor_assets( absint( $atts['project_id'] ) );
		$lm_pcb_tracer_shortcode = true;
		ob_start();
		require LM_PCB_TRACER_DIR . 'templates/editor.php';
		return ob_get_clean();
	}

	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Không đủ quyền.', 'lm-pcb-image-tracer' ) );
		}
		echo '<div class="wrap"><h1>LM PCB Tracer - Cài đặt</h1><p>Phiên bản 1.0.0 lưu dự án bằng custom post type và REST API riêng.</p></div>';
	}
}
