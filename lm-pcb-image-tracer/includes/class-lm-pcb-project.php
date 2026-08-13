<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LM_PCB_Project {
	public function can_manage() {
		return current_user_can( 'edit_posts' );
	}

	public function can_access_project( $project_id ) {
		$project_id = absint( $project_id );
		if ( ! $project_id || 'lm_pcb_project' !== get_post_type( $project_id ) ) {
			return false;
		}
		return current_user_can( 'edit_post', $project_id );
	}

	public function get_default_data( $args = array() ) {
		$now  = current_time( 'mysql' );
		$name = isset( $args['name'] ) ? sanitize_text_field( $args['name'] ) : '';
		$code = isset( $args['code'] ) ? sanitize_key( $args['code'] ) : '';
		$w    = isset( $args['width_mm'] ) ? max( 1, (float) $args['width_mm'] ) : 100;
		$h    = isset( $args['height_mm'] ) ? max( 1, (float) $args['height_mm'] ) : 80;

		return array(
			'version' => '1.0',
			'project' => array(
				'name'       => $name,
				'code'       => $code,
				'created_at' => $now,
				'updated_at' => $now,
			),
			'board' => array(
				'width_mm'  => $w,
				'height_mm' => $h,
				'origin_x'  => 0,
				'origin_y'  => 0,
				'grid_mm'   => 0.5,
			),
			'images' => array(
				'top'    => $this->default_image(),
				'bottom' => $this->default_image(),
			),
			'layers' => $this->default_layers(),
			'components' => array(),
			'objects' => array(),
		);
	}

	private function default_image() {
		return array(
			'attachment_id' => 0,
			'url'           => '',
			'visible'       => true,
			'locked'        => true,
			'opacity'       => 0.5,
			'x'             => 0,
			'y'             => 0,
			'scale_x'       => 1,
			'scale_y'       => 1,
			'rotation'      => 0,
			'flip_x'        => false,
			'flip_y'        => false,
			'calibration'   => array(),
			'transform'     => array(),
		);
	}

	public function default_layers() {
		return array(
			'background_top'    => array( 'name' => 'Background Top', 'visible' => true, 'locked' => true, 'opacity' => 0.5, 'color' => '#ffffff' ),
			'background_bottom' => array( 'name' => 'Background Bottom', 'visible' => false, 'locked' => true, 'opacity' => 0.5, 'color' => '#9ecbff' ),
			'outline'           => array( 'name' => 'Board Outline', 'visible' => true, 'locked' => false, 'opacity' => 1, 'color' => '#ffd54a' ),
			'top_copper'        => array( 'name' => 'Top Copper', 'visible' => true, 'locked' => false, 'opacity' => 1, 'color' => '#e53935' ),
			'bottom_copper'     => array( 'name' => 'Bottom Copper', 'visible' => true, 'locked' => false, 'opacity' => 1, 'color' => '#1e88e5' ),
			'silk_top'          => array( 'name' => 'Silkscreen Top', 'visible' => true, 'locked' => false, 'opacity' => 1, 'color' => '#f8f8f2' ),
			'silk_bottom'       => array( 'name' => 'Silkscreen Bottom', 'visible' => true, 'locked' => false, 'opacity' => 1, 'color' => '#f8f8f2' ),
			'drill'             => array( 'name' => 'Drill', 'visible' => true, 'locked' => false, 'opacity' => 1, 'color' => '#151515' ),
			'mechanical'        => array( 'name' => 'Mechanical', 'visible' => true, 'locked' => false, 'opacity' => 1, 'color' => '#7de0ff' ),
			'annotation'        => array( 'name' => 'Annotation', 'visible' => true, 'locked' => false, 'opacity' => 1, 'color' => '#f8f8f2' ),
		);
	}

	public function create_project( $args ) {
		if ( ! $this->can_manage() ) {
			return new WP_Error( 'lm_pcb_forbidden', 'Không đủ quyền tạo dự án.', array( 'status' => 403 ) );
		}
		$data = $this->sanitize_project_data( $this->get_default_data( $args ) );
		return $this->create_project_from_data( $data );
	}

	public function create_project_from_data( $data ) {
		if ( ! $this->can_manage() ) {
			return new WP_Error( 'lm_pcb_forbidden', 'Không đủ quyền tạo dự án.', array( 'status' => 403 ) );
		}
		$data = $this->sanitize_project_data( $data );
		$post_id = wp_insert_post(
			array(
				'post_type'   => 'lm_pcb_project',
				'post_status' => 'private',
				'post_title'  => $data['project']['name'] ? $data['project']['name'] : 'PCB Image Tracer',
				'post_author' => get_current_user_id(),
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return $post_id;
		}
		$this->save_data( $post_id, $data );
		return $this->read_project( $post_id );
	}

	public function read_project( $project_id ) {
		if ( ! $this->can_access_project( $project_id ) ) {
			return new WP_Error( 'lm_pcb_forbidden', 'Không đủ quyền đọc dự án.', array( 'status' => 403 ) );
		}
		$json = get_post_meta( $project_id, LM_PCB_TRACER_META_JSON, true );
		$data = $json ? json_decode( $json, true ) : null;
		if ( ! is_array( $data ) ) {
			$data = $this->get_default_data( array( 'name' => get_the_title( $project_id ) ) );
		}
		return array(
			'id'   => absint( $project_id ),
			'data' => $this->sanitize_project_data( $data ),
		);
	}

	public function save_project( $project_id, $data ) {
		if ( ! $this->can_access_project( $project_id ) ) {
			return new WP_Error( 'lm_pcb_forbidden', 'Không đủ quyền lưu dự án.', array( 'status' => 403 ) );
		}
		$data = $this->sanitize_project_data( $data );
		$data['project']['updated_at'] = current_time( 'mysql' );
		$this->save_data( $project_id, $data );
		wp_update_post(
			array(
				'ID'         => absint( $project_id ),
				'post_title' => $data['project']['name'] ? $data['project']['name'] : 'PCB Image Tracer',
			)
		);
		return $this->read_project( $project_id );
	}

	public function duplicate_project( $project_id ) {
		$source = $this->read_project( $project_id );
		if ( is_wp_error( $source ) ) {
			return $source;
		}
		$data = $source['data'];
		$data['project']['name'] .= ' - Copy';
		$data['project']['code'] .= '-copy';
		$data['project']['created_at'] = current_time( 'mysql' );
		$data['project']['updated_at'] = current_time( 'mysql' );
		return $this->create_project_from_data( $data );
	}

	public function delete_project( $project_id ) {
		if ( ! $this->can_access_project( $project_id ) ) {
			return new WP_Error( 'lm_pcb_forbidden', 'Không đủ quyền xóa dự án.', array( 'status' => 403 ) );
		}
		return (bool) wp_delete_post( absint( $project_id ), true );
	}

	private function save_data( $project_id, $data ) {
		update_post_meta( $project_id, LM_PCB_TRACER_META_JSON, wp_json_encode( $data ) );
		update_post_meta( $project_id, LM_PCB_TRACER_META_CODE, $data['project']['code'] );
		update_post_meta( $project_id, LM_PCB_TRACER_META_TOP_IMAGE, absint( $data['images']['top']['attachment_id'] ) );
		update_post_meta( $project_id, LM_PCB_TRACER_META_BOTTOM_IMAGE, absint( $data['images']['bottom']['attachment_id'] ) );
	}

	public function sanitize_project_data( $data ) {
		$defaults = $this->get_default_data();
		if ( ! is_array( $data ) ) {
			return $defaults;
		}
		$out = $defaults;
		$out['version'] = '1.0';
		$out['project']['name'] = isset( $data['project']['name'] ) ? sanitize_text_field( $data['project']['name'] ) : '';
		$out['project']['code'] = isset( $data['project']['code'] ) ? sanitize_key( $data['project']['code'] ) : '';
		$out['project']['created_at'] = isset( $data['project']['created_at'] ) ? sanitize_text_field( $data['project']['created_at'] ) : current_time( 'mysql' );
		$out['project']['updated_at'] = current_time( 'mysql' );
		$out['board']['width_mm'] = isset( $data['board']['width_mm'] ) ? max( 1, min( 2000, (float) $data['board']['width_mm'] ) ) : 100;
		$out['board']['height_mm'] = isset( $data['board']['height_mm'] ) ? max( 1, min( 2000, (float) $data['board']['height_mm'] ) ) : 80;
		$out['board']['origin_x'] = isset( $data['board']['origin_x'] ) ? (float) $data['board']['origin_x'] : 0;
		$out['board']['origin_y'] = isset( $data['board']['origin_y'] ) ? (float) $data['board']['origin_y'] : 0;
		$out['board']['grid_mm'] = isset( $data['board']['grid_mm'] ) ? (float) $data['board']['grid_mm'] : 0.5;

		foreach ( array( 'top', 'bottom' ) as $side ) {
			if ( isset( $data['images'][ $side ] ) && is_array( $data['images'][ $side ] ) ) {
				$out['images'][ $side ] = $this->sanitize_image( $data['images'][ $side ] );
			}
		}
		if ( isset( $data['layers'] ) && is_array( $data['layers'] ) ) {
			foreach ( $out['layers'] as $key => $layer ) {
				if ( isset( $data['layers'][ $key ] ) && is_array( $data['layers'][ $key ] ) ) {
					$out['layers'][ $key ] = $this->sanitize_layer( $data['layers'][ $key ], $layer );
				}
			}
		}
		$out['objects'] = array();
		$out['components'] = array();
		if ( isset( $data['components'] ) && is_array( $data['components'] ) ) {
			foreach ( array_slice( $data['components'], 0, 2000 ) as $component ) {
				$clean_component = $this->sanitize_component( $component );
				if ( $clean_component ) {
					$out['components'][] = $clean_component;
				}
			}
		}
		if ( isset( $data['objects'] ) && is_array( $data['objects'] ) ) {
			foreach ( array_slice( $data['objects'], 0, 10000 ) as $obj ) {
				$clean = $this->sanitize_object( $obj );
				if ( $clean ) {
					$out['objects'][] = $clean;
				}
			}
		}
		return $out;
	}

	private function sanitize_component( $component ) {
		if ( ! is_array( $component ) ) {
			return null;
		}
		$id = sanitize_key( $component['id'] ?? '' );
		if ( '' === $id ) {
			$id = uniqid( 'cmp_', false );
		}
		$side = isset( $component['side'] ) && 'bottom' === $component['side'] ? 'bottom' : 'top';
		return array(
			'id'       => $id,
			'ref'      => sanitize_text_field( $component['ref'] ?? '' ),
			'name'     => sanitize_text_field( $component['name'] ?? '' ),
			'value'    => sanitize_text_field( $component['value'] ?? '' ),
			'package'  => sanitize_text_field( $component['package'] ?? '' ),
			'side'     => $side,
			'x'        => isset( $component['x'] ) ? (float) $component['x'] : 0,
			'y'        => isset( $component['y'] ) ? (float) $component['y'] : 0,
			'rotation' => isset( $component['rotation'] ) ? (float) $component['rotation'] : 0,
			'locked'   => ! empty( $component['locked'] ),
			'visible'  => ! isset( $component['visible'] ) || ! empty( $component['visible'] ),
			'pins'     => isset( $component['pins'] ) && is_array( $component['pins'] ) ? $this->sanitize_mixed_array( $component['pins'] ) : array(),
			'metadata' => isset( $component['metadata'] ) && is_array( $component['metadata'] ) ? $this->sanitize_mixed_array( $component['metadata'] ) : array(),
		);
	}

	private function sanitize_image( $img ) {
		$base = $this->default_image();
		$base['attachment_id'] = isset( $img['attachment_id'] ) ? absint( $img['attachment_id'] ) : 0;
		$base['url'] = isset( $img['url'] ) ? esc_url_raw( $img['url'] ) : '';
		foreach ( array( 'visible', 'locked', 'flip_x', 'flip_y' ) as $key ) {
			$base[ $key ] = ! empty( $img[ $key ] );
		}
		foreach ( array( 'opacity', 'x', 'y', 'scale_x', 'scale_y', 'rotation' ) as $key ) {
			$base[ $key ] = isset( $img[ $key ] ) ? (float) $img[ $key ] : $base[ $key ];
		}
		$base['opacity'] = max( 0, min( 1, $base['opacity'] ) );
		$base['calibration'] = isset( $img['calibration'] ) && is_array( $img['calibration'] ) ? $this->sanitize_mixed_array( $img['calibration'] ) : array();
		$base['transform'] = isset( $img['transform'] ) && is_array( $img['transform'] ) ? $this->sanitize_mixed_array( $img['transform'] ) : array();
		return $base;
	}

	private function sanitize_layer( $layer, $fallback ) {
		return array(
			'name'    => isset( $fallback['name'] ) ? $fallback['name'] : sanitize_text_field( $layer['name'] ?? '' ),
			'visible' => ! empty( $layer['visible'] ),
			'locked'  => ! empty( $layer['locked'] ),
			'opacity' => isset( $layer['opacity'] ) ? max( 0, min( 1, (float) $layer['opacity'] ) ) : 1,
			'color'   => sanitize_hex_color( $layer['color'] ?? $fallback['color'] ) ?: $fallback['color'],
		);
	}

	private function sanitize_object( $obj ) {
		if ( ! is_array( $obj ) ) {
			return null;
		}
		$allowed_types  = array( 'track', 'pad', 'via', 'drill', 'outline', 'region', 'annotation', 'shape', 'cutout', 'slot' );
		$allowed_layers = array_keys( $this->default_layers() );
		$type = sanitize_key( $obj['type'] ?? '' );
		$layer = sanitize_key( $obj['layer'] ?? '' );
		if ( ! in_array( $type, $allowed_types, true ) || ! in_array( $layer, $allowed_layers, true ) ) {
			return null;
		}
		return array(
			'id'       => sanitize_key( $obj['id'] ?? uniqid( 'obj_', false ) ),
			'type'     => $type,
			'layer'    => $layer,
			'geometry' => isset( $obj['geometry'] ) && is_array( $obj['geometry'] ) ? $this->sanitize_mixed_array( $obj['geometry'] ) : array(),
			'style'    => isset( $obj['style'] ) && is_array( $obj['style'] ) ? $this->sanitize_mixed_array( $obj['style'] ) : array(),
			'locked'   => ! empty( $obj['locked'] ),
			'visible'  => ! isset( $obj['visible'] ) || ! empty( $obj['visible'] ),
			'note'     => sanitize_textarea_field( $obj['note'] ?? '' ),
		);
	}

	private function sanitize_mixed_array( $value ) {
		$out = array();
		foreach ( $value as $key => $item ) {
			$key = is_int( $key ) ? $key : sanitize_key( $key );
			if ( is_array( $item ) ) {
				$out[ $key ] = $this->sanitize_mixed_array( $item );
			} elseif ( is_bool( $item ) ) {
				$out[ $key ] = $item;
			} elseif ( is_numeric( $item ) ) {
				$out[ $key ] = (float) $item;
			} else {
				$out[ $key ] = sanitize_text_field( (string) $item );
			}
		}
		return $out;
	}
}
