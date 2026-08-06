<?php
/**
 * Plugin Name: CTY 1 Người
 * Description: Hiển thị thông tin doanh nghiệp bằng shortcode [cty_mot_nguoi].
 * Version: 1.0.0
 * Author: DAT
 * Text Domain: cty-1-nguoi
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class CTY_Mot_Nguoi {
	const OPTION_PROFILE = 'cty_mot_nguoi_profile';

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_shortcode( 'cty_mot_nguoi', array( $this, 'render_shortcode' ) );
	}

	public function register_menu() {
		add_options_page(
			'CTY 1 Người',
			'CTY 1 Người',
			'manage_options',
			'cty-1-nguoi',
			array( $this, 'render_settings_page' )
		);
	}

	public function register_settings() {
		register_setting(
			'cty_mot_nguoi_settings',
			self::OPTION_PROFILE,
			array( $this, 'sanitize_profile' )
		);
	}

	public function sanitize_profile( $input ) {
		$input = is_array( $input ) ? $input : array();

		return array(
			'name'        => sanitize_text_field( $input['name'] ?? '' ),
			'description' => sanitize_textarea_field( $input['description'] ?? '' ),
			'phone'       => sanitize_text_field( $input['phone'] ?? '' ),
			'email'       => sanitize_email( $input['email'] ?? '' ),
			'address'     => sanitize_textarea_field( $input['address'] ?? '' ),
			'website'     => esc_url_raw( $input['website'] ?? '' ),
		);
	}

	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Bạn không có quyền truy cập trang này.', 'cty-1-nguoi' ) );
		}

		$profile = $this->get_profile();
		?>
		<div class="wrap">
			<h1>CTY 1 Người</h1>
			<p>Nhập thông tin rồi chèn shortcode <code>[cty_mot_nguoi]</code> vào bất kỳ trang hoặc bài viết nào.</p>
			<form method="post" action="options.php">
				<?php settings_fields( 'cty_mot_nguoi_settings' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="cty-name">Tên công ty</label></th>
						<td><input class="regular-text" id="cty-name" name="<?php echo esc_attr( self::OPTION_PROFILE ); ?>[name]" type="text" value="<?php echo esc_attr( $profile['name'] ); ?>"></td>
					</tr>
					<tr>
						<th scope="row"><label for="cty-description">Giới thiệu</label></th>
						<td><textarea class="large-text" id="cty-description" name="<?php echo esc_attr( self::OPTION_PROFILE ); ?>[description]" rows="4"><?php echo esc_textarea( $profile['description'] ); ?></textarea></td>
					</tr>
					<tr>
						<th scope="row"><label for="cty-phone">Điện thoại</label></th>
						<td><input class="regular-text" id="cty-phone" name="<?php echo esc_attr( self::OPTION_PROFILE ); ?>[phone]" type="text" value="<?php echo esc_attr( $profile['phone'] ); ?>"></td>
					</tr>
					<tr>
						<th scope="row"><label for="cty-email">Email</label></th>
						<td><input class="regular-text" id="cty-email" name="<?php echo esc_attr( self::OPTION_PROFILE ); ?>[email]" type="email" value="<?php echo esc_attr( $profile['email'] ); ?>"></td>
					</tr>
					<tr>
						<th scope="row"><label for="cty-address">Địa chỉ</label></th>
						<td><textarea class="large-text" id="cty-address" name="<?php echo esc_attr( self::OPTION_PROFILE ); ?>[address]" rows="3"><?php echo esc_textarea( $profile['address'] ); ?></textarea></td>
					</tr>
					<tr>
						<th scope="row"><label for="cty-website">Website</label></th>
						<td><input class="regular-text" id="cty-website" name="<?php echo esc_attr( self::OPTION_PROFILE ); ?>[website]" type="url" value="<?php echo esc_attr( $profile['website'] ); ?>"></td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}

	public function render_shortcode() {
		$profile = $this->get_profile();

		ob_start();
		?>
		<section class="cty-mot-nguoi" aria-label="Thông tin công ty">
			<?php if ( '' !== $profile['name'] ) : ?><h2><?php echo esc_html( $profile['name'] ); ?></h2><?php endif; ?>
			<?php if ( '' !== $profile['description'] ) : ?><p><?php echo nl2br( esc_html( $profile['description'] ) ); ?></p><?php endif; ?>
			<?php if ( '' !== $profile['phone'] ) : ?><p>Điện thoại: <?php echo esc_html( $profile['phone'] ); ?></p><?php endif; ?>
			<?php if ( '' !== $profile['email'] ) : ?><p>Email: <a href="mailto:<?php echo esc_attr( $profile['email'] ); ?>"><?php echo esc_html( $profile['email'] ); ?></a></p><?php endif; ?>
			<?php if ( '' !== $profile['address'] ) : ?><p>Địa chỉ: <?php echo nl2br( esc_html( $profile['address'] ) ); ?></p><?php endif; ?>
			<?php if ( '' !== $profile['website'] ) : ?><p><a href="<?php echo esc_url( $profile['website'] ); ?>" rel="noopener">Website</a></p><?php endif; ?>
		</section>
		<?php
		return ob_get_clean();
	}

	private function get_profile() {
		$defaults = array(
			'name'        => 'CTY 1 Người',
			'description' => '',
			'phone'       => '',
			'email'       => '',
			'address'     => '',
			'website'     => '',
		);
		$profile = get_option( self::OPTION_PROFILE, array() );

		return wp_parse_args( is_array( $profile ) ? $profile : array(), $defaults );
	}
}

new CTY_Mot_Nguoi();
