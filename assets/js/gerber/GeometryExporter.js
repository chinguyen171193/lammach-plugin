(function (global) {
	'use strict';

	function GeometryExporter(project, options) {
		this.project = project || {};
		this.options = options || {};
		this.layers = global.DATPCBGerberLayerMapper.createLayers();
		this.drillHoles = [];
		this.warnings = [];
	}

	GeometryExporter.prototype.export = function () {
		var objects = (this.project.objects || []).filter(function (obj) {
			return obj && obj.visible !== false;
		});
		objects.forEach(this.exportObject, this);
		this.exportDefaultBoardOutline();
		this.validate(objects);
		return { layers: this.layers, drillHoles: this.drillHoles, warnings: this.warnings };
	};

	GeometryExporter.prototype.exportObject = function (obj) {
		if (obj.type === 'track') this.exportTrack(obj);
		else if (obj.type === 'pad') this.exportPad(obj);
		else if (obj.type === 'via') this.exportVia(obj);
		else if (obj.type === 'drill') this.exportDrill(obj);
		else if (obj.type === 'outline') this.exportOutline(obj);
		else if (obj.type === 'cutout') this.exportOutline(obj);
		else if (obj.type === 'slot') this.exportSlot(obj);
		else if (obj.type === 'region') this.exportRegion(obj);
		else if (obj.type === 'annotation') this.exportAnnotation(obj);
		else if (obj.type === 'shape') this.exportShape(obj);
	};

	GeometryExporter.prototype.exportTrack = function (obj) {
		var g = obj.geometry || {};
		var layerId = global.DATPCBGerberLayerMapper.copperLayerForObject(obj);
		var layer = this.layers[layerId === 'bottomCopper' ? 'bottomCopper' : 'topCopper'];
		var width = Number(g.width || 0.4);
		if (Number(g.bow || 0) && global.DATPCBTracerTools && global.DATPCBTracerTools.sampleArcPoints) {
			var pts = global.DATPCBTracerTools.sampleArcPoints(g, 24);
			if (pts && pts.length > 1) {
				for (var i = 1; i < pts.length; i++) {
					layer.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, width);
				}
				return;
			}
		}
		layer.line(g.x1, g.y1, g.x2, g.y2, width);
	};

	GeometryExporter.prototype.exportPad = function (obj) {
		var g = obj.geometry || {};
		var params = this.padParams(g);
		var shape = this.padShape(g);
		var layerId = global.DATPCBGerberLayerMapper.copperLayerForObject(obj);
		this.layers[layerId === 'bottomCopper' ? 'bottomCopper' : 'topCopper'].flash(shape, g.x, g.y, params);
		global.DATPCBGerberLayerMapper.maskLayersForObject(obj).forEach(function (maskId) {
			this.layers[maskId].flash(shape, g.x, g.y, this.expandParams(params, 0.1));
		}, this);
		if (g.shape === 'roundrect') {
			this.warnings.push('Rounded rectangle pad exported as standard rectangle aperture (corner radius not encoded in Gerber): ' + obj.id);
		}
		if (Number(g.drill || 0) > 0) {
			this.drillHoles.push({ x: Number(g.x || 0), y: Number(g.y || 0), diameter: Number(g.drill) });
		}
	};

	GeometryExporter.prototype.exportVia = function (obj) {
		var g = obj.geometry || {};
		var diameter = Number(g.diameter || 1.2);
		this.layers.topCopper.flash('circle', g.x, g.y, { diameter: diameter });
		this.layers.bottomCopper.flash('circle', g.x, g.y, { diameter: diameter });
		this.layers.topMask.flash('circle', g.x, g.y, { diameter: diameter + 0.1 });
		this.layers.bottomMask.flash('circle', g.x, g.y, { diameter: diameter + 0.1 });
		this.drillHoles.push({ x: Number(g.x || 0), y: Number(g.y || 0), diameter: Number(g.drill || 0.6) });
	};

	GeometryExporter.prototype.exportDrill = function (obj) {
		var g = obj.geometry || {};
		this.drillHoles.push({ x: Number(g.x || 0), y: Number(g.y || 0), diameter: Number(g.diameter || 0.8) });
	};

	GeometryExporter.prototype.exportOutline = function (obj) {
		var pts = this.points(obj.geometry);
		if (pts.length < 2) return;
		for (var i = 1; i < pts.length; i++) {
			this.layers.outline.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, 0.1);
		}
		if ((obj.geometry || {}).closed && pts.length > 2) {
			this.layers.outline.line(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y, 0.1);
		}
	};

	GeometryExporter.prototype.exportRegion = function (obj) {
		var pts = this.points(obj.geometry);
		if (pts.length < 3) return;
		var layerId = global.DATPCBGerberLayerMapper.copperLayerForObject(obj);
		this.layers[layerId === 'bottomCopper' ? 'bottomCopper' : 'topCopper'].region(pts);
	};

	GeometryExporter.prototype.exportAnnotation = function (obj) {
		var g = obj.geometry || {};
		var layer = this.layers[global.DATPCBGerberLayerMapper.silkLayerForObject(obj)];
		this.exportTextAsStrokes(layer, String(g.text || obj.note || ''), Number(g.x || 0), Number(g.y || 0), Number(g.size || 2.5), Number(g.rotation || 0), !!g.mirror);
	};

	GeometryExporter.prototype.exportTextAsStrokes = function (layer, text, x, y, size, rotation, mirror) {
		if (!text) return;
		var width = Math.max(0.12, size * 0.08);
		var charW = size * 0.55;
		var charH = size;
		var angle = rotation * Math.PI / 180;
		var cos = Math.cos(angle);
		var sin = Math.sin(angle);
		function tx(px, py) {
			if (mirror) px = -px;
			return { x: x + px * cos - py * sin, y: y + px * sin + py * cos };
		}
		for (var i = 0; i < text.length; i++) {
			if (text[i] === ' ') continue;
			var ox = i * charW * 0.9;
			var p1 = tx(ox, 0), p2 = tx(ox + charW * 0.7, 0), p3 = tx(ox + charW * 0.7, charH), p4 = tx(ox, charH);
			layer.line(p1.x, p1.y, p2.x, p2.y, width);
			layer.line(p2.x, p2.y, p3.x, p3.y, width);
			layer.line(p3.x, p3.y, p4.x, p4.y, width);
			layer.line(p4.x, p4.y, p1.x, p1.y, width);
		}
	};

	GeometryExporter.prototype.exportDefaultBoardOutline = function () {
		var hasOutline = (this.project.objects || []).some(function (obj) {
			return obj && obj.visible !== false && obj.type === 'outline';
		});
		if (hasOutline) return;
		var b = this.project.board || {};
		var w = Number(b.width_mm || 0);
		var h = Number(b.height_mm || 0);
		if (w > 0 && h > 0) {
			this.layers.outline.line(0, 0, w, 0, 0.1);
			this.layers.outline.line(w, 0, w, h, 0.1);
			this.layers.outline.line(w, h, 0, h, 0.1);
			this.layers.outline.line(0, h, 0, 0, 0.1);
			this.warnings.push('Board has no outline object; exported rectangular board size as fallback.');
		}
	};

	GeometryExporter.prototype.padShape = function (g) {
		if (g.shape === 'rect' || g.shape === 'roundrect') return 'rect';
		if (g.shape === 'oval') return 'oval';
		return 'circle';
	};

	GeometryExporter.prototype.padParams = function (g) {
		if (g.shape === 'rect' || g.shape === 'oval' || g.shape === 'roundrect') {
			return { width: Number(g.width || g.diameter || 1.6), height: Number(g.height || g.diameter || 1.6) };
		}
		return { diameter: Number(g.diameter || g.width || 1.6) };
	};

	GeometryExporter.prototype.expandParams = function (params, clearance) {
		if (params.diameter) return { diameter: Number(params.diameter) + clearance };
		return { width: Number(params.width || 0) + clearance, height: Number(params.height || 0) + clearance };
	};

	GeometryExporter.prototype.exportSlot = function (obj) {
		var g = obj.geometry || {};
		this.layers.outline.line(g.x1, g.y1, g.x2, g.y2, Number(g.width || 0.8));
		this.warnings.push('Slot exported as outline stroke; routed drill slot output is not implemented yet.');
	};

	GeometryExporter.prototype.exportShape = function (obj) {
		var g = obj.geometry || {};
		// Nam tren lop in lua thi xuat thang, khong doi hoi dau style.role/g.silk.
		// Chinh hai dau do la ly do in lua THAT tu thu vien LCSC (addRealSilk khong
		// dat ca hai) lau nay roi vao nhanh canh bao "chua xuat" ben duoi va bien
		// mat khoi file san xuat, du van hien tren man hinh.
		if (obj.layer === 'silk_top' || obj.layer === 'silk_bottom') {
			this.exportSilkscreenShape(obj);
			return;
		}
		if (obj.layer === 'annotation') {
			if ((obj.style && obj.style.role === 'silkscreen') || g.silk) {
				this.exportSilkscreenShape(obj);
				return;
			}
			this.warnings.push('Annotation shapes are not included in Gerber export yet: ' + obj.id);
			return;
		}
		if (obj.layer === 'mechanical') {
			this.warnings.push('Mechanical layer objects are not included in RS-274X export yet: ' + obj.id);
			return;
		}
		if (g.shape === 'polygon') {
			var pts = this.points(g);
			if (pts.length >= 2) {
				this.exportOutline({ geometry: { points: pts, closed: !!g.closed } });
			}
			return;
		}
		if (g.shape === 'line') {
			this.layers.outline.line(g.x1, g.y1, g.x2, g.y2, 0.1);
			return;
		}
		if (g.shape === 'bezier') {
			this.warnings.push('Bezier export is not implemented yet: ' + obj.id);
			return;
		}
		var pts = this.points(g);
		if (pts.length >= 2) {
			this.exportOutline({ geometry: { points: pts, closed: g.shape !== 'arc' } });
		}
	};

	GeometryExporter.prototype.exportSilkscreenShape = function (obj) {
		var g = obj.geometry || {};
		var layer = this.layers[global.DATPCBGerberLayerMapper.silkLayerForObject(obj)];
		var width = Number(g.strokeWidth || g.width || 0.12);
		if (g.shape === 'line') {
			layer.line(g.x1, g.y1, g.x2, g.y2, width);
			return;
		}
		// Cham danh dau chan 1 la hinh tron. points() khong sinh diem cho no, nen
		// truoc day no hien tren man hinh ma bien mat khoi file san xuat. Rai
		// thanh da giac de xuat duoc bang chinh cac doan thang.
		if (g.shape === 'circle') {
			var r = Number(g.radius || 0);
			if (r <= 0) return;
			var steps = Math.max(12, Math.ceil(r * 24));
			var cx = Number(g.x || 0), cy = Number(g.y || 0), prev = null;
			for (var s = 0; s <= steps; s++) {
				var a = (s / steps) * Math.PI * 2;
				var pt = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
				if (prev) layer.line(prev.x, prev.y, pt.x, pt.y, width);
				prev = pt;
			}
			return;
		}
		var pts = this.points(g);
		if (pts.length < 2) return;
		for (var i = 1; i < pts.length; i++) {
			layer.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, width);
		}
		if (g.closed || g.shape === 'rectangle' || g.shape === 'rounded_rectangle') {
			layer.line(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y, width);
		}
	};

	GeometryExporter.prototype.points = function (geometry) {
		if (!geometry) return [];
		if (geometry.points && geometry.points.length) {
			return geometry.points.map(function (pt) {
				return { x: Number(pt.x || 0), y: Number(pt.y || 0) };
			});
		}
		if (geometry.shape === 'rectangle' || geometry.shape === 'rounded_rectangle' || geometry.shape === 'rect') {
			var x = Number(geometry.x || 0);
			var y = Number(geometry.y || 0);
			var w = Number(geometry.width || 0) / 2;
			var h = Number(geometry.height || 0) / 2;
			return [{ x: x - w, y: y - h }, { x: x + w, y: y - h }, { x: x + w, y: y + h }, { x: x - w, y: y + h }];
		}
		if (geometry.shape === 'circle') {
			return this.curvePoints(Number(geometry.x || 0), Number(geometry.y || 0), Number(geometry.radius || geometry.diameter / 2 || 0), 0, Math.PI * 2, 64);
		}
		if (geometry.shape === 'arc') {
			var start = Number(geometry.startAngle || geometry.start_angle || 0) * Math.PI / 180;
			var end = Number(geometry.endAngle || geometry.end_angle || 0) * Math.PI / 180;
			return this.curvePoints(Number(geometry.x || geometry.cx || 0), Number(geometry.y || geometry.cy || 0), Number(geometry.radius || 0), start, end, 32);
		}
		return [];
	};

	GeometryExporter.prototype.curvePoints = function (cx, cy, radius, start, end, steps) {
		if (!(radius > 0)) return [];
		var pts = [];
		var sweep = end - start;
		if (sweep === 0) sweep = Math.PI * 2;
		for (var i = 0; i <= steps; i++) {
			var a = start + sweep * i / steps;
			pts.push({ x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius });
		}
		return pts;
	};

	GeometryExporter.prototype.relativePoints = function (geometry) {
		return ((geometry && geometry.points) || []).map(function (pt) {
			return { x: Number(pt.x || 0), y: Number(pt.y || 0) };
		});
	};

	GeometryExporter.prototype.validate = function (objects) {
		if (this.layers.outline.isEmpty()) this.warnings.push('Board outline is empty.');
		Object.keys(this.layers).forEach(function (key) {
			if (this.layers[key].isEmpty()) this.warnings.push(this.layers[key].title + ' layer is empty.');
		}, this);
		this.validatePads(objects);
		this.validateTracks(objects);
	};

	GeometryExporter.prototype.validatePads = function (objects) {
		var board = this.project.board || {};
		var w = Number(board.width_mm || 0), h = Number(board.height_mm || 0);
		objects.forEach(function (obj) {
			if (obj.type !== 'pad' && obj.type !== 'via') return;
			var g = obj.geometry || {};
			var x = Number(g.x || 0), y = Number(g.y || 0);
			if (x < 0 || y < 0 || x > w || y > h) this.warnings.push((obj.type === 'via' ? 'Via' : 'Pad') + ' outside board: ' + obj.id);
		}, this);
	};

	GeometryExporter.prototype.validateTracks = function (objects) {
		var nodes = [];
		objects.forEach(function (obj) {
			var g = obj.geometry || {};
			if (obj.type === 'pad' || obj.type === 'via') nodes.push({ x: Number(g.x || 0), y: Number(g.y || 0) });
			if (obj.type === 'track') {
				nodes.push({ x: Number(g.x1 || 0), y: Number(g.y1 || 0) });
				nodes.push({ x: Number(g.x2 || 0), y: Number(g.y2 || 0) });
			}
		});
		objects.forEach(function (obj) {
			if (obj.type !== 'track') return;
			var g = obj.geometry || {};
			var a = this.connectedCount(nodes, Number(g.x1 || 0), Number(g.y1 || 0));
			var b = this.connectedCount(nodes, Number(g.x2 || 0), Number(g.y2 || 0));
			if (a <= 1 || b <= 1) this.warnings.push('Track may be unconnected: ' + obj.id);
		}, this);
	};

	GeometryExporter.prototype.connectedCount = function (nodes, x, y) {
		var tolerance = 0.05;
		return nodes.filter(function (node) {
			return Math.hypot(node.x - x, node.y - y) <= tolerance;
		}).length;
	};

	global.DATPCBGeometryExporter = GeometryExporter;
})(window);
