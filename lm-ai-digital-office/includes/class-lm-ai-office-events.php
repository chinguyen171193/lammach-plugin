<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }

class LM_AI_Office_Events {
	private $map = array(
		'new_customer' => array( 'reception', 'Sale AI', 'Có khách hàng mới' ), 'new_pcb_order' => array( 'sales', 'Sale AI', 'Có đơn PCB mới' ),
		'new_pcba_order' => array( 'sales', 'Sale AI', 'Có đơn PCBA mới' ), 'new_gerber' => array( 'pcb', 'Gerber AI', 'Đã nhận file Gerber' ),
		'gerber_checked' => array( 'pcb', 'Gerber AI', 'Đã kiểm tra Gerber' ), 'bom_created' => array( 'warehouse', 'BOM AI', 'Đã tạo BOM' ),
		'bom_checked' => array( 'warehouse', 'BOM AI', 'Đã kiểm tra BOM' ), 'quote_created' => array( 'sales', 'Sale AI', 'Đã tạo báo giá' ),
		'quote_approved' => array( 'finance', 'Finance AI', 'Đã duyệt báo giá' ), 'production_created' => array( 'smt', 'Production AI', 'Đã tạo lệnh sản xuất' ),
		'production_started' => array( 'smt', 'Production AI', 'Sản xuất đã bắt đầu' ), 'production_completed' => array( 'smt', 'Production AI', 'Sản xuất hoàn thành' ),
		'qc_passed' => array( 'qc', 'QC', 'QC xác nhận PASS' ), 'qc_failed' => array( 'qc', 'QC', 'QC xác nhận FAIL' ),
		'packing_started' => array( 'packing', 'Kho', 'Bắt đầu đóng gói' ), 'shipment_created' => array( 'shipping', 'Giao hàng', 'Đã tạo phiếu giao hàng' ),
		'shipment_completed' => array( 'shipping', 'Giao hàng', 'Đã giao hàng' ), 'warranty_created' => array( 'reception', 'Sale AI', 'Yêu cầu bảo hành mới' ),
		'warranty_completed' => array( 'qc', 'QC', 'Bảo hành hoàn thành' ), 'zalo_notification_sent' => array( 'sales', 'Sale AI', 'Đã gửi thông báo Zalo' ),
	);

	public function __construct() { add_action( 'lm_ai_office_event', array( $this, 'receive' ), 10, 1 ); }

	public function receive( $event ) {
		$event = is_array( $event ) ? $event : array();
		$type = sanitize_key( $event['type'] ?? '' );
		$fallback = $this->map[ $type ] ?? array( 'ai_center', 'LM Supervisor AI', 'Sự kiện mới' );
		$record = array(
			'event_type' => $type ?: 'custom_event', 'title' => sanitize_text_field( $event['title'] ?? $fallback[2] ), 'department' => sanitize_key( $event['department'] ?? $fallback[0] ),
			'source' => sanitize_key( $event['source'] ?? 'wordpress_hook' ), 'object_id' => absint( $event['object_id'] ?? 0 ),
			'priority' => in_array( $event['priority'] ?? '', array( 'low', 'normal', 'high', 'critical' ), true ) ? $event['priority'] : 'normal',
			'message' => sanitize_textarea_field( $event['message'] ?? $fallback[2] ), 'payload' => wp_json_encode( $event ), 'created_at' => current_time( 'mysql', true ),
		);
		global $wpdb;
		$tables = LM_AI_Office::tables();
		$wpdb->insert( $tables['events'], $record );
		$wpdb->insert( $tables['logs'], array( 'actor' => $fallback[1], 'department' => $record['department'], 'level' => 'high' === $record['priority'] || 'critical' === $record['priority'] ? 'warning' : 'info', 'message' => $record['message'], 'created_at' => $record['created_at'] ) );
	}

	public function mappings() { return $this->map; }
}
