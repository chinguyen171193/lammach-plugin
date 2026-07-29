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
		var affectedLinks = {};
		this.app.state.objects.forEach(function (obj) {
			if (obj.type !== 'track') return;
			var g = obj.geometry || {};
			if ((idSet[g.anchor1] || idSet[g.anchor2]) && g.net_link) affectedLinks[g.net_link] = true;
		});
		this.app.state.objects = this.app.state.objects.filter(function (obj) {
			if (idSet[obj.id]) return false;
			var g = obj.geometry || {};
			if (obj.type === 'track') {
				if (idSet[g.anchor1] || idSet[g.anchor2]) return false;
				if (g.net_link && affectedLinks[g.net_link]) return false;
			}
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
		var link1 = a.id + '__' + b.id;
		var link2 = b.id + '__' + a.id;
		this.app.state.objects = this.app.state.objects.filter(function (obj) {
			if (obj.type !== 'track') return true;
			var g = obj.geometry || {};
			if (g.net_link === link1 || g.net_link === link2) return false;
			var directMatch = (g.anchor1 === a.id && g.anchor2 === b.id) || (g.anchor1 === b.id && g.anchor2 === a.id);
			return !directMatch;
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
		var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
			var halfW = Number(g.width || g.diameter || 1) / 2;
			var halfH = Number(g.height || g.diameter || 1) / 2;
			minX = Math.min(minX, px - halfW); maxX = Math.max(maxX, px + halfW);
			minY = Math.min(minY, py - halfH); maxY = Math.max(maxY, py + halfH);
		});
		var outline = command.outline || {};
		var ow = Number(outline.width || 0);
		var oh = Number(outline.height || 0);
		if (ow > 0) { minX = Math.min(minX, x - ow / 2); maxX = Math.max(maxX, x + ow / 2); }
		if (oh > 0) { minY = Math.min(minY, y - oh / 2); maxY = Math.max(maxY, y + oh / 2); }
		if (!isFinite(minX)) { minX = x; maxX = x; }
		if (!isFinite(minY)) { minY = y; maxY = y; }
		// In lua that cua nha san xuat (tu thu vien LCSC) neu co: no la duong bao
		// than nam GIUA hai hang chan cong cham danh dau chan 1, dung nhu tren
		// linh kien that. Chi khi khong co moi tu ve khung bao quanh - do la phao
		// cho footprint AI tu dung, khong phai cach bieu dien dung.
		var realSilk = Array.isArray(command.silk) ? command.silk : [];
		if (realSilk.length) {
			this.addRealSilk(objects, realSilk, x, y, mirror, side, componentId, ref);
		} else {
			this.addAutoSilk(objects, minX, minY, maxX, maxY, side, componentId, ref);
		}
		// Khung co khi chi de tham chieu; khi da co in lua that thi no trung lap
		// va gay hieu nham la hai duong bao khac nhau.
		if (!realSilk.length && ow > 0 && oh > 0) {
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
		// Dat nhan ngay tren canh tren cung cua vung bao quanh chan/outline thuc te,
		// thay vi dua vao "outline" AI khai bao (co the khong khop voi chan that),
		// de nhan luon nam sat than linh kien du AI cho kich thuoc gi.
		// EasyEDA chi in ma linh kien (U1) len bo. Ten vo cua thu vien LCSC dai
		// hang chuc ky tu ("TSSOP-20_L6.5-W4.4-P0.65-LS6.4-BL") nen de nguyen se
		// choan het ban mach - giu no o note de tra cuu trong bang lop thay vi ve.
		var labelText = ref;
		objects.push({
			id: global.DATPCBTracerTools.makeId(),
			type: 'annotation',
			layer: 'annotation',
			geometry: { x: minX, y: minY - 1.6, text: labelText, size: 1.2, side: side, component_id: componentId, component_ref: ref },
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

	// In lua that: toa do trong command la tuong doi so voi tam linh kien, doi
	// sang toa do bo va lat theo mirror giong het cach dat chan.
	EditorCommandExecutor.prototype.addRealSilk = function (objects, silk, x, y, mirror, side, componentId, ref) {
		silk.forEach(function (item) {
			var g;
			if (item.shape === 'circle') {
				g = {
					shape: 'circle',
					x: x + mirror * Number(item.x || 0),
					y: y + Number(item.y || 0),
					radius: Number(item.radius || 0.15),
					strokeWidth: Number(item.width || 0.12)
				};
			} else {
				g = {
					shape: 'line',
					x1: x + mirror * Number(item.x1 || 0),
					y1: y + Number(item.y1 || 0),
					x2: x + mirror * Number(item.x2 || 0),
					y2: y + Number(item.y2 || 0),
					strokeWidth: Number(item.width || 0.12)
				};
			}
			g.side = side;
			g.component_id = componentId;
			g.component_ref = ref;
			objects.push({
				id: global.DATPCBTracerTools.makeId(),
				type: 'shape',
				layer: 'annotation',
				geometry: g,
				style: {},
				locked: false,
				visible: true,
				note: ref + ' silk'
			});
		});
	};

	EditorCommandExecutor.prototype.addAutoSilk = function (objects, minX, minY, maxX, maxY, side, componentId, ref) {
		var margin = 0.25;
		var x1 = minX - margin, y1 = minY - margin, x2 = maxX + margin, y2 = maxY + margin;
		if (x2 - x1 <= 0 || y2 - y1 <= 0) return;
		var corner = Math.min(0.8, (x2 - x1) / 3, (y2 - y1) / 3);
		var lines = [
			{ x1: x1, y1: y1, x2: x2, y2: y1 },
			{ x1: x1, y1: y1, x2: x1, y2: y2 },
			{ x1: x2, y1: y1, x2: x2, y2: y2 },
			{ x1: x1, y1: y2, x2: x2, y2: y2 },
			{ x1: x1, y1: y1, x2: x1 + corner, y2: y1 + corner }
		];
		lines.forEach(function (line) {
			objects.push({
				id: global.DATPCBTracerTools.makeId(),
				type: 'shape',
				layer: 'annotation',
				geometry: {
					shape: 'line',
					x1: line.x1,
					y1: line.y1,
					x2: line.x2,
					y2: line.y2,
					strokeWidth: 0.12,
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
		var layer = side === 'bottom' ? 'bottom_copper' : 'top_copper';
		var width = this.app.options.trackWidth || 0.4;
		var note = 'AI connect ' + command.from + ' -> ' + command.to;
		var linkId = (a.id && b.id) ? (a.id + '__' + b.id) : null;
		var self = this;
		function pushSegment(p1, p2, anchor1, anchor2) {
			var geometry = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, width: width, bow: 0 };
			if (anchor1) geometry.anchor1 = anchor1;
			if (anchor2) geometry.anchor2 = anchor2;
			if (linkId) geometry.net_link = linkId;
			self.app.state.objects.push({
				id: global.DATPCBTracerTools.makeId(),
				type: 'track',
				layer: layer,
				geometry: geometry,
				style: {},
				locked: false,
				visible: true,
				note: note
			});
		}
		// Thang hang san (cung X hoac cung Y) thi mot doan la du.
		if (Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01) {
			pushSegment(a, b, a.id, b.id);
			return;
		}
		// Nguoc lai di mot doan cheo 45 do roi mot doan thang, dung quy uoc dinh
		// tuyen cua EasyEDA va cua PCB noi chung. Goc vuong 90 do bi tranh vi goc
		// nhon ben trong giu axit khi an mon va gay gian doan tro khang; duong cheo
		// tuy y thi khong theo luoi 45 do nen kho sua tay ve sau.
		var dx = b.x - a.x, dy = b.y - a.y;
		var run = Math.min(Math.abs(dx), Math.abs(dy));
		var corner = {
			x: a.x + (dx < 0 ? -run : run),
			y: a.y + (dy < 0 ? -run : run)
		};
		pushSegment(a, corner, a.id, null);
		pushSegment(corner, b, null, b.id);
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
