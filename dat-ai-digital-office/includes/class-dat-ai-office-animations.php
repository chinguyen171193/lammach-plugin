<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

/** Central registry for character motion assets. Files stay in the Media Library; this option stores only references. */
final class DAT_AI_Office_Animations {
	const OPTION = 'dat_ai_office_animation_library';
	const EMPLOYEE = 'employee_001';

	public static function actions() {
		return array(
			'IDLE' => array( 'label' => 'Chờ việc', 'description' => 'Nhân vật đứng chờ nhiệm vụ.' ), 'WALKING' => array( 'label' => 'Đi bộ', 'description' => 'Nhân vật di chuyển trong văn phòng.' ),
			'SIT_DOWN' => array( 'label' => 'Ngồi xuống', 'description' => 'Nhân vật ngồi vào ghế.' ), 'SITTING_IDLE' => array( 'label' => 'Ngồi chờ', 'description' => 'Nhân vật ngồi chờ trước bàn làm việc.' ),
			'STAND_UP' => array( 'label' => 'Đứng dậy', 'description' => 'Nhân vật đứng dậy khỏi ghế.' ), 'TYPING' => array( 'label' => 'Gõ bàn phím', 'description' => 'Nhân vật ngồi trước máy tính và gõ bàn phím.' ),
			'USING_MOUSE' => array( 'label' => 'Dùng chuột', 'description' => 'Nhân vật thao tác chuột.' ), 'THINKING' => array( 'label' => 'Suy nghĩ', 'description' => 'Nhân vật suy nghĩ.' ),
			'READING' => array( 'label' => 'Đọc tài liệu', 'description' => 'Nhân vật đọc tài liệu.' ), 'TALKING' => array( 'label' => 'Nói chuyện', 'description' => 'Nhân vật nói chuyện.' ), 'PHONE_CALL' => array( 'label' => 'Gọi điện thoại', 'description' => 'Nhân vật gọi điện thoại.' ),
			'LISTENING' => array( 'label' => 'Đang nghe', 'description' => 'Chuẩn bị cho tương tác sau này.' ), 'WRITING' => array( 'label' => 'Viết tài liệu', 'description' => 'Chuẩn bị cho tương tác sau này.' ), 'DRINKING' => array( 'label' => 'Uống nước', 'description' => 'Chuẩn bị cho tương tác sau này.' ), 'CELEBRATING' => array( 'label' => 'Hoàn thành công việc', 'description' => 'Chuẩn bị cho tương tác sau này.' ),
		);
	}
	public static function upload_mimes( $mimes ) { $mimes['fbx'] = 'application/octet-stream'; $mimes['glb'] = 'model/gltf-binary'; $mimes['gltf'] = 'model/gltf+json'; return $mimes; }
	public static function default_library() {
		$base = DAT_AI_OFFICE_URL . 'public/assets/characters/employee_001/animations.fbx';
		return array( self::EMPLOYEE => array(
			'IDLE' => array( array( 'attachment_id' => 0, 'url' => $base, 'format' => 'fbx', 'label' => 'Idle 01', 'clip' => 'CharacterArmature|Idle_Neutral', 'source' => 'bundled', 'retarget_status' => 'compatible' ) ),
			'WALKING' => array( array( 'attachment_id' => 0, 'url' => $base, 'format' => 'fbx', 'label' => 'Walk 01', 'clip' => 'CharacterArmature|Walk', 'source' => 'bundled', 'retarget_status' => 'compatible' ) ),
		) );
	}
	public static function library() { return wp_parse_args( get_option( self::OPTION, array() ), self::default_library() ); }
	public static function assets( $employee = self::EMPLOYEE ) { $library = self::library(); $owner = DAT_AI_Office_Characters::animation_owner( $employee ); return is_array( $library[ $owner ] ?? null ) ? $library[ $owner ] : array(); }
	public static function public_assets( $employee = self::EMPLOYEE ) {
		$out = array();
		foreach ( self::assets( $employee ) as $action => $variants ) {
			if ( ! isset( self::actions()[ $action ] ) || ! is_array( $variants ) ) { continue; }
			$out[ $action ] = array_values( array_map( static function( $asset ) { return array_intersect_key( $asset, array_flip( array( 'url', 'format', 'label', 'clip', 'retarget_status' ) ) ); }, $variants ) );
		}
		return $out;
	}
	public static function valid_asset( $attachment_id ) {
		$attachment_id = absint( $attachment_id ); $file = get_attached_file( $attachment_id );
		if ( ! $attachment_id || ! $file || ! file_exists( $file ) ) { return new WP_Error( 'dat_ai_office_animation_file', 'Tệp không tồn tại trong Media Library.' ); }
		$extension = strtolower( pathinfo( $file, PATHINFO_EXTENSION ) );
		if ( ! in_array( $extension, array( 'fbx', 'glb', 'gltf' ), true ) ) { return new WP_Error( 'dat_ai_office_animation_format', 'Chỉ hỗ trợ tệp .fbx, .glb hoặc .gltf.' ); }
		return array( 'attachment_id' => $attachment_id, 'url' => wp_get_attachment_url( $attachment_id ), 'format' => $extension, 'label' => get_the_title( $attachment_id ) ?: basename( $file ), 'clip' => '', 'source' => 'media', 'retarget_status' => 'unverified' );
	}
	public static function add( $employee, $action, $attachment_id ) {
		$employee = sanitize_key( $employee ); $action = strtoupper( sanitize_key( $action ) );
		$owner = DAT_AI_Office_Characters::animation_owner( $employee );
		if ( ! $owner || ! isset( self::actions()[ $action ] ) ) { return new WP_Error( 'dat_ai_office_animation_input', 'Nhân vật hoặc hành động không hợp lệ.' ); }
		$asset = self::valid_asset( $attachment_id ); if ( is_wp_error( $asset ) ) { return $asset; }
		$library = self::library(); if ( ! isset( $library[ $owner ] ) ) { $library[ $owner ] = array(); }
		$variants = $library[ $owner ][ $action ] ?? array();
		foreach ( $variants as $variant ) { if ( absint( $variant['attachment_id'] ?? 0 ) === $asset['attachment_id'] ) { return new WP_Error( 'dat_ai_office_animation_duplicate', 'Tệp này đã được gán cho hành động.' ); } }
		$variants[] = $asset; $library[ $owner ][ $action ] = $variants; update_option( self::OPTION, $library, false ); return $asset;
	}
	public static function remove( $employee, $action, $index ) {
		$employee = sanitize_key( $employee ); $action = strtoupper( sanitize_key( $action ) );
		$owner = DAT_AI_Office_Characters::animation_owner( $employee ); $library = self::library(); if ( ! $owner || ! isset( self::actions()[ $action ], $library[ $owner ][ $action ][ $index ] ) ) { return new WP_Error( 'dat_ai_office_animation_input', 'Animation không hợp lệ.' ); }
		unset( $library[ $owner ][ $action ][ $index ] ); $library[ $owner ][ $action ] = array_values( $library[ $owner ][ $action ] ); update_option( self::OPTION, $library, false ); return true;
	}
}
