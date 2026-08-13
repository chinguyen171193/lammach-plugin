(function (global) {
	'use strict';

	// Handles tablet-only touch gestures while leaving mouse/pen drawing to the canvas engine.
	function TabletGesture(app, contextMenu) {
		this.app = app;
		this.contextMenu = contextMenu;
		this.pointers = {};
		this.longPressTimer = null;
		this.longPressPoint = null;
		this.lastTap = null;
		this.pinching = false;
		this.lastCenter = null;
		this.lastDistance = 0;
		this.penActiveUntil = 0;
		this.consumeReason = '';
	}

	TabletGesture.prototype.enabled = function () {
		return this.app.isTabletMode && this.app.isTabletMode();
	};

	TabletGesture.prototype.handlePointerDown = function (e, renderer) {
		this.consumeReason = '';
		if (!this.enabled()) return false;
		this.app.root.setAttribute('data-pointer-type', e.pointerType || 'mouse');
		if (e.pointerType === 'pen') {
			this.penActiveUntil = Date.now() + 1400;
			return false;
		}
		if (e.pointerType !== 'touch') return false;
		e.preventDefault();
		if (Date.now() < this.penActiveUntil) {
			this.consumeReason = 'palm';
			return true;
		}
		this.pointers[e.pointerId] = this.pointFromEvent(e);
		if (this.countPointers() >= 2) {
			this.clearLongPress();
			this.startPinch();
			this.consumeReason = 'pinch';
			return true;
		}
		if (this.isDoubleTap(e)) {
			if (this.app.tool === 'track' && this.app.drawing && this.app.drawing.routeObjects) {
				this.app.finishRouteAt(renderer.snap(renderer.clientToMm(e.clientX, e.clientY)));
			} else {
				renderer.zoomAt(e.clientX, e.clientY, 1.6);
			}
			this.lastTap = null;
			this.consumeReason = 'doubletap';
			return true;
		}
		this.startLongPress(e, renderer);
		return false;
	};

	TabletGesture.prototype.handlePointerMove = function (e, renderer) {
		if (!this.enabled()) return false;
		if (e.pointerType === 'touch' && Date.now() < this.penActiveUntil) return true;
		if (!this.pointers[e.pointerId]) return false;
		this.pointers[e.pointerId] = this.pointFromEvent(e);
		this.cancelLongPressOnMove(e);
		if (this.pinching && this.countPointers() >= 2) {
			e.preventDefault();
			var gesture = this.measure();
			if (this.lastDistance > 0) renderer.zoomAt(gesture.center.x, gesture.center.y, gesture.distance / this.lastDistance);
			if (this.lastCenter) renderer.panBy(gesture.center.x - this.lastCenter.x, gesture.center.y - this.lastCenter.y);
			this.lastCenter = gesture.center;
			this.lastDistance = gesture.distance;
			return true;
		}
		return false;
	};

	TabletGesture.prototype.handlePointerUp = function (e) {
		if (!this.enabled()) return false;
		var point = this.pointers[e.pointerId];
		var wasPinching = this.pinching;
		if (point && !wasPinching && this.consumeReason !== 'doubletap') {
			this.lastTap = { time: Date.now(), x: point.x, y: point.y };
		}
		delete this.pointers[e.pointerId];
		this.clearLongPress();
		if (this.countPointers() < 2) {
			this.pinching = false;
			this.lastCenter = null;
			this.lastDistance = 0;
		}
		if (!this.countPointers()) this.consumeReason = '';
		return wasPinching;
	};

	TabletGesture.prototype.pointFromEvent = function (e) {
		return { x: e.clientX, y: e.clientY };
	};

	TabletGesture.prototype.countPointers = function () {
		return Object.keys(this.pointers).length;
	};

	TabletGesture.prototype.measure = function () {
		var ids = Object.keys(this.pointers);
		var a = this.pointers[ids[0]], b = this.pointers[ids[1]];
		return {
			center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
			distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
		};
	};

	TabletGesture.prototype.startPinch = function () {
		var gesture = this.measure();
		this.pinching = true;
		this.lastCenter = gesture.center;
		this.lastDistance = gesture.distance;
	};

	TabletGesture.prototype.isDoubleTap = function (e) {
		if (!this.lastTap) return false;
		return Date.now() - this.lastTap.time < 320 && Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 34;
	};

	TabletGesture.prototype.startLongPress = function (e, renderer) {
		var self = this;
		this.clearLongPress();
		this.longPressPoint = { x: e.clientX, y: e.clientY };
		this.longPressTimer = global.setTimeout(function () {
			renderer.cancelPointerDrag();
			if (self.app.tool === 'track' && self.app.drawing && self.app.drawing.routeObjects) self.app.finishRoute();
			self.contextMenu.selectAt(self.longPressPoint.x, self.longPressPoint.y);
			self.contextMenu.showAt(self.longPressPoint.x, self.longPressPoint.y);
		}, 500);
	};

	TabletGesture.prototype.cancelLongPressOnMove = function (e) {
		if (!this.longPressPoint) return;
		if (Math.hypot(e.clientX - this.longPressPoint.x, e.clientY - this.longPressPoint.y) > 12) this.clearLongPress();
	};

	TabletGesture.prototype.clearLongPress = function () {
		if (this.longPressTimer) global.clearTimeout(this.longPressTimer);
		this.longPressTimer = null;
		this.longPressPoint = null;
	};

	global.LMPCBTabletGesture = TabletGesture;
})(window);
