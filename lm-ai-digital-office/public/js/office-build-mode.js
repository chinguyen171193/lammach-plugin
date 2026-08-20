(function (global) {
	'use strict';

	const ROTATION_STEP = Math.PI / 12;
	const MOVE_STEP = 0.25;

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
			this.assetHost = this.root.querySelector('[data-office-build-assets]');
			this.selectionPanel = this.root.querySelector('[data-office-build-selection]');
			this.selectionName = this.root.querySelector('[data-office-build-selection-name]');
			this.statusElement = this.root.querySelector('[data-office-build-status]');
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
			this.destroyed = false;
			this.frame = 0;
			this.pointer = null;
			this.fetchError = null;
			this.dataPromise = null;
			if (!this.shell || !this.canvasHost) return;
			this.bindPanel();
			this.dataPromise = this.fetchData();
			this.dataPromise.catch(error => {
				this.fetchError = error;
				this.setStatus('Không thể tải dữ liệu xây dựng: ' + error.message);
			});
		}

		available() {
			return Boolean(this.shell && this.canvasHost && global.THREE && global.THREE.GLTFLoader);
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
			this.assetHost.addEventListener('click', event => {
				const button = event.target.closest('[data-build-asset-id]');
				if (button) this.preparePlacement(button.dataset.buildAssetId);
			});
			this.root.querySelectorAll('[data-build-action]').forEach(button => button.addEventListener('click', () => this.runAction(button.dataset.buildAction)));
			const save = this.root.querySelector('[data-build-save]');
			if (save) save.addEventListener('click', () => this.save());
		}

		async activate() {
			if (!this.available()) {
				this.setStatus('Không thể bật Xây dựng vì Three.js/GLTFLoader chưa sẵn sàng.');
				return false;
			}
			if (this.destroyed) return false;
			this.enabled = true;
			this.root.classList.add('is-build-mode');
			this.shell.hidden = false;
			this.setModeButtons('build');
			this.initRenderer();
			try {
				await this.dataPromise;
				if (!this.enabled) return false;
				if (!this.hydrated) await this.hydrate();
				if (!this.enabled) return false;
				this.setStatus(this.pendingAsset ? 'Click xuống sàn để đặt ' + this.pendingAsset.name + '.' : 'Chọn một tài sản, sau đó click xuống sàn để đặt.');
			} catch (error) {
				this.setStatus('Không thể tải dữ liệu xây dựng: ' + error.message);
			}
			this.resize();
			this.startRenderLoop();
			return true;
		}

		deactivate() {
			if (!this.shell) return;
			this.enabled = false;
			this.pendingAsset = null;
			this.root.classList.remove('is-build-mode');
			this.shell.hidden = true;
			this.setModeButtons('activity');
			global.cancelAnimationFrame(this.frame);
			this.frame = 0;
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
			this.camera.lookAt(0, 0, 0);
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
			this.orbit = { target: new THREE.Vector3(0, 0, 0), radius: 13.5, theta: 0.72, phi: 0.86 };
			this.updateCamera();
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
			this.onCanvasDown = event => {
				this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, button: event.button, moved: false };
				if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
			};
			this.onCanvasMove = event => {
				if (!this.pointer || this.pointer.id !== event.pointerId) return;
				const dx = event.clientX - this.pointer.x;
				const dy = event.clientY - this.pointer.y;
				if (Math.abs(event.clientX - this.pointer.startX) + Math.abs(event.clientY - this.pointer.startY) > 4) this.pointer.moved = true;
				if (this.pointer.button === 2 || this.pointer.button === 1) {
					this.orbit.theta -= dx * 0.008;
					this.orbit.phi = Math.max(0.18, Math.min(Math.PI - 0.18, this.orbit.phi + dy * 0.008));
					this.updateCamera();
				}
				this.pointer.x = event.clientX;
				this.pointer.y = event.clientY;
			};
			this.onCanvasUp = event => {
				if (!this.pointer || this.pointer.id !== event.pointerId) return;
				const click = this.pointer.button === 0 && !this.pointer.moved;
				this.pointer = null;
				if (click && this.enabled) this.handleCanvasClick(event);
			};
			this.onCanvasWheel = event => {
				event.preventDefault();
				this.orbit.radius = Math.max(3, Math.min(45, this.orbit.radius + event.deltaY * 0.012));
				this.updateCamera();
			};
			this.onContextMenu = event => event.preventDefault();
			canvas.addEventListener('pointerdown', this.onCanvasDown);
			canvas.addEventListener('pointermove', this.onCanvasMove);
			canvas.addEventListener('pointerup', this.onCanvasUp);
			canvas.addEventListener('pointercancel', this.onCanvasUp);
			canvas.addEventListener('wheel', this.onCanvasWheel, { passive: false });
			canvas.addEventListener('contextmenu', this.onContextMenu);
		}

		updateCamera() {
			if (!this.camera || !this.orbit) return;
			this.camera.position.setFromSphericalCoords(this.orbit.radius, this.orbit.phi, this.orbit.theta).add(this.orbit.target);
			this.camera.lookAt(this.orbit.target);
		}

		resize() {
			if (!this.renderer || !this.camera || !this.canvasHost) return;
			const width = this.canvasHost.clientWidth || 1;
			const height = this.canvasHost.clientHeight || 1;
			this.renderer.setSize(width, height, false);
			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
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
			if (this.selectionPanel) this.selectionPanel.hidden = false;
			if (this.selectionName) this.selectionName.textContent = (root.userData.asset.name || 'Object') + ' · ' + root.userData.instance.instance_id;
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
			if (this.selectionPanel) this.selectionPanel.hidden = true;
			this.updateDebug();
		}

		async runAction(action) {
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
			const set = (selector, value) => {
				const node = this.root.querySelector(selector);
				if (node) node.textContent = value;
			};
			const data = this.selected && this.selected.userData ? this.selected.userData.instance : null;
			set('[data-build-debug-scene]', this.sceneData.scene_id || 'office_default');
			set('[data-build-debug-count]', String(this.instances.size));
			set('[data-build-debug-instance]', data ? data.instance_id : '—');
			set('[data-build-debug-asset]', data ? data.asset_id : '—');
			set('[data-build-debug-position]', data ? formatVector(data.position) : '—');
			set('[data-build-debug-rotation]', data ? formatVector(data.rotation) : '—');
			set('[data-build-debug-scale]', data ? formatVector(data.scale) : '—');
			set('[data-build-debug-cache]', this.modelCache.size + ' mô hình');
		}

		startRenderLoop() {
			if (this.frame || !this.renderer) return;
			const tick = () => {
				if (!this.enabled || this.destroyed) {
					this.frame = 0;
					return;
				}
				this.frame = global.requestAnimationFrame(tick);
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
				canvas.removeEventListener('pointerdown', this.onCanvasDown);
				canvas.removeEventListener('pointermove', this.onCanvasMove);
				canvas.removeEventListener('pointerup', this.onCanvasUp);
				canvas.removeEventListener('pointercancel', this.onCanvasUp);
				canvas.removeEventListener('wheel', this.onCanvasWheel);
				canvas.removeEventListener('contextmenu', this.onContextMenu);
				this.renderer.dispose();
			}
			this.clearSelection();
			this.instances.forEach(root => this.scene && this.scene.remove(root));
			this.instances.clear();
		}
	}

	global.LMAIOfficeBuildMode = OfficeBuildMode;
})(window);
