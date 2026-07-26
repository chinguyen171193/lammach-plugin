(function (global) {
	'use strict';

	// Translates JSON commands into the existing project object model.
	function EditorCommandExecutor(app) {
		this.app = app;
	}

	EditorCommandExecutor.prototype.execute = function (commands) {
		if (!Array.isArray(commands) || !commands.length) return;
		this.app.history.push(this.app.state);
		var localPins = {};
		commands.forEach(function (command) {
			if (command.type === 'ADD_FOOTPRINT') this.addFootprint(command, localPins);
			if (command.type === 'ADD_COMPONENT') this.addComponent(command);
			if (command.type === 'CONNECT') this.connect(command, localPins);
			if (command.type === 'DISCONNECT') this.disconnect(command, localPins);
			if (command.type === 'MOVE_COMPONENT') this.moveComponent(command);
			if (command.type === 'DELETE_COMPONENT') this.deleteComponentByRef(command);
			if (command.type === 'SET_VALUE') this.setValue(command);
		}, this);
		if (this.app.syncAnchoredTracks) this.app.syncAnchoredTracks();
		this.app.markDirty();
	};

	EditorCommandExecutor.prototype.findComponentByRef = function (ref) {
		return (this.app.state.components || []).filter(function (c) { return c.ref === ref; })[0] || null;
	};

	EditorCommandExecutor.prototype.moveComponent = function (command) {
		var component = this.findComponentByRef(String(command.ref || ''));
		if (!component) return;
		var dx = Number(command.x || 0) - Number(component.x || 0);
		var dy = Number(command.y || 0) - Number(component.y || 0);
		if (!dx && !dy) return;
		component.x = Number(command.x || 0);
		component.y = Number(command.y || 0);
		this.app.componentObjects(component.id).forEach(function (obj) {
			global.DATPCBTracerTools.moveObject(obj, dx, dy);
		});
	};

	EditorCommandExecutor.prototype.deleteComponentByRef = function (command) {
		var component = this.findComponentByRef(String(command.ref || ''));
		if (!component) return;
		var idSet = {};
		this.app.componentObjects(component.id).forEach(function (obj) { idSet[obj.id] = true; });
		this.app.state.objects = this.app.state.objects.filter(function (obj) {
			if (idSet[obj.id]) return false;
			var g = obj.geometry || {};
			if (obj.type === 'track' && (idSet[g.anchor1] || idSet[g.anchor2])) return false;
			return true;
		});
		this.app.state.components = this.app.state.components.filter(function (c) { return c.id !== component.id; });
		this.app.selected = this.app.selected.filter(function (id) { return !idSet[id]; });
	};

	EditorCommandExecutor.prototype.setValue = function (command) {
		var component = this.findComponentByRef(String(command.ref || ''));
		if (!component) return;
		component.value = String(command.value || '');
	};

	EditorCommandExecutor.prototype.disconnect = function (command, localPins) {
		var a = (localPins && localPins[command.from]) || this.findPin(command.from);
		var b = (localPins && localPins[command.to]) || this.findPin(command.to);
		if (!a || !b || !a.id || !b.id) return;
		this.app.state.objects = this.app.state.objects.filter(function (obj) {
			if (obj.type !== 'track') return true;
			var g = obj.geometry || {};
			var matches = (g.anchor1 === a.id && g.anchor2 === b.id) || (g.anchor1 === b.id && g.anchor2 === a.id);
			return !matches;
		});
	};

	EditorCommandExecutor.prototype.nextAvailableRef = function (ref) {
		var match = String(ref || 'U1').match(/^([A-Za-z_]+)(\d*)$/);
		var prefix = match ? match[1] : 'U';
		var start = match && match[2] ? Number(match[2]) : 1;
		var used = {};
		(this.app.state.components || []).forEach(function (component) {
			var m = String(component.ref || '').match(/^([A-Za-z_]+)(\d+)$/);
			if (m && m[1].toUpperCase() === prefix.toUpperCase()) used[Number(m[2])] = true;
		});
		var n = start > 0 ? start : 1;
		while (used[n]) n++;
		return prefix + n;
	};

	EditorCommandExecutor.prototype.addFootprint = function (command, localPins) {
		var x = Number(command.x || 0);
		var y = Number(command.y || 0);
		var requestedRef = String(command.ref || command.component || 'U1');
		var ref = this.nextAvailableRef(requestedRef);
		var side = command.side === 'bottom' ? 'bottom' : (this.app.activeSide || 'top');
		var mirror = side === 'bottom' ? -1 : 1;
		var layer = global.DATPCBTracerTools.layerForTool('pad_round', side);
		var componentId = 'cmp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
		var objects = [];
		var pins = [];
		(command.pins || []).forEach(function (pin) {
			var px = x + mirror * Number(pin.x || 0);
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
				g.rotation = mirror === -1 ? (180 - Number(pin.rotation || 0)) : Number(pin.rotation || 0);
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
			if (localPins) localPins[requestedRef + '.' + String(pin.number || '')] = { x: px, y: py, side: side, id: padId };
		});
		var outline = command.outline || {};
		var ow = Number(outline.width || 0);
		var oh = Number(outline.height || 0);
		this.addSilkscreen(objects, command, componentId, ref, side, x, y, mirror);
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

	EditorCommandExecutor.prototype.addSilkscreen = function (objects, command, componentId, ref, side, x, y, mirror) {
		if (!Array.isArray(command.silk)) return;
		mirror = mirror || 1;
		command.silk.forEach(function (line) {
			objects.push({
				id: global.DATPCBTracerTools.makeId(),
				type: 'shape',
				layer: 'annotation',
				geometry: {
					shape: 'line',
					x1: x + mirror * Number(line.x1 || 0),
					y1: y + Number(line.y1 || 0),
					x2: x + mirror * Number(line.x2 || 0),
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
		var ref = this.nextAvailableRef(String(command.ref || command.component || 'U1'));
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

	EditorCommandExecutor.prototype.connect = function (command, localPins) {
		var a = (localPins && localPins[command.from]) || this.findPin(command.from);
		var b = (localPins && localPins[command.to]) || this.findPin(command.to);
		if (!a || !b) return;
		var side = a.side || b.side || this.app.activeSide;
		var geometry = { x1: a.x, y1: a.y, x2: b.x, y2: b.y, width: this.app.options.trackWidth || 0.4, bow: 0 };
		if (a.id) geometry.anchor1 = a.id;
		if (b.id) geometry.anchor2 = b.id;
		this.app.state.objects.push({
			id: global.DATPCBTracerTools.makeId(),
			type: 'track',
			layer: side === 'bottom' ? 'bottom_copper' : 'top_copper',
			geometry: geometry,
			style: {},
			locked: false,
			visible: true,
			note: 'AI connect ' + command.from + ' -> ' + command.to
		});
	};

	EditorCommandExecutor.prototype.findPin = function (pinName) {
		var parts = String(pinName || '').split('.');
		var ref = parts[0], pin = parts[1];
		var found = null;
		this.app.state.objects.some(function (obj) {
			var g = obj.geometry || {};
			if ((obj.type === 'pad' || obj.type === 'via') && g.ai_ref === ref && String(g.ai_pin) === String(pin)) {
				found = { x: Number(g.x || 0), y: Number(g.y || 0), side: g.side, id: obj.id };
				return true;
			}
			return false;
		});
		return found;
	};

	global.DATPCBEditorCommandExecutor = EditorCommandExecutor;
})(window);
