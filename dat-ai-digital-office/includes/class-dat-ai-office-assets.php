<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class DAT_AI_Office_Assets {
	public function __construct() {
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_assets' ) );
	}

	public function public_assets( $in_footer = true ) {
		wp_enqueue_style( 'dat-ai-office-public', DAT_AI_OFFICE_URL . 'public/css/digital-office.css', array(), DAT_AI_OFFICE_VERSION );
		wp_enqueue_style( 'dat-ai-office-public-fixes', DAT_AI_OFFICE_URL . 'public/css/digital-office-fixes.css', array( 'dat-ai-office-public' ), DAT_AI_OFFICE_VERSION );
		wp_enqueue_style( 'dat-ai-office-agent-sprites', DAT_AI_OFFICE_URL . 'public/css/agent-sprites.css', array( 'dat-ai-office-public' ), DAT_AI_OFFICE_VERSION );
		wp_enqueue_style( 'dat-ai-office-agent-rig', DAT_AI_OFFICE_URL . 'public/css/agent-rig.css', array( 'dat-ai-office-agent-sprites' ), DAT_AI_OFFICE_VERSION );
		wp_enqueue_style( 'dat-ai-office-agent-3d', DAT_AI_OFFICE_URL . 'public/css/agent-3d.css', array( 'dat-ai-office-agent-sprites' ), DAT_AI_OFFICE_VERSION );
		wp_enqueue_script( 'dat-ai-office-pixi', DAT_AI_OFFICE_URL . 'public/js/vendor/pixi.min.js', array(), '7.4.2', $in_footer );
		wp_enqueue_script( 'dat-ai-office-pathfinding', DAT_AI_OFFICE_URL . 'public/js/office-pathfinding.js', array(), DAT_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'dat-ai-office-agents', DAT_AI_OFFICE_URL . 'public/js/office-agents.js', array( 'dat-ai-office-pixi', 'dat-ai-office-pathfinding' ), DAT_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'dat-ai-office-events', DAT_AI_OFFICE_URL . 'public/js/office-events.js', array(), DAT_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'dat-ai-office-agent-rig', DAT_AI_OFFICE_URL . 'public/js/agent-rig.js', array(), DAT_AI_OFFICE_VERSION, $in_footer );
		$this->agent_3d_scripts( $in_footer );
		wp_enqueue_script( 'dat-ai-office-agent-sprite-player', DAT_AI_OFFICE_URL . 'public/js/agent-sprite-player.js', array( 'dat-ai-office-agent-rig', 'dat-ai-office-agent-3d' ), DAT_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'dat-ai-office-ui', DAT_AI_OFFICE_URL . 'public/js/office-ui.js', array( 'dat-ai-office-agent-sprite-player' ), DAT_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'dat-ai-office-engine', DAT_AI_OFFICE_URL . 'public/js/office-engine.js', array( 'dat-ai-office-pixi', 'dat-ai-office-agents', 'dat-ai-office-events', 'dat-ai-office-ui' ), DAT_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'dat-ai-office', DAT_AI_OFFICE_URL . 'public/js/digital-office.js', array( 'dat-ai-office-engine' ), DAT_AI_OFFICE_VERSION, $in_footer );
		wp_localize_script( 'dat-ai-office', 'DAT_AI_OFFICE', array( 'restUrl' => esc_url_raw( rest_url( 'dat-ai-office/v1/' ) ), 'nonce' => wp_create_nonce( 'wp_rest' ), 'adminUrl' => admin_url( 'admin.php?page=dat-ai-office' ), 'agentAssetsUrl' => esc_url_raw( DAT_AI_OFFICE_URL . 'assets/agents/' ), 'agentAssetsVersion' => DAT_AI_OFFICE_BUILD, 'supervisorAppearance' => DAT_AI_Office::supervisor_appearance() ) );
	}

	public function admin_assets( $hook ) {
		if ( false === strpos( (string) $hook, 'dat-ai-office' ) ) { return; }
		wp_enqueue_style( 'dat-ai-office-admin', DAT_AI_OFFICE_URL . 'admin/css/admin.css', array(), DAT_AI_OFFICE_VERSION );
		wp_enqueue_script( 'dat-ai-office-admin', DAT_AI_OFFICE_URL . 'admin/js/admin.js', array( 'jquery' ), DAT_AI_OFFICE_VERSION, true );
		wp_localize_script( 'dat-ai-office-admin', 'DAT_AI_OFFICE_ADMIN', array( 'nonce' => wp_create_nonce( DAT_AI_OFFICE_NONCE ), 'restNonce' => wp_create_nonce( 'wp_rest' ), 'restUrl' => esc_url_raw( rest_url( 'dat-ai-office/v1/' ) ), 'agentAssetsUrl' => esc_url_raw( DAT_AI_OFFICE_URL . 'assets/agents/' ), 'agentAssetsVersion' => DAT_AI_OFFICE_BUILD, 'supervisorAppearance' => DAT_AI_Office::supervisor_appearance() ) );

		// The preview contains the shortcode but is rendered after admin_head.
		// Queue its public renderer here so both CSS and JavaScript are printed.
		$current_page = sanitize_key( $_GET['page'] ?? '' );
		if ( 'dat-ai-office-characters' === $current_page ) {
			wp_enqueue_media();
			wp_enqueue_script( 'dat-ai-office-characters', DAT_AI_OFFICE_URL . 'admin/js/characters.js', array( 'jquery', 'media-editor' ), DAT_AI_OFFICE_VERSION, true );
		}
		if ( 'dat-ai-office-animation-library' === $current_page ) {
			wp_enqueue_media();
			wp_enqueue_script( 'dat-ai-office-three', DAT_AI_OFFICE_URL . 'public/js/vendor/three.min.js', array(), '0.128.0', true );
			wp_enqueue_script( 'dat-ai-office-fflate', DAT_AI_OFFICE_URL . 'public/js/vendor/fflate.min.js', array(), '0.6.10', true );
			wp_enqueue_script( 'dat-ai-office-fbx-loader', DAT_AI_OFFICE_URL . 'public/js/vendor/FBXLoader.js', array( 'dat-ai-office-three', 'dat-ai-office-fflate' ), '0.128.0', true );
			wp_enqueue_script( 'dat-ai-office-animation-library', DAT_AI_OFFICE_URL . 'admin/js/animation-library.js', array( 'jquery', 'media-editor', 'dat-ai-office-fbx-loader' ), DAT_AI_OFFICE_VERSION, true );
			wp_localize_script( 'dat-ai-office-animation-library', 'DAT_AI_OFFICE_ANIMATION_PREVIEW', array( 'modelUrl' => DAT_AI_OFFICE_URL . 'public/assets/characters/employee_001/employee_001.fbx', 'version' => DAT_AI_OFFICE_BUILD ) );
		}
		if ( in_array( $current_page, array( 'dat-ai-office-agents', 'dat-ai-office-supervisor-studio' ), true ) ) {
			wp_enqueue_style( 'dat-ai-office-agent-sprites-admin', DAT_AI_OFFICE_URL . 'admin/css/agent-sprites.css', array( 'dat-ai-office-admin' ), DAT_AI_OFFICE_VERSION );
			wp_enqueue_style( 'dat-ai-office-agent-rig', DAT_AI_OFFICE_URL . 'public/css/agent-rig.css', array( 'dat-ai-office-agent-sprites-admin' ), DAT_AI_OFFICE_VERSION );
			wp_enqueue_style( 'dat-ai-office-agent-3d', DAT_AI_OFFICE_URL . 'public/css/agent-3d.css', array( 'dat-ai-office-agent-sprites-admin' ), DAT_AI_OFFICE_VERSION );
			wp_enqueue_script( 'dat-ai-office-agent-rig', DAT_AI_OFFICE_URL . 'public/js/agent-rig.js', array(), DAT_AI_OFFICE_VERSION, true );
			$this->agent_3d_scripts( true );
			wp_enqueue_script( 'dat-ai-office-agent-sprite-player', DAT_AI_OFFICE_URL . 'public/js/agent-sprite-player.js', array( 'dat-ai-office-agent-rig', 'dat-ai-office-agent-3d' ), DAT_AI_OFFICE_VERSION, true );
			wp_enqueue_script( 'dat-ai-office-agent-sprites-admin', DAT_AI_OFFICE_URL . 'admin/js/agent-sprites-admin.js', array( 'dat-ai-office-admin', 'dat-ai-office-agent-sprite-player' ), DAT_AI_OFFICE_VERSION, true );
		}
		if ( 'dat-ai-office-preview' === $current_page || false !== strpos( (string) $hook, 'preview' ) ) {
			$this->public_assets( false );
		}
	}

	private function agent_3d_scripts( $in_footer ) {
		wp_enqueue_script( 'dat-ai-office-three', DAT_AI_OFFICE_URL . 'public/js/vendor/three.min.js', array(), '0.128.0', $in_footer );
		wp_enqueue_script( 'dat-ai-office-gltf-loader', DAT_AI_OFFICE_URL . 'public/js/vendor/GLTFLoader.js', array( 'dat-ai-office-three' ), '0.128.0', $in_footer );
		wp_enqueue_script( 'dat-ai-office-agent-3d-state-machine', DAT_AI_OFFICE_URL . 'public/js/agent-3d-state-machine.js', array( 'dat-ai-office-three' ), DAT_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'dat-ai-office-agent-face-controller', DAT_AI_OFFICE_URL . 'public/js/agent-face-controller.js', array( 'dat-ai-office-three' ), DAT_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'dat-ai-office-agent-3d', DAT_AI_OFFICE_URL . 'public/js/agent-3d.js', array( 'dat-ai-office-gltf-loader', 'dat-ai-office-agent-3d-state-machine', 'dat-ai-office-agent-face-controller' ), DAT_AI_OFFICE_VERSION, $in_footer );
	}

	public function npc_test_assets( $in_footer = true ) {
		wp_enqueue_style( 'dat-ai-office-npc-test', DAT_AI_OFFICE_URL . 'public/css/npc-test-scene.css', array(), DAT_AI_OFFICE_VERSION );
		wp_enqueue_script( 'dat-ai-office-three', DAT_AI_OFFICE_URL . 'public/js/vendor/three.min.js', array(), '0.128.0', $in_footer );
		wp_enqueue_script( 'dat-ai-office-fflate', DAT_AI_OFFICE_URL . 'public/js/vendor/fflate.min.js', array(), '0.6.10', $in_footer );
		wp_enqueue_script( 'dat-ai-office-fbx-loader', DAT_AI_OFFICE_URL . 'public/js/vendor/FBXLoader.js', array( 'dat-ai-office-three', 'dat-ai-office-fflate' ), '0.128.0', $in_footer );
		wp_enqueue_script( 'dat-ai-office-gltf-loader', DAT_AI_OFFICE_URL . 'public/js/vendor/GLTFLoader.js', array( 'dat-ai-office-three' ), '0.128.0', $in_footer );
		wp_enqueue_script( 'dat-ai-office-npc-animation-controller', DAT_AI_OFFICE_URL . 'public/js/npc-animation-controller.js', array( 'dat-ai-office-three' ), DAT_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'dat-ai-office-npc-character-controller', DAT_AI_OFFICE_URL . 'public/js/npc-character-controller.js', array( 'dat-ai-office-three', 'dat-ai-office-npc-animation-controller' ), DAT_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'dat-ai-office-npc-test-scene', DAT_AI_OFFICE_URL . 'public/js/npc-test-scene.js', array( 'dat-ai-office-fbx-loader', 'dat-ai-office-gltf-loader', 'dat-ai-office-npc-animation-controller', 'dat-ai-office-npc-character-controller' ), DAT_AI_OFFICE_VERSION, $in_footer );
	}
}
