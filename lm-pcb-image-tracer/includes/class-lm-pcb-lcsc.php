<?php
/**
 * Lay footprint that tu thu vien EasyEDA/LCSC.
 *
 * Day la bac 1-2 trong chuoi tra cuu footprint: dung so lieu that cua nha san
 * xuat thay vi de AI dung lai tu mo ta package. Chi tiet giao thuc va cac so
 * lieu da kiem chung nam trong docs/lcsc-api.md.
 *
 * API nay khong co tai lieu chinh thuc va khong cam ket on dinh, nen moi loi
 * deu tra ve null de goi y quay lai bac 4 (AI tu dung theo ho package) thay vi
 * lam hong ca yeu cau.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class LM_PCB_LCSC {
	const OPTION_ENABLED = 'lm_pcb_tracer_lcsc_enabled';

	// 1 don vi = 10 mil. Da kiem chung bang buoc chan tren 6 package.
	const UNIT_MM = 0.254;

	const API_VERSION = '6.5.21';
	const TIMEOUT     = 15;
	const CACHE_TTL   = 604800; // 7 ngay

	// Cau dao ngat: khi bi CloudFront chan (403/429) thi ngung goi han mot lat.
	// Da tu gay ra tinh trang nay khi khao sat: khoang 40 request lien tiep la bi
	// chan sach, ke ca ma vua lay duoc phut truoc.
	const BLOCK_KEY = 'lm_pcb_lcsc_blocked';
	const BLOCK_TTL = 1800; // 30 phut

	// CloudFront tra 403 neu thieu ba header nay.
	private function headers() {
		return array(
			'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			'Referer'    => 'https://easyeda.com/editor',
			'Origin'     => 'https://easyeda.com',
		);
	}

	public function is_enabled() {
		return '0' !== (string) get_option( self::OPTION_ENABLED, '1' );
	}

	public function set_enabled( $enabled ) {
		update_option( self::OPTION_ENABLED, $enabled ? '1' : '0', false );
	}

	/**
	 * Goi API va cache lai. Tra null cho moi loi - ben goi tu quyet dinh phao.
	 */
	private function get_json( $url, $cache_key ) {
		$cached = get_transient( $cache_key );
		if ( false !== $cached ) {
			return is_array( $cached ) ? $cached : null;
		}
		// CloudFront chan theo IP khi bi goi don dap, va khi da chan thi chan het
		// moi ma chu khong rieng ma nao. Luc do goi tiep chi to lam moi luot chat
		// treo them 15 giay roi cung that bai - nghi han mot lat cho lanh.
		if ( get_transient( self::BLOCK_KEY ) ) {
			return null;
		}

		$response = wp_remote_get( $url, array(
			'timeout' => self::TIMEOUT,
			'headers' => $this->headers(),
		) );
		$code = is_wp_error( $response ) ? 0 : (int) wp_remote_retrieve_response_code( $response );
		if ( 403 === $code || 429 === $code ) {
			set_transient( self::BLOCK_KEY, 1, self::BLOCK_TTL );
			return null;
		}
		if ( is_wp_error( $response ) || 200 !== $code ) {
			// Cache ca that bai trong thoi gian ngan de mot ma hong khong lam
			// moi luot chat deu phai cho het timeout.
			set_transient( $cache_key, 'fail', 600 );
			return null;
		}

		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $data ) || empty( $data['result'] ) ) {
			set_transient( $cache_key, 'fail', 600 );
			return null;
		}
		set_transient( $cache_key, $data, self::CACHE_TTL );
		return $data;
	}

	/**
	 * Tim ma LCSC theo tu khoa. Day la tim kiem khop chuoi chu khong hieu y, nen
	 * chi goi voi ma linh kien chinh xac (MPN) - xem bang doi chieu trong
	 * docs/lcsc-api.md.
	 */
	public function search_code( $mpn ) {
		$mpn = trim( (string) $mpn );
		if ( strlen( $mpn ) < 3 ) {
			return null;
		}
		$url  = 'https://easyeda.com/api/eda/product/search?version=' . self::API_VERSION . '&keyword=' . rawurlencode( $mpn );
		$data = $this->get_json( $url, 'lm_pcb_lcsc_s_' . md5( strtolower( $mpn ) ) );
		if ( ! $data || empty( $data['result']['productList'] ) || ! is_array( $data['result']['productList'] ) ) {
			return null;
		}

		// Tim kiem o day chi khop chuoi chu khong hieu y, nen ket qua dau tien rat
		// hay la linh kien khac han ("10k 0603 resistor" ra dien tro 10W xuyen lo).
		// Chi nhan khi ma linh kien that su khop.
		$wanted   = $this->normalize( $mpn );
		$variant  = null;
		foreach ( array_slice( $data['result']['productList'], 0, 20 ) as $item ) {
			if ( empty( $item['number'] ) ) {
				continue;
			}
			$found = $this->normalize( $item['mpn'] ?? '' );
			if ( $found === $wanted ) {
				return array( 'code' => (string) $item['number'], 'mpn' => (string) ( $item['mpn'] ?? $mpn ), 'exact' => true );
			}
			// Bien the hau to dung chung footprint (ESP32-WROOM-32 -> ...-N8).
			// Doi tu khoa phai du dai va phan thua phai ngan, de "STM32F1" khong
			// vo tinh keo ve mot vo hoan toan khac.
			if ( null === $variant && strlen( $wanted ) >= 8 && 0 === strpos( $found, $wanted ) && strlen( $found ) - strlen( $wanted ) <= 4 ) {
				$variant = array( 'code' => (string) $item['number'], 'mpn' => (string) ( $item['mpn'] ?? '' ), 'exact' => false );
			}
		}
		// Khong khop thi khong doan bua - tra null de quay ve bo sinh tham so.
		return $variant;
	}

	private function normalize( $text ) {
		return preg_replace( '~[^a-z0-9]~', '', strtolower( (string) $text ) );
	}

	/**
	 * Lay footprint theo ma linh kien. Tra ve mang pins/outline theo dung dinh
	 * dang editor dung, hoac null.
	 */
	public function footprint_for_mpn( $mpn ) {
		if ( ! $this->is_enabled() ) {
			return null;
		}
		$match = $this->search_code( $mpn );
		if ( ! $match ) {
			return null;
		}
		$footprint = $this->footprint_for_code( $match['code'] );
		if ( $footprint && ! $match['exact'] && '' !== $match['mpn'] ) {
			// Lay bien the khac ten thi phai noi ro, de nguoi dung con doi chieu.
			$footprint['warnings'][] = sprintf( 'Khong co dung "%s" trong thu vien, da dung bien the "%s".', $mpn, $match['mpn'] );
		}
		return $footprint;
	}

	public function footprint_for_code( $code ) {
		$code = strtoupper( trim( (string) $code ) );
		if ( ! preg_match( '~^C\d+$~', $code ) ) {
			return null;
		}
		$url  = 'https://easyeda.com/api/products/' . $code . '/components?version=' . self::API_VERSION;
		$data = $this->get_json( $url, 'lm_pcb_lcsc_c_' . $code );
		if ( ! $data ) {
			return null;
		}
		$footprint = $this->parse_footprint( $data['result'] );
		if ( $footprint ) {
			$footprint['lcsc'] = $code;
		}
		return $footprint;
	}

	/**
	 * Doc packageDetail.dataStr thanh chan + kich thuoc than.
	 */
	public function parse_footprint( $result ) {
		$data_str = $result['packageDetail']['dataStr'] ?? null;
		if ( ! is_array( $data_str ) || empty( $data_str['shape'] ) || ! is_array( $data_str['shape'] ) ) {
			return null;
		}
		// head.x/head.y la tam package - da kiem chung: bbox chan ra dung 0,0.
		$origin_x = (float) ( $data_str['head']['x'] ?? 0 );
		$origin_y = (float) ( $data_str['head']['y'] ?? 0 );

		$pins     = array();
		$warnings = array();
		$body     = array();
		$silk     = array();

		foreach ( $data_str['shape'] as $shape ) {
			if ( ! is_string( $shape ) ) {
				continue;
			}
			$parts = explode( '~', $shape );
			if ( 'PAD' === $parts[0] ) {
				$pin = $this->parse_pad( $parts, $origin_x, $origin_y, $warnings );
				if ( $pin ) {
					$pins[] = $pin;
				}
			} elseif ( 'TRACK' === $parts[0] && $this->is_silk_layer( $parts[2] ?? 0 ) ) {
				// TRACK~rong~lop~net~toa do~...
				$this->extend_bounds( $body, $parts[4] ?? '', $origin_x, $origin_y );
				foreach ( $this->polyline_segments( $parts[4] ?? '', $origin_x, $origin_y, (float) $parts[1] * self::UNIT_MM ) as $line ) {
					$silk[] = $line;
				}
			} elseif ( 'CIRCLE' === $parts[0] && count( $parts ) > 5 && $this->is_silk_layer( $parts[5] ) ) {
				// CIRCLE~tam x~tam y~ban kinh~net rong~lop~... Day thuong la cham
				// danh dau chan 1, thu bat buoc phai co tren ban mach that.
				$silk[] = array(
					'shape'  => 'circle',
					'x'      => round( ( (float) $parts[1] - $origin_x ) * self::UNIT_MM, 3 ),
					'y'      => round( ( (float) $parts[2] - $origin_y ) * self::UNIT_MM, 3 ),
					'radius' => round( (float) $parts[3] * self::UNIT_MM, 3 ),
					'width'  => round( max( 0.05, (float) $parts[4] * self::UNIT_MM ), 3 ),
				);
			} elseif ( 'SOLIDREGION' === $parts[0] && count( $parts ) > 3 && $this->is_silk_layer( $parts[1] ?? -1 ) ) {
				// SOLIDREGION~lop~net~duong di~... Day la ky hieu ve dac (thuong
				// la dau "+" danh dau cuc duong tren tu dien hoa/tantalum) - mat
				// no thi nguoi lap co the han nguoc chieu, hong linh kien that su
				// (khong chi xau). Chi doc duoc duong toan doan thang (M/L/Z); bo
				// qua neu co cung tron/bezier (A/C/Q/S) - vi du ranh chu D quanh
				// vien ngoai - de khong ve sai thanh da giac gan dung.
				$poly = $this->parse_straight_polygon( $parts[3] ?? '' );
				if ( $poly ) {
					foreach ( $this->polyline_segments( $poly, $origin_x, $origin_y, 0.15 ) as $line ) {
						$silk[] = $line;
					}
				}
			}
		}

		if ( count( $pins ) < 1 ) {
			return null;
		}

		return array(
			'component' => sanitize_text_field( (string) ( $result['title'] ?? '' ) ),
			'package'   => sanitize_text_field( (string) ( $result['packageDetail']['title'] ?? ( $result['SMT_package'] ?? '' ) ) ),
			'pins'      => $pins,
			'silk'      => $silk,
			'outline'   => $this->outline_from( $body, $pins ),
			'warnings'  => array_values( array_unique( $warnings ) ),
		);
	}

	/**
	 * Chi lop 3/4 moi la in lua that su duoc in len bo. Lop 12 (Document) va 101
	 * (ComponentPolarity) chi de xem trong EasyEDA, khong duoc san xuat.
	 */
	private function is_silk_layer( $layer ) {
		$layer = (int) $layer;
		return 3 === $layer || 4 === $layer;
	}

	/**
	 * Cat mot duong gap khuc "x y x y ..." thanh tung doan thang.
	 */
	private function polyline_segments( $points, $origin_x, $origin_y, $width ) {
		$numbers = preg_split( '~[\s,]+~', trim( (string) $points ), -1, PREG_SPLIT_NO_EMPTY );
		$total   = count( $numbers ) - ( count( $numbers ) % 2 );
		$lines   = array();
		$width   = round( max( 0.05, $width ), 3 );
		for ( $i = 0; $i + 3 < $total; $i += 2 ) {
			$lines[] = array(
				'shape' => 'line',
				'x1'    => round( ( (float) $numbers[ $i ] - $origin_x ) * self::UNIT_MM, 3 ),
				'y1'    => round( ( (float) $numbers[ $i + 1 ] - $origin_y ) * self::UNIT_MM, 3 ),
				'x2'    => round( ( (float) $numbers[ $i + 2 ] - $origin_x ) * self::UNIT_MM, 3 ),
				'y2'    => round( ( (float) $numbers[ $i + 3 ] - $origin_y ) * self::UNIT_MM, 3 ),
				'width' => $width,
			);
		}
		return $lines;
	}

	/**
	 * Doc mot duong SOLIDREGION dang "M x y L x y L x y ... Z" (toan doan thang,
	 * khong co cung tron/bezier A/C/Q/S) thanh chuoi toa do tho "x y x y ..." da
	 * khep vong, san sang dua vao polyline_segments(). Tra ve null neu duong co
	 * lenh cong (vd ranh chu D bo tron mep ngoai vien tu dien) - khong co du
	 * lieu hinh hoc de xap xi dung, ve sai con te hon la bo qua.
	 */
	private function parse_straight_polygon( $path ) {
		if ( preg_match( '~[ACQS]~i', (string) $path ) ) {
			return null;
		}
		if ( ! preg_match_all( '~[ML]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)~i', (string) $path, $matches, PREG_SET_ORDER ) || count( $matches ) < 3 ) {
			return null;
		}
		$numbers = array();
		foreach ( $matches as $m ) {
			$numbers[] = $m[1];
			$numbers[] = $m[2];
		}
		// Khep vong ve diem dau de canh cuoi cung cua da giac cung duoc ve.
		$numbers[] = $numbers[0];
		$numbers[] = $numbers[1];
		return implode( ' ', $numbers );
	}

	/**
	 * PAD~shape~x~y~width~height~layerId~net~number~holeRadius~points~rotation~...
	 */
	private function parse_pad( $parts, $origin_x, $origin_y, &$warnings ) {
		if ( count( $parts ) < 10 ) {
			return null;
		}
		$kind   = strtoupper( $parts[1] );
		$x      = ( (float) $parts[2] - $origin_x ) * self::UNIT_MM;
		$y      = ( (float) $parts[3] - $origin_y ) * self::UNIT_MM;
		$width  = (float) $parts[4] * self::UNIT_MM;
		$height = (float) $parts[5] * self::UNIT_MM;
		$number = trim( (string) $parts[8] );
		$drill  = (float) $parts[9] * 2 * self::UNIT_MM;

		if ( 'POLYGON' === $kind ) {
			// Editor chua ve duoc pad da giac, nen lay hinh chu nhat bao quanh.
			// Xem muc "khoang trong" trong docs/lcsc-api.md.
			$bounds = array();
			$this->extend_bounds( $bounds, $parts[10] ?? '', $origin_x, $origin_y );
			if ( empty( $bounds ) ) {
				return null;
			}
			$x      = ( $bounds['min_x'] + $bounds['max_x'] ) / 2;
			$y      = ( $bounds['min_y'] + $bounds['max_y'] ) / 2;
			$width  = $bounds['max_x'] - $bounds['min_x'];
			$height = $bounds['max_y'] - $bounds['min_y'];
			$kind   = 'RECT';
			$warnings[] = 'Mot so chan la da giac, da thay bang hinh chu nhat bao quanh.';
		}

		if ( '' === $number || $width <= 0 || $height <= 0 ) {
			return null;
		}

		if ( 'RECT' === $kind ) {
			$shape = 'rect';
		} else {
			// EasyEDA co ca OVAL lan ELLIPSE, tuc chung khac nhau: OVAL la hinh
			// vien nhon (chu nhat bo tron hai dau), dung voi khau do 'O' cua
			// Gerber. ELLIPSE that su hiem trong footprint that; editor khong co
			// dang rieng cho no nen cung dung vien nhon - thua mot chut dong,
			// an toan hon cho viec han.
			$shape = abs( $width - $height ) < 0.001 ? 'round' : 'oval';
		}

		$smd = $drill <= 0;

		return array(
			'number'            => $number,
			'name'              => '',
			'x'                 => round( $x, 3 ),
			'y'                 => round( $y, 3 ),
			'shape'             => $shape,
			'width'             => round( $width, 3 ),
			'height'            => round( $height, 3 ),
			'diameter'          => round( max( $width, $height ), 3 ),
			'drill'             => $smd ? 0 : round( $drill, 3 ),
			'smd'               => $smd,
			'rotation'          => (float) ( $parts[11] ?? 0 ),
			'suppress_pin_name' => true,
		);
	}

	/**
	 * Gom mot chuoi toa do "x y x y ..." vao hop bao.
	 */
	private function extend_bounds( &$bounds, $points, $origin_x, $origin_y ) {
		$numbers = preg_split( '~[\s,]+~', trim( (string) $points ), -1, PREG_SPLIT_NO_EMPTY );
		$total   = count( $numbers ) - ( count( $numbers ) % 2 );
		for ( $i = 0; $i < $total; $i += 2 ) {
			$x = ( (float) $numbers[ $i ] - $origin_x ) * self::UNIT_MM;
			$y = ( (float) $numbers[ $i + 1 ] - $origin_y ) * self::UNIT_MM;
			$bounds['min_x'] = isset( $bounds['min_x'] ) ? min( $bounds['min_x'], $x ) : $x;
			$bounds['max_x'] = isset( $bounds['max_x'] ) ? max( $bounds['max_x'], $x ) : $x;
			$bounds['min_y'] = isset( $bounds['min_y'] ) ? min( $bounds['min_y'], $y ) : $y;
			$bounds['max_y'] = isset( $bounds['max_y'] ) ? max( $bounds['max_y'], $y ) : $y;
		}
	}

	/**
	 * Kich thuoc than: uu tien duong silk, khong co thi om lay cum chan.
	 */
	private function outline_from( $body, $pins ) {
		if ( isset( $body['min_x'] ) ) {
			$width  = $body['max_x'] - $body['min_x'];
			$height = $body['max_y'] - $body['min_y'];
			if ( $width > 0.1 && $height > 0.1 ) {
				return array( 'width' => round( $width, 3 ), 'height' => round( $height, 3 ) );
			}
		}
		$span_x = 0;
		$span_y = 0;
		foreach ( $pins as $pin ) {
			$span_x = max( $span_x, abs( $pin['x'] ) + $pin['width'] / 2 );
			$span_y = max( $span_y, abs( $pin['y'] ) + $pin['height'] / 2 );
		}
		return array( 'width' => round( $span_x * 2, 3 ), 'height' => round( $span_y * 2, 3 ) );
	}
}
