(function (global) {
	'use strict';

	// Translates JSON commands into the existing project object model.
	function EditorCommandExecutor(app) {
		this.app = app;
	}

	EditorCommandExecutor.prototype.execute = function (commands) {
		if (!Array.isArray(commands) || !commands.length) return;
		this.app.history.push(this.app.state);
		commands.forEach(function (command) {
			if (command.type === 'ADD_FOOTPRINT') this.addFootprint(command);
			if (command.type === 'ADD_COMPONENT') this.addComponent(command);
			if (command.type === 'CONNECT') this.connect(command);
		}, this);
		this.app.markDirty();
	};

	EditorCommandExecutor.prototype.addFootprint = function (command) {
		var x = Number(command.x || 0);
		var y = Number(command.y || 0);
		var ref = String(command.ref || command.component || 'U1');
		var side = command.side === 'bottom' ? 'bottom' : (this.app.activeSide || 'top');
		var layer = global.DATPCBTracerTools.layerForTool('pad_round', side);
		var componentId = 'cmp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
		var objects = [];
		var pins = [];
		(command.pins || []).forEach(function (pin) {
			var px = x + Number(pin.x || 0);
			var py = y + Number(pin.y || 0);
			var smd = !!pin.smd;
			var shape = pin.shape === 'rect' || pin.shape === 'oval' ? pin.shape : 'round';
			var padId = global.DATPCBTracerTools.makeId();
			var g = { x: px, y: py, shape: shape, side: side, component_id: componentId, component_ref: ref, ai_ref: ref, ai_pin: String(pin.number || ''), pin_name: String(pin.name || ''), component_package: String(command.package || '') };
			if (pin.suppress_pin_name) g.suppress_pin_name = true;
			if (shape === 'round') {
				g.diameter = Number(pin.diameter || pin.width || 1.6);
				g.drill = smd ? 0 : Number(pin.drill || 0.8);
			} else {
				g.width = Number(pin.width || pin.diameter || 1.6);
				g.height = Number(pin.height || pin.diameter || 1.6);
				g.rotation = Number(pin.rotation || 0);
				g.drill = smd ? 0 : Number(pin.drill || 0.8);
				g.mount = smd ? 'smd' : 'th';
			}
			objects.push({
				id: padId,
				type: 'pad',
				layer: layer,
				geometry: g,
				style: {},
				locked: false,
				visible: true,
				note: ref + '.' + String(pin.number || '') + (pin.name ? ' ' + pin.name : '')
			});
			pins.push({ number: String(pin.number || ''), name: String(pin.name || ''), object_id: padId });
		});
		var outline = command.outline || {};
		var ow = Number(outline.width || 0);
		var oh = Number(outline.height || 0);
		this.addSilkscreen(objects, command, componentId, ref, side, x, y);
		if (ow > 0 && oh > 0) {
			objects.push({
				id: global.DATPCBTracerTools.makeId(),
				type: 'shape',
				layer: 'mechanical',
				geometry: { shape: 'rectangle', x: x, y: y, width: ow, height: oh, rotation: 0, component_id: componentId, component_ref: ref },
				style: {},
				locked: false,
				visible: true,
				note: ref + ' outline'
			});
		}
		var labelText = command.silk && command.silk.length ? ref : ref + (command.package ? ' ' + String(command.package) : '');
		objects.push({
			id: global.DATPCBTracerTools.makeId(),
			type: 'annotation',
			layer: 'annotation',
			geometry: { x: x - Math.max(2, ow / 2 || 3), y: y - Math.max(1.2, oh / 2 + 1 || 3), text: labelText, size: 1.2, side: side, component_id: componentId, component_ref: ref },
			style: {},
			locked: false,
			visible: true,
			note: 'AI footprint ' + String(command.package || '')
		});
		if (!this.app.state.components) this.app.state.components = [];
		this.app.state.components.push({
			id: componentId,
			ref: ref,
			name: String(command.component || ''),
			value: String(command.value || ''),
			package: String(command.package || ''),
			side: side,
			x: x,
			y: y,
			rotation: 0,
			locked: false,
			visible: true,
			pins: pins,
			metadata: { source: 'ai-footprint' }
		});
		Array.prototype.push.apply(this.app.state.objects, objects);
		this.app.selected = objects.length ? objects.map(function (obj) { return obj.id; }) : this.app.selected;
	};

	EditorCommandExecutor.prototype.addSilkscreen = function (objects, command, componentId, ref, side, x, y) {
		if (!Array.isArray(command.silk)) return;
		command.silk.forEach(function (line) {
			objects.push({
				id: global.DATPCBTracerTools.makeId(),
				type: 'shape',
				layer: 'annotation',
				geometry: {
					shape: 'line',
					x1: x + Number(line.x1 || 0),
					y1: y + Number(line.y1 || 0),
					x2: x + Number(line.x2 || 0),
					y2: y + Number(line.y2 || 0),
					strokeWidth: Number(line.width || 0.12),
					side: side,
					component_id: componentId,
					component_ref: ref,
					silk: true
				},
				style: { role: 'silkscreen' },
				locked: false,
				visible: true,
				note: ref + ' silkscreen'
			});
		});
	};

	EditorCommandExecutor.prototype.addComponent = function (command) {
		var x = Number(command.x || 0);
		var y = Number(command.y || 0);
		var ref = String(command.ref || command.component || 'U1');
		var side = this.app.activeSide;
		var layer = global.DATPCBTracerTools.layerForTool('pad_round', side);
		var pinA = {
			id: global.DATPCBTracerTools.makeId(),
			type: 'pad',
			layer: layer,
			geometry: { shape: 'round', x: x - 2.54, y: y, diameter: 1.6, drill: 0.8, side: side, ai_ref: ref, ai_pin: '1' },
			style: {},
			locked: false,
			visible: true,
			note: ref + '.1'
		};
		var pinB = {
			id: global.DATPCBTracerTools.makeId(),
			type: 'pad',
			layer: layer,
			geometry: { shape: 'round', x: x + 2.54, y: y, diameter: 1.6, drill: 0.8, side: side, ai_ref: ref, ai_pin: '2' },
			style: {},
			locked: false,
			visible: true,
			note: ref + '.2'
		};
		var label = {
			id: global.DATPCBTracerTools.makeId(),
			type: 'annotation',
			layer: 'annotation',
			geometry: { x: x - 2.8, y: y - 2.2, text: ref + ' ' + String(command.value || ''), size: 2.2 },
			style: {},
			locked: false,
			visible: true,
			note: 'AI mock component'
		};
		this.app.state.objects.push(pinA, pinB, label);
		this.app.selected = [label.id];
	};

	EditorCommandExecutor.prototype.connect = function (command) {
		var a = this.findPin(command.from);
		var b = this.findPin(command.to);
		if (!a || !b) return;
		this.app.state.objects.push({
			id: global.DATPCBTracerTools.makeId(),
			type: 'track',
			layer: this.app.activeSide === 'bottom' ? 'bottom_copper' : 'top_copper',
			geometry: { x1: a.x, y1: a.y, x2: b.x, y2: b.y, width: this.app.options.trackWidth || 0.4 },
			style: {},
			locked: false,
			visible: true,
			note: 'AI mock connect ' + command.from + ' -> ' + command.to
		});
	};

	EditorCommandExecutor.prototype.findPin = function (pinName) {
		var parts = String(pinName || '').split('.');
		var ref = parts[0], pin = parts[1];
		var found = null;
		this.app.state.objects.some(function (obj) {
			var g = obj.geometry || {};
			if ((obj.type === 'pad' || obj.type === 'via') && g.ai_ref === ref && String(g.ai_pin) === String(pin)) {
				found = { x: Number(g.x || 0), y: Number(g.y || 0) };
				return true;
			}
			return false;
		});
		return found;
	};

	global.DATPCBEditorCommandExecutor = EditorCommandExecutor;
})(window);
