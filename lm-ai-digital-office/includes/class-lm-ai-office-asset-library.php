<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registry for static, placeable office assets.
 *
 * The registry deliberately stores Media Library references and JSON-safe data
 * only. It never stores GLB binaries or local filesystem paths in WordPress
 * options, and scene instances only keep an asset ID plus a transform.
 */
final class LM_AI_Office_Asset_Library {
	const OPTION       = 'lm_ai_office_asset_library';
	const SCENE_OPTION = 'lm_ai_office_build_scene';
	const DEFAULT_SCENE_ID = 'office_default';
	const MAX_ASSETS   = 500;
	const MAX_OBJECTS  = 1000;

	/**
	 * Category IDs are intentionally English/stable; their labels are Vietnamese.
	 *
	 * @return array<string, string>
	 */
	public static function categories() {
		return array(
			'TABLE'      => 'Bàn',
			'CHAIR'      => 'Ghế',
			'COMPUTER'   => 'Máy tính',
			'CABINET'    => 'Tủ',
			'LIGHT'      => 'Đèn',
			'PLANT'      => 'Cây',
			'DECORATION' => 'Trang trí',
			'DEVICE'     => 'Thiết bị',
			'BUILDING'   => 'Công trình',
			'OTHER'      => 'Khác',
		);
	}

	/**
	 * @return array<string, array>
	 */
	public static function assets() {
		$stored = get_option( self::OPTION, array() );
		if ( ! is_array( $stored ) ) {
			return array();
		}

		$assets = isset( $stored['assets'] ) && is_array( $stored['assets'] ) ? $stored['assets'] : $stored;
		$out    = array();
		foreach ( $assets as $id => $asset ) {
			$id = self::sanitize_asset_id( is_array( $asset ) && ! empty( $asset['id'] ) ? $asset['id'] : $id );
			if ( ! $id || ! is_array( $asset ) ) {
				continue;
			}
			$out[ $id ] = self::normalize_stored_asset( $asset, $id );
		}
		return $out;
	}

	/**
	 * @return array|null
	 */
	public static function asset( $asset_id ) {
		$asset_id = self::sanitize_asset_id( $asset_id );
		$assets   = self::assets();
		return $asset_id && isset( $assets[ $asset_id ] ) ? $assets[ $asset_id ] : null;
	}

	/**
	 * Public adapter used by the REST API and Three.js runtime.
	 *
	 * @return array
	 */
	public static function definition( $asset ) {
		if ( is_string( $asset ) ) {
			$asset = self::asset( $asset );
		}
		if ( ! is_array( $asset ) ) {
			return array();
		}

		$model       = self::valid_model_attachment( $asset['attachment_id'] ?? 0 );
		$thumbnail   = self::thumbnail_definition( $asset['thumbnail_id'] ?? 0 );
		$is_available = ! is_wp_error( $model );
		$transform   = is_array( $asset['transform_defaults'] ?? null ) ? $asset['transform_defaults'] : array();
		$metadata    = is_array( $asset['metadata'] ?? null ) ? $asset['metadata'] : array();

		return array(
			'id'                => $asset['id'],
			'name'              => $asset['name'],
			'category'          => $asset['category'],
			'categoryLabel'     => self::categories()[ $asset['category'] ] ?? self::categories()['OTHER'],
			'model'             => array(
				'url'       => $is_available ? $model['file_url'] : '',
				'format'    => 'glb',
				'available' => $is_available,
			),
			'thumbnail'         => $thumbnail,
			'transformDefaults' => array(
				'scale'       => (float) ( $transform['scale'] ?? 1 ),
				'rotationY'   => (float) ( $transform['rotation_y'] ?? 0 ),
				'floorOffset' => (float) ( $transform['floor_offset'] ?? 0 ),
			),
			'license'           => array(
				'type'      => $asset['license'],
				'author'    => $asset['author'],
				'sourceUrl' => $asset['source_url'],
			),
			'source'            => $asset['source'],
			'metadata'          => array(
				'notes'            => $metadata['notes'] ?? '',
				'interaction_type' => $metadata['interaction_type'] ?? null,
			),
			'status'            => $is_available ? 'ready' : 'error',
			'statusLabel'       => $is_available ? 'Sẵn sàng' : 'Lỗi mô hình',
			'isUsed'            => self::asset_is_used( $asset['id'] ),
		);
	}

	/**
	 * @return array<int, array>
	 */
	public static function definitions() {
		$definitions = array_map( array( __CLASS__, 'definition' ), array_values( self::assets() ) );
		usort(
			$definitions,
			static function ( $left, $right ) {
				return strnatcasecmp( $left['name'] ?? '', $right['name'] ?? '' );
			}
		);
		return $definitions;
	}

	/**
	 * @param array $input Sanitized at the field level below.
	 * @return array|WP_Error
	 */
	public static function create( $input ) {
		$assets = self::assets();
		if ( count( $assets ) >= self::MAX_ASSETS ) {
			return new WP_Error( 'lm_ai_office_asset_limit', 'Đã đạt giới hạn tài sản của phiên bản hiện tại.', array( 'status' => 400 ) );
		}

		$asset_id = self::new_asset_id( $assets );
		$asset    = self::sanitize_asset_input( $input, array( 'id' => $asset_id ), true );
		if ( is_wp_error( $asset ) ) {
			return $asset;
		}

		$assets[ $asset_id ] = $asset;
		self::save_assets( $assets );
		return self::definition( $asset );
	}

	/**
	 * @param string $asset_id
	 * @param array  $input
	 * @return array|WP_Error
	 */
	public static function update( $asset_id, $input ) {
		$asset_id = self::sanitize_asset_id( $asset_id );
		$assets   = self::assets();
		if ( ! $asset_id || ! isset( $assets[ $asset_id ] ) ) {
			return new WP_Error( 'lm_ai_office_asset_not_found', 'Không tìm thấy tài sản.', array( 'status' => 404 ) );
		}

		$asset = self::sanitize_asset_input( $input, $assets[ $asset_id ], false );
		if ( is_wp_error( $asset ) ) {
			return $asset;
		}
		$assets[ $asset_id ] = $asset;
		self::save_assets( $assets );
		return self::definition( $asset );
	}

	/**
	 * Removes only the registry record. The Media Library attachment remains.
	 *
	 * @return true|WP_Error
	 */
	public static function delete( $asset_id ) {
		$asset_id = self::sanitize_asset_id( $asset_id );
		$assets   = self::assets();
		if ( ! $asset_id || ! isset( $assets[ $asset_id ] ) ) {
			return new WP_Error( 'lm_ai_office_asset_not_found', 'Không tìm thấy tài sản.', array( 'status' => 404 ) );
		}
		if ( self::asset_is_used( $asset_id ) ) {
			return new WP_Error( 'lm_ai_office_asset_in_use', 'Tài sản đang được sử dụng trong văn phòng. Hãy xóa các bản đặt trước.', array( 'status' => 409 ) );
		}

		unset( $assets[ $asset_id ] );
		self::save_assets( $assets );
		return true;
	}

	/**
	 * Validate a GLB selected through the WordPress Media Library.
	 *
	 * @return array|WP_Error
	 */
	public static function valid_model_attachment( $attachment_id ) {
		$attachment_id = is_scalar( $attachment_id ) ? absint( $attachment_id ) : 0;
		$attachment    = $attachment_id ? get_post( $attachment_id ) : null;
		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return new WP_Error( 'lm_ai_office_asset_attachment', 'Tệp mô hình phải được chọn từ Thư viện Media.', array( 'status' => 400 ) );
		}

		$file = get_attached_file( $attachment_id );
		$url  = wp_get_attachment_url( $attachment_id );
		if ( ! $file || ! file_exists( $file ) || ! $url ) {
			return new WP_Error( 'lm_ai_office_asset_file', 'Không tìm thấy tệp mô hình trong Media Library.', array( 'status' => 400 ) );
		}

		$format = strtolower( pathinfo( $file, PATHINFO_EXTENSION ) );
		if ( 'glb' !== $format ) {
			return new WP_Error( 'lm_ai_office_asset_format', 'Phiên bản hiện tại chỉ hỗ trợ tệp GLB.', array( 'status' => 400 ) );
		}

		$mime         = (string) get_post_mime_type( $attachment_id );
		$allowed_mime = array( 'model/gltf-binary', 'application/gltf-binary', 'application/octet-stream' );
		if ( ! $mime || ! in_array( $mime, $allowed_mime, true ) ) {
			return new WP_Error( 'lm_ai_office_asset_mime', 'Tệp GLB có MIME không hợp lệ.', array( 'status' => 400 ) );
		}

		return array(
			'attachment_id' => $attachment_id,
			'file_url'      => esc_url_raw( $url ),
			'file_format'   => 'glb',
			'label'         => get_the_title( $attachment_id ) ?: basename( $file ),
		);
	}

	/**
	 * @return array|WP_Error
	 */
	public static function valid_thumbnail_attachment( $attachment_id ) {
		$attachment_id = is_scalar( $attachment_id ) ? absint( $attachment_id ) : 0;
		if ( ! $attachment_id ) {
			return array( 'thumbnail_id' => 0, 'thumbnail_url' => '' );
		}
		$attachment = get_post( $attachment_id );
		if ( ! $attachment || 'attachment' !== $attachment->post_type || ! wp_attachment_is_image( $attachment_id ) ) {
			return new WP_Error( 'lm_ai_office_asset_thumbnail', 'Ảnh đại diện phải được chọn từ Thư viện Media.', array( 'status' => 400 ) );
		}
		$url = wp_get_attachment_image_url( $attachment_id, 'medium' );
		if ( ! $url ) {
			$url = wp_get_attachment_url( $attachment_id );
		}
		return array( 'thumbnail_id' => $attachment_id, 'thumbnail_url' => esc_url_raw( $url ) );
	}

	/**
	 * @return array
	 */
	public static function scene() {
		$scene = get_option( self::SCENE_OPTION, array() );
		if ( ! is_array( $scene ) ) {
			$scene = array();
		}
		return self::normalize_scene( $scene );
	}

	/**
	 * @param array $input
	 * @return array|WP_Error
	 */
	public static function save_scene( $input ) {
		if ( isset( $input['scene'] ) && is_array( $input['scene'] ) ) {
			$input = $input['scene'];
		}
		if ( ! is_array( $input ) ) {
			return new WP_Error( 'lm_ai_office_scene_invalid', 'Dữ liệu văn phòng không hợp lệ.', array( 'status' => 400 ) );
		}

		$scene = self::sanitize_scene( $input );
		if ( is_wp_error( $scene ) ) {
			return $scene;
		}
		update_option( self::SCENE_OPTION, $scene, false );
		return $scene;
	}

	/**
	 * @return bool
	 */
	public static function asset_is_used( $asset_id ) {
		foreach ( self::scene()['objects'] as $object ) {
			if ( $asset_id === ( $object['asset_id'] ?? '' ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param array  $input
	 * @param array  $existing
	 * @param bool   $creating
	 * @return array|WP_Error
	 */
	private static function sanitize_asset_input( $input, $existing, $creating ) {
		$input    = is_array( $input ) ? $input : array();
		$existing = self::normalize_stored_asset( $existing, $existing['id'] ?? '' );
		$name     = self::input_text( $input, 'name', $existing['name'] );
		if ( '' === $name ) {
			return new WP_Error( 'lm_ai_office_asset_name', 'Tên tài sản là bắt buộc.', array( 'status' => 400 ) );
		}

		$category = self::input_category( $input, $existing['category'] );
		if ( ! isset( self::categories()[ $category ] ) ) {
			return new WP_Error( 'lm_ai_office_asset_category', 'Loại tài sản không hợp lệ.', array( 'status' => 400 ) );
		}

		$attachment_id = self::input_attachment_id( $input, $existing['attachment_id'], $creating );
		$model         = self::valid_model_attachment( $attachment_id );
		if ( is_wp_error( $model ) ) {
			return $model;
		}

		$thumbnail_id = self::input_integer( $input, 'thumbnail_id', $existing['thumbnail_id'] );
		$thumbnail    = self::valid_thumbnail_attachment( $thumbnail_id );
		if ( is_wp_error( $thumbnail ) ) {
			return $thumbnail;
		}

		$transform = self::input_transform( $input, $existing['transform_defaults'] );
		if ( is_wp_error( $transform ) ) {
			return $transform;
		}

		$metadata = is_array( $existing['metadata'] ?? null ) ? $existing['metadata'] : array();
		if ( array_key_exists( 'notes', $input ) ) {
			$metadata['notes'] = sanitize_textarea_field( wp_unslash( self::scalar_string( $input['notes'] ) ) );
		} elseif ( isset( $input['metadata'] ) && is_array( $input['metadata'] ) && array_key_exists( 'notes', $input['metadata'] ) ) {
			$metadata['notes'] = sanitize_textarea_field( wp_unslash( self::scalar_string( $input['metadata']['notes'] ) ) );
		}
		if ( array_key_exists( 'interaction_type', $input ) ) {
			$metadata['interaction_type'] = self::nullable_key( $input['interaction_type'] );
		} elseif ( isset( $input['metadata'] ) && is_array( $input['metadata'] ) && array_key_exists( 'interaction_type', $input['metadata'] ) ) {
			$metadata['interaction_type'] = self::nullable_key( $input['metadata']['interaction_type'] );
		}

		return array(
			'id'                 => self::sanitize_asset_id( $existing['id'] ) ?: self::new_asset_id( self::assets() ),
			'name'               => $name,
			'category'           => $category,
			'attachment_id'      => $model['attachment_id'],
			'file_url'           => $model['file_url'],
			'file_format'        => $model['file_format'],
			'thumbnail_id'       => $thumbnail['thumbnail_id'],
			'source'             => self::input_text( $input, 'source', $existing['source'] ),
			'author'             => self::input_text( $input, 'author', $existing['author'] ),
			'license'            => self::input_text( $input, 'license', $existing['license'] ),
			'source_url'         => self::input_url( $input, 'source_url', $existing['source_url'] ),
			'metadata'           => array(
				'notes'            => $metadata['notes'] ?? '',
				'interaction_type' => $metadata['interaction_type'] ?? null,
			),
			'transform_defaults' => $transform,
			'created_at'         => $existing['created_at'] ?: current_time( 'mysql', true ),
			'updated_at'         => current_time( 'mysql', true ),
		);
	}

	/**
	 * @param array $asset
	 * @param string $id
	 * @return array
	 */
	private static function normalize_stored_asset( $asset, $id ) {
		$categories = self::categories();
		$category   = strtoupper( sanitize_key( self::scalar_string( $asset['category'] ?? 'OTHER' ) ) );
		$transform  = is_array( $asset['transform_defaults'] ?? null ) ? $asset['transform_defaults'] : array();
		$metadata   = is_array( $asset['metadata'] ?? null ) ? $asset['metadata'] : array();
		return array(
			'id'                 => self::sanitize_asset_id( $asset['id'] ?? $id ),
			'name'               => sanitize_text_field( self::scalar_string( $asset['name'] ?? '' ) ),
			'category'           => isset( $categories[ $category ] ) ? $category : 'OTHER',
			'attachment_id'      => is_scalar( $asset['attachment_id'] ?? null ) ? absint( $asset['attachment_id'] ) : 0,
			'file_url'           => esc_url_raw( self::scalar_string( $asset['file_url'] ?? '' ) ),
			'file_format'        => 'glb',
			'thumbnail_id'       => is_scalar( $asset['thumbnail_id'] ?? null ) ? absint( $asset['thumbnail_id'] ) : 0,
			'source'             => sanitize_text_field( self::scalar_string( $asset['source'] ?? '' ) ),
			'author'             => sanitize_text_field( self::scalar_string( $asset['author'] ?? '' ) ),
			'license'            => sanitize_text_field( self::scalar_string( $asset['license'] ?? '' ) ),
			'source_url'         => esc_url_raw( self::scalar_string( $asset['source_url'] ?? '' ) ),
			'metadata'           => array(
				'notes'            => sanitize_textarea_field( self::scalar_string( $metadata['notes'] ?? '' ) ),
				'interaction_type' => self::nullable_key( $metadata['interaction_type'] ?? null ),
			),
			'transform_defaults' => array(
				'scale'        => self::bounded_float( $transform['scale'] ?? 1, 0.01, 100, 1 ),
				'rotation_y'   => self::bounded_float( $transform['rotation_y'] ?? 0, -6283.185, 6283.185, 0 ),
				'floor_offset' => self::bounded_float( $transform['floor_offset'] ?? 0, -1000, 1000, 0 ),
			),
			'created_at'         => sanitize_text_field( self::scalar_string( $asset['created_at'] ?? '' ) ),
			'updated_at'         => sanitize_text_field( self::scalar_string( $asset['updated_at'] ?? '' ) ),
		);
	}

	/**
	 * @param array $input
	 * @param array $existing
	 * @return array|WP_Error
	 */
	private static function input_transform( $input, $existing ) {
		$defaults = array(
			'scale'        => self::bounded_float( $existing['scale'] ?? 1, 0.01, 100, 1 ),
			'rotation_y'   => self::bounded_float( $existing['rotation_y'] ?? 0, -6283.185, 6283.185, 0 ),
			'floor_offset' => self::bounded_float( $existing['floor_offset'] ?? 0, -1000, 1000, 0 ),
		);
		$rest_transform = isset( $input['transformDefaults'] ) && is_array( $input['transformDefaults'] ) ? $input['transformDefaults'] : array();

		$scale = array_key_exists( 'default_scale', $input ) ? $input['default_scale'] : ( array_key_exists( 'scale', $rest_transform ) ? $rest_transform['scale'] : $defaults['scale'] );
		if ( ! is_numeric( $scale ) || (float) $scale < 0.01 || (float) $scale > 100 ) {
			return new WP_Error( 'lm_ai_office_asset_scale', 'Tỷ lệ mặc định phải nằm trong khoảng 0.01 đến 100.', array( 'status' => 400 ) );
		}

		if ( array_key_exists( 'default_rotation_degrees', $input ) ) {
			$rotation = $input['default_rotation_degrees'];
			if ( ! is_numeric( $rotation ) || (float) $rotation < -360000 || (float) $rotation > 360000 ) {
				return new WP_Error( 'lm_ai_office_asset_rotation', 'Góc xoay mặc định không hợp lệ.', array( 'status' => 400 ) );
			}
			$rotation = deg2rad( (float) $rotation );
		} else {
			$rotation = array_key_exists( 'rotationY', $rest_transform ) ? $rest_transform['rotationY'] : $defaults['rotation_y'];
			if ( ! is_numeric( $rotation ) || (float) $rotation < -6283.185 || (float) $rotation > 6283.185 ) {
				return new WP_Error( 'lm_ai_office_asset_rotation', 'Góc xoay mặc định không hợp lệ.', array( 'status' => 400 ) );
			}
		}

		$floor = array_key_exists( 'floor_offset', $input ) ? $input['floor_offset'] : ( array_key_exists( 'floorOffset', $rest_transform ) ? $rest_transform['floorOffset'] : $defaults['floor_offset'] );
		if ( ! is_numeric( $floor ) || (float) $floor < -1000 || (float) $floor > 1000 ) {
			return new WP_Error( 'lm_ai_office_asset_floor', 'Độ lệch sàn không hợp lệ.', array( 'status' => 400 ) );
		}

		return array(
			'scale'        => (float) $scale,
			'rotation_y'   => (float) $rotation,
			'floor_offset' => (float) $floor,
		);
	}

	/**
	 * @param array $scene
	 * @return array
	 */
	private static function normalize_scene( $scene ) {
		$objects = isset( $scene['objects'] ) && is_array( $scene['objects'] ) ? $scene['objects'] : array();
		$out     = array();
		$seen    = array();
		$assets  = self::assets();
		foreach ( array_slice( $objects, 0, self::MAX_OBJECTS ) as $object ) {
			$object = self::sanitize_scene_object( $object, $assets, $seen, true );
			if ( is_array( $object ) ) {
				$out[] = $object;
				$seen[ $object['instance_id'] ] = true;
			}
		}
		return array(
			'scene_id'   => self::DEFAULT_SCENE_ID,
			'name'       => sanitize_text_field( self::scalar_string( $scene['name'] ?? 'Văn phòng' ) ) ?: 'Văn phòng',
			'objects'    => $out,
			'updated_at' => sanitize_text_field( self::scalar_string( $scene['updated_at'] ?? '' ) ),
		);
	}

	/**
	 * @param array $scene
	 * @return array|WP_Error
	 */
	private static function sanitize_scene( $scene ) {
		$objects = isset( $scene['objects'] ) && is_array( $scene['objects'] ) ? $scene['objects'] : null;
		if ( null === $objects ) {
			return new WP_Error( 'lm_ai_office_scene_objects', 'Danh sách object của văn phòng không hợp lệ.', array( 'status' => 400 ) );
		}
		if ( count( $objects ) > self::MAX_OBJECTS ) {
			return new WP_Error( 'lm_ai_office_scene_limit', 'Văn phòng có quá nhiều object.', array( 'status' => 400 ) );
		}

		$assets = self::assets();
		$out    = array();
		$seen   = array();
		foreach ( $objects as $object ) {
			$clean = self::sanitize_scene_object( $object, $assets, $seen, false );
			if ( is_wp_error( $clean ) ) {
				return $clean;
			}
			$out[]                 = $clean;
			$seen[ $clean['instance_id'] ] = true;
		}

		return array(
			'scene_id'   => self::DEFAULT_SCENE_ID,
			'name'       => sanitize_text_field( self::scalar_string( $scene['name'] ?? 'Văn phòng' ) ) ?: 'Văn phòng',
			'objects'    => $out,
			'updated_at' => current_time( 'mysql', true ),
		);
	}

	/**
	 * @param mixed $object
	 * @param array $assets
	 * @param array $seen
	 * @param bool  $tolerant Whether invalid legacy objects can be skipped.
	 * @return array|WP_Error|null
	 */
	private static function sanitize_scene_object( $object, $assets, $seen, $tolerant ) {
		if ( ! is_array( $object ) ) {
			return $tolerant ? null : new WP_Error( 'lm_ai_office_scene_object', 'Object trong văn phòng không hợp lệ.', array( 'status' => 400 ) );
		}
		$asset_id = self::sanitize_asset_id( $object['asset_id'] ?? '' );
		if ( ! $asset_id || ! isset( $assets[ $asset_id ] ) ) {
			return $tolerant ? null : new WP_Error( 'lm_ai_office_scene_asset', 'Object tham chiếu đến tài sản không tồn tại.', array( 'status' => 400 ) );
		}

		$instance_id = self::sanitize_instance_id( $object['instance_id'] ?? '' );
		if ( ! $instance_id || isset( $seen[ $instance_id ] ) ) {
			$instance_id = self::new_instance_id( $seen );
		}

		$position = self::sanitize_vector( $object['position'] ?? array(), -10000, 10000, 0 );
		$rotation = self::sanitize_vector( $object['rotation'] ?? array(), -6283.185, 6283.185, 0 );
		$scale    = self::sanitize_vector( $object['scale'] ?? array(), 0.01, 100, 1 );
		if ( is_wp_error( $position ) || is_wp_error( $rotation ) || is_wp_error( $scale ) ) {
			return $tolerant ? null : new WP_Error( 'lm_ai_office_scene_transform', 'Transform của object không hợp lệ.', array( 'status' => 400 ) );
		}

		return array(
			'instance_id' => $instance_id,
			'asset_id'    => $asset_id,
			'position'    => $position,
			'rotation'    => $rotation,
			'scale'       => $scale,
		);
	}

	/**
	 * @return array|WP_Error
	 */
	private static function sanitize_vector( $value, $min, $max, $fallback ) {
		$value = is_array( $value ) ? $value : array();
		$out   = array();
		foreach ( array( 'x', 'y', 'z' ) as $axis ) {
			$current = $value[ $axis ] ?? $fallback;
			if ( ! is_numeric( $current ) || (float) $current < $min || (float) $current > $max ) {
				return new WP_Error( 'lm_ai_office_vector', 'Giá trị transform không hợp lệ.' );
			}
			$out[ $axis ] = (float) $current;
		}
		return $out;
	}

	/**
	 * @return array|null
	 */
	private static function thumbnail_definition( $attachment_id ) {
		$thumbnail = self::valid_thumbnail_attachment( $attachment_id );
		if ( is_wp_error( $thumbnail ) || empty( $thumbnail['thumbnail_id'] ) ) {
			return null;
		}
		return array( 'id' => $thumbnail['thumbnail_id'], 'url' => $thumbnail['thumbnail_url'] );
	}

	/** @param array<string, array> $assets */
	private static function save_assets( $assets ) {
		update_option( self::OPTION, array( 'assets' => $assets ), false );
	}

	private static function input_attachment_id( $input, $fallback, $creating ) {
		if ( array_key_exists( 'model_attachment_id', $input ) ) {
			return is_scalar( $input['model_attachment_id'] ) ? absint( $input['model_attachment_id'] ) : 0;
		}
		if ( array_key_exists( 'attachment_id', $input ) ) {
			return is_scalar( $input['attachment_id'] ) ? absint( $input['attachment_id'] ) : 0;
		}
		if ( isset( $input['model'] ) && is_array( $input['model'] ) && array_key_exists( 'attachmentId', $input['model'] ) ) {
			return is_scalar( $input['model']['attachmentId'] ) ? absint( $input['model']['attachmentId'] ) : 0;
		}
		return $creating ? 0 : ( is_scalar( $fallback ) ? absint( $fallback ) : 0 );
	}

	private static function input_category( $input, $fallback ) {
		$value = array_key_exists( 'category', $input ) ? $input['category'] : $fallback;
		return strtoupper( sanitize_key( self::scalar_string( $value ) ) );
	}

	private static function input_integer( $input, $key, $fallback ) {
		$value = array_key_exists( $key, $input ) ? $input[ $key ] : $fallback;
		return is_scalar( $value ) ? absint( $value ) : 0;
	}

	private static function input_text( $input, $key, $fallback ) {
		$value = array_key_exists( $key, $input ) ? $input[ $key ] : $fallback;
		return sanitize_text_field( wp_unslash( self::scalar_string( $value ) ) );
	}

	private static function input_url( $input, $key, $fallback ) {
		$value = array_key_exists( $key, $input ) ? $input[ $key ] : $fallback;
		return esc_url_raw( wp_unslash( self::scalar_string( $value ) ) );
	}

	private static function nullable_key( $value ) {
		$value = sanitize_key( self::scalar_string( $value ) );
		return '' === $value ? null : $value;
	}

	private static function scalar_string( $value ) {
		return is_scalar( $value ) ? (string) $value : '';
	}

	private static function bounded_float( $value, $min, $max, $fallback ) {
		if ( ! is_numeric( $value ) ) {
			return (float) $fallback;
		}
		return (float) max( $min, min( $max, (float) $value ) );
	}

	private static function sanitize_asset_id( $value ) {
		$value = strtolower( self::scalar_string( $value ) );
		return preg_match( '/^asset_[a-z0-9_-]{4,96}$/', $value ) ? $value : '';
	}

	private static function sanitize_instance_id( $value ) {
		$value = self::scalar_string( $value );
		return preg_match( '/^obj_[A-Za-z0-9_-]{4,96}$/', $value ) ? $value : '';
	}

	private static function new_asset_id( $assets ) {
		do {
			$id = 'asset_' . strtolower( str_replace( '-', '', wp_generate_uuid4() ) );
		} while ( isset( $assets[ $id ] ) );
		return $id;
	}

	private static function new_instance_id( $seen ) {
		do {
			$id = 'obj_' . strtolower( str_replace( '-', '', wp_generate_uuid4() ) );
		} while ( isset( $seen[ $id ] ) );
		return $id;
	}
}
