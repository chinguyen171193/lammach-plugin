(function (global) {
	'use strict';

	// Tim duong di 45-do giua hai chan, tu chon lop dong (top/bottom) va tu chen
	// via khi can, giu khoang cach an toan voi pad/via/duong mach cua luoi khac.
	//
	// Hai tang: (1) vai phuong an hinh hoc re tien (duong thang / mot goc be) -
	// du cho da so truong hop, khong ton chi phi tim kiem. (2) khi khong phuong
	// an nao sach, tim duong that su tren mot luoi cuc bo quanh hai chan bang
	// A* (di vong qua vat can, khong chi chon "it dung nhat"), roi lam gon lai
	// thanh vai doan dai thay vi bac thang nhieu o nho. Neu ca hai tang deu
	// khong ra duong sach (bi vay kin, hoac vung tim qua lon), van ve theo
	// phuong an it dung nhat va bao cho nguoi dung biet qua warning - khong bao
	// gio bo trang.

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

	// Gom vat can lien quan mot lan (dung chung cho ca cham diem heuristic va cho
	// luoi A*), ap dung dung quy uoc "cung luoi thi bo qua" da co tu truoc: mot
	// vat the da noi truc tiep vao chan A hoac B thi coi la cung mang.
	function collectObstacles(state, aId, bId) {
		var list = [];
		(state.objects || []).forEach(function (obj) {
			if (obj.id === aId || obj.id === bId) return;
			var g = obj.geometry || {};
			var sameNet = g.anchor1 === aId || g.anchor2 === aId || g.anchor1 === bId || g.anchor2 === bId;
			if (sameNet) return;
			if ('track' === obj.type) {
				list.push({ kind: 'track', layer: obj.layer, halfWidth: Number(g.width || 0.4) / 2, g: g });
				return;
			}
			if ('pad' !== obj.type && 'via' !== obj.type && 'drill' !== obj.type) return;
			var blocksBothLayers = 'via' === obj.type || 'drill' === obj.type || Number(g.drill || 0) > 0;
			list.push({ kind: 'pad', layer: obj.layer, blocksBothLayers: blocksBothLayers, g: g });
		});
		return list;
	}

	// So lan mot phuong an (mang leg + via) vi pham khoang cach an toan voi cac
	// vat can da gom. Dung chung cho ca duong ung vien re tien lan duong A* sau
	// khi lam gon - la buoc kiem tra cuoi cung truoc khi bao "clean:true".
	function countViolations(obstacles, candidate, minGap, clearance) {
		var count = 0;
		obstacles.forEach(function (o) {
			if ('track' === o.kind) {
				candidate.legs.forEach(function (leg) {
					if (leg.layer !== o.layer) return;
					if (distSegToSeg(leg.x1, leg.y1, leg.x2, leg.y2, o.g.x1, o.g.y1, o.g.x2, o.g.y2) < minGap + o.halfWidth) count++;
				});
				(candidate.vias || []).forEach(function (via) {
					if (distSegToSeg(via.x, via.y, via.x, via.y, o.g.x1, o.g.y1, o.g.x2, o.g.y2) < via.diameter / 2 + clearance + o.halfWidth) count++;
				});
				return;
			}
			candidate.legs.forEach(function (leg) {
				if (!o.blocksBothLayers && leg.layer !== o.layer) return;
				if (distToObstacleShape(o.g, leg.x1, leg.y1, leg.x2, leg.y2) < minGap) count++;
			});
			(candidate.vias || []).forEach(function (via) {
				if (distToObstacleShape(o.g, via.x, via.y, via.x, via.y) < via.diameter / 2 + clearance) count++;
			});
		});
		return count;
	}

	// Hop bao vat can, beo them khoang cach an toan - dung de chan o luoi. Beo
	// hon hinh that mot chut (giong padAabb) la chu dich: A* co the tranh rong
	// hon can thiet doi khi, nhung khong bao gio danh gia thap khoang cach that.
	function inflatedAabb(o, extra) {
		if ('track' === o.kind) {
			var g = o.g, pad = extra + o.halfWidth;
			return { minX: Math.min(g.x1, g.x2) - pad, maxX: Math.max(g.x1, g.x2) + pad, minY: Math.min(g.y1, g.y2) - pad, maxY: Math.max(g.y1, g.y2) + pad };
		}
		var box;
		if ('round' === o.g.shape) {
			var r = Number(o.g.diameter || o.g.width || 1) / 2;
			box = { minX: o.g.x - r, maxX: o.g.x + r, minY: o.g.y - r, maxY: o.g.y + r };
		} else {
			box = padAabb(o.g);
		}
		return { minX: box.minX - extra, maxX: box.maxX + extra, minY: box.minY - extra, maxY: box.maxY + extra };
	}

	/**
	 * A* tren luoi vuong cuc bo quanh A va B, 8 huong (0/45/90) cong nuoc di
	 * "xuyen via" (giu nguyen o, doi lop, tra them chi phi). Tra ve mang diem
	 * tho [{ layer, x, y }] tu A den B, hoac null neu khong tim duoc trong ngan
	 * sach cho phep (bi vay kin, hoac vung tim qua lon de giu toc do).
	 */
	function gridSearch(obstacles, a, b, reachA, reachB, minGap, viaDia, clearance) {
		var manhattan = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
		var margin = Math.max(6, Math.min(35, manhattan * 0.75 + 3));
		var minX = Math.min(a.x, b.x) - margin, maxX = Math.max(a.x, b.x) + margin;
		var minY = Math.min(a.y, b.y) - margin, maxY = Math.max(a.y, b.y) + margin;

		var cell = Math.max(0.15, Math.min(0.3, minGap));
		var MAX_CELLS = 45000; // moi lop; giu tim kiem trong ngan sach thoi gian mot khung hinh
		var cols = Math.ceil((maxX - minX) / cell), rows = Math.ceil((maxY - minY) / cell);
		while (cols * rows > MAX_CELLS && cell < 1.2) {
			cell *= 1.4;
			cols = Math.ceil((maxX - minX) / cell); rows = Math.ceil((maxY - minY) / cell);
		}
		if (cols * rows > MAX_CELLS || cols < 2 || rows < 2) return null;

		function toCol(x) { return Math.max(0, Math.min(cols - 1, Math.round((x - minX) / cell))); }
		function toRow(y) { return Math.max(0, Math.min(rows - 1, Math.round((y - minY) / cell))); }

		var blocked = { top_copper: new Uint8Array(cols * rows), bottom_copper: new Uint8Array(cols * rows) };
		var viaBlocked = new Uint8Array(cols * rows); // o khong dat via duoc (chan tren it nhat 1 lop trong pham vi via)
		var viaExtra = viaDia / 2 + clearance;

		obstacles.forEach(function (o) {
			var box = inflatedAabb(o, minGap);
			var c0 = toCol(box.minX), c1 = toCol(box.maxX), r0 = toRow(box.minY), r1 = toRow(box.maxY);
			var layers = o.blocksBothLayers ? ['top_copper', 'bottom_copper'] : [o.layer];
			var r, c, idx;
			for (r = r0; r <= r1; r++) {
				for (c = c0; c <= c1; c++) {
					idx = r * cols + c;
					layers.forEach(function (ly) { blocked[ly][idx] = 1; });
				}
			}
			var viaBox = inflatedAabb(o, viaExtra);
			var vc0 = toCol(viaBox.minX), vc1 = toCol(viaBox.maxX), vr0 = toRow(viaBox.minY), vr1 = toRow(viaBox.maxY);
			for (r = vr0; r <= vr1; r++) {
				for (c = vc0; c <= vc1; c++) viaBlocked[r * cols + c] = 1;
			}
		});

		var VIA_COST = 4.0; // "gia" mot via tinh theo mm duong tuong duong - han che dung via bua bai
		var SQRT2 = Math.SQRT2;
		var startCol = toCol(a.x), startRow = toRow(a.y);
		var goalCol = toCol(b.x), goalRow = toRow(b.y);

		function key(layer, c, r) { return layer + ':' + c + ':' + r; }
		function heuristic(c, r) {
			var dc = Math.abs(c - goalCol), dr = Math.abs(r - goalRow);
			return (Math.min(dc, dr) * SQRT2 + Math.abs(dc - dr)) * cell;
		}

		var open = [], gScore = {}, cameFrom = {}, closed = {}, meta = {};
		reachA.forEach(function (layer) {
			if (blocked[layer][startRow * cols + startCol]) return;
			var k = key(layer, startCol, startRow);
			gScore[k] = 0;
			meta[k] = { layer: layer, c: startCol, r: startRow };
			open.push({ f: heuristic(startCol, startRow), k: k });
		});
		if (!open.length) return null;

		var goalLayerSet = {}; reachB.forEach(function (l) { goalLayerSet[l] = true; });
		var budget = 30000, expansions = 0, goalKey = null;

		while (open.length && expansions < budget) {
			var bestI = 0;
			for (var i = 1; i < open.length; i++) if (open[i].f < open[bestI].f) bestI = i;
			var cur = open.splice(bestI, 1)[0];
			if (closed[cur.k]) continue;
			closed[cur.k] = true;
			expansions++;
			var cm = meta[cur.k];
			if (cm.c === goalCol && cm.r === goalRow && goalLayerSet[cm.layer]) { goalKey = cur.k; break; }

			var moves = [
				[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
				[1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2]
			];
			for (var n = 0; n < moves.length; n++) {
				var mdx = moves[n][0], mdy = moves[n][1];
				var nc = cm.c + mdx, nr = cm.r + mdy;
				if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
				var idx = nr * cols + nc;
				if (blocked[cm.layer][idx]) continue;
				// Buoc cheo khong duoc "cat goc" qua khe giua hai o chan ke nhau -
				// neu ca hai o vuong goc lien quan deu chan thi coi nhu buoc cheo
				// nay cung bi chan, du o dich (theo duong cheo) trong. Thieu luat
				// nay, luoi tho se de duong mach xuyen qua tuong day 1 o khi kich
				// thuoc o lon hon be day tuong that.
				if (mdx !== 0 && mdy !== 0) {
					if (blocked[cm.layer][cm.r * cols + nc] && blocked[cm.layer][nr * cols + cm.c]) continue;
				}
				var nk = key(cm.layer, nc, nr);
				var ng = gScore[cur.k] + moves[n][2] * cell;
				if (gScore[nk] === undefined || ng < gScore[nk]) {
					gScore[nk] = ng; cameFrom[nk] = cur.k; meta[nk] = { layer: cm.layer, c: nc, r: nr };
					open.push({ f: ng + heuristic(nc, nr), k: nk });
				}
			}
			// Nuoc di xuyen via: giu nguyen o, doi lop.
			var otherLayer = 'top_copper' === cm.layer ? 'bottom_copper' : 'top_copper';
			var vIdx = cm.r * cols + cm.c;
			if (!blocked[otherLayer][vIdx] && !viaBlocked[vIdx]) {
				var vk = key(otherLayer, cm.c, cm.r);
				var vg = gScore[cur.k] + VIA_COST;
				if (gScore[vk] === undefined || vg < gScore[vk]) {
					gScore[vk] = vg; cameFrom[vk] = cur.k; meta[vk] = { layer: otherLayer, c: cm.c, r: cm.r };
					open.push({ f: vg + heuristic(cm.c, cm.r), k: vk });
				}
			}
		}
		if (!goalKey) return null;

		var pts = [], k = goalKey;
		while (k !== undefined) {
			var m = meta[k];
			pts.push({ layer: m.layer, x: minX + m.c * cell, y: minY + m.r * cell });
			k = cameFrom[k];
		}
		pts.reverse();
		return pts;
	}

	// Neu hai buoc lien tiep cung mot huong (vd hai o "sang phai" lien tiep), gop
	// lai thanh mot doan dai - loai bo dan luoi thua tu cach di tung o mot cua A*.
	function mergeCollinear(points) {
		if (points.length < 3) return points.slice();
		var out = [points[0]];
		for (var i = 1; i < points.length - 1; i++) {
			var prev = out[out.length - 1], cur = points[i], next = points[i + 1];
			if (cur.layer !== prev.layer) { out.push(cur); continue; }
			var d1x = cur.x - prev.x, d1y = cur.y - prev.y;
			var d2x = next.x - cur.x, d2y = next.y - cur.y;
			var n1 = Math.hypot(d1x, d1y), n2 = Math.hypot(d2x, d2y);
			var sameDir = n1 > 1e-9 && n2 > 1e-9 && Math.abs((d1x / n1) - (d2x / n2)) < 1e-3 && Math.abs((d1y / n1) - (d2y / n2)) < 1e-3;
			if (!sameDir) out.push(cur);
		}
		out.push(points[points.length - 1]);
		return out;
	}

	// Goc hop le theo dung quy uoc PCB da thong nhat trong project: chi ngang,
	// doc, hoac dung 45 do.
	function isAllowedAngle(dx, dy) {
		if (Math.abs(dx) < 1e-6 || Math.abs(dy) < 1e-6) return true;
		return Math.abs(Math.abs(dx) - Math.abs(dy)) < 1e-3;
	}

	// "Keo day cang": tu diem i, thu noi thang toi diem xa nhat j (cung lop) ma
	// khong dung vat can va van dung goc 0/45/90 - gop nhieu buoc luoi nho thanh
	// mot duong dai, day chinh la phan lam duong "dep" thay vi bac thang.
	function shortcut(points, obstacles, minGap) {
		if (points.length < 3) return points.slice();
		var out = [points[0]];
		var i = 0;
		while (i < points.length - 1) {
			var start = points[i];
			var j = points.length - 1;
			var picked = i + 1;
			for (; j > i + 1; j--) {
				var cand = points[j];
				if (cand.layer !== start.layer) continue;
				var dx = cand.x - start.x, dy = cand.y - start.y;
				if (!isAllowedAngle(dx, dy)) continue;
				var blocked = false;
				for (var o = 0; o < obstacles.length; o++) {
					var ob = obstacles[o];
					if ('track' === ob.kind) {
						if (ob.layer !== start.layer) continue;
						if (distSegToSeg(start.x, start.y, cand.x, cand.y, ob.g.x1, ob.g.y1, ob.g.x2, ob.g.y2) < minGap + ob.halfWidth) { blocked = true; break; }
						continue;
					}
					if (!ob.blocksBothLayers && ob.layer !== start.layer) continue;
					if (distToObstacleShape(ob.g, start.x, start.y, cand.x, cand.y) < minGap) { blocked = true; break; }
				}
				if (!blocked) { picked = j; break; }
			}
			out.push(points[picked]);
			i = picked;
		}
		return out;
	}

	// Noi toa do chan THAT (a.x/a.y, b.x/b.y) vao hai dau danh sach diem luoi. O
	// luoi gan nhat chi trung tam o (lam tron toi da nua canh o, ~0.15-0.3mm),
	// khong phai toa do chan chinh xac.
	//
	// QUAN TRONG: THEM diem moi (khong GHI DE diem luoi cuoi cung). Ghi de se lam
	// hong goc cua doan dai truoc do - vi du mot doan doc tuyet doi (dx=0) dai
	// 6mm se bi keo lech dx=0.1mm khi ghi de dau mut, bien mot duong thang sach
	// thanh mot duong cheo rat le, sai quy uoc 0/45/90 tren suot chieu dai do.
	// Them diem moi thi doan cu giu nguyen, chi phat sinh THEM mot doan noi rat
	// ngan (duoi mot o luoi) o ngoai cung - luon gan nhu ngang hoac doc, khong
	// dang ke ve mat hinh hoc/dien.
	function attachExactEndpoints(points, a, b) {
		var out = points.slice();
		var EPS = 1e-4;
		var first = out[0];
		if (Math.abs(first.x - a.x) > EPS || Math.abs(first.y - a.y) > EPS) {
			out.unshift({ layer: first.layer, x: a.x, y: a.y });
		} else {
			out[0] = { layer: first.layer, x: a.x, y: a.y };
		}
		var last = out[out.length - 1];
		if (Math.abs(last.x - b.x) > EPS || Math.abs(last.y - b.y) > EPS) {
			out.push({ layer: last.layer, x: b.x, y: b.y });
		} else {
			out[out.length - 1] = { layer: last.layer, x: b.x, y: b.y };
		}
		return out;
	}

	// Gop diem luoi da lam gon thanh legs (theo tung doan cung lop) + vias (moi
	// cho doi lop giua hai diem lien tiep).
	function pointsToLegsAndVias(points, viaDia, viaDrill) {
		var legs = [], vias = [];
		for (var i = 0; i < points.length - 1; i++) {
			var p1 = points[i], p2 = points[i + 1];
			if (p1.layer !== p2.layer) {
				vias.push({ x: p1.x, y: p1.y, diameter: viaDia, drill: viaDrill });
				continue;
			}
			if (Math.abs(p1.x - p2.x) < 1e-6 && Math.abs(p1.y - p2.y) < 1e-6) continue;
			legs.push({ layer: p1.layer, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
		}
		return { legs: legs, vias: vias };
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

		var obstacles = collectObstacles(state, a.id, b.id);

		var best = null, bestScore = Infinity;
		for (var i = 0; i < candidates.length; i++) {
			var score = countViolations(obstacles, candidates[i], minGap, clearance);
			if (score < bestScore) { best = candidates[i]; bestScore = score; }
			if (0 === score) break;
		}

		// Tang 2: cac phuong an re tien khong sach - thu tim duong that su tren
		// luoi cuc bo, di vong qua vat can thay vi chi be mot goc co dinh.
		if (bestScore !== 0) {
			var raw = gridSearch(obstacles, a, b, reachA, reachB, minGap, viaDia, clearance);
			if (raw && raw.length > 1) {
				var simplified = shortcut(mergeCollinear(raw), obstacles, minGap);
				var withEndpoints = attachExactEndpoints(simplified, a, b);
				var grid = pointsToLegsAndVias(withEndpoints, viaDia, viaDrill);
				var gridScore = countViolations(obstacles, grid, minGap, clearance);
				if (gridScore < bestScore) { best = grid; bestScore = gridScore; }
			}
		}

		if (!best) {
			best = { legs: [{ layer: layerA, x1: a.x, y1: a.y, x2: b.x, y2: b.y }], vias: [] };
			bestScore = -1;
		}
		return { legs: best.legs, vias: best.vias, clean: 0 === bestScore };
	};

	global.DATPCBRouteEngine = RouteEngine;
})(window);
