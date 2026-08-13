(function (global, document) {
	'use strict';

	// Coordinates tablet-only UI modules around the existing editor instance.
	function TabletMode(app) {
		this.app = app;
		this.root = app.root;
		this.storageKey = 'datPCBTracerTabletMode';
		this.checkbox = this.root.querySelector('[data-tablet-mode]');
		this.contextMenu = new global.LMPCBTabletContextMenu(app);
		this.gesture = new global.LMPCBTabletGesture(app, this.contextMenu);
		this.toolbar = new global.LMPCBTabletToolbar(app);
		this.floatingToolbar = new global.LMPCBTabletFloatingToolbar(app);
		this.aiPanel = new global.LMPCBTabletAIPanel(app);
		this.fab = null;
		this.idleTimer = null;
		this.bind();
		this.createFab();
		this.setEnabled(this.readStoredState() === '1');
		app.canvas.setTabletGesture(this.gesture);
	}

	TabletMode.prototype.bind = function () {
		var self = this;
		if (this.checkbox) {
			this.checkbox.addEventListener('change', function () {
				self.setEnabled(self.checkbox.checked);
			});
		}
		this.root.addEventListener('pointerdown', function () { self.wakeFab(); });
		this.root.addEventListener('pointermove', function () { self.wakeFab(); });
	};

	TabletMode.prototype.setEnabled = function (enabled) {
		this.root.classList.toggle('tablet-mode', !!enabled);
		if (this.checkbox) this.checkbox.checked = !!enabled;
		this.writeStoredState(enabled ? '1' : '0');
		this.app.canvas.resize();
		this.floatingToolbar.update();
		this.wakeFab();
	};

	TabletMode.prototype.readStoredState = function () {
		try {
			return global.localStorage.getItem(this.storageKey);
		} catch (err) {
			return '0';
		}
	};

	TabletMode.prototype.writeStoredState = function (value) {
		try {
			global.localStorage.setItem(this.storageKey, value);
		} catch (err) {}
	};

	TabletMode.prototype.createFab = function () {
		var self = this;
		this.fab = document.createElement('div');
		this.fab.className = 'lm-tablet-fab';
		[
			['↶', 'Undo', 'undo'],
			['↷', 'Redo', 'redo'],
			['+', 'Zoom In', 'zoom-in'],
			['−', 'Zoom Out', 'zoom-out'],
			['⤢', 'Fit Screen', 'fit'],
			['◎', 'Center View', 'center-view']
		].forEach(function (item) {
			var button = document.createElement('button');
			button.type = 'button';
			button.textContent = item[0];
			button.title = item[1];
			button.setAttribute('aria-label', item[1]);
			button.setAttribute('data-fab-action', item[2]);
			self.fab.appendChild(button);
		});
		this.fab.addEventListener('click', function (e) {
			var action = e.target.getAttribute('data-fab-action');
			if (action) self.app.action(action);
			self.wakeFab();
		});
		this.root.appendChild(this.fab);
	};

	TabletMode.prototype.wakeFab = function () {
		var self = this;
		if (!this.fab) return;
		this.fab.classList.toggle('is-visible', this.app.isTabletMode && this.app.isTabletMode());
		if (this.idleTimer) global.clearTimeout(this.idleTimer);
		this.idleTimer = global.setTimeout(function () {
			self.fab.classList.remove('is-visible');
		}, 2600);
	};

	var api = {
		instance: null,
		bootstrap: function (app) {
			if (!app || api.instance) return api.instance;
			api.instance = new TabletMode(app);
			return api.instance;
		}
	};

	document.addEventListener('DOMContentLoaded', function () {
		if (global.LMPCBTracerApp) api.bootstrap(global.LMPCBTracerApp);
	});

	global.LMPCBTabletMode = api;
})(window, document);
