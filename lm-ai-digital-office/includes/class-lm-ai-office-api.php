<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class LM_AI_Office_API {
	private $namespace = 'lm-ai-office/v1';
	public function __construct() { add_action( 'rest_api_init', array( $this, 'routes' ) ); }

	public function routes() {
		foreach ( array( 'status' => 'status', 'departments' => 'departments', 'agents' => 'agents', 'workflows' => 'workflows', 'events' => 'events' ) as $route => $callback ) {
			register_rest_route( $this->namespace, '/' . $route, array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( $this, $callback ), 'permission_callback' => '__return_true' ) );
		}
		register_rest_route(
			$this->namespace,
			'/assets',
			array(
				array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( $this, 'assets' ), 'permission_callback' => '__return_true' ),
				array( 'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'create_asset' ), 'permission_callback' => array( $this, 'can_manage' ) ),
			)
		);
		register_rest_route(
			$this->namespace,
			'/assets/(?P<asset_id>asset_[a-z0-9_-]+)',
			array(
				array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( $this, 'asset' ), 'permission_callback' => '__return_true' ),
				array( 'methods' => WP_REST_Server::EDITABLE, 'callback' => array( $this, 'update_asset' ), 'permission_callback' => array( $this, 'can_manage' ) ),
				array( 'methods' => WP_REST_Server::DELETABLE, 'callback' => array( $this, 'delete_asset' ), 'permission_callback' => array( $this, 'can_manage' ) ),
			)
		);
		$this->register_scene_route( '/scene' );
		// Compatibility alias for clients that used the earlier V1 prototype name.
		$this->register_scene_route( '/scene/current' );
		register_rest_route( $this->namespace, '/tasks', array(
			array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( $this, 'tasks' ), 'permission_callback' => array( $this, 'can_manage' ) ),
			array( 'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'create_task' ), 'permission_callback' => array( $this, 'can_manage' ) ),
		) );
		register_rest_route( $this->namespace, '/events', array( 'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'create_event' ), 'permission_callback' => array( $this, 'can_manage' ) ) );
		register_rest_route( $this->namespace, '/characters/(?P<employee>[a-z0-9_-]+)/animations', array(
			'methods' => WP_REST_Server::READABLE, 'callback' => array( $this, 'character_animations' ), 'permission_callback' => '__return_true',
		) );
		register_rest_route( $this->namespace, '/characters', array(
			'methods' => WP_REST_Server::READABLE, 'callback' => array( $this, 'characters' ), 'permission_callback' => '__return_true',
		) );
	}

	public function can_manage( WP_REST_Request $request ) {
		return is_user_logged_in() && current_user_can( 'manage_options' ) && wp_verify_nonce( $request->get_header( 'X-WP-Nonce' ), 'wp_rest' );
	}

	/** Registers the single, site-level Build Mode scene endpoint. */
	private function register_scene_route( $route ) {
		register_rest_route(
			$this->namespace,
			$route,
			array(
				array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( $this, 'scene' ), 'permission_callback' => '__return_true' ),
				array( 'methods' => WP_REST_Server::EDITABLE, 'callback' => array( $this, 'save_scene' ), 'permission_callback' => array( $this, 'can_manage' ) ),
			)
		);
	}

	/** @return WP_REST_Response */
	public function assets( WP_REST_Request $request ) {
		$raw_category = $request->get_param( 'category' );
		$category     = is_scalar( $raw_category ) ? strtoupper( sanitize_key( $raw_category ) ) : '';
		$assets   = LM_AI_Office_Asset_Library::definitions();
		if ( $category ) {
			$assets = array_values( array_filter( $assets, static fn( $asset ) => $category === ( $asset['category'] ?? '' ) ) );
		}
		return rest_ensure_response( $assets );
	}

	/** @return WP_REST_Response|WP_Error */
	public function asset( WP_REST_Request $request ) {
		$asset = LM_AI_Office_Asset_Library::definition( $request['asset_id'] );
		if ( empty( $asset ) ) {
			return new WP_Error( 'lm_ai_office_asset_not_found', 'Không tìm thấy tài sản.', array( 'status' => 404 ) );
		}
		return rest_ensure_response( $asset );
	}

	/** @return WP_REST_Response|WP_Error */
	public function create_asset( WP_REST_Request $request ) {
		$asset = LM_AI_Office_Asset_Library::create( $this->request_data( $request ) );
		if ( is_wp_error( $asset ) ) {
			return $asset;
		}
		return new WP_REST_Response( $asset, 201 );
	}

	/** @return WP_REST_Response|WP_Error */
	public function update_asset( WP_REST_Request $request ) {
		$asset = LM_AI_Office_Asset_Library::update( $request['asset_id'], $this->request_data( $request ) );
		return is_wp_error( $asset ) ? $asset : rest_ensure_response( $asset );
	}

	/** @return WP_REST_Response|WP_Error */
	public function delete_asset( WP_REST_Request $request ) {
		$result = LM_AI_Office_Asset_Library::delete( $request['asset_id'] );
		return is_wp_error( $result ) ? $result : rest_ensure_response( array( 'deleted' => true ) );
	}

	/** @return WP_REST_Response */
	public function scene() {
		return rest_ensure_response( LM_AI_Office_Asset_Library::scene() );
	}

	/** @return WP_REST_Response|WP_Error */
	public function save_scene( WP_REST_Request $request ) {
		$scene = LM_AI_Office_Asset_Library::save_scene( $this->request_data( $request ) );
		return is_wp_error( $scene ) ? $scene : rest_ensure_response( $scene );
	}

	/** @return array */
	private function request_data( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) || empty( $params ) ) {
			$params = $request->get_params();
		}
		return is_array( $params ) ? $params : array();
	}
	public function status() {
		$data = LM_AI_Office::dataset();
		return rest_ensure_response( array( 'plugin_version' => LM_AI_OFFICE_VERSION, 'build' => LM_AI_OFFICE_BUILD, 'company' => $data['settings']['company_name'], 'departments' => count( $data['departments'] ), 'online_staff' => count( array_filter( $data['agents'], static fn( $agent ) => 'human' === $agent['type'] ) ), 'online_ai' => count( array_filter( $data['agents'], static fn( $agent ) => 'ai' === $agent['type'] ) ), 'workflows' => count( $data['workflows'] ), 'active_tasks' => $this->task_count( 'in_progress' ), 'completed_tasks' => $this->task_count( 'completed' ), 'efficiency' => 92, 'saved_minutes' => 186 ) );
	}
	public function departments() { return rest_ensure_response( LM_AI_Office::dataset()['departments'] ); }
	public function agents() { return rest_ensure_response( LM_AI_Office::dataset()['agents'] ); }
	public function workflows() { return rest_ensure_response( LM_AI_Office::dataset()['workflows'] ); }
	public function events() { return rest_ensure_response( array( 'logs' => LM_AI_Office::recent_logs(), 'events' => $this->recent_events() ) ); }
	public function characters() { return rest_ensure_response( LM_AI_Office_Characters::public_definitions() ); }
	public function character_animations( WP_REST_Request $request ) {
		$employee = sanitize_key( $request['employee'] );
		if ( ! LM_AI_Office_Characters::exists( $employee ) ) { return new WP_Error( 'lm_ai_office_character', 'Không tìm thấy nhân vật.', array( 'status' => 404 ) ); }
		return rest_ensure_response( LM_AI_Office_Animations::public_assets( $employee ) );
	}
	public function tasks() { global $wpdb; $tables = LM_AI_Office::tables(); return rest_ensure_response( $wpdb->get_results( "SELECT id, title, description, department, assignee, priority, status, progress, due_at, workflow_key FROM {$tables['tasks']} ORDER BY id DESC LIMIT 100", ARRAY_A ) ); }

	public function create_task( WP_REST_Request $request ) {
		$params = $request->get_json_params(); $params = is_array( $params ) ? $params : array();
		$title = sanitize_text_field( $params['title'] ?? '' );
		if ( '' === $title ) { return new WP_Error( 'lm_ai_office_invalid_task', 'Tên nhiệm vụ là bắt buộc.', array( 'status' => 400 ) ); }
		global $wpdb; $tables = LM_AI_Office::tables(); $now = current_time( 'mysql', true );
		$wpdb->insert( $tables['tasks'], array( 'title' => $title, 'description' => sanitize_textarea_field( $params['description'] ?? '' ), 'department' => sanitize_key( $params['department'] ?? 'ai_center' ), 'assignee' => sanitize_key( $params['assignee'] ?? 'ai_1' ), 'priority' => in_array( $params['priority'] ?? '', array( 'low', 'normal', 'high', 'critical' ), true ) ? $params['priority'] : 'normal', 'status' => 'in_progress', 'progress' => 0, 'due_at' => sanitize_text_field( $params['due_at'] ?? '' ) ?: null, 'workflow_key' => sanitize_key( $params['workflow_key'] ?? '' ), 'created_at' => $now, 'updated_at' => $now ) );
		do_action( 'lm_ai_office_event', array( 'type' => 'task_created', 'title' => $title, 'department' => $params['department'] ?? 'ai_center', 'priority' => $params['priority'] ?? 'normal', 'message' => 'LM Supervisor AI đã giao nhiệm vụ: ' . $title ) );
		return rest_ensure_response( array( 'id' => $wpdb->insert_id, 'created' => true ) );
	}

	public function create_event( WP_REST_Request $request ) { $event = $request->get_json_params(); do_action( 'lm_ai_office_event', is_array( $event ) ? $event : array() ); return rest_ensure_response( array( 'created' => true ) ); }
	private function task_count( $status ) { global $wpdb; $tables = LM_AI_Office::tables(); return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$tables['tasks']} WHERE status = %s", $status ) ); }
	private function recent_events() { global $wpdb; $tables = LM_AI_Office::tables(); return $wpdb->get_results( "SELECT id, event_type, title, department, priority, message, created_at FROM {$tables['events']} ORDER BY id DESC LIMIT 20", ARRAY_A ); }
}
