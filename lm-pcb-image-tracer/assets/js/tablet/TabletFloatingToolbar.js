(function (global, document) {
	'use strict';

	// Object-level command strip shown next to the selected object in tablet mode.
	function TabletFloatingToolbar(app) {
		this.app = app;
		this.root = app.root;
		this.el = document.createElement('div');
		this.el.className = 'lm-tablet-floating-toolbar';
		this.el.hidden = true;
		this.buttons = [
			['RL', 'Rotate Left', 'rotate-selected-left'],
			['RR', 'Rotate Right', 'rotate-selected-right'],
			['CP', 'Copy', 'copy'],
			['DP', 'Duplicate', 'duplicate'],
			['MR', 'Mirror', 'mirror-selected'],
			['DL', 'Delete', 'delete'],
			['PR', 'Properties', 'properties'],
			['LK', 'Lock', 'toggle-lock']
		];
		this.build();
		this.bind();
	}

	TabletFloatingToolbar.prototype.build = function () {
		this.buttons.forEach(function (item) {
			var button = document.createElement('button');
			button.type = 'button';
			button.innerHTML = '<span>' + item[0] + '</span>';
			button.title = item[1];
			button.setAttribute('aria-label', item[1]);
			button.setAttribute('data-toolbar-action', item[2]);
			this.el.appendChild(button);
		}, this);
		this.root.appendChild(this.el);
	};

	TabletFloatingToolbar.prototype.bind = function () {
		var self = this;
		this.el.addEventListener('click', function (e) {
			var target = e.target.closest('button');
			var action = target && target.getAttribute('data-toolbar-action');
			if (!action) return;
			self.app.action(action);
			self.update();
		});
		this.root.addEventListener('datpcb:selectionchange', function () { self.update(); });
		global.addEventListener('resize', function () { self.update(); });
	};

	TabletFloatingToolbar.prototype.update = function () {
		if (!(this.app.isTabletMode && this.app.isTabletMode()) || !this.app.selected.length || this.app.tool !== 'select' || this.app.drawing) {
			this.el.hidden = true;
			this.el.classList.remove('is-visible');
			return;
		}
		var obj = this.app.selectedObjects()[0];
		if (!obj) {
			this.el.hidden = true;
			this.el.classList.remove('is-visible');
			return;
		}
		var c = global.LMPCBTracerTools.getObjectCenter(obj);
		var p = this.app.canvas.mmToScreen(c);
		var rect = this.app.canvas.canvas.getBoundingClientRect();
		this.el.hidden = false;
		this.el.classList.add('is-visible');
		this.el.style.left = Math.max(88, Math.min(global.innerWidth - 456, rect.left + p.x + 20)) + 'px';
		this.el.style.top = Math.max(80, Math.min(global.innerHeight - 82, rect.top + p.y - 34)) + 'px';
	};

	global.LMPCBTabletFloatingToolbar = TabletFloatingToolbar;
})(window, document);
