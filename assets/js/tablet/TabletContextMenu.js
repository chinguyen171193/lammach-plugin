(function (global, document) {
	'use strict';

	// Shared floating menu for desktop right click and tablet long press.
	function TabletContextMenu(app) {
		this.app = app;
		this.root = app.root;
		this.menu = document.createElement('div');
		this.menu.className = 'dat-tablet-context-menu dat-tablet-pie-menu';
		this.menu.hidden = true;
		this.items = [
			['ROT', 'Rotate', 'rotate-selected-right'],
			['CPY', 'Copy', 'copy'],
			['DEL', 'Delete', 'delete'],
			['MIR', 'Mirror', 'mirror-selected'],
			['DUP', 'Duplicate', 'duplicate'],
			['PRP', 'Properties', 'properties']
		];
		this.build();
		this.bind();
	}

	TabletContextMenu.prototype.build = function () {
		this.menu.style.setProperty('--item-count', this.items.length);
		this.items.forEach(function (item, index) {
			var button = document.createElement('button');
			button.type = 'button';
			button.innerHTML = '<span>' + item[0] + '</span><small>' + item[1] + '</small>';
			button.style.setProperty('--item-index', index);
			button.setAttribute('data-menu-action', item[2]);
			this.menu.appendChild(button);
		}, this);
		this.root.appendChild(this.menu);
	};

	TabletContextMenu.prototype.bind = function () {
		var self = this;
		this.app.canvas.canvas.addEventListener('contextmenu', function (e) {
			e.preventDefault();
			self.selectAt(e.clientX, e.clientY);
			self.showAt(e.clientX, e.clientY);
		});
		this.menu.addEventListener('click', function (e) {
			var target = e.target.closest('button');
			var action = target && target.getAttribute('data-menu-action');
			if (!action) return;
			self.app.action(action);
			self.hide();
		});
		document.addEventListener('pointerdown', function (e) {
			if (!self.menu.hidden && !self.menu.contains(e.target)) self.hide();
		});
	};

	TabletContextMenu.prototype.selectAt = function (clientX, clientY) {
		var p = this.app.canvas.clientToMm(clientX, clientY);
		var hit = this.app.hitTest(p);
		if (hit) {
			this.app.selected = [hit.id];
			this.app.renderProperties();
			this.app.emitSelectionChange();
			this.app.canvas.invalidate();
		}
	};

	TabletContextMenu.prototype.showAt = function (clientX, clientY) {
		this.menu.hidden = false;
		this.menu.style.left = clientX + 'px';
		this.menu.style.top = clientY + 'px';
		this.menu.classList.remove('is-open');
		global.requestAnimationFrame(function () {
			this.menu.classList.add('is-open');
		}.bind(this));
	};

	TabletContextMenu.prototype.hide = function () {
		this.menu.classList.remove('is-open');
		this.menu.hidden = true;
	};

	global.DATPCBTabletContextMenu = TabletContextMenu;
})(window, document);
