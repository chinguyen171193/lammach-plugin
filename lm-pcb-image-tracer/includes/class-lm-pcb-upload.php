<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LM_PCB_Upload {
	const MAX_IMAGE_BYTES = 15728640;

	public function filter_upload_mimes( $mimes ) {
		$mimes['jpg|jpeg'] = 'image/jpeg';
		$mimes['png']      = 'image/png';
		$mimes['webp']     = 'image/webp';
		return $mimes;
	}

	public function handle_upload( $file_key ) {
		if ( ! is_user_logged_in() || ! current_user_can( 'upload_files' ) ) {
			return new WP_Error( 'lm_pcb_upload_forbidden', 'Không đủ quyền upload.', array( 'status' => 403 ) );
		}
		if ( empty( $_FILES[ $file_key ] ) || ! is_array( $_FILES[ $file_key ] ) ) {
			return new WP_Error( 'lm_pcb_upload_missing', 'Thiếu file ảnh.', array( 'status' => 400 ) );
		}
		$file = $_FILES[ $file_key ];
		if ( ! empty( $file['size'] ) && (int) $file['size'] > self::MAX_IMAGE_BYTES ) {
			return new WP_Error( 'lm_pcb_upload_too_large', 'Ảnh vượt quá giới hạn 15 MB.', array( 'status' => 400 ) );
		}
		$check = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'], array(
			'jpg|jpeg' => 'image/jpeg',
			'png'      => 'image/png',
			'webp'     => 'image/webp',
		) );
		if ( empty( $check['type'] ) || ! in_array( $check['type'], array( 'image/jpeg', 'image/png', 'image/webp' ), true ) ) {
			return new WP_Error( 'lm_pcb_upload_type', 'Chỉ chấp nhận JPG, JPEG, PNG, WEBP.', array( 'status' => 400 ) );
		}
		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/media.php';
		require_once ABSPATH . 'wp-admin/includes/image.php';
		$attachment_id = media_handle_upload( $file_key, 0 );
		if ( is_wp_error( $attachment_id ) ) {
			return $attachment_id;
		}
		return array(
			'attachment_id' => absint( $attachment_id ),
			'url'           => wp_get_attachment_url( $attachment_id ),
		);
	}
}
