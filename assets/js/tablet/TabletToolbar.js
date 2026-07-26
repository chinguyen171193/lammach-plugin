(function (global, document) {
	'use strict';

	// Builds tablet-only CAD chrome around the existing editor APIs.
	function TabletToolbar(app) {
		this.app = app;
		this.root = app.root;
		this.sidebar = app.root.querySelector('.dat-pcb-layers');
		this.rightPanel = app.root.querySelector('.dat-pcb-properties');
		this.canvas = app.canvas.canvas;
		this.sidebarStateKey = 'datPCBTabletLeftSidebar';
		this.paletteToolsKey = 'datPCBTabletPaletteTools';
		this.palettePositionKey = 'datPCBTabletPalettePositionV2';
		this.languageStateKey = 'datPCBTabletLanguage';
		this.maxRecentTools = 6;
		this.sidebarState = this.loadSidebarState();
		this.language = this.loadLanguage();
		this.searchTerm = '';
		this.i18n = {
			en: {
				languageLabel: 'Language',
				title: 'Toolbox',
				search: 'Search tools...',
				collapse: 'Collapse toolbox',
				expand: 'Expand toolbox',
				more: 'More',
				emptyFavorites: 'Pin tools here',
				toolSettings: 'Tool settings',
				noToolSettings: 'No settings',
				activeSide: 'Side',
				topSide: 'Top',
				bottomSide: 'Bottom',
				routeMode: 'Route mode',
				trackWidth: 'Track width',
				padDiameter: 'Pad/Via dia.',
				drillDiameter: 'Drill dia.',
				categories: {
					favorites: 'Favorites',
					recent: 'Recent',
					edit: 'Edit',
					copper: 'Copper',
					pads: 'Pads',
					board: 'Board',
					text: 'Text',
					shape: 'Shapes',
					view: 'View',
					measurement: 'Measurement',
					routing: 'Routing',
					drc: 'DRC',
					gerber: 'Gerber',
					utilities: 'Utilities'
				},
				tools: {
					select: 'Select',
					move: 'Move',
					copy: 'Copy',
					paste: 'Paste',
					delete: 'Delete',
					undo: 'Undo',
					redo: 'Redo',
					rotate: 'Rotate',
					mirror: 'Mirror',
					group: 'Group',
					ungroup: 'Ungroup',
					lock: 'Lock',
					zoom: 'Zoom',
					zoom_window: 'Zoom Window',
					zoom_in: 'Zoom In',
					zoom_out: 'Zoom Out',
					fit_board: 'Fit Board',
					pan: 'Pan',
					grid: 'Grid',
					snap: 'Snap',
					track: 'Track',
					arc_track: 'Arc Track',
					copper_polygon: 'Polygon',
					filled_polygon: 'Filled Polygon',
					copper_zone: 'Copper Zone',
					copper_pour: 'Copper Pour',
					via: 'Via',
					drill: 'Drill',
					pad_round: 'Round Pad',
					pad_square: 'Square Pad',
					pad_rounded: 'Rounded Pad',
					pad_smd: 'SMD Pad',
					pad_thermal: 'Thermal Pad',
					pad_rect: 'Rectangular Pad',
					pad_oval: 'Oval Pad',
					outline: 'Board Outline',
					cutout: 'Cutout',
					slot: 'Slot',
					mechanical: 'Mechanical Layer',
					region: 'Copper Region',
					shape_line: 'Line',
					shape_rectangle: 'Rectangle',
					shape_rounded_rectangle: 'Rounded Rectangle',
					shape_circle: 'Circle',
					shape_arc: 'Arc',
					shape_polygon: 'Polygon',
					shape_bezier: 'Bezier',
					annotation: 'Text',
					curved_text: 'Curved Text',
					number_text: 'Number',
					label_text: 'Label',
					measure_distance: 'Measure Distance',
					measure_angle: 'Measure Angle',
					coordinate: 'Coordinate',
					manual_routing: 'Manual Routing',
					auto_routing: 'Auto Routing',
					check_clearance: 'Check Clearance',
					check_track_width: 'Check Track Width',
					check_unconnected: 'Check Unconnected Nets',
					check_overlap: 'Check Overlap',
					gerber_preview: 'Gerber Preview',
					export_gerber: 'Export Gerber',
					export_drill: 'Export Drill',
					align: 'Align',
					distribute: 'Distribute',
					duplicate: 'Duplicate',
					array: 'Array',
					flip: 'Flip',
					rotate_90: 'Rotate 90'
				},
				menu: {
					new: 'New project',
					open: 'Open project',
					duplicate: 'Duplicate',
					lock: 'Lock',
					calibrate: 'Calibrate',
					preview3d: '3D Preview',
					export: 'Export JSON',
					align: 'Align & Distribute',
					array: 'Array'
				}
			},
			vi: {
				languageLabel: 'Ngôn ngữ',
				title: 'Hộp công cụ',
				search: 'Tìm công cụ...',
				collapse: 'Thu gọn hộp công cụ',
				expand: 'Mở hộp công cụ',
				more: 'Thêm',
				emptyFavorites: 'Chưa ghim công cụ',
				toolSettings: 'Thông số công cụ',
				noToolSettings: 'Không có thông số',
				activeSide: 'Mặt',
				topSide: 'Top',
				bottomSide: 'Bottom',
				routeMode: 'Chế độ đi dây',
				trackWidth: 'Rộng đường',
				padDiameter: 'ĐK Pad/Via',
				drillDiameter: 'ĐK khoan',
				categories: {
					favorites: 'Yêu thích',
					recent: 'Gần đây',
					edit: 'Chỉnh sửa',
					copper: 'Mạch đồng',
					pads: 'Pad',
					board: 'Bo mạch',
					text: 'Chữ',
					shape: 'Hình'
				},
				tools: {
					select: 'Chọn',
					track: 'Đường mạch',
					via: 'Via',
					drill: 'Lỗ khoan',
					pad_round: 'Pad tròn',
					pad_rect: 'Pad chữ nhật',
					pad_oval: 'Pad oval',
					outline: 'Viền bo',
					region: 'Vùng đồng',
					annotation: 'Ghi chú'
				},
				menu: {
					new: 'Dự án mới',
					open: 'Mở dự án',
					duplicate: 'Nhân bản',
					lock: 'Khóa',
					calibrate: 'Cân chỉnh',
					preview3d: 'Xem 3D',
					export: 'Xuất JSON'
				}
			}
		};
		this.i18n.vi = {
			languageLabel: 'Ngôn ngữ',
			title: 'Hộp công cụ',
			search: 'Tìm công cụ...',
			collapse: 'Thu gọn hộp công cụ',
			expand: 'Mở hộp công cụ',
			more: 'Thêm',
			emptyFavorites: 'Chưa ghim công cụ',
			toolSettings: 'Thông số công cụ',
			noToolSettings: 'Không có thông số',
			activeSide: 'Mặt',
			topSide: 'Trên',
			bottomSide: 'Dưới',
			routeMode: 'Chế độ đi dây',
			trackWidth: 'Rộng đường mạch',
			padDiameter: 'ĐK Pad/Via',
			drillDiameter: 'ĐK khoan',
			categories: {
				favorites: 'Yêu thích',
				recent: 'Gần đây',
				edit: 'Chỉnh sửa',
				view: 'Quan sát',
				copper: 'Mạch đồng',
				pads: 'Pad',
				board: 'Bo mạch',
				shape: 'Hình',
				text: 'Chữ',
				measurement: 'Đo lường',
				routing: 'Đi mạch',
				drc: 'Kiểm tra DRC',
				gerber: 'Gerber',
				utilities: 'Tiện ích'
			},
			tools: {
				select: 'Chọn',
				move: 'Di chuyển',
				copy: 'Sao chép',
				paste: 'Dán',
				delete: 'Xóa',
				undo: 'Hoàn tác',
				redo: 'Làm lại',
				rotate: 'Xoay',
				mirror: 'Lật gương',
				group: 'Nhóm',
				ungroup: 'Bỏ nhóm',
				lock: 'Khóa',
				zoom: 'Phóng thu',
				zoom_window: 'Phóng vùng',
				zoom_in: 'Phóng to',
				zoom_out: 'Thu nhỏ',
				fit_board: 'Vừa bo mạch',
				pan: 'Kéo màn hình',
				grid: 'Lưới',
				snap: 'Bắt điểm',
				track: 'Đường mạch',
				arc_track: 'Đường mạch cong',
				copper_polygon: 'Đa giác',
				filled_polygon: 'Đa giác đặc',
				copper_zone: 'Vùng đồng',
				copper_pour: 'Đổ đồng',
				region: 'Vùng đồng',
				via: 'Via',
				drill: 'Lỗ khoan',
				pad_round: 'Pad tròn',
				pad_oval: 'Pad oval',
				pad_square: 'Pad vuông',
				pad_rect: 'Pad chữ nhật',
				pad_rounded: 'Pad bo góc',
				pad_smd: 'Pad SMD',
				pad_thermal: 'Pad tản nhiệt',
				outline: 'Viền bo',
				cutout: 'Khoét bo',
				slot: 'Rãnh/slot',
				mechanical: 'Lớp cơ khí',
				shape_line: 'Đường thẳng',
				shape_rectangle: 'Chữ nhật',
				shape_rounded_rectangle: 'Chữ nhật bo góc',
				shape_circle: 'Hình tròn',
				shape_arc: 'Cung tròn',
				shape_polygon: 'Đa giác',
				shape_bezier: 'Bezier',
				annotation: 'Chữ',
				curved_text: 'Chữ cong',
				number_text: 'Số',
				label_text: 'Nhãn',
				measure_distance: 'Đo khoảng cách',
				measure_angle: 'Đo góc',
				coordinate: 'Tọa độ',
				manual_routing: 'Đi mạch tay',
				auto_routing: 'Tự động đi mạch',
				check_clearance: 'Kiểm tra cách điện',
				check_track_width: 'Kiểm tra rộng mạch',
				check_unconnected: 'Kiểm tra chưa nối',
				check_overlap: 'Kiểm tra chồng lấp',
				gerber_preview: 'Xem Gerber',
				export_gerber: 'Xuất Gerber',
				export_drill: 'Xuất Drill',
				align: 'Căn hàng',
				distribute: 'Chia đều',
				duplicate: 'Nhân bản',
				array: 'Mảng lặp',
				flip: 'Lật',
				rotate_90: 'Xoay 90'
			},
			menu: {
				new: 'Dự án mới',
				open: 'Mở dự án',
				duplicate: 'Nhân bản',
				lock: 'Khóa',
				calibrate: 'Cân chỉnh',
				preview3d: 'Xem 3D',
				export: 'Xuất JSON',
				align: 'Căn chỉnh & phân bố',
				array: 'Mảng (Array)'
			}
		};
		this.toolCatalog = {
			select: { icon: 'mouse-pointer-2', label: 'Select', shortcut: 'S' },
			move: { icon: 'move', label: 'Move', tool: 'select' },
			copy: { icon: 'copy', label: 'Copy', action: 'copy' },
			paste: { icon: 'clipboard', label: 'Paste', action: 'paste' },
			delete: { icon: 'trash-2', label: 'Delete', action: 'delete' },
			undo: { icon: 'undo-2', label: 'Undo', action: 'undo' },
			redo: { icon: 'redo-2', label: 'Redo', action: 'redo' },
			rotate: { icon: 'rotate-cw', label: 'Rotate', action: 'rotate-selected-right' },
			mirror: { icon: 'flip-horizontal', label: 'Mirror', action: 'mirror-selected' },
			group: { icon: 'group', label: 'Group', action: 'future:Group' },
			ungroup: { icon: 'ungroup', label: 'Ungroup', action: 'future:Ungroup' },
			lock: { icon: 'lock', label: 'Lock', action: 'toggle-lock' },
			zoom: { icon: 'zoom-in', label: 'Zoom', tool: 'zoom_window' },
			zoom_window: { icon: 'scan-search', label: 'Zoom Window', tool: 'zoom_window' },
			zoom_in: { icon: 'zoom-in', label: 'Zoom In', action: 'zoom-in' },
			zoom_out: { icon: 'zoom-out', label: 'Zoom Out', action: 'zoom-out' },
			fit_board: { icon: 'maximize', label: 'Fit Board', action: 'fit' },
			pan: { icon: 'hand', label: 'Pan', tool: 'pan' },
			grid: { icon: 'grid-3x3', label: 'Grid', action: 'toggle-grid' },
			snap: { icon: 'magnet', label: 'Snap', action: 'toggle-snap' },
			track: { icon: 'route', label: 'Track', shortcut: 'T' },
			arc_track: { icon: 'waypoints', label: 'Arc Track', action: 'future:Arc Track' },
			copper_polygon: { icon: 'pentagon', label: 'Polygon', tool: 'region' },
			filled_polygon: { icon: 'paint-bucket', label: 'Filled Polygon', tool: 'region' },
			copper_zone: { icon: 'layers', label: 'Copper Zone', tool: 'region' },
			copper_pour: { icon: 'droplets', label: 'Copper Pour', tool: 'region' },
			region: { icon: 'badge', label: 'Copper Region', shortcut: 'G' },
			via: { icon: 'circle-dot', label: 'Via', shortcut: 'V' },
			drill: { icon: 'disc-3', label: 'Drill', shortcut: 'D' },
			pad_round: { icon: 'circle', label: 'Round Pad', shortcut: '1' },
			pad_oval: { icon: 'pill', label: 'Oval Pad', shortcut: '3' },
			pad_square: { icon: 'square', label: 'Square Pad', shortcut: '4' },
			pad_rect: { icon: 'rectangle-horizontal', label: 'Rectangular Pad', shortcut: '2' },
			pad_rounded: { icon: 'square-round-corner', label: 'Rounded Pad', tool: 'pad_roundrect' },
			pad_smd: { icon: 'panel-top', label: 'SMD Pad', shortcut: '5' },
			pad_thermal: { icon: 'sun', label: 'Thermal Pad', action: 'future:Thermal Pad' },
			outline: { icon: 'ruler', label: 'Board Outline', shortcut: 'O' },
			cutout: { icon: 'scissors', label: 'Cutout', shortcut: 'K' },
			slot: { icon: 'minus', label: 'Slot', shortcut: 'L' },
			mechanical: { icon: 'settings', label: 'Mechanical Layer', shortcut: 'M' },
			shape_line: { icon: 'slash', label: 'Line', shortcut: '6' },
			shape_rectangle: { icon: 'square', label: 'Rectangle', shortcut: '7' },
			shape_rounded_rectangle: { icon: 'square-round-corner', label: 'Rounded Rectangle', shortcut: '8' },
			shape_circle: { icon: 'circle', label: 'Circle', shortcut: '9' },
			shape_arc: { icon: 'arc', label: 'Arc', shortcut: '0' },
			shape_polygon: { icon: 'pentagon', label: 'Polygon', shortcut: 'P' },
			shape_bezier: { icon: 'bezier', label: 'Bezier', shortcut: 'B' },
			annotation: { icon: 'type', label: 'Text', shortcut: 'A' },
			curved_text: { icon: 'text-cursor', label: 'Curved Text', action: 'future:Curved Text' },
			number_text: { icon: 'hash', label: 'Number', action: 'future:Number text' },
			label_text: { icon: 'tag', label: 'Label', action: 'future:Label text' },
			measure_distance: { icon: 'ruler', label: 'Measure Distance', tool: 'measure' },
			measure_angle: { icon: 'triangle-right', label: 'Measure Angle', tool: 'measure' },
			coordinate: { icon: 'crosshair', label: 'Coordinate', action: 'show-coordinate' },
			manual_routing: { icon: 'route', label: 'Manual Routing', tool: 'track' },
			auto_routing: { icon: 'bot', label: 'Auto Routing', action: 'future:Auto Routing' },
			check_clearance: { icon: 'shield-alert', label: 'Check Clearance', action: 'future:Check Clearance' },
			check_track_width: { icon: 'ruler', label: 'Check Track Width', action: 'drc:track-width' },
			check_unconnected: { icon: 'unlink', label: 'Check Unconnected Nets', action: 'drc:unconnected' },
			check_overlap: { icon: 'layers', label: 'Check Overlap', action: 'future:Check Overlap' },
			gerber_preview: { icon: 'eye', label: 'Gerber Preview', action: 'gerber-preview' },
			export_gerber: { icon: 'archive', label: 'Export Gerber', action: 'export-gerber' },
			export_drill: { icon: 'download', label: 'Export Drill', action: 'export-drill' },
			align: { icon: 'align-center', label: 'Align', action: 'align-menu' },
			distribute: { icon: 'columns-3', label: 'Distribute', action: 'align-menu' },
			duplicate: { icon: 'copy-plus', label: 'Duplicate', action: 'duplicate' },
			array: { icon: 'grid-2x2', label: 'Array', action: 'array-menu' },
			flip: { icon: 'flip-horizontal', label: 'Flip', action: 'mirror-selected' },
			rotate_90: { icon: 'rotate-cw-square', label: 'Rotate 90', action: 'rotate-selected-right' }
		};
		this.leftCategories = [
			{ id: 'favorites', label: 'Favorites', icon: 'star', dynamic: 'favorites' },
			{ id: 'recent', label: 'Recent', icon: 'clock-3', dynamic: 'recent' },
			{ id: 'edit', label: 'Edit', icon: 'mouse-pointer-2', tools: ['select', 'move', 'copy', 'paste', 'delete', 'undo', 'redo', 'rotate', 'mirror', 'group', 'ungroup', 'lock'] },
			{ id: 'view', label: 'View', icon: 'eye', tools: ['zoom', 'zoom_window', 'zoom_in', 'zoom_out', 'fit_board', 'pan', 'grid', 'snap'] },
			{ id: 'copper', label: 'Copper', icon: 'circuit-board', tools: ['track', 'arc_track', 'copper_polygon', 'filled_polygon', 'copper_zone', 'copper_pour', 'region'] },
			{ id: 'pads', label: 'Pads', icon: 'circle-dot', tools: ['pad_round', 'pad_oval', 'pad_square', 'pad_rounded', 'pad_smd', 'pad_thermal', 'via'] },
			{ id: 'board', label: 'Board', icon: 'ruler', tools: ['outline', 'cutout', 'slot', 'mechanical'] },
			{ id: 'shape', label: 'Shapes', icon: 'shapes', tools: ['shape_line', 'shape_rectangle', 'shape_rounded_rectangle', 'shape_circle', 'shape_arc', 'shape_polygon', 'shape_bezier'] },
			{ id: 'text', label: 'Text', icon: 'type', tools: ['annotation', 'curved_text', 'number_text', 'label_text'] },
			{ id: 'measurement', label: 'Measurement', icon: 'crosshair', tools: ['measure_distance', 'measure_angle', 'coordinate'] },
			{ id: 'routing', label: 'Routing', icon: 'route', tools: ['manual_routing', 'auto_routing'] },
			{ id: 'drc', label: 'DRC', icon: 'shield-alert', tools: ['check_clearance', 'check_track_width', 'check_unconnected', 'check_overlap'] },
			{ id: 'gerber', label: 'Gerber', icon: 'archive', tools: ['gerber_preview', 'export_gerber', 'export_drill'] },
			{ id: 'utilities', label: 'Utilities', icon: 'settings', tools: ['align', 'distribute', 'duplicate', 'array', 'flip', 'rotate_90'] }
		];
		this.build();
		this.bindCanvasDrop();
		this.enhanceBottomBar();
	}

	TabletToolbar.prototype.build = function () {
		this.buildTopOverflow();
		this.buildLeftPanel();
		this.buildRightTabs();
		this.buildCompactPalette();
	};

	TabletToolbar.prototype.loadPaletteTools = function () {
		var defaults = ['select', 'track', 'pad_round', 'pad_rect', 'via', 'drill', 'outline', 'region', 'annotation', 'undo', 'redo', 'fit_board'];
		try {
			var stored = JSON.parse(global.localStorage.getItem(this.paletteToolsKey) || 'null');
			if (!Array.isArray(stored) || !stored.length) return defaults;
			return stored.filter(function (tool) { return !!this.toolCatalog[tool]; }, this).slice(0, 20);
		} catch (err) {
			return defaults;
		}
	};

	TabletToolbar.prototype.savePaletteTools = function () {
		try { global.localStorage.setItem(this.paletteToolsKey, JSON.stringify(this.paletteTools)); } catch (err) {}
	};

	TabletToolbar.prototype.buildCompactPalette = function () {
		if (this.palette) return;
		this.paletteTools = this.loadPaletteTools();
		var palette = document.createElement('section');
		palette.className = 'dat-tablet-compact-palette';
		palette.setAttribute('aria-label', this.t('title'));
		var handle = document.createElement('div');
		handle.className = 'dat-tablet-palette-handle';
		var grip = document.createElement('span');
		grip.className = 'dat-tablet-palette-grip';
		grip.textContent = '⠿';
		var title = document.createElement('strong');
		title.textContent = this.t('title');
		var settings = document.createElement('button');
		settings.type = 'button';
		settings.className = 'dat-tablet-palette-settings-button';
		settings.title = 'Cài đặt công cụ';
		settings.setAttribute('aria-label', settings.title);
		settings.innerHTML = this.renderIcon('settings');
		var toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = 'dat-tablet-palette-toggle';
		toggle.title = 'Hien them cong cu';
		toggle.setAttribute('aria-label', toggle.title);
		toggle.innerHTML = this.renderIcon('chevron-down');
		handle.appendChild(grip);
		handle.appendChild(title);
		handle.appendChild(toggle);
		handle.appendChild(settings);
		var tools = document.createElement('div');
		tools.className = 'dat-tablet-compact-tools';
		var config = document.createElement('div');
		config.className = 'dat-tablet-palette-config';
		config.hidden = true;
		palette.appendChild(handle);
		palette.appendChild(tools);
		palette.appendChild(config);
		this.root.appendChild(palette);
		this.palette = palette;
		this.paletteToolGrid = tools;
		this.paletteConfig = config;
		this.renderCompactPalette();
		this.renderPaletteConfig();
		this.restorePalettePosition();
		settings.addEventListener('click', function () {
			config.hidden = !config.hidden;
			palette.classList.toggle('is-configuring', !config.hidden);
		}.bind(this));
		toggle.addEventListener('click', function () {
			var expanded = !palette.classList.contains('is-expanded');
			palette.classList.toggle('is-expanded', expanded);
			toggle.title = expanded ? 'An bot cong cu' : 'Hien them cong cu';
			toggle.setAttribute('aria-label', toggle.title);
		});
		tools.addEventListener('click', function (e) {
			var button = e.target.closest('[data-palette-tool]');
			if (button) this.selectTool(button.getAttribute('data-palette-tool'));
		}.bind(this));
		this.bindPaletteDrag(handle);
	};

	TabletToolbar.prototype.renderCompactPalette = function () {
		if (!this.paletteToolGrid) return;
		this.paletteToolGrid.textContent = '';
		this.paletteTools.forEach(function (tool) {
			var info = this.toolCatalog[tool];
			if (!info) return;
			var button = document.createElement('button');
			button.type = 'button';
			button.setAttribute('data-palette-tool', tool);
			button.title = this.getToolLabel(tool);
			button.setAttribute('aria-label', button.title);
			button.innerHTML = this.renderIcon(info.icon);
			this.paletteToolGrid.appendChild(button);
		}, this);
	};

	TabletToolbar.prototype.renderPaletteConfig = function () {
		if (!this.paletteConfig) return;
		this.paletteConfig.textContent = '';
		var heading = document.createElement('div');
		heading.className = 'dat-tablet-palette-config-title';
		heading.textContent = 'Chọn công cụ hiển thị (tối đa 20)';
		this.paletteConfig.appendChild(heading);
		Object.keys(this.toolCatalog).forEach(function (tool) {
			var label = document.createElement('label');
			var checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = this.paletteTools.indexOf(tool) !== -1;
			checkbox.addEventListener('change', function () {
				var index = this.paletteTools.indexOf(tool);
				if (checkbox.checked && index === -1) {
					if (this.paletteTools.length >= 20) { checkbox.checked = false; return; }
					this.paletteTools.push(tool);
				} else if (!checkbox.checked && index !== -1) {
					this.paletteTools.splice(index, 1);
				}
				this.savePaletteTools();
				this.renderCompactPalette();
			}.bind(this));
			label.appendChild(checkbox);
			label.appendChild(document.createTextNode(this.getToolLabel(tool)));
			this.paletteConfig.appendChild(label);
		}, this);
	};

	TabletToolbar.prototype.restorePalettePosition = function () {
		try {
			var pos = JSON.parse(global.localStorage.getItem(this.palettePositionKey) || 'null');
			if (pos && isFinite(pos.x) && isFinite(pos.y)) {
				var maxX = Math.max(8, global.innerWidth - this.palette.offsetWidth - 8);
				var maxY = Math.max(8, global.innerHeight - this.palette.offsetHeight - 8);
				this.palette.style.left = Math.max(8, Math.min(pos.x, maxX)) + 'px';
				this.palette.style.top = Math.max(8, Math.min(pos.y, maxY)) + 'px';
			}
		} catch (err) {}
	};

	TabletToolbar.prototype.keepPaletteInViewport = function () {
		if (!this.palette) return;
		var rect = this.palette.getBoundingClientRect();
		var maxX = Math.max(8, global.innerWidth - this.palette.offsetWidth - 8);
		var maxY = Math.max(8, global.innerHeight - this.palette.offsetHeight - 8);
		var x = Math.max(8, Math.min(rect.left, maxX));
		var y = Math.max(8, Math.min(rect.top, maxY));
		this.palette.style.left = x + 'px';
		this.palette.style.top = y + 'px';
		try { global.localStorage.setItem(this.palettePositionKey, JSON.stringify({ x: x, y: y })); } catch (err) {}
	};

	TabletToolbar.prototype.bindPaletteDrag = function (handle) {
		var drag = null;
		handle.addEventListener('pointerdown', function (e) {
			if (e.target.closest('button')) return;
			var rect = this.palette.getBoundingClientRect();
			drag = { x: e.clientX - rect.left, y: e.clientY - rect.top };
			handle.setPointerCapture(e.pointerId);
			e.preventDefault();
		}.bind(this));
		handle.addEventListener('pointermove', function (e) {
			if (!drag) return;
			var maxX = Math.max(8, global.innerWidth - this.palette.offsetWidth - 8);
			var maxY = Math.max(8, global.innerHeight - this.palette.offsetHeight - 8);
			this.palette.style.left = Math.max(8, Math.min(e.clientX - drag.x, maxX)) + 'px';
			this.palette.style.top = Math.max(8, Math.min(e.clientY - drag.y, maxY)) + 'px';
		}.bind(this));
		handle.addEventListener('pointerup', function () {
			if (!drag) return;
			drag = null;
			try { global.localStorage.setItem(this.palettePositionKey, JSON.stringify({ x: this.palette.offsetLeft, y: this.palette.offsetTop })); } catch (err) {}
		}.bind(this));
		handle.addEventListener('pointercancel', function () {
			drag = null;
		});
	};

	TabletToolbar.prototype.loadSidebarState = function () {
		var fallback = { expanded: 'copper', favorites: ['track', 'via', 'pad_round'], recent: [] };
		try {
			var stored = JSON.parse(global.localStorage.getItem(this.sidebarStateKey) || 'null');
			if (!stored || typeof stored !== 'object') return fallback;
			return {
				expanded: stored.expanded !== undefined ? stored.expanded : fallback.expanded,
				favorites: Array.isArray(stored.favorites) ? stored.favorites : fallback.favorites,
				recent: Array.isArray(stored.recent) ? stored.recent : fallback.recent
			};
		} catch (err) {
			return fallback;
		}
	};

	TabletToolbar.prototype.saveSidebarState = function () {
		try {
			global.localStorage.setItem(this.sidebarStateKey, JSON.stringify(this.sidebarState));
		} catch (err) {}
	};

	TabletToolbar.prototype.loadLanguage = function () {
		try {
			var stored = global.localStorage.getItem(this.languageStateKey);
			return stored === 'en' || stored === 'vi' ? stored : 'vi';
		} catch (err) {
			return 'vi';
		}
	};

	TabletToolbar.prototype.saveLanguage = function () {
		try {
			global.localStorage.setItem(this.languageStateKey, this.language);
		} catch (err) {}
	};

	TabletToolbar.prototype.t = function (key) {
		var lang = this.i18n[this.language] || this.i18n.vi;
		return lang[key] || (this.i18n.en && this.i18n.en[key]) || key;
	};

	TabletToolbar.prototype.getCategoryLabel = function (category) {
		var lang = this.i18n[this.language] || this.i18n.vi;
		return (lang.categories && lang.categories[category.id]) || category.label;
	};

	TabletToolbar.prototype.getToolLabel = function (tool) {
		var lang = this.i18n[this.language] || this.i18n.vi;
		var info = this.toolCatalog[tool];
		return (lang.tools && lang.tools[tool]) || (info && info.label) || tool;
	};

	TabletToolbar.prototype.getMenuLabel = function (key) {
		var lang = this.i18n[this.language] || this.i18n.vi;
		return (lang.menu && lang.menu[key]) || key;
	};

	TabletToolbar.prototype.updateLanguageText = function () {
		if (this.languageSelect) this.languageSelect.value = this.language;
		if (this.languageSwitcher) {
			var label = this.languageSwitcher.querySelector('span');
			if (label) label.textContent = this.t('languageLabel');
			if (this.languageSelect) this.languageSelect.setAttribute('aria-label', this.t('languageLabel'));
		}
		if (this.overflowButton) this.overflowButton.textContent = this.t('more');
		var menu = this.root.querySelector('.dat-tablet-overflow-menu');
		if (menu) {
			Array.prototype.forEach.call(menu.querySelectorAll('[data-i18n-key]'), function (button) {
				var key = button.getAttribute('data-i18n-key');
				var type = button.getAttribute('data-i18n-type');
				var tool = button.getAttribute('data-tablet-tool');
				button.textContent = type === 'tool' ? this.getToolLabel(tool) : this.getMenuLabel(key);
			}, this);
		}
		if (this.panelTitle) this.panelTitle.textContent = this.t('title');
		if (this.searchInput) {
			this.searchInput.placeholder = this.t('search');
			this.searchInput.setAttribute('aria-label', this.t('search'));
		}
		if (this.collapseButton) {
			var collapsed = this.sidebar && this.sidebar.classList.contains('dat-tablet-icon-only');
			this.collapseButton.title = collapsed ? this.t('expand') : this.t('collapse');
			this.collapseButton.setAttribute('aria-label', collapsed ? this.t('expand') : this.t('collapse'));
		}
		this.renderLeftSidebar();
		this.renderToolSettings();
	};

	TabletToolbar.prototype.setRightPanelCollapsed = function (collapsed) {
		if (!this.rightPanel) return;
		this.rightPanel.classList.toggle('dat-tablet-panel-collapsed', !!collapsed);
		this.root.classList.toggle('dat-tablet-right-collapsed', !!collapsed);
		var button = this.rightPanel.querySelector('.dat-tablet-right-collapse');
		if (button) {
			button.innerHTML = this.renderIcon(collapsed ? 'panel-left-close' : 'panel-left-open');
			button.title = collapsed ? 'Expand panel' : 'Collapse panel';
			button.setAttribute('aria-label', button.title);
		}
		if (this.app && this.app.canvas) {
			global.setTimeout(this.app.canvas.resize.bind(this.app.canvas), 0);
		}
	};

	TabletToolbar.prototype.isResponsiveTablet = function () {
		return global.matchMedia && global.matchMedia('(min-width: 768px) and (max-width: 1024px)').matches;
	};

	TabletToolbar.prototype.setLeftOverlayOpen = function (open) {
		if (!this.sidebar) return;
		this.root.classList.toggle('dat-tablet-left-overlay-open', !!open);
		this.root.classList.add('dat-tablet-left-collapsed');
		this.sidebar.classList.toggle('dat-tablet-icon-only', !open);
		if (this.collapseButton) {
			this.collapseButton.innerHTML = this.renderIcon(open ? 'panel-left-close' : 'panel-left-open');
			this.collapseButton.title = open ? this.t('collapse') : this.t('expand');
			this.collapseButton.setAttribute('aria-label', open ? this.t('collapse') : this.t('expand'));
		}
	};

	TabletToolbar.prototype.initializeResponsiveSidebar = function () {
		if (!this.sidebar) return;
		if (this.isResponsiveTablet()) {
			this.setLeftOverlayOpen(false);
		} else {
			this.root.classList.remove('dat-tablet-left-overlay-open');
		}
	};

	TabletToolbar.prototype.buildTopOverflow = function () {
		var toolbar = this.root.querySelector('.dat-pcb-toolbar');
		if (!toolbar) return;
		this.buildLanguageSwitcher(toolbar);
		if (toolbar.querySelector('.dat-tablet-overflow-button')) return;
		var button = document.createElement('button');
		button.type = 'button';
		button.className = 'dat-tablet-overflow-button';
		button.textContent = this.t('more');
		this.overflowButton = button;
		var menu = document.createElement('div');
		menu.className = 'dat-tablet-overflow-menu';
		menu.hidden = true;
		[
			['new', 'new', 'action'],
			['open', 'open', 'action'],
			['duplicate', 'duplicate', 'action'],
			['lock', 'toggle-lock', 'action'],
			['calibrate', 'calibrate', 'action'],
			['preview3d', 'preview3d', 'action'],
			['export', 'export', 'action'],
			['align', 'align-menu', 'action'],
			['array', 'array-menu', 'action'],
			['pad_rect', 'pad_rect', 'tool'],
			['pad_oval', 'pad_oval', 'tool'],
			['drill', 'drill', 'tool'],
			['outline', 'outline', 'tool'],
			['region', 'region', 'tool']
		].forEach(function (item) {
			var command = document.createElement('button');
			command.type = 'button';
			command.textContent = item[2] === 'tool' ? this.getToolLabel(item[1]) : this.getMenuLabel(item[0]);
			command.setAttribute('data-i18n-key', item[0]);
			command.setAttribute('data-i18n-type', item[2]);
			command.setAttribute(item[2] === 'tool' ? 'data-tablet-tool' : 'data-tablet-action', item[1]);
			menu.appendChild(command);
		}, this);
		toolbar.appendChild(button);
		toolbar.appendChild(menu);
		button.addEventListener('click', function () {
			menu.hidden = !menu.hidden;
		});
		menu.addEventListener('click', function (e) {
			var action = e.target.getAttribute('data-tablet-action');
			var tool = e.target.getAttribute('data-tablet-tool');
			if (action) this.app.action(action);
			if (tool) {
				this.app.setTool(tool);
				this.rememberRecent(tool);
				this.updateSelectedCards();
				this.renderToolSettings();
			}
			if (action || tool) menu.hidden = true;
		}.bind(this));
		document.addEventListener('pointerdown', function (e) {
			if (!menu.hidden && !menu.contains(e.target) && e.target !== button) menu.hidden = true;
		});
	};

	TabletToolbar.prototype.buildLanguageSwitcher = function (toolbar) {
		if (toolbar.querySelector('.dat-tablet-language-switcher')) return;
		var wrap = document.createElement('label');
		wrap.className = 'dat-tablet-language-switcher';
		var label = document.createElement('span');
		label.textContent = this.t('languageLabel');
		var select = document.createElement('select');
		select.setAttribute('aria-label', this.t('languageLabel'));
		select.innerHTML = '<option value="vi">VI</option><option value="en">EN</option>';
		select.value = this.language;
		wrap.appendChild(label);
		wrap.appendChild(select);
		this.languageSwitcher = wrap;
		this.languageSelect = select;
		toolbar.appendChild(wrap);
		select.addEventListener('change', function () {
			this.language = select.value === 'en' ? 'en' : 'vi';
			this.saveLanguage();
			this.updateLanguageText();
		}.bind(this));
	};

	TabletToolbar.prototype.buildLeftPanel = function () {
		if (!this.sidebar || this.sidebar.querySelector('.dat-tablet-left-shell')) return;
		var shell = document.createElement('div');
		shell.className = 'dat-tablet-left-shell';
		this.leftShell = shell;
		var header = document.createElement('div');
		header.className = 'dat-tablet-panel-header';
		var title = document.createElement('span');
		title.textContent = this.t('title');
		this.panelTitle = title;
		header.appendChild(title);
		var collapse = document.createElement('button');
		collapse.type = 'button';
		collapse.className = 'dat-tablet-collapse';
		collapse.innerHTML = this.renderIcon('panel-left-close');
		collapse.title = this.t('collapse');
		collapse.setAttribute('aria-label', this.t('collapse'));
		this.collapseButton = collapse;
		header.appendChild(collapse);
		shell.appendChild(header);
		var searchWrap = document.createElement('label');
		searchWrap.className = 'dat-tablet-tool-search';
		var searchIcon = document.createElement('span');
		searchIcon.className = 'dat-tablet-search-icon';
		searchIcon.innerHTML = this.renderIcon('search');
		var search = document.createElement('input');
		search.type = 'search';
		search.placeholder = this.t('search');
		search.setAttribute('aria-label', this.t('search'));
		this.searchInput = search;
		searchWrap.appendChild(searchIcon);
		searchWrap.appendChild(search);
		shell.appendChild(searchWrap);
		var body = document.createElement('div');
		body.className = 'dat-tablet-left-body';
		shell.appendChild(body);
		this.leftBody = body;
		var settings = document.createElement('div');
		settings.className = 'dat-tablet-tool-settings';
		shell.appendChild(settings);
		this.toolSettings = settings;
		this.sidebar.insertBefore(shell, this.sidebar.firstChild);
		this.renderLeftSidebar();
		this.renderToolSettings();
		this.initializeResponsiveSidebar();
		search.addEventListener('input', function () {
			this.searchTerm = search.value.toLowerCase().trim();
			this.renderLeftSidebar();
		}.bind(this));
		body.addEventListener('click', function (e) {
			var summary = e.target.closest('[data-sidebar-category]');
			if (summary) {
				this.openCategory(summary.getAttribute('data-sidebar-category'));
				return;
			}
			var card = e.target.closest('[data-tool-card]');
			if (card) {
				this.selectTool(card.getAttribute('data-tool-card'));
			}
		}.bind(this));
		body.addEventListener('keydown', function (e) {
			if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-tool-card]')) {
				e.preventDefault();
				this.selectTool(e.target.getAttribute('data-tool-card'));
			}
		}.bind(this));
		collapse.addEventListener('click', function () {
			if (this.isResponsiveTablet()) {
				this.setLeftOverlayOpen(!this.root.classList.contains('dat-tablet-left-overlay-open'));
				return;
			}
			this.sidebar.classList.toggle('dat-tablet-icon-only');
			this.root.classList.toggle('dat-tablet-left-collapsed', this.sidebar.classList.contains('dat-tablet-icon-only'));
			collapse.innerHTML = this.renderIcon(this.sidebar.classList.contains('dat-tablet-icon-only') ? 'panel-left-open' : 'panel-left-close');
			collapse.title = this.sidebar.classList.contains('dat-tablet-icon-only') ? this.t('expand') : this.t('collapse');
			collapse.setAttribute('aria-label', this.sidebar.classList.contains('dat-tablet-icon-only') ? this.t('expand') : this.t('collapse'));
		}.bind(this));
		document.addEventListener('pointerdown', function (e) {
			if (!this.isResponsiveTablet() || !this.root.classList.contains('dat-tablet-left-overlay-open')) return;
			if (this.sidebar.contains(e.target)) return;
			this.setLeftOverlayOpen(false);
		}.bind(this));
		global.addEventListener('resize', function () {
			this.initializeResponsiveSidebar();
			this.keepPaletteInViewport();
			global.setTimeout(this.keepPaletteInViewport.bind(this), 180);
		}.bind(this));
		this.canvas.addEventListener('pointerdown', function () {
			if (this.isResponsiveTablet() && this.root.classList.contains('dat-tablet-left-overlay-open')) {
				this.setLeftOverlayOpen(false);
			}
		}.bind(this));
		this.root.addEventListener('click', function (e) {
			var toolNode = e.target.closest('[data-tool]');
			if (toolNode) {
				this.rememberRecent(toolNode.getAttribute('data-tool'));
				global.setTimeout(function () {
					this.updateSelectedCards();
					this.renderToolSettings();
				}.bind(this), 0);
			}
		}.bind(this), true);
	};

	TabletToolbar.prototype.renderLeftSidebar = function () {
		if (!this.leftBody) return;
		this.leftBody.textContent = '';
		this.leftCategories.forEach(function (category) {
			var tools = this.resolveCategoryTools(category);
			if (!tools.length && category.id !== 'favorites') return;
			if (this.searchTerm) {
				tools = tools.filter(function (tool) {
					var info = this.toolCatalog[tool];
					var label = this.getToolLabel(tool).toLowerCase();
					return info && (label.indexOf(this.searchTerm) !== -1 || tool.indexOf(this.searchTerm) !== -1);
				}, this);
				if (!tools.length && category.id !== 'favorites') return;
			}
			this.leftBody.appendChild(this.createToolGroup(category, tools));
		}, this);
		this.updateSelectedCards();
	};

	TabletToolbar.prototype.resolveCategoryTools = function (category) {
		if (category.dynamic === 'favorites') return this.sidebarState.favorites.filter(this.hasTool.bind(this));
		if (category.dynamic === 'recent') return this.sidebarState.recent.filter(this.hasTool.bind(this));
		return (category.tools || []).filter(this.hasTool.bind(this));
	};

	TabletToolbar.prototype.hasTool = function (tool) {
		return !!this.toolCatalog[tool];
	};

	TabletToolbar.prototype.renderIcon = function (name) {
		var paths = {
			'search': '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>',
			'star': '<path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6-4.36-4.25 6.03-.88Z"></path>',
			'clock-3': '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5h5"></path>',
			'mouse-pointer-2': '<path d="m4 3 7.1 17 2.2-7.2L20 10Z"></path><path d="m12.5 12.5 4.4 4.4"></path>',
			'route': '<circle cx="6" cy="19" r="2"></circle><circle cx="18" cy="5" r="2"></circle><path d="M8 19h3.5a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h6"></path>',
			'circle-dot': '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="2.5"></circle>',
			'disc-3': '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="2"></circle><path d="M12 3v5"></path><path d="M12 16v5"></path>',
			'circle': '<circle cx="12" cy="12" r="8"></circle>',
			'square': '<rect x="5" y="5" width="14" height="14" rx="2"></rect>',
			'pill': '<path d="M10 5h4a7 7 0 0 1 0 14h-4a7 7 0 0 1 0-14Z"></path>',
			'ruler': '<path d="m16 3 5 5L8 21l-5-5Z"></path><path d="m14 7 3 3"></path><path d="m11 10 2 2"></path><path d="m8 13 3 3"></path>',
			'pentagon': '<path d="M12 3 21 9.5 17.6 20H6.4L3 9.5Z"></path>',
			'type': '<path d="M4 7V4h16v3"></path><path d="M9 20h6"></path><path d="M12 4v16"></path>',
			'circuit-board': '<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M9 9h6v6H9Z"></path><path d="M9 2v2"></path><path d="M15 2v2"></path><path d="M9 20v2"></path><path d="M15 20v2"></path><path d="M2 9h2"></path><path d="M2 15h2"></path><path d="M20 9h2"></path><path d="M20 15h2"></path>',
			'shapes': '<path d="M8 3 3 8l5 5 5-5Z"></path><circle cx="17" cy="17" r="4"></circle>',
			'move': '<path d="M12 2v20"></path><path d="m15 5-3-3-3 3"></path><path d="m15 19-3 3-3-3"></path><path d="M2 12h20"></path><path d="m5 9-3 3 3 3"></path><path d="m19 9 3 3-3 3"></path>',
			'copy': '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>',
			'clipboard': '<rect x="8" y="2" width="8" height="4" rx="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14H4V6a2 2 0 0 1 2-2h2"></path>',
			'trash-2': '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 15H6L5 6"></path>',
			'undo-2': '<path d="M9 14 4 9l5-5"></path><path d="M4 9h10a6 6 0 0 1 0 12h-1"></path>',
			'redo-2': '<path d="m15 14 5-5-5-5"></path><path d="M20 9H10a6 6 0 0 0 0 12h1"></path>',
			'rotate-cw': '<path d="M21 12a9 9 0 1 1-3-6.7"></path><path d="M21 3v6h-6"></path>',
			'rotate-cw-square': '<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M16 9a4 4 0 1 0 1 3"></path><path d="M16 6v3h3"></path>',
			'flip-horizontal': '<path d="M12 3v18"></path><path d="m8 7-5 5 5 5Z"></path><path d="m16 7 5 5-5 5Z"></path>',
			'group': '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>',
			'ungroup': '<path d="M3 3h7v7H3Z"></path><path d="M14 14h7v7h-7Z"></path><path d="M14 3h7v7h-7Z"></path><path d="M3 14h7v7H3Z"></path>',
			'lock': '<rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path>',
			'zoom-in': '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path><path d="M11 8v6"></path><path d="M8 11h6"></path>',
			'zoom-out': '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path><path d="M8 11h6"></path>',
			'scan-search': '<path d="M3 7V4h3"></path><path d="M18 4h3v3"></path><path d="M21 17v3h-3"></path><path d="M6 20H3v-3"></path><circle cx="11" cy="11" r="4"></circle><path d="m16 16-2-2"></path>',
			'maximize': '<path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M16 3h3a2 2 0 0 1 2 2v3"></path><path d="M21 16v3a2 2 0 0 1-2 2h-3"></path><path d="M8 21H5a2 2 0 0 1-2-2v-3"></path>',
			'hand': '<path d="M18 11V7a2 2 0 0 0-4 0v4"></path><path d="M14 10V6a2 2 0 0 0-4 0v8"></path><path d="M10 11V8a2 2 0 0 0-4 0v7a6 6 0 0 0 12 0v-4"></path>',
			'grid-3x3': '<path d="M3 3h18v18H3Z"></path><path d="M9 3v18"></path><path d="M15 3v18"></path><path d="M3 9h18"></path><path d="M3 15h18"></path>',
			'magnet': '<path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3Z"></path><path d="M6 7h4"></path><path d="M14 7h4"></path>',
			'waypoints': '<circle cx="5" cy="19" r="2"></circle><circle cx="19" cy="5" r="2"></circle><path d="M7 19c7 0 10-3 10-12"></path>',
			'paint-bucket': '<path d="m19 11-8-8-7 7 8 8 7-7Z"></path><path d="M5 21h14"></path><path d="M19 11c2 2 2 4 0 6"></path>',
			'layers': '<path d="m12 3 9 5-9 5-9-5Z"></path><path d="m3 12 9 5 9-5"></path><path d="m3 16 9 5 9-5"></path>',
			'droplets': '<path d="M7 16a4 4 0 0 0 8 0c0-2-4-7-4-7s-4 5-4 7Z"></path><path d="M17 9a3 3 0 0 0 3-3c0-1.5-3-5-3-5s-3 3.5-3 5a3 3 0 0 0 3 3Z"></path>',
			'badge': '<path d="M12 3 20 8v8l-8 5-8-5V8Z"></path>',
			'rectangle-horizontal': '<rect x="3" y="7" width="18" height="10" rx="2"></rect>',
			'square-round-corner': '<rect x="5" y="5" width="14" height="14" rx="4"></rect>',
			'panel-top': '<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M4 9h16"></path>',
			'sun': '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v3"></path><path d="M12 19v3"></path><path d="M2 12h3"></path><path d="M19 12h3"></path><path d="m4.9 4.9 2.1 2.1"></path><path d="m17 17 2.1 2.1"></path><path d="m19.1 4.9-2.1 2.1"></path><path d="m7 17-2.1 2.1"></path>',
			'scissors': '<circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M20 4 8.5 15.5"></path><path d="M14 14 20 20"></path><path d="M8.5 8.5 12 12"></path>',
			'minus': '<path d="M5 12h14"></path>',
			'settings': '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.5-1.5-.6a1.7 1.7 0 0 0-1.9.3L13 21h-4l-.2-1.6a1.7 1.7 0 0 0-1.3-1.2l-1.6.2-2-3.5 1.3-1a1.7 1.7 0 0 0 .5-1.8L5 11 7 7.5l1.5.6a1.7 1.7 0 0 0 1.9-.3L11 7h4l.2 1.6a1.7 1.7 0 0 0 1.3 1.2l1.6-.2 2 3.5Z"></path>',
			'slash': '<path d="M4 20 20 4"></path>',
			'arc': '<path d="M5 19A14 14 0 0 1 19 5"></path><path d="M15 5h4v4"></path>',
			'bezier': '<circle cx="5" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle><path d="M7 12c3-8 7-8 10 0"></path><path d="M7 12c3 8 7 8 10 0"></path>',
			'text-cursor': '<path d="M17 4h-4a4 4 0 0 0 0 8h4"></path><path d="M7 4v16"></path><path d="M4 4h6"></path><path d="M4 20h6"></path>',
			'hash': '<path d="M4 9h16"></path><path d="M4 15h16"></path><path d="M10 3 8 21"></path><path d="m16 3-2 18"></path>',
			'tag': '<path d="M20 13 13 20 4 11V4h7Z"></path><circle cx="8" cy="8" r="1"></circle>',
			'crosshair': '<circle cx="12" cy="12" r="7"></circle><path d="M12 2v4"></path><path d="M12 18v4"></path><path d="M2 12h4"></path><path d="M18 12h4"></path>',
			'triangle-right': '<path d="M4 20h16L4 4Z"></path><path d="M4 12h8"></path>',
			'bot': '<rect x="5" y="8" width="14" height="10" rx="2"></rect><path d="M12 8V4"></path><circle cx="9" cy="13" r="1"></circle><circle cx="15" cy="13" r="1"></circle>',
			'shield-alert': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path>',
			'unlink': '<path d="m18.8 12.2 1.4-1.4a4 4 0 0 0-5.7-5.7l-2 2"></path><path d="m5.2 11.8-1.4 1.4a4 4 0 0 0 5.7 5.7l2-2"></path><path d="m8 8 8 8"></path>',
			'eye': '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle>',
			'archive': '<rect x="3" y="4" width="18" height="4" rx="1"></rect><path d="M5 8v12h14V8"></path><path d="M10 12h4"></path>',
			'download': '<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>',
			'align-center': '<path d="M12 3v18"></path><path d="M7 7h10"></path><path d="M5 12h14"></path><path d="M8 17h8"></path>',
			'columns-3': '<rect x="3" y="4" width="5" height="16"></rect><rect x="10" y="4" width="4" height="16"></rect><rect x="16" y="4" width="5" height="16"></rect>',
			'copy-plus': '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path><path d="M14 12v4"></path><path d="M12 14h4"></path>',
			'grid-2x2': '<rect x="4" y="4" width="6" height="6"></rect><rect x="14" y="4" width="6" height="6"></rect><rect x="4" y="14" width="6" height="6"></rect><rect x="14" y="14" width="6" height="6"></rect>',
			'panel-left-close': '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M9 4v16"></path><path d="m16 10-2 2 2 2"></path>',
			'panel-left-open': '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M9 4v16"></path><path d="m14 10 2 2-2 2"></path>'
		};
		return '<svg class="dat-tablet-lucide" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[name] || paths.circle) + '</svg>';
	};

	TabletToolbar.prototype.createToolGroup = function (category, tools) {
		var section = document.createElement('section');
		section.className = 'dat-tablet-tool-group';
		section.setAttribute('data-category-id', category.id);
		var isOpen = this.searchTerm || this.sidebarState.expanded === category.id;
		section.classList.toggle('is-open', !!isOpen);
		var summary = document.createElement('button');
		summary.type = 'button';
		summary.className = 'dat-tablet-category-button';
		summary.setAttribute('data-sidebar-category', category.id);
		summary.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
		summary.innerHTML = '<span class="dat-tablet-category-icon">' + this.renderIcon(category.icon) + '</span><span class="dat-tablet-category-label">' + this.getCategoryLabel(category) + '</span><span class="dat-tablet-category-count">' + tools.length + '</span>';
		section.appendChild(summary);
		var grid = document.createElement('div');
		grid.className = 'dat-tablet-tool-grid';
		if (tools.length) {
			tools.forEach(function (tool) {
				grid.appendChild(this.createToolCard(tool));
			}, this);
		} else {
			var empty = document.createElement('div');
			empty.className = 'dat-tablet-empty-tools';
			empty.textContent = this.t('emptyFavorites');
			grid.appendChild(empty);
		}
		section.appendChild(grid);
		return section;
	};

	TabletToolbar.prototype.createToolCard = function (tool) {
		var info = this.toolCatalog[tool];
		var card = document.createElement('div');
		card.className = 'dat-tablet-tool-card';
		if (info.action) card.classList.add(info.action.indexOf('future:') === 0 ? 'is-future' : 'is-action');
		card.tabIndex = 0;
		card.draggable = !info.action;
		card.setAttribute('role', 'button');
		card.setAttribute('data-tool-card', tool);
		if (!info.action) {
			card.setAttribute('data-tool', info.tool || tool);
			card.setAttribute('data-drag-tool', info.tool || tool);
		}
		card.setAttribute('aria-label', this.getToolLabel(tool));
		card.innerHTML =
			'<span class="dat-tablet-tool-icon">' + this.renderIcon(info.icon) + '</span>' +
			'<span class="dat-tablet-tool-label">' + this.getToolLabel(tool) + '</span>' +
			'<span class="dat-tablet-tool-shortcut">' + (info.shortcut || '') + '</span>';
		card.addEventListener('dragstart', function (e) {
			if (info.action) {
				e.preventDefault();
				return;
			}
			e.dataTransfer.setData('text/dat-pcb-tool', info.tool || tool);
			e.dataTransfer.effectAllowed = 'copy';
		});
		return card;
	};

	TabletToolbar.prototype.openCategory = function (categoryId) {
		if (this.isResponsiveTablet() && !this.root.classList.contains('dat-tablet-left-overlay-open')) {
			this.sidebarState.expanded = categoryId;
			this.saveSidebarState();
			this.setLeftOverlayOpen(true);
			this.renderLeftSidebar();
			return;
		}
		this.sidebarState.expanded = this.sidebarState.expanded === categoryId ? '' : categoryId;
		this.saveSidebarState();
		if (this.isResponsiveTablet()) {
			this.setLeftOverlayOpen(true);
			this.renderLeftSidebar();
			return;
		}
		if (this.sidebar && this.sidebar.classList.contains('dat-tablet-icon-only')) {
			this.sidebar.classList.remove('dat-tablet-icon-only');
			this.root.classList.remove('dat-tablet-left-collapsed');
			var collapse = this.sidebar.querySelector('.dat-tablet-collapse');
			if (collapse) {
				collapse.innerHTML = this.renderIcon('panel-left-close');
				collapse.title = this.t('collapse');
				collapse.setAttribute('aria-label', this.t('collapse'));
			}
		}
		this.renderLeftSidebar();
	};

	TabletToolbar.prototype.selectTool = function (tool) {
		if (!this.hasTool(tool)) return;
		var info = this.toolCatalog[tool];
		if (info.action) {
			this.app.action(info.action);
		} else {
			this.app.setTool(info.tool || tool);
			this.rememberRecent(tool);
		}
		this.updateSelectedCards();
		this.renderToolSettings();
		if (this.isResponsiveTablet()) this.setLeftOverlayOpen(false);
	};

	TabletToolbar.prototype.toggleFavorite = function (tool) {
		if (!this.hasTool(tool)) return;
		var list = this.sidebarState.favorites;
		var index = list.indexOf(tool);
		if (index === -1) list.unshift(tool);
		else list.splice(index, 1);
		this.sidebarState.favorites = list.slice(0, 8);
		if (!this.sidebarState.favorites.length && this.sidebarState.expanded === 'favorites') {
			this.sidebarState.expanded = 'copper';
		}
		this.saveSidebarState();
		this.renderLeftSidebar();
	};

	TabletToolbar.prototype.rememberRecent = function (tool) {
		if (!this.hasTool(tool)) return;
		var list = this.sidebarState.recent.filter(function (item) { return item !== tool; });
		list.unshift(tool);
		this.sidebarState.recent = list.slice(0, this.maxRecentTools);
		this.saveSidebarState();
	};

	TabletToolbar.prototype.updateSelectedCards = function () {
		if (this.paletteToolGrid) {
			Array.prototype.forEach.call(this.paletteToolGrid.querySelectorAll('[data-palette-tool]'), function (button) {
				var key = button.getAttribute('data-palette-tool');
				var info = this.toolCatalog[key] || {};
				button.classList.toggle('is-selected', !info.action && (key === this.app.tool || info.tool === this.app.tool));
			}, this);
		}
		if (!this.leftBody) return;
		Array.prototype.forEach.call(this.leftBody.querySelectorAll('[data-tool-card]'), function (card) {
			var key = card.getAttribute('data-tool-card');
			var info = this.toolCatalog[key] || {};
			card.classList.toggle('is-selected', !info.action && (key === this.app.tool || info.tool === this.app.tool));
		}, this);
	};

	TabletToolbar.prototype.createSettingField = function (label, input) {
		var row = document.createElement('label');
		row.className = 'dat-tablet-tool-setting-row';
		var text = document.createElement('span');
		text.textContent = label;
		row.appendChild(text);
		row.appendChild(input);
		return row;
	};

	TabletToolbar.prototype.createNumberSetting = function (label, attr, value, min, step) {
		var input = document.createElement('input');
		input.type = 'number';
		input.value = value;
		input.min = min;
		input.step = step;
		input.setAttribute(attr, '');
		return this.createSettingField(label, input);
	};

	TabletToolbar.prototype.createSideSetting = function () {
		var select = document.createElement('select');
		select.setAttribute('data-active-side', '');
		select.innerHTML = '<option value="top">' + this.t('topSide') + '</option><option value="bottom">' + this.t('bottomSide') + '</option>';
		select.value = this.app.activeSide || 'top';
		return this.createSettingField(this.t('activeSide'), select);
	};

	TabletToolbar.prototype.createRouteModeSetting = function () {
		var wrap = document.createElement('div');
		wrap.className = 'dat-tablet-tool-setting-row dat-tablet-route-mode-row';
		var label = document.createElement('span');
		label.textContent = this.t('routeMode');
		var group = document.createElement('div');
		group.className = 'dat-tablet-route-mode';
		group.setAttribute('role', 'group');
		group.setAttribute('aria-label', this.t('routeMode'));
		['free', '45', '90', 'arc'].forEach(function (mode) {
			var button = document.createElement('button');
			button.type = 'button';
			button.textContent = mode === 'free' ? 'Free' : (mode === 'arc' ? 'Arc' : mode + '°');
			button.setAttribute('data-route-mode', mode);
			button.classList.toggle('is-active', (this.app.options.routeMode || '45') === mode);
			button.setAttribute('aria-pressed', (this.app.options.routeMode || '45') === mode ? 'true' : 'false');
			group.appendChild(button);
		}, this);
		wrap.appendChild(label);
		wrap.appendChild(group);
		return wrap;
	};

	TabletToolbar.prototype.renderToolSettings = function () {
		if (!this.toolSettings) return;
		var tool = this.app.tool || 'select';
		var title = document.createElement('div');
		title.className = 'dat-tablet-tool-settings-title';
		title.innerHTML = '<span>' + this.t('toolSettings') + '</span><strong>' + this.getToolLabel(tool) + '</strong>';
		var body = document.createElement('div');
		body.className = 'dat-tablet-tool-settings-body';
		var needsSide = ['track', 'via', 'pad_round', 'pad_rect', 'pad_oval', 'pad_square', 'pad_smd', 'region'].indexOf(tool) !== -1;
		if (needsSide) body.appendChild(this.createSideSetting());
		if (tool === 'track') {
			body.appendChild(this.createRouteModeSetting());
			body.appendChild(this.createNumberSetting(this.t('trackWidth'), 'data-track-width', this.app.options.trackWidth || 0.4, '0.05', '0.05'));
		} else if (tool === 'via') {
			body.appendChild(this.createNumberSetting(this.t('padDiameter'), 'data-pad-dia', this.app.options.padDia || 1.6, '0.1', '0.05'));
			body.appendChild(this.createNumberSetting(this.t('drillDiameter'), 'data-drill-dia', this.app.options.drillDia || 0.8, '0.05', '0.05'));
		} else if (tool === 'pad_round' || tool === 'pad_rect' || tool === 'pad_oval' || tool === 'pad_square' || tool === 'pad_smd') {
			body.appendChild(this.createNumberSetting(this.t('padDiameter'), 'data-pad-dia', this.app.options.padDia || 1.6, '0.1', '0.05'));
		} else if (tool === 'drill') {
			body.appendChild(this.createNumberSetting(this.t('drillDiameter'), 'data-drill-dia', this.app.options.drillDia || 0.8, '0.05', '0.05'));
		} else if (tool === 'slot') {
			body.appendChild(this.createNumberSetting(this.t('drillDiameter'), 'data-drill-dia', this.app.options.drillDia || 0.8, '0.05', '0.05'));
		}
		if (!body.childNodes.length) {
			var empty = document.createElement('div');
			empty.className = 'dat-tablet-tool-settings-empty';
			empty.textContent = this.t('noToolSettings');
			body.appendChild(empty);
		}
		this.toolSettings.textContent = '';
		this.toolSettings.appendChild(title);
		this.toolSettings.appendChild(body);
	};

	TabletToolbar.prototype.buildRightTabs = function () {
		if (!this.rightPanel || this.rightPanel.querySelector('.dat-tablet-right-tabs')) return;
		var original = Array.prototype.slice.call(this.rightPanel.childNodes);
		var tabs = document.createElement('div');
		tabs.className = 'dat-tablet-right-tabs';
		var collapse = document.createElement('button');
		collapse.type = 'button';
		collapse.className = 'dat-tablet-right-collapse';
		collapse.innerHTML = this.renderIcon('panel-left-open');
		collapse.title = 'Collapse panel';
		collapse.setAttribute('aria-label', 'Collapse right panel');
		tabs.appendChild(collapse);
		var body = document.createElement('div');
		body.className = 'dat-tablet-right-body';
		var props = this.createTabPane('properties');
		original.forEach(function (node) { props.appendChild(node); });
		var layers = this.createTabPane('layers');
		var layerList = this.root.querySelector('[data-layer-list]');
		if (layerList) layers.appendChild(layerList);
		var history = this.createInfoPane('History', 'Undo and redo use the existing editor history.');
		var bom = this.createInfoPane('BOM', 'Object counts are generated from the current project.');
		this.historyPane = history;
		this.bomPane = bom;
		var ai = this.createInfoPane('AI', 'Use the AI floating panel for prompt-based commands.');
		body.appendChild(props);
		body.appendChild(layers);
		body.appendChild(history);
		body.appendChild(bom);
		body.appendChild(ai);
		[
			['Properties', 'properties'],
			['Layers', 'layers'],
			['History', 'history'],
			['BOM', 'bom'],
			['AI', 'ai']
		].forEach(function (tab, index) {
			var button = document.createElement('button');
			button.type = 'button';
			button.textContent = tab[0];
			button.setAttribute('data-tablet-tab', tab[1]);
			if (index === 0) button.classList.add('is-active');
			tabs.appendChild(button);
		});
		this.rightPanel.appendChild(tabs);
		this.rightPanel.appendChild(body);
		this.selectTab('properties');
		this.refreshInfoPanes();
		this.root.addEventListener('datpcb:selectionchange', function () {
			this.refreshInfoPanes();
		}.bind(this));
		tabs.addEventListener('click', function (e) {
			var collapseButton = e.target.closest('.dat-tablet-right-collapse');
			if (collapseButton) {
				this.setRightPanelCollapsed(!this.rightPanel.classList.contains('dat-tablet-panel-collapsed'));
				return;
			}
			var tab = e.target.getAttribute('data-tablet-tab');
			if (!tab) return;
			if (tab === 'ai' && this.app.root.querySelector('.dat-tablet-ai-panel')) {
				var aiButton = this.app.root.querySelector('.dat-tablet-ai-button');
				if (aiButton) aiButton.click();
			}
			this.selectTab(tab);
			this.setRightPanelCollapsed(false);
		}.bind(this));
		this.bindRightPanelGestures();
	};

	TabletToolbar.prototype.createTabPane = function (name) {
		var pane = document.createElement('div');
		pane.className = 'dat-tablet-tab-pane';
		pane.setAttribute('data-tablet-pane', name);
		return pane;
	};

	TabletToolbar.prototype.createInfoPane = function (name, text) {
		var pane = this.createTabPane(name.toLowerCase());
		var title = document.createElement('h2');
		title.textContent = name;
		var p = document.createElement('p');
		p.textContent = text;
		var data = document.createElement('div');
		data.className = 'dat-tablet-tab-data';
		pane.appendChild(title);
		pane.appendChild(p);
		pane.appendChild(data);
		return pane;
	};

	TabletToolbar.prototype.refreshInfoPanes = function () {
		if (this.historyPane) {
			var h = this.historyPane.querySelector('.dat-tablet-tab-data');
			if (h) h.innerHTML = '<div>Undo: ' + this.app.history.undoStack.length + '</div><div>Redo: ' + this.app.history.redoStack.length + '</div>';
		}
		if (this.bomPane) {
			var counts = {};
			this.app.state.objects.forEach(function (obj) {
				counts[obj.type] = (counts[obj.type] || 0) + 1;
			});
			var rows = Object.keys(counts).sort().map(function (key) {
				return '<div><span>' + key + '</span><strong>' + counts[key] + '</strong></div>';
			}).join('');
			var b = this.bomPane.querySelector('.dat-tablet-tab-data');
			if (b) b.innerHTML = rows || '<div>No objects</div>';
		}
	};

	TabletToolbar.prototype.selectTab = function (name) {
		if (!this.rightPanel) return;
		Array.prototype.forEach.call(this.rightPanel.querySelectorAll('[data-tablet-tab]'), function (button) {
			button.classList.toggle('is-active', button.getAttribute('data-tablet-tab') === name);
		});
		Array.prototype.forEach.call(this.rightPanel.querySelectorAll('[data-tablet-pane]'), function (pane) {
			pane.hidden = pane.getAttribute('data-tablet-pane') !== name;
		});
	};

	TabletToolbar.prototype.bindRightPanelGestures = function () {
		var startX = 0, startY = 0;
		this.rightPanel.addEventListener('pointerdown', function (e) {
			startX = e.clientX;
			startY = e.clientY;
		});
		this.rightPanel.addEventListener('pointerup', function (e) {
			var dx = e.clientX - startX;
			var dy = Math.abs(e.clientY - startY);
			if (dy > 80) return;
			if (dx > 80) this.setRightPanelCollapsed(true);
			if (dx < -80) this.setRightPanelCollapsed(false);
		}.bind(this));
		this.canvas.addEventListener('pointerdown', function () {
			if (this.app.isTabletMode && this.app.isTabletMode() && this.app.tool !== 'select') {
				this.setRightPanelCollapsed(true);
			}
		}.bind(this));
	};

	TabletToolbar.prototype.bindCanvasDrop = function () {
		this.canvas.addEventListener('dragover', function (e) {
			var types = Array.prototype.slice.call(e.dataTransfer.types || []);
			if (types.indexOf('text/dat-pcb-tool') !== -1) e.preventDefault();
		});
		this.canvas.addEventListener('drop', function (e) {
			var tool = e.dataTransfer.getData('text/dat-pcb-tool');
			if (!tool) return;
			e.preventDefault();
			this.app.setTool(tool);
			var point = this.app.canvas.snap(this.app.canvas.clientToMm(e.clientX, e.clientY));
			this.app.history.push(this.app.state);
			this.app.pointerDown(point, { shiftKey: false, detail: 1 });
			this.app.pointerUp();
		}.bind(this));
	};

	TabletToolbar.prototype.enhanceBottomBar = function () {
		global.setTimeout(function () {
			var fab = this.root.querySelector('.dat-tablet-fab');
			if (!fab || fab.querySelector('[data-fab-action="grid"]')) return;
			var button = document.createElement('button');
			button.type = 'button';
			button.textContent = 'GRD';
			button.title = 'Grid';
			button.setAttribute('aria-label', 'Grid');
			button.setAttribute('data-fab-action', 'grid');
			button.addEventListener('click', function (e) {
				e.stopPropagation();
				this.app.options.gridVisible = !this.app.options.gridVisible;
				this.app.canvas.invalidate();
			}.bind(this));
			fab.appendChild(button);
		}.bind(this), 0);
	};

	global.DATPCBTabletToolbar = TabletToolbar;
})(window, document);
