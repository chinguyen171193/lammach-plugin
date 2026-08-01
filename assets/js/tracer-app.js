(function (global, document) {
	'use strict';

	function qs(root, selector) {
		return root.querySelector(selector);
	}

	function el(tag, text) {
		var node = document.createElement(tag);
		if (text !== undefined) node.textContent = text;
		return node;
	}

	function applyFrontendFullscreen(root) {
		if (!root.classList.contains('dat-pcb-tracer-fullscreen')) return;
		var wrap = root.closest('.dat-pcb-tracer-shortcode-wrap') || root.parentElement;
		document.documentElement.classList.add('dat-pcb-tracer-fullscreen-active');
		document.body.classList.add('dat-pcb-tracer-fullscreen-active');
		if (wrap) {
			wrap.style.position = 'fixed';
			wrap.style.inset = '0';
			wrap.style.width = '100vw';
			wrap.style.height = '100vh';
			wrap.style.maxWidth = 'none';
			wrap.style.margin = '0';
			wrap.style.padding = '0';
			wrap.style.overflow = 'hidden';
			wrap.style.zIndex = '2147483000';
		}
		root.style.width = '100vw';
		root.style.height = '100vh';
		root.style.minHeight = '100vh';
		root.style.maxWidth = 'none';
		root.style.margin = '0';
	}

	function defaultProject() {
		var now = new Date().toISOString();
		return {
			version: '1.0',
			project: { name: 'Dự án PCB mới', code: 'pcb-' + Date.now().toString(36), created_at: now, updated_at: now },
			board: { width_mm: 100, height_mm: 80, origin_x: 0, origin_y: 0, grid_mm: 0.5 },
			images: {
				top: { attachment_id: 0, url: '', visible: true, locked: true, opacity: 0.5, x: 0, y: 0, scale_x: 1, scale_y: 1, rotation: 0, flip_x: false, flip_y: false, calibration: {}, transform: {} },
				bottom: { attachment_id: 0, url: '', visible: true, locked: true, opacity: 0.5, x: 0, y: 0, scale_x: 1, scale_y: 1, rotation: 0, flip_x: false, flip_y: false, calibration: {}, transform: {} }
			},
			layers: {
				background_top: { name: 'Background Top', visible: true, locked: true, opacity: 0.5, color: '#ffffff' },
				background_bottom: { name: 'Background Bottom', visible: false, locked: true, opacity: 0.5, color: '#9ecbff' },
				outline: { name: 'Board Outline', visible: true, locked: false, opacity: 1, color: '#ffd54a' },
				top_copper: { name: 'Top Copper', visible: true, locked: false, opacity: 1, color: '#e53935' },
				bottom_copper: { name: 'Bottom Copper', visible: true, locked: false, opacity: 1, color: '#1e88e5' },
				drill: { name: 'Drill', visible: true, locked: false, opacity: 1, color: '#151515' },
				mechanical: { name: 'Mechanical', visible: true, locked: false, opacity: 1, color: '#7de0ff' },
				annotation: { name: 'Annotation', visible: true, locked: false, opacity: 1, color: '#f8f8f2' }
			},
			components: [],
			objects: []
		};
	}

	function App(root) {
		this.root = root;
		this.state = defaultProject();
		this.projectId = Number(global.DATPCBTracer.projectId || 0);
		this.tool = 'select';
		this.activeSide = 'top';
		this.activeLayer = 'top_copper';
		this.selected = [];
		this.activePinId = '';
		this.cursor = { x: 0, y: 0 };
		this.options = { gridVisible: true, snap: true, trackWidth: 0.4, padDia: 1.6, drillDia: 0.8, routeMode: '45', arcBow: 0.35, cleanView: false };
		this._boardResize = null;
		this.history = new global.DATPCBTracerHistory(100);
		this.dirty = false;
		this.drawing = null;
		this.calibration = null;
		this.measure = null;
		this.clipboard = [];
		this.canvas = new global.DATPCBTracerCanvas(qs(root, '#dat-pcb-tracer-canvas'), this);
		this.layersPanel = global.DATPCBLayersPanel ? new global.DATPCBLayersPanel(this) : null;
		this.propertiesPanel = global.DATPCBPropertiesPanel ? new global.DATPCBPropertiesPanel(this) : null;
		this.personalLibrary = global.DATPCBPersonalLibrary ? new global.DATPCBPersonalLibrary(this) : null;
		this.buildFileMenu();
		this.bind();
		this.renderAll();
		this.loadInitial();
		this.startAutosave();
	}

	App.prototype.buildFileMenu = function () {
		var toolbar = qs(this.root, '.dat-pcb-toolbar');
		if (!toolbar || qs(toolbar, '.dat-pcb-file-menu')) return;
		var self = this;
		var menu = el('div');
		menu.className = 'dat-pcb-file-menu';
		var trigger = el('button', 'File');
		trigger.type = 'button';
		trigger.className = 'dat-pcb-file-menu-button';
		trigger.setAttribute('aria-haspopup', 'true');
		trigger.setAttribute('aria-expanded', 'false');
		var popover = el('div');
		popover.className = 'dat-pcb-file-menu-popover';
		popover.hidden = true;
		var exportLabel = el('div', 'Xuất');
		exportLabel.className = 'dat-pcb-file-menu-label';
		var gerber = el('button', 'Gerber (.zip)');
		gerber.type = 'button';
		gerber.setAttribute('data-action', 'export-gerber');
		var libraryLabel = el('div', 'Thư viện');
		libraryLabel.className = 'dat-pcb-file-menu-label';
		var library = el('button', 'Thư viện cá nhân');
		library.type = 'button';
		library.setAttribute('data-action', 'personal-library');
		popover.appendChild(exportLabel);
		popover.appendChild(gerber);
		popover.appendChild(libraryLabel);
		popover.appendChild(library);
		trigger.addEventListener('click', function (event) {
			event.stopPropagation();
			popover.hidden = !popover.hidden;
			trigger.setAttribute('aria-expanded', popover.hidden ? 'false' : 'true');
		});
		document.addEventListener('click', function () {
			popover.hidden = true;
			trigger.setAttribute('aria-expanded', 'false');
		});
		menu.addEventListener('click', function (event) {
			var action = event.target.getAttribute('data-action');
			if (action) {
				popover.hidden = true;
				trigger.setAttribute('aria-expanded', 'false');
				self.action(action);
			}
			event.stopPropagation();
		});
		menu.appendChild(trigger);
		menu.appendChild(popover);
		toolbar.insertBefore(menu, toolbar.firstChild);
	};

	App.prototype.bind = function () {
		var self = this;
		this.root.addEventListener('click', function (e) {
			var routeModeButton = e.target.closest('[data-route-mode]');
			if (routeModeButton && self.root.contains(routeModeButton)) {
				self.setRouteMode(routeModeButton.getAttribute('data-route-mode'));
				return;
			}
			var toolNode = e.target.closest('[data-tool]');
			var actionNode = e.target.closest('[data-action]');
			var tool = toolNode && toolNode.getAttribute('data-tool');
			var action = actionNode && actionNode.getAttribute('data-action');
			if (tool) self.setTool(tool);
			if (action) self.action(action);
		});
		this.root.addEventListener('change', function (e) {
			if (e.target.matches('[data-grid]')) {
				self.state.board.grid_mm = Number(e.target.value);
				self.markDirty();
			} else if (e.target.matches('[data-grid-visible]')) {
				self.options.gridVisible = e.target.checked;
				self.canvas.invalidate();
			} else if (e.target.matches('[data-snap]')) {
				self.options.snap = e.target.checked;
			} else if (e.target.matches('[data-clean-view]')) {
				self.options.cleanView = e.target.checked;
				self.canvas.invalidate();
			} else if (e.target.matches('[data-active-side]')) {
				self.activeSide = e.target.value;
			} else if (e.target.matches('[data-upload-side]') && e.target.files[0]) {
				self.uploadImage(e.target.getAttribute('data-upload-side'), e.target.files[0]);
			} else if (e.target.matches('[data-prop]')) {
				self.updateSelectedProperty(e.target);
			}
		});
		this.root.addEventListener('input', function (e) {
			if (e.target.matches('[data-track-width]')) self.options.trackWidth = Number(e.target.value);
			if (e.target.matches('[data-pad-dia]')) self.options.padDia = Number(e.target.value);
			if (e.target.matches('[data-drill-dia]')) self.options.drillDia = Number(e.target.value);
			if (e.target.matches('[data-image-opacity]')) {
				self.state.images[self.activeSide].opacity = Number(e.target.value);
				self.state.layers[self.activeSide === 'top' ? 'background_top' : 'background_bottom'].opacity = Number(e.target.value);
				self.markDirty();
			}
			if (e.target.matches('[data-prop]')) self.updateSelectedProperty(e.target);
			if (e.target.matches('[data-project-name]')) { self.state.project.name = e.target.value; self.markDirty(false); }
			if (e.target.matches('[data-project-code]')) { self.state.project.code = e.target.value; self.markDirty(false); }
		});
		document.addEventListener('keydown', function (e) {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); self.save(); }
			else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) { e.preventDefault(); self.redo(); }
			else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); self.undo(); }
			else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); self.redo(); }
			else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); self.duplicateSelected(); }
			else if (e.key === 'Delete') self.deleteSelected();
			else if (e.key === 'Escape') self.cancelTool();
			else if ((e.key === '[' || e.key === ']') && self.tool === 'track' && self.drawing && self.drawing.obj) {
				e.preventDefault();
				var delta = e.key === ']' ? 0.05 : -0.05;
				self.options.arcBow = Math.max(-1.5, Math.min(1.5, (self.options.arcBow || 0) + delta));
				if (Number(self.drawing.obj.geometry.bow || 0)) {
					self.drawing.obj.geometry.bow = self.options.arcBow;
					self.canvas.invalidate();
				}
			}
		});
		qs(this.root, '[data-modal-close]').addEventListener('click', function () {
			qs(self.root, '[data-modal]').hidden = true;
		});
	};

	App.prototype.loadInitial = function () {
		var self = this;
		if (this.projectId) {
			global.DATPCBTracerStorage.read(this.projectId).then(function (res) {
				self.state = res.data;
				self.normalizeState();
				self.activePinId = '';
				self.renderAll();
				self.canvas.fit();
				self.setSaveStatus('Đã lưu');
			}).catch(function (err) { self.showMessage(err.message); });
		} else {
			this.canvas.fit();
		}
	};

	App.prototype.normalizeState = function () {
		if (!Array.isArray(this.state.components)) this.state.components = [];
		if (!Array.isArray(this.state.objects)) this.state.objects = [];
	};

	App.prototype.layerVisible = function (key) {
		return !!(this.state.layers[key] && this.state.layers[key].visible);
	};

	App.prototype.setTool = function (tool) {
		if (tool !== 'measure') this.measure = null;
		this.tool = tool;
		this.drawing = null;
		this.updateRouteModeControls();
		this.updateStatus();
	};

	App.prototype.setRouteMode = function (mode) {
		if (['free', '45', '90', 'arc'].indexOf(mode) === -1) mode = '45';
		this.options.routeMode = mode;
		if (this.tool === 'track' && this.drawing && this.drawing.obj) {
			this.updateRoutePreview(this.cursor || this.drawing.anchor);
			this.canvas.invalidate();
		}
		this.updateRouteModeControls();
		this.updateStatus();
		this.root.dispatchEvent(new CustomEvent('datpcb:routemodechange', { detail: { routeMode: mode } }));
	};

	App.prototype.updateRouteModeControls = function () {
		var mode = this.options.routeMode || '45';
		Array.prototype.forEach.call(this.root.querySelectorAll('[data-route-mode]'), function (button) {
			var active = button.getAttribute('data-route-mode') === mode;
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-pressed', active ? 'true' : 'false');
		});
	};

	App.prototype.isPolylineTool = function (tool) {
		return ['outline', 'region', 'shape_polygon', 'cutout'].indexOf(tool) !== -1;
	};

	App.prototype.isDragTool = function (tool) {
		return ['shape_line', 'shape_rectangle', 'shape_rounded_rectangle', 'shape_circle', 'shape_arc', 'shape_bezier', 'slot', 'mechanical'].indexOf(tool) !== -1;
	};

	App.prototype.updateDraftObject = function (obj, p, origin) {
		var g = (obj && obj.geometry) || {};
		if (!obj) return;
		if (obj.type === 'track' || obj.type === 'slot') {
			g.x2 = p.x;
			g.y2 = p.y;
			return;
		}
		if (obj.type !== 'shape') return;
		if (g.shape === 'line') {
			g.x2 = p.x;
			g.y2 = p.y;
		} else if (g.shape === 'rectangle' || g.shape === 'rounded_rectangle') {
			origin = origin || { x: g.x || 0, y: g.y || 0 };
			g.x = (origin.x + p.x) / 2;
			g.y = (origin.y + p.y) / 2;
			g.width = Math.abs(p.x - origin.x);
			g.height = Math.abs(p.y - origin.y);
		} else if (g.shape === 'circle') {
			g.radius = Math.hypot(p.x - g.x, p.y - g.y);
		} else if (g.shape === 'arc') {
			g.radius = Math.hypot(p.x - g.x, p.y - g.y);
			g.endAngle = Math.atan2(p.y - g.y, p.x - g.x) * 180 / Math.PI;
		} else if (g.shape === 'bezier') {
			g.x2 = p.x;
			g.y2 = p.y;
			g.cx = (g.x1 + p.x) / 2;
			g.cy = Math.min(g.y1, p.y) - Math.max(4, Math.abs(p.x - g.x1) * 0.25);
		}
	};

	App.prototype.trackPoint = function (p) {
		return { x: Number(p.x || 0), y: Number(p.y || 0) };
	};

	App.prototype.samePoint = function (a, b, tolerance) {
		tolerance = tolerance || 0.0001;
		return Math.abs(Number(a.x || 0) - Number(b.x || 0)) <= tolerance && Math.abs(Number(a.y || 0) - Number(b.y || 0)) <= tolerance;
	};

	App.prototype.addCleanPoint = function (points, point) {
		point = this.trackPoint(point);
		if (!points.length || !this.samePoint(points[points.length - 1], point)) points.push(point);
	};

	App.prototype.calculateRoutePoints = function (start, end, mode) {
		var points = [];
		start = this.trackPoint(start);
		end = this.trackPoint(end);
		mode = mode || this.options.routeMode || '45';
		this.addCleanPoint(points, start);
		if (this.samePoint(start, end)) {
			this.addCleanPoint(points, end);
			return points;
		}
		if (mode === 'free') {
			this.addCleanPoint(points, end);
			return points;
		}
		if (mode === '90') {
			var horizontalFirst = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
			this.addCleanPoint(points, horizontalFirst ? { x: end.x, y: start.y } : { x: start.x, y: end.y });
			this.addCleanPoint(points, end);
			return points;
		}
		var dx = end.x - start.x;
		var dy = end.y - start.y;
		var ax = Math.abs(dx);
		var ay = Math.abs(dy);
		var sx = dx < 0 ? -1 : 1;
		var sy = dy < 0 ? -1 : 1;
		if (Math.abs(ax - ay) <= 0.0001) {
			this.addCleanPoint(points, end);
			return points;
		}
		if (ax > ay) {
			this.addCleanPoint(points, { x: end.x - sx * ay, y: start.y });
		} else {
			this.addCleanPoint(points, { x: start.x, y: end.y - sy * ax });
		}
		this.addCleanPoint(points, end);
		return points;
	};

	App.prototype.routeSegmentsFromPoints = function (points) {
		var segments = [];
		for (var i = 1; i < points.length; i++) {
			if (!this.samePoint(points[i - 1], points[i])) segments.push({ start: points[i - 1], end: points[i] });
		}
		return segments;
	};

	App.prototype.createTrackSegment = function (start, end) {
		var base = this.drawing && this.drawing.routeObjects && this.drawing.routeObjects[0];
		return {
			id: global.DATPCBTracerTools.makeId(),
			type: 'track',
			layer: base ? base.layer : (this.activeSide === 'bottom' ? 'bottom_copper' : 'top_copper'),
			geometry: {
				x1: Number(start.x || 0),
				y1: Number(start.y || 0),
				x2: Number(end.x || 0),
				y2: Number(end.y || 0),
				width: this.options.trackWidth || 0.4,
				route_mode: this.options.routeMode || '45',
				bow: 0
			},
			style: {},
			locked: false,
			visible: true,
			note: ''
		};
	};

	App.prototype.setTrackSegmentGeometry = function (obj, segment) {
		var g = obj.geometry || (obj.geometry = {});
		g.x1 = Number(segment.start.x || 0);
		g.y1 = Number(segment.start.y || 0);
		g.x2 = Number(segment.end.x || 0);
		g.y2 = Number(segment.end.y || 0);
		g.width = this.options.trackWidth || g.width || 0.4;
		g.route_mode = this.options.routeMode || '45';
		g.bow = 0;
	};

	App.prototype.removeObjectById = function (id) {
		this.state.objects = this.state.objects.filter(function (obj) { return obj.id !== id; });
		this.selected = this.selected.filter(function (selectedId) { return selectedId !== id; });
	};

	App.prototype.ensureRouteDraftObject = function () {
		if (!this.drawing || !this.drawing.anchor) return null;
		var draft = this.createTrackSegment(this.drawing.anchor, this.drawing.anchor);
		this.state.objects.push(draft);
		this.drawing.routeObjects.push(draft);
		this.drawing.draftObjects.push(draft);
		this.drawing.obj = draft;
		this.selected = [draft.id];
		return draft;
	};

	App.prototype.updateRoutePreview = function (p) {
		if (!this.drawing || !this.drawing.anchor) return;
		if ((this.options.routeMode || '45') === 'arc') {
			this.updateArcRoutePreview(p);
			return;
		}
		var points = this.calculateRoutePoints(this.drawing.anchor, p, this.options.routeMode || '45');
		var segments = this.routeSegmentsFromPoints(points);
		if (!segments.length) segments = [{ start: this.drawing.anchor, end: this.drawing.anchor }];
		while (this.drawing.draftObjects.length < segments.length) {
			var extra = this.createTrackSegment(this.drawing.anchor, this.drawing.anchor);
			this.state.objects.push(extra);
			this.drawing.routeObjects.push(extra);
			this.drawing.draftObjects.push(extra);
		}
		while (this.drawing.draftObjects.length > segments.length) {
			var removed = this.drawing.draftObjects.pop();
			this.removeObjectById(removed.id);
			this.drawing.routeObjects = this.drawing.routeObjects.filter(function (obj) { return obj.id !== removed.id; });
		}
		segments.forEach(function (segment, index) {
			this.setTrackSegmentGeometry(this.drawing.draftObjects[index], segment);
		}, this);
		this.drawing.obj = this.drawing.draftObjects[this.drawing.draftObjects.length - 1] || null;
		if (this.drawing.obj) this.selected = [this.drawing.obj.id];
	};

	App.prototype.updateArcRoutePreview = function (p) {
		while (this.drawing.draftObjects.length > 1) {
			var removed = this.drawing.draftObjects.pop();
			this.removeObjectById(removed.id);
			this.drawing.routeObjects = this.drawing.routeObjects.filter(function (obj) { return obj.id !== removed.id; });
		}
		var draft = this.drawing.draftObjects[0] || this.ensureRouteDraftObject();
		this.setTrackSegmentGeometry(draft, { start: this.drawing.anchor, end: p });
		draft.geometry.bow = this.options.arcBow || 0;
		this.drawing.obj = draft;
		this.selected = [draft.id];
	};

	App.prototype.trackLength = function (obj) {
		var g = (obj && obj.geometry) || {};
		return Math.hypot(Number(g.x2 || 0) - Number(g.x1 || 0), Number(g.y2 || 0) - Number(g.y1 || 0));
	};

	App.prototype.roundTrackGeometry = function (obj) {
		var g = (obj && obj.geometry) || {};
		['x1', 'y1', 'x2', 'y2'].forEach(function (key) {
			g[key] = Math.round(Number(g[key] || 0) * 10000) / 10000;
		});
	};

	App.prototype.trackDirection = function (obj) {
		var g = (obj && obj.geometry) || {};
		var dx = Number(g.x2 || 0) - Number(g.x1 || 0);
		var dy = Number(g.y2 || 0) - Number(g.y1 || 0);
		if (Math.abs(dx) <= 0.0001 && Math.abs(dy) <= 0.0001) return 'zero';
		if (Math.abs(dx) <= 0.0001) return 'v:' + (dy < 0 ? -1 : 1);
		if (Math.abs(dy) <= 0.0001) return 'h:' + (dx < 0 ? -1 : 1);
		if (Math.abs(Math.abs(dx) - Math.abs(dy)) <= 0.0001) return 'd:' + (dx < 0 ? -1 : 1) + ':' + (dy < 0 ? -1 : 1);
		return 'free';
	};

	App.prototype.cleanRouteObjects = function (objects) {
		var routeObjects = (objects || []).filter(function (obj) {
			return obj && this.state.objects.indexOf(obj) !== -1;
		}, this);
		var minLen = 0.03;
		routeObjects.forEach(function (obj) {
			this.roundTrackGeometry(obj);
			if (this.trackLength(obj) < minLen) this.removeObjectById(obj.id);
		}, this);
		routeObjects = routeObjects.filter(function (obj) { return this.state.objects.indexOf(obj) !== -1; }, this);
		for (var i = 0; i < routeObjects.length - 1; i++) {
			var a = routeObjects[i], b = routeObjects[i + 1];
			var ga = a.geometry || {}, gb = b.geometry || {};
			if (Number(ga.bow || 0) || Number(gb.bow || 0)) continue;
			if (a.layer !== b.layer || Number(ga.width || 0) !== Number(gb.width || 0)) continue;
			if (!this.samePoint({ x: ga.x2, y: ga.y2 }, { x: gb.x1, y: gb.y1 })) continue;
			if (this.trackDirection(a) !== this.trackDirection(b) || this.trackDirection(a) === 'free') continue;
			ga.x2 = gb.x2;
			ga.y2 = gb.y2;
			this.removeObjectById(b.id);
			routeObjects.splice(i + 1, 1);
			i--;
		}
	};

	App.prototype.commitRoutePoint = function (p, event) {
		this.updateRoutePreview(p);
		if (event && event.detail >= 2) {
			this.finishRoute();
			return;
		}
		this.cleanRouteObjects(this.drawing.draftObjects);
		this.drawing.draftObjects = [];
		this.drawing.anchor = this.trackPoint(p);
		this.ensureRouteDraftObject();
		this.markDirty();
	};

	App.prototype.finishRoute = function () {
		if (!this.drawing || !this.drawing.routeObjects) return false;
		this.cleanRouteObjects(this.drawing.routeObjects);
		this.drawing = null;
		this.markDirty();
		return true;
	};

	App.prototype.finishRouteAt = function (p) {
		if (!this.drawing || !this.drawing.routeObjects) return false;
		this.updateRoutePreview(p);
		return this.finishRoute();
	};

	App.prototype.action = function (action) {
		if (action.indexOf('future:') === 0) this.showFutureTool(action.slice(7));
		else if (action.indexOf('drc:') === 0) this.runDrcCheck(action.slice(4));
		else if (action === 'new') this.createNew();
		else if (action === 'open') this.openChooser();
		else if (action === 'save') this.save();
		else if (action === 'undo') this.undo();
		else if (action === 'redo') this.redo();
		else if (action === 'fit') this.canvas.fit();
		else if (action === 'center-view') this.canvas.centerView();
		else if (action === 'zoom-in') this.canvas.zoomAtCenter(1.12);
		else if (action === 'zoom-out') this.canvas.zoomAtCenter(0.89);
		else if (action === 'toggle-grid') this.toggleGrid();
		else if (action === 'toggle-snap') this.toggleSnap();
		else if (action === 'copy') this.copySelected();
		else if (action === 'paste') this.pasteClipboard();
		else if (action === 'delete') this.deleteSelected();
		else if (action === 'rotate-selected-left') this.rotateSelected(-90);
		else if (action === 'rotate-selected-right') this.rotateSelected(90);
		else if (action === 'mirror-selected') this.mirrorSelected();
		else if (action === 'bring-front') this.bringSelectedFront();
		else if (action === 'send-back') this.sendSelectedBack();
		else if (action === 'properties') this.showSelectedProperties();
		else if (action === 'align-menu') this.showAlignMenu();
		else if (action === 'array-menu') this.showArrayMenu();
		else if (action === 'align-left') this.alignObjects('left');
		else if (action === 'align-right') this.alignObjects('right');
		else if (action === 'align-top') this.alignObjects('top');
		else if (action === 'align-bottom') this.alignObjects('bottom');
		else if (action === 'align-center-x') this.alignObjects('center-x');
		else if (action === 'align-center-y') this.alignObjects('center-y');
		else if (action === 'distribute-x') this.distributeObjects('x');
		else if (action === 'distribute-y') this.distributeObjects('y');
		else if (action === 'component-properties') { this.activePinId = ''; this.renderProperties(); this.canvas.invalidate(); }
		else if (action === 'personal-library' && this.personalLibrary) this.personalLibrary.open();
		else if (action === 'export') this.exportJson();
		else if (action === 'export-gerber') this.exportGerber();
		else if (action === 'gerber-preview') this.previewGerber();
		else if (action === 'export-drill') this.exportDrill();
		else if (action === 'import') this.importJson();
		else if (action === 'apply-board') this.applyBoard();
		else if (action === 'center-image') this.centerImage();
		else if (action === 'flip-bottom') this.flipBottom();
		else if (action === 'reset-image') this.resetImage();
		else if (action === 'duplicate') this.duplicateSelected();
		else if (action === 'toggle-lock') this.toggleLockSelected();
		else if (action === 'rotate-90') this.rotateImage(90);
		else if (action === 'rotate--90') this.rotateImage(-90);
		else if (action === 'rotate-180') this.rotateImage(180);
		else if (action === 'calibrate') this.startCalibration();
		else if (action === 'preview3d') this.preview3d();
		else if (action === 'show-coordinate') this.showCoordinate();
		else if (action === 'user-account') this.showUserAccount();
	};

	App.prototype.createNew = function () {
		var name = global.prompt('Tên dự án', this.state.project.name || 'Dự án PCB mới');
		if (!name) return;
		var width = Number(global.prompt('Chiều rộng bo, mm', this.state.board.width_mm || 100));
		var height = Number(global.prompt('Chiều cao bo, mm', this.state.board.height_mm || 80));
		var data = defaultProject();
		data.project.name = name;
		data.board.width_mm = width > 0 ? width : 100;
		data.board.height_mm = height > 0 ? height : 80;
		var self = this;
		this.setSaveStatus('Đang lưu');
		global.DATPCBTracerStorage.create({ name: data.project.name, code: data.project.code, width_mm: data.board.width_mm, height_mm: data.board.height_mm }).then(function (res) {
			self.projectId = res.id;
			self.state = res.data;
			self.renderAll();
			self.canvas.fit();
			self.setSaveStatus('Đã lưu');
		}).catch(function (err) { self.setSaveStatus('Lỗi lưu'); self.showMessage(err.message); });
	};

	App.prototype.openChooser = function () {
		var self = this;
		global.DATPCBTracerStorage.list().then(function (items) {
			var box = el('div');
			box.appendChild(el('h2', 'Mở dự án'));
			items.forEach(function (item) {
				var btn = el('button', item.name + ' [' + item.code + ']');
				btn.type = 'button';
				btn.addEventListener('click', function () {
					self.loadProject(item.id).then(function () {
						qs(self.root, '[data-modal]').hidden = true;
					});
				});
				box.appendChild(btn);
			});
			self.showNode(box);
		}).catch(function (err) { self.showMessage(err.message); });
	};

	// Tach rieng tu openChooser() de PersonalLibrary co the mo lai 1 du an da
	// luu ma khong lap logic doc/nap state.
	App.prototype.loadProject = function (id) {
		var self = this;
		this.projectId = id;
		return global.DATPCBTracerStorage.read(id).then(function (res) {
			self.state = res.data;
			self.normalizeState();
			self.selected = [];
			self.activePinId = '';
			self.renderAll();
			self.canvas.fit();
		});
	};

	App.prototype.pointerDown = function (p, event) {
		if (this.calibration) {
			this.addCalibrationPoint(p);
			return;
		}
		if (this.tool === 'measure') {
			this.measure = { start: p, end: p, done: false };
			this.drawing = { mode: 'measure' };
			return;
		}
		if (this.tool === 'select') {
			var hit = this.hitTest(p);
			if (hit) {
				this.activePinId = (hit.type === 'pad' || hit.type === 'via') && this.getComponentIdForObject(hit) ? hit.id : '';
				var ids = this.expandComponentSelection([hit.id]);
				if (event.shiftKey) {
					ids.forEach(function (id) { if (this.selected.indexOf(id) === -1) this.selected.push(id); }, this);
				} else {
					this.selected = ids;
				}
				this.drawing = { mode: 'move', start: p, last: p };
			} else if (!event.shiftKey) {
				this.selected = [];
				this.activePinId = '';
			}
			this.renderProperties();
			this.emitSelectionChange();
			return;
		}
		if (this.tool === 'track' && this.drawing && this.drawing.obj) {
			this.commitRoutePoint(p, event);
			return;
		}
		if (this.isPolylineTool(this.tool) && this.drawing && this.drawing.obj) {
			this.drawing.obj.geometry.points.push({ x: p.x, y: p.y });
			if (event.detail >= 2) {
				this.drawing.obj.geometry.closed = true;
				this.drawing = null;
			}
			this.markDirty();
			return;
		}
		var obj = global.DATPCBTracerTools.objectFromTool(this.tool, p, {
			side: this.activeSide,
			trackWidth: this.options.trackWidth,
			padDia: this.options.padDia,
			drillDia: this.options.drillDia
		});
		if (this.activeLayer && this.state.layers[this.activeLayer] && !this.state.layers[this.activeLayer].locked) {
			if (['top_copper', 'bottom_copper', 'outline', 'drill', 'mechanical', 'annotation'].indexOf(this.activeLayer) !== -1) obj.layer = this.activeLayer;
		}
		this.state.objects.push(obj);
		this.selected = [obj.id];
		this.activePinId = '';
		this.drawing = { mode: 'create', obj: obj, origin: { x: p.x, y: p.y } };
		if (this.tool === 'track') {
			this.drawing.anchor = { x: p.x, y: p.y };
			this.drawing.routeObjects = [obj];
			this.drawing.draftObjects = [obj];
			obj.geometry.route_mode = this.options.routeMode || '45';
		}
		if (this.tool !== 'track' && !this.isPolylineTool(this.tool) && !this.isDragTool(this.tool)) {
			this.drawing = null;
		}
		this.markDirty();
	};

	App.prototype.pointerMove = function (p) {
		if (!this.drawing) return;
		if (this.drawing.mode === 'measure') {
			this.measure.end = p;
			return;
		}
		if (this.drawing.mode === 'move') {
			var dx = p.x - this.drawing.last.x, dy = p.y - this.drawing.last.y;
			this.selectedObjects().forEach(function (obj) { global.DATPCBTracerTools.moveObject(obj, dx, dy); });
			this.refreshSelectedComponents();
			this.syncAnchoredTracks();
			this.drawing.last = p;
			this.markDirty(false);
		} else if (this.drawing.obj) {
			if (this.drawing.obj.type === 'track' && this.drawing.routeObjects) this.updateRoutePreview(p);
			else this.updateDraftObject(this.drawing.obj, p, this.drawing.origin);
			this.markDirty(false);
		}
	};

	App.prototype.pointerUp = function () {
		if (this.drawing && this.drawing.mode === 'move') this.markDirty();
		if (this.drawing && this.drawing.mode === 'measure') {
			this.measure.done = true;
			this.drawing = null;
		}
		if (this.drawing && this.drawing.mode === 'create' && this.tool !== 'track' && !this.isPolylineTool(this.tool)) this.drawing = null;
		this.renderAll();
	};

	App.prototype.hitTest = function (p) {
		var best = null, bestDist = 2 / this.canvas.view.scale;
		this.state.objects.forEach(function (obj) {
			if (!obj.visible || obj.locked) return;
			var layer = this.state.layers[obj.layer];
			if (layer && layer.locked) return;
			var component = this.getComponentById(this.getComponentIdForObject(obj));
			if (component && (component.locked || component.visible === false)) return;
			var bounds = global.DATPCBTracerTools.getObjectBounds(obj);
			var pad = Math.max(0.6, 6 / this.canvas.view.scale);
			if (p.x >= bounds.minX - pad && p.x <= bounds.maxX + pad && p.y >= bounds.minY - pad && p.y <= bounds.maxY + pad) {
				var insideDist = Math.hypot(((bounds.minX + bounds.maxX) / 2) - p.x, ((bounds.minY + bounds.maxY) / 2) - p.y);
				if (!best || insideDist < bestDist) {
					best = obj;
					bestDist = insideDist;
				}
				return;
			}
			var c = global.DATPCBTracerTools.getObjectCenter(obj);
			var d = Math.hypot(c.x - p.x, c.y - p.y);
			if (d < bestDist) { best = obj; bestDist = d; }
		}, this);
		return best;
	};

	App.prototype.selectedObjects = function () {
		var ids = this.selected;
		return this.state.objects.filter(function (obj) { return ids.indexOf(obj.id) !== -1; });
	};

	App.prototype.getComponentIdForObject = function (obj) {
		var g = (obj && obj.geometry) || {};
		return g.component_id || '';
	};

	App.prototype.getComponentById = function (componentId) {
		if (!componentId || !Array.isArray(this.state.components)) return null;
		var found = null;
		this.state.components.some(function (component) {
			if (component.id === componentId) {
				found = component;
				return true;
			}
			return false;
		});
		return found;
	};

	App.prototype.componentObjects = function (componentId) {
		if (!componentId) return [];
		return this.state.objects.filter(function (obj) {
			return ((obj.geometry || {}).component_id || '') === componentId;
		});
	};

	App.prototype.expandComponentSelection = function (ids) {
		var expanded = ids.slice(0);
		ids.forEach(function (id) {
			var obj = this.state.objects.filter(function (item) { return item.id === id; })[0];
			var componentId = this.getComponentIdForObject(obj);
			if (!componentId) return;
			this.componentObjects(componentId).forEach(function (componentObj) {
				if (expanded.indexOf(componentObj.id) === -1) expanded.push(componentObj.id);
			});
		}, this);
		return expanded;
	};

	App.prototype.selectedComponent = function () {
		var obj = this.selectedObjects()[0];
		return this.getComponentById(this.getComponentIdForObject(obj));
	};

	App.prototype.activePinObject = function () {
		if (!this.activePinId) return null;
		var found = null;
		this.state.objects.some(function (obj) {
			if (obj.id === this.activePinId) {
				found = obj;
				return true;
			}
			return false;
		}, this);
		return found;
	};

	App.prototype.refreshComponentPlacement = function (componentId) {
		var component = this.getComponentById(componentId);
		var objects = this.componentObjects(componentId);
		if (!component || !objects.length) return;
		var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		objects.forEach(function (obj) {
			var bounds = global.DATPCBTracerTools.getObjectBounds(obj);
			minX = Math.min(minX, bounds.minX);
			minY = Math.min(minY, bounds.minY);
			maxX = Math.max(maxX, bounds.maxX);
			maxY = Math.max(maxY, bounds.maxY);
		});
		if (isFinite(minX)) {
			component.x = (minX + maxX) / 2;
			component.y = (minY + maxY) / 2;
		}
	};

	App.prototype.mirrorComponentGeometry = function (component) {
		var pivot = Number(component.x || 0);
		this.componentObjects(component.id).forEach(function (obj) {
			var g = obj.geometry || {};
			if (g.x1 !== undefined && g.x2 !== undefined) {
				g.x1 = 2 * pivot - Number(g.x1 || 0);
				g.x2 = 2 * pivot - Number(g.x2 || 0);
			} else if (g.x !== undefined) {
				g.x = 2 * pivot - Number(g.x || 0);
			}
			if (g.rotation !== undefined) g.rotation = 180 - Number(g.rotation || 0);
		});
	};

	App.prototype.refreshSelectedComponents = function () {
		var seen = {};
		this.selectedObjects().forEach(function (obj) {
			var componentId = this.getComponentIdForObject(obj);
			if (!componentId || seen[componentId]) return;
			seen[componentId] = true;
			this.refreshComponentPlacement(componentId);
		}, this);
	};

	App.prototype.syncAnchoredTracks = function () {
		var byId = {};
		this.state.objects.forEach(function (obj) { byId[obj.id] = obj; });
		this.state.objects.forEach(function (obj) {
			if (obj.type !== 'track') return;
			var g = obj.geometry || {};
			if (g.anchor1) {
				var a = byId[g.anchor1];
				if (a && a.geometry) {
					g.x1 = Number(a.geometry.x || 0);
					g.y1 = Number(a.geometry.y || 0);
				}
			}
			if (g.anchor2) {
				var b = byId[g.anchor2];
				if (b && b.geometry) {
					g.x2 = Number(b.geometry.x || 0);
					g.y2 = Number(b.geometry.y || 0);
				}
			}
		});
	};

	App.prototype.deleteSelected = function () {
		if (!this.selected.length) return;
		this.history.push(this.state);
		var ids = this.expandComponentSelection(this.selected);
		var deletedComponents = {};
		this.state.objects.forEach(function (obj) {
			if (ids.indexOf(obj.id) !== -1) {
				var componentId = this.getComponentIdForObject(obj);
				if (componentId) deletedComponents[componentId] = true;
			}
		}, this);
		this.state.objects = this.state.objects.filter(function (obj) { return ids.indexOf(obj.id) === -1; });
		if (Array.isArray(this.state.components)) {
			this.state.components = this.state.components.filter(function (component) { return !deletedComponents[component.id]; });
		}
		this.selected = [];
		this.activePinId = '';
		this.markDirty();
	};

	App.prototype.duplicateSelected = function () {
		if (!this.selected.length) return;
		this.history.push(this.state);
		var newIds = [];
		var componentMap = {};
		if (!this.state.components) this.state.components = [];
		this.selectedObjects().forEach(function (obj) {
			var copy = global.DATPCBTracerClone(obj);
			copy.id = global.DATPCBTracerTools.makeId();
			if (copy.type === 'track' && copy.geometry) {
				delete copy.geometry.anchor1;
				delete copy.geometry.anchor2;
			}
			var componentId = this.getComponentIdForObject(copy);
			if (componentId) {
				if (!componentMap[componentId]) {
					var component = this.getComponentById(componentId);
					var newComponentId = 'cmp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
					componentMap[componentId] = { id: newComponentId, pins: [] };
					if (component) {
						var componentCopy = global.DATPCBTracerClone(component);
						componentCopy.id = newComponentId;
						componentCopy.ref = String(componentCopy.ref || 'U') + '_copy';
						componentCopy.x = Number(componentCopy.x || 0) + 1;
						componentCopy.y = Number(componentCopy.y || 0) + 1;
						componentCopy.pins = [];
						this.state.components.push(componentCopy);
						componentMap[componentId].component = componentCopy;
					}
				}
				copy.geometry.component_id = componentMap[componentId].id;
				copy.geometry.component_ref = componentMap[componentId].component ? componentMap[componentId].component.ref : copy.geometry.component_ref;
			}
			global.DATPCBTracerTools.moveObject(copy, 1, 1);
			this.state.objects.push(copy);
			newIds.push(copy.id);
			if (componentId && componentMap[componentId].component && (copy.type === 'pad' || copy.type === 'via')) {
				componentMap[componentId].component.pins.push({ number: String(copy.geometry.ai_pin || ''), name: String(copy.geometry.pin_name || ''), object_id: copy.id });
			}
		}, this);
		this.selected = newIds;
		this.activePinId = '';
		this.markDirty();
	};

	App.prototype.toggleLockSelected = function () {
		if (!this.selected.length) return;
		this.history.push(this.state);
		var toggledComponents = {};
		this.selectedObjects().forEach(function (obj) {
			obj.locked = !obj.locked;
			var component = this.getComponentById(this.getComponentIdForObject(obj));
			if (component && !toggledComponents[component.id]) {
				component.locked = obj.locked;
				toggledComponents[component.id] = true;
			}
		}, this);
		this.markDirty();
	};

	App.prototype.copySelected = function () {
		this.clipboard = this.selectedObjects().map(function (obj) {
			return global.DATPCBTracerClone(obj);
		});
	};

	App.prototype.pasteClipboard = function () {
		if (!this.clipboard.length) return;
		this.history.push(this.state);
		var ids = [];
		this.clipboard.forEach(function (obj) {
			var copy = global.DATPCBTracerClone(obj);
			copy.id = global.DATPCBTracerTools.makeId();
			global.DATPCBTracerTools.moveObject(copy, 2, 2);
			this.state.objects.push(copy);
			ids.push(copy.id);
		}, this);
		this.selected = ids;
		this.activePinId = '';
		this.markDirty();
	};

	App.prototype.rotateSelected = function (degrees) {
		if (!this.selected.length) return;
		this.history.push(this.state);
		this.selectedObjects().forEach(function (obj) {
			global.DATPCBTracerTools.rotateObject(obj, degrees);
		});
		var rotatedComponents = {};
		this.selectedObjects().forEach(function (obj) {
			var component = this.getComponentById(this.getComponentIdForObject(obj));
			if (component && !rotatedComponents[component.id]) {
				component.rotation = Number(component.rotation || 0) + degrees;
				rotatedComponents[component.id] = true;
			}
		}, this);
		this.refreshSelectedComponents();
		this.markDirty();
	};

	App.prototype.mirrorSelected = function () {
		if (!this.selected.length) return;
		this.history.push(this.state);
		var objects = this.selectedObjects();
		var minX = Infinity, maxX = -Infinity;
		objects.forEach(function (obj) {
			var bounds = global.DATPCBTracerTools.getObjectBounds(obj);
			minX = Math.min(minX, bounds.minX);
			maxX = Math.max(maxX, bounds.maxX);
		});
		var centerX = isFinite(minX) ? (minX + maxX) / 2 : undefined;
		objects.forEach(function (obj) { global.DATPCBTracerTools.mirrorObject(obj, centerX); });
		this.refreshSelectedComponents();
		this.markDirty();
	};

	App.prototype.selectionBounds = function () {
		var objects = this.selectedObjects();
		if (!objects.length) return null;
		var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		objects.forEach(function (obj) {
			var b = global.DATPCBTracerTools.getObjectBounds(obj);
			minX = Math.min(minX, b.minX);
			minY = Math.min(minY, b.minY);
			maxX = Math.max(maxX, b.maxX);
			maxY = Math.max(maxY, b.maxY);
		});
		return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
	};

	App.prototype.alignObjects = function (mode) {
		var objects = this.selectedObjects();
		if (objects.length < 2) { this.showMessage('Chọn ít nhất 2 đối tượng để căn chỉnh.'); return; }
		this.history.push(this.state);
		var items = objects.map(function (obj) { return { obj: obj, b: global.DATPCBTracerTools.getObjectBounds(obj) }; });
		var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		items.forEach(function (item) {
			minX = Math.min(minX, item.b.minX);
			maxX = Math.max(maxX, item.b.maxX);
			minY = Math.min(minY, item.b.minY);
			maxY = Math.max(maxY, item.b.maxY);
		});
		var centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
		items.forEach(function (item) {
			var dx = 0, dy = 0;
			if (mode === 'left') dx = minX - item.b.minX;
			else if (mode === 'right') dx = maxX - item.b.maxX;
			else if (mode === 'center-x') dx = centerX - (item.b.minX + item.b.maxX) / 2;
			else if (mode === 'top') dy = minY - item.b.minY;
			else if (mode === 'bottom') dy = maxY - item.b.maxY;
			else if (mode === 'center-y') dy = centerY - (item.b.minY + item.b.maxY) / 2;
			if (dx || dy) global.DATPCBTracerTools.moveObject(item.obj, dx, dy);
		});
		this.refreshSelectedComponents();
		this.markDirty();
	};

	App.prototype.distributeObjects = function (axis) {
		var objects = this.selectedObjects();
		if (objects.length < 3) { this.showMessage('Chọn ít nhất 3 đối tượng để phân bố đều.'); return; }
		this.history.push(this.state);
		var items = objects.map(function (obj) {
			var b = global.DATPCBTracerTools.getObjectBounds(obj);
			return { obj: obj, center: axis === 'x' ? (b.minX + b.maxX) / 2 : (b.minY + b.maxY) / 2 };
		});
		items.sort(function (a, b) { return a.center - b.center; });
		var first = items[0].center, last = items[items.length - 1].center;
		var step = (last - first) / (items.length - 1);
		items.forEach(function (item, index) {
			var delta = (first + step * index) - item.center;
			if (Math.abs(delta) < 1e-9) return;
			if (axis === 'x') global.DATPCBTracerTools.moveObject(item.obj, delta, 0);
			else global.DATPCBTracerTools.moveObject(item.obj, 0, delta);
		});
		this.refreshSelectedComponents();
		this.markDirty();
	};

	App.prototype.showAlignMenu = function () {
		if (this.selected.length < 2) { this.showMessage('Chọn ít nhất 2 đối tượng để căn chỉnh.'); return; }
		var box = el('div');
		box.appendChild(el('h2', 'Căn chỉnh & phân bố'));
		box.appendChild(el('p', 'Căn cần từ 2 đối tượng, phân bố đều cần từ 3 đối tượng.'));
		var alignRow = el('div');
		alignRow.className = 'dat-pcb-align-row';
		[
			['align-left', 'Trái'],
			['align-center-x', 'Giữa dọc'],
			['align-right', 'Phải'],
			['align-top', 'Trên'],
			['align-center-y', 'Giữa ngang'],
			['align-bottom', 'Dưới']
		].forEach(function (item) {
			var button = el('button', item[1]);
			button.type = 'button';
			button.setAttribute('data-action', item[0]);
			alignRow.appendChild(button);
		});
		box.appendChild(alignRow);
		var distRow = el('div');
		distRow.className = 'dat-pcb-align-row';
		[['distribute-x', 'Phân bố ngang'], ['distribute-y', 'Phân bố dọc']].forEach(function (item) {
			var button = el('button', item[1]);
			button.type = 'button';
			button.setAttribute('data-action', item[0]);
			distRow.appendChild(button);
		});
		box.appendChild(distRow);
		this.showNode(box);
	};

	App.prototype.numberField = function (container, labelText, value, step) {
		var label = el('label', labelText + ' ');
		var input = document.createElement('input');
		input.type = 'number';
		input.step = String(step || 1);
		input.value = value;
		label.appendChild(input);
		container.appendChild(label);
		return input;
	};

	App.prototype.showArrayMenu = function () {
		if (!this.selected.length) { this.showMessage('Chọn đối tượng trước khi tạo mảng.'); return; }
		var self = this;
		var box = el('div');
		box.appendChild(el('h2', 'Tạo mảng (Array)'));
		var typeLabel = el('label', 'Kiểu ');
		var typeSelect = document.createElement('select');
		['linear', 'circular'].forEach(function (value) {
			var opt = document.createElement('option');
			opt.value = value;
			opt.textContent = value === 'linear' ? 'Lưới (Linear)' : 'Vòng tròn (Circular)';
			typeSelect.appendChild(opt);
		});
		typeLabel.appendChild(typeSelect);
		box.appendChild(typeLabel);

		var linearBox = el('div');
		var rowsInput = this.numberField(linearBox, 'Số hàng', 1, 1);
		var colsInput = this.numberField(linearBox, 'Số cột', 2, 1);
		var dxInput = this.numberField(linearBox, 'Khoảng cách X (mm)', 2, 0.01);
		var dyInput = this.numberField(linearBox, 'Khoảng cách Y (mm)', 0, 0.01);
		box.appendChild(linearBox);

		var bounds = this.selectionBounds();
		var circularBox = el('div');
		circularBox.hidden = true;
		var countInput = this.numberField(circularBox, 'Số lượng', 6, 1);
		var angleInput = this.numberField(circularBox, 'Tổng góc (độ)', 360, 1);
		var cxInput = this.numberField(circularBox, 'Tâm X (mm)', bounds ? (bounds.minX + bounds.maxX) / 2 : 0, 0.01);
		var cyInput = this.numberField(circularBox, 'Tâm Y (mm)', bounds ? (bounds.minY + bounds.maxY) / 2 : 0, 0.01);
		box.appendChild(circularBox);

		typeSelect.addEventListener('change', function () {
			var circular = typeSelect.value === 'circular';
			linearBox.hidden = circular;
			circularBox.hidden = !circular;
		});

		var createButton = el('button', 'Tạo mảng');
		createButton.type = 'button';
		createButton.addEventListener('click', function () {
			if (typeSelect.value === 'circular') {
				self.createCircularArray({
					count: Math.max(2, Math.round(Number(countInput.value) || 2)),
					totalAngle: Number(angleInput.value) || 360,
					cx: Number(cxInput.value) || 0,
					cy: Number(cyInput.value) || 0
				});
			} else {
				self.createLinearArray({
					rows: Math.max(1, Math.round(Number(rowsInput.value) || 1)),
					cols: Math.max(1, Math.round(Number(colsInput.value) || 1)),
					dx: Number(dxInput.value) || 0,
					dy: Number(dyInput.value) || 0
				});
			}
			qs(self.root, '[data-modal]').hidden = true;
		});
		box.appendChild(createButton);
		this.showNode(box);
	};

	App.prototype.cloneSelectionForArray = function (transformFn) {
		var newIds = [];
		var componentMap = {};
		if (!this.state.components) this.state.components = [];
		this.selectedObjects().forEach(function (obj) {
			var copy = global.DATPCBTracerClone(obj);
			copy.id = global.DATPCBTracerTools.makeId();
			if (copy.type === 'track' && copy.geometry) {
				delete copy.geometry.anchor1;
				delete copy.geometry.anchor2;
			}
			var componentId = this.getComponentIdForObject(copy);
			if (componentId) {
				if (!componentMap[componentId]) {
					var component = this.getComponentById(componentId);
					var newComponentId = 'cmp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
					componentMap[componentId] = { id: newComponentId, component: null };
					if (component) {
						var componentCopy = global.DATPCBTracerClone(component);
						componentCopy.id = newComponentId;
						componentCopy.pins = [];
						this.state.components.push(componentCopy);
						componentMap[componentId].component = componentCopy;
					}
				}
				copy.geometry.component_id = componentMap[componentId].id;
			}
			transformFn(copy);
			this.state.objects.push(copy);
			newIds.push(copy.id);
			if (componentId && componentMap[componentId].component && (copy.type === 'pad' || copy.type === 'via')) {
				componentMap[componentId].component.pins.push({ number: String(copy.geometry.ai_pin || ''), name: String(copy.geometry.pin_name || ''), object_id: copy.id });
			}
		}, this);
		Object.keys(componentMap).forEach(function (key) {
			this.refreshComponentPlacement(componentMap[key].id);
		}, this);
		return newIds;
	};

	App.prototype.createLinearArray = function (config) {
		if (!this.selected.length) return;
		this.history.push(this.state);
		var allNew = [];
		for (var row = 0; row < config.rows; row++) {
			for (var col = 0; col < config.cols; col++) {
				if (row === 0 && col === 0) continue;
				var dx = col * config.dx, dy = row * config.dy;
				allNew = allNew.concat(this.cloneSelectionForArray(function (obj) {
					global.DATPCBTracerTools.moveObject(obj, dx, dy);
				}));
			}
		}
		if (allNew.length) this.selected = allNew;
		this.markDirty();
	};

	App.prototype.createCircularArray = function (config) {
		if (!this.selected.length) return;
		this.history.push(this.state);
		var step = config.totalAngle / config.count;
		var allNew = [];
		for (var i = 1; i < config.count; i++) {
			var angle = step * i;
			allNew = allNew.concat(this.cloneSelectionForArray(function (obj) {
				global.DATPCBTracerTools.rotateObjectAroundPoint(obj, config.cx, config.cy, angle);
			}));
		}
		if (allNew.length) this.selected = allNew;
		this.markDirty();
	};

	App.prototype.bringSelectedFront = function () {
		if (!this.selected.length) return;
		this.history.push(this.state);
		var ids = this.selected;
		var moved = [];
		this.state.objects = this.state.objects.filter(function (obj) {
			if (ids.indexOf(obj.id) !== -1) {
				moved.push(obj);
				return false;
			}
			return true;
		}).concat(moved);
		this.markDirty();
	};

	App.prototype.sendSelectedBack = function () {
		if (!this.selected.length) return;
		this.history.push(this.state);
		var ids = this.selected;
		var moved = [];
		this.state.objects = this.state.objects.filter(function (obj) {
			if (ids.indexOf(obj.id) !== -1) {
				moved.push(obj);
				return false;
			}
			return true;
		});
		this.state.objects = moved.concat(this.state.objects);
		this.markDirty();
	};

	App.prototype.showSelectedProperties = function () {
		var panel = qs(this.root, '.dat-pcb-properties');
		if (!panel) return;
		panel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		panel.classList.add('dat-tablet-panel-flash');
		global.setTimeout(function () { panel.classList.remove('dat-tablet-panel-flash'); }, 700);
	};

	App.prototype.cancelTool = function () {
		this.drawing = null;
		this.calibration = null;
		this.measure = null;
		this.setTool('select');
	};

	App.prototype.undo = function () {
		var prev = this.history.undo(this.state);
		if (!prev) return;
		this.state = prev;
		this.normalizeState();
		this.selected = [];
		this.activePinId = '';
		this.markDirty(false);
		this.renderAll();
	};

	App.prototype.redo = function () {
		var next = this.history.redo(this.state);
		if (!next) return;
		this.state = next;
		this.normalizeState();
		this.selected = [];
		this.activePinId = '';
		this.markDirty(false);
		this.renderAll();
	};

	App.prototype.markDirty = function (render) {
		this.dirty = true;
		this.setSaveStatus('Chưa lưu');
		if (render !== false) this.renderAll();
	};

	App.prototype.save = function () {
		var self = this;
		if (!this.projectId) {
			return global.DATPCBTracerStorage.create({ name: this.state.project.name, code: this.state.project.code, width_mm: this.state.board.width_mm, height_mm: this.state.board.height_mm }).then(function (res) {
				self.projectId = res.id;
				return self.save();
			});
		}
		this.setSaveStatus('Đang lưu');
		return global.DATPCBTracerStorage.save(this.projectId, this.state).then(function (res) {
			self.state = res.data;
			self.dirty = false;
			self.setSaveStatus('Đã lưu');
			self.renderAll();
		}).catch(function (err) {
			self.setSaveStatus('Lỗi lưu');
			self.showMessage(err.message);
		});
	};

	App.prototype.startAutosave = function () {
		var self = this;
		global.setInterval(function () {
			if (self.dirty) self.save();
		}, 60000);
	};

	App.prototype.uploadImage = function (side, file) {
		var self = this;
		this.setSaveStatus('Đang upload');
		global.DATPCBTracerStorage.upload(file).then(function (res) {
			self.history.push(self.state);
			self.state.images[side].attachment_id = res.attachment_id;
			self.state.images[side].url = res.url;
			self.state.images[side].visible = true;
			self.state.layers[side === 'top' ? 'background_top' : 'background_bottom'].visible = true;
			self.markDirty();
		}).catch(function (err) { self.setSaveStatus('Lỗi upload'); self.showMessage(err.message); });
	};

	App.prototype.applyBoard = function () {
		this.history.push(this.state);
		this.state.board.width_mm = Math.max(1, Number(qs(this.root, '[data-board-width]').value || 100));
		this.state.board.height_mm = Math.max(1, Number(qs(this.root, '[data-board-height]').value || 80));
		this.markDirty();
		this.canvas.fit();
	};

	// Canh nao cua board dang bi keo: 'min' = canh trai/tren (0,0), phai dich chuyen toan bo
	// noi dung board de world-origin luon khop lai voi canh moi. 'max' = canh phai/duoi, chi
	// doi width/height, khong dich gi ca.
	var BOARD_RESIZE_EDGES = {
		n: { y: 'min' }, s: { y: 'max' }, e: { x: 'max' }, w: { x: 'min' },
		ne: { x: 'max', y: 'min' }, nw: { x: 'min', y: 'min' },
		se: { x: 'max', y: 'max' }, sw: { x: 'min', y: 'max' }
	};

	App.prototype.boardResizeStart = function (handle) {
		if (!BOARD_RESIZE_EDGES[handle]) return;
		this.history.push(this.state);
		this._boardResize = {
			handle: handle,
			startWidth: this.state.board.width_mm,
			startHeight: this.state.board.height_mm,
			appliedShiftX: 0,
			appliedShiftY: 0
		};
	};

	// totalDxMm/totalDyMm: do lech (mm, chua snap) so voi diem bat dau keo, khong phai so voi
	// frame truoc - tinh lai width/height tu startWidth/startHeight moi frame de tranh troi so.
	App.prototype.boardResizeMove = function (totalDxMm, totalDyMm) {
		var rs = this._boardResize;
		if (!rs) return;
		var edges = BOARD_RESIZE_EDGES[rs.handle];
		if (!edges) return;
		var gmm = Number(this.state.board.grid_mm) || 0.5;
		var dx = Math.round(totalDxMm / gmm) * gmm;
		var dy = Math.round(totalDyMm / gmm) * gmm;

		var newWidth = rs.startWidth, newHeight = rs.startHeight, shiftX = 0, shiftY = 0;
		if (edges.x === 'max') {
			newWidth = Math.max(1, rs.startWidth + dx);
		} else if (edges.x === 'min') {
			newWidth = Math.max(1, rs.startWidth - dx);
			shiftX = newWidth - rs.startWidth;
		}
		if (edges.y === 'max') {
			newHeight = Math.max(1, rs.startHeight + dy);
		} else if (edges.y === 'min') {
			newHeight = Math.max(1, rs.startHeight - dy);
			shiftY = newHeight - rs.startHeight;
		}

		var incDx = shiftX - rs.appliedShiftX;
		var incDy = shiftY - rs.appliedShiftY;
		if (incDx || incDy) {
			// Re-base toan bo noi dung theo canh trai/tren moi - phai dich ca object bi khoa
			// (obj.locked), khac voi thao tac "move" thong thuong von bo qua object khoa.
			this.state.objects.forEach(function (obj) {
				var wasLocked = obj.locked;
				obj.locked = false;
				global.DATPCBTracerTools.moveObject(obj, incDx, incDy);
				obj.locked = wasLocked;
			});
			(this.state.components || []).forEach(function (component) {
				component.x = Number(component.x || 0) + incDx;
				component.y = Number(component.y || 0) + incDy;
			});
			['top', 'bottom'].forEach(function (side) {
				var img = this.state.images[side];
				img.x = Number(img.x || 0) + incDx;
				img.y = Number(img.y || 0) + incDy;
			}, this);
			rs.appliedShiftX = shiftX;
			rs.appliedShiftY = shiftY;
		}

		this.state.board.width_mm = newWidth;
		this.state.board.height_mm = newHeight;
		this.markDirty(false);
		this.renderProjectFields();
	};

	App.prototype.boardResizeEnd = function () {
		if (!this._boardResize) return;
		this._boardResize = null;
		this.markDirty();
	};

	App.prototype.centerImage = function () {
		var img = this.state.images[this.activeSide];
		img.x = this.state.board.width_mm / 2;
		img.y = this.state.board.height_mm / 2;
		this.markDirty();
	};

	App.prototype.flipBottom = function () {
		this.state.images.bottom.flip_x = !this.state.images.bottom.flip_x;
		this.state.layers.background_bottom.visible = true;
		this.markDirty();
	};

	App.prototype.resetImage = function () {
		var img = this.state.images[this.activeSide];
		img.x = 0; img.y = 0; img.scale_x = 1; img.scale_y = 1; img.rotation = 0; img.flip_x = false; img.flip_y = false;
		this.markDirty();
	};

	App.prototype.rotateImage = function (deg) {
		this.history.push(this.state);
		var img = this.state.images[this.activeSide];
		img.rotation = Number(img.rotation || 0) + deg;
		this.markDirty();
	};

	App.prototype.startCalibration = function () {
		this.calibration = { side: this.activeSide, points: [] };
		this.showMessage('Calibration: bấm điểm A, bấm điểm B, sau đó nhập khoảng cách thật.');
	};

	App.prototype.addCalibrationPoint = function (p) {
		this.calibration.points.push({ x: p.x, y: p.y });
		if (this.calibration.points.length < 2) return;
		var dist = Number(global.prompt('Khoảng cách thật giữa A-B, mm', '10'));
		if (dist > 0) {
			var a = this.calibration.points[0], b = this.calibration.points[1];
			var measured = Math.hypot(b.x - a.x, b.y - a.y);
			var factor = dist / (measured || dist);
			var img = this.state.images[this.calibration.side];
			img.scale_x *= factor;
			img.scale_y *= factor;
			img.calibration = { point_a: a, point_b: b, real_distance_mm: dist, factor: factor };
			this.markDirty();
		}
		this.calibration = null;
	};

	App.prototype.exportJson = function () {
		var text = JSON.stringify(this.state, null, 2);
		var blob = new Blob([text], { type: 'application/json' });
		var a = el('a');
		a.href = URL.createObjectURL(blob);
		a.download = (this.state.project.code || 'pcb-project') + '.json';
		a.click();
		URL.revokeObjectURL(a.href);
	};

	App.prototype.exportGerber = function () {
		if (!global.DATPCBGerberExporter) {
			this.showMessage('Gerber exporter chưa được tải.');
			return;
		}
		try {
			var exporter = new global.DATPCBGerberExporter();
			var result = exporter.exportProject(this.state);
			var a = el('a');
			a.href = URL.createObjectURL(result.blob);
			a.download = result.fileName;
			a.click();
			global.setTimeout(function () {
				URL.revokeObjectURL(a.href);
			}, 1000);
			this.showGerberResult(result);
		} catch (err) {
			this.showMessage('Lỗi xuất Gerber: ' + err.message);
		}
	};

	App.prototype.showGerberResult = function (result) {
		var box = el('div');
		box.appendChild(el('h2', 'Xuất Gerber'));
		box.appendChild(el('p', 'Đã tải file: ' + result.fileName));
		var files = el('ul');
		result.files.forEach(function (file) {
			files.appendChild(el('li', file.name));
		});
		box.appendChild(files);
		if (result.warnings.length) {
			box.appendChild(el('h3', 'Cảnh báo'));
			var warnings = el('ul');
			result.warnings.forEach(function (warning) {
				warnings.appendChild(el('li', warning));
			});
			box.appendChild(warnings);
		}
		this.showNode(box);
	};

	App.prototype.previewGerber = function () {
		if (!global.DATPCBGerberExporter) {
			this.showMessage('Gerber exporter chưa được tải.');
			return;
		}
		try {
			var result = new global.DATPCBGerberExporter().exportProject(this.state);
			var box = el('div');
			box.appendChild(el('h2', 'Gerber Preview'));
			box.appendChild(el('p', 'Preview dạng danh sách layer. Trình xem Gerber trực quan sẽ được bổ sung ở bước sau.'));
			var files = el('ul');
			result.files.forEach(function (file) {
				files.appendChild(el('li', file.name));
			});
			box.appendChild(files);
			if (result.warnings.length) {
				box.appendChild(el('h3', 'Cảnh báo'));
				var warnings = el('ul');
				result.warnings.forEach(function (warning) {
					warnings.appendChild(el('li', warning));
				});
				box.appendChild(warnings);
			}
			this.showNode(box);
		} catch (err) {
			this.showMessage('Lỗi preview Gerber: ' + err.message);
		}
	};

	App.prototype.exportDrill = function () {
		if (!global.DATPCBGerberExporter) {
			this.showMessage('Gerber exporter chưa được tải.');
			return;
		}
		try {
			var result = new global.DATPCBGerberExporter().exportProject(this.state);
			var drill = result.files.filter(function (file) { return file.name === 'drill.TXT'; })[0];
			if (!drill) return this.showMessage('Không có drill file để xuất.');
			var blob = new Blob([drill.content], { type: 'text/plain' });
			var a = el('a');
			var name = ((this.state.project && (this.state.project.name || this.state.project.code)) || 'PCB_Project').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_');
			a.href = URL.createObjectURL(blob);
			a.download = (name || 'PCB_Project') + '_Drill.TXT';
			a.click();
			global.setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
		} catch (err) {
			this.showMessage('Lỗi xuất Drill: ' + err.message);
		}
	};

	App.prototype.toggleGrid = function () {
		this.options.gridVisible = !this.options.gridVisible;
		this.canvas.invalidate();
	};

	App.prototype.toggleSnap = function () {
		this.options.snap = !this.options.snap;
	};

	App.prototype.showCoordinate = function () {
		this.showMessage('Tọa độ hiện tại: ' + this.cursor.x.toFixed(3) + ', ' + this.cursor.y.toFixed(3) + ' mm');
	};

	App.prototype.showFutureTool = function (name) {
		this.showMessage(name + ' đã có vị trí trong Toolbox và sẽ được phát triển thêm trong module riêng.');
	};

	App.prototype.runDrcCheck = function (kind) {
		var warnings = [];
		if (kind === 'track-width') {
			this.state.objects.forEach(function (obj) {
				var g = obj.geometry || {};
				if (obj.type === 'track' && Number(g.width || 0) < 0.1) warnings.push('Độ rộng đường mạch quá nhỏ: ' + obj.id);
			});
		} else if (kind === 'unconnected' && global.DATPCBGeometryExporter) {
			warnings = new global.DATPCBGeometryExporter(this.state).export().warnings.filter(function (warning) {
				return warning.indexOf('Track may be unconnected') !== -1;
			});
		} else {
			this.showFutureTool(kind);
			return;
		}
		var box = el('div');
		box.appendChild(el('h2', 'DRC'));
		if (!warnings.length) {
			box.appendChild(el('p', 'Không phát hiện lỗi trong kiểm tra này.'));
		} else {
			var list = el('ul');
			warnings.forEach(function (warning) { list.appendChild(el('li', warning)); });
			box.appendChild(list);
		}
		this.showNode(box);
	};

	App.prototype.importJson = function () {
		var raw = qs(this.root, '[data-import-json]').value;
		if (!raw || raw.length > 2097152) return this.showMessage('JSON rỗng hoặc quá lớn.');
		try {
			var data = JSON.parse(raw);
			if (data.version !== '1.0') throw new Error('Phiên bản không hỗ trợ.');
			this.history.push(this.state);
			this.state = data;
			this.normalizeState();
			this.projectId = 0;
			this.activePinId = '';
			this.markDirty();
			this.renderAll();
		} catch (err) {
			this.showMessage(err.message);
		}
	};

	App.prototype.preview3d = function () {
		var canvas = document.createElement('canvas');
		canvas.width = 720; canvas.height = 420;
		var ctx = canvas.getContext('2d');
		var b = this.state.board;
		ctx.fillStyle = '#0f151d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.save();
		ctx.translate(150, 105);
		ctx.transform(1, -0.25, 0.85, 0.45, 0, 0);
		var scale = Math.min(420 / b.width_mm, 260 / b.height_mm);
		ctx.fillStyle = '#164c34';
		ctx.strokeStyle = '#90e0a5';
		ctx.lineWidth = 2;
		ctx.fillRect(0, 0, b.width_mm * scale, b.height_mm * scale);
		ctx.strokeRect(0, 0, b.width_mm * scale, b.height_mm * scale);
		this.state.objects.forEach(function (obj) {
			var g = obj.geometry || {};
			if (obj.layer === 'top_copper') ctx.fillStyle = '#d54a43';
			else if (obj.layer === 'bottom_copper') ctx.fillStyle = '#2a83df';
			else if (obj.type === 'drill' || obj.type === 'via') ctx.fillStyle = '#050505';
			else return;
			if (obj.type === 'track') {
				ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, Number(g.width || 0.4) * scale);
				ctx.beginPath(); ctx.moveTo(g.x1 * scale, g.y1 * scale); ctx.lineTo(g.x2 * scale, g.y2 * scale); ctx.stroke();
			} else {
				ctx.beginPath(); ctx.arc(Number(g.x || 0) * scale, Number(g.y || 0) * scale, Math.max(1, Number(g.diameter || g.width || 1) * scale / 2), 0, Math.PI * 2); ctx.fill();
			}
		});
		ctx.restore();
		var box = el('div');
		box.appendChild(el('h2', 'Xem PCB 3D'));
		box.appendChild(canvas);
		box.appendChild(el('p', 'Preview 3D fallback dùng Canvas 2.5D. Không phụ thuộc module 3D của plugin Gerber cũ.'));
		this.showNode(box);
	};

	App.prototype.updateSelectedProperty = function (input) {
		var obj = this.selectedObjects()[0];
		if (!obj) return;
		var key = input.getAttribute('data-prop');
		var target = input.getAttribute('data-prop-target') || 'geometry';
		if (this.activePinId && target !== 'component') {
			var activePin = this.activePinObject();
			if (activePin) obj = activePin;
		}
		var value = input.type === 'checkbox' ? input.checked : input.value;
		if (input.type === 'number') value = Number(value);
		if (target === 'component') {
			var component = this.selectedComponent();
			if (!component) return;
			var prevX = Number(component.x || 0);
			var prevY = Number(component.y || 0);
			var prevSide = component.side || 'top';
			component[key] = value;
			if (key === 'x' || key === 'y') {
				var dx = Number(component.x || 0) - prevX;
				var dy = Number(component.y || 0) - prevY;
				this.componentObjects(component.id).forEach(function (componentObj) {
					global.DATPCBTracerTools.moveObject(componentObj, dx, dy);
				});
				this.syncAnchoredTracks();
			}
			if (key === 'side' && component.side !== prevSide) {
				this.mirrorComponentGeometry(component);
				this.componentObjects(component.id).forEach(function (componentObj) {
					var g = componentObj.geometry || {};
					g.side = component.side;
					if (componentObj.layer === 'top_copper' || componentObj.layer === 'bottom_copper') {
						componentObj.layer = component.side === 'bottom' ? 'bottom_copper' : 'top_copper';
					}
				});
				this.syncAnchoredTracks();
			}
			if (key === 'ref') {
				this.componentObjects(component.id).forEach(function (componentObj) {
					var g = componentObj.geometry || {};
					g.component_ref = value;
					g.ai_ref = value;
				});
			}
			if (key === 'ref' || key === 'package' || key === 'value' || key === 'name') {
				this.componentObjects(component.id).forEach(function (componentObj) {
					if (componentObj.type === 'annotation') {
						componentObj.geometry.text = String(component.ref || '') + (component.package ? ' ' + String(component.package) : '');
					}
				});
			} else if (key === 'visible') {
				this.componentObjects(component.id).forEach(function (componentObj) { componentObj.visible = !!value; });
			} else if (key === 'locked') {
				this.componentObjects(component.id).forEach(function (componentObj) { componentObj.locked = !!value; });
			}
		} else if (target === 'root') obj[key] = value;
		else obj.geometry[key] = value;
		this.markDirty();
	};

	App.prototype.renderAll = function () {
		this.renderLayers();
		this.renderProperties();
		this.renderProjectFields();
		this.canvas.invalidate();
		this.updateRouteModeControls();
		this.updateStatus();
		this.emitSelectionChange();
	};

	App.prototype.renderLayers = function () {
		if (this.layersPanel) {
			this.layersPanel.render();
			return;
		}
		var list = qs(this.root, '[data-layer-list]');
		list.textContent = '';
		Object.keys(this.state.layers).forEach(function (key) {
			var layer = this.state.layers[key];
			var row = el('label');
			var cb = document.createElement('input');
			cb.type = 'checkbox';
			cb.checked = !!layer.visible;
			cb.addEventListener('change', function () { layer.visible = cb.checked; this.markDirty(); }.bind(this));
			var count = this.state.objects.filter(function (obj) { return obj.layer === key; }).length;
			row.appendChild(cb);
			row.appendChild(document.createTextNode(' ' + layer.name + ' (' + count + ')'));
			list.appendChild(row);
		}, this);
	};

	App.prototype.renderProperties = function () {
		var panel = qs(this.root, '[data-properties]');
		if (this.propertiesPanel) {
			this.propertiesPanel.render(panel);
			return;
		}
		panel.textContent = '';
		var obj = this.selectedObjects()[0];
		if (!obj) {
			panel.appendChild(el('p', 'Chưa chọn đối tượng.'));
			return;
		}
		var component = this.selectedComponent();
		var pinObject = component ? this.activePinObject() : null;
		if (pinObject && this.getComponentIdForObject(pinObject) !== component.id) pinObject = null;
		if (pinObject) {
			var g = pinObject.geometry || {};
			panel.appendChild(el('p', 'Chan: ' + (g.ai_pin || '') + (g.pin_name ? ' - ' + g.pin_name : '')));
			panel.appendChild(el('p', 'Linh kien: ' + (component.ref || component.id)));
			var componentButton = el('button', 'Component');
			componentButton.type = 'button';
			componentButton.setAttribute('data-action', 'component-properties');
			panel.appendChild(componentButton);
			this.addProp(panel, 'Pin number', 'ai_pin', g.ai_pin || '', 'geometry', 'text');
			this.addProp(panel, 'Pin name', 'pin_name', g.pin_name || '', 'geometry', 'text');
			this.addProp(panel, 'Shape', 'shape', g.shape || '', 'geometry', 'text');
			['x', 'y', 'width', 'height', 'diameter', 'drill', 'rotation'].forEach(function (key) {
				if (g[key] !== undefined) this.addProp(panel, key, key, g[key], 'geometry', 'number');
			}, this);
			this.addProp(panel, 'Locked', 'locked', pinObject.locked, 'root', 'checkbox');
			this.addProp(panel, 'Visible', 'visible', pinObject.visible, 'root', 'checkbox');
			this.addProp(panel, 'Note', 'note', pinObject.note || '', 'root', 'text');
			return;
		}
		if (component) {
			panel.appendChild(el('p', 'Linh kien: ' + (component.ref || component.id)));
			this.addProp(panel, 'Ref', 'ref', component.ref || '', 'component', 'text');
			this.addProp(panel, 'Name', 'name', component.name || '', 'component', 'text');
			this.addProp(panel, 'Value', 'value', component.value || '', 'component', 'text');
			this.addProp(panel, 'Package', 'package', component.package || '', 'component', 'text');
			this.addProp(panel, 'Side', 'side', component.side || 'top', 'component', 'text');
			this.addProp(panel, 'Rotation', 'rotation', component.rotation || 0, 'component', 'number');
			this.addProp(panel, 'Locked', 'locked', component.locked, 'component', 'checkbox');
			this.addProp(panel, 'Visible', 'visible', component.visible !== false, 'component', 'checkbox');
			panel.appendChild(el('p', 'Pins: ' + ((component.pins || []).length || this.componentObjects(component.id).filter(function (item) { return item.type === 'pad' || item.type === 'via'; }).length)));
			return;
		}
		panel.appendChild(el('p', 'ID: ' + obj.id));
		panel.appendChild(el('p', 'Loại: ' + obj.type));
		this.addProp(panel, 'Layer', 'layer', obj.layer, 'root', 'text');
		['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'width', 'height', 'diameter', 'drill', 'rotation', 'radius', 'startAngle', 'endAngle'].forEach(function (key) {
			if (obj.geometry[key] !== undefined) this.addProp(panel, key, key, obj.geometry[key], 'geometry', 'number');
		}, this);
		this.addProp(panel, 'Locked', 'locked', obj.locked, 'root', 'checkbox');
		this.addProp(panel, 'Visible', 'visible', obj.visible, 'root', 'checkbox');
		this.addProp(panel, 'Note', 'note', obj.note || '', 'root', 'text');
	};

	App.prototype.addProp = function (panel, labelText, key, value, target, type) {
		var label = el('label', labelText + ' ');
		var input = document.createElement('input');
		input.setAttribute('data-prop', key);
		input.setAttribute('data-prop-target', target);
		input.type = type;
		if (type === 'checkbox') input.checked = !!value;
		else input.value = value;
		if (type === 'number') input.step = '0.01';
		label.appendChild(input);
		panel.appendChild(label);
	};

	App.prototype.renderProjectFields = function () {
		qs(this.root, '[data-project-name]').value = this.state.project.name || '';
		qs(this.root, '[data-project-code]').value = this.state.project.code || '';
		qs(this.root, '[data-board-width]').value = this.state.board.width_mm || 100;
		qs(this.root, '[data-board-height]').value = this.state.board.height_mm || 80;
	};

	App.prototype.updateStatus = function () {
		qs(this.root, '[data-status-coord]').textContent = this.cursor.x.toFixed(3) + ', ' + this.cursor.y.toFixed(3) + ' mm';
		qs(this.root, '[data-status-zoom]').textContent = Math.round(this.canvas.view.scale * 100 / 6) + '%';
		qs(this.root, '[data-status-tool]').textContent = this.tool === 'track' ? 'track / ' + (this.options.routeMode || '45') : this.tool;
	};

	App.prototype.setSaveStatus = function (text) {
		qs(this.root, '[data-status-save]').textContent = text;
	};

	App.prototype.showMessage = function (message) {
		var box = el('div');
		box.appendChild(el('p', message));
		this.showNode(box);
	};

	App.prototype.showUserAccount = function () {
		var templatePanel = qs(this.root, '.dat-pcb-account-template [data-pcb-account-panel]');
		var panel = templatePanel ? templatePanel.cloneNode(true) : qs(this.root, '[data-pcb-account-panel]');
		if (!panel) {
			this.showMessage('Chưa có panel tài khoản.');
			return;
		}
		this.showNode(panel);
	};

	App.prototype.showNode = function (node) {
		var modal = qs(this.root, '[data-modal]');
		var content = qs(this.root, '[data-modal-content]');
		content.textContent = '';
		content.appendChild(node);
		modal.hidden = false;
	};

	App.prototype.isTabletMode = function () {
		return this.root.classList.contains('tablet-mode');
	};

	App.prototype.emitSelectionChange = function () {
		this.root.dispatchEvent(new CustomEvent('datpcb:selectionchange', { detail: { selected: this.selected.slice(0) } }));
	};

	document.addEventListener('DOMContentLoaded', function () {
		var root = document.getElementById('dat-pcb-tracer-app');
		if (root) {
			applyFrontendFullscreen(root);
			global.DATPCBTracerApp = new App(root);
			if (root.classList.contains('dat-pcb-tracer-fullscreen')) {
				global.setTimeout(function () { global.DATPCBTracerApp.canvas.resize(); }, 50);
			}
			root.dispatchEvent(new CustomEvent('datpcb:ready', { detail: { app: global.DATPCBTracerApp } }));
			if (global.DATPCBTabletMode && global.DATPCBTabletMode.bootstrap) {
				global.DATPCBTabletMode.bootstrap(global.DATPCBTracerApp);
			}
		}
	});
})(window, document);
