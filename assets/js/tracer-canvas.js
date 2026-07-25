(function (global) {
	'use strict';

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
		if (e.button === 1 || e.button === 2 || this.spaceDown) {
			e.preventDefault();
			this.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: this.view.ox, oy: this.view.oy };
			this.canvas.classList.add('is-panning');
			return;
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
		} else if (this.drag) {
			this.app.pointerMove(p, e);
			this.invalidate();
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
		if (this.drag) {
			this.app.pointerUp();
		}
		this.canvas.classList.remove('is-panning');
		this.drag = null;
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
		} else if (this.drag) {
			this.app.pointerUp();
		}
		this.canvas.classList.remove('is-panning');
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
		ctx.clearRect(0, 0, w, h);
		ctx.fillStyle = '#10151c';
		ctx.fillRect(0, 0, w, h);
		this.drawGrid(ctx, w, h);
		this.drawBoard(ctx);
		this.drawImages(ctx);
		this.drawObjects(ctx);
		this.drawSnapCandidate(ctx);
	};

	Renderer.prototype.drawGrid = function (ctx, w, h) {
		if (!this.app.options.gridVisible) return;
		var grid = Number(this.app.state.board.grid_mm || 0.5);
		var step = grid * this.view.scale;
		if (step < 4) return;
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

	Renderer.prototype.drawBoard = function (ctx) {
		var b = this.app.state.board;
		var p0 = this.mmToScreen({ x: 0, y: 0 });
		ctx.save();
		ctx.strokeStyle = '#ffd54a';
		ctx.lineWidth = 2;
		ctx.strokeRect(p0.x, p0.y, b.width_mm * this.view.scale, b.height_mm * this.view.scale);
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
		this.app.state.objects.forEach(function (obj) {
			if (!obj.visible || !this.app.layerVisible(obj.layer)) return;
			var layer = this.app.state.layers[obj.layer] || {};
			var drawColor = this.resolveObjectColor(obj, layer);
			var isRouteDraft = this.isRouteDraftObject(obj);
			ctx.save();
			ctx.globalAlpha = Number(layer.opacity || 1);
			ctx.strokeStyle = drawColor;
			ctx.fillStyle = drawColor;
			if (isRouteDraft) {
				ctx.shadowColor = 'rgba(255, 193, 7, .55)';
				ctx.shadowBlur = 8;
			}
			this.drawObject(ctx, obj);
			if (this.app.selected.indexOf(obj.id) !== -1) this.drawSelection(ctx, obj);
			if (this.app.activePinId && this.app.activePinId === obj.id) this.drawActivePin(ctx, obj);
			ctx.restore();
		}, this);
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
			ctx.arc(0, 0, width / 2, 0, Math.PI * 2);
			ctx.fillStyle = '#050505';
			ctx.fill();
		} else if (obj.type === 'via') {
			ctx.arc(0, 0, width / 2, 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = '#ffe08a';
			ctx.lineWidth = Math.max(1, 0.12 * this.view.scale);
			ctx.stroke();
		} else if (g.shape === 'rect') {
			ctx.rect(-width / 2, -height / 2, width, height);
			ctx.fill();
		} else {
			ctx.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2);
			ctx.fill();
		}
		var drill = Number(g.drill || 0);
		if (drill > 0) {
			ctx.globalCompositeOperation = 'destination-out';
			ctx.beginPath(); ctx.arc(0, 0, (drill * this.view.scale) / 2, 0, Math.PI * 2); ctx.fill();
			ctx.globalCompositeOperation = 'source-over';
			ctx.beginPath();
			ctx.arc(0, 0, (drill * this.view.scale) / 2, 0, Math.PI * 2);
			ctx.strokeStyle = '#050505';
			ctx.lineWidth = Math.max(1, 0.06 * this.view.scale);
			ctx.stroke();
		}
		ctx.restore();
		this.drawPinLabel(ctx, obj);
	};

	Renderer.prototype.drawPinLabel = function (ctx, obj) {
		var g = obj.geometry || {};
		var label = g.ai_pin || g.pin_number || '';
		if (!label) return;
		var p = this.mmToScreen({ x: g.x, y: g.y });
		var width = Number(g.width || g.diameter || 1) * this.view.scale;
		var height = Number(g.height || g.diameter || 1) * this.view.scale;
		ctx.save();
		ctx.font = Math.max(9, Math.min(14, 1.25 * this.view.scale)) + 'px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.lineWidth = 3;
		ctx.strokeStyle = 'rgba(16,21,28,.9)';
		ctx.fillStyle = '#ffffff';
		ctx.strokeText(String(label).slice(0, 4), p.x, p.y - height / 2 - 8);
		ctx.fillText(String(label).slice(0, 4), p.x, p.y - height / 2 - 8);
		if (g.pin_name && !g.suppress_pin_name) {
			ctx.font = Math.max(8, Math.min(12, 1.05 * this.view.scale)) + 'px sans-serif';
			ctx.strokeText(String(g.pin_name).slice(0, 8), p.x, p.y + height / 2 + 8);
			ctx.fillText(String(g.pin_name).slice(0, 8), p.x, p.y + height / 2 + 8);
		}
		ctx.restore();
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
