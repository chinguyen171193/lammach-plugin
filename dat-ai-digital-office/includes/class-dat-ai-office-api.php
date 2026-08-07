<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class DAT_AI_Office_API {
	private $namespace = 'dat-ai-office/v1';
	public function __construct() { add_action( 'rest_api_init', array( $this, 'routes' ) ); }

	public function routes() {
		foreach ( array( 'status' => 'status', 'departments' => 'departments', 'agents' => 'agents', 'workflows' => 'workflows', 'events' => 'events' ) as $route => $callback ) {
			register_rest_route( $this->namespace, '/' . $route, array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( $this, $callback ), 'permission_callback' => '__return_true' ) );
		}
		register_rest_route( $this->namespace, '/tasks', array(
			array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( $this, 'tasks' ), 'permission_callback' => array( $this, 'can_manage' ) ),
			array( 'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'create_task' ), 'permission_callback' => array( $this, 'can_manage' ) ),
		) );
		register_rest_route( $this->namespace, '/events', array( 'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'create_event' ), 'permission_callback' => array( $this, 'can_manage' ) ) );
	}

	public function can_manage( WP_REST_Request $request ) {
		return is_user_logged_in() && current_user_can( 'manage_options' ) && wp_verify_nonce( $request->get_header( 'X-WP-Nonce' ), 'wp_rest' );
	}
	public function status() {
		$data = DAT_AI_Office::dataset();
		return rest_ensure_response( array( 'plugin_version' => DAT_AI_OFFICE_VERSION, 'build' => DAT_AI_OFFICE_BUILD, 'company' => $data['settings']['company_name'], 'departments' => count( $data['departments'] ), 'online_staff' => count( array_filter( $data['agents'], static fn( $agent ) => 'human' === $agent['type'] ) ), 'online_ai' => count( array_filter( $data['agents'], static fn( $agent ) => 'ai' === $agent['type'] ) ), 'workflows' => count( $data['workflows'] ), 'active_tasks' => $this->task_count( 'in_progress' ), 'completed_tasks' => $this->task_count( 'completed' ), 'efficiency' => 92, 'saved_minutes' => 186 ) );
	}
	public function departments() { return rest_ensure_response( DAT_AI_Office::dataset()['departments'] ); }
	public function agents() { return rest_ensure_response( DAT_AI_Office::dataset()['agents'] ); }
	public function workflows() { return rest_ensure_response( DAT_AI_Office::dataset()['workflows'] ); }
	public function events() { return rest_ensure_response( array( 'logs' => DAT_AI_Office::recent_logs(), 'events' => $this->recent_events() ) ); }
	public function tasks() { global $wpdb; $tables = DAT_AI_Office::tables(); return rest_ensure_response( $wpdb->get_results( "SELECT id, title, description, department, assignee, priority, status, progress, due_at, workflow_key FROM {$tables['tasks']} ORDER BY id DESC LIMIT 100", ARRAY_A ) ); }

	public function create_task( WP_REST_Request $request ) {
		$params = $request->get_json_params(); $params = is_array( $params ) ? $params : array();
		$title = sanitize_text_field( $params['title'] ?? '' );
		if ( '' === $title ) { return new WP_Error( 'dat_ai_office_invalid_task', 'Tên nhiệm vụ là bắt buộc.', array( 'status' => 400 ) ); }
		global $wpdb; $tables = DAT_AI_Office::tables(); $now = current_time( 'mysql', true );
		$wpdb->insert( $tables['tasks'], array( 'title' => $title, 'description' => sanitize_textarea_field( $params['description'] ?? '' ), 'department' => sanitize_key( $params['department'] ?? 'ai_center' ), 'assignee' => sanitize_key( $params['assignee'] ?? 'ai_1' ), 'priority' => in_array( $params['priority'] ?? '', array( 'low', 'normal', 'high', 'critical' ), true ) ? $params['priority'] : 'normal', 'status' => 'in_progress', 'progress' => 0, 'due_at' => sanitize_text_field( $params['due_at'] ?? '' ) ?: null, 'workflow_key' => sanitize_key( $params['workflow_key'] ?? '' ), 'created_at' => $now, 'updated_at' => $now ) );
		do_action( 'dat_ai_office_event', array( 'type' => 'task_created', 'title' => $title, 'department' => $params['department'] ?? 'ai_center', 'priority' => $params['priority'] ?? 'normal', 'message' => 'DAT Supervisor AI đã giao nhiệm vụ: ' . $title ) );
		return rest_ensure_response( array( 'id' => $wpdb->insert_id, 'created' => true ) );
	}

	public function create_event( WP_REST_Request $request ) { $event = $request->get_json_params(); do_action( 'dat_ai_office_event', is_array( $event ) ? $event : array() ); return rest_ensure_response( array( 'created' => true ) ); }
	private function task_count( $status ) { global $wpdb; $tables = DAT_AI_Office::tables(); return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$tables['tasks']} WHERE status = %s", $status ) ); }
	private function recent_events() { global $wpdb; $tables = DAT_AI_Office::tables(); return $wpdb->get_results( "SELECT id, event_type, title, department, priority, message, created_at FROM {$tables['events']} ORDER BY id DESC LIMIT 20", ARRAY_A ); }
}
