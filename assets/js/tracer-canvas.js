(function (global) {
	'use strict';

	// Con tro chuot cho tung tay cam resize board - xem hitBoardHandle()/boardHandlePoints().
	var BOARD_HANDLE_CURSORS = {
		n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
		ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize'
	};

	function Renderer(canvas, app) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');
		this.app = app;
		this.view = { scale: 6, ox: 120, oy: 90 };
		this.needsRender = true;
		this.images = { top: null, bottom: null };
		this.drag = null;
		this.pointerId = null;
		this.tabletGesture = null;
		this.snapCandidate = null;
		this.spaceDown = false;
		this.zoomBox = null;
		this.bind();
		this.loop();
	}

	Renderer.prototype.mmToScreen = function (p) {
		return { x: this.view.ox + p.x * this.view.scale, y: this.view.oy + p.y * this.view.scale };
	};

	Renderer.prototype.screenToMm = function (x, y) {
		return { x: (x - this.view.ox) / this.view.scale, y: (y - this.view.oy) / this.view.scale };
	};

	Renderer.prototype.snap = function (p) {
		var state = this.app.state;
		var tablet = this.app.isTabletMode && this.app.isTabletMode();
		var routing = this.app.tool === 'track' || (this.app.drawing && this.app.drawing.obj && this.app.drawing.obj.type === 'track');
		var snapPx = tablet && routing ? 28 : (routing ? 14 : 10);
		this.snapCandidate = null;
		if (!this.app.options.snap) return p;
		var best = null;
		state.objects.forEach(function (obj) {
			if (!obj.visible || (obj.type !== 'pad' && obj.type !== 'via' && obj.type !== 'track')) return;
			if (this.isActiveRouteObject(obj)) return;
			var g = obj.geometry || {};
			var candidates = [];
			if (obj.type === 'track') candidates = [{ x: g.x1, y: g.y1, kind: 'track-end' }, { x: g.x2, y: g.y2, kind: 'track-end' }];
			else candidates = [{ x: g.x, y: g.y, kind: obj.type === 'pad' && g.component_id ? 'pin' : obj.type }];
			candidates.forEach(function (c) {
				var dx = c.x - p.x, dy = c.y - p.y;
				var dist = Math.sqrt(dx * dx + dy * dy) * this.view.scale;
				if (dist <= snapPx && (!best || dist < best.dist)) best = { p: c, dist: dist, obj: obj };
			}, this);
		}, this);
		this.snapCandidate = best;
		if (best) return { x: best.p.x, y: best.p.y, snapped: true };
		var gmm = Number(state.board.grid_mm || 0.5);
		return { x: Math.round(p.x / gmm) * gmm, y: Math.round(p.y / gmm) * gmm };
	};

	Renderer.prototype.bind = function () {
		var self = this;
		this.canvas.addEventListener('wheel', function (e) {
			e.preventDefault();
			var rect = self.canvas.getBoundingClientRect();
			var mx = e.clientX - rect.left, my = e.clientY - rect.top;
			var before = self.screenToMm(mx, my);
			var factor = e.deltaY < 0 ? 1.12 : 0.89;
			self.view.scale = Math.max(0.5, Math.min(80, self.view.scale * factor));
			var after = self.mmToScreen(before);
			self.view.ox += mx - after.x;
			self.view.oy += my - after.y;
			self.app.updateStatus();
			self.invalidate();
		}, { passive: false });
		this.canvas.addEventListener('contextmenu', function (e) {
			e.preventDefault();
		});
		if (global.PointerEvent) {
			this.canvas.addEventListener('pointerdown', function (e) { self.onPointerDown(e); });
			this.canvas.addEventListener('pointermove', function (e) { self.onPointerMove(e); });
			global.addEventListener('pointerup', function (e) { self.onPointerUp(e); });
			global.addEventListener('pointercancel', function (e) { self.onPointerUp(e); });
		} else {
			this.canvas.addEventListener('mousedown', function (e) { self.onDown(e); });
			this.canvas.addEventListener('mousemove', function (e) { self.onMove(e); });
			global.addEventListener('mouseup', function (e) { self.onUp(e); });
		}
		global.addEventListener('keydown', function (e) { if (e.code === 'Space') self.spaceDown = true; });
		global.addEventListener('keyup', function (e) { if (e.code === 'Space') self.spaceDown = false; });
		global.addEventListener('resize', function () { self.resize(); });
		this.resize();
	};

	Renderer.prototype.setTabletGesture = function (gesture) {
		this.tabletGesture = gesture;
	};

	Renderer.prototype.clientToMm = function (clientX, clientY) {
		var rect = this.canvas.getBoundingClientRect();
		return this.screenToMm(clientX - rect.left, clientY - rect.top);
	};

	Renderer.prototype.zoomAt = function (clientX, clientY, factor) {
		var rect = this.canvas.getBoundingClientRect();
		var mx = clientX - rect.left, my = clientY - rect.top;
		var before = this.screenToMm(mx, my);
		this.view.scale = Math.max(0.5, Math.min(80, this.view.scale * factor));
		var after = this.mmToScreen(before);
		this.view.ox += mx - after.x;
		this.view.oy += my - after.y;
		this.app.updateStatus();
		this.invalidate();
	};

	Renderer.prototype.zoomAtCenter = function (factor) {
		var rect = this.canvas.getBoundingClientRect();
		this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
	};

	Renderer.prototype.panBy = function (dx, dy) {
		this.view.ox += dx;
		this.view.oy += dy;
		this.invalidate();
	};

	Renderer.prototype.centerView = function () {
		var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
		var b = this.app.state.board;
		this.view.ox = (w - b.width_mm * this.view.scale) / 2;
		this.view.oy = (h - b.height_mm * this.view.scale) / 2;
		this.invalidate();
	};

	Renderer.prototype.resize = function () {
		var parent = this.canvas.parentElement;
		var dpr = global.devicePixelRatio || 1;
		this.canvas.width = Math.max(400, parent.clientWidth) * dpr;
		this.canvas.height = Math.max(400, parent.clientHeight) * dpr;
		this.canvas.style.width = parent.clientWidth + 'px';
		this.canvas.style.height = parent.clientHeight + 'px';
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.invalidate();
	};

	Renderer.prototype.onDown = function (e) {
		var rect = this.canvas.getBoundingClientRect();
		var p = this.snap(this.screenToMm(e.clientX - rect.left, e.clientY - rect.top));
		if (e.button === 1 || e.button === 2 || this.spaceDown || this.app.tool === 'pan') {
			e.preventDefault();
			this.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: this.view.ox, oy: this.view.oy };
			this.canvas.classList.add('is-panning');
			return;
		}
		if (this.app.tool === 'zoom_window') {
			this.zoomBox = { x1: e.clientX - rect.left, y1: e.clientY - rect.top, x2: e.clientX - rect.left, y2: e.clientY - rect.top };
			this.drag = { mode: 'zoombox' };
			this.invalidate();
			return;
		}
		if (this.app.tool === 'select') {
			var handle = this.hitBoardHandle(e.clientX - rect.left, e.clientY - rect.top);
			if (handle) {
				e.preventDefault();
				this.app.boardResizeStart(handle);
				this.drag = { mode: 'resize-board', handle: handle, startMm: this.screenToMm(e.clientX - rect.left, e.clientY - rect.top) };
				this.invalidate();
				return;
			}
		}
		this.app.cursor = p;
		this.app.updateStatus();
		this.app.history.push(this.app.state);
		this.app.pointerDown(p, e);
		this.drag = { mode: 'draw', last: p };
		this.invalidate();
	};

	Renderer.prototype.onPointerDown = function (e) {
		if (this.tabletGesture && this.tabletGesture.handlePointerDown(e, this)) {
			this.cancelPointerDrag(this.tabletGesture.consumeReason === 'pinch');
			return;
		}
		if (this.pointerId !== null) return;
		if (e.pointerType === 'touch' || e.pointerType === 'pen') e.preventDefault();
		this.pointerId = e.pointerId;
		if (this.canvas.setPointerCapture) this.canvas.setPointerCapture(e.pointerId);
		this.onDown(e);
	};

	Renderer.prototype.onMove = function (e) {
		var rect = this.canvas.getBoundingClientRect();
		var raw = this.screenToMm(e.clientX - rect.left, e.clientY - rect.top);
		var p = this.snap(raw);
		this.app.cursor = p;
		if (this.drag && this.drag.mode === 'pan') {
			this.view.ox = this.drag.ox + e.clientX - this.drag.sx;
			this.view.oy = this.drag.oy + e.clientY - this.drag.sy;
			this.invalidate();
		} else if (this.drag && this.drag.mode === 'zoombox') {
			this.zoomBox.x2 = e.clientX - rect.left;
			this.zoomBox.y2 = e.clientY - rect.top;
			this.invalidate();
		} else if (this.drag && this.drag.mode === 'resize-board') {
			this.app.boardResizeMove(raw.x - this.drag.startMm.x, raw.y - this.drag.startMm.y);
			this.invalidate();
		} else if (this.drag) {
			this.app.pointerMove(p, e);
			this.invalidate();
		} else if (this.app.tool === 'select') {
			var hoverHandle = this.hitBoardHandle(e.clientX - rect.left, e.clientY - rect.top);
			this.canvas.style.cursor = hoverHandle ? BOARD_HANDLE_CURSORS[hoverHandle] : '';
		} else if (this.canvas.style.cursor) {
			this.canvas.style.cursor = '';
		}
		this.app.updateStatus();
	};

	Renderer.prototype.onPointerMove = function (e) {
		if (this.tabletGesture && this.tabletGesture.handlePointerMove(e, this)) return;
		if (this.pointerId !== e.pointerId) return;
		if (e.pointerType === 'touch' || e.pointerType === 'pen') e.preventDefault();
		var events = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
		this.onMove(events && events.length ? events[events.length - 1] : e);
	};

	Renderer.prototype.onUp = function () {
		if (this.drag && this.drag.mode === 'zoombox') {
			this.finishZoomBox();
		} else if (this.drag && this.drag.mode === 'resize-board') {
			this.app.boardResizeEnd();
		} else if (this.drag) {
			this.app.pointerUp();
		}
		this.canvas.classList.remove('is-panning');
		this.canvas.style.cursor = '';
		this.drag = null;
	};

	Renderer.prototype.finishZoomBox = function () {
		var box = this.zoomBox;
		this.zoomBox = null;
		if (!box) return;
		var a = this.screenToMm(box.x1, box.y1);
		var b = this.screenToMm(box.x2, box.y2);
		var w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
		if (w < 1 || h < 1) { this.invalidate(); return; }
		this.fitToMmBounds(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y));
		this.app.setTool('select');
	};

	Renderer.prototype.fitToMmBounds = function (minX, minY, maxX, maxY) {
		var w = Math.max(0.5, maxX - minX), h = Math.max(0.5, maxY - minY);
		var cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
		var scale = Math.min(cw / w, ch / h) * 0.92;
		this.view.scale = Math.max(0.5, Math.min(80, scale));
		var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
		this.view.ox = cw / 2 - cx * this.view.scale;
		this.view.oy = ch / 2 - cy * this.view.scale;
		this.app.updateStatus();
		this.invalidate();
	};

	Renderer.prototype.onPointerUp = function (e) {
		var consumed = this.tabletGesture && this.tabletGesture.handlePointerUp(e, this);
		if (this.pointerId !== e.pointerId) {
			if (this.canvas.releasePointerCapture) {
				try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) {}
			}
			return;
		}
		if (!consumed) this.onUp(e);
		if (this.canvas.releasePointerCapture) {
			try { this.canvas.releasePointerCapture(e.pointerId); } catch (err) {}
		}
		this.pointerId = null;
	};

	Renderer.prototype.cancelPointerDrag = function (discardCreate) {
		if (discardCreate && this.app.drawing && this.app.drawing.mode === 'create' && this.app.drawing.obj) {
			var id = this.app.drawing.obj.id;
			this.app.state.objects = this.app.state.objects.filter(function (obj) { return obj.id !== id; });
			this.app.selected = this.app.selected.filter(function (selectedId) { return selectedId !== id; });
			this.app.drawing = null;
			this.app.renderAll();
		} else if (this.drag && this.drag.mode === 'resize-board') {
			this.app.boardResizeEnd();
		} else if (this.drag) {
			this.app.pointerUp();
		}
		this.canvas.classList.remove('is-panning');
		this.canvas.style.cursor = '';
		this.drag = null;
		this.pointerId = null;
		this.invalidate();
	};

	Renderer.prototype.fit = function () {
		var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
		var board = this.app.state.board;
		var scale = Math.min(w / board.width_mm, h / board.height_mm) * 0.82;
		this.view.scale = Math.max(0.5, scale);
		this.view.ox = (w - board.width_mm * this.view.scale) / 2;
		this.view.oy = (h - board.height_mm * this.view.scale) / 2;
		this.invalidate();
	};

	Renderer.prototype.invalidate = function () {
		this.needsRender = true;
	};

	Renderer.prototype.loop = function () {
		var self = this;
		if (this.needsRender) {
			this.needsRender = false;
			this.render();
		}
		global.requestAnimationFrame(function () { self.loop(); });
	};

	Renderer.prototype.loadImages = function () {
		['top', 'bottom'].forEach(function (side) {
			var info = this.app.state.images[side];
			if (!info || !info.url) {
				this.images[side] = null;
				return;
			}
			if (this.images[side] && this.images[side].src === info.url) return;
			var img = new Image();
			img.onload = this.invalidate.bind(this);
			img.crossOrigin = 'anonymous';
			img.src = info.url;
			this.images[side] = img;
		}, this);
	};

	Renderer.prototype.render = function () {
		this.loadImages();
		var ctx = this.ctx, w = this.canvas.clientWidth, h = this.canvas.clientHeight;
		var clean = this.app.options.cleanView;
		ctx.clearRect(0, 0, w, h);
		ctx.fillStyle = '#10151c';
		ctx.fillRect(0, 0, w, h);
		if (!clean) this.drawGrid(ctx, w, h);
		this.drawBoard(ctx);
		if (!clean) this.drawImages(ctx);
		this.drawObjects(ctx);
		if (!clean) {
			this.drawSnapCandidate(ctx);
			this.drawMeasurement(ctx);
			this.drawZoomBox(ctx);
		}
	};

	Renderer.prototype.drawZoomBox = function (ctx) {
		if (!this.zoomBox) return;
		var box = this.zoomBox;
		ctx.save();
		ctx.strokeStyle = '#48e0a4';
		ctx.fillStyle = 'rgba(72,224,164,.12)';
		ctx.lineWidth = 1;
		ctx.setLineDash([5, 4]);
		var x = Math.min(box.x1, box.x2), y = Math.min(box.y1, box.y2);
		var w = Math.abs(box.x2 - box.x1), h = Math.abs(box.y2 - box.y1);
		ctx.fillRect(x, y, w, h);
		ctx.strokeRect(x, y, w, h);
		ctx.restore();
	};

	Renderer.prototype.drawMeasurement = function (ctx) {
		var measure = this.app.measure;
		if (!measure) return;
		var a = this.mmToScreen(measure.start), b = this.mmToScreen(measure.end);
		var dx = measure.end.x - measure.start.x, dy = measure.end.y - measure.start.y;
		var distance = Math.hypot(dx, dy);
		var angle = Math.atan2(dy, dx) * 180 / Math.PI;
		if (angle < 0) angle += 360;
		ctx.save();
		ctx.strokeStyle = '#48e0ff';
		ctx.fillStyle = '#48e0ff';
		ctx.lineWidth = 1.5;
		ctx.setLineDash([6, 4]);
		ctx.beginPath();
		ctx.moveTo(a.x, a.y);
		ctx.lineTo(b.x, b.y);
		ctx.stroke();
		ctx.setLineDash([]);
		[a, b].forEach(function (pt) {
			ctx.beginPath();
			ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
			ctx.fill();
		});
		var label = distance.toFixed(3) + ' mm, ' + angle.toFixed(1) + '°';
		var midx = (a.x + b.x) / 2, midy = (a.y + b.y) / 2;
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'center';
		ctx.lineWidth = 3;
		ctx.strokeStyle = 'rgba(16,21,28,.9)';
		ctx.strokeText(label, midx, midy - 10);
		ctx.fillStyle = '#d8fbff';
		ctx.fillText(label, midx, midy - 10);
		ctx.restore();
	};

	Renderer.prototype.effectiveGridStep = function (base) {
		var minPx = 8;
		var scale = this.view.scale;
		if (base * scale >= minPx) return base;
		var seq = [1, 2, 5];
		for (var k = 1; k < 60; k++) {
			var step = base * seq[k % 3] * Math.pow(10, Math.floor(k / 3));
			if (step * scale >= minPx) return step;
		}
		return base * 1000000;
	};

	Renderer.prototype.drawGrid = function (ctx, w, h) {
		if (!this.app.options.gridVisible) return;
		var base = Number(this.app.state.board.grid_mm || 0.5);
		var grid = this.effectiveGridStep(base);
		ctx.save();
		ctx.strokeStyle = 'rgba(255,255,255,0.08)';
		ctx.lineWidth = 1;
		var start = this.screenToMm(0, 0);
		var end = this.screenToMm(w, h);
		for (var x = Math.floor(start.x / grid) * grid; x <= end.x; x += grid) {
			var px = this.mmToScreen({ x: x, y: 0 }).x;
			ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
		}
		for (var y = Math.floor(start.y / grid) * grid; y <= end.y; y += grid) {
			var py = this.mmToScreen({ x: 0, y: y }).y;
			ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
		}
		ctx.restore();
	};

	// Mau mat board (mau son mask khi xem sach, mau nen editor khi dang ve).
	Renderer.prototype.boardFillColor = function () {
		return this.app.options.cleanView ? '#0e6b40' : '#10151c';
	};

	// Lo khoan la lo THUNG qua ban mach - nhin xuyen qua nen phai toi, khong
	// phai mau mat board. To bang boardFillColor() se thanh "bit kin bang mau
	// board", dung la thu vua bi bao sai o ban truoc.
	Renderer.prototype.drillFillColor = function () {
		return this.app.options.cleanView ? '#07130d' : '#10151c';
	};

	Renderer.prototype.drawBoard = function (ctx) {
		var b = this.app.state.board;
		var p0 = this.mmToScreen({ x: 0, y: 0 });
		var w = b.width_mm * this.view.scale, h = b.height_mm * this.view.scale;
		ctx.save();
		if (this.app.options.cleanView) {
			// Xem 2D sach: to dac mau solder-mask giong PCB thuc. Vien truoc day
			// mau bac ha sang qua muc (#90e0a5, ro nhu wireframe) - PCB that khong
			// co vien sang nhu vay, chi la mep cat mo, nen doi thanh vien toi mo.
			ctx.fillStyle = this.boardFillColor();
			ctx.fillRect(p0.x, p0.y, w, h);
			ctx.strokeStyle = 'rgba(0,0,0,.45)';
			ctx.lineWidth = 1.5;
		} else {
			ctx.strokeStyle = '#ffd54a';
			ctx.lineWidth = 2;
		}
		ctx.strokeRect(p0.x, p0.y, w, h);
		ctx.restore();
		if (this.app.tool === 'select' && !this.app.options.cleanView) this.drawBoardHandles(ctx);
	};

	// Vi tri mm cua 8 tay cam resize board - 4 goc + 4 canh giua. Canh trai/tren la 'min'
	// (App.boardResizeMove se dich toan bo noi dung khi keo), canh phai/duoi la 'max'.
	Renderer.prototype.boardHandlePoints = function () {
		var b = this.app.state.board, w = b.width_mm, h = b.height_mm;
		return {
			nw: { x: 0, y: 0 }, n: { x: w / 2, y: 0 }, ne: { x: w, y: 0 },
			w: { x: 0, y: h / 2 }, e: { x: w, y: h / 2 },
			sw: { x: 0, y: h }, s: { x: w / 2, y: h }, se: { x: w, y: h }
		};
	};

	Renderer.prototype.hitBoardHandle = function (sx, sy) {
		var points = this.boardHandlePoints();
		var best = null, bestDist = 8;
		for (var key in points) {
			var p = this.mmToScreen(points[key]);
			var d = Math.hypot(p.x - sx, p.y - sy);
			if (d <= bestDist) { bestDist = d; best = key; }
		}
		return best;
	};

	Renderer.prototype.drawBoardHandles = function (ctx) {
		var points = this.boardHandlePoints();
		var size = 7;
		ctx.save();
		ctx.fillStyle = '#48e0a4';
		ctx.strokeStyle = '#10151c';
		ctx.lineWidth = 1;
		for (var key in points) {
			var p = this.mmToScreen(points[key]);
			ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
			ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
		}
		ctx.restore();
	};

	Renderer.prototype.drawImages = function (ctx) {
		['top', 'bottom'].forEach(function (side) {
			var layerKey = side === 'top' ? 'background_top' : 'background_bottom';
			if (!this.app.layerVisible(layerKey)) return;
			var info = this.app.state.images[side], img = this.images[side];
			if (!info || !info.visible || !img || !img.complete) return;
			var p = this.mmToScreen({ x: Number(info.x || 0), y: Number(info.y || 0) });
			ctx.save();
			ctx.globalAlpha = Number(info.opacity || 0.5);
			ctx.translate(p.x, p.y);
			ctx.rotate((Number(info.rotation || 0) * Math.PI) / 180);
			ctx.scale((info.flip_x ? -1 : 1) * Number(info.scale_x || 1), (info.flip_y ? -1 : 1) * Number(info.scale_y || 1));
			ctx.drawImage(img, 0, 0);
			ctx.restore();
		}, this);
	};

	Renderer.prototype.drawObjects = function (ctx) {
		// So chan duoc gom lai va ve o cuoi, sau moi pad va moi duong in lua, de
		// khong bi chinh pad ve sau do de len.
		this.pinLabelQueue = [];
		this.drillHoleQueue = [];
		var cleanView = this.app.options.cleanView;
		this.paintOrder(this.app.state.objects).forEach(function (obj) {
			if (!obj.visible || !this.app.layerVisible(obj.layer)) return;
			var inactiveSide = this.isInactiveSide(obj);
			// Xem 2D sach la ban xem truoc kieu Gerber cua TUNG mat - an han mat
			// khong active thay vi lam mo, giong duyet qua nut "Mat ve" de xem lan
			// luot tung mat that. Che do ve binh thuong van giu ca 2 mat (mo mat
			// khong active) de tien doi chieu khi dang chinh sua.
			if (cleanView && inactiveSide) return;
			// Lop 'mechanical' o day chi la khung THAM CHIEU EditorCommandExecutor
			// tu ve khi footprint khong co in lua that (xem addAutoSilk) - khong
			// phai net thuc te tren PCB, nen an trong ban xem sach.
			if (cleanView && obj.layer === 'mechanical') return;
			var layer = this.app.state.layers[obj.layer] || {};
			var drawColor = this.resolveObjectColor(obj, layer);
			var isRouteDraft = this.isRouteDraftObject(obj);
			ctx.save();
			ctx.globalAlpha = Number(layer.opacity || 1) * (!cleanView && inactiveSide ? 0.32 : 1);
			ctx.strokeStyle = drawColor;
			ctx.fillStyle = drawColor;
			if (isRouteDraft) {
				ctx.shadowColor = 'rgba(255, 193, 7, .55)';
				ctx.shadowBlur = 8;
			}
			this.drawObject(ctx, obj);
			if (!this.app.options.cleanView) {
				if (this.app.selected.indexOf(obj.id) !== -1) this.drawSelection(ctx, obj);
				if (this.app.activePinId && this.app.activePinId === obj.id) this.drawActivePin(ctx, obj);
			}
			ctx.restore();
		}, this);
		// Lo khoan ve truoc nhan so chan: lo phai an moi duong mach chay de len no,
		// nhung nhan so chan (chi che do chinh sua) van phai doc duoc tren cung.
		this.drawDrillHoles(ctx);
		// So chan duoc ve DE ngay giua pad, phu kin ca lo khoan - tien khi dang
		// dau day, nhung bo mach that khong in so trong long pad (in lua nam ngoai
		// than linh kien), nen ban xem sach bo han di.
		if (!cleanView) this.drawPinLabels(ctx);
	};

	// Pad/via luon ve SAU duong mach. Tren bo mach that, pad la o ho cua lop son
	// mask - dong tran lo ra o do - nen duong mach chay vao pad phai chim duoi
	// pad chu khong the vat ngang qua no. Truoc day thu tu ve chinh la thu tu
	// trong state.objects, nen duong mach nao tao SAU pad se de len pad. Giu
	// nguyen thu tu tuong doi trong tung nhom de moi thu khac ve y nhu cu.
	Renderer.prototype.paintOrder = function (objects) {
		var body = [], terminals = [];
		for (var i = 0; i < objects.length; i++) {
			var obj = objects[i];
			if (obj.type === 'pad' || obj.type === 'via') terminals.push(obj);
			else body.push(obj);
		}
		return body.concat(terminals);
	};

	// Mat (top/bottom) ma doi tuong thuoc ve. Dong suy thang tu ten lop, nhung in
	// lua va nhan ten linh kien deu nam chung lop 'annotation' cho CA HAI mat -
	// nen phai doc geometry.side (addRealSilk/addAutoSilk va nhan footprint trong
	// EditorCommandExecutor luon ghi truong nay) hoac suy tu linh kien chu quan.
	// Tra ve '' khi khong xac dinh duoc: vat the dung chung cho ca hai mat (vien
	// bo, lo khoan, ghi chu nguoi dung tu ve) - nhung thu do luon phai hien.
	Renderer.prototype.objectSide = function (obj) {
		if (obj.layer === 'top_copper' || obj.layer === 'silk_top') return 'top';
		if (obj.layer === 'bottom_copper' || obj.layer === 'silk_bottom') return 'bottom';
		var g = obj.geometry || {};
		if (g.side === 'top' || g.side === 'bottom') return g.side;
		var component = this.app.getComponentById(this.app.getComponentIdForObject(obj));
		if (component && (component.side === 'top' || component.side === 'bottom')) return component.side;
		return '';
	};

	// Doi "Mat ve" (Top/Bottom) truoc gio khong doi gi tren canvas - dong top
	// (do) va bottom (xanh) luon ve full mau chong len nhau nen khong biet dang
	// xem/ve mat nao. Lam mo han thu KHONG thuoc mat dang active de mat do noi
	// len ro rang; via giu nguyen vi no xuyen ca 2 mat, khong thuoc rieng mat nao.
	Renderer.prototype.isInactiveSide = function (obj) {
		if (obj.type === 'via') return false;
		// Pad xuyen lo (co lo khoan) cung xuyen qua ban mach: bo mach that co vong
		// dong o CA HAI mat, nen no phai hien du dang xem mat nao. Chi pad dan be
		// mat (SMD, khong lo khoan) moi thuoc rieng mot mat.
		if (obj.type === 'pad' && Number((obj.geometry || {}).drill || 0) > 0) return false;
		var side = this.objectSide(obj);
		if (!side) return false;
		return side !== (this.app.activeSide === 'bottom' ? 'bottom' : 'top');
	};

	// Khoang cach toi pad gan nhat, tinh mot lan cho ca khung hinh. Do la gioi han
	// that su cua co chu: ve to hon khoang nay thi chac chan de sang chan ben canh.
	// Chia o luoi de khong phai so tung cap mot khi ban mach co hang nghin pad.
	Renderer.prototype.nearestPadGaps = function (items) {
		var cell = 0, i, j;
		for (i = 0; i < items.length; i++) cell = Math.max(cell, items[i].w, items[i].h);
		cell = Math.max(cell, 0.1);
		var buckets = {};
		function key(x, y) { return Math.floor(x / cell) + ':' + Math.floor(y / cell); }
		for (i = 0; i < items.length; i++) {
			var k = key(items[i].x, items[i].y);
			(buckets[k] || (buckets[k] = [])).push(i);
		}
		var gaps = new Array(items.length);
		for (i = 0; i < items.length; i++) {
			var a = items[i], best = Infinity;
			var cx = Math.floor(a.x / cell), cy = Math.floor(a.y / cell);
			for (var ox = -1; ox <= 1; ox++) {
				for (var oy = -1; oy <= 1; oy++) {
					var list = buckets[(cx + ox) + ':' + (cy + oy)];
					if (!list) continue;
					for (var n = 0; n < list.length; n++) {
						j = list[n];
						if (j === i) continue;
						var d = Math.hypot(items[j].x - a.x, items[j].y - a.y);
						if (d < best) best = d;
					}
				}
			}
			gaps[i] = best;
		}
		return gaps;
	};

	Renderer.prototype.drawPinLabels = function (ctx) {
		var items = this.pinLabelQueue || [];
		if (!items.length) return;
		var gaps = this.nearestPadGaps(items);
		ctx.save();
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.lineJoin = 'round';
		for (var i = 0; i < items.length; i++) {
			var it = items[i];
			// Co chu vua trong pad, va luon nho hon khoang cach toi chan ben canh.
			var size = Math.min(it.w * 0.6, it.h * 0.4);
			if (isFinite(gaps[i])) size = Math.min(size, gaps[i] * 0.7);
			// Duoi nguong doc duoc thi an han, giong cach luoi tu an khi zoom xa.
			if (size < 7) continue;
			size = Math.min(size, 16);
			ctx.font = size + 'px sans-serif';
			ctx.lineWidth = Math.max(2, size / 4);
			ctx.strokeStyle = 'rgba(10,14,20,.85)';
			ctx.fillStyle = '#ffffff';
			ctx.strokeText(it.text, it.x, it.y);
			ctx.fillText(it.text, it.x, it.y);

			// Ten chuc nang nam ngoai pad nen chi hien khi con du cho that su.
			if (!it.name) continue;
			var nameSize = Math.min(size * 0.85, isFinite(gaps[i]) ? gaps[i] * 0.5 : size);
			if (nameSize < 8) continue;
			ctx.font = nameSize + 'px sans-serif';
			ctx.lineWidth = Math.max(2, nameSize / 4);
			ctx.strokeText(it.name, it.x, it.y + it.h / 2 + nameSize);
			ctx.fillText(it.name, it.x, it.y + it.h / 2 + nameSize);
			ctx.font = size + 'px sans-serif';
			ctx.lineWidth = Math.max(2, size / 4);
		}
		ctx.restore();
	};

	Renderer.prototype.isRouteDraftObject = function (obj) {
		var drawing = this.app.drawing;
		if (!drawing || !drawing.draftObjects || obj.type !== 'track') return false;
		return drawing.draftObjects.some(function (draft) { return draft.id === obj.id; });
	};

	Renderer.prototype.isActiveRouteObject = function (obj) {
		var drawing = this.app.drawing;
		if (!drawing || !drawing.routeObjects || obj.type !== 'track') return false;
		return drawing.routeObjects.some(function (track) { return track.id === obj.id; });
	};

	Renderer.prototype.resolveObjectColor = function (obj, layer) {
		if (this.app.options.cleanView && (obj.layer === 'top_copper' || obj.layer === 'bottom_copper')) {
			// PCB that: son mask xanh phu kin track va than via, chi lo dong that
			// (vang-dong) o pad - noi mask co lo ho de han linh kien. Duong mach
			// duoi mask KHONG trang/xam: no van la mau xanh cua mask, chi hoi sang
			// hon nen vi lop dong ben duoi lam mask noi go len. Dung mau trang mo
			// se ra vet trang nhu ve chi, sai hoan toan so voi bo mach that.
			if (obj.type === 'pad') return '#d6a94a';
			return '#148554';
		}
		if (obj.type === 'via') return '#d6a94a';
		if (obj.layer === 'top_copper') return '#e53935';
		if (obj.layer === 'bottom_copper') return '#1e88e5';
		if (obj.layer === 'drill') return '#151515';
		if (obj.layer === 'outline') return '#ffd54a';
		if (obj.layer === 'mechanical') return '#7de0ff';
		return layer.color || '#ffffff';
	};

	Renderer.prototype.drawObject = function (ctx, obj) {
		var g = obj.geometry || {};
		if (obj.type === 'track') {
			if (Number(g.bow || 0)) {
				var arcPts = global.DATPCBTracerTools.sampleArcPoints(g, 32);
				if (arcPts && arcPts.length > 1) {
					ctx.lineWidth = Math.max(1, Number(g.width || 0.4) * this.view.scale);
					ctx.lineCap = 'round';
					ctx.beginPath();
					arcPts.forEach(function (pt, i) {
						var sp = this.mmToScreen(pt);
						if (i) ctx.lineTo(sp.x, sp.y); else ctx.moveTo(sp.x, sp.y);
					}, this);
					ctx.stroke();
					return;
				}
			}
			var a = this.mmToScreen({ x: g.x1, y: g.y1 }), b = this.mmToScreen({ x: g.x2, y: g.y2 });
			ctx.lineWidth = Math.max(1, Number(g.width || 0.4) * this.view.scale);
			ctx.lineCap = 'round';
			ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
		} else if (obj.type === 'pad' || obj.type === 'via' || obj.type === 'drill') {
			this.drawPadLike(ctx, obj);
		} else if (obj.type === 'outline' || obj.type === 'region' || obj.type === 'cutout') {
			this.drawPolyline(ctx, obj);
		} else if (obj.type === 'slot') {
			this.drawSlot(ctx, obj);
		} else if (obj.type === 'shape') {
			this.drawShape(ctx, obj);
		} else if (obj.type === 'annotation') {
			var p = this.mmToScreen({ x: g.x, y: g.y });
			ctx.font = Math.max(10, Number(g.size || 2.5) * this.view.scale) + 'px sans-serif';
			ctx.fillText(String(g.text || obj.note || 'Ghi chú').slice(0, 80), p.x, p.y);
		}
	};

	Renderer.prototype.drawPadLike = function (ctx, obj) {
		var g = obj.geometry || {}, p = this.mmToScreen({ x: g.x, y: g.y });
		var width = Number(g.width || g.diameter || 1) * this.view.scale;
		var height = Number(g.height || g.diameter || 1) * this.view.scale;
		ctx.save();
		ctx.translate(p.x, p.y);
		ctx.rotate((Number(g.rotation || 0) * Math.PI) / 180);
		ctx.beginPath();
		if (obj.type === 'drill') {
			// Than lo khoan doc lap cung xep hang ve sau cung (xem queueDrillHole)
			// vi cung bi duong mach ve sau de len y het lo khoan cua pad/via.
		} else if (obj.type === 'via') {
			ctx.arc(0, 0, width / 2, 0, Math.PI * 2);
			ctx.fill();
			// Vien vang sang chi hop ly khi dang chinh sua (de nhan via ra ngay);
			// trong Xem 2D sach via cung bi mask phu nhu track nen cung mau xanh
			// mask, khong phai vien trang/vang noi bat.
			ctx.strokeStyle = this.app.options.cleanView ? '#148554' : '#ffe08a';
			ctx.lineWidth = Math.max(1, 0.12 * this.view.scale);
			ctx.stroke();
		} else if (g.shape === 'rect') {
			ctx.rect(-width / 2, -height / 2, width, height);
			ctx.fill();
		} else if (g.shape === 'roundrect') {
			var radiusPx = Math.min(Number(g.radius || 0) * this.view.scale, width / 2, height / 2);
			this.roundedRectPath(ctx, -width / 2, -height / 2, width, height, radiusPx);
			ctx.fill();
		} else if (g.shape === 'oval') {
			// Gerber xuat pad 'oval' bang khau do O, ma chuan Gerber dinh nghia O la
			// hinh vien nhon (chu nhat bo tron hai dau) chu khong phai e-lip. Ve
			// dung cai se duoc san xuat, thay vi mot hinh nhon hai dau it dong hon.
			this.roundedRectPath(ctx, -width / 2, -height / 2, width, height, Math.min(width, height) / 2);
			ctx.fill();
		} else {
			ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
		var drill = Number(g.drill || 0);
		if (obj.type === 'drill') this.queueDrillHole(ctx, p, width / 2);
		else if (drill > 0) this.queueDrillHole(ctx, p, (drill * this.view.scale) / 2);
		this.drawPinLabel(ctx, obj);
	};

	// Lo khoan KHONG duoc ve ngay tai day: duong mach nao nam sau trong danh sach
	// doi tuong se ve de len va lap lo lai (dung loi "duong mach vao lo khong bi
	// mat" nguoi dung bao). Xep hang de drawDrillHoles() ve sau cung, giong het
	// cach pinLabelQueue da lam de nhan so chan khong bi pad ve sau che mat.
	Renderer.prototype.queueDrillHole = function (ctx, p, radius) {
		if (!this.drillHoleQueue) this.drillHoleQueue = [];
		this.drillHoleQueue.push({ x: p.x, y: p.y, r: radius, alpha: ctx.globalAlpha });
	};

	Renderer.prototype.drawDrillHoles = function (ctx) {
		var holes = this.drillHoleQueue || [];
		if (!holes.length) return;
		ctx.save();
		for (var i = 0; i < holes.length; i++) {
			var hole = holes[i];
			ctx.globalAlpha = hole.alpha;
			ctx.beginPath();
			ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
			ctx.fillStyle = this.drillFillColor();
			ctx.fill();
			ctx.beginPath();
			ctx.arc(hole.x, hole.y, hole.r, 0, Math.PI * 2);
			ctx.strokeStyle = '#050505';
			ctx.lineWidth = Math.max(1, 0.06 * this.view.scale);
			ctx.stroke();
		}
		ctx.restore();
	};

	// Khong ve ngay: chi xep hang. Moi pad mot nhan rieng dat o TAM pad, co chu do
	// drawPinLabels() quyet dinh sau khi da biet khoang cach toi chan gan nhat.
	// Truoc day nhan duoc ve ngay tai day, dat ngoai mep pad voi co chu tinh theo
	// muc zoom, nen ca mot hang TSSOP don nhan len cung mot duong ngang va chong
	// len nhau khi pitch nho hon be rong chu.
	Renderer.prototype.drawPinLabel = function (ctx, obj) {
		var g = obj.geometry || {};
		var label = g.ai_pin || g.pin_number || '';
		if (label === '' || label === null || typeof label === 'undefined') return;
		if (!this.pinLabelQueue) this.pinLabelQueue = [];
		var p = this.mmToScreen({ x: g.x, y: g.y });
		this.pinLabelQueue.push({
			text: String(label).slice(0, 4),
			name: (g.pin_name && !g.suppress_pin_name) ? String(g.pin_name).slice(0, 8) : '',
			x: p.x,
			y: p.y,
			w: Number(g.width || g.diameter || 1) * this.view.scale,
			h: Number(g.height || g.diameter || 1) * this.view.scale
		});
	};

	Renderer.prototype.drawPolyline = function (ctx, obj) {
		var pts = (obj.geometry && obj.geometry.points) || [];
		if (!pts.length) return;
		ctx.lineWidth = obj.type === 'outline' ? 2 : 1.5;
		ctx.beginPath();
		pts.forEach(function (pt, i) {
			var p = this.mmToScreen(pt);
			if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
		}, this);
		if (obj.geometry.closed || obj.type === 'region' || obj.type === 'cutout') ctx.closePath();
		if (obj.type === 'region') ctx.fill(); else ctx.stroke();
	};

	Renderer.prototype.drawSlot = function (ctx, obj) {
		var g = obj.geometry || {};
		var a = this.mmToScreen({ x: g.x1, y: g.y1 });
		var b = this.mmToScreen({ x: g.x2, y: g.y2 });
		ctx.lineWidth = Math.max(2, Number(g.width || 0.8) * this.view.scale);
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(a.x, a.y);
		ctx.lineTo(b.x, b.y);
		ctx.stroke();
	};

	Renderer.prototype.drawShape = function (ctx, obj) {
		var g = obj.geometry || {};
		ctx.lineWidth = Math.max(1, Number(g.strokeWidth || 0.2) * this.view.scale);
		if (g.shape === 'line') {
			var a = this.mmToScreen({ x: g.x1, y: g.y1 });
			var b = this.mmToScreen({ x: g.x2, y: g.y2 });
			ctx.beginPath();
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
			ctx.stroke();
			return;
		}
		if (g.shape === 'polygon') {
			this.drawPolyline(ctx, { type: 'outline', geometry: { points: g.points || [], closed: !!g.closed } });
			return;
		}
		if (g.shape === 'bezier') {
			var p1 = this.mmToScreen({ x: g.x1, y: g.y1 });
			var p2 = this.mmToScreen({ x: g.x2, y: g.y2 });
			var cp = this.mmToScreen({ x: g.cx, y: g.cy });
			ctx.beginPath();
			ctx.moveTo(p1.x, p1.y);
			ctx.quadraticCurveTo(cp.x, cp.y, p2.x, p2.y);
			ctx.stroke();
			return;
		}
		ctx.save();
		ctx.translate(this.view.ox + Number(g.x || 0) * this.view.scale, this.view.oy + Number(g.y || 0) * this.view.scale);
		ctx.rotate((Number(g.rotation || 0) * Math.PI) / 180);
		ctx.beginPath();
		if (g.shape === 'rectangle') {
			ctx.rect((-Number(g.width || 0) * this.view.scale) / 2, (-Number(g.height || 0) * this.view.scale) / 2, Number(g.width || 0) * this.view.scale, Number(g.height || 0) * this.view.scale);
			ctx.stroke();
		} else if (g.shape === 'rounded_rectangle') {
			this.roundedRectPath(ctx, (-Number(g.width || 0) * this.view.scale) / 2, (-Number(g.height || 0) * this.view.scale) / 2, Number(g.width || 0) * this.view.scale, Number(g.height || 0) * this.view.scale, Number(g.radius || 1) * this.view.scale);
			ctx.stroke();
		} else if (g.shape === 'circle') {
			ctx.arc(0, 0, Number(g.radius || 0) * this.view.scale, 0, Math.PI * 2);
			ctx.stroke();
		} else if (g.shape === 'arc') {
			ctx.arc(0, 0, Number(g.radius || 0) * this.view.scale, Number(g.startAngle || 180) * Math.PI / 180, Number(g.endAngle || 0) * Math.PI / 180, false);
			ctx.stroke();
		}
		ctx.restore();
	};

	Renderer.prototype.roundedRectPath = function (ctx, x, y, w, h, r) {
		r = Math.max(0, Math.min(r, Math.min(Math.abs(w), Math.abs(h)) / 2));
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.arcTo(x + w, y, x + w, y + r, r);
		ctx.lineTo(x + w, y + h - r);
		ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
		ctx.lineTo(x + r, y + h);
		ctx.arcTo(x, y + h, x, y + h - r, r);
		ctx.lineTo(x, y + r);
		ctx.arcTo(x, y, x + r, y, r);
	};

	Renderer.prototype.drawSelection = function (ctx, obj) {
		var c = global.DATPCBTracerTools.getObjectCenter(obj);
		var p = this.mmToScreen(c);
		ctx.save();
		ctx.strokeStyle = '#ffffff';
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 3]);
		ctx.strokeRect(p.x - 7, p.y - 7, 14, 14);
		ctx.restore();
	};

	Renderer.prototype.drawActivePin = function (ctx, obj) {
		var bounds = global.DATPCBTracerTools.getObjectBounds(obj);
		var p0 = this.mmToScreen({ x: bounds.minX, y: bounds.minY });
		var p1 = this.mmToScreen({ x: bounds.maxX, y: bounds.maxY });
		ctx.save();
		ctx.strokeStyle = '#ffc107';
		ctx.lineWidth = 2;
		ctx.setLineDash([]);
		ctx.strokeRect(p0.x - 5, p0.y - 5, (p1.x - p0.x) + 10, (p1.y - p0.y) + 10);
		ctx.restore();
	};

	Renderer.prototype.drawSnapCandidate = function (ctx) {
		if (!(this.app.isTabletMode && this.app.isTabletMode()) || !this.snapCandidate) return;
		if (!(this.app.tool === 'track' || (this.app.drawing && this.app.drawing.obj && this.app.drawing.obj.type === 'track'))) return;
		var p = this.mmToScreen(this.snapCandidate.p);
		ctx.save();
		ctx.strokeStyle = '#48e0a4';
		ctx.fillStyle = 'rgba(72,224,164,.18)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(p.x, p.y, this.snapCandidate.obj.type === 'track' ? 16 : 22, 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
		if (this.snapCandidate.p.kind) {
			ctx.font = '12px sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'bottom';
			ctx.lineWidth = 3;
			ctx.strokeStyle = 'rgba(16,21,28,.9)';
			ctx.fillStyle = '#d8fff0';
			ctx.strokeText(this.snapCandidate.p.kind, p.x, p.y - 24);
			ctx.fillText(this.snapCandidate.p.kind, p.x, p.y - 24);
		}
		ctx.restore();
	};

	global.DATPCBTracerCanvas = Renderer;
})(window);
