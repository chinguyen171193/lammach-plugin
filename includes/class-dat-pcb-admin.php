<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DAT_PCB_Admin {
	private $project;
	private $ai;
	private $hook_suffixes = array();

	public function __construct( DAT_PCB_Project $project, DAT_PCB_AI $ai ) {
		$this->project = $project;
		$this->ai      = $ai;
	}

	public function render_ai_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Khong du quyen.', 'dat-pcb-image-tracer' ) );
		}
		if ( isset( $_POST['dat_pcb_tracer_save_settings'] ) ) {
			check_admin_referer( 'dat_pcb_tracer_settings' );
			$this->ai->update_settings(
				isset( $_POST['dat_pcb_openai_api_key'] ) ? wp_unslash( $_POST['dat_pcb_openai_api_key'] ) : '',
				isset( $_POST['dat_pcb_openai_model'] ) ? wp_unslash( $_POST['dat_pcb_openai_model'] ) : '',
				! empty( $_POST['dat_pcb_clear_openai_api_key'] ),
				! empty( $_POST['dat_pcb_openai_web_search'] )
			);
			echo '<div class="notice notice-success is-dismissible"><p>Da luu cai dat.</p></div>';
		}
		$model      = esc_attr( $this->ai->get_model() );
		$web_search = $this->ai->web_search_enabled();
		echo '<div class="wrap">';
		echo '<h1>DAT PCB Tracer - OpenAI</h1>';
		echo '<p>Cau hinh OpenAI de tao footprint linh kien tu ten linh kien hoac URL datasheet PDF.</p>';
		echo '<form method="post">';
		wp_nonce_field( 'dat_pcb_tracer_settings' );
		echo '<table class="form-table" role="presentation"><tbody>';
		echo '<tr><th scope="row"><label for="dat-pcb-openai-api-key">API key</label></th><td>';
		echo '<input id="dat-pcb-openai-api-key" name="dat_pcb_openai_api_key" type="password" class="regular-text" autocomplete="off" placeholder="' . ( $this->ai->has_api_key() ? 'Da cau hinh - nhap key moi de thay doi' : 'sk-...' ) . '">';
		echo '<p class="description">Key chi luu tren server WordPress, khong dua xuong JavaScript.</p>';
		if ( $this->ai->has_api_key() ) {
			echo '<label><input type="checkbox" name="dat_pcb_clear_openai_api_key" value="1"> Xoa API key hien tai</label>';
		}
		echo '</td></tr>';
		echo '<tr><th scope="row"><label for="dat-pcb-openai-model">Model</label></th><td>';
		echo '<input id="dat-pcb-openai-model" name="dat_pcb_openai_model" type="text" class="regular-text" value="' . $model . '">';
		echo '<p class="description">Mac dinh <code>gpt-5.6</code> (thong minh nhat, $5/$30 mot trieu token). Re hon: <code>gpt-5.6-terra</code> ($2.50/$15) hoac <code>gpt-5.6-luna</code> ($1/$6). Tra datasheet tren mang chi chay tu dong gpt-5.4 tro len.</p>';
		echo '</td></tr>';
		echo '<tr><th scope="row">Tra cuu Internet</th><td>';
		echo '<label><input id="dat-pcb-openai-web-search" name="dat_pcb_openai_web_search" type="checkbox" value="1"' . checked( $web_search, true, false ) . '> Cho AI tu tim datasheet/pinout tren mang</label>';
		echo '<p class="description">Khi bat, AI se tu tra so chan va kich thuoc package cua linh kien la thay vi doan theo tri nho. Moi luot chat se cham hon va ton them token cho ket qua tim kiem.</p>';
		echo '</td></tr>';
		echo '</tbody></table>';
		submit_button( 'Luu cai dat', 'primary', 'dat_pcb_tracer_save_settings' );
		echo '</form>';
		echo '</div>';
	}

	public function register_menu() {
		$this->hook_suffixes[] = add_menu_page( 'DAT PCB Tracer', 'DAT PCB Tracer', 'edit_posts', 'dat-pcb-tracer', array( $this, 'render_projects_page' ), 'dashicons-media-code', 58 );
		$this->hook_suffixes[] = add_submenu_page( 'dat-pcb-tracer', 'OpenAI', 'OpenAI', 'manage_options', 'dat-pcb-tracer-openai', array( $this, 'render_ai_settings_page' ) );
		$this->hook_suffixes[] = add_submenu_page( 'dat-pcb-tracer', 'Dự án', 'Dự án', 'edit_posts', 'dat-pcb-tracer', array( $this, 'render_projects_page' ) );
		$this->hook_suffixes[] = add_submenu_page( 'dat-pcb-tracer', 'Tạo dự án mới', 'Tạo dự án mới', 'edit_posts', 'dat-pcb-tracer-new', array( $this, 'render_new_page' ) );
		$this->hook_suffixes[] = add_submenu_page( 'dat-pcb-tracer', 'Cài đặt', 'Cài đặt', 'manage_options', 'dat-pcb-tracer-settings', array( $this, 'render_settings_page' ) );
	}

	public function enqueue_assets( $hook ) {
		if ( ! in_array( $hook, $this->hook_suffixes, true ) ) {
			return;
		}
		$this->enqueue_editor_assets( isset( $_GET['project_id'] ) ? absint( $_GET['project_id'] ) : 0 );
	}

	public function enqueue_shortcode_assets() {
		global $post;
		if ( ! $post || empty( $post->post_content ) || ! has_shortcode( $post->post_content, 'dat_pcb_tracer' ) ) {
			return;
		}
		$this->enqueue_editor_assets( isset( $_GET['project_id'] ) ? absint( $_GET['project_id'] ) : 0 );
	}

	public function enqueue_editor_assets( $project_id = 0 ) {
		if ( function_exists( 'wp_enqueue_media' ) && is_admin() ) {
			wp_enqueue_media();
		}
		wp_enqueue_style( 'dat-pcb-tracer-app', DAT_PCB_TRACER_URL . 'assets/css/tracer-app.css', array(), DAT_PCB_TRACER_VERSION );
		wp_enqueue_style( 'dat-pcb-tablet-styles', DAT_PCB_TRACER_URL . 'assets/css/tablet/TabletStyles.css', array( 'dat-pcb-tracer-app' ), DAT_PCB_TRACER_VERSION );
		foreach ( array( 'tracer-history', 'tracer-tools', 'tracer-canvas', 'tracer-storage' ) as $handle ) {
			wp_enqueue_script( 'dat-pcb-' . $handle, DAT_PCB_TRACER_URL . 'assets/js/' . $handle . '.js', array(), DAT_PCB_TRACER_VERSION, true );
		}
		foreach ( array( 'LayersPanel', 'PropertiesPanel', 'PersonalLibrary' ) as $handle ) {
			wp_enqueue_script( 'dat-pcb-component-' . strtolower( $handle ), DAT_PCB_TRACER_URL . 'assets/js/components/' . $handle . '.js', array(), DAT_PCB_TRACER_VERSION, true );
		}
		foreach ( array( 'CoordinateFormatter', 'GerberLayer', 'LayerMapper', 'GerberWriter', 'ExcellonWriter', 'GeometryExporter', 'GerberZip', 'GerberExporter' ) as $handle ) {
			wp_enqueue_script( 'dat-pcb-gerber-' . strtolower( $handle ), DAT_PCB_TRACER_URL . 'assets/js/gerber/' . $handle . '.js', array(), DAT_PCB_TRACER_VERSION, true );
		}
		wp_enqueue_script( 'dat-pcb-tracer-app', DAT_PCB_TRACER_URL . 'assets/js/tracer-app.js', array(), DAT_PCB_TRACER_VERSION, true );
		foreach ( array( 'PromptParser', 'CircuitGenerator', 'AIService', 'EditorCommandExecutor' ) as $handle ) {
			wp_enqueue_script( 'dat-pcb-service-' . strtolower( $handle ), DAT_PCB_TRACER_URL . 'assets/js/services/' . $handle . '.js', array(), DAT_PCB_TRACER_VERSION, true );
		}
		foreach ( array( 'TabletContextMenu', 'TabletGesture', 'TabletFloatingToolbar', 'TabletToolbar', 'TabletAIPanel', 'TabletMode' ) as $handle ) {
			wp_enqueue_script( 'dat-pcb-tablet-' . strtolower( $handle ), DAT_PCB_TRACER_URL . 'assets/js/tablet/' . $handle . '.js', array(), DAT_PCB_TRACER_VERSION, true );
		}
		wp_localize_script(
			'dat-pcb-tracer-app',
			'DATPCBTracer',
			array(
				'restUrl'   => esc_url_raw( rest_url( 'dat-pcb-tracer/v1' ) ),
				'nonce'     => wp_create_nonce( 'wp_rest' ),
				'adminUrl'  => admin_url( 'admin.php?page=dat-pcb-tracer' ),
				'projectId' => absint( $project_id ),
				'labels'    => array( 'saved' => 'Đã lưu', 'saving' => 'Đang lưu', 'dirty' => 'Chưa lưu', 'error' => 'Lỗi lưu' ),
			)
		);
	}

	public function render_projects_page() {
		if ( ! current_user_can( 'edit_posts' ) ) {
			wp_die( esc_html__( 'Không đủ quyền.', 'dat-pcb-image-tracer' ) );
		}
		require DAT_PCB_TRACER_DIR . 'templates/editor.php';
	}

	public function render_new_page() {
		$this->render_projects_page();
	}

	public function render_shortcode( $atts = array() ) {
		if ( ! is_user_logged_in() || ! current_user_can( 'edit_posts' ) ) {
			return '<p class="dat-pcb-tracer-login-required">Ban can dang nhap bang tai khoan co quyen chinh sua de dung DAT PCB Tracer.</p>';
		}
		$atts = shortcode_atts(
			array(
				'project_id' => isset( $_GET['project_id'] ) ? absint( $_GET['project_id'] ) : 0,
			),
			$atts,
			'dat_pcb_tracer'
		);
		$this->enqueue_editor_assets( absint( $atts['project_id'] ) );
		$dat_pcb_tracer_shortcode = true;
		ob_start();
		require DAT_PCB_TRACER_DIR . 'templates/editor.php';
		return ob_get_clean();
	}

	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Không đủ quyền.', 'dat-pcb-image-tracer' ) );
		}
		echo '<div class="wrap"><h1>DAT PCB Tracer - Cài đặt</h1><p>Phiên bản 1.0.0 lưu dự án bằng custom post type và REST API riêng.</p></div>';
	}
}
