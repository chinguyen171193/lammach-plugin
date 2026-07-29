(function (global) {
	'use strict';

	// Tim duong di 45-do giua hai chan, tu chon lop dong (top/bottom) va tu chen
	// via khi can, giu khoang cach an toan voi pad/via/duong mach cua luoi khac.
	//
	// Day KHONG phai mot autorouter kieu ban co (khong di vong qua chuong ngai
	// vat phuc tap, khong go bo duong da di). Pham vi that su: voi mot cap chan,
	// thu mot vai phuong an hinh hoc hop ly (theo dung quy uoc PCB - xem
	// EditorCommandExecutor.connect) va chon phuong an khong dung vao gi ca. Neu
	// khong phuong an nao sach, van ve theo phuong an it dung nhat va bao cho
	// nguoi dung biet qua warning, thay vi ve mot duong trong nhu cu roi im lang.

	function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
		var dx = x2 - x1, dy = y2 - y1;
		var lenSq = dx * dx + dy * dy;
		var t = lenSq > 1e-12 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
		t = Math.max(0, Math.min(1, t));
		var cx = x1 + t * dx, cy = y1 + t * dy;
		return Math.hypot(px - cx, py - cy);
	}

	function cross(ox, oy, ax, ay, bx, by) {
		return (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
	}

	function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
		var d1 = cross(cx, cy, dx, dy, ax, ay);
		var d2 = cross(cx, cy, dx, dy, bx, by);
		var d3 = cross(ax, ay, bx, by, cx, cy);
		var d4 = cross(ax, ay, bx, by, dx, dy);
		return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
	}

	function distSegToSeg(ax, ay, bx, by, cx, cy, dx, dy) {
		if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
		return Math.min(
			pointToSegmentDistance(ax, ay, cx, cy, dx, dy),
			pointToSegmentDistance(bx, by, cx, cy, dx, dy),
			pointToSegmentDistance(cx, cy, ax, ay, bx, by),
			pointToSegmentDistance(dx, dy, ax, ay, bx, by)
		);
	}

	function distSegToRect(x1, y1, x2, y2, rect) {
		if (x1 >= rect.minX && x1 <= rect.maxX && y1 >= rect.minY && y1 <= rect.maxY) return 0;
		if (x2 >= rect.minX && x2 <= rect.maxX && y2 >= rect.minY && y2 <= rect.maxY) return 0;
		var c = [
			[rect.minX, rect.minY], [rect.maxX, rect.minY],
			[rect.maxX, rect.maxY], [rect.minX, rect.maxY]
		];
		var best = Infinity;
		for (var i = 0; i < 4; i++) {
			var p = c[i], q = c[(i + 1) % 4];
			best = Math.min(best, distSegToSeg(x1, y1, x2, y2, p[0], p[1], q[0], q[1]));
		}
		return best;
	}

	function distSegToCircle(x1, y1, x2, y2, cx, cy, r) {
		return Math.max(0, pointToSegmentDistance(cx, cy, x1, y1, x2, y2) - r);
	}

	// Hop bao truc-thang cua pad chu nhat/oval/roundrect DA XOAY theo goc that,
	// khong chi doi cho width/height o boi 90 do - EasyEDA (qua thu vien LCSC) co
	// the cho goc bat ky. Hop bao lon hon than pad that mot chut o goc xoay le,
	// nhung do la huong an toan can co cho mot phep kiem tra khoang cach, khong
	// phai mot cong cu DRC chung nhan.
	function padAabb(g) {
		var w = Number(g.width || g.diameter || 1), h = Number(g.height || g.diameter || 1);
		var cx = Number(g.x || 0), cy = Number(g.y || 0);
		var rot = (Number(g.rotation || 0) * Math.PI) / 180;
		var cos = Math.cos(rot), sin = Math.sin(rot);
		var hw = w / 2, hh = h / 2;
		var corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
		var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		corners.forEach(function (c) {
			var x = cx + c[0] * cos - c[1] * sin;
			var y = cy + c[0] * sin + c[1] * cos;
			minX = Math.min(minX, x); maxX = Math.max(maxX, x);
			minY = Math.min(minY, y); maxY = Math.max(maxY, y);
		});
		return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
	}

	// Khoang cach tu mot doan thang (chinh no da duoc "beo" san mot nua be rong
	// duong mach o ben goi) toi mot vat can - pad tron/oval/chu nhat, via, hoac
	// lo khoan roi. Tron -> khoang cach toi vong tron. Con lai -> khoang cach toi
	// hop bao da xoay.
	function distToObstacleShape(g, x1, y1, x2, y2) {
		if ('round' === g.shape) {
			return distSegToCircle(x1, y1, x2, y2, Number(g.x || 0), Number(g.y || 0), Number(g.diameter || g.width || 1) / 2);
		}
		return distSegToRect(x1, y1, x2, y2, padAabb(g));
	}

	var RouteEngine = {};

	// Hai bien the be goc 45-do cho mot cap diem: doan cheo di truoc (bam vao A)
	// hoac doan cheo di sau (bam vao B). Neu hai diem da thang hang (cung X hoac
	// cung Y) thi chi co dung mot duong thang, khong co goc.
	RouteEngine.cornerVariants = function (x1, y1, x2, y2) {
		var dx = x2 - x1, dy = y2 - y1;
		if (Math.abs(dx) < 1e-6 || Math.abs(dy) < 1e-6) return [null];
		var run = Math.min(Math.abs(dx), Math.abs(dy));
		var sx = dx < 0 ? -run : run, sy = dy < 0 ? -run : run;
		return [
			{ x: x1 + sx, y: y1 + sy },
			{ x: x2 - sx, y: y2 - sy }
		];
	};

	function legsThrough(x1, y1, x2, y2, layer, corner) {
		if (!corner) return [{ layer: layer, x1: x1, y1: y1, x2: x2, y2: y2 }];
		return [
			{ layer: layer, x1: x1, y1: y1, x2: corner.x, y2: corner.y },
			{ layer: layer, x1: corner.x, y1: corner.y, x2: x2, y2: y2 }
		];
	}

	/**
	 * spec = {
	 *   a: { x, y, side, id, throughHole },
	 *   b: { x, y, side, id, throughHole },
	 *   trackWidth, clearance, viaDiameter, viaDrill
	 * }
	 * Tra ve { legs: [{layer,x1,y1,x2,y2}], vias: [{x,y,diameter,drill}], clean }
	 */
	RouteEngine.route = function (state, spec) {
		var a = spec.a, b = spec.b;
		var trackWidth = Number(spec.trackWidth || 0.4);
		var clearance = spec.clearance != null ? Number(spec.clearance) : 0.2;
		var viaDia = Number(spec.viaDiameter || 1.0);
		var viaDrill = Number(spec.viaDrill || 0.5);
		var minGap = trackWidth / 2 + clearance;

		var layerA = 'bottom' === a.side ? 'bottom_copper' : 'top_copper';
		var layerB = 'bottom' === b.side ? 'bottom_copper' : 'top_copper';
		var reachA = a.throughHole ? ['top_copper', 'bottom_copper'] : [layerA];
		var reachB = b.throughHole ? ['top_copper', 'bottom_copper'] : [layerB];
		var commonLayers = reachA.filter(function (l) { return -1 !== reachB.indexOf(l); });

		var candidates = [];
		commonLayers.forEach(function (layer) {
			RouteEngine.cornerVariants(a.x, a.y, b.x, b.y).forEach(function (corner) {
				candidates.push({ legs: legsThrough(a.x, a.y, b.x, b.y, layer, corner), vias: [], priority: layer === layerA ? 0 : 1 });
			});
		});
		if (!commonLayers.length) {
			// Hai chan o hai mat khac nhau: khong the khong dung via, day la vat
			// ly chu khong phai lua chon. Via dat ngay tai diem be goc.
			RouteEngine.cornerVariants(a.x, a.y, b.x, b.y).forEach(function (corner) {
				var via = corner || { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
				candidates.push({
					legs: [
						{ layer: layerA, x1: a.x, y1: a.y, x2: via.x, y2: via.y },
						{ layer: layerB, x1: via.x, y1: via.y, x2: b.x, y2: b.y }
					],
					vias: [{ x: via.x, y: via.y, diameter: viaDia, drill: viaDrill }],
					priority: 2
				});
			});
		}
		candidates.sort(function (p, q) { return p.priority - q.priority; });

		function countViolations(candidate) {
			var count = 0;
			(state.objects || []).forEach(function (obj) {
				if (obj.id === a.id || obj.id === b.id) return;
				var g = obj.geometry || {};
				// Heuristic ve "cung luoi": mot vat the da noi truc tiep vao chan
				// A hoac B thi coi la cung mang, cho phep cham nhau. Day khong
				// phai mot he thong net-list day du (khong bat duoc tinh bac cau
				// qua nhieu doan CONNECT khac), nhung dung voi cach AI dung mang
				// tung cap mot - moi lenh CONNECT moi luon co it nhat mot dau da
				// thuoc mang dang xay.
				var sameNet = g.anchor1 === a.id || g.anchor2 === a.id || g.anchor1 === b.id || g.anchor2 === b.id;
				if ('track' === obj.type) {
					if (sameNet) return;
					var halfOther = Number(g.width || 0.4) / 2;
					candidate.legs.forEach(function (leg) {
						if (leg.layer !== obj.layer) return;
						if (distSegToSeg(leg.x1, leg.y1, leg.x2, leg.y2, g.x1, g.y1, g.x2, g.y2) < minGap + halfOther) count++;
					});
					candidate.vias.forEach(function (via) {
						if (distSegToSeg(via.x, via.y, via.x, via.y, g.x1, g.y1, g.x2, g.y2) < via.diameter / 2 + clearance + halfOther) count++;
					});
					return;
				}
				if ('pad' !== obj.type && 'via' !== obj.type && 'drill' !== obj.type) return;
				if (sameNet) return;
				// Via/lo khoan xuyen qua ca hai mat; pad thuong (SMD hoac xuyen lo
				// voi drill>0) chi chan tren dung mat cua no, tru khi no CO
				// drill>0 - khi do vanh dong quanh lo cung xuat hien tren ca hai
				// mat nen cung phai chan ca hai.
				var blocksBothLayers = 'via' === obj.type || 'drill' === obj.type || Number(g.drill || 0) > 0;
				candidate.legs.forEach(function (leg) {
					if (!blocksBothLayers && leg.layer !== obj.layer) return;
					if (distToObstacleShape(g, leg.x1, leg.y1, leg.x2, leg.y2) < minGap) count++;
				});
				candidate.vias.forEach(function (via) {
					if (distToObstacleShape(g, via.x, via.y, via.x, via.y) < via.diameter / 2 + clearance) count++;
				});
			});
			return count;
		}

		var best = null, bestScore = Infinity;
		for (var i = 0; i < candidates.length; i++) {
			var score = countViolations(candidates[i]);
			if (score < bestScore) { best = candidates[i]; bestScore = score; }
			if (0 === score) break;
		}
		if (!best) {
			best = { legs: [{ layer: layerA, x1: a.x, y1: a.y, x2: b.x, y2: b.y }], vias: [] };
			bestScore = -1;
		}
		return { legs: best.legs, vias: best.vias, clean: 0 === bestScore };
	};

	global.DATPCBRouteEngine = RouteEngine;
})(window);
