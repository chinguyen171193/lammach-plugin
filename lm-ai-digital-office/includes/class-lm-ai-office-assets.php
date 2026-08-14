<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class LM_AI_Office_Assets {
	public function __construct() {
		add_action( 'admin_enqueue_scripts', array( $this, 'admin_assets' ) );
	}

	public function public_assets( $in_footer = true ) {
		wp_enqueue_style( 'lm-ai-office-public', LM_AI_OFFICE_URL . 'public/css/digital-office.css', array(), LM_AI_OFFICE_VERSION );
		wp_enqueue_style( 'lm-ai-office-public-fixes', LM_AI_OFFICE_URL . 'public/css/digital-office-fixes.css', array( 'lm-ai-office-public' ), LM_AI_OFFICE_VERSION );
		wp_enqueue_style( 'lm-ai-office-agent-sprites', LM_AI_OFFICE_URL . 'public/css/agent-sprites.css', array( 'lm-ai-office-public' ), LM_AI_OFFICE_VERSION );
		wp_enqueue_style( 'lm-ai-office-agent-rig', LM_AI_OFFICE_URL . 'public/css/agent-rig.css', array( 'lm-ai-office-agent-sprites' ), LM_AI_OFFICE_VERSION );
		wp_enqueue_style( 'lm-ai-office-agent-3d', LM_AI_OFFICE_URL . 'public/css/agent-3d.css', array( 'lm-ai-office-agent-sprites' ), LM_AI_OFFICE_VERSION );
		wp_enqueue_script( 'lm-ai-office-pixi', LM_AI_OFFICE_URL . 'public/js/vendor/pixi.min.js', array(), '7.4.2', $in_footer );
		wp_enqueue_script( 'lm-ai-office-pathfinding', LM_AI_OFFICE_URL . 'public/js/office-pathfinding.js', array(), LM_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'lm-ai-office-agents', LM_AI_OFFICE_URL . 'public/js/office-agents.js', array( 'lm-ai-office-pixi', 'lm-ai-office-pathfinding' ), LM_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'lm-ai-office-events', LM_AI_OFFICE_URL . 'public/js/office-events.js', array(), LM_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'lm-ai-office-agent-rig', LM_AI_OFFICE_URL . 'public/js/agent-rig.js', array(), LM_AI_OFFICE_VERSION, $in_footer );
		$this->agent_3d_scripts( $in_footer );
		wp_enqueue_script( 'lm-ai-office-agent-sprite-player', LM_AI_OFFICE_URL . 'public/js/agent-sprite-player.js', array( 'lm-ai-office-agent-rig', 'lm-ai-office-agent-3d' ), LM_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'lm-ai-office-ui', LM_AI_OFFICE_URL . 'public/js/office-ui.js', array( 'lm-ai-office-agent-sprite-player' ), LM_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'lm-ai-office-engine', LM_AI_OFFICE_URL . 'public/js/office-engine.js', array( 'lm-ai-office-pixi', 'lm-ai-office-agents', 'lm-ai-office-events', 'lm-ai-office-ui' ), LM_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'lm-ai-office', LM_AI_OFFICE_URL . 'public/js/digital-office.js', array( 'lm-ai-office-engine' ), LM_AI_OFFICE_VERSION, $in_footer );
		wp_localize_script( 'lm-ai-office', 'LM_AI_OFFICE', array( 'restUrl' => esc_url_raw( rest_url( 'lm-ai-office/v1/' ) ), 'nonce' => wp_create_nonce( 'wp_rest' ), 'adminUrl' => admin_url( 'admin.php?page=lm-ai-office' ), 'agentAssetsUrl' => esc_url_raw( LM_AI_OFFICE_URL . 'assets/agents/' ), 'agentAssetsVersion' => LM_AI_OFFICE_BUILD, 'supervisorAppearance' => LM_AI_Office::supervisor_appearance() ) );
	}

	public function admin_assets( $hook ) {
		if ( false === strpos( (string) $hook, 'lm-ai-office' ) ) { return; }
		wp_enqueue_style( 'lm-ai-office-admin', LM_AI_OFFICE_URL . 'admin/css/admin.css', array(), LM_AI_OFFICE_VERSION );
		wp_enqueue_script( 'lm-ai-office-admin', LM_AI_OFFICE_URL . 'admin/js/admin.js', array( 'jquery' ), LM_AI_OFFICE_VERSION, true );
		wp_localize_script( 'lm-ai-office-admin', 'LM_AI_OFFICE_ADMIN', array( 'nonce' => wp_create_nonce( LM_AI_OFFICE_NONCE ), 'restNonce' => wp_create_nonce( 'wp_rest' ), 'restUrl' => esc_url_raw( rest_url( 'lm-ai-office/v1/' ) ), 'agentAssetsUrl' => esc_url_raw( LM_AI_OFFICE_URL . 'assets/agents/' ), 'agentAssetsVersion' => LM_AI_OFFICE_BUILD, 'supervisorAppearance' => LM_AI_Office::supervisor_appearance() ) );

		// The preview contains the shortcode but is rendered after admin_head.
		// Queue its public renderer here so both CSS and JavaScript are printed.
		$current_page = sanitize_key( $_GET['page'] ?? '' );
		if ( 'lm-ai-office-characters' === $current_page ) {
			wp_enqueue_media();
			wp_enqueue_script( 'lm-ai-office-characters', LM_AI_OFFICE_URL . 'admin/js/characters.js', array( 'jquery', 'media-editor' ), LM_AI_OFFICE_VERSION, true );
		}
		if ( 'lm-ai-office-animation-library' === $current_page ) {
			wp_enqueue_media();
			wp_enqueue_script( 'lm-ai-office-three', LM_AI_OFFICE_URL . 'public/js/vendor/three.min.js', array(), '0.128.0', true );
			wp_enqueue_script( 'lm-ai-office-fflate', LM_AI_OFFICE_URL . 'public/js/vendor/fflate.min.js', array(), '0.6.10', true );
			wp_enqueue_script( 'lm-ai-office-fbx-loader', LM_AI_OFFICE_URL . 'public/js/vendor/FBXLoader.js', array( 'lm-ai-office-three', 'lm-ai-office-fflate' ), '0.128.0', true );
			wp_enqueue_script( 'lm-ai-office-animation-library', LM_AI_OFFICE_URL . 'admin/js/animation-library.js', array( 'jquery', 'media-editor', 'lm-ai-office-fbx-loader' ), LM_AI_OFFICE_VERSION, true );
			wp_localize_script( 'lm-ai-office-animation-library', 'LM_AI_OFFICE_ANIMATION_PREVIEW', array( 'modelUrl' => LM_AI_OFFICE_URL . 'public/assets/characters/employee_001/employee_001.fbx', 'version' => LM_AI_OFFICE_BUILD ) );
		}
		if ( in_array( $current_page, array( 'lm-ai-office-agents', 'lm-ai-office-supervisor-studio' ), true ) ) {
			wp_enqueue_style( 'lm-ai-office-agent-sprites-admin', LM_AI_OFFICE_URL . 'admin/css/agent-sprites.css', array( 'lm-ai-office-admin' ), LM_AI_OFFICE_VERSION );
			wp_enqueue_style( 'lm-ai-office-agent-rig', LM_AI_OFFICE_URL . 'public/css/agent-rig.css', array( 'lm-ai-office-agent-sprites-admin' ), LM_AI_OFFICE_VERSION );
			wp_enqueue_style( 'lm-ai-office-agent-3d', LM_AI_OFFICE_URL . 'public/css/agent-3d.css', array( 'lm-ai-office-agent-sprites-admin' ), LM_AI_OFFICE_VERSION );
			wp_enqueue_script( 'lm-ai-office-agent-rig', LM_AI_OFFICE_URL . 'public/js/agent-rig.js', array(), LM_AI_OFFICE_VERSION, true );
			$this->agent_3d_scripts( true );
			wp_enqueue_script( 'lm-ai-office-agent-sprite-player', LM_AI_OFFICE_URL . 'public/js/agent-sprite-player.js', array( 'lm-ai-office-agent-rig', 'lm-ai-office-agent-3d' ), LM_AI_OFFICE_VERSION, true );
			wp_enqueue_script( 'lm-ai-office-agent-sprites-admin', LM_AI_OFFICE_URL . 'admin/js/agent-sprites-admin.js', array( 'lm-ai-office-admin', 'lm-ai-office-agent-sprite-player' ), LM_AI_OFFICE_VERSION, true );
		}
		if ( 'lm-ai-office-preview' === $current_page || false !== strpos( (string) $hook, 'preview' ) ) {
			$this->npc_test_assets( false );
		}
	}

	private function agent_3d_scripts( $in_footer ) {
		wp_enqueue_script( 'lm-ai-office-three', LM_AI_OFFICE_URL . 'public/js/vendor/three.min.js', array(), '0.128.0', $in_footer );
		wp_enqueue_script( 'lm-ai-office-gltf-loader', LM_AI_OFFICE_URL . 'public/js/vendor/GLTFLoader.js', array( 'lm-ai-office-three' ), '0.128.0', $in_footer );
		wp_enqueue_script( 'lm-ai-office-agent-3d-state-machine', LM_AI_OFFICE_URL . 'public/js/agent-3d-state-machine.js', array( 'lm-ai-office-three' ), LM_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'lm-ai-office-agent-face-controller', LM_AI_OFFICE_URL . 'public/js/agent-face-controller.js', array( 'lm-ai-office-three' ), LM_AI_OFFICE_VERSION, $in_footer );
		wp_enqueue_script( 'lm-ai-office-agent-3d', LM_AI_OFFICE_URL . 'public/js/agent-3d.js', array( 'lm-ai-office-gltf-loader', 'lm-ai-office-agent-3d-state-machine', 'lm-ai-office-agent-face-controller' ), LM_AI_OFFICE_VERSION, $in_footer );
	}

	public function npc_test_assets( $in_footer = true ) {
		$npc_version = LM_AI_OFFICE_BUILD;
		wp_enqueue_style( 'lm-ai-office-npc-test', LM_AI_OFFICE_URL . 'public/css/npc-test-scene.css', array(), $npc_version );
		wp_enqueue_script( 'lm-ai-office-three', LM_AI_OFFICE_URL . 'public/js/vendor/three.min.js', array(), '0.128.0', $in_footer );
		wp_enqueue_script( 'lm-ai-office-fflate', LM_AI_OFFICE_URL . 'public/js/vendor/fflate.min.js', array(), '0.6.10', $in_footer );
		wp_enqueue_script( 'lm-ai-office-fbx-loader', LM_AI_OFFICE_URL . 'public/js/vendor/FBXLoader.js', array( 'lm-ai-office-three', 'lm-ai-office-fflate' ), '0.128.0', $in_footer );
		wp_enqueue_script( 'lm-ai-office-gltf-loader', LM_AI_OFFICE_URL . 'public/js/vendor/GLTFLoader.js', array( 'lm-ai-office-three' ), '0.128.0', $in_footer );
		wp_enqueue_script( 'lm-ai-office-skeleton-utils', LM_AI_OFFICE_URL . 'public/js/vendor/SkeletonUtils.js', array( 'lm-ai-office-three' ), '0.128.0', $in_footer );
		wp_enqueue_script( 'lm-ai-office-npc-animation-controller', LM_AI_OFFICE_URL . 'public/js/npc-animation-controller.js', array( 'lm-ai-office-three' ), $npc_version, $in_footer );
		wp_enqueue_script( 'lm-ai-office-npc-character-controller', LM_AI_OFFICE_URL . 'public/js/npc-character-controller.js', array( 'lm-ai-office-three', 'lm-ai-office-npc-animation-controller' ), $npc_version, $in_footer );
		wp_enqueue_script( 'lm-ai-office-npc-test-scene', LM_AI_OFFICE_URL . 'public/js/npc-test-scene.js', array( 'lm-ai-office-fbx-loader', 'lm-ai-office-gltf-loader', 'lm-ai-office-skeleton-utils', 'lm-ai-office-npc-animation-controller', 'lm-ai-office-npc-character-controller' ), $npc_version, $in_footer );
	}
}
