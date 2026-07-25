(function (global) {
	'use strict';

	function isPolylineObject(obj) {
		var g = obj.geometry || {};
		return Array.isArray(g.points);
	}

	var Tools = {
		makeId: function () {
			return 'obj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
		},
		layerForTool: function (tool, side) {
			if (tool === 'outline' || tool === 'cutout') return 'outline';
			if (tool === 'drill' || tool === 'slot') return 'drill';
			if (tool === 'mechanical') return 'mechanical';
			if (tool === 'via') return side === 'bottom' ? 'bottom_copper' : 'top_copper';
			if (tool === 'annotation' || tool.indexOf('shape_') === 0) return 'annotation';
			return side === 'bottom' ? 'bottom_copper' : 'top_copper';
		},
		objectFromTool: function (tool, point, opts) {
			var id = Tools.makeId();
			var layer = Tools.layerForTool(tool, opts.side);
			var common = { id: id, type: 'pad', layer: layer, geometry: {}, style: {}, locked: false, visible: true, note: '' };
			if (tool === 'track') {
				common.type = 'track';
				common.geometry = { x1: point.x, y1: point.y, x2: point.x, y2: point.y, width: opts.trackWidth || 0.4 };
			} else if (tool === 'pad_round') {
				common.geometry = { shape: 'round', x: point.x, y: point.y, diameter: opts.padDia || 1.6, drill: 0, side: opts.side };
			} else if (tool === 'pad_rect' || tool === 'pad_square') {
				common.geometry = { shape: 'rect', x: point.x, y: point.y, width: opts.padDia || 1.6, height: opts.padDia || 1.6, rotation: 0, radius: 0, side: opts.side };
			} else if (tool === 'pad_smd') {
				common.geometry = { shape: 'rect', x: point.x, y: point.y, width: (opts.padDia || 1.6) * 1.8, height: (opts.padDia || 1.6) * 0.75, rotation: 0, drill: 0, side: opts.side, mount: 'smd' };
			} else if (tool === 'pad_oval') {
				common.geometry = { shape: 'oval', x: point.x, y: point.y, width: (opts.padDia || 1.6) * 1.8, height: opts.padDia || 1.6, rotation: 0, drill: 0, side: opts.side };
			} else if (tool === 'via') {
				common.type = 'via';
				common.geometry = { x: point.x, y: point.y, diameter: opts.padDia || 1.2, drill: opts.drillDia || 0.6 };
			} else if (tool === 'drill') {
				common.type = 'drill';
				common.geometry = { x: point.x, y: point.y, diameter: opts.drillDia || 0.8, plated: false };
			} else if (tool === 'outline') {
				common.type = 'outline';
				common.geometry = { points: [point], closed: false };
			} else if (tool === 'cutout') {
				common.type = 'cutout';
				common.geometry = { points: [point], closed: false };
			} else if (tool === 'region') {
				common.type = 'region';
				common.geometry = { points: [point], closed: false };
			} else if (tool === 'slot') {
				common.type = 'slot';
				common.geometry = { x1: point.x, y1: point.y, x2: point.x, y2: point.y, width: opts.drillDia || 0.8 };
			} else if (tool === 'shape_line') {
				common.type = 'shape';
				common.geometry = { shape: 'line', x1: point.x, y1: point.y, x2: point.x, y2: point.y };
			} else if (tool === 'shape_rectangle') {
				common.type = 'shape';
				common.geometry = { shape: 'rectangle', x: point.x, y: point.y, width: 0, height: 0, rotation: 0 };
			} else if (tool === 'shape_rounded_rectangle') {
				common.type = 'shape';
				common.geometry = { shape: 'rounded_rectangle', x: point.x, y: point.y, width: 0, height: 0, radius: 1, rotation: 0 };
			} else if (tool === 'shape_circle') {
				common.type = 'shape';
				common.geometry = { shape: 'circle', x: point.x, y: point.y, radius: 0 };
			} else if (tool === 'shape_arc') {
				common.type = 'shape';
				common.geometry = { shape: 'arc', x: point.x, y: point.y, radius: 0, startAngle: 180, endAngle: 0 };
			} else if (tool === 'shape_polygon') {
				common.type = 'shape';
				common.geometry = { shape: 'polygon', points: [point], closed: false };
			} else if (tool === 'shape_bezier') {
				common.type = 'shape';
				common.geometry = { shape: 'bezier', x1: point.x, y1: point.y, cx: point.x, cy: point.y, x2: point.x, y2: point.y };
			} else if (tool === 'mechanical') {
				common.type = 'shape';
				common.layer = 'mechanical';
				common.geometry = { shape: 'line', x1: point.x, y1: point.y, x2: point.x, y2: point.y, mechanical: true };
			} else if (tool === 'annotation') {
				common.type = 'annotation';
				common.geometry = { x: point.x, y: point.y, text: 'Ghi chu', size: 2.5 };
			}
			return common;
		},
		getObjectCenter: function (obj) {
			var g = obj.geometry || {};
			if (obj.type === 'track' || obj.type === 'slot') return { x: (Number(g.x1) + Number(g.x2)) / 2, y: (Number(g.y1) + Number(g.y2)) / 2 };
			if (obj.type === 'shape') {
				if (g.shape === 'line' || g.shape === 'bezier') return { x: (Number(g.x1) + Number(g.x2)) / 2, y: (Number(g.y1) + Number(g.y2)) / 2 };
				if (g.shape === 'polygon' && Array.isArray(g.points) && g.points.length) return g.points[0];
			}
			if (isPolylineObject(obj) && g.points.length) return g.points[0];
			return { x: Number(g.x || 0), y: Number(g.y || 0) };
		},
		getObjectBounds: function (obj) {
			var g = obj.geometry || {};
			var pts = [];
			if (obj.type === 'track' || obj.type === 'slot') {
				pts = [{ x: Number(g.x1 || 0), y: Number(g.y1 || 0) }, { x: Number(g.x2 || 0), y: Number(g.y2 || 0) }];
			} else if (obj.type === 'shape' && (g.shape === 'line' || g.shape === 'bezier')) {
				pts = [{ x: Number(g.x1 || 0), y: Number(g.y1 || 0) }, { x: Number(g.x2 || 0), y: Number(g.y2 || 0) }];
				if (g.shape === 'bezier') pts.push({ x: Number(g.cx || 0), y: Number(g.cy || 0) });
			} else if (obj.type === 'shape' && g.shape === 'polygon' && Array.isArray(g.points)) {
				pts = g.points;
			} else if (obj.type === 'shape' && (g.shape === 'circle' || g.shape === 'arc')) {
				var radius = Number(g.radius || 0);
				pts = [{ x: Number(g.x || 0) - radius, y: Number(g.y || 0) - radius }, { x: Number(g.x || 0) + radius, y: Number(g.y || 0) + radius }];
			} else if (isPolylineObject(obj)) {
				pts = g.points;
			} else {
				var w = Number(g.width || g.diameter || 1);
				var h = Number(g.height || g.diameter || 1);
				pts = [
					{ x: Number(g.x || 0) - w / 2, y: Number(g.y || 0) - h / 2 },
					{ x: Number(g.x || 0) + w / 2, y: Number(g.y || 0) + h / 2 }
				];
			}
			var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			pts.forEach(function (p) {
				minX = Math.min(minX, Number(p.x || 0));
				minY = Math.min(minY, Number(p.y || 0));
				maxX = Math.max(maxX, Number(p.x || 0));
				maxY = Math.max(maxY, Number(p.y || 0));
			});
			if (!isFinite(minX)) minX = minY = maxX = maxY = 0;
			return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
		},
		moveObject: function (obj, dx, dy) {
			var g = obj.geometry || {};
			if (obj.locked) return;
			if (obj.type === 'track' || obj.type === 'slot') {
				g.x1 += dx; g.y1 += dy; g.x2 += dx; g.y2 += dy;
			} else if (obj.type === 'shape' && (g.shape === 'line' || g.shape === 'bezier')) {
				g.x1 += dx; g.y1 += dy; g.x2 += dx; g.y2 += dy;
				if (g.shape === 'bezier') {
					g.cx += dx;
					g.cy += dy;
				}
			} else if (obj.type === 'shape' && g.shape === 'polygon' && Array.isArray(g.points)) {
				g.points.forEach(function (p) { p.x += dx; p.y += dy; });
			} else if (isPolylineObject(obj)) {
				g.points.forEach(function (p) { p.x += dx; p.y += dy; });
			} else {
				g.x = Number(g.x || 0) + dx;
				g.y = Number(g.y || 0) + dy;
			}
		},
		rotateObject: function (obj, degrees) {
			var g = obj.geometry || {};
			if (obj.locked) return;
			var c = Tools.getObjectCenter(obj);
			var rad = degrees * Math.PI / 180;
			function rotatePoint(p) {
				var x = Number(p.x || 0) - c.x;
				var y = Number(p.y || 0) - c.y;
				p.x = c.x + x * Math.cos(rad) - y * Math.sin(rad);
				p.y = c.y + x * Math.sin(rad) + y * Math.cos(rad);
			}
			if (obj.type === 'track' || obj.type === 'slot') {
				var a = { x: g.x1, y: g.y1 }, b = { x: g.x2, y: g.y2 };
				rotatePoint(a);
				rotatePoint(b);
				g.x1 = a.x; g.y1 = a.y; g.x2 = b.x; g.y2 = b.y;
			} else if (obj.type === 'shape' && (g.shape === 'line' || g.shape === 'bezier')) {
				var p1 = { x: g.x1, y: g.y1 }, p2 = { x: g.x2, y: g.y2 };
				rotatePoint(p1);
				rotatePoint(p2);
				g.x1 = p1.x; g.y1 = p1.y; g.x2 = p2.x; g.y2 = p2.y;
				if (g.shape === 'bezier') {
					var cp = { x: g.cx, y: g.cy };
					rotatePoint(cp);
					g.cx = cp.x;
					g.cy = cp.y;
				}
			} else if (obj.type === 'shape' && g.shape === 'polygon' && Array.isArray(g.points)) {
				g.points.forEach(rotatePoint);
			} else if (isPolylineObject(obj)) {
				g.points.forEach(rotatePoint);
			} else {
				g.rotation = Number(g.rotation || 0) + degrees;
				if (obj.type === 'shape' && g.shape === 'arc') {
					g.startAngle = Number(g.startAngle || 0) + degrees;
					g.endAngle = Number(g.endAngle || 0) + degrees;
				}
			}
		},
		mirrorObject: function (obj, centerX) {
			var g = obj.geometry || {};
			if (obj.locked) return;
			var c = Tools.getObjectCenter(obj);
			if (centerX !== undefined) c.x = Number(centerX);
			if (obj.type === 'track' || obj.type === 'slot') {
				g.x1 = c.x - (Number(g.x1 || 0) - c.x);
				g.x2 = c.x - (Number(g.x2 || 0) - c.x);
			} else if (obj.type === 'shape' && (g.shape === 'line' || g.shape === 'bezier')) {
				g.x1 = c.x - (Number(g.x1 || 0) - c.x);
				g.x2 = c.x - (Number(g.x2 || 0) - c.x);
				if (g.shape === 'bezier') g.cx = c.x - (Number(g.cx || 0) - c.x);
			} else if (obj.type === 'shape' && g.shape === 'polygon' && Array.isArray(g.points)) {
				g.points.forEach(function (p) { p.x = c.x - (Number(p.x || 0) - c.x); });
			} else if (isPolylineObject(obj)) {
				g.points.forEach(function (p) { p.x = c.x - (Number(p.x || 0) - c.x); });
			} else {
				g.x = c.x - (Number(g.x || 0) - c.x);
				g.rotation = -Number(g.rotation || 0);
				g.flip_x = !g.flip_x;
			}
		}
	};

	global.DATPCBTracerTools = Tools;
})(window);
