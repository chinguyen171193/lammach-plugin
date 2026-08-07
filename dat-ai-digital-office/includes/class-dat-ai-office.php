<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Core data, schema, and dependency container for LM AI Digital Office. */
final class DAT_AI_Office {
	private static $instance;
	private static $dataset = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		new DAT_AI_Office_Assets();
		new DAT_AI_Office_Shortcode();
		new DAT_AI_Office_API();
		new DAT_AI_Office_Events();
		if ( is_admin() ) {
			new DAT_AI_Office_Admin();
		}
	}

	public static function activate() {
		self::create_tables();
		if ( ! get_option( 'dat_ai_office_seeded' ) ) {
			self::seed_demo_data();
		}
		add_option( DAT_AI_OFFICE_OPTION, self::default_settings(), '', false );
	}

	public static function deactivate() {
		// Runtime data is intentionally retained.
	}

	public static function tables() {
		global $wpdb;
		return array(
			'departments' => $wpdb->prefix . 'dat_ai_departments',
			'agents'      => $wpdb->prefix . 'dat_ai_agents',
			'tasks'       => $wpdb->prefix . 'dat_ai_tasks',
			'workflows'   => $wpdb->prefix . 'dat_ai_workflows',
			'events'      => $wpdb->prefix . 'dat_ai_events',
			'logs'        => $wpdb->prefix . 'dat_ai_logs',
		);
	}

	private static function create_tables() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$tables = self::tables();
		$charset = $wpdb->get_charset_collate();
		dbDelta( "CREATE TABLE {$tables['departments']} (id bigint(20) unsigned NOT NULL AUTO_INCREMENT, slug varchar(64) NOT NULL, name varchar(190) NOT NULL, color varchar(16) NOT NULL, data longtext NOT NULL, enabled tinyint(1) NOT NULL DEFAULT 1, sort_order int(11) NOT NULL DEFAULT 0, PRIMARY KEY  (id), UNIQUE KEY slug (slug)) $charset;" );
		dbDelta( "CREATE TABLE {$tables['agents']} (id bigint(20) unsigned NOT NULL AUTO_INCREMENT, agent_key varchar(64) NOT NULL, name varchar(190) NOT NULL, agent_type varchar(16) NOT NULL, department varchar(64) NOT NULL, role_name varchar(190) NOT NULL, color varchar(16) NOT NULL, data longtext NOT NULL, enabled tinyint(1) NOT NULL DEFAULT 1, PRIMARY KEY  (id), UNIQUE KEY agent_key (agent_key), KEY department (department)) $charset;" );
		dbDelta( "CREATE TABLE {$tables['tasks']} (id bigint(20) unsigned NOT NULL AUTO_INCREMENT, title varchar(190) NOT NULL, description text NOT NULL, department varchar(64) NOT NULL, assignee varchar(64) NOT NULL, priority varchar(16) NOT NULL, status varchar(32) NOT NULL, progress int(11) NOT NULL DEFAULT 0, due_at datetime NULL, workflow_key varchar(64) NOT NULL, created_at datetime NOT NULL, updated_at datetime NOT NULL, PRIMARY KEY  (id), KEY status (status), KEY department (department)) $charset;" );
		dbDelta( "CREATE TABLE {$tables['workflows']} (id bigint(20) unsigned NOT NULL AUTO_INCREMENT, workflow_key varchar(64) NOT NULL, name varchar(190) NOT NULL, description text NOT NULL, data longtext NOT NULL, enabled tinyint(1) NOT NULL DEFAULT 1, PRIMARY KEY  (id), UNIQUE KEY workflow_key (workflow_key)) $charset;" );
		dbDelta( "CREATE TABLE {$tables['events']} (id bigint(20) unsigned NOT NULL AUTO_INCREMENT, event_type varchar(64) NOT NULL, title varchar(190) NOT NULL, department varchar(64) NOT NULL, source varchar(64) NOT NULL, object_id bigint(20) unsigned NOT NULL DEFAULT 0, priority varchar(16) NOT NULL, message text NOT NULL, payload longtext NOT NULL, created_at datetime NOT NULL, PRIMARY KEY  (id), KEY event_type (event_type), KEY created_at (created_at)) $charset;" );
		dbDelta( "CREATE TABLE {$tables['logs']} (id bigint(20) unsigned NOT NULL AUTO_INCREMENT, actor varchar(190) NOT NULL, department varchar(64) NOT NULL, level varchar(16) NOT NULL, message text NOT NULL, created_at datetime NOT NULL, PRIMARY KEY  (id), KEY created_at (created_at)) $charset;" );
	}

	public static function default_settings() {
		return array(
			'company_name'       => 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ SẢN XUẤT ĐIỆN TỬ DAT',
			'model_name'         => 'DAT AI Digital Office',
			'background_color'   => '#07101f',
			'ui_color'           => '#38d9ff',
			'max_agents'         => 40,
			'animation_speed'    => 1,
			'dashboard_enabled'  => true,
			'log_enabled'        => true,
			'auto_camera'        => true,
			'sound_enabled'      => false,
			'day_night_enabled'  => true,
			'low_performance'    => false,
			'mobile_mode'        => true,
			'fps_max'            => 60,
			'show_names'         => true,
			'show_bubbles'       => true,
			'debug'              => false,
			'delete_on_uninstall'=> false,
			'connection_mode'    => 'demo',
			'custom_endpoint'    => '',
		);
	}

	public static function settings() {
		return wp_parse_args( get_option( DAT_AI_OFFICE_OPTION, array() ), self::default_settings() );
	}

	private static function seed_demo_data() {
		global $wpdb;
		$tables = self::tables();
		$departments = self::demo_departments();
		foreach ( $departments as $index => $department ) {
			$wpdb->insert( $tables['departments'], array( 'slug' => $department['id'], 'name' => $department['name'], 'color' => $department['color'], 'data' => wp_json_encode( $department ), 'enabled' => 1, 'sort_order' => $index ) );
		}
		foreach ( self::demo_agents() as $agent ) {
			$wpdb->insert( $tables['agents'], array( 'agent_key' => $agent['id'], 'name' => $agent['name'], 'agent_type' => $agent['type'], 'department' => $agent['department'], 'role_name' => $agent['role'], 'color' => $agent['color'], 'data' => wp_json_encode( $agent ), 'enabled' => 1 ) );
		}
		foreach ( self::demo_workflows() as $workflow ) {
			$wpdb->insert( $tables['workflows'], array( 'workflow_key' => $workflow['id'], 'name' => $workflow['name'], 'description' => $workflow['description'], 'data' => wp_json_encode( $workflow ), 'enabled' => 1 ) );
		}
		$now = current_time( 'mysql', true );
		foreach ( self::demo_logs() as $log ) {
			$wpdb->insert( $tables['logs'], array( 'actor' => $log['actor'], 'department' => $log['department'], 'level' => $log['level'], 'message' => $log['message'], 'created_at' => $now ) );
		}
		update_option( 'dat_ai_office_seeded', 1, false );
		self::$dataset = null;
	}

	public static function reset_demo_data() {
		global $wpdb;
		foreach ( self::tables() as $table ) {
			$wpdb->query( "TRUNCATE TABLE {$table}" ); // Table names are internal constants.
		}
		delete_option( 'dat_ai_office_seeded' );
		self::seed_demo_data();
	}

	public static function dataset() {
		if ( null !== self::$dataset ) {
			return self::$dataset;
		}
		global $wpdb;
		$tables = self::tables();
		$departments = array_map( static fn( $row ) => json_decode( $row['data'], true ), $wpdb->get_results( "SELECT data FROM {$tables['departments']} WHERE enabled = 1 ORDER BY sort_order ASC", ARRAY_A ) );
		$agents = array_map( static fn( $row ) => json_decode( $row['data'], true ), $wpdb->get_results( "SELECT data FROM {$tables['agents']} WHERE enabled = 1", ARRAY_A ) );
		$workflows = array_map( static fn( $row ) => json_decode( $row['data'], true ), $wpdb->get_results( "SELECT data FROM {$tables['workflows']} WHERE enabled = 1", ARRAY_A ) );

		// A plugin update does not trigger activation. Keep the public demo usable
		// while an administrator restores or seeds its database records.
		$departments = array_values( array_filter( $departments ) );
		$agents = array_values( array_filter( $agents ) );
		$workflows = array_values( array_filter( $workflows ) );
		if ( empty( $departments ) ) {
			$departments = self::demo_departments();
		}
		if ( empty( $agents ) ) {
			$agents = self::demo_agents();
		}
		if ( empty( $workflows ) ) {
			$workflows = self::demo_workflows();
		}
		$agents = array_map(
			static function ( $agent ) {
				$agent['sprite'] = self::agent_sprite_id( $agent );
				return $agent;
			},
			$agents
		);
		self::$dataset = array( 'departments' => $departments, 'agents' => $agents, 'workflows' => $workflows, 'settings' => self::public_settings() );
		return self::$dataset;
	}

	/**
	 * Maps an Agent record to an asset-folder identifier. Animation metadata stays
	 * in that folder's config.json, rather than being embedded in business logic.
	 *
	 * @param array $agent Agent data.
	 * @return string
	 */
	public static function agent_sprite_id( $agent ) {
		if ( ! empty( $agent['sprite'] ) ) {
			return sanitize_key( $agent['sprite'] );
		}

		$mapping = array(
			'ai_1' => 'supervisor-ai',
			'ai_2' => 'sale-ai',
			'ai_3' => 'pcb-engineer',
		);

		return $mapping[ $agent['id'] ?? '' ] ?? sanitize_key( $agent['id'] ?? '_placeholder' );
	}

	public static function public_settings() {
		$settings = self::settings();
		unset( $settings['custom_endpoint'], $settings['delete_on_uninstall'] );
		return $settings;
	}

	public static function recent_logs( $limit = 40 ) {
		global $wpdb;
		$tables = self::tables();
		$logs = $wpdb->get_results( $wpdb->prepare( "SELECT id, actor, department, level, message, created_at FROM {$tables['logs']} ORDER BY id DESC LIMIT %d", min( 100, max( 1, absint( $limit ) ) ) ), ARRAY_A );
		return empty( $logs ) ? self::demo_logs() : $logs;
	}

	public static function demo_departments() {
		return array(
			array( 'id' => 'reception', 'name' => 'Lễ tân', 'color' => '#7c4dff', 'x' => 70, 'y' => 120, 'w' => 220, 'h' => 150, 'equipment' => 'Quầy tiếp khách', 'seats' => array( array( 125, 205 ), array( 205, 205 ) ) ),
			array( 'id' => 'sales', 'name' => 'Kinh doanh', 'color' => '#29b6f6', 'x' => 320, 'y' => 80, 'w' => 240, 'h' => 180, 'equipment' => 'CRM & báo giá', 'seats' => array( array( 380, 165 ), array( 460, 165 ), array( 510, 215 ) ) ),
			array( 'id' => 'pcb', 'name' => 'Kỹ thuật PCB', 'color' => '#00d4a8', 'x' => 600, 'y' => 80, 'w' => 260, 'h' => 180, 'equipment' => 'Gerber workstation', 'seats' => array( array( 660, 165 ), array( 740, 165 ), array( 805, 215 ) ) ),
			array( 'id' => 'ai_center', 'name' => 'AI Center', 'color' => '#b388ff', 'x' => 900, 'y' => 80, 'w' => 210, 'h' => 180, 'equipment' => 'AI data core', 'seats' => array( array( 970, 165 ), array( 1040, 205 ) ) ),
			array( 'id' => 'marketing', 'name' => 'Marketing', 'color' => '#ff6eb4', 'x' => 1140, 'y' => 80, 'w' => 210, 'h' => 180, 'equipment' => 'Content studio', 'seats' => array( array( 1200, 165 ), array( 1280, 205 ) ) ),
			array( 'id' => 'finance', 'name' => 'Kế toán', 'color' => '#ffd166', 'x' => 70, 'y' => 340, 'w' => 220, 'h' => 180, 'equipment' => 'Cost console', 'seats' => array( array( 130, 425 ), array( 210, 465 ) ) ),
			array( 'id' => 'warehouse', 'name' => 'Kho vật tư', 'color' => '#ff9f43', 'x' => 320, 'y' => 340, 'w' => 240, 'h' => 180, 'equipment' => 'Kệ linh kiện', 'seats' => array( array( 380, 430 ), array( 500, 460 ) ) ),
			array( 'id' => 'smt', 'name' => 'Sản xuất SMT', 'color' => '#42e695', 'x' => 600, 'y' => 340, 'w' => 330, 'h' => 180, 'equipment' => 'Pick & place + băng tải', 'seats' => array( array( 670, 450 ), array( 840, 450 ) ) ),
			array( 'id' => 'qc', 'name' => 'QC', 'color' => '#00bcd4', 'x' => 970, 'y' => 340, 'w' => 180, 'h' => 180, 'equipment' => 'Bàn kiểm tra', 'seats' => array( array( 1030, 435 ) ) ),
			array( 'id' => 'packing', 'name' => 'Đóng gói', 'color' => '#ff8a65', 'x' => 1180, 'y' => 340, 'w' => 170, 'h' => 180, 'equipment' => 'Bàn đóng gói', 'seats' => array( array( 1240, 435 ) ) ),
			array( 'id' => 'shipping', 'name' => 'Giao hàng', 'color' => '#90caf9', 'x' => 70, 'y' => 600, 'w' => 290, 'h' => 150, 'equipment' => 'Cổng giao nhận', 'seats' => array( array( 180, 680 ) ) ),
			array( 'id' => 'executive', 'name' => 'Điều hành', 'color' => '#e0e7ff', 'x' => 400, 'y' => 600, 'w' => 230, 'h' => 150, 'equipment' => 'War room', 'seats' => array( array( 500, 675 ) ) ),
		);
	}

	public static function demo_agents() {
		$roles = array(
			array( 'Linh', 'Sale', 'sales', '#29b6f6' ), array( 'Nam', 'Sale', 'sales', '#5bc0eb' ), array( 'Hà', 'Sale', 'sales', '#38d9ff' ), array( 'Quân', 'Kỹ thuật PCB', 'pcb', '#00d4a8' ), array( 'Mai', 'Kỹ thuật PCB', 'pcb', '#1ee3b7' ), array( 'Tùng', 'Kỹ thuật phần mềm', 'pcb', '#36d6a8' ), array( 'An', 'SMT Operator', 'smt', '#42e695' ), array( 'Duy', 'SMT Operator', 'smt', '#64edac' ), array( 'Lan', 'QC', 'qc', '#00bcd4' ), array( 'Phúc', 'QC', 'qc', '#26c6da' ), array( 'Hương', 'Kho', 'warehouse', '#ff9f43' ), array( 'Bình', 'Kho', 'warehouse', '#ffb35c' ), array( 'Vy', 'Marketing', 'marketing', '#ff6eb4' ), array( 'Khoa', 'Marketing', 'marketing', '#ff8cc7' ), array( 'Trang', 'Kế toán', 'finance', '#ffd166' ), array( 'Đức', 'Kế toán', 'finance', '#ffe08a' ), array( 'Khánh', 'Đóng gói', 'packing', '#ff8a65' ), array( 'Hải', 'Giao hàng', 'shipping', '#90caf9' ), array( 'Ngọc', 'Lễ tân', 'reception', '#a78bfa' ), array( 'Minh', 'Điều hành', 'executive', '#e0e7ff' ), array( 'Khách PCB', 'Khách hàng', 'reception', '#b7c9e2' ), array( 'Khách PCBA', 'Khách hàng', 'reception', '#c7d7ef' ), array( 'Sơn', 'Kỹ thuật PCB', 'pcb', '#21c89a' ), array( 'My', 'Sản xuất', 'smt', '#52d995' ),
		);
		$agents = array();
		foreach ( $roles as $index => $role ) {
			$agents[] = array( 'id' => 'staff_' . ( $index + 1 ), 'name' => $role[0], 'role' => $role[1], 'department' => $role[2], 'color' => $role[3], 'type' => 'human', 'speed' => 62 + ( $index % 4 ) * 8, 'status' => 'working', 'task' => 'Đang phối hợp công việc', 'progress' => 30 + ( $index * 7 ) % 60, 'history' => array( 'Đã vào ca', 'Đang xử lý nhiệm vụ' ) );
		}
		foreach ( array( array( 'DAT Supervisor AI', 'ai_center', '#b388ff' ), array( 'Sale AI', 'sales', '#29b6f6' ), array( 'Gerber AI', 'pcb', '#00e5b7' ), array( 'BOM AI', 'warehouse', '#ffb020' ), array( 'Production AI', 'smt', '#42e695' ), array( 'Finance AI', 'finance', '#ffd166' ) ) as $index => $ai ) {
			$agents[] = array( 'id' => 'ai_' . ( $index + 1 ), 'name' => $ai[0], 'role' => 'AI Agent', 'department' => $ai[1], 'color' => $ai[2], 'type' => 'ai', 'speed' => 82, 'status' => 'working', 'task' => 'Đồng bộ dữ liệu', 'progress' => 65, 'history' => array( 'Đang phân tích dữ liệu' ) );
		}
		return $agents;
	}

	public static function demo_workflows() {
		return array(
			array( 'id' => 'pcb_order', 'name' => 'Khách đặt PCB', 'description' => 'Từ tiếp nhận file đến báo giá.', 'steps' => array( array( 'reception', 'Khách hàng đến quầy Sale', 6 ), array( 'sales', 'Sale lập hồ sơ đơn PCB', 7 ), array( 'pcb', 'Gerber AI phân tích thiết kế', 8 ), array( 'finance', 'Kế toán kiểm tra chi phí', 6 ), array( 'sales', 'Sale gửi báo giá', 5 ) ) ),
			array( 'id' => 'pcba_production', 'name' => 'Sản xuất PCBA', 'description' => 'BOM, kho, SMT, QC, đóng gói và giao hàng.', 'steps' => array( array( 'sales', 'Sale chuyển phiếu sản xuất', 5 ), array( 'warehouse', 'BOM AI kiểm tra linh kiện', 7 ), array( 'smt', 'Production AI tạo kế hoạch SMT', 8 ), array( 'qc', 'QC xác nhận PASS', 6 ), array( 'packing', 'Kho đóng gói đơn hàng', 5 ), array( 'shipping', 'Xe giao hàng rời cổng', 5 ) ) ),
			array( 'id' => 'warranty', 'name' => 'Bảo hành', 'description' => 'Tiếp nhận, phân loại lỗi, sửa chữa và bàn giao.', 'steps' => array( array( 'reception', 'Tiếp nhận yêu cầu bảo hành', 6 ), array( 'pcb', 'Kỹ thuật chẩn đoán lỗi', 8 ), array( 'qc', 'QC kiểm tra lại sản phẩm', 6 ), array( 'sales', 'Trả kết quả cho khách', 5 ) ) ),
			array( 'id' => 'marketing_campaign', 'name' => 'Marketing sản phẩm', 'description' => 'Tạo, duyệt và phát hành nội dung.', 'steps' => array( array( 'marketing', 'Marketing AI nhận sản phẩm mới', 6 ), array( 'marketing', 'Content AI tạo nội dung', 7 ), array( 'executive', 'Điều hành duyệt chiến dịch', 5 ), array( 'marketing', 'Phát hành nội dung', 6 ) ) ),
		);
	}

	private static function demo_logs() {
		return array(
			array( 'actor' => 'Sale AI', 'department' => 'sales', 'level' => 'info', 'message' => 'Đã nhận yêu cầu PCB mới.' ),
			array( 'actor' => 'Gerber AI', 'department' => 'pcb', 'level' => 'success', 'message' => 'Đã phân tích file Gerber.' ),
			array( 'actor' => 'BOM AI', 'department' => 'warehouse', 'level' => 'info', 'message' => 'Đang kiểm tra linh kiện tồn kho.' ),
			array( 'actor' => 'Production AI', 'department' => 'smt', 'level' => 'info', 'message' => 'Đã tạo kế hoạch SMT.' ),
			array( 'actor' => 'QC', 'department' => 'qc', 'level' => 'success', 'message' => 'Xác nhận PASS lô PCBA.' ),
		);
	}
}
