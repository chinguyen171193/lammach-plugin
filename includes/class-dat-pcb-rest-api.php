<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DAT_PCB_REST_API {
	private $project;
	private $upload;
	private $ai;
	private $namespace = 'dat-pcb-tracer/v1';

	public function __construct( DAT_PCB_Project $project, DAT_PCB_Upload $upload, DAT_PCB_AI $ai ) {
		$this->project = $project;
		$this->upload  = $upload;
		$this->ai      = $ai;
	}

	public function register_routes() {
		register_rest_route( $this->namespace, '/projects', array(
			array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( $this, 'list_projects' ), 'permission_callback' => array( $this, 'can_manage' ) ),
			array( 'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'create_project' ), 'permission_callback' => array( $this, 'can_manage' ) ),
		) );
		register_rest_route( $this->namespace, '/projects/(?P<id>\d+)', array(
			array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( $this, 'read_project' ), 'permission_callback' => array( $this, 'can_manage' ) ),
			array( 'methods' => WP_REST_Server::EDITABLE, 'callback' => array( $this, 'save_project' ), 'permission_callback' => array( $this, 'can_manage' ) ),
			array( 'methods' => WP_REST_Server::DELETABLE, 'callback' => array( $this, 'delete_project' ), 'permission_callback' => array( $this, 'can_manage' ) ),
		) );
		register_rest_route( $this->namespace, '/projects/(?P<id>\d+)/duplicate', array(
			'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'duplicate_project' ), 'permission_callback' => array( $this, 'can_manage' ),
		) );
		register_rest_route( $this->namespace, '/upload', array(
			'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'upload_image' ), 'permission_callback' => array( $this, 'can_upload' ),
		) );
		register_rest_route( $this->namespace, '/import', array(
			'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'import_json' ), 'permission_callback' => array( $this, 'can_manage' ),
		) );
		register_rest_route( $this->namespace, '/ai/component', array(
			'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'generate_component' ), 'permission_callback' => array( $this, 'can_manage' ),
		) );
		register_rest_route( $this->namespace, '/ai/chat', array(
			'methods' => WP_REST_Server::CREATABLE, 'callback' => array( $this, 'ai_chat' ), 'permission_callback' => array( $this, 'can_manage' ),
		) );
	}

	public function can_manage() {
		return $this->project->can_manage();
	}

	public function can_upload() {
		return is_user_logged_in() && current_user_can( 'upload_files' );
	}

	public function list_projects() {
		$query = new WP_Query( array(
			'post_type'      => 'dat_pcb_project',
			'post_status'    => 'private',
			'posts_per_page' => 50,
			'orderby'        => 'modified',
			'order'          => 'DESC',
		) );
		$items = array();
		foreach ( $query->posts as $post ) {
			if ( current_user_can( 'edit_post', $post->ID ) ) {
				$items[] = array(
					'id'       => $post->ID,
					'name'     => get_the_title( $post ),
					'code'     => get_post_meta( $post->ID, DAT_PCB_TRACER_META_CODE, true ),
					'modified' => get_post_modified_time( 'mysql', false, $post ),
				);
			}
		}
		return rest_ensure_response( $items );
	}

	public function create_project( WP_REST_Request $request ) {
		return $this->respond( $this->project->create_project( $request->get_json_params() ?: array() ) );
	}

	public function read_project( WP_REST_Request $request ) {
		return $this->respond( $this->project->read_project( absint( $request['id'] ) ) );
	}

	public function save_project( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		return $this->respond( $this->project->save_project( absint( $request['id'] ), is_array( $params ) ? $params : array() ) );
	}

	public function delete_project( WP_REST_Request $request ) {
		return $this->respond( array( 'deleted' => $this->project->delete_project( absint( $request['id'] ) ) ) );
	}

	public function duplicate_project( WP_REST_Request $request ) {
		return $this->respond( $this->project->duplicate_project( absint( $request['id'] ) ) );
	}

	public function upload_image() {
		return $this->respond( $this->upload->handle_upload( 'file' ) );
	}

	public function import_json( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) || empty( $params['data'] ) || ! is_array( $params['data'] ) ) {
			return new WP_Error( 'dat_pcb_import_invalid', 'JSON không hợp lệ.', array( 'status' => 400 ) );
		}
		$data = wp_json_encode( $params['data'] );
		if ( strlen( $data ) > 2097152 ) {
			return new WP_Error( 'dat_pcb_import_large', 'JSON vượt quá 2 MB.', array( 'status' => 400 ) );
		}
		if ( isset( $params['data']['version'] ) && '1.0' !== (string) $params['data']['version'] ) {
			return new WP_Error( 'dat_pcb_import_version', 'Phiên bản JSON chưa được hỗ trợ.', array( 'status' => 400 ) );
		}
		$clean = $this->project->sanitize_project_data( $params['data'] );
		return $this->respond( $this->project->create_project_from_data( $clean ) );
	}

	public function generate_component( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		if ( ! is_array( $params ) ) {
			$params = $request->get_params();
		}
		if ( isset( $params['board'] ) && is_string( $params['board'] ) ) {
			$board = json_decode( wp_unslash( $params['board'] ), true );
			$params['board'] = is_array( $board ) ? $board : array();
		}
		$files = $request->get_file_params();
		if ( isset( $files['datasheet'] ) && is_array( $files['datasheet'] ) ) {
			$params['_datasheet_file'] = $files['datasheet'];
		}
		return $this->respond( $this->ai->generate_component( is_array( $params ) ? $params : array() ) );
	}

	public function ai_chat( WP_REST_Request $request ) {
		$params = $request->get_json_params();
		return $this->respond( $this->ai->chat_message( is_array( $params ) ? $params : array() ) );
	}

	private function respond( $value ) {
		if ( is_wp_error( $value ) ) {
			return $value;
		}
		return rest_ensure_response( $value );
	}
}
