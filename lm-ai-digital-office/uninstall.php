<?php
if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) { exit; }

if ( ! get_option( 'lm_ai_office_settings', array() ) || empty( get_option( 'lm_ai_office_settings', array() )['delete_on_uninstall'] ) ) { return; }

global $wpdb;
foreach ( array( 'lm_ai_departments', 'lm_ai_agents', 'lm_ai_tasks', 'lm_ai_workflows', 'lm_ai_events', 'lm_ai_logs' ) as $suffix ) {
	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}{$suffix}" ); // Prefix and suffix are internal constants.
}
delete_option( 'lm_ai_office_settings' );
delete_option( 'lm_ai_office_seeded' );
delete_option( 'lm_ai_office_animation_library' );
delete_option( 'lm_ai_office_character_models' );
