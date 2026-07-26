<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DAT_PCB_AI {
	const OPTION_API_KEY = 'dat_pcb_tracer_openai_api_key';
	const OPTION_MODEL   = 'dat_pcb_tracer_openai_model';

	public function get_model() {
		$model = get_option( self::OPTION_MODEL, 'gpt-4.1' );
		$model = is_string( $model ) ? trim( $model ) : '';
		return $model ? $model : 'gpt-4.1';
	}

	public function has_api_key() {
		return '' !== $this->get_api_key();
	}

	public function update_settings( $api_key, $model, $clear_key = false ) {
		if ( $clear_key ) {
			delete_option( self::OPTION_API_KEY );
		} elseif ( is_string( $api_key ) && '' !== trim( $api_key ) ) {
			update_option( self::OPTION_API_KEY, trim( $api_key ), false );
		}

		$model = sanitize_text_field( (string) $model );
		if ( '' !== $model ) {
			update_option( self::OPTION_MODEL, $model, false );
		}
	}

	public function generate_component( $params ) {
		$prompt = isset( $params['prompt'] ) ? sanitize_textarea_field( $params['prompt'] ) : '';
		if ( '' === trim( $prompt ) ) {
			return new WP_Error( 'dat_pcb_ai_empty_prompt', 'Vui long nhap ten linh kien hoac noi dung datasheet.', array( 'status' => 400 ) );
		}

		$side  = isset( $params['side'] ) && 'bottom' === $params['side'] ? 'bottom' : 'top';
		$board = isset( $params['board'] ) && is_array( $params['board'] ) ? $params['board'] : array();
		$x = isset( $params['x'] ) ? (float) $params['x'] : 20;
		$y = isset( $params['y'] ) ? (float) $params['y'] : 18;
		$board_width = isset( $board['width_mm'] ) ? max( 1, (float) $board['width_mm'] ) : 100;
		$board_height = isset( $board['height_mm'] ) ? max( 1, (float) $board['height_mm'] ) : 80;

		$circuit = $this->known_circuit_plan( $prompt, $side, $x, $y, $board_width, $board_height );
		if ( $circuit ) {
			return rest_ensure_response( $this->sanitize_plan( $circuit, $side, $x, $y, $board_width, $board_height ) );
		}

		$template = $this->known_component_plan( $prompt, $side, $x, $y );
		if ( $template ) {
			return rest_ensure_response( $this->sanitize_plan( $template, $side, $x, $y, $board_width, $board_height ) );
		}

		$api_key = $this->get_api_key();
		if ( '' === $api_key ) {
			return new WP_Error( 'dat_pcb_ai_missing_key', 'Chua cau hinh OpenAI API key trong DAT PCB Tracer - Cai dat. Cac linh kien/mach co san (LM2596, 7805, BC547, header, tu dien...) van dung duoc ma khong can API key.', array( 'status' => 400 ) );
		}

		$content = array();
		$file_input = $this->build_datasheet_file_input( isset( $params['_datasheet_file'] ) ? $params['_datasheet_file'] : null );
		if ( is_wp_error( $file_input ) ) {
			return $file_input;
		}
		$pdf_url = $file_input ? '' : $this->extract_pdf_url( $prompt );
		if ( $file_input ) {
			$content[] = $file_input;
		} elseif ( $pdf_url ) {
			$content[] = array(
				'type'     => 'input_file',
				'file_url' => $pdf_url,
				'detail'   => 'high',
			);
		}
		$content[] = array(
			'type' => 'input_text',
			'text' => $this->build_user_prompt( $prompt, $side, $x, $y, $board_width, $board_height ),
		);

		$body = array(
			'model'             => $this->get_model(),
			'instructions'      => $this->build_instructions(),
			'input'             => array(
				array(
					'role'    => 'user',
					'content' => $content,
				),
			),
			'text'              => array(
				'format' => array(
					'type'   => 'json_schema',
					'name'   => 'pcb_component_plan',
					'strict' => true,
					'schema' => $this->component_schema(),
				),
			),
			'max_output_tokens' => 3500,
		);

		$response = wp_remote_post(
			'https://api.openai.com/v1/responses',
			array(
				'timeout' => 60,
				'headers' => array(
					'Authorization' => 'Bearer ' . $api_key,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'dat_pcb_ai_request_failed', $response->get_error_message(), array( 'status' => 502 ) );
		}

		$code = wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );
		if ( $code < 200 || $code >= 300 ) {
			$message = isset( $data['error']['message'] ) ? $data['error']['message'] : 'OpenAI API error.';
			return new WP_Error( 'dat_pcb_ai_api_error', sanitize_text_field( $message ), array( 'status' => 502 ) );
		}

		$text = $this->extract_output_text( $data );
		$plan = json_decode( $text, true );
		if ( ! is_array( $plan ) ) {
			return new WP_Error( 'dat_pcb_ai_invalid_json', 'OpenAI khong tra ve JSON hop le.', array( 'status' => 502 ) );
		}

		return rest_ensure_response( $this->sanitize_plan( $plan, $side, $x, $y, $board_width, $board_height ) );
	}

	public function chat_message( $params ) {
		$message = isset( $params['message'] ) ? sanitize_textarea_field( $params['message'] ) : '';
		if ( '' === trim( $message ) ) {
			return new WP_Error( 'dat_pcb_ai_empty_message', 'Vui long nhap noi dung.', array( 'status' => 400 ) );
		}

		$side  = isset( $params['side'] ) && 'bottom' === $params['side'] ? 'bottom' : 'top';
		$board = isset( $params['board'] ) && is_array( $params['board'] ) ? $params['board'] : array();
		$x = isset( $params['x'] ) ? (float) $params['x'] : 20;
		$y = isset( $params['y'] ) ? (float) $params['y'] : 18;
		$board_width  = isset( $board['width_mm'] ) ? max( 1, (float) $board['width_mm'] ) : 100;
		$board_height = isset( $board['height_mm'] ) ? max( 1, (float) $board['height_mm'] ) : 80;

		$file_input = $this->build_datasheet_file_input( isset( $params['_datasheet_file'] ) ? $params['_datasheet_file'] : null );
		if ( is_wp_error( $file_input ) ) {
			return $file_input;
		}
		$pdf_url = $file_input ? '' : $this->extract_pdf_url( $message );

		// Uu tien template cuc bo (mien phi, khong can API key) cho yeu cau "tao moi"
		// truoc khi phai goi OpenAI - giu dung nguyen tac da ap dung cho generate_component().
		// Bo qua neu nguoi dung dinh kem datasheet - ho muon AI doc dung file do.
		if ( ! $file_input && ! $pdf_url ) {
			$circuit = $this->known_circuit_plan( $message, $side, $x, $y, $board_width, $board_height );
			if ( $circuit ) {
				$plan = $this->sanitize_plan( $circuit, $side, $x, $y, $board_width, $board_height );
				return rest_ensure_response( array(
					'reply'    => implode( ' ', $plan['warnings'] ),
					'commands' => $plan['commands'],
				) );
			}
			$template = $this->known_component_plan( $message, $side, $x, $y );
			if ( $template ) {
				$plan = $this->sanitize_plan( $template, $side, $x, $y, $board_width, $board_height );
				return rest_ensure_response( array(
					'reply'    => implode( ' ', $plan['warnings'] ),
					'commands' => $plan['commands'],
				) );
			}
		}

		$api_key = $this->get_api_key();
		if ( '' === $api_key ) {
			return new WP_Error( 'dat_pcb_ai_missing_key', 'Khong nhan dien duoc yeu cau bang du lieu cuc bo. Can cau hinh OpenAI API key (DAT PCB Tracer - Cai dat) de chat AI xu ly cac yeu cau khac (sua/xoa linh kien co san, linh kien la...).', array( 'status' => 400 ) );
		}

		$known_refs = array();
		$components = array();
		if ( isset( $params['components'] ) && is_array( $params['components'] ) ) {
			foreach ( array_slice( $params['components'], 0, 500 ) as $component ) {
				if ( ! is_array( $component ) ) {
					continue;
				}
				$ref = sanitize_text_field( (string) ( $component['ref'] ?? '' ) );
				if ( '' === $ref ) {
					continue;
				}
				$known_refs[ $ref ] = true;
				$components[] = array(
					'ref'      => $ref,
					'name'     => sanitize_text_field( (string) ( $component['name'] ?? '' ) ),
					'value'    => sanitize_text_field( (string) ( $component['value'] ?? '' ) ),
					'package'  => sanitize_text_field( (string) ( $component['package'] ?? '' ) ),
					'side'     => 'bottom' === ( $component['side'] ?? '' ) ? 'bottom' : 'top',
					'x'        => round( (float) ( $component['x'] ?? 0 ), 3 ),
					'y'        => round( (float) ( $component['y'] ?? 0 ), 3 ),
					'rotation' => (float) ( $component['rotation'] ?? 0 ),
				);
			}
		}

		$history = array();
		if ( isset( $params['history'] ) && is_array( $params['history'] ) ) {
			foreach ( array_slice( $params['history'], -20 ) as $turn ) {
				if ( ! is_array( $turn ) ) {
					continue;
				}
				$role = 'assistant' === ( $turn['role'] ?? '' ) ? 'assistant' : 'user';
				$content = sanitize_textarea_field( (string) ( $turn['content'] ?? '' ) );
				if ( '' === $content ) {
					continue;
				}
				$history[] = array( 'role' => $role, 'content' => $content );
			}
		}

		$board_summary  = "Board size: {$board_width}mm x {$board_height}mm.\n";
		$board_summary .= "Active side in editor: {$side}. Cursor/insertion point: {$x}mm, {$y}mm.\n";
		$board_summary .= empty( $components )
			? "No components on the board yet.\n"
			: 'Existing components (JSON array): ' . wp_json_encode( array_values( $components ) ) . "\n";

		$input = array();
		foreach ( $history as $turn ) {
			$input[] = array( 'role' => $turn['role'], 'content' => $turn['content'] );
		}
		$user_text = $board_summary . "\nUser request: " . $message;
		if ( $file_input || $pdf_url ) {
			$content = array();
			if ( $file_input ) {
				$content[] = $file_input;
			} elseif ( $pdf_url ) {
				$content[] = array(
					'type'     => 'input_file',
					'file_url' => $pdf_url,
					'detail'   => 'high',
				);
			}
			$content[] = array( 'type' => 'input_text', 'text' => $user_text );
			$input[] = array( 'role' => 'user', 'content' => $content );
		} else {
			$input[] = array( 'role' => 'user', 'content' => $user_text );
		}

		$body = array(
			'model'             => $this->get_model(),
			'instructions'      => $this->build_chat_instructions(),
			'input'             => $input,
			'text'              => array(
				'format' => array(
					'type'   => 'json_schema',
					'name'   => 'pcb_chat_response',
					'strict' => true,
					'schema' => $this->chat_schema(),
				),
			),
			'max_output_tokens' => 3500,
		);

		$response = wp_remote_post(
			'https://api.openai.com/v1/responses',
			array(
				'timeout' => 60,
				'headers' => array(
					'Authorization' => 'Bearer ' . $api_key,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $body ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'dat_pcb_ai_request_failed', $response->get_error_message(), array( 'status' => 502 ) );
		}
		$code = wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );
		if ( $code < 200 || $code >= 300 ) {
			$err_message = isset( $data['error']['message'] ) ? $data['error']['message'] : 'OpenAI API error.';
			return new WP_Error( 'dat_pcb_ai_api_error', sanitize_text_field( $err_message ), array( 'status' => 502 ) );
		}
		$text = $this->extract_output_text( $data );
		$plan = json_decode( $text, true );
		if ( ! is_array( $plan ) ) {
			return new WP_Error( 'dat_pcb_ai_invalid_json', 'OpenAI khong tra ve JSON hop le.', array( 'status' => 502 ) );
		}
		return rest_ensure_response( $this->sanitize_chat_response( $plan, $side, $x, $y, $board_width, $board_height, $known_refs ) );
	}

	private function get_api_key() {
		$key = get_option( self::OPTION_API_KEY, '' );
		return is_string( $key ) ? trim( $key ) : '';
	}

	private function extract_pdf_url( $prompt ) {
		if ( preg_match( '~https?://\S+\.pdf(?:\?\S*)?~i', $prompt, $matches ) ) {
			return esc_url_raw( rtrim( $matches[0], " \t\n\r\0\x0B.,)" ) );
		}
		return '';
	}

	private function build_datasheet_file_input( $file ) {
		if ( empty( $file ) || ! is_array( $file ) || empty( $file['tmp_name'] ) ) {
			return null;
		}
		if ( ! empty( $file['error'] ) ) {
			return new WP_Error( 'dat_pcb_ai_upload_error', 'Khong doc duoc file datasheet.', array( 'status' => 400 ) );
		}
		$name = isset( $file['name'] ) ? sanitize_file_name( $file['name'] ) : 'datasheet.pdf';
		$size = isset( $file['size'] ) ? (int) $file['size'] : 0;
		if ( $size <= 0 || $size > 8 * 1024 * 1024 ) {
			return new WP_Error( 'dat_pcb_ai_file_size', 'Datasheet PDF phai nho hon 8 MB.', array( 'status' => 400 ) );
		}
		if ( 'pdf' !== strtolower( pathinfo( $name, PATHINFO_EXTENSION ) ) ) {
			return new WP_Error( 'dat_pcb_ai_file_type', 'Chi ho tro datasheet PDF.', array( 'status' => 400 ) );
		}
		$bytes = file_get_contents( $file['tmp_name'] );
		if ( false === $bytes ) {
			return new WP_Error( 'dat_pcb_ai_file_read', 'Khong doc duoc file datasheet.', array( 'status' => 400 ) );
		}
		return array(
			'type'      => 'input_file',
			'filename'  => $name,
			'file_data' => 'data:application/pdf;base64,' . base64_encode( $bytes ),
			'detail'    => 'high',
		);
	}

	private function build_user_prompt( $prompt, $side, $x, $y, $board_width, $board_height ) {
		return "Input: {$prompt}\n" .
			"Target side: {$side}\n" .
			"Insertion point: {$x} mm, {$y} mm\n" .
			"Board size: {$board_width} mm x {$board_height} mm\n" .
			"Return a practical PCB footprint plan only. Include silk lines as an array, or an empty array if unknown. If package is ambiguous, choose the most common through-hole package and include a warning.";
	}

	private function known_component_plan( $prompt, $side, $x, $y ) {
		$text = strtolower( (string) $prompt );
		$template = $this->resolve_local_footprint_template( $text, $prompt );
		if ( ! $template ) {
			return null;
		}
		$command = $template;
		$command['type'] = 'ADD_FOOTPRINT';
		$command['side'] = $side;
		$command['x'] = $x;
		$command['y'] = $y;
		if ( empty( $command['ref'] ) ) {
			$command['ref'] = ( $command['ref_prefix'] ?? 'U' ) . '1';
		}
		unset( $command['ref_prefix'] );
		return array(
			'version'  => 'component-plan-1',
			'warnings' => array( $command['warning'] ?? 'Dung footprint template cuc bo. Kiem tra datasheet va quy trinh san xuat truoc khi dat PCB.' ),
			'commands' => array( $command ),
		);
	}

	private function template_to_command( $template, $side, $x, $y, $ref, $value_override = null ) {
		$command = $template;
		$command['type'] = 'ADD_FOOTPRINT';
		$command['side'] = $side;
		$command['x'] = $x;
		$command['y'] = $y;
		$command['ref'] = $ref;
		if ( null !== $value_override ) {
			$command['value'] = $value_override;
		}
		unset( $command['ref_prefix'], $command['warning'] );
		return $command;
	}

	private function known_circuit_plan( $prompt, $side, $x, $y, $board_width = 100, $board_height = 80 ) {
		$text = strtolower( (string) $prompt );
		if ( false === strpos( $text, 'lm2596' ) ) {
			return null;
		}
		$has_circuit_intent = $this->prompt_has_any( $text, array( 'mach', 'mạch', 'circuit', 'module', 'on ap', 'ổn áp', 'converter', 'buck', 'nguon', 'nguồn' ) );
		if ( ! $has_circuit_intent ) {
			return null;
		}

		// Giu du le voi bien board de cac linh kien phu (lech +-28mm, +35mm)
		// khong bi ham max/min trong sanitize_plan() ep ve sat canh board,
		// vi ep tung linh kien rieng le se pha vo bo cuc tuong doi da tinh.
		$x = max( 30, min( $board_width - 32, $x ) );
		$y = max( 5, min( $board_height - 40, $y ) );

		$voltage = 5.0;
		if ( preg_match( '/(\d+(?:[.,]\d+)?)\s*v\b/i', $prompt, $vmatch ) ) {
			$parsed = (float) str_replace( ',', '.', $vmatch[1] );
			if ( $parsed >= 1.5 && $parsed <= 35 ) {
				$voltage = $parsed;
			}
		}
		$r1_ohm = 1000;
		$r2_ohm = max( 100, (int) round( $r1_ohm * ( $voltage / 1.23 - 1 ) / 10 ) * 10 );
		$r2_label = $r2_ohm >= 1000 ? ( rtrim( rtrim( number_format( $r2_ohm / 1000, 2, '.', '' ), '0' ), '.' ) . 'k' ) : $r2_ohm . 'R';

		// LM2596 D2PAK-5 body la 10.16x15.24mm, pin o canh duoi theo thu tu trai->phai
		// VIN, OUT, GND, FB, ON/OFF. Xep linh kien phu thanh 1 hang phia duoi, theo
		// dung thu tu tin hieu (VIN -> nut chuyen mach OUT/L/D -> VOUT -> hoi tiep FB)
		// de giam duong noi cheo/cat nhau. Day GND noi kieu chuoi trai->phai thay vi
		// toa tia tu 1 diem de tranh cac duong dan de bi de/cat nhau tren man hinh.
		$commands = array(
			$this->template_to_command( $this->template_lm2596( true ), $side, $x, $y, 'U1' ),
			$this->template_to_command( $this->template_radial_cap( '220uF 25V', 5.0, 2.0 ), $side, $x - 24, $y + 22, 'C1' ),
			$this->template_to_command( $this->template_sma( 'SS34' ), $side, $x - 9, $y + 22, 'D1' ),
			$this->template_to_command( $this->template_radial_inductor( '33uH' ), $side, $x + 4, $y + 22, 'L1' ),
			$this->template_to_command( $this->template_radial_cap( '220uF 25V', 5.0, 2.0 ), $side, $x + 16, $y + 22, 'C2' ),
			$this->template_to_command( $this->template_chip2( '0805', 'RES', 'R' ), $side, $x + 28, $y + 18, 'R2', $r2_label ),
			$this->template_to_command( $this->template_chip2( '0805', 'RES', 'R' ), $side, $x + 28, $y + 24, 'R1', '1k' ),
		);
		$connects = array(
			array( 'type' => 'CONNECT', 'from' => 'U1.1', 'to' => 'C1.1' ),
			array( 'type' => 'CONNECT', 'from' => 'C1.2', 'to' => 'D1.A' ),
			array( 'type' => 'CONNECT', 'from' => 'D1.A', 'to' => 'U1.3' ),
			array( 'type' => 'CONNECT', 'from' => 'U1.3', 'to' => 'C2.2' ),
			array( 'type' => 'CONNECT', 'from' => 'C2.2', 'to' => 'R1.2' ),
			array( 'type' => 'CONNECT', 'from' => 'U1.2', 'to' => 'L1.1' ),
			array( 'type' => 'CONNECT', 'from' => 'U1.2', 'to' => 'D1.K' ),
			array( 'type' => 'CONNECT', 'from' => 'L1.2', 'to' => 'C2.1' ),
			array( 'type' => 'CONNECT', 'from' => 'L1.2', 'to' => 'R2.1' ),
			array( 'type' => 'CONNECT', 'from' => 'U1.4', 'to' => 'R2.2' ),
			array( 'type' => 'CONNECT', 'from' => 'U1.4', 'to' => 'R1.1' ),
			array( 'type' => 'CONNECT', 'from' => 'U1.5', 'to' => 'U1.3' ),
		);
		return array(
			'version'  => 'component-plan-1',
			'warnings' => array(
				'Mach LM2596 buck ' . $voltage . 'V dung mau mach cuc bo: R1=1k, R2~' . $r2_label . ' (Vref=1.23V, cong thuc Vout = 1.23 * (1 + R2/R1)).',
				'Day la thiet ke tham khao pho bien (Cin/Cout/L/D catch/feedback divider), khong thay the ho so ky thuat. Kiem tra lai gia tri linh kien thuc te va datasheet LM2596 truoc khi san xuat.',
				'Cac duong noi la track thang ve tu dong giua tam chan, hay kiem tra be rong dong va di lai theo dong dien thuc te (dac biet nut chuyen mach OUT-L1-D1) truoc khi san xuat.',
			),
			'commands' => array_merge( $commands, $connects ),
		);
	}

	private function template_radial_cap( $value, $diameter = 5.0, $lead_spacing = 2.0 ) {
		$half = $lead_spacing / 2;
		return $this->local_template(
			'CAP',
			'C',
			'Radial D' . $diameter . 'mm P' . $lead_spacing . 'mm',
			array( 'width' => $diameter, 'height' => $diameter ),
			array(
				$this->pin( '1', '+', -$half, 0, 'round', 1.3, 1.3, 0.7, false, true ),
				$this->pin( '2', '-', $half, 0, 'round', 1.3, 1.3, 0.7, false, true ),
			),
			'Tu dien radial cuc bo, kich thuoc gan dung. Kiem tra kich thuoc that cua linh kien truoc khi khoan lo.',
			null,
			$value
		);
	}

	private function template_radial_inductor( $value ) {
		return $this->local_template(
			'IND',
			'L',
			'Radial Power Inductor',
			array( 'width' => 10.0, 'height' => 10.0 ),
			array(
				$this->pin( '1', '1', -3.75, 0, 'round', 1.4, 1.4, 0.9, false, true ),
				$this->pin( '2', '2', 3.75, 0, 'round', 1.4, 1.4, 0.9, false, true ),
			),
			'Cuon cam cuc bo, kich thuoc gan dung. Kiem tra kich thuoc that cua linh kien truoc khi khoan lo.',
			null,
			$value
		);
	}

	private function resolve_local_footprint_template( $text, $prompt ) {
		$is_smd = $this->prompt_has_any( $text, array( 'smd', 'smt', 'dan', 'dán', 'dán', 'd2pak', 'dpak', 'to-252', 'to-263', 'sot', 'soic', 'sop', 'tssop', 'qfp', '0805', '0603', '0402', '1206' ) );
		if ( false !== strpos( $text, 'lm2596' ) ) {
			return $this->template_lm2596( false === strpos( $text, 'to-220' ) );
		}
		if ( preg_match( '/\b(ams1117|lm1117|ld1117|1117)\b/i', $prompt ) ) {
			return $this->template_sot223_3( 'AMS1117', 'U', array( 'ADJ/GND', 'OUT', 'IN' ) );
		}
		if ( preg_match( '/\b(78m[o0]5|7805|78l[o0]5|78xx|lm7805|l7805)\b/i', $prompt ) ) {
			return $is_smd ? $this->template_to252_3( '78M05', 'U', array( 'IN', 'GND', 'OUT' ) ) : $this->template_to220_3( '7805', 'U', array( 'IN', 'GND', 'OUT' ) );
		}
		if ( preg_match( '/\b(lm358|ne555|tl072|mcp6002|op07)\b/i', $prompt, $match ) ) {
			$name = strtoupper( $match[1] );
			return $is_smd ? $this->template_soic( 8, $name, 'U' ) : $this->template_dip( 8, $name, 'U' );
		}
		if ( preg_match( '/\b(pc817|el817|tlp521)\b/i', $prompt, $match ) ) {
			$name = strtoupper( $match[1] );
			return $is_smd ? $this->template_soic( 4, $name, 'U' ) : $this->template_dip( 4, $name, 'U' );
		}
		if ( preg_match( '/\b(2n3904|2n3906|s8050|ss8050|s8550|bc547|bc557|a1015|c1815)\b/i', $prompt, $match ) ) {
			$name = strtoupper( $match[1] );
			return $is_smd ? $this->template_sot23_3( $name, 'Q', array( 'B', 'E', 'C' ) ) : $this->template_to92_3( $name, 'Q', array( 'E', 'B', 'C' ) );
		}
		if ( preg_match( '/\b(1n4148|1n4007|ss14|ss34|m7|fr107|diode|diot|diode)\b/i', $prompt, $match ) ) {
			$name = strtoupper( $match[1] );
			if ( $this->prompt_has_any( $text, array( 'sma', 'do-214ac' ) ) ) return $this->template_sma( $name );
			return $is_smd ? $this->template_sod123( $name ) : $this->template_axial_diode( $name );
		}
		if ( preg_match( '/\bheader\s*(\d+)x(\d+)|\b(\d+)x(\d+)\s*header/i', $prompt, $match ) ) {
			$rows = (int) ( ! empty( $match[1] ) ? $match[1] : ( $match[3] ?? 1 ) );
			$cols = (int) ( ! empty( $match[2] ) ? $match[2] : ( $match[4] ?? 1 ) );
			return $this->template_pin_header( max( 1, min( 2, $rows ) ), max( 1, min( 40, $cols ) ) );
		}
		if ( preg_match( '/\b(?:terminal|domino|screw).*?(\d+)\s*p/i', $prompt, $match ) ) {
			return $this->template_terminal_block( max( 2, min( 12, (int) $match[1] ) ) );
		}
		if ( preg_match( '/\b(0402|0603|0805|1206)\b/', $text, $match ) ) {
			return $this->template_chip2( $match[1], $this->passive_component_name( $text ), $this->passive_ref_prefix( $text ) );
		}
		if ( preg_match( '/\bsoic[-_ ]?(\d+)|\bsop[-_ ]?(\d+)/i', $prompt, $match ) ) {
			return $this->template_soic( max( 4, min( 28, (int) ( $match[1] ?: $match[2] ) ) ), 'SOIC', 'U' );
		}
		if ( preg_match( '/\btssop[-_ ]?(\d+)/i', $prompt, $match ) ) {
			return $this->template_tssop( max( 8, min( 28, (int) $match[1] ) ), 'TSSOP', 'U' );
		}
		if ( preg_match( '/\bdip[-_ ]?(\d+)/i', $prompt, $match ) ) {
			return $this->template_dip( max( 4, min( 40, (int) $match[1] ) ), 'DIP', 'U' );
		}
		if ( $this->prompt_has_any( $text, array( 'sot-23', 'sot23' ) ) ) return $this->template_sot23_3( 'SOT-23', 'Q' );
		if ( $this->prompt_has_any( $text, array( 'sot-223', 'sot223' ) ) ) return $this->template_sot223_3( 'SOT-223', 'U' );
		if ( $this->prompt_has_any( $text, array( 'to-220-5', 'to220-5' ) ) ) return $this->template_to220_5( 'TO-220-5', 'U' );
		if ( $this->prompt_has_any( $text, array( 'to-220', 'to220' ) ) ) return $this->template_to220_3( 'TO-220', 'U' );
		if ( $this->prompt_has_any( $text, array( 'to-252', 'to252', 'dpak' ) ) ) return $this->template_to252_3( 'TO-252', 'U' );
		if ( $this->prompt_has_any( $text, array( 'to-263-5', 'to263-5', 'd2pak-5' ) ) ) return $this->template_lm2596( true, 'TO-263-5' );
		if ( $this->prompt_has_any( $text, array( 'to-263', 'to263', 'd2pak' ) ) ) return $this->template_to263_3( 'TO-263', 'U' );
		if ( $this->prompt_has_any( $text, array( 'sod-123', 'sod123' ) ) ) return $this->template_sod123( 'DIODE' );
		if ( $this->prompt_has_any( $text, array( 'sma', 'do-214ac' ) ) ) return $this->template_sma( 'DIODE' );
		return null;
	}

	private function prompt_has_any( $text, $needles ) {
		foreach ( $needles as $needle ) {
			if ( false !== strpos( $text, $needle ) ) return true;
		}
		return false;
	}

	private function passive_component_name( $text ) {
		if ( $this->prompt_has_any( $text, array( 'capacitor', 'tu dien', 'tụ', 'cap' ) ) ) return 'CAP';
		if ( $this->prompt_has_any( $text, array( 'inductor', 'cuon cam', 'cuộn cảm' ) ) ) return 'IND';
		if ( $this->prompt_has_any( $text, array( 'led' ) ) ) return 'LED';
		return 'RES';
	}

	private function passive_ref_prefix( $text ) {
		if ( $this->prompt_has_any( $text, array( 'capacitor', 'tu dien', 'tụ', 'cap' ) ) ) return 'C';
		if ( $this->prompt_has_any( $text, array( 'inductor', 'cuon cam', 'cuộn cảm' ) ) ) return 'L';
		if ( $this->prompt_has_any( $text, array( 'led', 'diode' ) ) ) return 'D';
		return 'R';
	}

	private function local_template( $component, $ref_prefix, $package, $outline, $pins, $warning = '', $silk = null, $value = '' ) {
		return array(
			'ref_prefix' => $ref_prefix,
			'component'  => $component,
			'value'      => $value ? $value : $component,
			'package'    => $package,
			'outline'    => $outline,
			'silk'       => is_array( $silk ) ? $silk : $this->silk_rectangle( $outline['width'] ?? 0, $outline['height'] ?? 0 ),
			'pins'       => $pins,
			'warning'    => $warning ? $warning : 'Dung footprint template cuc bo ' . $package . '. Kiem tra datasheet va quy trinh san xuat truoc khi dat PCB.',
		);
	}

	private function pin( $number, $name, $x, $y, $shape, $width, $height, $drill = 0, $smd = true, $suppress = true ) {
		return array(
			'number' => (string) $number,
			'name' => (string) $name,
			'x' => (float) $x,
			'y' => (float) $y,
			'shape' => $shape,
			'width' => (float) $width,
			'height' => (float) $height,
			'diameter' => (float) max( $width, $height ),
			'drill' => (float) $drill,
			'smd' => (bool) $smd,
			'suppress_pin_name' => (bool) $suppress,
		);
	}

	private function silk_rectangle( $width, $height, $clear_bottom = 0 ) {
		$hw = (float) $width / 2 + 0.25;
		$hh = (float) $height / 2 + 0.25;
		if ( $hw <= 0 || $hh <= 0 ) return array();
		$bottom_y = $hh - max( 0, (float) $clear_bottom );
		$lines = array(
			array( 'x1' => -$hw, 'y1' => -$hh, 'x2' => $hw, 'y2' => -$hh, 'width' => 0.12 ),
			array( 'x1' => -$hw, 'y1' => -$hh, 'x2' => -$hw, 'y2' => $bottom_y, 'width' => 0.12 ),
			array( 'x1' => $hw, 'y1' => -$hh, 'x2' => $hw, 'y2' => $bottom_y, 'width' => 0.12 ),
		);
		if ( $clear_bottom <= 0 ) {
			$lines[] = array( 'x1' => -$hw, 'y1' => $hh, 'x2' => $hw, 'y2' => $hh, 'width' => 0.12 );
		}
		$lines[] = array( 'x1' => -$hw, 'y1' => -$hh, 'x2' => -$hw + 0.8, 'y2' => -$hh + 0.8, 'width' => 0.12 );
		return $lines;
	}

	private function template_chip2( $code, $component, $ref_prefix ) {
		$sizes = array(
			'0402' => array( 1.0, 0.5, 0.58, 0.64, 0.52 ),
			'0603' => array( 1.6, 0.8, 0.85, 0.95, 0.85 ),
			'0805' => array( 2.0, 1.25, 1.10, 1.40, 1.10 ),
			'1206' => array( 3.2, 1.6, 1.45, 1.80, 1.80 ),
		);
		$s = $sizes[ $code ] ?? $sizes['0805'];
		return $this->local_template(
			$component,
			$ref_prefix,
			$code,
			array( 'width' => $s[0], 'height' => $s[1] ),
			array(
				$this->pin( '1', '1', -$s[4], 0, 'rect', $s[2], $s[3], 0, true, true ),
				$this->pin( '2', '2', $s[4], 0, 'rect', $s[2], $s[3], 0, true, true ),
			)
		);
	}

	private function template_sot23_3( $component, $ref_prefix, $names = array() ) {
		$names = array_pad( $names, 3, '' );
		return $this->local_template(
			$component,
			$ref_prefix,
			'SOT-23-3',
			array( 'width' => 2.9, 'height' => 2.8 ),
			array(
				$this->pin( '1', $names[0], -0.95, 1.10, 'rect', 0.70, 1.00, 0, true, true ),
				$this->pin( '2', $names[1], 0.95, 1.10, 'rect', 0.70, 1.00, 0, true, true ),
				$this->pin( '3', $names[2], 0.00, -1.10, 'rect', 0.80, 1.00, 0, true, true ),
			)
		);
	}

	private function template_sot223_3( $component, $ref_prefix, $names = array() ) {
		$names = array_pad( $names, 3, '' );
		return $this->local_template(
			$component,
			$ref_prefix,
			'SOT-223-3',
			array( 'width' => 6.5, 'height' => 7.0 ),
			array(
				$this->pin( '1', $names[0], -2.30, 2.85, 'rect', 1.15, 2.00, 0, true, true ),
				$this->pin( '2', $names[1], 0.00, 2.85, 'rect', 1.15, 2.00, 0, true, true ),
				$this->pin( '3', $names[2], 2.30, 2.85, 'rect', 1.15, 2.00, 0, true, true ),
				$this->pin( '2', $names[1] ? $names[1] . '/TAB' : 'TAB', 0.00, -2.25, 'rect', 3.80, 2.80, 0, true, false ),
			)
		);
	}

	private function template_soic( $pins, $component, $ref_prefix ) {
		$per_side = max( 2, (int) ceil( $pins / 2 ) );
		$pitch = 1.27;
		$height = ( $per_side - 1 ) * $pitch + 2.2;
		$list = array();
		for ( $i = 0; $i < $per_side; $i++ ) {
			$ypos = ( $i - ( $per_side - 1 ) / 2 ) * $pitch;
			$list[] = $this->pin( (string) ( $i + 1 ), '', -2.70, $ypos, 'rect', 1.55, 0.60, 0, true, true );
		}
		for ( $i = 0; $i < $per_side; $i++ ) {
			$pin_no = $pins - $i;
			$ypos = ( $i - ( $per_side - 1 ) / 2 ) * $pitch;
			$list[] = $this->pin( (string) $pin_no, '', 2.70, $ypos, 'rect', 1.55, 0.60, 0, true, true );
		}
		return $this->local_template( $component, $ref_prefix, 'SOIC-' . $pins, array( 'width' => 3.9, 'height' => $height ), $list );
	}

	private function template_tssop( $pins, $component, $ref_prefix ) {
		$per_side = max( 4, (int) ceil( $pins / 2 ) );
		$pitch = 0.65;
		$height = ( $per_side - 1 ) * $pitch + 1.8;
		$list = array();
		for ( $i = 0; $i < $per_side; $i++ ) {
			$ypos = ( $i - ( $per_side - 1 ) / 2 ) * $pitch;
			$list[] = $this->pin( (string) ( $i + 1 ), '', -2.15, $ypos, 'rect', 1.10, 0.34, 0, true, true );
			$list[] = $this->pin( (string) ( $pins - $i ), '', 2.15, $ypos, 'rect', 1.10, 0.34, 0, true, true );
		}
		return $this->local_template( $component, $ref_prefix, 'TSSOP-' . $pins, array( 'width' => 4.4, 'height' => $height ), $list );
	}

	private function template_dip( $pins, $component, $ref_prefix ) {
		$per_side = max( 2, (int) ceil( $pins / 2 ) );
		$pitch = 2.54;
		$height = ( $per_side - 1 ) * $pitch + 5.0;
		$list = array();
		for ( $i = 0; $i < $per_side; $i++ ) {
			$ypos = ( $i - ( $per_side - 1 ) / 2 ) * $pitch;
			$list[] = $this->pin( (string) ( $i + 1 ), '', -3.81, $ypos, $i === 0 ? 'rect' : 'round', 1.7, 1.7, 0.8, false, true );
			$list[] = $this->pin( (string) ( $pins - $i ), '', 3.81, $ypos, 'round', 1.7, 1.7, 0.8, false, true );
		}
		return $this->local_template( $component, $ref_prefix, 'DIP-' . $pins, array( 'width' => 9.8, 'height' => $height ), $list );
	}

	private function template_to92_3( $component, $ref_prefix, $names = array() ) {
		$names = array_pad( $names, 3, '' );
		return $this->local_template(
			$component,
			$ref_prefix,
			'TO-92-3',
			array( 'width' => 5.2, 'height' => 4.2 ),
			array(
				$this->pin( '1', $names[0], -1.27, 1.70, 'round', 1.5, 1.5, 0.75, false, true ),
				$this->pin( '2', $names[1], 0.00, 1.70, 'round', 1.5, 1.5, 0.75, false, true ),
				$this->pin( '3', $names[2], 1.27, 1.70, 'round', 1.5, 1.5, 0.75, false, true ),
			)
		);
	}

	private function template_to220_3( $component, $ref_prefix, $names = array() ) {
		$names = array_pad( $names, 3, '' );
		return $this->local_template(
			$component,
			$ref_prefix,
			'TO-220-3',
			array( 'width' => 10.2, 'height' => 15.2 ),
			array(
				$this->pin( '1', $names[0], -2.54, 6.40, 'round', 1.8, 1.8, 1.0, false, true ),
				$this->pin( '2', $names[1], 0.00, 6.40, 'round', 1.8, 1.8, 1.0, false, true ),
				$this->pin( '3', $names[2], 2.54, 6.40, 'round', 1.8, 1.8, 1.0, false, true ),
			)
		);
	}

	private function template_to220_5( $component, $ref_prefix ) {
		$list = array();
		for ( $i = 0; $i < 5; $i++ ) {
			$list[] = $this->pin( (string) ( $i + 1 ), '', ( $i - 2 ) * 1.70, 6.40, 'round', 1.6, 1.6, 0.9, false, true );
		}
		return $this->local_template( $component, $ref_prefix, 'TO-220-5', array( 'width' => 10.2, 'height' => 15.2 ), $list );
	}

	private function template_to252_3( $component, $ref_prefix, $names = array() ) {
		$names = array_pad( $names, 3, '' );
		return $this->local_template(
			$component,
			$ref_prefix,
			'TO-252-3 / DPAK',
			array( 'width' => 6.7, 'height' => 6.6 ),
			array(
				$this->pin( '1', $names[0], -2.28, 3.45, 'rect', 1.05, 2.40, 0, true, true ),
				$this->pin( '2', $names[1], 0.00, 3.45, 'rect', 1.05, 2.40, 0, true, true ),
				$this->pin( '3', $names[2], 2.28, 3.45, 'rect', 1.05, 2.40, 0, true, true ),
				$this->pin( '2', $names[1] ? $names[1] . '/TAB' : 'TAB', 0.00, -2.15, 'rect', 5.80, 5.00, 0, true, false ),
			)
		);
	}

	private function template_to263_3( $component, $ref_prefix ) {
		return $this->local_template(
			$component,
			$ref_prefix,
			'TO-263-3 / D2PAK',
			array( 'width' => 10.16, 'height' => 15.24 ),
			array(
				$this->pin( '1', '', -2.54, 6.85, 'rect', 1.20, 3.10, 0, true, true ),
				$this->pin( '2', '', 0.00, 6.85, 'rect', 1.20, 3.10, 0, true, true ),
				$this->pin( '3', '', 2.54, 6.85, 'rect', 1.20, 3.10, 0, true, true ),
				$this->pin( '2', 'TAB', 0.00, -2.10, 'rect', 10.40, 8.40, 0, true, false ),
			),
			''
		);
	}

	private function template_lm2596( $smd = true, $component = 'LM2596' ) {
		if ( ! $smd ) {
			$template = $this->template_to220_5( 'LM2596', 'U' );
			$template['pins'][0]['name'] = 'VIN';
			$template['pins'][1]['name'] = 'OUT';
			$template['pins'][2]['name'] = 'GND';
			$template['pins'][3]['name'] = 'FB';
			$template['pins'][4]['name'] = 'ON/OFF';
			$template['warning'] = 'Dung footprint cuc bo LM2596 TO-220-5. Kiem tra bien the package truoc khi san xuat.';
			return $template;
		}
		return $this->local_template(
			'LM2596',
			'U',
			'TO-263-5 KTT / D2PAK-5',
			array( 'width' => 10.16, 'height' => 15.24 ),
			array(
				$this->pin( '1', 'VIN', -3.40, 6.85, 'rect', 1.05, 3.10, 0, true, true ),
				$this->pin( '2', 'OUT', -1.70, 6.85, 'rect', 1.05, 3.10, 0, true, true ),
				$this->pin( '3', 'GND', 0.00, 6.85, 'rect', 1.05, 3.10, 0, true, true ),
				$this->pin( '4', 'FB', 1.70, 6.85, 'rect', 1.05, 3.10, 0, true, true ),
				$this->pin( '5', 'ON/OFF', 3.40, 6.85, 'rect', 1.05, 3.10, 0, true, true ),
				$this->pin( '3', 'TAB/GND', 0.00, -2.10, 'rect', 10.40, 8.40, 0, true, false ),
			),
			'Dung footprint cuc bo LM2596 TO-263/KTT SMD. Tab lon la pad 3/GND; kiem tra datasheet cua nha san xuat truoc khi san xuat.',
			$this->silk_rectangle( 10.16, 15.24, 1.8 )
		);
	}

	private function template_sod123( $component ) {
		return $this->local_template(
			$component,
			'D',
			'SOD-123',
			array( 'width' => 3.8, 'height' => 1.8 ),
			array(
				$this->pin( 'A', 'A', -2.05, 0, 'rect', 1.25, 1.25, 0, true, true ),
				$this->pin( 'K', 'K', 2.05, 0, 'rect', 1.25, 1.25, 0, true, true ),
			)
		);
	}

	private function template_sma( $component ) {
		return $this->local_template(
			$component,
			'D',
			'SMA / DO-214AC',
			array( 'width' => 5.2, 'height' => 2.7 ),
			array(
				$this->pin( 'A', 'A', -3.05, 0, 'rect', 1.70, 2.10, 0, true, true ),
				$this->pin( 'K', 'K', 3.05, 0, 'rect', 1.70, 2.10, 0, true, true ),
			)
		);
	}

	private function template_axial_diode( $component ) {
		return $this->local_template(
			$component,
			'D',
			'DO-41 / Axial diode',
			array( 'width' => 5.2, 'height' => 2.8 ),
			array(
				$this->pin( 'A', 'A', -5.08, 0, 'round', 1.7, 1.7, 0.9, false, true ),
				$this->pin( 'K', 'K', 5.08, 0, 'round', 1.7, 1.7, 0.9, false, true ),
			)
		);
	}

	private function template_pin_header( $rows, $cols ) {
		$pins = array();
		$pitch = 2.54;
		for ( $r = 0; $r < $rows; $r++ ) {
			for ( $c = 0; $c < $cols; $c++ ) {
				$pin_no = $r * $cols + $c + 1;
				$pins[] = $this->pin( (string) $pin_no, '', ( $c - ( $cols - 1 ) / 2 ) * $pitch, ( $r - ( $rows - 1 ) / 2 ) * $pitch, $pin_no === 1 ? 'rect' : 'round', 1.7, 1.7, 1.0, false, true );
			}
		}
		return $this->local_template( 'HEADER', 'J', 'PinHeader_' . $rows . 'x' . $cols . '_P2.54mm', array( 'width' => max( 2.54, ( $cols - 1 ) * $pitch + 2.4 ), 'height' => max( 2.54, ( $rows - 1 ) * $pitch + 2.4 ) ), $pins );
	}

	private function template_terminal_block( $pins_count ) {
		$pins = array();
		$pitch = 5.08;
		for ( $i = 0; $i < $pins_count; $i++ ) {
			$pins[] = $this->pin( (string) ( $i + 1 ), '', ( $i - ( $pins_count - 1 ) / 2 ) * $pitch, 0, 'round', 2.2, 2.2, 1.2, false, true );
		}
		return $this->local_template( 'TERMINAL', 'J', 'TerminalBlock_' . $pins_count . 'P_P5.08mm', array( 'width' => ( $pins_count - 1 ) * $pitch + 5.0, 'height' => 8.0 ), $pins );
	}

	private function build_instructions() {
		return 'You generate PCB footprint and wiring commands for a browser PCB editor. Return only JSON that matches the schema. Use millimeters. Prefer real package conventions from the component name or datasheet. If the user asks for a full circuit or module (not just one bare part), return multiple ADD_FOOTPRINT commands - one per component (IC, passives, connectors) - laid out with non-overlapping x/y coordinates around the insertion point, plus CONNECT commands for every required electrical connection using "REF.PIN" strings, for example {"type":"CONNECT","from":"U1.1","to":"C1.1"}. Every ref used in a CONNECT command must exist as an ADD_FOOTPRINT command with that exact ref and pin number earlier in the same commands array. Keep coordinates relative to the provided insertion point. Include silk lines when known, and use an empty silk array when unknown. Include pin rotation and suppress_pin_name for every pin. Do not invent electrical connections you are not confident about. If uncertain about component values or wiring, add clear warnings and prefer a conservative, commonly used reference design.';
	}

	private function footprint_command_schema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'type', 'ref', 'component', 'value', 'package', 'side', 'x', 'y', 'outline', 'silk', 'pins' ),
			'properties'           => array(
				'type'      => array( 'type' => 'string', 'enum' => array( 'ADD_FOOTPRINT' ) ),
				'ref'       => array( 'type' => 'string' ),
				'component' => array( 'type' => 'string' ),
				'value'     => array( 'type' => 'string' ),
				'package'   => array( 'type' => 'string' ),
				'side'      => array( 'type' => 'string', 'enum' => array( 'top', 'bottom' ) ),
				'x'         => array( 'type' => 'number' ),
				'y'         => array( 'type' => 'number' ),
				'outline'   => array(
					'type'                 => 'object',
					'additionalProperties' => false,
					'required'             => array( 'width', 'height' ),
					'properties'           => array(
						'width'  => array( 'type' => 'number' ),
						'height' => array( 'type' => 'number' ),
					),
				),
				'silk'      => array(
					'type'  => 'array',
					'items' => array(
						'type'                 => 'object',
						'additionalProperties' => false,
						'required'             => array( 'x1', 'y1', 'x2', 'y2', 'width' ),
						'properties'           => array(
							'x1'    => array( 'type' => 'number' ),
							'y1'    => array( 'type' => 'number' ),
							'x2'    => array( 'type' => 'number' ),
							'y2'    => array( 'type' => 'number' ),
							'width' => array( 'type' => 'number' ),
						),
					),
				),
				'pins'      => array(
					'type'  => 'array',
					'items' => array(
						'type'                 => 'object',
						'additionalProperties' => false,
						'required'             => array( 'number', 'name', 'x', 'y', 'shape', 'width', 'height', 'diameter', 'drill', 'smd', 'rotation', 'suppress_pin_name' ),
						'properties'           => array(
							'number'   => array( 'type' => 'string' ),
							'name'     => array( 'type' => 'string' ),
							'x'        => array( 'type' => 'number' ),
							'y'        => array( 'type' => 'number' ),
							'shape'    => array( 'type' => 'string', 'enum' => array( 'round', 'rect', 'oval' ) ),
							'width'    => array( 'type' => 'number' ),
							'height'   => array( 'type' => 'number' ),
							'diameter' => array( 'type' => 'number' ),
							'drill'    => array( 'type' => 'number' ),
							'smd'      => array( 'type' => 'boolean' ),
							'rotation' => array( 'type' => 'number' ),
							'suppress_pin_name' => array( 'type' => 'boolean' ),
						),
					),
				),
			),
		);
	}

	private function connect_command_schema( $type_name = 'CONNECT' ) {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'type', 'from', 'to' ),
			'properties'           => array(
				'type' => array( 'type' => 'string', 'enum' => array( $type_name ) ),
				'from' => array( 'type' => 'string', 'description' => 'Reference designator and pin number joined by a dot, e.g. U1.1' ),
				'to'   => array( 'type' => 'string', 'description' => 'Reference designator and pin number joined by a dot, e.g. C1.2' ),
			),
		);
	}

	private function component_schema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'version', 'warnings', 'commands' ),
			'properties'           => array(
				'version'  => array( 'type' => 'string', 'enum' => array( 'component-plan-1' ) ),
				'warnings' => array( 'type' => 'array', 'items' => array( 'type' => 'string' ) ),
				'commands' => array(
					'type'  => 'array',
					'items' => array(
						'anyOf' => array( $this->footprint_command_schema(), $this->connect_command_schema() ),
					),
				),
			),
		);
	}

	private function build_chat_instructions() {
		return 'You are a PCB layout assistant chatting with a user inside a browser-based PCB editor. Each message includes the current board size and a JSON list of components already placed (ref, name, value, package, side, x, y, rotation in millimeters). Reply with JSON matching the schema: a short "reply" string in the same language the user wrote in, explaining what you did or answering their question, and a "commands" array (can be empty) with the changes to apply. Available command types: ADD_FOOTPRINT (add a brand new footprint with full pin list, same shape as before), CONNECT (from "REF.PIN" to "REF.PIN", adds a straight copper track between two existing pins), DISCONNECT (from "REF.PIN" to "REF.PIN", removes an existing track directly wiring those two pins), MOVE_COMPONENT (ref, x, y - move an EXISTING component from the provided list to a new absolute position in millimeters), DELETE_COMPONENT (ref - remove an existing component and everything that belongs to it), SET_VALUE (ref, value - change an existing component value/label). Only reference a ref that is either in the provided component list or that you are adding earlier in the same commands array - never invent a ref that does not exist. If the user asks for something you cannot safely or confidently do, explain why in the reply and return an empty commands array instead of guessing.
Layout and routing quality matter a lot because every connection is drawn as a single straight track between two exact pin coordinates - there is no autorouter and nothing bends around parts. To keep the result readable: (1) when adding a part that connects to a specific pin of an existing IC, place that part\'s x/y close to that pin\'s absolute position (pin absolute position = component x/y plus the pin offset you gave it), not just clustered near the component center - this keeps the straight track short. (2) Never place a new footprint\'s body, or the straight line path between two pins you are about to CONNECT, on top of another existing component\'s body or pins. (3) When several existing pins share the same net (for example multiple grounds), do not wire them all to one central hub pin - instead chain them through whichever already-connected pin is physically nearest, so tracks run between neighbors instead of radiating long diagonals across the board. (4) Prefer arranging newly added parts in a single row or a small grid with clear spacing (at least the sum of both parts\' largest dimension) rather than scattering them at arbitrary angles around the IC.
Pin geometry accuracy matters even more for footprints you invent yourself (no datasheet was provided - you are recalling this from training data). Be conservative: (1) every pin x/y offset must stay within roughly the footprint outline\'s own half-width/half-height plus 1-2mm - never place a pin far outside the body you declared. (2) For any part with more than 8 pins (microcontrollers, connectors with many pins, relays with unusual mechanical pinouts), you very likely do not remember the exact real pin spacing precisely - use a simple, clearly-labelled generic pin arrangement (for example even pitch along the package edges) rather than inventing precise-looking but unverified numbers, and say so plainly in the reply and in a warning so the user knows to double check the real datasheet before manufacturing. Getting the general placement and net-level connectivity right matters more than fabricating false mechanical precision.';
	}

	private function chat_schema() {
		$move_schema = array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'type', 'ref', 'x', 'y' ),
			'properties'           => array(
				'type' => array( 'type' => 'string', 'enum' => array( 'MOVE_COMPONENT' ) ),
				'ref'  => array( 'type' => 'string' ),
				'x'    => array( 'type' => 'number' ),
				'y'    => array( 'type' => 'number' ),
			),
		);
		$delete_schema = array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'type', 'ref' ),
			'properties'           => array(
				'type' => array( 'type' => 'string', 'enum' => array( 'DELETE_COMPONENT' ) ),
				'ref'  => array( 'type' => 'string' ),
			),
		);
		$set_value_schema = array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'type', 'ref', 'value' ),
			'properties'           => array(
				'type'  => array( 'type' => 'string', 'enum' => array( 'SET_VALUE' ) ),
				'ref'   => array( 'type' => 'string' ),
				'value' => array( 'type' => 'string' ),
			),
		);
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'reply', 'commands' ),
			'properties'           => array(
				'reply'    => array( 'type' => 'string' ),
				'commands' => array(
					'type'  => 'array',
					'items' => array(
						'anyOf' => array(
							$this->footprint_command_schema(),
							$this->connect_command_schema( 'CONNECT' ),
							$this->connect_command_schema( 'DISCONNECT' ),
							$move_schema,
							$delete_schema,
							$set_value_schema,
						),
					),
				),
			),
		);
	}

	private function extract_output_text( $data ) {
		if ( isset( $data['output_text'] ) && is_string( $data['output_text'] ) ) {
			return $data['output_text'];
		}
		if ( empty( $data['output'] ) || ! is_array( $data['output'] ) ) {
			return '';
		}
		foreach ( $data['output'] as $item ) {
			if ( empty( $item['content'] ) || ! is_array( $item['content'] ) ) {
				continue;
			}
			foreach ( $item['content'] as $content ) {
				if ( isset( $content['text'] ) && is_string( $content['text'] ) ) {
					return $content['text'];
				}
			}
		}
		return '';
	}

	private function sanitize_footprint_command( $command, $side, $x, $y, $board_width, $board_height ) {
		// Gioi han vi tri chan theo kich thuoc outline AI da khai bao (neu co), de
		// bat loi khi AI "nho nham" toa do chan lech qua xa so voi than linh kien
		// (vi du IC nhieu chan/relay). Khong the sua het loi noi dung, nhung tranh
		// duoc truong hop chan bay hoan toan ra ngoai than linh kien.
		$outline_hint = is_array( $command['outline'] ?? null ) ? $command['outline'] : array();
		$outline_span = max( (float) ( $outline_hint['width'] ?? 0 ), (float) ( $outline_hint['height'] ?? 0 ) );
		$pin_limit = $outline_span > 0 ? max( 12, min( 150, $outline_span * 1.5 ) ) : 60;

		$pins = array();
		if ( ! empty( $command['pins'] ) && is_array( $command['pins'] ) ) {
			foreach ( array_slice( $command['pins'], 0, 128 ) as $pin ) {
				if ( ! is_array( $pin ) ) {
					continue;
				}
				$pins[] = array(
					'number'   => sanitize_text_field( (string) ( $pin['number'] ?? '' ) ),
					'name'     => sanitize_text_field( (string) ( $pin['name'] ?? '' ) ),
					'x'        => max( -$pin_limit, min( $pin_limit, (float) ( $pin['x'] ?? 0 ) ) ),
					'y'        => max( -$pin_limit, min( $pin_limit, (float) ( $pin['y'] ?? 0 ) ) ),
					'shape'    => in_array( $pin['shape'] ?? '', array( 'round', 'rect', 'oval' ), true ) ? $pin['shape'] : 'round',
					'width'    => max( 0.15, min( 10, (float) ( $pin['width'] ?? 1.6 ) ) ),
					'height'   => max( 0.15, min( 10, (float) ( $pin['height'] ?? 1.6 ) ) ),
					'diameter' => max( 0.15, min( 10, (float) ( $pin['diameter'] ?? 1.6 ) ) ),
					'drill'    => max( 0, min( 10, (float) ( $pin['drill'] ?? 0.8 ) ) ),
					'smd'      => ! empty( $pin['smd'] ),
					'rotation' => max( -360, min( 360, (float) ( $pin['rotation'] ?? 0 ) ) ),
					'suppress_pin_name' => ! empty( $pin['suppress_pin_name'] ),
				);
			}
		}
		if ( empty( $pins ) ) {
			return null;
		}
		$outline = $outline_hint;
		$silk = array();
		if ( ! empty( $command['silk'] ) && is_array( $command['silk'] ) ) {
			foreach ( array_slice( $command['silk'], 0, 64 ) as $line ) {
				if ( ! is_array( $line ) ) {
					continue;
				}
				$silk[] = array(
					'x1'    => max( -200, min( 200, (float) ( $line['x1'] ?? 0 ) ) ),
					'y1'    => max( -200, min( 200, (float) ( $line['y1'] ?? 0 ) ) ),
					'x2'    => max( -200, min( 200, (float) ( $line['x2'] ?? 0 ) ) ),
					'y2'    => max( -200, min( 200, (float) ( $line['y2'] ?? 0 ) ) ),
					'width' => max( 0.05, min( 1, (float) ( $line['width'] ?? 0.12 ) ) ),
				);
			}
		}
		$clean_command = array(
			'type'      => 'ADD_FOOTPRINT',
			'ref'       => sanitize_text_field( (string) ( $command['ref'] ?? 'U1' ) ),
			'component' => sanitize_text_field( (string) ( $command['component'] ?? '' ) ),
			'value'     => sanitize_text_field( (string) ( $command['value'] ?? '' ) ),
			'package'   => sanitize_text_field( (string) ( $command['package'] ?? '' ) ),
			'side'      => 'bottom' === ( $command['side'] ?? $side ) ? 'bottom' : 'top',
			'x'         => max( 0, min( $board_width, (float) ( $command['x'] ?? $x ) ) ),
			'y'         => max( 0, min( $board_height, (float) ( $command['y'] ?? $y ) ) ),
			'outline'   => array(
				'width'  => max( 0, min( 200, (float) ( $outline['width'] ?? 0 ) ) ),
				'height' => max( 0, min( 200, (float) ( $outline['height'] ?? 0 ) ) ),
			),
			'pins'      => $pins,
		);
		if ( ! empty( $silk ) ) {
			$clean_command['silk'] = $silk;
		}
		return $clean_command;
	}

	private function sanitize_plan( $plan, $side, $x, $y, $board_width, $board_height ) {
		$out = array(
			'version'  => 'component-plan-1',
			'warnings' => array(),
			'commands' => array(),
		);
		if ( ! empty( $plan['warnings'] ) && is_array( $plan['warnings'] ) ) {
			foreach ( $plan['warnings'] as $warning ) {
				$out['warnings'][] = sanitize_text_field( (string) $warning );
			}
		}
		if ( empty( $plan['commands'] ) || ! is_array( $plan['commands'] ) ) {
			return $out;
		}
		$known_pins = array();
		foreach ( $plan['commands'] as $command ) {
			if ( ! is_array( $command ) ) {
				continue;
			}
			if ( 'CONNECT' === ( $command['type'] ?? '' ) ) {
				$from = sanitize_text_field( (string) ( $command['from'] ?? '' ) );
				$to   = sanitize_text_field( (string) ( $command['to'] ?? '' ) );
				if ( '' === $from || '' === $to || ! isset( $known_pins[ $from ] ) || ! isset( $known_pins[ $to ] ) ) {
					continue;
				}
				if ( count( $out['commands'] ) >= 400 ) {
					continue;
				}
				$out['commands'][] = array(
					'type' => 'CONNECT',
					'from' => $from,
					'to'   => $to,
				);
				continue;
			}
			if ( 'ADD_FOOTPRINT' !== ( $command['type'] ?? '' ) ) {
				continue;
			}
			$clean_command = $this->sanitize_footprint_command( $command, $side, $x, $y, $board_width, $board_height );
			if ( ! $clean_command ) {
				continue;
			}
			foreach ( $clean_command['pins'] as $pin ) {
				$known_pins[ $clean_command['ref'] . '.' . $pin['number'] ] = true;
			}
			$out['commands'][] = $clean_command;
		}
		return $out;
	}

	private function sanitize_chat_response( $plan, $side, $x, $y, $board_width, $board_height, $known_refs ) {
		$out = array( 'reply' => '', 'commands' => array() );
		if ( isset( $plan['reply'] ) ) {
			$out['reply'] = sanitize_textarea_field( (string) $plan['reply'] );
		}
		if ( empty( $plan['commands'] ) || ! is_array( $plan['commands'] ) ) {
			return $out;
		}
		$local_refs = is_array( $known_refs ) ? $known_refs : array();
		$known_pins = array();
		foreach ( $plan['commands'] as $command ) {
			if ( ! is_array( $command ) || count( $out['commands'] ) >= 200 ) {
				continue;
			}
			$type = $command['type'] ?? '';
			if ( 'ADD_FOOTPRINT' === $type ) {
				$clean_command = $this->sanitize_footprint_command( $command, $side, $x, $y, $board_width, $board_height );
				if ( ! $clean_command ) {
					continue;
				}
				$local_refs[ $clean_command['ref'] ] = true;
				foreach ( $clean_command['pins'] as $pin ) {
					$known_pins[ $clean_command['ref'] . '.' . $pin['number'] ] = true;
				}
				$out['commands'][] = $clean_command;
			} elseif ( 'CONNECT' === $type || 'DISCONNECT' === $type ) {
				$from = sanitize_text_field( (string) ( $command['from'] ?? '' ) );
				$to   = sanitize_text_field( (string) ( $command['to'] ?? '' ) );
				if ( '' === $from || '' === $to ) {
					continue;
				}
				$from_ref = strtok( $from, '.' );
				$to_ref   = strtok( $to, '.' );
				if ( ! isset( $local_refs[ $from_ref ] ) || ! isset( $local_refs[ $to_ref ] ) ) {
					continue;
				}
				if ( 'CONNECT' === $type && ( ! isset( $known_pins[ $from ] ) || ! isset( $known_pins[ $to ] ) ) ) {
					// Cho phep noi toi chan cua linh kien da co san tu truoc (khong nam trong known_pins
					// vi server khong biet danh sach chan cua no), chi chan khi ca hai deu la linh kien
					// moi tao trong luot nay nhung sai so chan.
					$from_is_new = isset( $local_refs[ $from_ref ] ) && ! isset( $known_refs[ $from_ref ] );
					$to_is_new   = isset( $local_refs[ $to_ref ] ) && ! isset( $known_refs[ $to_ref ] );
					if ( ( $from_is_new && ! isset( $known_pins[ $from ] ) ) || ( $to_is_new && ! isset( $known_pins[ $to ] ) ) ) {
						continue;
					}
				}
				$out['commands'][] = array(
					'type' => $type,
					'from' => $from,
					'to'   => $to,
				);
			} elseif ( 'MOVE_COMPONENT' === $type ) {
				$ref = sanitize_text_field( (string) ( $command['ref'] ?? '' ) );
				if ( '' === $ref || ! isset( $known_refs[ $ref ] ) ) {
					continue;
				}
				$out['commands'][] = array(
					'type' => 'MOVE_COMPONENT',
					'ref'  => $ref,
					'x'    => max( 0, min( $board_width, (float) ( $command['x'] ?? 0 ) ) ),
					'y'    => max( 0, min( $board_height, (float) ( $command['y'] ?? 0 ) ) ),
				);
			} elseif ( 'DELETE_COMPONENT' === $type ) {
				$ref = sanitize_text_field( (string) ( $command['ref'] ?? '' ) );
				if ( '' === $ref || ! isset( $known_refs[ $ref ] ) ) {
					continue;
				}
				$out['commands'][] = array( 'type' => 'DELETE_COMPONENT', 'ref' => $ref );
			} elseif ( 'SET_VALUE' === $type ) {
				$ref = sanitize_text_field( (string) ( $command['ref'] ?? '' ) );
				if ( '' === $ref || ! isset( $known_refs[ $ref ] ) ) {
					continue;
				}
				$out['commands'][] = array(
					'type'  => 'SET_VALUE',
					'ref'   => $ref,
					'value' => sanitize_text_field( (string) ( $command['value'] ?? '' ) ),
				);
			}
		}
		return $out;
	}
}
