(function (global, document) {
	'use strict';

	function el(tag, className, text) {
		var node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined) node.textContent = text;
		return node;
	}

	function PersonalLibrary(app) {
		this.app = app;
		this.key = 'datPCBPersonalLibraryV1';
		this.data = this.load();
		this.activeFolder = this.data.folders[0] ? this.data.folders[0].id : 'default';
		this.executor = new global.DATPCBEditorCommandExecutor(app);
		this.build();
		this.bind();
		this.render();
	}

	PersonalLibrary.prototype.load = function () {
		var fallback = { folders: [{ id: 'default', name: 'Chung', parent: '' }], items: [] };
		try {
			var data = JSON.parse(global.localStorage.getItem(this.key) || 'null');
			if (!data || !Array.isArray(data.folders) || !Array.isArray(data.items)) return fallback;
			if (!data.folders.length) data.folders.push(fallback.folders[0]);
			return data;
		} catch (err) {
			return fallback;
		}
	};

	PersonalLibrary.prototype.save = function () {
		try { global.localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (err) {}
	};

	PersonalLibrary.prototype.build = function () {
		var panel = el('section', 'dat-easy-panel dat-easy-library-panel');
		panel.hidden = true;
		panel.style.right = '18px';
		panel.style.top = '86px';
		panel.style.width = '360px';
		panel.style.height = '520px';
		var header = el('div', 'dat-easy-panel-header');
		header.appendChild(el('span', 'dat-easy-panel-grip', '▦'));
		header.appendChild(el('strong', '', 'Thư viện cá nhân'));
		var collapse = el('button', 'dat-easy-icon-button', '−');
		collapse.type = 'button';
		collapse.title = 'Thu gọn';
		collapse.setAttribute('data-library-collapse', '1');
		var close = el('button', 'dat-easy-icon-button', '×');
		close.type = 'button';
		close.title = 'Đóng';
		close.setAttribute('data-library-close', '1');
		header.appendChild(collapse);
		header.appendChild(close);
		var actions = el('div', 'dat-easy-library-actions');
		[
			['folder', 'Thư mục'],
			['save-selected', 'Lưu linh kiện'],
			['delete-folder', 'Xóa thư mục']
		].forEach(function (item) {
			var button = el('button', '', item[1]);
			button.type = 'button';
			button.setAttribute('data-library-action', item[0]);
			actions.appendChild(button);
		});
		var body = el('div', 'dat-easy-library-body');
		this.folderList = el('div', 'dat-easy-library-folders');
		this.itemList = el('div', 'dat-easy-library-items');
		body.appendChild(this.folderList);
		body.appendChild(this.itemList);
		panel.appendChild(header);
		panel.appendChild(actions);
		panel.appendChild(body);
		this.panel = panel;
		this.app.root.appendChild(panel);
		this.bindDrag(header);
	};

	PersonalLibrary.prototype.bind = function () {
		this.panel.addEventListener('click', function (event) {
			var collapse = event.target.closest('[data-library-collapse]');
			if (collapse) {
				this.panel.classList.toggle('is-collapsed');
				collapse.textContent = this.panel.classList.contains('is-collapsed') ? '+' : '−';
				collapse.title = this.panel.classList.contains('is-collapsed') ? 'Mở rộng' : 'Thu gọn';
				return;
			}
			if (event.target.closest('[data-library-close]')) {
				this.close();
				return;
			}
			var action = event.target.closest('[data-library-action]');
			if (action) {
				this.runAction(action.getAttribute('data-library-action'));
				return;
			}
			var folder = event.target.closest('[data-library-folder]');
			if (folder) {
				this.activeFolder = folder.getAttribute('data-library-folder');
				this.render();
				return;
			}
			var remove = event.target.closest('[data-library-remove]');
			if (remove) {
				this.removeItem(remove.getAttribute('data-library-remove'));
				return;
			}
			var item = event.target.closest('[data-library-item]');
			if (item) {
				this.insertItem(item.getAttribute('data-library-item'));
				return;
			}
		}.bind(this));

		var correctPosition = function () {
			this.keepInViewport();
			global.setTimeout(this.keepInViewport.bind(this), 180);
		}.bind(this);
		global.addEventListener('resize', correctPosition);
		global.addEventListener('orientationchange', correctPosition);
		if (global.visualViewport) global.visualViewport.addEventListener('resize', correctPosition);
	};

	PersonalLibrary.prototype.keepInViewport = function () {
		if (this.panel.hidden) return;
		var rect = this.panel.getBoundingClientRect();
		var maxX = Math.max(8, global.innerWidth - this.panel.offsetWidth - 8);
		var maxY = Math.max(8, global.innerHeight - this.panel.offsetHeight - 8);
		this.panel.style.right = 'auto';
		this.panel.style.left = Math.max(8, Math.min(rect.left, maxX)) + 'px';
		this.panel.style.top = Math.max(8, Math.min(rect.top, maxY)) + 'px';
	};

	PersonalLibrary.prototype.bindDrag = function (handle) {
		var drag = null;
	handle.addEventListener('pointerdown', function (event) {
			if (event.target.closest('button')) return;
			var rect = this.panel.getBoundingClientRect();
			drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
			this.panel.style.right = 'auto';
			handle.setPointerCapture(event.pointerId);
			event.preventDefault();
		}.bind(this));
	handle.addEventListener('pointermove', function (event) {
			if (!drag) return;
			var maxX = Math.max(8, global.innerWidth - this.panel.offsetWidth - 8);
			var maxY = Math.max(8, global.innerHeight - this.panel.offsetHeight - 8);
			this.panel.style.left = Math.max(8, Math.min(event.clientX - drag.x, maxX)) + 'px';
			this.panel.style.top = Math.max(8, Math.min(event.clientY - drag.y, maxY)) + 'px';
		}.bind(this));
		handle.addEventListener('pointerup', function () { drag = null; });
		handle.addEventListener('pointercancel', function () { drag = null; });
	};

	PersonalLibrary.prototype.open = function () {
		this.panel.hidden = false;
		this.render();
		this.keepInViewport();
		global.setTimeout(this.keepInViewport.bind(this), 180);
	};

	PersonalLibrary.prototype.close = function () {
		this.panel.hidden = true;
	};

	PersonalLibrary.prototype.runAction = function (action) {
		if (action === 'folder') this.createFolder();
		if (action === 'save-selected') this.saveSelectedComponent();
		if (action === 'delete-folder') this.deleteActiveFolder();
	};

	PersonalLibrary.prototype.createFolder = function () {
		var name = global.prompt('Tên thư mục', 'Linh kiện mới');
		if (!name) return;
		this.data.folders.push({ id: 'fld_' + Date.now().toString(36), name: String(name), parent: '' });
		this.save();
		this.render();
	};

	PersonalLibrary.prototype.deleteActiveFolder = function () {
		if (this.activeFolder === 'default') return;
		this.data.items = this.data.items.filter(function (item) { return item.folder !== this.activeFolder; }, this);
		this.data.folders = this.data.folders.filter(function (folder) { return folder.id !== this.activeFolder; }, this);
		this.activeFolder = 'default';
		this.save();
		this.render();
	};

	PersonalLibrary.prototype.saveSelectedComponent = function () {
		var component = this.app.selectedComponent();
		if (!component) {
			this.app.showMessage('Chọn một linh kiện trước khi lưu vào thư viện.');
			return;
		}
		var template = this.templateFromComponent(component);
		if (!template) return;
		this.data.items.push({
			id: 'lib_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
			folder: this.activeFolder,
			name: (component.ref || component.name || 'Component') + ' · ' + (component.package || ''),
			template: template,
			created_at: new Date().toISOString()
		});
		this.save();
		this.render();
	};

	PersonalLibrary.prototype.templateFromComponent = function (component) {
		var objects = this.app.componentObjects(component.id);
		var pads = objects.filter(function (obj) { return obj.type === 'pad' || obj.type === 'via'; });
		if (!pads.length) return null;
		var pins = pads.map(function (obj) {
			var g = obj.geometry || {};
			return {
				number: String(g.ai_pin || ''),
				name: String(g.pin_name || ''),
				x: Number(g.x || 0) - Number(component.x || 0),
				y: Number(g.y || 0) - Number(component.y || 0),
				shape: g.shape || 'round',
				width: Number(g.width || g.diameter || 1.6),
				height: Number(g.height || g.diameter || 1.6),
				diameter: Number(g.diameter || g.width || 1.6),
				drill: Number(g.drill || 0),
				smd: Number(g.drill || 0) <= 0
			};
		});
		var outline = this.outlineFromObjects(component, objects);
		return {
			type: 'ADD_FOOTPRINT',
			ref: component.ref || 'U1',
			component: component.name || '',
			value: component.value || '',
			package: component.package || '',
			side: component.side || 'top',
			x: 0,
			y: 0,
			outline: outline,
			pins: pins
		};
	};

	PersonalLibrary.prototype.outlineFromObjects = function (component, objects) {
		var outline = objects.filter(function (obj) { return obj.type === 'shape' && (obj.geometry || {}).shape === 'rectangle'; })[0];
		if (outline) return { width: Number(outline.geometry.width || 0), height: Number(outline.geometry.height || 0) };
		var bounds = this.bounds(objects);
		return { width: bounds.w, height: bounds.h };
	};

	PersonalLibrary.prototype.bounds = function (objects) {
		var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		objects.forEach(function (obj) {
			var b = global.DATPCBTracerTools.getObjectBounds(obj);
			minX = Math.min(minX, b.minX);
			minY = Math.min(minY, b.minY);
			maxX = Math.max(maxX, b.maxX);
			maxY = Math.max(maxY, b.maxY);
		});
		return { w: isFinite(minX) ? maxX - minX : 0, h: isFinite(minY) ? maxY - minY : 0 };
	};

	PersonalLibrary.prototype.insertItem = function (id) {
		var item = this.data.items.filter(function (entry) { return entry.id === id; })[0];
		if (!item) return;
		var command = global.DATPCBTracerClone(item.template);
		command.x = this.app.cursor ? this.app.cursor.x : 10;
		command.y = this.app.cursor ? this.app.cursor.y : 10;
		command.side = this.app.activeSide || command.side || 'top';
		this.executor.execute([command]);
		this.close();
	};

	PersonalLibrary.prototype.removeItem = function (id) {
		this.data.items = this.data.items.filter(function (entry) { return entry.id !== id; });
		this.save();
		this.render();
	};

	PersonalLibrary.prototype.render = function () {
		this.folderList.textContent = '';
		this.data.folders.forEach(function (folder) {
			var button = el('button', 'dat-easy-library-folder', folder.name);
			button.type = 'button';
			button.setAttribute('data-library-folder', folder.id);
			button.classList.toggle('is-active', folder.id === this.activeFolder);
			this.folderList.appendChild(button);
		}, this);
		this.itemList.textContent = '';
		var items = this.data.items.filter(function (item) { return item.folder === this.activeFolder; }, this);
		if (!items.length) {
			this.itemList.appendChild(el('div', 'dat-easy-empty', 'Chưa có linh kiện trong thư mục này.'));
			return;
		}
		items.forEach(function (item) {
			var row = el('div', 'dat-easy-library-item');
			var main = el('button', '', item.name);
			main.type = 'button';
			main.setAttribute('data-library-item', item.id);
			var remove = el('button', 'dat-easy-icon-button', '×');
			remove.type = 'button';
			remove.setAttribute('data-library-remove', item.id);
			row.appendChild(main);
			row.appendChild(remove);
			this.itemList.appendChild(row);
		}, this);
	};

	global.DATPCBPersonalLibrary = PersonalLibrary;
})(window, document);
