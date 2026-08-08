(function (global) {
	'use strict';

	// Verified by parsing public/assets/characters/employee_001/animations.fbx.
	// Keep this explicit so a changed source file fails visibly instead of silently
	// selecting a similarly named action such as Idle_Gun_Shoot.
	const ANIMATION_MAP = Object.freeze({
		IDLE: 'CharacterArmature|Idle',
		WALKING: 'CharacterArmature|Walk'
	});

	function versionedUrl(url, version) {
		return version ? url + (url.indexOf('?') === -1 ? '?' : '&') + 'ver=' + encodeURIComponent(version) : url;
	}

	function animationMapFrom(clips) {
		const availableNames = new Set(clips.map(clip => clip.name));
		return Object.freeze({
			IDLE: availableNames.has(ANIMATION_MAP.IDLE) ? ANIMATION_MAP.IDLE : '',
			WALKING: availableNames.has(ANIMATION_MAP.WALKING) ? ANIMATION_MAP.WALKING : ''
		});
	}

	class NPCOrbitCamera {
		constructor(camera, element) {
			this.camera = camera;
			this.element = element;
			this.target = new global.THREE.Vector3(0, 0.65, 0);
			this.radius = 7.2;
			this.theta = 0.7;
			this.phi = 1.08;
			this.pointer = null;
			this.bind();
			this.update();
		}

		bind() {
			this.onPointerDown = event => {
				this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, button: event.button };
				this.element.setPointerCapture(event.pointerId);
			};
			this.onPointerMove = event => {
				if (!this.pointer || this.pointer.id !== event.pointerId) return;
				const dx = event.clientX - this.pointer.x;
				const dy = event.clientY - this.pointer.y;
				this.pointer.x = event.clientX;
				this.pointer.y = event.clientY;
				if (this.pointer.button === 2) this.pan(dx, dy);
				else {
					this.theta -= dx * 0.008;
					this.phi = Math.max(0.18, Math.min(Math.PI - 0.18, this.phi + dy * 0.008));
				}
				this.update();
			};
			this.onPointerUp = event => { if (this.pointer && this.pointer.id === event.pointerId) this.pointer = null; };
			this.onWheel = event => { event.preventDefault(); this.radius = Math.max(2.5, Math.min(14, this.radius + event.deltaY * 0.008)); this.update(); };
			this.onContextMenu = event => event.preventDefault();
			this.element.addEventListener('pointerdown', this.onPointerDown);
			this.element.addEventListener('pointermove', this.onPointerMove);
			this.element.addEventListener('pointerup', this.onPointerUp);
			this.element.addEventListener('pointercancel', this.onPointerUp);
			this.element.addEventListener('wheel', this.onWheel, { passive: false });
			this.element.addEventListener('contextmenu', this.onContextMenu);
		}

		pan(dx, dy) {
			const amount = this.radius * 0.0015;
			const right = new global.THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
			right.y = 0;
			right.normalize().multiplyScalar(-dx * amount);
			const forward = new global.THREE.Vector3();
			this.camera.getWorldDirection(forward);
			forward.y = 0;
			forward.normalize().multiplyScalar(-dy * amount);
			this.target.add(right).add(forward);
		}

		update() {
			this.camera.position.setFromSphericalCoords(this.radius, this.phi, this.theta).add(this.target);
			this.camera.lookAt(this.target);
		}

		destroy() {
			this.element.removeEventListener('pointerdown', this.onPointerDown);
			this.element.removeEventListener('pointermove', this.onPointerMove);
			this.element.removeEventListener('pointerup', this.onPointerUp);
			this.element.removeEventListener('pointercancel', this.onPointerUp);
			this.element.removeEventListener('wheel', this.onWheel);
			this.element.removeEventListener('contextmenu', this.onContextMenu);
		}
	}

	class NPCScene {
		constructor(root) {
			this.root = root;
			this.canvasHost = root.querySelector('[data-npc-canvas]');
			this.panel = root.querySelector('[data-npc-debug]');
			this.destroyed = false;
			this.previousTime = 0;
			this.animationFrame = 0;
			this.init();
		}

		init() {
			if (!global.THREE || !global.THREE.FBXLoader || !global.DAT_NPCAnimationController || !global.DAT_NPCCharacterController) return this.showError('Không tải được Three.js hoặc FBXLoader.');
			this.scene = new global.THREE.Scene();
			this.scene.background = new global.THREE.Color(0x07121c);
			this.camera = new global.THREE.PerspectiveCamera(42, 1, 0.01, 100);
			this.renderer = new global.THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
			this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
			this.renderer.outputEncoding = global.THREE.sRGBEncoding;
			this.renderer.shadowMap.enabled = true;
			this.renderer.shadowMap.type = global.THREE.PCFSoftShadowMap;
			this.renderer.domElement.className = 'dat-npc-test__canvas';
			this.renderer.domElement.setAttribute('aria-label', 'NPC 3D employee_001. Kéo để quay camera, cuộn để zoom.');
			this.canvasHost.appendChild(this.renderer.domElement);
			this.addStage();
			this.orbit = new NPCOrbitCamera(this.camera, this.renderer.domElement);
			this.bindPanel();
			if ('ResizeObserver' in global) {
				this.resizeObserver = new ResizeObserver(() => this.resize());
				this.resizeObserver.observe(this.canvasHost);
			} else {
				this.resizeHandler = () => this.resize();
				global.addEventListener('resize', this.resizeHandler);
			}
			this.resize();
			this.loadCharacter();
		}

		addStage() {
			const THREE = global.THREE;
			this.scene.add(new THREE.HemisphereLight(0xdaf3ff, 0x172530, 2.2));
			const key = new THREE.DirectionalLight(0xffffff, 2.4);
			key.position.set(4, 7, 5);
			key.castShadow = true;
			key.shadow.mapSize.set(1024, 1024);
			this.scene.add(key);
			const fill = new THREE.PointLight(0x42c8ff, 1.2, 10);
			fill.position.set(-3, 3, -2);
			this.scene.add(fill);
			const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshStandardMaterial({ color: 0x183244, roughness: 0.9, metalness: 0.05 }));
			floor.rotation.x = -Math.PI / 2;
			floor.receiveShadow = true;
			this.scene.add(floor);
			this.scene.add(new THREE.GridHelper(18, 18, 0x35596d, 0x244250));
			this.markers = {
				A: new THREE.Vector3(-2.3, 0, -1.4),
				B: new THREE.Vector3(2.5, 0, -0.75),
				C: new THREE.Vector3(0.8, 0, 2.35)
			};
			Object.keys(this.markers).forEach(name => this.addMarker(name, this.markers[name]));
		}

		addMarker(name, position) {
			const THREE = global.THREE;
			const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.05, 32), new THREE.MeshStandardMaterial({ color: 0x45d9ff, emissive: 0x0b5d78, emissiveIntensity: 0.65 }));
			marker.position.copy(position);
			marker.position.y = 0.03;
			marker.receiveShadow = true;
			this.scene.add(marker);
			const labelCanvas = document.createElement('canvas');
			labelCanvas.width = 128;
			labelCanvas.height = 64;
			const context = labelCanvas.getContext('2d');
			context.fillStyle = '#dffaff';
			context.font = 'bold 34px sans-serif';
			context.textAlign = 'center';
			context.fillText('Marker ' + name, 64, 42);
			const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labelCanvas), depthTest: false }));
			label.position.copy(position);
			label.position.y = 0.52;
			label.scale.set(1.12, 0.56, 1);
			this.scene.add(label);
		}

		loadFBX(url) {
			return new Promise((resolve, reject) => new global.THREE.FBXLoader().load(url, resolve, undefined, reject));
		}

		async loadCharacter() {
			try {
				const modelUrl = this.root.dataset.npcModel;
				const animationsUrl = this.root.dataset.npcAnimations;
				const version = this.root.dataset.npcVersion;
				const results = await Promise.all([this.loadFBX(versionedUrl(modelUrl, version)), this.loadFBX(versionedUrl(animationsUrl, version))]);
				if (this.destroyed) return;
				this.installCharacter(results[0], results[1].animations || []);
			} catch (error) {
				global.console.error('[DAT AI Office NPC] Không tải được FBX:', error);
				this.showError('Không tải được employee_001 hoặc animations.fbx. Mở Console để xem lỗi chi tiết.');
			}
		}

		installCharacter(model, clips) {
			const THREE = global.THREE;
			if (!clips.length) throw new Error('animations.fbx không có animation clip nào.');
			const clipTable = clips.map(clip => ({ name: clip.name, duration: Number(clip.duration.toFixed(3)), tracks: clip.tracks.length }));
			global.console.groupCollapsed('[DAT AI Office NPC] animations.fbx clips (' + clips.length + ')');
			global.console.table(clipTable);
			global.console.groupEnd();
			this.setClipList(clipTable);
			const animationMap = animationMapFrom(clips);
			global.console.log('[DAT AI Office NPC] ANIMATION_MAP', animationMap);
			if (!animationMap.IDLE || !animationMap.WALKING) throw new Error('Không tự map được Idle/Walk. Clips đã được liệt kê trong Console và panel debug.');

			this.character = new THREE.Group();
			this.character.name = 'employee_001';
			this.model = model;
			// Quaternius FBX is +Z-forward; the controller uses Three.js lookAt (-Z-forward).
			this.model.rotation.y = Math.PI;
			this.model.traverse(object => {
				if (!object.isMesh) return;
				object.castShadow = true;
				object.receiveShadow = true;
				const materials = Array.isArray(object.material) ? object.material : [object.material];
				materials.forEach(material => { if (material) material.side = THREE.FrontSide; });
			});
			this.character.add(this.model);
			this.scene.add(this.character);
			this.placeModelOnFloor();
			this.mixer = new THREE.AnimationMixer(this.model);
			this.animationController = new global.DAT_NPCAnimationController(this.mixer, clips, animationMap, { fadeDuration: 0.32 });
			this.characterController = new global.DAT_NPCCharacterController(this.character, this.animationController, { speed: 1.65, arrivalThreshold: 0.06 });
			this.animationController.setState(global.DAT_NPC_STATES.IDLE);
			this.status = 'Sẵn sàng';
			this.start();
		}

		placeModelOnFloor() {
			const THREE = global.THREE;
			this.model.updateMatrixWorld(true);
			let box = new THREE.Box3().setFromObject(this.model);
			const height = box.getSize(new THREE.Vector3()).y;
			if (!height) throw new Error('Không thể xác định chiều cao employee_001.');
			// Keep the full figure comfortably inside the test scene at its default zoom.
			const scale = 1.3 / height;
			this.model.scale.setScalar(scale);
			this.model.updateMatrixWorld(true);
			box = new THREE.Box3().setFromObject(this.model);
			this.model.position.y -= box.min.y;
			this.model.updateMatrixWorld(true);
		}

		bindPanel() {
			this.root.querySelectorAll('[data-npc-action]').forEach(button => button.addEventListener('click', () => {
				const action = button.dataset.npcAction;
				if (!this.characterController) return;
				if (action === 'IDLE') { this.characterController.stop(); this.status = 'Đã chuyển Idle'; return; }
				if (this.markers[action]) { this.characterController.moveTo(this.markers[action]); this.status = 'Đang đi tới marker ' + action; }
			}));
		}

		setClipList(clips) {
			const list = this.root.querySelector('[data-npc-clips]');
			if (!list) return;
			list.replaceChildren();
			clips.forEach(clip => {
				const item = document.createElement('li');
				item.textContent = clip.name + ' (' + clip.duration + 's)';
				list.appendChild(item);
			});
		}

		start() { if (!this.animationFrame) this.animationFrame = global.requestAnimationFrame(time => this.tick(time)); }
		tick(time) {
			if (this.destroyed) return;
			this.animationFrame = global.requestAnimationFrame(next => this.tick(next));
			const delta = Math.min(0.05, this.previousTime ? (time - this.previousTime) / 1000 : 0);
			this.previousTime = time;
			if (this.animationController) this.animationController.update(delta);
			if (this.characterController) {
				const hadTarget = this.characterController.getTarget();
				this.characterController.update(delta);
				if (hadTarget && !this.characterController.getTarget()) this.status = 'Đã đến target · Idle';
			}
			this.updatePanel();
			this.renderer.render(this.scene, this.camera);
		}

		updatePanel() {
			if (!this.characterController) return;
			const position = this.character.position;
			const target = this.characterController.getTarget();
			const value = (selector, text) => { const element = this.root.querySelector(selector); if (element) element.textContent = text; };
			value('[data-npc-state]', this.animationController.getState());
			value('[data-npc-animation]', this.animationController.getAnimation());
			value('[data-npc-position]', [position.x, position.y, position.z].map(number => number.toFixed(2)).join(', '));
			value('[data-npc-target]', target ? [target.x, target.y, target.z].map(number => number.toFixed(2)).join(', ') : '—');
			value('[data-npc-status]', this.status || 'Sẵn sàng');
		}

		resize() {
			if (!this.renderer || !this.canvasHost) return;
			const width = Math.max(1, this.canvasHost.clientWidth);
			const height = Math.max(1, this.canvasHost.clientHeight);
			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(width, height, false);
		}

		showError(message) {
			this.root.classList.add('is-npc-error');
			const error = this.root.querySelector('[data-npc-error]');
			if (error) { error.hidden = false; error.textContent = message; }
		}

		destroy() {
			this.destroyed = true;
			global.cancelAnimationFrame(this.animationFrame);
			if (this.resizeObserver) this.resizeObserver.disconnect();
			if (this.resizeHandler) global.removeEventListener('resize', this.resizeHandler);
			if (this.orbit) this.orbit.destroy();
			if (this.animationController) this.animationController.destroy();
			if (this.renderer) this.renderer.dispose();
		}
	}

	function boot(root) {
		if (root.dataset.npcReady) return;
		root.dataset.npcReady = '1';
		new NPCScene(root);
	}

	function bootAll() { document.querySelectorAll('[data-dat-npc-test]').forEach(boot); }
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAll); else bootAll();
	global.DAT_NPCTestScene = { create: root => new NPCScene(root) };
})(window);
