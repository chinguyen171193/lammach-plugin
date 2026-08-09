<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) { exit; }

if ( ! get_option( 'dat_ai_office_settings', array() ) || empty( get_option( 'dat_ai_office_settings', array() )['delete_on_uninstall'] ) ) { return; }

global $wpdb;
foreach ( array( 'dat_ai_departments', 'dat_ai_agents', 'dat_ai_tasks', 'dat_ai_workflows', 'dat_ai_events', 'dat_ai_logs' ) as $suffix ) {
	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}{$suffix}" ); // Prefix and suffix are internal constants.
}
delete_option( 'dat_ai_office_settings' );
delete_option( 'dat_ai_office_seeded' );
delete_option( 'dat_ai_office_animation_library' );
