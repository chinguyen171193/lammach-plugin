(function (global, document) {
	'use strict';

	// Conversational AI panel. Talks to /ai/chat, which can both add new
	// footprints/wiring and edit anything already on the board (move, delete,
	// reconnect, rename). It calls services and the shared command executor,
	// never editor internals directly.
	function TabletAIPanel(app) {
		this.app = app;
		this.executor = new global.LMPCBEditorCommandExecutor(app);
		this.height = 34; // % chieu cao man hinh cho khung lich su chat - keo tay cam tren dinh de chinh
		this.busy = false;
		this.messages = [];
		this.pendingFile = null;
		this.button = document.createElement('button');
		this.panel = document.createElement('aside');
		this.inputBar = document.createElement('div');
		this.thread = document.createElement('div');
		this.prompt = document.createElement('textarea');
		this.fileInput = document.createElement('input');
		this.attachment = document.createElement('div');
		this.build();
		this.bind();
	}

	TabletAIPanel.prototype.build = function () {
		this.button.type = 'button';
		this.button.className = 'lm-tablet-ai-button';
		this.button.textContent = '✨ AI';
		this.panel.className = 'lm-tablet-ai-panel';
		this.panel.hidden = true;
		this.panel.style.height = this.height + 'vh';
		var resize = document.createElement('div');
		resize.className = 'lm-tablet-ai-resize';
		resize.setAttribute('data-ai-resize', '1');
		var header = document.createElement('div');
		header.className = 'lm-tablet-ai-header';
		header.textContent = 'AI - Trợ lý mạch';
		var close = document.createElement('button');
		close.type = 'button';
		close.textContent = '×';
		close.setAttribute('data-ai-close', '1');
		header.appendChild(close);
		this.thread.className = 'lm-tablet-ai-thread';
		var hint = document.createElement('div');
		hint.className = 'lm-tablet-ai-hint';
		hint.textContent = 'Ví dụ: "vẽ mạch ổn áp 5V lm2596", "di chuyển C1 sang trái 5mm", "xoá R2", "nối U1.4 với R1.1".';
		this.thread.appendChild(hint);
		// Thanh nhap dan day man hinh, tach khoi panel ben phai de tran het chieu
		// rong man hinh (panel chi con giu phan lich su chat, hep hon).
		this.inputBar.className = 'lm-tablet-ai-inputbar';
		this.inputBar.hidden = true;
		this.attachment.className = 'lm-tablet-ai-attachment';
		this.attachment.hidden = true;
		this.fileInput.type = 'file';
		this.fileInput.accept = '.pdf,application/pdf';
		this.fileInput.hidden = true;
		this.fileInput.setAttribute('aria-label', 'Đính kèm datasheet PDF');
		var inputRow = document.createElement('div');
		inputRow.className = 'lm-tablet-ai-input-row';
		this.prompt.placeholder = 'Nhập yêu cầu...';
		this.prompt.rows = 2;
		var attach = document.createElement('button');
		attach.type = 'button';
		attach.textContent = '📎';
		attach.title = 'Đính kèm datasheet PDF';
		attach.setAttribute('data-ai-attach', '1');
		var send = document.createElement('button');
		send.type = 'button';
		send.textContent = 'Gửi';
		send.setAttribute('data-ai-send', '1');
		this.sendButton = send;
		inputRow.appendChild(attach);
		inputRow.appendChild(this.prompt);
		inputRow.appendChild(send);
		this.panel.appendChild(resize);
		this.panel.appendChild(header);
		this.panel.appendChild(this.thread);
		this.inputBar.appendChild(this.attachment);
		this.inputBar.appendChild(inputRow);
		this.inputBar.appendChild(this.fileInput);
		this.app.root.appendChild(this.button);
		this.app.root.appendChild(this.panel);
		this.app.root.appendChild(this.inputBar);
		this.syncInputBarHeight();
		if (global.ResizeObserver) {
			var self = this;
			new global.ResizeObserver(function () { self.syncInputBarHeight(); }).observe(this.inputBar);
		}
	};

	// Panel's "bottom" phai luon khop chieu cao THUC TE cua inputBar (attachment
	// hien/an, textarea to nho...) - hardcode mot con so co dinh se lech bat cu
	// luc nao inputBar cao/thap hon gia dinh, khien inputBar de len phan cuoi
	// panel va che mat tin nhan cuoi cung.
	TabletAIPanel.prototype.syncInputBarHeight = function () {
		var h = this.inputBar.offsetHeight;
		if (h) this.panel.style.bottom = h + 'px';
	};

	TabletAIPanel.prototype.bind = function () {
		var self = this;
		this.button.addEventListener('click', function () { self.open(); });
		function onClick(e) {
			if (e.target.getAttribute('data-ai-close')) self.close();
			if (e.target.getAttribute('data-ai-send')) self.send();
			if (e.target.getAttribute('data-ai-attach')) self.fileInput.click();
			if (e.target.getAttribute('data-ai-remove-attachment')) self.setPendingFile(null);
		}
		this.panel.addEventListener('click', onClick);
		this.inputBar.addEventListener('click', onClick);
		this.prompt.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				self.send();
			}
		});
		this.fileInput.addEventListener('change', function () {
			var file = self.fileInput.files && self.fileInput.files[0];
			self.setPendingFile(file || null);
		});
		this.panel.querySelector('[data-ai-resize]').addEventListener('pointerdown', function (e) {
			self.startResize(e);
		});
	};

	TabletAIPanel.prototype.setPendingFile = function (file) {
		this.pendingFile = file || null;
		this.attachment.textContent = '';
		if (!file) {
			this.attachment.hidden = true;
			this.fileInput.value = '';
			return;
		}
		this.attachment.hidden = false;
		var label = document.createElement('span');
		label.textContent = '📎 ' + file.name;
		var remove = document.createElement('button');
		remove.type = 'button';
		remove.textContent = '×';
		remove.setAttribute('data-ai-remove-attachment', '1');
		this.attachment.appendChild(label);
		this.attachment.appendChild(remove);
	};

	TabletAIPanel.prototype.open = function () {
		this.panel.hidden = false;
		this.inputBar.hidden = false;
		this.syncInputBarHeight();
	};

	TabletAIPanel.prototype.close = function () {
		this.panel.hidden = true;
		this.inputBar.hidden = true;
	};

	TabletAIPanel.prototype.buildBoardContext = function () {
		return (this.app.state.components || []).map(function (c) {
			return {
				ref: c.ref || '',
				name: c.name || '',
				value: c.value || '',
				package: c.package || '',
				side: c.side || 'top',
				x: Number(c.x || 0),
				y: Number(c.y || 0),
				rotation: Number(c.rotation || 0)
			};
		});
	};

	TabletAIPanel.prototype.send = function () {
		var text = this.prompt.value.trim();
		if (!text || this.busy) return;
		var file = this.pendingFile;
		this.prompt.value = '';
		this.addBubble('user', text + (file ? '\n📎 ' + file.name : ''));
		this.setPendingFile(null);
		this.messages.push({ role: 'user', content: text });
		this.setBusy(true);
		var typing = this.addBubble('assistant', 'Đang suy nghĩ...', true);
		var self = this;
		this.requestAI(text, file).then(function (result) {
			self.setBusy(false);
			typing.remove();
			self.handleResult(result || {});
		}).catch(function (err) {
			self.setBusy(false);
			typing.remove();
			self.addBubble('assistant', '⚠ ' + (err && err.message ? err.message : 'AI request failed'), false, 'error');
		});
	};

	// Goi /ai/chat mot lan, dung chung cho ca tin nhan nguoi go (send()) lan
	// vong tu sua sau khi ap dung (autoFix()). Gia dinh "text" DA duoc day vao
	// this.messages truoc khi goi, giong nhu send() van lam - de lich su gui len
	// server luon khop voi nhung gi hien tren man hinh.
	TabletAIPanel.prototype.requestAI = function (text, file) {
		var priorHistory = this.messages.slice(0, -1);
		return global.LMPCBTracerStorage.chatWithAI({
			message: text,
			history: priorHistory,
			side: this.app.activeSide || 'top',
			board: this.app.state && this.app.state.board,
			x: this.app.cursor ? this.app.cursor.x : 20,
			y: this.app.cursor ? this.app.cursor.y : 18,
			components: this.buildBoardContext(),
			file: file || null
		});
	};

	TabletAIPanel.prototype.setBusy = function (busy) {
		this.busy = !!busy;
		this.sendButton.disabled = this.busy;
		this.sendButton.textContent = this.busy ? '...' : 'Gửi';
	};

	TabletAIPanel.prototype.handleResult = function (result) {
		var reply = result.reply ? String(result.reply) : '';
		var commands = Array.isArray(result.commands) ? result.commands : [];
		this.messages.push({
			role: 'assistant',
			content: reply || (commands.length ? 'Đã đề xuất ' + commands.length + ' thay đổi.' : 'Không có thay đổi nào.')
		});
		this.addBubble('assistant', reply || (commands.length ? '' : 'AI không đề xuất thay đổi nào.'), false, '', commands);
	};

	// So vong tu sua toi da cho MOT lan nguoi dung yeu cau. Moi vong them la mot
	// luot goi OpenAI nua (them thoi gian cho + chi phi) - 4 la muc nguoi dung da
	// chon, du de sua loi don gian nhung khong de mot yeu cau am tham chay qua
	// lau/qua nhieu tien neu AI cu lap lai loi cu.
	var MAX_FIX_ROUNDS = 4;

	// Tu dong gui lai cho AI danh sach canh bao vua thu duoc sau khi ap dung, de
	// no tu dieu chinh (doi vi tri, doi cach noi, chon footprint khac...) va ap
	// dung tiep NGAY, khong cho nguoi dung bam them lan nao - dung y nguoi dung
	// yeu cau: "thu - kiem tra - sua - lap lai" nhu mot agent, co gioi han vong.
	TabletAIPanel.prototype.autoFix = function (warnings, round) {
		var self = this;
		var text = 'Ket qua vua ap dung len bo mach con ' + warnings.length + ' canh bao:\n- '
			+ warnings.join('\n- ')
			+ '\nHay dieu chinh (di chuyen linh kien, doi cach noi day, chon lai footprint...) de khac phuc cac canh bao nay.';
		this.messages.push({ role: 'user', content: text });
		var status = this.addBubble('assistant', '🔁 AI đang tự kiểm tra và sửa (vòng ' + round + '/' + MAX_FIX_ROUNDS + ')...', true);
		this.requestAI(text, null).then(function (result) {
			status.remove();
			result = result || {};
			var reply = result.reply ? String(result.reply) : '';
			var commands = Array.isArray(result.commands) ? result.commands : [];
			self.messages.push({ role: 'assistant', content: reply || 'Đã tự điều chỉnh.' });

			if (!commands.length) {
				self.addBubble('assistant', (reply || 'AI không đề xuất thay đổi nào thêm.') + ' — dừng tự sửa, còn ' + warnings.length + ' cảnh báo, hãy kiểm tra bằng tay:', false, 'error');
				return;
			}

			var applied = self.executor.execute(commands) || {};
			var nextWarnings = applied.warnings || [];
			var bubble = self.addBubble('assistant', reply, false, '', null);
			bubble.appendChild(self.statusLabel('✓ Đã tự áp dụng (vòng ' + round + '/' + MAX_FIX_ROUNDS + ')'));

			if (!nextWarnings.length) {
				bubble.appendChild(self.statusLabel('✓ Hết cảnh báo'));
				return;
			}
			if (round >= MAX_FIX_ROUNDS) {
				nextWarnings.forEach(function (w) { bubble.appendChild(self.statusLabel('⚠ ' + w)); });
				bubble.appendChild(self.statusLabel('Đã thử tự sửa ' + MAX_FIX_ROUNDS + ' vòng, vẫn còn cảnh báo trên - hãy kiểm tra bằng tay.'));
				return;
			}
			self.autoFix(nextWarnings, round + 1);
		}).catch(function (err) {
			status.remove();
			self.addBubble('assistant', '⚠ Dừng tự sửa: ' + (err && err.message ? err.message : 'AI request failed') + '. Còn ' + warnings.length + ' cảnh báo trước đó, hãy kiểm tra bằng tay.', false, 'error');
		});
	};

	TabletAIPanel.prototype.addBubble = function (role, text, isTyping, kind, commands) {
		var bubble = document.createElement('div');
		bubble.className = 'lm-tablet-ai-bubble lm-tablet-ai-bubble-' + role + (isTyping ? ' is-typing' : '') + (kind ? ' lm-tablet-ai-bubble-' + kind : '');
		if (text) {
			var textNode = document.createElement('div');
			textNode.className = 'lm-tablet-ai-bubble-text';
			textNode.textContent = text;
			bubble.appendChild(textNode);
		}
		if (commands && commands.length) {
			bubble.appendChild(this.buildCommandSummary(commands));
			var actions = document.createElement('div');
			actions.className = 'lm-tablet-ai-bubble-actions';
			var apply = document.createElement('button');
			apply.type = 'button';
			apply.textContent = 'Áp dụng';
			apply.setAttribute('data-ai-apply', '1');
			var discard = document.createElement('button');
			discard.type = 'button';
			discard.textContent = 'Bỏ qua';
			discard.setAttribute('data-ai-discard', '1');
			actions.appendChild(apply);
			actions.appendChild(discard);
			bubble.appendChild(actions);
			var self = this;
			apply.addEventListener('click', function () {
				var result = self.executor.execute(commands) || {};
				actions.remove();
				bubble.appendChild(self.statusLabel('✓ Đã áp dụng'));
				var warnings = result.warnings || [];
				warnings.forEach(function (warning) {
					bubble.appendChild(self.statusLabel('⚠ ' + warning));
				});
				// Nguoi dung da duyet buoc dau (bam Ap dung); tu day tro di, neu
				// con canh bao thi AI tu kiem tra va sua tiep khong can bam them -
				// dung nhu mot agent: thu, doc canh bao, sua, lap lai co gioi han.
				if (warnings.length) self.autoFix(warnings, 1);
			});
			discard.addEventListener('click', function () {
				actions.remove();
				bubble.appendChild(self.statusLabel('Đã bỏ qua'));
			});
		}
		this.thread.appendChild(bubble);
		this.thread.scrollTop = this.thread.scrollHeight;
		return bubble;
	};

	TabletAIPanel.prototype.statusLabel = function (text) {
		var label = document.createElement('div');
		label.className = 'lm-tablet-ai-bubble-status';
		label.textContent = text;
		return label;
	};

	TabletAIPanel.prototype.buildCommandSummary = function (commands) {
		var list = document.createElement('div');
		list.className = 'lm-tablet-ai-command-summary';
		var labels = {
			ADD_FOOTPRINT: 'Thêm',
			CONNECT: 'Nối',
			DISCONNECT: 'Tháo nối',
			MOVE_COMPONENT: 'Di chuyển',
			DELETE_COMPONENT: 'Xoá',
			SET_VALUE: 'Đổi giá trị'
		};
		commands.forEach(function (command) {
			var line = document.createElement('div');
			line.className = 'lm-tablet-ai-command-item';
			var label = labels[command.type] || command.type;
			if (command.type === 'ADD_FOOTPRINT') {
				line.textContent = label + ': ' + (command.ref || '?') + ' (' + (command.component || command.package || '') + ')';
			} else if (command.type === 'CONNECT' || command.type === 'DISCONNECT') {
				line.textContent = label + ': ' + command.from + ' - ' + command.to;
			} else if (command.type === 'MOVE_COMPONENT') {
				line.textContent = label + ': ' + command.ref + ' -> (' + command.x + ', ' + command.y + ')';
			} else if (command.type === 'DELETE_COMPONENT') {
				line.textContent = label + ': ' + command.ref;
			} else if (command.type === 'SET_VALUE') {
				line.textContent = label + ': ' + command.ref + ' = ' + command.value;
			} else {
				line.textContent = label;
			}
			list.appendChild(line);
		});
		return list;
	};

	// Panel dung ngay tren inputBar (canh duoi = chieu cao THUC TE cua inputBar,
	// xem syncInputBarHeight) - keo tay cam TREN DINH panel len/xuong se doi
	// chieu cao (vh), khong doi chieu rong nua vi panel da la full-width.
	TabletAIPanel.prototype.startResize = function (e) {
		var self = this;
		e.preventDefault();
		function move(ev) {
			var panelBottomY = global.innerHeight - self.inputBar.offsetHeight;
			var heightPx = panelBottomY - ev.clientY;
			self.height = Math.max(20, Math.min(60, (heightPx / global.innerHeight) * 100));
			self.panel.style.height = self.height + 'vh';
		}
		function up() {
			document.removeEventListener('pointermove', move);
			document.removeEventListener('pointerup', up);
		}
		document.addEventListener('pointermove', move);
		document.addEventListener('pointerup', up);
	};

	global.LMPCBTabletAIPanel = TabletAIPanel;
})(window, document);
