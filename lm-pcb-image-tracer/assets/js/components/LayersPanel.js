(function (global, document) {
	'use strict';

	function el(tag, className, text) {
		var node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined) node.textContent = text;
		return node;
	}

	function LayersPanel(app) {
		this.app = app;
		this.root = app.root;
		this.activeTab = 'all';
		this.search = '';
		this.position = { x: 18, y: 92, w: 324, h: 440 };
		this.tabs = [
			{ id: 'all', label: 'Tất cả các lớp' },
			{ id: 'copper', label: 'Lớp phủ đồng' },
			{ id: 'pcb', label: 'Lớp PCB' },
			{ id: 'objects', label: 'Đối tượng' }
		];
		// Chi giu ten tieng Viet va nhom tab. Mau KHONG dat o day: o mau canh ten
		// lop phai dung mau lop that su duoc ve tren canvas, nen luon lay tu
		// app.state.layers. Truoc day bang nay giu ban sao cung cua ca mau lan ten,
		// va no da troi khoi thuc te - dong nay tung ghi 'Keepout' mau tim cho lop
		// mechanical, trong khi canvas ve no mau xanh va Keepout la mot khai niem
		// hoan toan khac (vung cam di day).
		this.layerMeta = {
			top_copper: { label: 'Đồng lớp trên', group: 'copper' },
			bottom_copper: { label: 'Đồng lớp dưới', group: 'copper' },
			silk_top: { label: 'In lụa mặt trên', group: 'pcb' },
			silk_bottom: { label: 'In lụa mặt dưới', group: 'pcb' },
			// In lua da tach ra hai lop rieng o tren; 'annotation' gio chi con la
			// ghi chu nguoi dung tu ve, khong phai net duoc in len bo mach.
			annotation: { label: 'Ghi chú', group: 'pcb' },
			outline: { label: 'Viền bo', group: 'pcb' },
			drill: { label: 'Lỗ khoan', group: 'pcb' },
			mechanical: { label: 'Cơ khí', group: 'pcb' },
			background_top: { label: 'Ảnh nền mặt trên', group: 'pcb' },
			background_bottom: { label: 'Ảnh nền mặt dưới', group: 'pcb' }
		};
		this.build();
		this.bind();
		this.render();
	}

	LayersPanel.prototype.build = function () {
		var panel = el('section', 'lm-easy-panel lm-easy-layers-panel');
		panel.style.left = this.position.x + 'px';
		panel.style.top = this.position.y + 'px';
		panel.style.width = this.position.w + 'px';
		panel.style.height = this.position.h + 'px';
		panel.hidden = false;
		panel.classList.add('is-collapsed');

		var header = el('div', 'lm-easy-panel-header');
		this.dragHandle = header;
		header.appendChild(el('span', 'lm-easy-panel-grip', '⠿'));
		header.appendChild(el('strong', '', 'Lớp và đối tượng'));
		var collapse = el('button', 'lm-easy-icon-button', '+');
		collapse.type = 'button';
		collapse.title = 'Mở rộng';
		collapse.setAttribute('data-layers-collapse', '1');
		var close = el('button', 'lm-easy-icon-button', '×');
		close.type = 'button';
		close.title = 'Đóng';
		close.setAttribute('data-layers-close', '1');
		header.appendChild(collapse);
		header.appendChild(close);

		var tabs = el('div', 'lm-easy-tabs');
		this.tabs.forEach(function (tab) {
			var button = el('button', '', tab.label);
			button.type = 'button';
			button.setAttribute('data-layer-tab', tab.id);
			tabs.appendChild(button);
		});

		var tools = el('div', 'lm-easy-panel-tools');
		var search = document.createElement('input');
		search.type = 'search';
		search.placeholder = 'Tìm lớp hoặc đối tượng';
		search.setAttribute('data-layer-search', '1');
		tools.appendChild(search);
		this.searchInput = search;

		var actions = el('div', 'lm-easy-action-row');
		[
			['show-all', 'Hiện tất cả'],
			['hide-all', 'Ẩn tất cả'],
			['reset', 'Đặt mặc định']
		].forEach(function (item) {
			var button = el('button', '', item[1]);
			button.type = 'button';
			button.setAttribute('data-layer-action', item[0]);
			actions.appendChild(button);
		});

		this.list = el('div', 'lm-easy-layer-list');
		var resize = el('span', 'lm-easy-resize-handle');
		resize.setAttribute('data-layers-resize', '1');

		panel.appendChild(header);
		panel.appendChild(tabs);
		panel.appendChild(tools);
		panel.appendChild(actions);
		panel.appendChild(this.list);
		panel.appendChild(resize);

		var launcher = el('button', 'lm-easy-layer-launcher', 'Lớp');
		launcher.type = 'button';
		launcher.hidden = true;

		this.panel = panel;
		this.launcher = launcher;
		this.root.appendChild(panel);
		this.root.appendChild(launcher);
	};

	LayersPanel.prototype.bind = function () {
		this.panel.addEventListener('click', function (event) {
			var close = event.target.closest('[data-layers-close]');
			if (close) {
				this.panel.hidden = true;
				this.launcher.hidden = false;
				return;
			}
			var collapse = event.target.closest('[data-layers-collapse]');
			if (collapse) {
				this.panel.classList.toggle('is-collapsed');
				collapse.textContent = this.panel.classList.contains('is-collapsed') ? '+' : '−';
				collapse.title = this.panel.classList.contains('is-collapsed') ? 'Mở rộng' : 'Thu gọn';
				return;
			}
			var tab = event.target.closest('[data-layer-tab]');
			if (tab) {
				this.activeTab = tab.getAttribute('data-layer-tab');
				this.render();
				return;
			}
			var action = event.target.closest('[data-layer-action]');
			if (action) {
				this.applyAction(action.getAttribute('data-layer-action'));
				return;
			}
			var row = event.target.closest('[data-layer-key]');
			if (!row) return;
			var key = row.getAttribute('data-layer-key');
			var icon = event.target.closest('[data-layer-toggle]');
			if (icon) {
				this.toggleLayer(key, icon.getAttribute('data-layer-toggle'));
				return;
			}
			this.app.activeLayer = key;
			if (this.activeTab === 'objects') {
				this.app.selected = this.app.expandComponentSelection([key]);
				this.app.activePinId = '';
				this.app.renderProperties();
				this.app.canvas.invalidate();
				return;
			}
			// Qua setActiveSide() chu khong gan thang app.activeSide: no con dong bo
			// nut Top/Bottom tren thanh cong cu va ve lai canvas, neu gan thang thi
			// nut kia se chi sai mat.
			if (key === 'top_copper' || key === 'silk_top') this.app.setActiveSide('top');
			if (key === 'bottom_copper' || key === 'silk_bottom') this.app.setActiveSide('bottom');
			this.render();
		}.bind(this));

		this.launcher.addEventListener('click', function () {
			this.panel.hidden = false;
			this.launcher.hidden = true;
		}.bind(this));

		this.searchInput.addEventListener('input', function () {
			this.search = this.searchInput.value.toLowerCase().trim();
			this.render();
		}.bind(this));

		this.bindDrag();
		this.bindResize();
		global.addEventListener('resize', function () {
			this.keepInViewport();
			global.setTimeout(this.keepInViewport.bind(this), 180);
		}.bind(this));
	};

	LayersPanel.prototype.keepInViewport = function () {
		if (this.panel.hidden) return;
		var rect = this.panel.getBoundingClientRect();
		var maxX = Math.max(8, global.innerWidth - this.panel.offsetWidth - 8);
		var maxY = Math.max(8, global.innerHeight - this.panel.offsetHeight - 8);
		this.panel.style.right = 'auto';
		this.panel.style.left = Math.max(8, Math.min(rect.left, maxX)) + 'px';
		this.panel.style.top = Math.max(8, Math.min(rect.top, maxY)) + 'px';
	};

	LayersPanel.prototype.bindDrag = function () {
		var drag = null;
		this.dragHandle.addEventListener('pointerdown', function (event) {
			if (event.target.closest('button')) return;
			var rect = this.panel.getBoundingClientRect();
			drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
			this.dragHandle.setPointerCapture(event.pointerId);
			event.preventDefault();
		}.bind(this));
		this.dragHandle.addEventListener('pointermove', function (event) {
			if (!drag) return;
			var maxX = Math.max(8, global.innerWidth - this.panel.offsetWidth - 8);
			var maxY = Math.max(8, global.innerHeight - this.panel.offsetHeight - 8);
			this.panel.style.left = Math.max(8, Math.min(event.clientX - drag.x, maxX)) + 'px';
			this.panel.style.top = Math.max(8, Math.min(event.clientY - drag.y, maxY)) + 'px';
		}.bind(this));
		this.dragHandle.addEventListener('pointerup', function () { drag = null; });
		this.dragHandle.addEventListener('pointercancel', function () { drag = null; });
	};

	LayersPanel.prototype.bindResize = function () {
		var start = null;
		var handle = this.panel.querySelector('[data-layers-resize]');
		handle.addEventListener('pointerdown', function (event) {
			var rect = this.panel.getBoundingClientRect();
			start = { x: event.clientX, y: event.clientY, w: rect.width, h: rect.height };
			handle.setPointerCapture(event.pointerId);
			event.preventDefault();
		}.bind(this));
		handle.addEventListener('pointermove', function (event) {
			if (!start) return;
			this.panel.style.width = Math.max(280, Math.min(520, start.w + event.clientX - start.x)) + 'px';
			this.panel.style.height = Math.max(300, Math.min(global.innerHeight - 24, start.h + event.clientY - start.y)) + 'px';
		}.bind(this));
		handle.addEventListener('pointerup', function () { start = null; });
		handle.addEventListener('pointercancel', function () { start = null; });
	};

	LayersPanel.prototype.applyAction = function (action) {
		Object.keys(this.app.state.layers).forEach(function (key) {
			var layer = this.app.state.layers[key];
			if (action === 'show-all') layer.visible = true;
			if (action === 'hide-all') layer.visible = false;
			if (action === 'reset') {
				layer.visible = true;
				layer.locked = key.indexOf('background_') === 0;
			}
		}, this);
		this.app.markDirty();
	};

	LayersPanel.prototype.toggleLayer = function (key, mode) {
		var layer = this.app.state.layers[key];
		if (!layer) return;
		if (mode === 'visible') layer.visible = !layer.visible;
		if (mode === 'locked') layer.locked = !layer.locked;
		this.app.markDirty();
	};

	LayersPanel.prototype.getItems = function () {
		var items = Object.keys(this.app.state.layers).map(function (key) {
			var layer = this.app.state.layers[key];
			var meta = this.layerMeta[key] || {};
			return { type: 'layer', key: key, label: meta.label || layer.name || key, color: layer.color || '#8b949e', group: meta.group || 'pcb', layer: layer };
		}, this);
		if (this.activeTab === 'copper') items = items.filter(function (item) { return item.group === 'copper'; });
		if (this.activeTab === 'pcb') items = items.filter(function (item) { return item.group === 'pcb'; });
		if (this.activeTab === 'objects') {
			items = this.app.state.objects.map(function (obj) {
				var g = obj.geometry || {};
				return { type: 'object', key: obj.id, label: (g.component_ref ? g.component_ref + ' · ' : '') + obj.type + ' · ' + obj.id, color: '#9ca3af', object: obj };
			});
		}
		if (this.search) {
			items = items.filter(function (item) { return item.label.toLowerCase().indexOf(this.search) !== -1 || item.key.toLowerCase().indexOf(this.search) !== -1; }, this);
		}
		return items;
	};

	LayersPanel.prototype.render = function () {
		Array.prototype.forEach.call(this.panel.querySelectorAll('[data-layer-tab]'), function (button) {
			button.classList.toggle('is-active', button.getAttribute('data-layer-tab') === this.activeTab);
		}, this);
		this.list.textContent = '';
		this.getItems().forEach(function (item) {
			var row = el('button', 'lm-easy-layer-row');
			row.type = 'button';
			row.setAttribute('data-layer-key', item.key);
			row.classList.toggle('is-active', item.key === this.app.activeLayer);
			var swatch = el('span', 'lm-easy-layer-swatch');
			swatch.style.background = item.color;
			row.appendChild(swatch);
			row.appendChild(el('span', 'lm-easy-layer-name', item.label));
			if (item.type === 'layer') {
				row.appendChild(this.iconButton('visible', item.layer.visible ? '👁' : '◌'));
				row.appendChild(this.iconButton('locked', item.layer.locked ? '🔒' : '🔓'));
			} else {
				row.appendChild(el('span', 'lm-easy-layer-pill', item.object.visible ? 'Visible' : 'Hidden'));
			}
			this.list.appendChild(row);
		}, this);
	};

	LayersPanel.prototype.iconButton = function (mode, text) {
		var button = el('span', 'lm-easy-layer-icon', text);
		button.setAttribute('data-layer-toggle', mode);
		return button;
	};

	global.LMPCBLayersPanel = LayersPanel;
})(window, document);
