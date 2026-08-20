(function (global) {
	'use strict';

	const ROTATION_STEP = Math.PI / 12;
	const MOVE_STEP = 0.25;
	const TAP_MAX_DURATION = 420;
	const TAP_DISTANCE_MOUSE = 5;
	const TAP_DISTANCE_TOUCH = 8;

	function number(value, fallback) {
		return Number.isFinite(Number(value)) ? Number(value) : fallback;
	}

	function vector(value, fallback) {
		const base = fallback || 0;
		return {
			x: number(value && value.x, base),
			y: number(value && value.y, base),
			z: number(value && value.z, base),
		};
	}

	function cloneInstance(instance) {
		return {
			instance_id: String(instance.instance_id || ''),
			asset_id: String(instance.asset_id || ''),
			position: vector(instance.position, 0),
			rotation: vector(instance.rotation, 0),
			scale: vector(instance.scale, 1),
		};
	}

	function makeInstanceId() {
		if (global.crypto && global.crypto.randomUUID) return 'obj_' + global.crypto.randomUUID().replace(/-/g, '');
		return 'obj_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
	}

	function formatVector(value) {
		return [value.x, value.y, value.z].map(item => Number(item).toFixed(2)).join(', ');
	}

	function now() {
		return global.performance && typeof global.performance.now === 'function' ? global.performance.now() : Date.now();
	}

	function apiError(response, fallback) {
		return response.json().then(body => {
			throw new Error(body && body.message ? body.message : fallback);
		}).catch(error => {
			if (error && error.message && error.message !== fallback) throw error;
			throw new Error(fallback);
		});
	}

	class OfficeBuildMode {
		constructor(engine) {
			this.engine = engine;
			this.root = engine.root;
			this.config = engine.config;
			this.shell = this.root.querySelector('[data-office-build]');
			this.canvasHost = this.root.querySelector('[data-office-build-canvas]');
			this.panel = this.root.querySelector('[data-office-build-panel]');
			this.assetHost = this.root.querySelector('[data-office-build-assets]');
			this.selectionPanel = this.root.querySelector('[data-office-build-selection]');
			this.selectionName = this.root.querySelector('[data-office-build-selection-name]');
			this.selectionEmpty = this.root.querySelector('[data-office-build-object-empty], .lm-ai-office__build-no-selection');
			this.statusElement = this.root.querySelector('[data-office-build-status]');
			this.debugPanel = this.root.querySelector('[data-office-build-debug]');
			this.assetFilter = 'ALL';
			this.assets = [];
			this.assetsById = new Map();
			this.modelCache = new Map();
			this.instances = new Map();
			this.sceneData = { scene_id: 'office_default', name: 'Văn phòng', objects: [] };
			this.selected = null;
			this.selectionHelper = null;
			this.pendingAsset = null;
			this.hydrated = false;
			this.enabled = false;
			this.mode = 'inactive';
			this.panelState = this.defaultPanelState();
			this.panelTab = 'library';
			this.destroyed = false;
			this.frame = 0;
			this.inputPointers = new Map();
			this.inputState = { input: '—', touches: 0, gesture: '—' };
			this.twoFingerStart = null;
			this.fetchError = null;
			this.dataPromise = null;
			if (!this.shell || !this.canvasHost) return;
			this.bindPanel();
			this.setPanelState(this.panelState);
			this.setPanelTab(this.panelTab);
			this.updateObjectTab();
			this.dataPromise = this.fetchData();
			this.dataPromise.catch(error => {
				this.fetchError = error;
				this.setStatus('Không thể tải dữ liệu xây dựng: ' + error.message);
			});
		}

		available() {
			return Boolean(this.shell && this.canvasHost && global.THREE && global.THREE.GLTFLoader && global.THREE.OrbitControls);
		}

		defaultPanelState() {
			return global.matchMedia && global.matchMedia('(max-width: 1280px)').matches ? 'compact' : 'expanded';
		}

		async fetchData() {
			const base = (global.LM_AI_OFFICE || {}).restUrl;
			if (!base) throw new Error('Không có địa chỉ REST API.');
			const [assetsResponse, sceneResponse] = await Promise.all([fetch(base + 'assets'), fetch(base + 'scene')]);
			if (!assetsResponse.ok) await apiError(assetsResponse, 'Không thể tải Thư viện tài sản.');
			if (!sceneResponse.ok) await apiError(sceneResponse, 'Không thể tải bố trí văn phòng.');
			const assets = await assetsResponse.json();
			const scene = await sceneResponse.json();
			this.assets = Array.isArray(assets) ? assets : [];
			this.assetsById = new Map(this.assets.map(asset => [asset.id, asset]));
			this.sceneData = scene && Array.isArray(scene.objects) ? scene : { scene_id: 'office_default', name: 'Văn phòng', objects: [] };
			this.renderAssetPanel();
			this.updateDebug();
			return { assets: this.assets, scene: this.sceneData };
		}

		bindPanel() {
			this.root.querySelectorAll('[data-build-category]').forEach(button => button.addEventListener('click', () => {
				this.assetFilter = button.dataset.buildCategory || 'ALL';
				this.root.querySelectorAll('[data-build-category]').forEach(item => item.classList.toggle('is-active', item === button));
				this.renderAssetPanel();
			}));
			if (this.assetHost) this.assetHost.addEventListener('click', event => {
				const button = event.target.closest('[data-build-asset-id]');
				if (button) this.preparePlacement(button.dataset.buildAssetId);
			});
			this.root.querySelectorAll('[data-build-action]').forEach(button => button.addEventListener('click', () => this.runAction(button.dataset.buildAction)));
			const save = this.root.querySelector('[data-build-save]');
			if (save) save.addEventListener('click', () => this.save());
			this.root.querySelectorAll('[data-build-panel-state]').forEach(button => button.addEventListener('click', () => this.setPanelState(button.dataset.buildPanelState)));
			this.root.querySelectorAll('[data-build-panel-tab]').forEach(button => button.addEventListener('click', () => this.setPanelTab(button.dataset.buildPanelTab)));
		}

		setPanelState(state) {
			const valid = ['expanded', 'compact', 'collapsed'];
			this.panelState = valid.indexOf(state) !== -1 ? state : this.defaultPanelState();
			if (!this.panel) return;
			this.panel.dataset.panelState = this.panelState;
			valid.forEach(value => this.panel.classList.toggle('is-' + value, value === this.panelState));
			this.root.querySelectorAll('[data-build-panel-state]').forEach(button => {
				const active = button.dataset.buildPanelState === this.panelState;
				button.classList.toggle('is-active', active);
				button.setAttribute('aria-pressed', active ? 'true' : 'false');
			});
		}

		setPanelTab(tab) {
			this.panelTab = tab === 'object' ? 'object' : 'library';
			this.root.querySelectorAll('[data-build-panel-tab]').forEach(button => {
				const active = button.dataset.buildPanelTab === this.panelTab;
				button.classList.toggle('is-active', active);
				button.setAttribute('aria-selected', active ? 'true' : 'false');
			});
			this.root.querySelectorAll('[data-build-panel-pane]').forEach(pane => {
				const active = pane.dataset.buildPanelPane === this.panelTab;
				pane.hidden = !active;
				pane.classList.toggle('is-active', active);
			});
			this.updateObjectTab();
		}

		updateObjectTab() {
			const hasSelection = Boolean(this.selected);
			if (this.selectionPanel) this.selectionPanel.hidden = !hasSelection;
			if (this.selectionEmpty) this.selectionEmpty.hidden = hasSelection;
		}

		async activate() {
			return this.activateMode('build');
		}

		async activateLive() {
			return this.activateMode('live');
		}

		async activateMode(mode) {
			if (!this.available()) {
				this.setStatus('Không thể bật scene 3D vì Three.js/GLTFLoader/OrbitControls chưa sẵn sàng.');
				return false;
			}
			if (this.destroyed) return false;
			this.enabled = true;
			this.mode = mode === 'live' ? 'live' : 'build';
			this.root.classList.toggle('is-build-mode', this.mode === 'build');
			this.root.classList.toggle('is-live-mode', this.mode === 'live');
			this.shell.hidden = false;
			this.shell.dataset.officeSceneMode = this.mode;
			this.setModeButtons(this.mode === 'build' ? 'build' : 'activity');
			this.initRenderer();
			if (this.controls) this.controls.enabled = true;
			try {
				await this.dataPromise;
				if (!this.enabled || this.mode !== mode) return false;
				if (!this.hydrated) await this.hydrate();
				if (!this.enabled || this.mode !== mode) return false;
				if (this.mode === 'build') {
					this.setStatus(this.pendingAsset ? 'Click xuống sàn để đặt ' + this.pendingAsset.name + '.' : 'Chọn một tài sản, sau đó click xuống sàn để đặt.');
				} else {
					this.pendingAsset = null;
					this.clearSelection();
				}
			} catch (error) {
				this.setStatus('Không thể tải scene 3D: ' + error.message);
			}
			this.resize();
			this.startRenderLoop();
			this.notifyModeChange();
			return true;
		}

		deactivate() {
			if (!this.shell) return;
			this.enabled = false;
			this.mode = 'inactive';
			this.pendingAsset = null;
			this.clearInputPointers();
			if (this.controls) this.controls.enabled = false;
			this.root.classList.remove('is-build-mode', 'is-live-mode');
			this.shell.hidden = true;
			this.setModeButtons('activity');
			global.cancelAnimationFrame(this.frame);
			this.frame = 0;
			this.notifyModeChange();
		}

		deactivateLive() {
			if (this.mode === 'live') this.deactivate();
		}

		notifyModeChange() {
			if (!this.root || typeof global.CustomEvent !== 'function') return;
			this.root.dispatchEvent(new global.CustomEvent('lm-ai-office:scene-mode', {
				detail: { mode: this.mode, objectCount: this.instances.size, buildMode: this },
			}));
		}

		setModeButtons(mode) {
			this.root.querySelectorAll('[data-office-mode]').forEach(button => button.classList.toggle('is-active', button.dataset.officeMode === mode));
		}

		initRenderer() {
			if (this.renderer || !this.available()) return;
			const THREE = global.THREE;
			this.scene = new THREE.Scene();
			this.scene.background = new THREE.Color(0x07131f);
			this.camera = new THREE.PerspectiveCamera(48, 1, 0.01, 500);
			this.camera.position.set(7, 8, 9);
			this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
			this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
			this.renderer.outputEncoding = THREE.sRGBEncoding;
			this.renderer.shadowMap.enabled = true;
			this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			this.renderer.domElement.className = 'lm-ai-office__build-webgl';
			this.canvasHost.appendChild(this.renderer.domElement);
			this.scene.add(new THREE.HemisphereLight(0xd6f5ff, 0x162636, 2.4));
			const key = new THREE.DirectionalLight(0xffffff, 2.4);
			key.position.set(7, 10, 5);
			key.castShadow = true;
			key.shadow.mapSize.set(1024, 1024);
			this.scene.add(key);
			const fill = new THREE.DirectionalLight(0x6acfff, 0.85);
			fill.position.set(-6, 4, -5);
			this.scene.add(fill);
			this.floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshStandardMaterial({ color: 0x163246, roughness: 0.92, metalness: 0.03 }));
			this.floor.name = 'LMOfficeBuildFloor';
			this.floor.rotation.x = -Math.PI / 2;
			this.floor.receiveShadow = true;
			this.scene.add(this.floor, new THREE.GridHelper(36, 36, 0x356b85, 0x234756));
			this.raycaster = new THREE.Raycaster();
			this.pointerNdc = new THREE.Vector2();
			this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
			this.controls.target.set(0, 0, 0);
			this.controls.enableRotate = true;
			this.controls.enableZoom = true;
			this.controls.enablePan = true;
			this.controls.enableDamping = true;
			this.controls.dampingFactor = 0.08;
			this.controls.minDistance = 3;
			this.controls.maxDistance = 45;
			this.controls.minPolarAngle = 0.18;
			this.controls.maxPolarAngle = Math.PI / 2 - 0.08;
			this.controls.screenSpacePanning = false;
			this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
			this.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
			this.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
			this.controls.touches.ONE = THREE.TOUCH.ROTATE;
			this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
			if (this.debugPanel) {
				this.onControlsChange = () => this.updateDebug();
				this.controls.addEventListener('change', this.onControlsChange);
			}
			this.controls.update();
			this.bindCanvas();
			if ('ResizeObserver' in global) {
				this.resizeObserver = new ResizeObserver(() => this.resize());
				this.resizeObserver.observe(this.canvasHost);
			} else {
				this.resizeHandler = () => this.resize();
				global.addEventListener('resize', this.resizeHandler);
			}
		}

		bindCanvas() {
			const canvas = this.renderer.domElement;
			// OrbitControls owns camera movement. These Pointer Events only decide whether a
			// release is a safe Build Mode tap, so camera gestures can never place an asset.
			this.onCanvasPointerDown = event => this.startInputPointer(event);
			this.onCanvasPointerMove = event => this.moveInputPointer(event);
			this.onCanvasPointerUp = event => this.finishInputPointer(event, false);
			this.onCanvasPointerCancel = event => this.finishInputPointer(event, true);
			this.onCanvasPointerLeave = event => {
				if (event.pointerType !== 'touch') this.finishInputPointer(event, true);
			};
			this.onCanvasLostPointerCapture = event => this.finishInputPointer(event, true);
			this.onCanvasTouchStart = event => {
				if (!this.enabled || !event.touches || event.touches.length < 2) return;
				this.markMultiTouchGesture();
				this.setInputState('Touch', 'PAN', event.touches.length);
			};
			canvas.addEventListener('pointerdown', this.onCanvasPointerDown);
			canvas.addEventListener('pointermove', this.onCanvasPointerMove);
			canvas.addEventListener('pointerup', this.onCanvasPointerUp);
			canvas.addEventListener('pointercancel', this.onCanvasPointerCancel);
			canvas.addEventListener('pointerleave', this.onCanvasPointerLeave);
			canvas.addEventListener('lostpointercapture', this.onCanvasLostPointerCapture);
			canvas.addEventListener('touchstart', this.onCanvasTouchStart, { passive: true });
		}

		inputLabel(pointerType) {
			if (pointerType === 'touch') return 'Touch';
			if (pointerType === 'pen') return 'Pen';
			return 'Mouse';
		}

		activeTouchPointers() {
			return Array.from(this.inputPointers.values()).filter(pointer => pointer.pointerType === 'touch');
		}

		setInputState(input, gesture, touchCount) {
			this.inputState = {
				input: input || '—',
				touches: Number.isFinite(touchCount) ? touchCount : this.activeTouchPointers().length,
				gesture: gesture || '—',
			};
			this.updateDebug();
		}

		getTwoFingerMetrics(touches) {
			if (!touches || touches.length < 2) return null;
			const first = touches[0];
			const second = touches[1];
			const x = (first.lastX + second.lastX) / 2;
			const y = (first.lastY + second.lastY) / 2;
			return {
				x,
				y,
				distance: Math.hypot(first.lastX - second.lastX, first.lastY - second.lastY),
			};
		}

		markMultiTouchGesture() {
			const touches = this.activeTouchPointers();
			touches.forEach(pointer => { pointer.multiTouch = true; });
			if (touches.length >= 2 && !this.twoFingerStart) this.twoFingerStart = this.getTwoFingerMetrics(touches);
		}

		updateTwoFingerGesture() {
			const touches = this.activeTouchPointers();
			this.markMultiTouchGesture();
			const current = this.getTwoFingerMetrics(touches);
			const start = this.twoFingerStart || current;
			let gesture = 'PAN';
			if (current && start) {
				const pinchDistance = Math.abs(current.distance - start.distance);
				const panDistance = Math.hypot(current.x - start.x, current.y - start.y);
				if (pinchDistance > 4 && pinchDistance >= panDistance) gesture = 'PINCH';
				else if (panDistance > 4) gesture = 'PAN';
			}
			this.setInputState('Touch', gesture, touches.length);
		}

		startInputPointer(event) {
			if (!this.enabled) return;
			const pointer = {
				id: event.pointerId,
				pointerType: event.pointerType || 'mouse',
				button: event.button,
				startX: event.clientX,
				startY: event.clientY,
				lastX: event.clientX,
				lastY: event.clientY,
				startedAt: now(),
				moved: false,
				multiTouch: false,
			};
			this.inputPointers.set(event.pointerId, pointer);
			const touchCount = this.activeTouchPointers().length;
			if (pointer.pointerType === 'touch' && touchCount >= 2) {
				this.markMultiTouchGesture();
				this.updateTwoFingerGesture();
				return;
			}
			const gesture = pointer.pointerType === 'touch' ? 'TAP' : (pointer.button === 2 ? 'PAN' : pointer.button === 1 ? 'ZOOM' : 'TAP');
			this.setInputState(this.inputLabel(pointer.pointerType), gesture, touchCount);
		}

		moveInputPointer(event) {
			const pointer = this.inputPointers.get(event.pointerId);
			if (!pointer) return;
			pointer.lastX = event.clientX;
			pointer.lastY = event.clientY;
			const threshold = pointer.pointerType === 'touch' ? TAP_DISTANCE_TOUCH : TAP_DISTANCE_MOUSE;
			if (Math.hypot(pointer.lastX - pointer.startX, pointer.lastY - pointer.startY) > threshold) pointer.moved = true;
			const touchCount = this.activeTouchPointers().length;
			if (touchCount >= 2) {
				this.updateTwoFingerGesture();
				return;
			}
			const gesture = pointer.pointerType === 'touch' ? (pointer.moved ? 'ROTATE' : 'TAP') : (pointer.button === 2 ? 'PAN' : pointer.button === 1 ? 'ZOOM' : pointer.moved ? 'ROTATE' : 'TAP');
			this.setInputState(this.inputLabel(pointer.pointerType), gesture, touchCount);
		}

		finishInputPointer(event, cancelled) {
			const pointer = this.inputPointers.get(event.pointerId);
			if (!pointer) return;
			if (!cancelled) {
				pointer.lastX = event.clientX;
				pointer.lastY = event.clientY;
				const threshold = pointer.pointerType === 'touch' ? TAP_DISTANCE_TOUCH : TAP_DISTANCE_MOUSE;
				if (Math.hypot(pointer.lastX - pointer.startX, pointer.lastY - pointer.startY) > threshold) pointer.moved = true;
			}
			const touchCountBefore = this.activeTouchPointers().length;
			if (pointer.pointerType === 'touch' && touchCountBefore >= 2) this.markMultiTouchGesture();
			const isTap = !cancelled && pointer.button === 0 && !pointer.moved && !pointer.multiTouch && now() - pointer.startedAt <= TAP_MAX_DURATION && (pointer.pointerType !== 'touch' || touchCountBefore === 1);
			this.inputPointers.delete(event.pointerId);
			const remainingTouches = this.activeTouchPointers();
			if (remainingTouches.length) remainingTouches.forEach(item => { item.multiTouch = true; });
			if (remainingTouches.length < 2) this.twoFingerStart = null;
			const gesture = isTap ? 'TAP' : (pointer.pointerType === 'touch' && touchCountBefore >= 2 ? 'PAN' : pointer.moved ? (pointer.button === 2 ? 'PAN' : pointer.button === 1 ? 'ZOOM' : 'ROTATE') : '—');
			this.setInputState(this.inputLabel(pointer.pointerType), gesture, remainingTouches.length);
			if (isTap && this.enabled && this.mode === 'build') this.handleCanvasClick(event);
		}

		clearInputPointers() {
			this.inputPointers.clear();
			this.twoFingerStart = null;
			this.inputState = { input: '—', touches: 0, gesture: '—' };
			this.updateDebug();
		}

		updateCamera() {
			if (this.controls) this.controls.update();
		}

		resize() {
			if (!this.renderer || !this.camera || !this.canvasHost) return;
			const width = this.canvasHost.clientWidth || 1;
			const height = this.canvasHost.clientHeight || 1;
			this.renderer.setSize(width, height, false);
			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
			this.updateCamera();
		}

		async hydrate() {
			if (this.hydrated) return;
			const objects = Array.isArray(this.sceneData.objects) ? this.sceneData.objects : [];
			const results = await Promise.all(objects.map(instance => this.addInstance(instance, false).catch(error => ({ error, instance }))));
			const failures = results.filter(result => result && result.error);
			this.hydrated = true;
			if (failures.length) this.setStatus('Đã tải văn phòng, nhưng ' + failures.length + ' object có lỗi model.');
			this.updateDebug();
		}

		async preparePlacement(assetId) {
			if (this.mode !== 'build') return;
			const asset = this.assetsById.get(assetId);
			if (!asset || !asset.model || !asset.model.available || !asset.model.url) {
				this.setStatus('Tài sản này có lỗi mô hình và chưa thể đặt.');
				return;
			}
			try {
				this.setStatus('Đang chuẩn bị ' + asset.name + '…');
				await this.loadModel(asset);
				this.pendingAsset = asset;
				this.assetHost.querySelectorAll('[data-build-asset-id]').forEach(button => button.classList.toggle('is-ready-to-place', button.dataset.buildAssetId === assetId));
				this.setStatus('Đã chọn ' + asset.name + '. Click xuống sàn để đặt.');
				this.updateDebug();
			} catch (error) {
				this.setStatus('Lỗi mô hình: ' + error.message);
			}
		}

		handleCanvasClick(event) {
			this.setPointer(event);
			if (this.pendingAsset) {
				const hit = this.floorIntersection();
				if (hit) this.placePending(hit.point);
				return;
			}
			const intersections = this.raycaster.intersectObjects(Array.from(this.instances.values()), true);
			if (!intersections.length) {
				this.clearSelection();
				return;
			}
			let object = intersections[0].object;
			while (object && !(object.userData && object.userData.lmBuildInstance)) object = object.parent;
			if (object) this.select(object);
		}

		setPointer(event) {
			const rect = this.renderer.domElement.getBoundingClientRect();
			this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			this.pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
			this.raycaster.setFromCamera(this.pointerNdc, this.camera);
		}

		floorIntersection() {
			const intersections = this.raycaster.intersectObject(this.floor, false);
			return intersections.length ? intersections[0] : null;
		}

		async placePending(point) {
			const asset = this.pendingAsset;
			if (!asset) return;
			const defaults = asset.transformDefaults || {};
			const instance = {
				instance_id: makeInstanceId(),
				asset_id: asset.id,
				position: { x: point.x, y: point.y + number(defaults.floorOffset, 0), z: point.z },
				rotation: { x: 0, y: 0, z: 0 },
				scale: { x: 1, y: 1, z: 1 },
			};
			try {
				const root = await this.addInstance(instance, true);
				this.select(root);
				this.setStatus('Đã đặt ' + asset.name + '. Bạn có thể di chuyển, xoay, nhân bản hoặc xóa.');
			} catch (error) {
				this.setStatus('Lỗi mô hình: ' + error.message);
			}
		}

		async addInstance(rawInstance, selectAfter) {
			const instance = cloneInstance(rawInstance);
			const asset = this.assetsById.get(instance.asset_id);
			if (!asset) throw new Error('Không tìm thấy asset_id ' + instance.asset_id + '.');
			if (this.instances.has(instance.instance_id)) return this.instances.get(instance.instance_id);
			const gltf = await this.loadModel(asset);
			if (this.destroyed || !this.scene) throw new Error('Build Mode đã được đóng.');
			const THREE = global.THREE;
			const root = new THREE.Group();
			root.name = 'LMOfficeAsset_' + instance.instance_id;
			root.userData.lmBuildInstance = true;
			root.userData.instance = instance;
			root.userData.asset = asset;
			const model = gltf.scene.clone(true);
			model.traverse(object => {
				if (object.isMesh) {
					object.castShadow = true;
					object.receiveShadow = true;
				}
			});
			root.add(model);
			this.applyTransform(root);
			this.scene.add(root);
			this.instances.set(instance.instance_id, root);
			if (selectAfter) this.select(root);
			this.updateDebug();
			return root;
		}

		loadModel(asset) {
			if (this.modelCache.has(asset.id)) return this.modelCache.get(asset.id);
			if (!asset.model || asset.model.format !== 'glb' || !asset.model.url) return Promise.reject(new Error('Tài sản không có tệp GLB hợp lệ.'));
			const promise = new Promise((resolve, reject) => {
				new global.THREE.GLTFLoader().load(asset.model.url, resolve, undefined, reject);
			});
			this.modelCache.set(asset.id, promise);
			promise.catch(() => this.modelCache.delete(asset.id));
			this.updateDebug();
			return promise;
		}

		applyTransform(root) {
			const data = root.userData.instance;
			const asset = root.userData.asset || {};
			const defaults = asset.transformDefaults || {};
			const baseScale = Math.max(0.01, number(defaults.scale, 1));
			root.position.set(data.position.x, data.position.y, data.position.z);
			root.rotation.set(data.rotation.x, number(defaults.rotationY, 0) + data.rotation.y, data.rotation.z);
			root.scale.set(baseScale * data.scale.x, baseScale * data.scale.y, baseScale * data.scale.z);
			root.updateMatrixWorld(true);
		}

		select(root) {
			if (!root || !root.userData || !root.userData.lmBuildInstance) return;
			this.clearSelection();
			this.selected = root;
			this.selectionHelper = new global.THREE.BoxHelper(root, 0x65ecff);
			this.scene.add(this.selectionHelper);
			if (this.selectionName) this.selectionName.textContent = (root.userData.asset.name || 'Object') + ' · ' + root.userData.instance.instance_id;
			this.updateObjectTab();
			if (this.mode === 'build') this.setPanelTab('object');
			this.updateDebug();
		}

		clearSelection() {
			if (this.selectionHelper) {
				this.scene.remove(this.selectionHelper);
				if (this.selectionHelper.geometry) this.selectionHelper.geometry.dispose();
				if (this.selectionHelper.material) this.selectionHelper.material.dispose();
			}
			this.selectionHelper = null;
			this.selected = null;
			this.updateObjectTab();
			this.updateDebug();
		}

		async runAction(action) {
			if (this.mode !== 'build') return;
			if (!this.selected) {
				this.setStatus('Hãy chọn một object đã đặt trước.');
				return;
			}
			const data = this.selected.userData.instance;
			if (action === 'move-forward') data.position.z -= MOVE_STEP;
			if (action === 'move-back') data.position.z += MOVE_STEP;
			if (action === 'move-left') data.position.x -= MOVE_STEP;
			if (action === 'move-right') data.position.x += MOVE_STEP;
			if (action === 'rotate-left') data.rotation.y -= ROTATION_STEP;
			if (action === 'rotate-right') data.rotation.y += ROTATION_STEP;
			if (action.indexOf('move-') === 0 || action.indexOf('rotate-') === 0) {
				this.applyTransform(this.selected);
				this.updateDebug();
				return;
			}
			if (action === 'duplicate') {
				const copy = cloneInstance(data);
				copy.instance_id = makeInstanceId();
				copy.position.x += 0.45;
				copy.position.z += 0.45;
				try {
					const root = await this.addInstance(copy, true);
					this.select(root);
					this.setStatus('Đã nhân bản object.');
				} catch (error) {
					this.setStatus('Không thể nhân bản object: ' + error.message);
				}
			}
			if (action === 'delete') {
				const id = data.instance_id;
				this.scene.remove(this.selected);
				this.instances.delete(id);
				this.clearSelection();
				this.setStatus('Đã xóa object khỏi văn phòng. Tài sản gốc vẫn ở Thư viện.');
			}
		}

		serializeScene() {
			const objects = Array.from(this.instances.values()).map(root => cloneInstance(root.userData.instance));
			return {
				scene_id: this.sceneData.scene_id || 'office_default',
				name: this.sceneData.name || 'Văn phòng',
				objects,
			};
		}

		async save() {
			const base = (global.LM_AI_OFFICE || {}).restUrl;
			const nonce = (global.LM_AI_OFFICE || {}).nonce;
			const button = this.root.querySelector('[data-build-save]');
			if (!base || !nonce) {
				this.setStatus('Bạn cần đăng nhập quản trị để lưu văn phòng.');
				return;
			}
			if (button) button.disabled = true;
			this.setStatus('Đang lưu văn phòng…');
			try {
				const response = await fetch(base + 'scene', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
					body: JSON.stringify(this.serializeScene()),
				});
				if (!response.ok) await apiError(response, 'Không thể lưu văn phòng.');
				this.sceneData = await response.json();
				this.setStatus('Đã lưu văn phòng. Sau khi tải lại, các object sẽ được khôi phục.');
				this.updateDebug();
			} catch (error) {
				this.setStatus('Không thể lưu văn phòng: ' + error.message);
			} finally {
				if (button) button.disabled = false;
			}
		}

		renderAssetPanel() {
			if (!this.assetHost) return;
			this.assetHost.replaceChildren();
			const assets = this.assets.filter(asset => this.assetFilter === 'ALL' || asset.category === this.assetFilter);
			if (!assets.length) {
				const empty = document.createElement('p');
				empty.className = 'lm-ai-office__build-empty';
				empty.textContent = this.assets.length ? 'Không có tài sản trong loại này.' : 'Chưa có tài sản.';
				this.assetHost.appendChild(empty);
				return;
			}
			assets.forEach(asset => {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'lm-ai-office__build-asset';
				button.dataset.buildAssetId = asset.id;
				button.disabled = !asset.model || !asset.model.available;
				if (this.pendingAsset && this.pendingAsset.id === asset.id) button.classList.add('is-ready-to-place');
				const thumb = document.createElement('span');
				thumb.className = 'lm-ai-office__build-asset-thumb';
				if (asset.thumbnail && asset.thumbnail.url) {
					const image = document.createElement('img');
					image.src = asset.thumbnail.url;
					image.alt = '';
					thumb.appendChild(image);
				} else {
					thumb.textContent = 'GLB';
				}
				const text = document.createElement('span');
				const title = document.createElement('strong');
				title.textContent = asset.name || 'Tài sản';
				const category = document.createElement('small');
				category.textContent = asset.model && asset.model.available ? (asset.categoryLabel || asset.category || '') : 'Lỗi mô hình';
				text.append(title, category);
				button.append(thumb, text);
				this.assetHost.appendChild(button);
			});
		}

		setStatus(message) {
			if (this.statusElement) this.statusElement.textContent = message;
		}

		updateDebug() {
			if (!this.debugPanel) return;
			const set = (selector, value) => {
				const node = this.root.querySelector(selector);
				if (node) node.textContent = value;
			};
			const data = this.selected && this.selected.userData ? this.selected.userData.instance : null;
			const controls = this.controls;
			const input = this.inputState || {};
			const cameraDistance = controls && this.camera ? this.camera.position.distanceTo(controls.target) : null;
			set('[data-build-debug-scene]', this.sceneData.scene_id || 'office_default');
			set('[data-build-debug-count]', String(this.instances.size));
			set('[data-build-debug-instance]', data ? data.instance_id : '—');
			set('[data-build-debug-asset]', data ? data.asset_id : '—');
			set('[data-build-debug-position]', data ? formatVector(data.position) : '—');
			set('[data-build-debug-rotation]', data ? formatVector(data.rotation) : '—');
			set('[data-build-debug-scale]', data ? formatVector(data.scale) : '—');
			set('[data-build-debug-cache]', this.modelCache.size + ' mô hình');
			set('[data-build-debug-input]', input.input || '—');
			set('[data-build-debug-touches]', String(input.touches || 0));
			set('[data-build-debug-gesture]', input.gesture || '—');
			set('[data-build-debug-distance]', cameraDistance === null ? '—' : cameraDistance.toFixed(2) + ' m');
			set('[data-build-debug-target]', controls ? formatVector(controls.target) : '—');
		}

		startRenderLoop() {
			if (this.frame || !this.renderer) return;
			const tick = () => {
				if (!this.enabled || this.destroyed) {
					this.frame = 0;
					return;
				}
				this.frame = global.requestAnimationFrame(tick);
				if (this.controls) this.controls.update();
				if (this.selectionHelper && this.selected) this.selectionHelper.update();
				this.renderer.render(this.scene, this.camera);
			};
			this.frame = global.requestAnimationFrame(tick);
		}

		destroy() {
			this.destroyed = true;
			this.deactivate();
			if (this.resizeObserver) this.resizeObserver.disconnect();
			if (this.resizeHandler) global.removeEventListener('resize', this.resizeHandler);
			if (this.renderer) {
				const canvas = this.renderer.domElement;
				canvas.removeEventListener('pointerdown', this.onCanvasPointerDown);
				canvas.removeEventListener('pointermove', this.onCanvasPointerMove);
				canvas.removeEventListener('pointerup', this.onCanvasPointerUp);
				canvas.removeEventListener('pointercancel', this.onCanvasPointerCancel);
				canvas.removeEventListener('pointerleave', this.onCanvasPointerLeave);
				canvas.removeEventListener('lostpointercapture', this.onCanvasLostPointerCapture);
				canvas.removeEventListener('touchstart', this.onCanvasTouchStart);
				if (this.controls) {
					if (this.onControlsChange) this.controls.removeEventListener('change', this.onControlsChange);
					this.controls.dispose();
					this.controls = null;
				}
				this.renderer.dispose();
			}
			this.clearSelection();
			this.instances.forEach(root => this.scene && this.scene.remove(root));
			this.instances.clear();
		}
	}

	global.LMAIOfficeBuildMode = OfficeBuildMode;
})(window);
