<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class DAT_PCB_AI {
	const OPTION_API_KEY     = 'dat_pcb_tracer_openai_api_key';
	const OPTION_MODEL       = 'dat_pcb_tracer_openai_model';
	const OPTION_WEB_SEARCH  = 'dat_pcb_tracer_openai_web_search';
	const OPTION_MODEL_FIXED = 'dat_pcb_tracer_openai_model_upgraded';
	const OPTION_DEBUG       = 'dat_pcb_tracer_openai_debug';
	const OPTION_LAST_LOG    = 'dat_pcb_tracer_openai_last_log';

	// Gom cac luot goi API cua request nay lai de ghi log mot the.
	private $last_exchange = '';

	// Client LCSC dung lai trong ca request, va ghi chu ve linh kien nao lay duoc
	// footprint that de bao lai cho nguoi dung.
	private $lcsc       = null;
	private $lcsc_notes = array();

	// Dong gpt-5.6 vua suy luan tot hon han gpt-4.x vua ho tro built-in tool
	// web_search, nen AI co the tu tra datasheet/pinout thay vi doan tu tri nho.
	const DEFAULT_MODEL = 'gpt-5.6';

	// Cac model doi cu khong chay duoc web_search. Nang cap mot lan duy nhat cho
	// nhung ban cai da luu 'gpt-4.1' tu truoc, sau do nguoi dung van doi tu do.
	const LEGACY_MODELS = array( 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo' );

	// Web search + suy luan lam mot luot goi lau hon han truoc day.
	const REQUEST_TIMEOUT = 180;

	// Token suy luan cua gpt-5.x tinh chung vao max_output_tokens, va mot luot co
	// web_search con ton them cho ket qua tim kiem, nen can du cho de model kip in
	// ra JSON sau khi da suy luan va tra cuu xong.
	const MAX_OUTPUT_TOKENS = 24000;

	// Muc suy luan cua gpt-5.x. De mac dinh (medium) thi model an het han muc 24k
	// token cho phan suy luan roi tra ve status "incomplete" khong kem mot chu
	// output nao - van bi tinh tien day du. Dien mot footprint theo schema khong
	// can suy luan sau, nen 'low' vua ra duoc ket qua vua cat phan lon chi phi.
	const REASONING_EFFORT = 'low';

	public function get_model() {
		$model = get_option( self::OPTION_MODEL, '' );
		$model = is_string( $model ) ? trim( $model ) : '';
		if ( '' === $model ) {
			return self::DEFAULT_MODEL;
		}
		if ( ! get_option( self::OPTION_MODEL_FIXED ) && in_array( $model, self::LEGACY_MODELS, true ) ) {
			update_option( self::OPTION_MODEL_FIXED, 1, false );
			update_option( self::OPTION_MODEL, self::DEFAULT_MODEL, false );
			return self::DEFAULT_MODEL;
		}
		return $model;
	}

	public function web_search_enabled() {
		// Mac dinh TAT. Mot luot co web_search tren gpt-5.x doi model tim vai vong
		// roi doc het ket qua, phan lon han muc token di vao do va khong con cho de
		// in JSON - luot goi ve tay khong nhung van bi tinh tien. Ai can tra
		// datasheet la that thi bat len trong trang cai dat.
		return '1' === (string) get_option( self::OPTION_WEB_SEARCH, '0' );
	}

	public function debug_enabled() {
		return '1' === (string) get_option( self::OPTION_DEBUG, '0' );
	}

	public function get_debug_log() {
		$log = get_option( self::OPTION_LAST_LOG, '' );
		return is_string( $log ) ? $log : '';
	}

	public function clear_debug_log() {
		delete_option( self::OPTION_LAST_LOG );
	}

	public function has_api_key() {
		return '' !== $this->get_api_key();
	}

	public function update_settings( $api_key, $model, $clear_key = false, $web_search = null, $debug = null ) {
		if ( $clear_key ) {
			delete_option( self::OPTION_API_KEY );
		} elseif ( is_string( $api_key ) && '' !== trim( $api_key ) ) {
			update_option( self::OPTION_API_KEY, trim( $api_key ), false );
		}

		$model = sanitize_text_field( (string) $model );
		if ( '' !== $model ) {
			update_option( self::OPTION_MODEL, $model, false );
			// Nguoi dung da chu dong chon model -> khong tu doi giup nua.
			update_option( self::OPTION_MODEL_FIXED, 1, false );
		}

		if ( null !== $web_search ) {
			update_option( self::OPTION_WEB_SEARCH, $web_search ? '1' : '0', false );
		}

		if ( null !== $debug ) {
			update_option( self::OPTION_DEBUG, $debug ? '1' : '0', false );
		}
	}

	/**
	 * Ghi lai luot goi gan nhat de xem model that su tra ve gi.
	 *
	 * Chi bat khi can go loi: cat bo instructions/schema (dai va da biet truoc) va
	 * chi giu phan model sinh ra. Khong bao gio ghi API key.
	 */
	private function log_exchange( $body, $code, $raw, $data = array() ) {
		// Mot yeu cau co the goi API nhieu lan (thu lai khi tool bi tu choi) - giu
		// het cac luot de thay ro co bi tut ve che do khong web_search hay khong.
		$log = '=== ' . gmdate( 'Y-m-d H:i:s' ) . " UTC ===\n";
		$log .= 'model: ' . ( $body['model'] ?? '?' ) . '   web_search: ' . ( isset( $body['tools'] ) ? 'on' : 'off' ) . "   HTTP: {$code}\n";
		// Chi phi mot luot goi nam o day: token suy luan cua gpt-5.x tinh tien nhu
		// token output ke ca khi khong co lay mot chu tra ve.
		$log .= 'status: ' . ( $data['status'] ?? '?' )
			. ( isset( $data['incomplete_details']['reason'] ) ? ' (' . $data['incomplete_details']['reason'] . ')' : '' )
			. '   ' . $this->usage_summary( $data ) . "\n";

		$last_input = is_array( $body['input'] ?? null ) ? end( $body['input'] ) : null;
		if ( $last_input ) {
			$content = $last_input['content'] ?? '';
			$log .= "--- yeu cau cuoi ---\n" . mb_substr( is_string( $content ) ? $content : wp_json_encode( $content ), 0, 1500 ) . "\n";
		}
		$log .= "--- phan hoi tho ---\n" . mb_substr( (string) $raw, 0, 40000 ) . "\n";

		$this->last_exchange .= ( '' === $this->last_exchange ? '' : "\n" ) . $log;
		if ( $this->debug_enabled() ) {
			$this->persist_debug_log();
		}
	}

	/**
	 * So token cua mot luot goi, de nhin ra ngay luot nao dot tien ma khong ra gi.
	 */
	private function usage_summary( $data ) {
		$usage = is_array( $data['usage'] ?? null ) ? $data['usage'] : array();
		if ( empty( $usage ) ) {
			return 'khong co so lieu token';
		}
		return sprintf(
			'token vao %d, token ra %d (trong do %d token suy luan)',
			(int) ( $usage['input_tokens'] ?? 0 ),
			(int) ( $usage['output_tokens'] ?? 0 ),
			(int) ( $usage['output_tokens_details']['reasoning_tokens'] ?? 0 )
		);
	}

	/**
	 * Luu lai luot goi gan nhat. Goi ca khi nguoi dung chua bat go loi cho truong
	 * hop AI tra loi ma khong kem lenh nao - do la ca kho tim nhat, va bat nguoi
	 * dung bat go loi roi tai hien lai dung luc thi gan nhu khong bao gio bat duoc.
	 */
	private function persist_debug_log( $note = '' ) {
		if ( '' === $this->last_exchange ) {
			return;
		}
		update_option( self::OPTION_LAST_LOG, ( '' === $note ? '' : $note . "\n\n" ) . $this->last_exchange, false );
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

		$body = $this->build_request_body(
			array(
				'instructions' => $this->build_instructions(),
				'input'        => array(
					array(
						'role'    => 'user',
						'content' => $content,
					),
				),
				'text'         => array(
					'format' => array(
						'type'   => 'json_schema',
						'name'   => 'pcb_component_plan',
						'strict' => true,
						'schema' => $this->component_schema(),
					),
				),
			)
		);

		$plan = $this->request_plan( $api_key, $body );
		if ( is_wp_error( $plan ) ) {
			return $plan;
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

		$body = $this->build_request_body(
			array(
				'instructions' => $this->build_chat_instructions(),
				'input'        => $input,
				'text'         => array(
					'format' => array(
						'type'   => 'json_schema',
						'name'   => 'pcb_chat_response',
						'strict' => true,
						'schema' => $this->chat_schema(),
					),
				),
			)
		);

		$plan = $this->request_plan( $api_key, $body );
		if ( is_wp_error( $plan ) ) {
			return $plan;
		}
		if ( empty( $plan['commands'] ) && empty( $plan['new_parts'] ) ) {
			$this->persist_debug_log( 'AI tra loi nhung khong kem linh kien hay lenh nao.' );
		}
		return rest_ensure_response( $this->sanitize_chat_response( $plan, $side, $x, $y, $board_width, $board_height, $known_refs ) );
	}

	private function get_api_key() {
		$key = get_option( self::OPTION_API_KEY, '' );
		return is_string( $key ) ? trim( $key ) : '';
	}

	private function model_supports_web_search( $model ) {
		// Built-in tool web_search cua Responses API chay tu dong gpt-5.4 tro len.
		return (bool) preg_match( '~^gpt-5~i', (string) $model );
	}

	private function is_reasoning_model( $model ) {
		return (bool) preg_match( '~^gpt-5~i', (string) $model );
	}

	/**
	 * Gan model, han muc token va (neu model ho tro) tool web_search vao body -
	 * phan chung cua generate_component() va chat_message().
	 */
	private function build_request_body( $body ) {
		$model = $this->get_model();
		$body  = array_merge( array( 'model' => $model ), $body );
		$body['max_output_tokens'] = self::MAX_OUTPUT_TOKENS;

		if ( $this->is_reasoning_model( $model ) ) {
			$body['reasoning'] = array( 'effort' => self::REASONING_EFFORT );
			// Cau tra loi la JSON theo schema, khong can van ve dai dong: bot token
			// output = bot tien, va con cho JSON du cho de in het truoc gioi han.
			if ( isset( $body['text'] ) && is_array( $body['text'] ) ) {
				$body['text']['verbosity'] = 'low';
			}
		}

		if ( $this->web_search_enabled() && $this->model_supports_web_search( $model ) ) {
			$body['tools'] = array(
				array(
					'type'                => 'web_search',
					'search_context_size' => 'medium',
				),
			);
			$body['tool_choice'] = 'auto';
		}

		return $body;
	}

	/**
	 * Goi Responses API va tra ve plan da decode. Neu luot goi co web_search that
	 * bai, thu lai dung mot lan voi body khong co tool: bao ve ca truong hop API
	 * tu choi body (400 - tai khoan/model khong ho tro web_search) lan truong hop
	 * model mai tim kiem roi tra ve van ban thay vi JSON dung schema. Nguoi dung
	 * van chat duoc nhu truoc thay vi nhan loi thang.
	 */
	private function request_plan( $api_key, $body ) {
		$plan = $this->post_and_decode( $api_key, $body );
		$code = is_wp_error( $plan ) ? $plan->get_error_code() : '';

		// 400 = API tu choi body truoc khi chay model, luot do khong tinh tien: thu
		// lai voi khai bao tool toi gian de con giu kha nang tra datasheet, thay vi
		// im lang tut ve che do khong tra cuu duoc gi.
		if ( 'dat_pcb_ai_api_rejected' === $code && isset( $body['tools'] ) ) {
			$body['tools'] = array( array( 'type' => 'web_search' ) );
			$plan = $this->post_and_decode( $api_key, $body );
			$code = is_wp_error( $plan ) ? $plan->get_error_code() : '';
		}

		// Bo han web_search. Truong hop model that su chay roi moi hong (mai tim
		// kiem roi tra van ban thay vi JSON) chi duoc thu lai dung mot lan: moi luot
		// goi deu bi tinh tien ca phan suy luan, ke ca khi khong tra ve chu nao.
		if ( in_array( $code, array( 'dat_pcb_ai_api_rejected', 'dat_pcb_ai_invalid_json' ), true ) && isset( $body['tools'] ) ) {
			unset( $body['tools'], $body['tool_choice'] );
			$plan = $this->post_and_decode( $api_key, $body );
		}

		if ( is_wp_error( $plan ) && 'dat_pcb_ai_api_rejected' === $plan->get_error_code() ) {
			return new WP_Error( 'dat_pcb_ai_api_error', $plan->get_error_message(), array( 'status' => 502 ) );
		}
		return $plan;
	}

	private function post_and_decode( $api_key, $body ) {
		$data = $this->post_openai( $api_key, $body );
		return is_wp_error( $data ) ? $data : $this->decode_plan( $data );
	}

	private function post_openai( $api_key, $body ) {
		$response = wp_remote_post(
			'https://api.openai.com/v1/responses',
			array(
				'timeout' => self::REQUEST_TIMEOUT,
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
		$this->log_exchange( $body, $code, $raw, is_array( $data ) ? $data : array() );
		if ( $code < 200 || $code >= 300 ) {
			$message = isset( $data['error']['message'] ) ? $data['error']['message'] : 'OpenAI API error.';
			$code_id = 400 === (int) $code ? 'dat_pcb_ai_api_rejected' : 'dat_pcb_ai_api_error';
			return new WP_Error( $code_id, sanitize_text_field( $message ), array( 'status' => 502 ) );
		}
		if ( ! is_array( $data ) ) {
			return new WP_Error( 'dat_pcb_ai_invalid_json', 'OpenAI khong tra ve JSON hop le.', array( 'status' => 502 ) );
		}
		return $data;
	}

	/**
	 * Cat JSON cut ve phan tu cuoi cung con nguyen ven roi dong lai.
	 *
	 * Model co the lap mot lenh hang tram lan roi cut giua chung khi het han muc
	 * token. Vut ca cau tra loi di thi nguoi dung khong duoc gi, trong khi phan
	 * dau thuong van dung - giu lai duoc bao nhieu hay bay nhieu.
	 */
	private function repair_truncated_json( $text ) {
		$in_string = false;
		$escaped   = false;
		$depth     = 0;
		$last_safe = -1;
		$length    = strlen( $text );

		for ( $i = 0; $i < $length; $i++ ) {
			$char = $text[ $i ];
			if ( $in_string ) {
				if ( $escaped ) {
					$escaped = false;
				} elseif ( '\\' === $char ) {
					$escaped = true;
				} elseif ( '"' === $char ) {
					$in_string = false;
				}
				continue;
			}
			if ( '"' === $char ) {
				$in_string = true;
			} elseif ( '{' === $char || '[' === $char ) {
				$depth++;
			} elseif ( '}' === $char || ']' === $char ) {
				$depth--;
				// Do sau 2 = vua dong xong mot phan tu cua mang "commands".
				if ( 2 === $depth ) {
					$last_safe = $i;
				}
			}
		}

		if ( $last_safe < 0 ) {
			return null;
		}
		$plan = json_decode( substr( $text, 0, $last_safe + 1 ) . ']}', true );
		return is_array( $plan ) ? $plan : null;
	}

	private function decode_plan( $data ) {
		$text = $this->extract_output_text( $data );
		$plan = json_decode( $text, true );
		if ( is_array( $plan ) ) {
			return $plan;
		}
		$salvaged = $this->repair_truncated_json( $text );
		if ( null !== $salvaged ) {
			return $salvaged;
		}
		$refusal = $this->extract_refusal( $data );
		if ( '' !== $refusal ) {
			return new WP_Error( 'dat_pcb_ai_refused', sanitize_text_field( $refusal ), array( 'status' => 502 ) );
		}

		// Luot goi khong hoan tat, hoac hoan tat ma khong co lay mot chu output:
		// gan nhu luon la token suy luan (va ket qua web_search) an het han muc
		// truoc khi model kip in JSON. Luot nay van bi tinh tien du, va thu lai y
		// het thi chi mat tien them, nen bao thang va giu log de con xem lai.
		$incomplete = 'completed' !== ( $data['status'] ?? 'completed' );
		if ( $incomplete || '' === trim( (string) $text ) ) {
			$this->persist_debug_log( 'AI khong tra ve noi dung nao (' . $this->usage_summary( $data ) . '). Luot goi nay van bi tinh tien.' );
			return new WP_Error(
				'dat_pcb_ai_truncated',
				'AI dung het han muc token cho phan suy luan truoc khi kip tra ket qua (luot goi nay van bi tinh tien). Hay tat "Tra cuu Internet" trong DAT PCB Tracer - OpenAI, hoac chia yeu cau thanh tung phan nho hon.',
				array( 'status' => 502 )
			);
		}
		return new WP_Error( 'dat_pcb_ai_invalid_json', 'OpenAI khong tra ve JSON hop le.', array( 'status' => 502 ) );
	}

	private function extract_refusal( $data ) {
		foreach ( ( is_array( $data['output'] ?? null ) ? $data['output'] : array() ) as $item ) {
			foreach ( ( is_array( $item['content'] ?? null ) ? $item['content'] : array() ) as $content ) {
				if ( 'refusal' === ( $content['type'] ?? '' ) && ! empty( $content['refusal'] ) ) {
					return (string) $content['refusal'];
				}
			}
		}
		return '';
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
		// GND noi qua U1.6 (tab lon), khong phai U1.3 (chan GND nho giua hang chan)
		// - tab la diem noi dat/nhiet uu tien cho linh kien cong suat chuyen mach
		// nay, va truoc day day chinh la noi ca 3 duong nay vo tinh roi vao do (do
		// loi trung so chan da sua o template_lm2596()) - gio ghi ro chu dich thay
		// vi trung so an may.
		$connects = array(
			array( 'type' => 'CONNECT', 'from' => 'U1.1', 'to' => 'C1.1' ),
			array( 'type' => 'CONNECT', 'from' => 'C1.2', 'to' => 'D1.A' ),
			array( 'type' => 'CONNECT', 'from' => 'D1.A', 'to' => 'U1.6' ),
			array( 'type' => 'CONNECT', 'from' => 'U1.6', 'to' => 'C2.2' ),
			array( 'type' => 'CONNECT', 'from' => 'C2.2', 'to' => 'R1.2' ),
			array( 'type' => 'CONNECT', 'from' => 'U1.2', 'to' => 'L1.1' ),
			array( 'type' => 'CONNECT', 'from' => 'U1.2', 'to' => 'D1.K' ),
			array( 'type' => 'CONNECT', 'from' => 'L1.2', 'to' => 'C2.1' ),
			array( 'type' => 'CONNECT', 'from' => 'L1.2', 'to' => 'R2.1' ),
			array( 'type' => 'CONNECT', 'from' => 'U1.4', 'to' => 'R2.2' ),
			array( 'type' => 'CONNECT', 'from' => 'U1.4', 'to' => 'R1.1' ),
			array( 'type' => 'CONNECT', 'from' => 'U1.5', 'to' => 'U1.6' ),
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
		// Tu dien hoa CO PHAN CUC - vet cat goc dung chung cho moi template chi
		// danh dau "chan 1", khong ro rang bang dau "+" quy uoc that su nguoi lap
		// mach quen thuoc hon. Ve them dau + ben canh chan duong (chan 1), giong
		// het cach da lam voi in lua that tu thu vien LCSC.
		$plus_x = -$half - 1.1;
		$plus = array(
			array( 'x1' => $plus_x - 0.35, 'y1' => 0, 'x2' => $plus_x + 0.35, 'y2' => 0, 'width' => 0.15 ),
			array( 'x1' => $plus_x, 'y1' => -0.35, 'x2' => $plus_x, 'y2' => 0.35, 'width' => 0.15 ),
		);
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
			array_merge( $this->silk_rectangle( $diameter, $diameter ), $plus ),
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
				// So chan RIENG cho tab, khong trung voi chan 2 - trung so se lam
				// findPin()/localPins gap that thuong nham lan tab voi chan nho (xem
				// ghi chu dai o template_to252_3() ben duoi).
				$this->pin( '4', $names[1] ? $names[1] . '/TAB' : 'TAB', 0.00, -2.25, 'rect', 3.80, 2.80, 0, true, false ),
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
				// So chan RIENG cho tab (khong trung '2') - xem giai thich day du o
				// duoi: pin trung so lam findPin()/localPins tra ve hai vi tri VAT
				// LY khac nhau tuy CONNECT chay cung luot hay luot sau voi luc them
				// linh kien, khong doan truoc duoc - day chinh la nguyen nhan cac
				// duong noi toi "chan GND" bi bay lung tung, khong phai loi nguoi
				// dung dat sai lenh.
				$this->pin( '4', $names[1] ? $names[1] . '/TAB' : 'TAB', 0.00, -2.15, 'rect', 5.80, 5.00, 0, true, false ),
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
				$this->pin( '4', 'TAB', 0.00, -2.10, 'rect', 10.40, 8.40, 0, true, false ),
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
				// Pin 6, khong phai '3' trung voi chan GND nho o tren - xem ghi chu
				// day du o template_to252_3(). known_circuit_plan() da duoc sua de
				// tro thang vao U1.6 (tab) cho ca 3 duong noi GND, giu dung y do
				// dien/nhiet ban dau (noi GND qua tab, khong phai chan nho) nhung
				// gio la chu dich ro rang thay vi trung so an may.
				$this->pin( '6', 'TAB/GND', 0.00, -2.10, 'rect', 10.40, 8.40, 0, true, false ),
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

	/**
	 * Doan huong dan ve viec tra cuu, dung chung cho ca hai prompt de khong bao gio
	 * noi voi model mot dang khi tool web_search dang bat va mot dang khi tat.
	 */
	private function research_instructions() {
		if ( ! ( $this->web_search_enabled() && $this->model_supports_web_search( $this->get_model() ) ) ) {
			return 'RESEARCH. You cannot browse the web here; you only have your training data plus any datasheet PDF the user attached to this message. Never imply you looked something up or read "the official datasheet" unless a PDF really was attached. Not being able to check is not a reason to place nothing: still emit the footprint from memory, say plainly in the reply that you could not verify it, add a warning, and suggest attaching the datasheet PDF. Return an empty commands array only for a genuinely impossible or unsafe request, never merely because you are unsure of a footprint.';
		}

		return 'RESEARCH. Use the web_search tool before committing to a pin layout you are not sure of: any unfamiliar IC, module, connector, or anything over 8 pins. Search the exact part number with "datasheet pinout package dimensions", prefer the manufacturer PDF, and take pitch and lead span from what you actually read. Skip the search only for trivially standard parts or when the user attached a datasheet, which always wins. Name the part number and the source in the reply. If the search did not run or found nothing useful, do not cite a URL and say the numbers come from memory - but still place the part, with a warning, because an unverified footprint the user can check beats an empty board. Return an empty commands array only for a genuinely impossible or unsafe request, never merely because you are unsure of a footprint.';
	}

	/**
	 * Hop dong ve hinh hoc chan, dung chung cho ca hai prompt.
	 */
	/**
	 * Bat AI tra cuu so do mach tham khao that (typical application circuit trong
	 * datasheet) cho mach quanh mot IC cu the, thay vi tu bia linh kien phu + gia
	 * tri + cach noi hoan toan tu tri nho khi khong khop mach mau cuc bo nao
	 * (hien tai chi co LM2596 la co mach mau viet cung - xem known_circuit_plan()).
	 */
	private function circuit_design_instructions() {
		if ( ! ( $this->web_search_enabled() && $this->model_supports_web_search( $this->get_model() ) ) ) {
			return 'CIRCUITS. When asked for a whole circuit or module around a specific part, not just that bare part, you cannot verify a reference design here - build the most common textbook topology for that part family from memory, say plainly in the reply and in a warning that the supporting values and wiring are unverified, and still place and wire everything. An unverified circuit the user can check beats an empty board.';
		}
		return 'CIRCUITS. When asked for a whole circuit or module around a specific part, not just that bare part, search for the manufacturer\'s own typical application / reference design in its datasheet before choosing supporting parts and wiring - search "<part number> datasheet typical application circuit". Take the supporting components, their values (feedback resistors, decoupling and bulk capacitors, inductor and diode ratings) and the connections from what you actually read there, and name the reference in the reply. If the search does not run or finds nothing useful, fall back to the most common textbook topology for that part family from memory, say plainly in the reply and in a warning that it is unverified, and still place and wire it - the same rule as for footprints: an unverified circuit the user can check beats an empty board.';
	}

	private function footprint_geometry_instructions() {
		return 'FOOTPRINTS. You never write pin coordinates. Describe the package and the server computes every pin, applies datasheet numbering (pin 1 top left, counter-clockwise), centres the part on its origin, and keeps pads from touching. Give family, pin_count, pitch, and row_spacing - the lead span measured pad centre to pad centre, NOT the plastic body width - and leave any number you do not know as 0 to take the family default. Put pin function names in pin_names from pin 1, or an empty array if you do not know them. Always fill "package" with the real package name like "TSSOP-20" or "LQFP-32", which the server falls back on if the numbers are unusable. For an irregular part with no matching family, pick the closest one and say so in the reply - an approximate footprint the user can correct beats an empty board.';
	}

	private function build_instructions() {
		return 'You generate PCB footprints for a browser PCB editor. Return only JSON matching the schema, in millimetres. Put every part in "new_parts" - that is the only way to place a footprint. If the user asks for a whole circuit or module rather than one bare part, list every component (IC, passives, connectors) in "new_parts" with non-overlapping x/y around the insertion point, then wire them in "commands" with CONNECT using "REF.PIN" strings such as {"type":"CONNECT","from":"U1.1","to":"C1.1"}. Every ref in a CONNECT must be one you listed in new_parts. Do not invent connections you are not confident about, and put anything the user should double-check into "warnings".' . "\n" . $this->circuit_design_instructions() . "\n" . $this->footprint_geometry_instructions() . "\n" . $this->research_instructions();
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

	/**
	 * Mo ta mot linh kien moi - phang hoan toan, khong object long nhau.
	 *
	 * Truoc day day la mot nhanh cua anyOf 6 nhanh trong mang "commands", va no la
	 * nhanh to nhat: 12 truong bat buoc, mot object "layout" long ben trong, cong
	 * mot mang "pins" toan object 12 truong. Log that cho thay model lap di lap lai
	 * 5 nhanh nho con lai va khong mot lan nao chon nhanh nay. Tach ra thanh mang
	 * rieng chi co mot dang duy nhat thi model khong con phai chon nhanh nua.
	 */
	private function footprint_spec_schema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'ref', 'component', 'value', 'package', 'side', 'x', 'y', 'family', 'pin_count', 'pitch', 'row_spacing', 'rows', 'body_width', 'body_height', 'pin_names' ),
			'properties'           => array(
				'ref'         => array( 'type' => 'string', 'description' => 'Reference designator, e.g. U1, R3, C2.' ),
				'component'   => array( 'type' => 'string', 'description' => 'Manufacturer part number, e.g. STM8S003F3P6.' ),
				'value'       => array( 'type' => 'string', 'description' => 'Label shown on the board, e.g. 10k, 100nF, STM8S003F3.' ),
				'package'     => array( 'type' => 'string', 'description' => 'Real package name, e.g. "TSSOP-20", "LQFP-32", "DIP-8". The server falls back on this if the numbers below are unusable, so always fill it.' ),
				'side'        => array( 'type' => 'string', 'enum' => array( 'top', 'bottom' ) ),
				'x'           => array( 'type' => 'number', 'description' => 'Position of the part centre in mm on the board. Use the cursor point given in the message unless there is a reason not to.' ),
				'y'           => array( 'type' => 'number', 'description' => 'Position of the part centre in mm. +y is DOWN.' ),
				'family'      => array(
					'type'        => 'string',
					'enum'        => array( 'dip', 'soic', 'qfp', 'qfn', 'header', 'chip', 'sot23', 'to220', 'radial', 'axial' ),
					'description' => 'dip = through-hole dual inline IC. soic = any two-row gull-wing SMD IC (SOIC/SOP/SSOP/TSSOP/MSOP). qfp = quad flat pack with leads. qfn = quad flat no-lead. header = through-hole pin header or screw terminal. chip = two-terminal SMD passive. sot23 = 3-lead small outline transistor. to220 = TO-220/TO-126 inline power package. radial = two-lead radial through-hole part. axial = two-lead axial through-hole part. Always pick the closest family - there is no "other".',
				),
				'pin_count'   => array( 'type' => 'integer', 'description' => 'Total electrical pins. Divisible by 4 for qfp/qfn, 3 for sot23, 2 for chip/radial/axial.' ),
				'pitch'       => array( 'type' => 'number', 'description' => 'Centre-to-centre distance in mm between two adjacent pins in a row (2.54 for DIP, 1.27 for SOIC, 0.65 for TSSOP, 0.5 for LQFP). 0 = use the family default.' ),
				'row_spacing' => array( 'type' => 'number', 'description' => 'Lead span in mm between the left and right pin rows, measured pad centre to pad centre - NOT the plastic body width. 0 = use the family default.' ),
				'rows'        => array( 'type' => 'integer', 'description' => 'header only: 1 or 2 rows. Use 1 for every other family.' ),
				'body_width'  => array( 'type' => 'number', 'description' => 'Plastic body width in mm for the outline. 0 = fit to the pins.' ),
				'body_height' => array( 'type' => 'number', 'description' => 'Plastic body height in mm for the outline. 0 = fit to the pins.' ),
				'pin_names'   => array(
					'type'        => 'array',
					'items'       => array( 'type' => 'string' ),
					'description' => 'Pin function names in pin-number order from pin 1, e.g. ["VSS","PA1","PA2"]. Empty string where unknown, or an empty array if you do not know the pinout. The server numbers the pins itself.',
				),
			),
		);
	}

	/**
	 * Dung lai lenh ADD_FOOTPRINT day du tu mo ta phang, de phan sinh chan va lam
	 * sach phia sau giu nguyen khong phai sua.
	 */
	/**
	 * Thu lay footprint that tu thu vien LCSC theo ma linh kien.
	 *
	 * Day la bac 1-2: so lieu do nha san xuat cong bo, chinh xac hon han bat cu
	 * thu gi AI dung lai tu ten ho package. That bai thi tra null va roi xuong
	 * bo sinh tham so nhu cu.
	 */
	private function lcsc_footprint( $mpn, $ref ) {
		$mpn = trim( (string) $mpn );
		if ( '' === $mpn || ! class_exists( 'DAT_PCB_LCSC' ) ) {
			return null;
		}
		if ( null === $this->lcsc ) {
			$this->lcsc = new DAT_PCB_LCSC();
		}
		$footprint = $this->lcsc->footprint_for_mpn( $mpn );
		if ( ! $footprint ) {
			return null;
		}

		$this->lcsc_notes[] = sprintf(
			'%s: dung footprint that tu thu vien LCSC (%s, %s).',
			sanitize_text_field( (string) $ref ),
			$footprint['lcsc'],
			'' !== $footprint['package'] ? $footprint['package'] : $mpn
		);
		foreach ( $footprint['warnings'] as $warning ) {
			$this->lcsc_notes[] = $warning;
		}
		return $footprint;
	}

	public function take_lcsc_notes() {
		$notes = array_values( array_unique( $this->lcsc_notes ) );
		$this->lcsc_notes = array();
		return $notes;
	}

	private function spec_to_footprint_command( $spec ) {
		if ( ! is_array( $spec ) ) {
			return null;
		}
		$real = $this->lcsc_footprint( $spec['component'] ?? '', $spec['ref'] ?? '?' );
		if ( $real ) {
			// Co so lieu that thi tat bo sinh tham so di: de family rong khien
			// pins_from_layout() tra null, va mang pins that duoc dung nguyen.
			$spec['family']      = '';
			$spec['pin_names']   = array();
			$spec['body_width']  = 0;
			$spec['body_height'] = 0;
		}
		$command = array(
			'type'      => 'ADD_FOOTPRINT',
			'ref'       => $spec['ref'] ?? 'U1',
			'component' => $spec['component'] ?? '',
			'value'     => $spec['value'] ?? '',
			'package'   => $real && '' !== $real['package'] ? $real['package'] : ( $spec['package'] ?? '' ),
			'side'      => $spec['side'] ?? 'top',
			'x'         => $spec['x'] ?? null,
			'y'         => $spec['y'] ?? null,
			'outline'   => $real ? $real['outline'] : array(),
			'pins'      => $real ? $real['pins'] : array(),
			// In lua that cua nha san xuat. Khi co no thi editor khong tu ve khung
			// bao quanh nua - EasyEDA khong he co khung do.
			'silk'      => $real ? $real['silk'] : array(),
			'layout'    => array(
				'family'      => $spec['family'] ?? '',
				'pin_count'   => $spec['pin_count'] ?? 0,
				'pitch'       => $spec['pitch'] ?? 0,
				'row_spacing' => $spec['row_spacing'] ?? 0,
				'rows'        => $spec['rows'] ?? 1,
				'body_width'  => $spec['body_width'] ?? 0,
				'body_height' => $spec['body_height'] ?? 0,
				'pin_names'   => is_array( $spec['pin_names'] ?? null ) ? $spec['pin_names'] : array(),
			),
		);
		return $command;
	}

	private function component_schema() {
		return array(
			'type'                 => 'object',
			'additionalProperties' => false,
			'required'             => array( 'version', 'warnings', 'new_parts', 'commands' ),
			'properties'           => array(
				'version'   => array( 'type' => 'string', 'enum' => array( 'component-plan-1' ) ),
				'warnings'  => array( 'type' => 'array', 'items' => array( 'type' => 'string' ) ),
				'new_parts' => array(
					'type'        => 'array',
					'items'       => $this->footprint_spec_schema(),
					'description' => 'Every part to place. This is the only way to add a footprint.',
				),
				'commands'  => array(
					'type'        => 'array',
					'items'       => $this->connect_command_schema(),
					'description' => 'Tracks between pins of the parts above. Empty array when there is nothing to wire.',
				),
			),
		);
	}

	private function build_chat_instructions() {
		return 'You are a PCB layout assistant inside a browser PCB editor. Each message gives the board size and a JSON list of components already placed. Answer with JSON: "reply" is one or two short sentences in the user\'s language, "new_parts" holds every part you are adding, and "commands" holds edits to parts that already exist. The reply text draws nothing by itself - if you say you added, moved or wired something, it must appear in new_parts or commands in the same response.
ADDING A PART goes in "new_parts" and nowhere else; there is no add command. When the user names a component, that is what they want, so put one entry in new_parts even if you are unsure of the exact pinout.
"commands" edits existing parts only: CONNECT and DISCONNECT ("REF.PIN" to "REF.PIN", a straight track between two pins), MOVE_COMPONENT (ref, x, y in mm), DELETE_COMPONENT (ref), SET_VALUE (ref, value). Only use a ref from the provided list or one you just put in new_parts. Never repeat a command, and never emit one that changes nothing such as connecting a pin to itself. A couple of commands is a normal answer; if you notice yourself writing the same command a second time, stop and close the array.
PLACEMENT. Every track is a straight line between two exact pins and there is no autorouter. Put a new part near the pin it connects to, never on top of another part, and chain a shared net through the nearest already-connected pin instead of radiating from one hub.
' . $this->circuit_design_instructions() . "\n" . $this->footprint_geometry_instructions() . "\n" . $this->research_instructions();
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
			'required'             => array( 'reply', 'new_parts', 'commands' ),
			'properties'           => array(
				'reply'     => array( 'type' => 'string' ),
				'new_parts' => array(
					'type'        => 'array',
					'items'       => $this->footprint_spec_schema(),
					'description' => 'Parts to add to the board. This is the ONLY way to place a new footprint - the commands array below cannot do it. Empty array when you are not adding anything.',
				),
				'commands'  => array(
					'type'        => 'array',
					'items'       => array(
						'anyOf' => array(
							$this->connect_command_schema( 'CONNECT' ),
							$this->connect_command_schema( 'DISCONNECT' ),
							$move_schema,
							$delete_schema,
							$set_value_schema,
						),
					),
					'description' => 'Edits to parts that already exist. Empty array when there is nothing to change.',
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
		// Khi bat web_search, mang output con chua ca item reasoning va
		// web_search_call - chi ghep phan output_text cua message cuoi cung,
		// neu khong se lay nham text khong phai JSON.
		$text = '';
		foreach ( $data['output'] as $item ) {
			if ( 'message' !== ( $item['type'] ?? 'message' ) || empty( $item['content'] ) || ! is_array( $item['content'] ) ) {
				continue;
			}
			$message_text = '';
			foreach ( $item['content'] as $content ) {
				if ( 'output_text' === ( $content['type'] ?? '' ) && isset( $content['text'] ) && is_string( $content['text'] ) ) {
					$message_text .= $content['text'];
				}
			}
			if ( '' !== $message_text ) {
				$text = $message_text;
			}
		}
		return $text;
	}

	// Ho toi thieu giua hai pad ke nhau. Pad rong hon pitch se dinh lien thanh mot
	// vet dong - dung loi nhin thay trong footprint SOP-20 AI tu dat toa do.
	const PAD_CLEARANCE = 0.2;

	/**
	 * Thong so mac dinh cho tung ho package, dung khi AI de 0 (= khong biet).
	 * 'shape' round -> pad tron (chan cam), rect -> pad chu nhat (chan dan SMD).
	 */
	/**
	 * Quy ten vo ve dung ho package. Model rat hay tra ten thuong dung ("tssop",
	 * "lqfp") thay vi ten ho trong enum, va truoc day mot chu lech la ca lenh bi
	 * bo im lang.
	 */
	private function normalize_family( $family ) {
		$family  = strtolower( trim( (string) $family ) );
		$aliases = array(
			'tssop' => 'soic', 'ssop' => 'soic', 'msop' => 'soic', 'sop' => 'soic', 'so' => 'soic', 'soj' => 'soic',
			'lqfp'  => 'qfp', 'tqfp' => 'qfp',
			'dfn'   => 'qfn', 'mlf' => 'qfn',
			'pdip'  => 'dip', 'sdip' => 'dip',
			'pinheader' => 'header', 'terminal' => 'header', 'screw' => 'header',
			'smd'   => 'chip', 'sot' => 'sot23', 'sot-23' => 'sot23',
			'to'    => 'to220', 'to-220' => 'to220',
		);
		return isset( $aliases[ $family ] ) ? $aliases[ $family ] : $family;
	}

	/**
	 * Doan mo ta package tu chuoi ten vo ("TSSOP-20", "LQFP32", "DIP-8").
	 *
	 * Dung khi model khong dien noi layout: ten vo van con trong lenh, va no du de
	 * dung footprint dung hon han viec khong ve gi ca. Giu lai moi so do model da
	 * cho, chi bu phan thieu.
	 */
	private function infer_layout_from_package( $package, $existing ) {
		$text     = strtoupper( (string) $package );
		$patterns = array(
			'~(?:TSSOP|SSOP|MSOP|SOIC|SOP)\s*-?\s*(\d+)~' => 'soic',
			'~(?:LQFP|TQFP|QFP)\s*-?\s*(\d+)~'            => 'qfp',
			'~(?:QFN|DFN|MLF)\s*-?\s*(\d+)~'              => 'qfn',
			'~(?:PDIP|SDIP|DIP)\s*-?\s*(\d+)~'            => 'dip',
		);
		$family = '';
		$count  = 0;
		foreach ( $patterns as $pattern => $candidate ) {
			if ( preg_match( $pattern, $text, $matches ) ) {
				$family = $candidate;
				$count  = (int) $matches[1];
				break;
			}
		}
		if ( '' === $family ) {
			if ( preg_match( '~SOT\s*-?\s*23~', $text ) ) {
				$family = 'sot23';
				$count  = 3;
			} elseif ( preg_match( '~TO\s*-?\s*(?:220|126)~', $text ) ) {
				$family = 'to220';
				$count  = 3;
			} elseif ( preg_match( '~(?:HEADER|TERMINAL|CONN)\D*(\d+)~', $text, $matches ) ) {
				$family = 'header';
				$count  = (int) $matches[1];
			} else {
				return null;
			}
		}

		$layout = is_array( $existing ) ? $existing : array();
		$layout['family'] = $family;
		if ( (int) ( $layout['pin_count'] ?? 0 ) < 1 ) {
			$layout['pin_count'] = $count;
		}
		return $layout;
	}

	private function layout_defaults( $family ) {
		$base = array(
			'pitch'          => 2.54,
			'row_spacing'    => 7.62,
			'column_spacing' => 0,
			'pad_long'       => 1.6,
			'pad_short'      => 1.6,
			'drill'          => 0.9,
			'smd'            => false,
			'shape'          => 'round',
		);
		$families = array(
			'dip'    => array(),
			'soic'   => array( 'pitch' => 1.27, 'row_spacing' => 5.4, 'pad_long' => 1.55, 'pad_short' => 0.6, 'drill' => 0, 'smd' => true, 'shape' => 'rect' ),
			'qfp'    => array( 'pitch' => 0.5, 'row_spacing' => 9.0, 'pad_long' => 1.5, 'pad_short' => 0.3, 'drill' => 0, 'smd' => true, 'shape' => 'rect' ),
			'qfn'    => array( 'pitch' => 0.5, 'row_spacing' => 4.0, 'pad_long' => 0.8, 'pad_short' => 0.3, 'drill' => 0, 'smd' => true, 'shape' => 'rect' ),
			'header' => array( 'row_spacing' => 2.54, 'pad_long' => 1.7, 'pad_short' => 1.7, 'drill' => 1.0 ),
			'chip'   => array( 'pitch' => 0, 'row_spacing' => 1.6, 'pad_long' => 1.0, 'pad_short' => 1.0, 'drill' => 0, 'smd' => true, 'shape' => 'rect' ),
			'sot23'  => array( 'pitch' => 0.95, 'row_spacing' => 2.4, 'pad_long' => 1.0, 'pad_short' => 0.7, 'drill' => 0, 'smd' => true, 'shape' => 'rect' ),
			'to220'  => array( 'row_spacing' => 0, 'pad_long' => 2.0, 'pad_short' => 2.0, 'drill' => 1.1 ),
			'radial' => array( 'pitch' => 0, 'row_spacing' => 5.0, 'pad_long' => 1.8, 'pad_short' => 1.8, 'drill' => 1.0 ),
			'axial'  => array( 'pitch' => 0, 'row_spacing' => 10.16, 'pad_long' => 1.8, 'pad_short' => 1.8, 'drill' => 0.9 ),
		);
		return isset( $families[ $family ] ) ? array_merge( $base, $families[ $family ] ) : null;
	}

	/**
	 * Gop thong so AI khai bao voi mac dinh cua ho package, roi ep ve mien hop le.
	 * Moi so AI de 0 deu duoc hieu la "khong biet, lay mac dinh".
	 */
	private function layout_spec( $layout ) {
		$family = $this->normalize_family( $layout['family'] ?? '' );
		$spec   = $this->layout_defaults( $family );
		if ( null === $spec ) {
			return null;
		}
		$spec['family'] = $family;

		foreach ( array( 'pitch', 'row_spacing', 'column_spacing', 'pad_long', 'pad_short', 'drill' ) as $key ) {
			$value = (float) ( $layout[ $key ] ?? 0 );
			if ( $value > 0 ) {
				$spec[ $key ] = min( 100, $value );
			}
		}
		if ( $spec['column_spacing'] <= 0 ) {
			$spec['column_spacing'] = $spec['row_spacing'];
		}

		// Pad khong duoc rong hon buoc chan, neu khong ca hang se dinh lien nhau.
		if ( $spec['pitch'] > 0 ) {
			$limit = max( 0.15, $spec['pitch'] - self::PAD_CLEARANCE );
			$spec['pad_short'] = min( $spec['pad_short'], $limit );
			if ( 'round' === $spec['shape'] ) {
				$spec['pad_long'] = min( $spec['pad_long'], $limit );
			}
		}

		// Hai hang doi dien cung khong duoc cham nhau: pad chi duoc vuon ra toi
		// gan nua khoang cach giua hai hang.
		$facing = 0;
		switch ( $spec['family'] ) {
			case 'dip':
			case 'soic':
			case 'sot23':
			case 'chip':
			case 'radial':
			case 'axial':
				$facing = $spec['row_spacing'];
				break;
			case 'qfp':
			case 'qfn':
				$facing = min( $spec['row_spacing'], $spec['column_spacing'] );
				break;
			case 'header':
				$facing = 2 === (int) ( $layout['rows'] ?? 1 ) ? $spec['row_spacing'] : 0;
				break;
		}
		if ( $facing > 0 ) {
			$limit = max( 0.15, $facing - self::PAD_CLEARANCE );
			$spec['pad_long'] = min( $spec['pad_long'], $limit );
			if ( 'round' === $spec['shape'] ) {
				$spec['pad_short'] = min( $spec['pad_short'], $limit );
			}
		}
		$spec['pad_long']  = max( 0.15, min( 10, $spec['pad_long'] ) );
		$spec['pad_short'] = max( 0.15, min( 10, $spec['pad_short'] ) );
		// Chan cam phai co lo, va lo phai nho hon pad.
		$spec['smd']   = ! empty( $spec['smd'] ) && $spec['drill'] <= 0;
		$spec['drill'] = $spec['smd'] ? 0 : max( 0.2, min( min( $spec['pad_long'], $spec['pad_short'] ) - 0.3, $spec['drill'] ) );

		return $spec;
	}

	private function layout_pin( $number, $names, $x, $y, $spec, $axis ) {
		$width  = 'x' === $axis ? $spec['pad_long'] : $spec['pad_short'];
		$height = 'x' === $axis ? $spec['pad_short'] : $spec['pad_long'];
		if ( 'round' === $spec['shape'] ) {
			$width  = max( $spec['pad_long'], $spec['pad_short'] );
			$height = $width;
		}
		$name = isset( $names[ $number - 1 ] ) ? sanitize_text_field( (string) $names[ $number - 1 ] ) : '';
		return $this->pin( (string) $number, $name, round( $x, 4 ), round( $y, 4 ), $spec['shape'], $width, $height, $spec['drill'], $spec['smd'], '' === $name );
	}

	/**
	 * Hai hang chan doi dien (DIP, SOIC/SOP/TSSOP).
	 *
	 * Dat theo dung cach EasyEDA ve: hai hang NGANG, chieu dai than chay theo truc
	 * x, chan 1 o goc duoi-trai roi chay sang phai, sang hang tren thi chay nguoc
	 * lai - van la nguoc chieu kim dong ho. Truoc day sinh ra hai cot doc, dung ve
	 * dien nhung xoay 90 do so voi footprint lay tu thu vien, nen cung mot con IC
	 * lai nam hai kieu khac nhau tuy co tim thay trong thu vien hay khong.
	 */
	private function dual_row_pins( $count, $spec, $names ) {
		$bottom = (int) ceil( $count / 2 );
		$top    = $count - $bottom;
		$left   = -( max( $bottom, $top ) - 1 ) * $spec['pitch'] / 2;
		$pins   = array();
		for ( $i = 0; $i < $bottom; $i++ ) {
			$pins[] = $this->layout_pin( $i + 1, $names, $left + $i * $spec['pitch'], $spec['row_spacing'] / 2, $spec, 'y' );
		}
		for ( $i = 0; $i < $top; $i++ ) {
			$pins[] = $this->layout_pin( $bottom + $i + 1, $names, $left + ( $top - 1 - $i ) * $spec['pitch'], -$spec['row_spacing'] / 2, $spec, 'y' );
		}
		return $pins;
	}

	/**
	 * Bon canh (QFP/LQFP/TQFP/QFN): chan 1 tren cung canh trai, chay nguoc chieu
	 * kim dong ho - trai xuong, day sang phai, phai len, tren sang trai.
	 */
	private function quad_pins( $count, $spec, $names ) {
		$per  = (int) ( $count / 4 );
		$off  = -( $per - 1 ) * $spec['pitch'] / 2;
		$half_x = $spec['row_spacing'] / 2;
		$half_y = $spec['column_spacing'] / 2;
		$pins = array();
		for ( $i = 0; $i < $per; $i++ ) {
			$pins[] = $this->layout_pin( $i + 1, $names, -$half_x, $off + $i * $spec['pitch'], $spec, 'x' );
		}
		for ( $i = 0; $i < $per; $i++ ) {
			$pins[] = $this->layout_pin( $per + $i + 1, $names, $off + $i * $spec['pitch'], $half_y, $spec, 'y' );
		}
		for ( $i = 0; $i < $per; $i++ ) {
			$pins[] = $this->layout_pin( 2 * $per + $i + 1, $names, $half_x, $off + ( $per - 1 - $i ) * $spec['pitch'], $spec, 'x' );
		}
		for ( $i = 0; $i < $per; $i++ ) {
			$pins[] = $this->layout_pin( 3 * $per + $i + 1, $names, $off + ( $per - 1 - $i ) * $spec['pitch'], -$half_y, $spec, 'y' );
		}
		return $pins;
	}

	/**
	 * Rao chan cam. Mot hang: danh so trai sang phai. Hai hang: chan le o hang
	 * tren, chan chan o hang duoi, xen ke theo tung cap - dung kieu rao IDC.
	 */
	private function header_pins( $count, $spec, $names, $rows ) {
		$pins = array();
		if ( 2 !== $rows ) {
			$left = -( $count - 1 ) * $spec['pitch'] / 2;
			for ( $i = 0; $i < $count; $i++ ) {
				$pins[] = $this->layout_pin( $i + 1, $names, $left + $i * $spec['pitch'], 0, $spec, 'x' );
			}
			return $pins;
		}
		$columns = (int) ceil( $count / 2 );
		$left    = -( $columns - 1 ) * $spec['pitch'] / 2;
		for ( $i = 0; $i < $count; $i++ ) {
			$column = (int) ( $i / 2 );
			$row_y  = 0 === $i % 2 ? -$spec['row_spacing'] / 2 : $spec['row_spacing'] / 2;
			$pins[] = $this->layout_pin( $i + 1, $names, $left + $column * $spec['pitch'], $row_y, $spec, 'x' );
		}
		return $pins;
	}

	private function inline_pins( $count, $spec, $names ) {
		$pitch = $spec['pitch'] > 0 ? $spec['pitch'] : $spec['row_spacing'];
		$left  = -( $count - 1 ) * $pitch / 2;
		$pins  = array();
		for ( $i = 0; $i < $count; $i++ ) {
			$pins[] = $this->layout_pin( $i + 1, $names, $left + $i * $pitch, 0, $spec, 'x' );
		}
		return $pins;
	}

	/**
	 * SOT-23: chan 1 va 2 o canh duoi, chan 3 mot minh o canh tren.
	 */
	private function sot23_pins( $spec, $names ) {
		return array(
			$this->layout_pin( 1, $names, -$spec['pitch'] / 2, $spec['row_spacing'] / 2, $spec, 'y' ),
			$this->layout_pin( 2, $names, $spec['pitch'] / 2, $spec['row_spacing'] / 2, $spec, 'y' ),
			$this->layout_pin( 3, $names, 0, -$spec['row_spacing'] / 2, $spec, 'y' ),
		);
	}

	/**
	 * Sinh toan bo chan tu mo ta package thay vi tin vao tung cap toa do AI bia ra.
	 *
	 * Ly do: model nho rat chac cac con so doc thang tu ban ve co khi cua datasheet
	 * ("TSSOP-20, pitch 0.65mm, be rong hang 5.85mm"), nhung khi phai tu tay liet ke
	 * 20 cap x/y thi gan nhu chac chan lech buoc chan, lech doi xung hoac de pad
	 * chong len nhau. Sinh bang code thi pitch luon dung, danh so luon theo quy uoc,
	 * pad khong bao gio dinh nhau, va ca cum luon can giua goc dat.
	 *
	 * Tra ve null neu mo ta khong dung duoc - luc do quay lai dung mang pins AI gui.
	 */
	private function pins_from_layout( $layout ) {
		if ( ! is_array( $layout ) ) {
			return null;
		}
		$spec = $this->layout_spec( $layout );
		if ( null === $spec ) {
			return null;
		}
		$count = (int) ( $layout['pin_count'] ?? 0 );
		if ( $count < 1 || $count > 128 ) {
			return null;
		}

		$names = array();
		if ( ! empty( $layout['pin_names'] ) && is_array( $layout['pin_names'] ) ) {
			$names = array_values( $layout['pin_names'] );
		}

		switch ( $spec['family'] ) {
			case 'dip':
			case 'soic':
				return $count >= 4 ? $this->dual_row_pins( $count, $spec, $names ) : $this->inline_pins( $count, $spec, $names );
			case 'qfp':
			case 'qfn':
				// QFP/QFN luon chia het cho 4; khong chia het la mo ta sai.
				return ( $count >= 8 && 0 === $count % 4 ) ? $this->quad_pins( $count, $spec, $names ) : null;
			case 'header':
				$rows = 2 === (int) ( $layout['rows'] ?? 1 ) ? 2 : 1;
				return $this->header_pins( $count, $spec, $names, $rows );
			case 'sot23':
				return 3 === $count ? $this->sot23_pins( $spec, $names ) : null;
			case 'chip':
			case 'radial':
			case 'axial':
				return 2 === $count ? $this->inline_pins( 2, $spec, $names ) : null;
			case 'to220':
				return $this->inline_pins( $count, $spec, $names );
		}
		return null;
	}

	/**
	 * Kich thuoc than linh kien cho footprint sinh tu mo ta package: uu tien so do
	 * AI doc duoc tu datasheet, thieu thi lay vua khit cum chan.
	 */
	private function layout_outline( $layout, $pins ) {
		$width  = min( 200, (float) ( $layout['body_width'] ?? 0 ) );
		$height = min( 200, (float) ( $layout['body_height'] ?? 0 ) );
		if ( $width > 0 && $height > 0 ) {
			return array( 'width' => $width, 'height' => $height );
		}
		$span_x = 0;
		$span_y = 0;
		foreach ( $pins as $pin ) {
			$half_w = ( 'round' === $pin['shape'] ? $pin['diameter'] : $pin['width'] ) / 2;
			$half_h = ( 'round' === $pin['shape'] ? $pin['diameter'] : $pin['height'] ) / 2;
			$span_x = max( $span_x, abs( $pin['x'] ) + $half_w );
			$span_y = max( $span_y, abs( $pin['y'] ) + $half_h );
		}
		return array(
			'width'  => $width > 0 ? $width : round( $span_x * 2, 3 ),
			'height' => $height > 0 ? $height : round( $span_y * 2, 3 ),
		);
	}

	private function sanitize_footprint_command( $command, $side, $x, $y, $board_width, $board_height ) {
		// Gioi han vi tri chan theo kich thuoc outline AI da khai bao (neu co), de
		// bat loi khi AI "nho nham" toa do chan lech qua xa so voi than linh kien
		// (vi du IC nhieu chan/relay). Khong the sua het loi noi dung, nhung tranh
		// duoc truong hop chan bay hoan toan ra ngoai than linh kien.
		$outline_hint = is_array( $command['outline'] ?? null ) ? $command['outline'] : array();

		// Uu tien mo ta package: chan sinh bang code luon dung buoc chan va dung
		// quy uoc danh so, nen khong can kep lai theo outline nhu chan AI tu dat.
		$layout    = is_array( $command['layout'] ?? null ) ? $command['layout'] : null;
		$generated = $this->pins_from_layout( $layout );
		$hand_pins = is_array( $command['pins'] ?? null ) ? $command['pins'] : array();

		// Model thuong de trong ca hai: layout khong dung duoc VA pins rong (vi da
		// duoc dan la dung tu liet ke chan). Truoc day ca lenh bi bo im lang trong
		// khi cau tra loi van khoe "da tao xong". Ten vo van con trong lenh nen
		// dung no dung footprint - sai chut van hon khong ve gi.
		if ( null === $generated && empty( $hand_pins ) ) {
			$inferred = $this->infer_layout_from_package( $command['package'] ?? '', $layout );
			if ( null === $inferred ) {
				$inferred = $this->infer_layout_from_package( $command['component'] ?? '', $layout );
			}
			$generated = $this->pins_from_layout( $inferred );
			if ( null !== $generated ) {
				$layout = $inferred;
			}
		}

		$raw_pins = null !== $generated ? $generated : $hand_pins;

		$outline_span = max( (float) ( $outline_hint['width'] ?? 0 ), (float) ( $outline_hint['height'] ?? 0 ) );
		$pin_limit = 150;
		if ( null === $generated ) {
			$pin_limit = $outline_span > 0 ? max( 12, min( 150, $outline_span * 1.5 ) ) : 60;
		}

		$pins = array();
		if ( ! empty( $raw_pins ) ) {
			foreach ( array_slice( $raw_pins, 0, 128 ) as $pin ) {
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
		// In lua phai dich cung mot luong voi chan, neu khong no lech khoi pad.
		$shift = $this->pin_shift( $pins );
		$pins  = $this->center_pins( $pins, $shift );
		$outline = null !== $generated ? $this->layout_outline( $layout, $pins ) : $outline_hint;
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

		// In lua that (chi den tu thu vien LCSC, AI khong duoc tu bia).
		if ( ! empty( $command['silk'] ) && is_array( $command['silk'] ) ) {
			$silk = array();
			foreach ( array_slice( $command['silk'], 0, 256 ) as $item ) {
				if ( ! is_array( $item ) ) {
					continue;
				}
				$width = max( 0.05, min( 2, (float) ( $item['width'] ?? 0.12 ) ) );
				if ( 'circle' === ( $item['shape'] ?? '' ) ) {
					$silk[] = array(
						'shape'  => 'circle',
						'x'      => max( -200, min( 200, (float) ( $item['x'] ?? 0 ) - $shift[0] ) ),
						'y'      => max( -200, min( 200, (float) ( $item['y'] ?? 0 ) - $shift[1] ) ),
						'radius' => max( 0.02, min( 50, (float) ( $item['radius'] ?? 0.15 ) ) ),
						'width'  => $width,
					);
					continue;
				}
				$silk[] = array(
					'shape' => 'line',
					'x1'    => max( -200, min( 200, (float) ( $item['x1'] ?? 0 ) - $shift[0] ) ),
					'y1'    => max( -200, min( 200, (float) ( $item['y1'] ?? 0 ) - $shift[1] ) ),
					'x2'    => max( -200, min( 200, (float) ( $item['x2'] ?? 0 ) - $shift[0] ) ),
					'y2'    => max( -200, min( 200, (float) ( $item['y2'] ?? 0 ) - $shift[1] ) ),
					'width' => $width,
				);
			}
			if ( ! empty( $silk ) ) {
				$clean_command['silk'] = $silk;
			}
		}
		return $clean_command;
	}

	/**
	 * Dich ca cum chan sao cho tam bao quanh chan trung voi goc dat linh kien.
	 *
	 * Editor ve outline can giua goc dat (x, y) nhung dat chan tai x + pin.x, nen
	 * neu AI tra toa do chan tinh tu goc trai-tren cua package thay vi tu tam -
	 * loi rat hay gap voi IC nhieu chan - ca cum chan se troi han ra ngoai than.
	 * Template cuc bo von da can giua san nen buoc nay khong doi gi chung.
	 */
	private function pin_shift( $pins ) {
		$min_x = null;
		$max_x = null;
		$min_y = null;
		$max_y = null;
		foreach ( $pins as $pin ) {
			$half_w = ( 'round' === $pin['shape'] ? $pin['diameter'] : $pin['width'] ) / 2;
			$half_h = ( 'round' === $pin['shape'] ? $pin['diameter'] : $pin['height'] ) / 2;
			$min_x = null === $min_x ? $pin['x'] - $half_w : min( $min_x, $pin['x'] - $half_w );
			$max_x = null === $max_x ? $pin['x'] + $half_w : max( $max_x, $pin['x'] + $half_w );
			$min_y = null === $min_y ? $pin['y'] - $half_h : min( $min_y, $pin['y'] - $half_h );
			$max_y = null === $max_y ? $pin['y'] + $half_h : max( $max_y, $pin['y'] + $half_h );
		}
		$shift_x = ( $min_x + $max_x ) / 2;
		$shift_y = ( $min_y + $max_y ) / 2;
		// Da can giua san thi khong dich gi, tranh lam tron thua.
		if ( abs( $shift_x ) < 0.01 && abs( $shift_y ) < 0.01 ) {
			return array( 0.0, 0.0 );
		}
		return array( $shift_x, $shift_y );
	}

	private function center_pins( $pins, $shift ) {
		if ( 0.0 === $shift[0] && 0.0 === $shift[1] ) {
			return $pins;
		}
		foreach ( $pins as $i => $pin ) {
			$pins[ $i ]['x'] = round( $pin['x'] - $shift[0], 4 );
			$pins[ $i ]['y'] = round( $pin['y'] - $shift[1], 4 );
		}
		return $pins;
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
		$known_pins = array();

		// Linh kien moi den tu "new_parts"; xu ly truoc de CONNECT tim thay ref.
		foreach ( ( is_array( $plan['new_parts'] ?? null ) ? $plan['new_parts'] : array() ) as $spec ) {
			$clean_command = $this->sanitize_footprint_command( $this->spec_to_footprint_command( $spec ), $side, $x, $y, $board_width, $board_height );
			if ( ! $clean_command ) {
				$out['warnings'][] = 'Chua ve duoc ' . sanitize_text_field( (string) ( $spec['ref'] ?? '?' ) ) . ': server khong dung duoc mo ta footprint.';
				continue;
			}
			foreach ( $clean_command['pins'] as $pin ) {
				$known_pins[ $clean_command['ref'] . '.' . $pin['number'] ] = true;
			}
			$out['commands'][] = $clean_command;
		}
		foreach ( $this->take_lcsc_notes() as $note ) {
			$out['warnings'][] = $note;
		}

		if ( ! is_array( $plan['commands'] ?? null ) ) {
			return $out;
		}
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
				$out['warnings'][] = 'Chua ve duoc ' . sanitize_text_field( (string) ( $command['ref'] ?? '?' ) ) . ': server khong dung duoc mo ta footprint. Hay nhac lai kieu vo va so chan.';
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
		if ( ! is_array( $plan['commands'] ?? null ) ) {
			$plan['commands'] = array();
		}
		$local_refs = is_array( $known_refs ) ? $known_refs : array();
		$known_pins = array();
		$dropped    = array();
		$seen       = array();

		// Linh kien moi den tu "new_parts" va phai duoc xu ly truoc, de cac lenh
		// CONNECT phia sau tim thay ref cua chung.
		foreach ( ( is_array( $plan['new_parts'] ?? null ) ? $plan['new_parts'] : array() ) as $spec ) {
			$clean_command = $this->sanitize_footprint_command( $this->spec_to_footprint_command( $spec ), $side, $x, $y, $board_width, $board_height );
			if ( ! $clean_command ) {
				$dropped[] = sanitize_text_field( (string) ( $spec['ref'] ?? '?' ) );
				continue;
			}
			$local_refs[ $clean_command['ref'] ] = true;
			foreach ( $clean_command['pins'] as $pin ) {
				$known_pins[ $clean_command['ref'] . '.' . $pin['number'] ] = true;
			}
			$out['commands'][] = $clean_command;
		}

		foreach ( $plan['commands'] as $command ) {
			if ( ! is_array( $command ) || count( $out['commands'] ) >= 200 ) {
				continue;
			}
			$type = $command['type'] ?? '';

			// Model co the ket vao vong lap va lap lai y het mot lenh hang tram
			// lan. Ap dung lan hai tro di deu vo nghia hoac pha ban mach.
			if ( 'ADD_FOOTPRINT' !== $type ) {
				$fingerprint = wp_json_encode( $command );
				if ( isset( $seen[ $fingerprint ] ) ) {
					continue;
				}
				$seen[ $fingerprint ] = true;
			}
			// Noi hoac cat mot chan voi chinh no khong co nghia gi.
			if ( ( 'CONNECT' === $type || 'DISCONNECT' === $type ) && ( $command['from'] ?? '' ) === ( $command['to'] ?? '' ) ) {
				continue;
			}
			if ( 'ADD_FOOTPRINT' === $type ) {
				$clean_command = $this->sanitize_footprint_command( $command, $side, $x, $y, $board_width, $board_height );
				if ( ! $clean_command ) {
					$dropped[] = sanitize_text_field( (string) ( $command['ref'] ?? '?' ) );
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

		// Cho biet chan nao la so lieu that cua nha san xuat, chan nao la AI dung
		// lai - nguoi dung can biet cai nao dang tin hon truoc khi dat mach.
		$notes = $this->take_lcsc_notes();
		if ( ! empty( $notes ) ) {
			$out['reply'] = trim( $out['reply'] . ' [' . implode( ' ', $notes ) . ']' );
		}

		// Khong bao gio de model khoe "da tao xong" trong khi server da bo lenh -
		// nguoi dung nhin ban mach trong tron ma khong biet vi sao.
		if ( ! empty( $dropped ) ) {
			$out['reply'] = trim( $out['reply'] . ' [Chua ve duoc ' . implode( ', ', $dropped ) . ': server khong dung duoc mo ta footprint. Hay nhac lai kieu vo va so chan, vi du "TSSOP-20" hoac "DIP-8".]' );
		}
		return $out;
	}
}
