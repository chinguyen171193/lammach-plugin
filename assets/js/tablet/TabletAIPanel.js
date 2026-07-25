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
		var self = this;
		var context = {
			side: this.app.activeSide || 'top',
			board: this.app.state && this.app.state.board,
			x: this.app.cursor && this.app.cursor.x,
			y: this.app.cursor && this.app.cursor.y,
			file: this.file.files && this.file.files[0]
		};
		global.generateCircuit(this.prompt.value, context).then(function (result) {
			self.executor.execute(result.commands);
			self.addHistory(result);
		}).catch(function (err) {
			self.addHistory({ error: err && err.message ? err.message : 'AI request failed' });
		});
	};

	TabletAIPanel.prototype.addHistory = function (result) {
		var item = document.createElement('pre');
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
