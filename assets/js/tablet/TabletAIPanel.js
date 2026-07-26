(function (global, document) {
	'use strict';

	// Conversational AI panel. Talks to /ai/chat, which can both add new
	// footprints/wiring and edit anything already on the board (move, delete,
	// reconnect, rename). It calls services and the shared command executor,
	// never editor internals directly.
	function TabletAIPanel(app) {
		this.app = app;
		this.executor = new global.DATPCBEditorCommandExecutor(app);
		this.width = 35;
		this.busy = false;
		this.messages = [];
		this.button = document.createElement('button');
		this.panel = document.createElement('aside');
		this.thread = document.createElement('div');
		this.prompt = document.createElement('textarea');
		this.build();
		this.bind();
	}

	TabletAIPanel.prototype.build = function () {
		this.button.type = 'button';
		this.button.className = 'dat-tablet-ai-button';
		this.button.textContent = '✨ AI';
		this.panel.className = 'dat-tablet-ai-panel';
		this.panel.hidden = true;
		this.panel.style.width = this.width + '%';
		var resize = document.createElement('div');
		resize.className = 'dat-tablet-ai-resize';
		resize.setAttribute('data-ai-resize', '1');
		var header = document.createElement('div');
		header.className = 'dat-tablet-ai-header';
		header.textContent = 'AI - Trợ lý mạch';
		var close = document.createElement('button');
		close.type = 'button';
		close.textContent = '×';
		close.setAttribute('data-ai-close', '1');
		header.appendChild(close);
		this.thread.className = 'dat-tablet-ai-thread';
		var hint = document.createElement('div');
		hint.className = 'dat-tablet-ai-hint';
		hint.textContent = 'Ví dụ: "vẽ mạch ổn áp 5V lm2596", "di chuyển C1 sang trái 5mm", "xoá R2", "nối U1.4 với R1.1".';
		this.thread.appendChild(hint);
		var inputRow = document.createElement('div');
		inputRow.className = 'dat-tablet-ai-input-row';
		this.prompt.placeholder = 'Nhập yêu cầu...';
		this.prompt.rows = 2;
		var send = document.createElement('button');
		send.type = 'button';
		send.textContent = 'Gửi';
		send.setAttribute('data-ai-send', '1');
		this.sendButton = send;
		inputRow.appendChild(this.prompt);
		inputRow.appendChild(send);
		this.panel.appendChild(resize);
		this.panel.appendChild(header);
		this.panel.appendChild(this.thread);
		this.panel.appendChild(inputRow);
		this.app.root.appendChild(this.button);
		this.app.root.appendChild(this.panel);
	};

	TabletAIPanel.prototype.bind = function () {
		var self = this;
		this.button.addEventListener('click', function () { self.open(); });
		this.panel.addEventListener('click', function (e) {
			if (e.target.getAttribute('data-ai-close')) self.close();
			if (e.target.getAttribute('data-ai-send')) self.send();
		});
		this.prompt.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				self.send();
			}
		});
		this.panel.querySelector('[data-ai-resize]').addEventListener('pointerdown', function (e) {
			self.startResize(e);
		});
	};

	TabletAIPanel.prototype.open = function () {
		this.panel.hidden = false;
	};

	TabletAIPanel.prototype.close = function () {
		this.panel.hidden = true;
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
		this.prompt.value = '';
		this.addBubble('user', text);
		var priorHistory = this.messages.slice();
		this.messages.push({ role: 'user', content: text });
		this.setBusy(true);
		var typing = this.addBubble('assistant', 'Đang suy nghĩ...', true);
		var self = this;
		global.DATPCBTracerStorage.chatWithAI({
			message: text,
			history: priorHistory,
			side: this.app.activeSide || 'top',
			board: this.app.state && this.app.state.board,
			x: this.app.cursor ? this.app.cursor.x : 20,
			y: this.app.cursor ? this.app.cursor.y : 18,
			components: this.buildBoardContext()
		}).then(function (result) {
			self.setBusy(false);
			typing.remove();
			self.handleResult(result || {});
		}).catch(function (err) {
			self.setBusy(false);
			typing.remove();
			self.addBubble('assistant', '⚠ ' + (err && err.message ? err.message : 'AI request failed'), false, 'error');
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

	TabletAIPanel.prototype.addBubble = function (role, text, isTyping, kind, commands) {
		var bubble = document.createElement('div');
		bubble.className = 'dat-tablet-ai-bubble dat-tablet-ai-bubble-' + role + (isTyping ? ' is-typing' : '') + (kind ? ' dat-tablet-ai-bubble-' + kind : '');
		if (text) {
			var textNode = document.createElement('div');
			textNode.className = 'dat-tablet-ai-bubble-text';
			textNode.textContent = text;
			bubble.appendChild(textNode);
		}
		if (commands && commands.length) {
			bubble.appendChild(this.buildCommandSummary(commands));
			var actions = document.createElement('div');
			actions.className = 'dat-tablet-ai-bubble-actions';
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
				self.executor.execute(commands);
				actions.remove();
				bubble.appendChild(self.statusLabel('✓ Đã áp dụng'));
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
		label.className = 'dat-tablet-ai-bubble-status';
		label.textContent = text;
		return label;
	};

	TabletAIPanel.prototype.buildCommandSummary = function (commands) {
		var list = document.createElement('div');
		list.className = 'dat-tablet-ai-command-summary';
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
			line.className = 'dat-tablet-ai-command-item';
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

	TabletAIPanel.prototype.startResize = function (e) {
		var self = this;
		e.preventDefault();
		function move(ev) {
			self.width = Math.max(25, Math.min(55, ((global.innerWidth - ev.clientX) / global.innerWidth) * 100));
			self.panel.style.width = self.width + '%';
		}
		function up() {
			document.removeEventListener('pointermove', move);
			document.removeEventListener('pointerup', up);
		}
		document.addEventListener('pointermove', move);
		document.addEventListener('pointerup', up);
	};

	global.DATPCBTabletAIPanel = TabletAIPanel;
})(window, document);
