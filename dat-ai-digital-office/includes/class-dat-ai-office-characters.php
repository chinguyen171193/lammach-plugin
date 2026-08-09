<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/** Character registry. Controllers and animation profiles are shared at runtime. */
final class DAT_AI_Office_Characters {
	const OPTION = 'dat_ai_office_character_models';
	const DEFAULT_PROFILE = 'default_quaternius_male';
	const FEMALE_PROFILE = 'default_quaternius_female';

	public static function profiles() {
		return array(
			self::DEFAULT_PROFILE => array( 'label' => 'Quaternius nam', 'animation_owner' => 'employee_001', 'retarget' => 'Direct' ),
			self::FEMALE_PROFILE => array( 'label' => 'Quaternius nữ', 'animation_owner' => 'employee_002', 'retarget' => 'Retargeted' ),
		);
	}

	public static function definitions() {
		return array(
			'employee_001' => self::definition( 'employee_001', 'Employee 001', 'Sale', 'public/assets/characters/employee_001/employee_001.fbx', 'Tương thích trực tiếp', array( 'x' => 0.75, 'y' => 0, 'z' => 0 ), self::DEFAULT_PROFILE ),
			'employee_002' => self::definition( 'employee_002', 'Employee 002', 'Chăm sóc khách hàng', 'public/assets/characters/employee_002/employee_002.fbx', 'Cần retarget', array( 'x' => -1.8, 'y' => 0, 'z' => 0 ), self::FEMALE_PROFILE ),
		);
	}

	private static function definition( $id, $name, $role, $fallback, $skeleton_status, $spawn, $animation_profile ) {
		$model = self::model( $id, $fallback );
		$profiles = self::profiles();
		$retarget_mode = $profiles[ $animation_profile ]['retarget'] ?? 'Failed';
		return array(
			'id' => $id, 'name' => $name, 'role' => $role, 'type' => 'npc', 'default_state' => 'IDLE', 'animation_profile' => $animation_profile,
			'retarget_mode' => $retarget_mode, 'model' => $model, 'skeleton_status' => $model['available'] ? ( 'media' === $model['source'] ? 'Chưa kiểm tra' : $skeleton_status ) : 'Chưa có model', 'spawn' => $spawn,
		);
	}

	public static function model( $employee, $fallback = '' ) {
		$stored = get_option( self::OPTION, array() ); $stored = is_array( $stored ) ? $stored : array();
		$attachment_id = absint( $stored[ $employee ]['attachment_id'] ?? 0 );
		if ( $attachment_id ) {
			$asset = self::valid_model_asset( $attachment_id );
			if ( ! is_wp_error( $asset ) ) { $asset['source'] = 'media'; return $asset + array( 'available' => true ); }
		}
		$path = $fallback ? DAT_AI_OFFICE_DIR . $fallback : '';
		if ( $path && file_exists( $path ) ) {
			return array( 'attachment_id' => 0, 'url' => DAT_AI_OFFICE_URL . $fallback, 'format' => strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ), 'label' => basename( $path ), 'source' => 'bundled', 'available' => true );
		}
		return array( 'attachment_id' => 0, 'url' => '', 'format' => '', 'label' => 'Chưa có model', 'source' => 'missing', 'available' => false );
	}

	public static function valid_model_asset( $attachment_id ) {
		$attachment_id = absint( $attachment_id ); $file = get_attached_file( $attachment_id );
		if ( ! $attachment_id || ! $file || ! file_exists( $file ) ) { return new WP_Error( 'dat_ai_office_model_file', 'Tệp model không tồn tại trong Media Library.' ); }
		$format = strtolower( pathinfo( $file, PATHINFO_EXTENSION ) );
		if ( ! in_array( $format, array( 'fbx', 'glb', 'gltf' ), true ) ) { return new WP_Error( 'dat_ai_office_model_format', 'Chỉ hỗ trợ tệp FBX, GLB hoặc GLTF.' ); }
		return array( 'attachment_id' => $attachment_id, 'url' => wp_get_attachment_url( $attachment_id ), 'format' => $format, 'label' => get_the_title( $attachment_id ) ?: basename( $file ), 'available' => true );
	}

	public static function get( $employee ) { $definitions = self::definitions(); return $definitions[ sanitize_key( $employee ) ] ?? null; }
	public static function exists( $employee ) { return null !== self::get( $employee ); }
	public static function animation_owner( $employee ) { $definition = self::get( $employee ); $profiles = self::profiles(); return $profiles[ $definition['animation_profile'] ?? '' ]['animation_owner'] ?? ''; }

	public static function set_model( $employee, $attachment_id ) {
		$employee = sanitize_key( $employee ); if ( ! self::exists( $employee ) ) { return new WP_Error( 'dat_ai_office_character', 'Không tìm thấy nhân vật.' ); }
		$asset = self::valid_model_asset( $attachment_id ); if ( is_wp_error( $asset ) ) { return $asset; }
		$models = get_option( self::OPTION, array() ); $models = is_array( $models ) ? $models : array(); $models[ $employee ] = array( 'attachment_id' => $asset['attachment_id'] ); update_option( self::OPTION, $models, false ); return $asset;
	}

	public static function public_definitions() {
		return array_values( array_map( static function( $definition ) {
			return array( 'id' => $definition['id'], 'name' => $definition['name'], 'role' => $definition['role'], 'type' => $definition['type'], 'default_state' => $definition['default_state'], 'animation_profile' => $definition['animation_profile'], 'retarget_mode' => $definition['retarget_mode'], 'model' => $definition['model'], 'skeleton_status' => $definition['skeleton_status'], 'spawn' => $definition['spawn'] );
		}, self::definitions() ) );
	}
}
