(function (global, document) {
	'use strict';

	function el(tag, className, text) {
		var node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined) node.textContent = text;
		return node;
	}

	function PropertiesPanel(app) {
		this.app = app;
		this.collapsed = {};
	}

	PropertiesPanel.prototype.render = function (panel) {
		panel.textContent = '';
		panel.classList.add('dat-easy-properties');
		var selected = this.app.selectedObjects();
		var obj = selected[0];
		if (!obj) {
			panel.appendChild(el('div', 'dat-easy-empty', 'Chưa chọn đối tượng'));
			return;
		}
		var component = this.app.selectedComponent();
		var pin = component ? this.app.activePinObject() : null;
		if (pin && this.app.getComponentIdForObject(pin) !== component.id) pin = null;
		if (component) {
			this.renderComponent(panel, component, pin);
			return;
		}
		this.renderObject(panel, obj);
	};

	PropertiesPanel.prototype.renderComponent = function (panel, component, pin) {
		var pinGeometry = pin ? (pin.geometry || {}) : null;
		this.group(panel, 'Thuộc tính', [
			this.field('Tên linh kiện', 'name', component.name || '', 'component', 'text'),
			this.field('Reference', 'ref', component.ref || '', 'component', 'text'),
			this.field('Value', 'value', component.value || '', 'component', 'text'),
			this.field('Package', 'package', component.package || '', 'component', 'text'),
			this.field('Layer', 'side', component.side || 'top', 'component', 'select', '', ['top', 'bottom']),
			this.field('Rotation', 'rotation', component.rotation || 0, 'component', 'number', 'deg'),
			this.field('Locked', 'locked', !!component.locked, 'component', 'checkbox'),
			this.field('Visible', 'visible', component.visible !== false, 'component', 'checkbox'),
			this.readonly('Net', pinGeometry ? (pinGeometry.net || '') : ''),
			this.readonly('Footprint', component.package || ''),
			this.readonly('ID', component.id)
		]);
		if (pin) {
			this.group(panel, 'Chân đang chọn', [
				this.field('Pin number', 'ai_pin', pinGeometry.ai_pin || '', 'geometry', 'text'),
				this.field('Pin name', 'pin_name', pinGeometry.pin_name || '', 'geometry', 'text'),
				this.field('Net', 'net', pinGeometry.net || '', 'geometry', 'text'),
				this.field('Pad Shape', 'shape', pinGeometry.shape || 'rect', 'geometry', 'select', '', ['round', 'rect', 'oval']),
				this.field('Pad Size W', 'width', pinGeometry.width !== undefined ? pinGeometry.width : pinGeometry.diameter, 'geometry', 'number', 'mm'),
				this.field('Pad Size H', 'height', pinGeometry.height !== undefined ? pinGeometry.height : pinGeometry.diameter, 'geometry', 'number', 'mm'),
				this.field('Hole Size', 'drill', pinGeometry.drill || 0, 'geometry', 'number', 'mm')
			]);
			var button = el('button', 'dat-easy-secondary-button', 'Xem linh kiện');
			button.type = 'button';
			button.setAttribute('data-action', 'component-properties');
			panel.appendChild(button);
		}
		this.group(panel, 'Thông số hình học', [
			this.field('X', 'x', component.x || 0, 'component', 'number', 'mm'),
			this.field('Y', 'y', component.y || 0, 'component', 'number', 'mm'),
			this.readonly('Center X', this.format(component.x || 0) + ' mm'),
			this.readonly('Center Y', this.format(component.y || 0) + ' mm'),
			this.readonly('Bounding Box', this.boundsText(this.app.componentObjects(component.id)))
		]);
		this.group(panel, 'Thông số PCB', [
			this.readonly('Solder Mask', 'Auto'),
			this.readonly('Paste Mask', 'Auto'),
			this.readonly('Thermal Relief', 'Default'),
			this.readonly('Clearance', 'Rule'),
			this.readonly('Copper Area', this.copperAreaText(component.id))
		]);
	};

	PropertiesPanel.prototype.renderObject = function (panel, obj) {
		var g = obj.geometry || {};
		this.group(panel, 'Thuộc tính', [
			this.readonly('ID', obj.id),
			this.readonly('Type', obj.type),
			this.field('Layer', 'layer', obj.layer, 'root', 'select', '', Object.keys(this.app.state.layers)),
			this.field('Locked', 'locked', !!obj.locked, 'root', 'checkbox'),
			this.field('Visible', 'visible', obj.visible !== false, 'root', 'checkbox'),
			this.field('Note', 'note', obj.note || '', 'root', 'text')
		]);
		var geometry = [];
		['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'width', 'height', 'diameter', 'drill', 'rotation', 'radius', 'startAngle', 'endAngle'].forEach(function (key) {
			if (g[key] !== undefined) geometry.push(this.field(this.pretty(key), key, g[key], 'geometry', 'number', this.unitFor(key)));
		}, this);
		if (geometry.length) this.group(panel, 'Thông số hình học', geometry);
	};

	PropertiesPanel.prototype.group = function (panel, title, fields) {
		var group = el('section', 'dat-easy-prop-group');
		var header = el('button', 'dat-easy-prop-group-header');
		header.type = 'button';
		header.textContent = title;
		var body = el('div', 'dat-easy-prop-group-body');
		var key = title.toLowerCase();
		if (this.collapsed[key]) body.hidden = true;
		header.addEventListener('click', function () {
			this.collapsed[key] = !this.collapsed[key];
			body.hidden = this.collapsed[key];
		}.bind(this));
		fields.forEach(function (field) { if (field) body.appendChild(field); });
		group.appendChild(header);
		group.appendChild(body);
		panel.appendChild(group);
	};

	PropertiesPanel.prototype.field = function (labelText, key, value, target, type, unit, options) {
		var row = el('label', 'dat-easy-prop-row');
		row.appendChild(el('span', 'dat-easy-prop-label', labelText));
		var control = el('span', 'dat-easy-prop-control');
		var input;
		if (type === 'select') {
			input = document.createElement('select');
			(options || []).forEach(function (option) {
				var opt = document.createElement('option');
				opt.value = option;
				opt.textContent = option;
				input.appendChild(opt);
			});
			input.value = value;
		} else {
			input = document.createElement('input');
			input.type = type;
			if (type === 'checkbox') input.checked = !!value;
			else input.value = value;
			if (type === 'number') input.step = '0.01';
		}
		input.setAttribute('data-prop', key);
		input.setAttribute('data-prop-target', target);
		control.appendChild(input);
		if (unit) control.appendChild(el('span', 'dat-easy-unit', unit));
		row.appendChild(control);
		return row;
	};

	PropertiesPanel.prototype.readonly = function (labelText, value) {
		var row = el('div', 'dat-easy-prop-row is-readonly');
		row.appendChild(el('span', 'dat-easy-prop-label', labelText));
		row.appendChild(el('span', 'dat-easy-prop-value', value === undefined || value === '' ? '-' : String(value)));
		return row;
	};

	PropertiesPanel.prototype.pretty = function (key) {
		return key.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
	};

	PropertiesPanel.prototype.unitFor = function (key) {
		if (key === 'rotation' || key === 'startAngle' || key === 'endAngle') return 'deg';
		return 'mm';
	};

	PropertiesPanel.prototype.format = function (value) {
		return Number(value || 0).toFixed(2);
	};

	PropertiesPanel.prototype.boundsText = function (objects) {
		if (!objects.length) return '-';
		var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		objects.forEach(function (obj) {
			var b = global.DATPCBTracerTools.getObjectBounds(obj);
			minX = Math.min(minX, b.minX);
			minY = Math.min(minY, b.minY);
			maxX = Math.max(maxX, b.maxX);
			maxY = Math.max(maxY, b.maxY);
		});
		if (!isFinite(minX)) return '-';
		return this.format(maxX - minX) + ' × ' + this.format(maxY - minY) + ' mm';
	};

	PropertiesPanel.prototype.copperAreaText = function (componentId) {
		var area = 0;
		this.app.componentObjects(componentId).forEach(function (obj) {
			var g = obj.geometry || {};
			if (obj.type !== 'pad' && obj.type !== 'via') return;
			var w = Number(g.width || g.diameter || 0);
			var h = Number(g.height || g.diameter || w);
			area += w * h;
		});
		return this.format(area) + ' mm²';
	};

	global.DATPCBPropertiesPanel = PropertiesPanel;
})(window, document);
