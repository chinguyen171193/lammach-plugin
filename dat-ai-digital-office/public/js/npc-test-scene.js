(function (global) {
	'use strict';

	const WORKSTATION_KEYWORDS = Object.freeze([ 'sit', 'sitting', 'sit down', 'stand up', 'typing', 'computer', 'desk', 'mouse', 'writing', 'talking', 'thinking' ]);

	function versionedUrl(url, version) {
		return version ? url + (url.indexOf('?') === -1 ? '?' : '&') + 'ver=' + encodeURIComponent(version) : url;
	}

	function workstationAnimationScan(clips) {
		return clips.filter(clip => WORKSTATION_KEYWORDS.some(keyword => clip.name.toLowerCase().includes(keyword)));
	}

	function animationMapFrom(actions) {
		return Object.freeze({
			IDLE: actions.IDLE || '', WALKING: actions.WALKING || '', ALIGNING_TO_CHAIR: actions.IDLE || '', WAITING_AT_CHAIR: actions.IDLE || '',
			SITTING_DOWN: actions.SIT_DOWN || '', SITTING_IDLE: actions.SITTING_IDLE || '', WORKING: actions.TYPING || '', STANDING_UP: actions.STAND_UP || ''
		});
	}

	function findPrimarySkinnedMesh(model) {
		const meshes = [];
		model.traverse(object => {
			if (object.isSkinnedMesh && object.skeleton && object.skeleton.bones.length) meshes.push(object);
		});
		if (!meshes.length) return null;
		return meshes.find(mesh => mesh.name === 'Suit_Legs') || meshes[0];
	}

	function bindMeshesToPrimarySkeleton(model) {
		const primaryMesh = findPrimarySkinnedMesh(model);
		if (!primaryMesh) throw new Error('employee_001.fbx không có skinned mesh/skeleton hợp lệ.');
		let meshCount = 0;
		model.traverse(mesh => {
			if (!mesh.isSkinnedMesh || !mesh.skeleton) return;
			meshCount += 1;
			if (mesh !== primaryMesh) mesh.bind(primaryMesh.skeleton, mesh.bindMatrix);
		});
		return { primaryMesh, meshCount };
	}

	function retargetAnimationClipsToPrimarySkeleton(clips, skeleton) {
		const THREE = global.THREE;
		const bindPoseBones = new Set([ 'FootL', 'FootR' ]);
		const targetsByName = new Map();
		skeleton.bones.forEach(bone => {
			if (!targetsByName.has(bone.name)) targetsByName.set(bone.name, bone);
		});
		let skippedTracks = 0;
		const retargetedClips = clips.map(clip => {
			const tracks = [];
			clip.tracks.forEach(track => {
				// The animation-only FBX has different local bone positions from the
				// character model. Applying those tracks collapses the hips and legs
				// below the floor. The rotation tracks are compatible and animate the
				// rig without changing its authored bind pose. FootL/FootR also use
				// an opposite local axis in the animation export, so keep their bind
				// rotations to prevent both feet from turning backwards.
				const match = track.name.match(/^(.+)\.(quaternion)$/);
				if (!match || match[1] === 'CharacterArmature' || bindPoseBones.has(match[1])) { skippedTracks += 1; return; }
				const target = targetsByName.get(match[1]);
				if (!target) { skippedTracks += 1; return; }
				const retargetedTrack = track.clone();
				retargetedTrack.name = target.uuid + '.' + match[2];
				tracks.push(retargetedTrack);
			});
			return new THREE.AnimationClip(clip.name, clip.duration, tracks);
		});
		return {
			clips: retargetedClips,
			targetBoneNames: targetsByName.size,
			skippedTracks
		};
	}


	class NPCOrbitCamera {
		constructor(camera, element) {
			this.camera = camera;
			this.element = element;
			this.target = new global.THREE.Vector3(0.5, 0.72, 0);
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
			this.onWheel = event => { event.preventDefault(); this.radius = Math.max(3.5, Math.min(16, this.radius + event.deltaY * 0.008)); this.update(); };
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
			this.workstations = new Map();
			this.addWorkstation();
		}

		addMarker(name, position, color) {
			const THREE = global.THREE;
			const markerColor = color || 0x45d9ff;
			const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.04, 24), new THREE.MeshStandardMaterial({ color: markerColor, emissive: markerColor, emissiveIntensity: 0.28 }));
			marker.position.copy(position);
			marker.position.y = 0.03;
			marker.receiveShadow = true;
			this.scene.add(marker);
			const labelCanvas = document.createElement('canvas');
			labelCanvas.width = 128;
			labelCanvas.height = 64;
			const context = labelCanvas.getContext('2d');
			context.fillStyle = '#dffaff';
			context.font = 'bold 22px sans-serif';
			context.textAlign = 'center';
			context.fillText('Marker ' + name, 64, 42);
			const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(labelCanvas), depthTest: false }));
			label.position.copy(position);
			label.position.y = 0.52;
			label.scale.set(1.2, 0.6, 1);
			this.scene.add(label);
		}

		addWorkstation() {
			const THREE = global.THREE;
			const deskPosition = new THREE.Vector3(1.6, 0, 0.8);
			const group = new THREE.Group();
			group.name = 'desk_01';
			group.userData = { id: 'desk_01', type: 'workstation', actions: [ 'SIT', 'WORK' ] };
			group.position.copy(deskPosition);
			const wood = new THREE.MeshStandardMaterial({ color: 0x5f3d28, roughness: 0.72 });
			const metal = new THREE.MeshStandardMaterial({ color: 0x243847, roughness: 0.48, metalness: 0.55 });
			const screen = new THREE.MeshStandardMaterial({ color: 0x0a1c28, emissive: 0x1a83a1, emissiveIntensity: 0.35 });
			const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.92), wood);
			top.position.y = 0.82;
			group.add(top);
			[ -0.92, 0.92 ].forEach(x => [ -0.32, 0.32 ].forEach(z => {
				const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), metal);
				leg.position.set(x, 0.4, z);
				group.add(leg);
			}));
			const monitor = new THREE.Group();
			monitor.name = 'computer_01';
			monitor.userData = { id: 'computer_01', type: 'computer', actions: [ 'READ_EMAIL', 'WRITE_EMAIL', 'MAKE_QUOTE', 'WORK' ] };
			const monitorScreen = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 0.06), screen);
			monitorScreen.position.y = 1.22;
			monitor.add(monitorScreen);
			const monitorStem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), metal);
			monitorStem.position.y = 0.99;
			monitor.add(monitorStem);
			const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.035, 0.25), metal);
			keyboard.position.set(0, 0.9, 0.18);
			monitor.add(keyboard);
			const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), metal);
			mouse.scale.set(1, 0.45, 1.25);
			mouse.position.set(0.52, 0.91, 0.18);
			monitor.add(mouse);
			group.add(monitor);
			const chair = new THREE.Group();
			chair.name = 'chair_01';
			chair.userData = { id: 'chair_01', type: 'chair', actions: [ 'SIT' ] };
			chair.position.set(0, 0, 1.22);
			const seat = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.11, 0.76), new THREE.MeshStandardMaterial({ color: 0x216077, roughness: 0.62 }));
			seat.position.y = 0.54;
			chair.add(seat);
			const back = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.72, 0.1), new THREE.MeshStandardMaterial({ color: 0x1b4d62, roughness: 0.62 }));
			back.position.set(0, 0.91, 0.32);
			chair.add(back);
			[ -0.29, 0.29 ].forEach(x => [ -0.23, 0.23 ].forEach(z => {
				const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.54, 10), metal);
				leg.position.set(x, 0.27, z);
				chair.add(leg);
			}));
			group.add(chair);
			this.scene.add(group);
			const chairWorld = new THREE.Vector3(deskPosition.x, 0, deskPosition.z + 1.22);
			const workstation = {
				id: 'desk_01',
				object: group,
				actions: [ 'SIT', 'WORK' ],
				chair: {
					id: 'chair_01', object: chair, actions: [ 'SIT' ],
					approachPoint: new THREE.Vector3(chairWorld.x, 0, chairWorld.z + 0.72),
					sitPoint: new THREE.Vector3(chairWorld.x, 0, chairWorld.z + 0.06),
					sitRotation: Math.PI
				},
				computer: { id: 'computer_01', object: monitor, actions: [ 'READ_EMAIL', 'WRITE_EMAIL', 'MAKE_QUOTE', 'WORK' ] }
			};
			this.workstations.set(workstation.id, workstation);
			this.addMarker('chair_01.approachPoint', workstation.chair.approachPoint, 0x57e6ff);
			this.addMarker('chair_01.sitPoint', workstation.chair.sitPoint, 0x63e89b);
			const rotationPoint = workstation.chair.sitPoint.clone().add(new THREE.Vector3(0, 0, -0.46));
			this.addMarker('chair_01.sitRotation', rotationPoint, 0xffca63);
		}

		loadFBX(url) {
			return new Promise((resolve, reject) => new global.THREE.FBXLoader().load(url, resolve, undefined, reject));
		}

		async loadCharacter() {
			try {
				const modelUrl = this.root.dataset.npcModel;
				const version = this.root.dataset.npcVersion;
				const configResponse = await fetch(versionedUrl(this.root.dataset.npcAnimationEndpoint, version), { credentials: 'same-origin' });
				if (!configResponse.ok) throw new Error('Không đọc được cấu hình chuyển động.');
				const config = await configResponse.json();
				const assets = {};
				await Promise.all(Object.keys(config).map(async action => {
					const asset = Array.isArray(config[action]) ? config[action][0] : null;
					if (!asset || asset.format !== 'fbx') return;
					const source = await this.loadFBX(versionedUrl(asset.url, version));
					const clip = asset.clip ? source.animations.find(item => item.name === asset.clip) : source.animations[0];
					if (clip) assets[action] = { asset, clip };
				}));
				const results = await this.loadFBX(versionedUrl(modelUrl, version));
				if (this.destroyed) return;
				this.installCharacter(results, assets);
			} catch (error) {
				global.console.error('[DAT AI Office NPC] Không tải được FBX:', error);
				this.showError('Không tải được employee_001 hoặc animations.fbx. Mở Console để xem lỗi chi tiết.');
			}
		}

		installCharacter(model, assets) {
			const THREE = global.THREE;
			// FBXLoader exposes duplicate, chained skeletons for the Suit_* meshes.
			// Driving all of them compounds bone transforms, most visibly in the legs.
			// Bind every mesh to the valid Suit_Legs skeleton and animate it once.
			const skeletonSource = bindMeshesToPrimarySkeleton(model);
			const retargetedClips = [];
			const resolvedActions = {};
			Object.keys(assets).forEach(action => {
				const retargeted = retargetAnimationClipsToPrimarySkeleton([assets[action].clip], skeletonSource.primaryMesh.skeleton).clips[0];
				if (!retargeted || !retargeted.tracks.length) return;
				retargeted.name = '__action__' + action;
				retargetedClips.push(retargeted); resolvedActions[action] = retargeted.name;
			});
			if (!resolvedActions.IDLE || !resolvedActions.WALKING) throw new Error('Cấu hình phải có Chờ việc và Đi bộ hợp lệ.');
			const clipTable = retargetedClips.map(clip => ({ name: clip.name, duration: Number(clip.duration.toFixed(3)), tracks: clip.tracks.length }));
			global.console.groupCollapsed('[DAT AI Office NPC] animation library (' + retargetedClips.length + ')');
			global.console.table(clipTable);
			global.console.info('[DAT AI Office NPC] Resolver đã load: ' + Object.keys(resolvedActions).join(', '));
			global.console.groupEnd();
			this.setClipList(clipTable);
			this.setWorkstationAnimationScan([]);
			const animationMap = animationMapFrom(resolvedActions);
			global.console.log('[DAT AI Office NPC] ANIMATION_MAP', animationMap);
			if (!animationMap.IDLE || !animationMap.WALKING) throw new Error('Không tự map được Idle/Walk. Clips đã được liệt kê trong Console và panel debug.');

			this.character = new THREE.Group();
			this.character.name = 'employee_001';
			// Keep the character clear of the debug panel on the left.
			this.character.position.set(0.75, 0, 0);
			this.model = model;
			// The Quaternius model faces +Z, which matches Object3D.lookAt().
			// Rotating it 180° makes the walking animation move backwards.
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
			this.animationController = new global.DAT_NPCAnimationController(this.mixer, retargetedClips, animationMap, { fadeDuration: 0.32 });
			this.characterController = new global.DAT_NPCCharacterController(this.character, this.animationController, { speed: 1.65, arrivalThreshold: 0.06, typingAvailable: Boolean(resolvedActions.TYPING) });
			this.animationController.setState(global.DAT_NPC_STATES.IDLE);
			this.status = 'Sẵn sàng · thư viện chuyển động đã tải';
			this.start();
		}

		placeModelOnFloor() {
			const THREE = global.THREE;
			this.model.updateMatrixWorld(true);
			let box = new THREE.Box3().setFromObject(this.model);
			const height = box.getSize(new THREE.Vector3()).y;
			if (!height) throw new Error('Không thể xác định chiều cao employee_001.');
			// The test scene needs a full-body NPC with ample space around the markers.
			const scale = 1.45 / height;
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
				const workstation = this.workstations.get('desk_01');
				if (action === 'IDLE') { this.characterController.stop(); this.characterController.currentInteraction = null; this.characterController.targetObject = null; this.status = 'Đã chuyển Idle'; return; }
				if (action === 'GO_TO_DESK') { this.characterController.goToWorkstation(workstation); this.status = 'Đang đi tới chair_01.approachPoint'; return; }
				if (action === 'SIT') { const sitting = this.characterController.sit(workstation); this.status = sitting ? 'Đang phát chuyển động: Ngồi xuống' : 'Chưa có chuyển động: Ngồi xuống'; return; }
				if (action === 'WORK') { const typing = this.characterController.work(); this.status = typing ? 'Đang làm việc' : 'Typing animation không có · giữ Sitting Idle'; return; }
				if (action === 'STOP_WORK') { this.characterController.stopWork(); this.status = 'Dừng làm việc · Sitting Idle'; return; }
				if (action === 'STAND_UP') { const standing = this.characterController.standUp(workstation); this.status = standing ? 'Đang phát chuyển động: Đứng dậy' : 'Chưa có chuyển động: Đứng dậy'; }
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

		setWorkstationAnimationScan(clips) {
			const list = this.root.querySelector('[data-npc-workstation-clips]');
			if (list) {
				list.replaceChildren();
				if (!clips.length) {
					const item = document.createElement('li');
					item.textContent = 'Không có clip khớp keyword workstation.';
					list.appendChild(item);
				} else clips.forEach(clip => {
					const item = document.createElement('li');
					item.textContent = clip.name + ' (' + clip.duration.toFixed(3) + 's)';
					list.appendChild(item);
				});
			}
			const missing = this.root.querySelector('[data-npc-missing-animations]');
			if (missing) missing.textContent = 'Thiếu: Sit / Sitting, Sit Down, Stand Up, Typing, Computer, Desk, Mouse, Writing, Talking, Thinking.';
		}

		start() { if (!this.animationFrame) this.animationFrame = global.requestAnimationFrame(time => this.tick(time)); }
		tick(time) {
			if (this.destroyed) return;
			this.animationFrame = global.requestAnimationFrame(next => this.tick(next));
			const delta = Math.min(0.05, this.previousTime ? (time - this.previousTime) / 1000 : 0);
			this.previousTime = time;
			if (this.animationController) this.animationController.update(delta);
			if (this.characterController) this.characterController.update(delta);
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
			value('[data-npc-interaction]', this.characterController.currentInteraction || '—');
			value('[data-npc-target-object]', this.characterController.targetObject || '—');
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
