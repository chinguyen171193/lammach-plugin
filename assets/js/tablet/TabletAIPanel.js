(function (global, document) {
	'use strict';

	// Tablet AI command panel. It calls services, never editor internals directly.
	function TabletAIPanel(app) {
		this.app = app;
		this.executor = new global.DATPCBEditorCommandExecutor(app);
		this.width = 35;
		this.button = document.createElement('button');
		this.panel = document.createElement('aside');
		this.history = document.createElement('div');
		this.prompt = document.createElement('textarea');
		this.file = document.createElement('input');
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
		header.textContent = 'AI';
		var close = document.createElement('button');
		close.type = 'button';
		close.textContent = '×';
		close.setAttribute('data-ai-close', '1');
		header.appendChild(close);
		this.prompt.placeholder = 'Prompt';
		this.file.type = 'file';
		this.file.accept = '.pdf,application/pdf';
		this.file.setAttribute('aria-label', 'Datasheet PDF');
		var generate = document.createElement('button');
		generate.type = 'button';
		generate.textContent = 'Generate';
		generate.setAttribute('data-ai-generate', '1');
		this.generateButton = generate;
		this.history.className = 'dat-tablet-ai-history';
		this.panel.appendChild(resize);
		this.panel.appendChild(header);
		this.panel.appendChild(this.prompt);
		this.panel.appendChild(this.file);
		this.panel.appendChild(generate);
		this.panel.appendChild(this.history);
		this.app.root.appendChild(this.button);
		this.app.root.appendChild(this.panel);
	};

	TabletAIPanel.prototype.bind = function () {
		var self = this;
		this.button.addEventListener('click', function () { self.open(); });
		this.panel.addEventListener('click', function (e) {
			if (e.target.getAttribute('data-ai-close')) self.close();
			if (e.target.getAttribute('data-ai-generate')) self.generate();
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

	TabletAIPanel.prototype.generate = function () {
		if (!this.prompt.value || !this.prompt.value.trim()) return;
		var self = this;
		var context = {
			side: this.app.activeSide || 'top',
			board: this.app.state && this.app.state.board,
			x: this.app.cursor && this.app.cursor.x,
			y: this.app.cursor && this.app.cursor.y,
			file: this.file.files && this.file.files[0]
		};
		this.setBusy(true);
		global.generateCircuit(this.prompt.value, context).then(function (result) {
			self.setBusy(false);
			self.showPreview(result || {});
		}).catch(function (err) {
			self.setBusy(false);
			self.addHistory({ error: err && err.message ? err.message : 'AI request failed' }, 'error');
		});
	};

	TabletAIPanel.prototype.setBusy = function (busy) {
		this.generateButton.disabled = !!busy;
		this.generateButton.textContent = busy ? 'Đang tạo...' : 'Generate';
	};

	TabletAIPanel.prototype.showPreview = function (result) {
		var commands = Array.isArray(result.commands) ? result.commands : [];
		var footprints = commands.filter(function (c) { return c && c.type === 'ADD_FOOTPRINT'; });
		var connections = commands.filter(function (c) { return c && c.type === 'CONNECT'; });
		if (!footprints.length) {
			this.addHistory({ message: 'AI không trả về linh kiện nào để chèn.', raw: result }, 'warn');
			return;
		}
		var self = this;
		var card = document.createElement('div');
		card.className = 'dat-tablet-ai-preview';
		footprints.forEach(function (command) {
			var line = document.createElement('div');
			line.className = 'dat-tablet-ai-preview-item';
			var pinCount = Array.isArray(command.pins) ? command.pins.length : 0;
			line.textContent = (command.ref || '?') + ' · ' + (command.component || command.package || '?') + ' (' + (command.package || '?') + ') · ' + pinCount + ' chân · mặt ' + (command.side === 'bottom' ? 'Bottom' : 'Top');
			card.appendChild(line);
		});
		if (connections.length) {
			var connLine = document.createElement('div');
			connLine.className = 'dat-tablet-ai-preview-item';
			connLine.textContent = '🔗 ' + connections.length + ' đường nối tự động giữa các linh kiện trên';
			card.appendChild(connLine);
		}
		if (result.warnings && result.warnings.length) {
			var warnTitle = document.createElement('div');
			warnTitle.className = 'dat-tablet-ai-preview-warn-title';
			warnTitle.textContent = 'Cảnh báo:';
			card.appendChild(warnTitle);
			result.warnings.forEach(function (warning) {
				var w = document.createElement('div');
				w.className = 'dat-tablet-ai-preview-warn';
				w.textContent = '⚠ ' + warning;
				card.appendChild(w);
			});
		}
		var actions = document.createElement('div');
		actions.className = 'dat-tablet-ai-preview-actions';
		var insert = document.createElement('button');
		insert.type = 'button';
		insert.textContent = 'Chèn vào bản vẽ';
		insert.setAttribute('data-ai-preview-insert', '1');
		var discard = document.createElement('button');
		discard.type = 'button';
		discard.textContent = 'Huỷ';
		discard.setAttribute('data-ai-preview-discard', '1');
		actions.appendChild(insert);
		actions.appendChild(discard);
		card.appendChild(actions);
		insert.addEventListener('click', function () {
			self.executor.execute(commands);
			card.remove();
			self.addHistory({ inserted: footprints.map(function (c) { return c.ref; }), connections: connections.length }, 'ok');
		});
		discard.addEventListener('click', function () {
			card.remove();
		});
		this.history.insertBefore(card, this.history.firstChild);
	};

	TabletAIPanel.prototype.addHistory = function (result, kind) {
		var item = document.createElement('pre');
		item.className = kind ? 'dat-tablet-ai-history-' + kind : '';
		item.textContent = JSON.stringify(result, null, 2);
		this.history.insertBefore(item, this.history.firstChild);
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
