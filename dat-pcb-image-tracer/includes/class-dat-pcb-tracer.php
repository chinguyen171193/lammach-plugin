<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class DAT_PCB_Tracer {
	private static $instance = null;
	private $project;
	private $upload;
	private $ai;
	private $rest;
	private $admin;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		$this->project = new DAT_PCB_Project();
		$this->upload  = new DAT_PCB_Upload();
		$this->ai      = new DAT_PCB_AI();
		$this->rest    = new DAT_PCB_REST_API( $this->project, $this->upload, $this->ai );
		$this->admin   = new DAT_PCB_Admin( $this->project, $this->ai );

		add_action( 'init', array( $this, 'register_project_post_type' ) );
		add_action( 'rest_api_init', array( $this->rest, 'register_routes' ) );
		add_action( 'admin_menu', array( $this->admin, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this->admin, 'enqueue_assets' ) );
		add_action( 'wp_enqueue_scripts', array( $this->admin, 'enqueue_shortcode_assets' ) );
		add_filter( 'upload_mimes', array( $this->upload, 'filter_upload_mimes' ) );
		add_shortcode( 'dat_pcb_tracer', array( $this->admin, 'render_shortcode' ) );
	}

	public function register_project_post_type() {
		register_post_type(
			'dat_pcb_project',
			array(
				'labels'              => array(
					'name'          => 'DAT PCB Tracer',
					'singular_name' => 'Dự án PCB',
				),
				'public'              => false,
				'show_ui'             => false,
				'show_in_menu'        => false,
				'show_in_rest'        => false,
				'capability_type'     => 'post',
				'map_meta_cap'        => true,
				'supports'            => array( 'title', 'author' ),
				'exclude_from_search' => true,
				'can_export'          => false,
			)
		);
	}
}
