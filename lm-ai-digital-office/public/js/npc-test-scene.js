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
			SITTING_DOWN: actions.SIT_DOWN || '', SITTING_IDLE: actions.SITTING_IDLE || '', WORKING: actions.TYPING || '', TYPING: actions.TYPING || '',
			USING_MOUSE: actions.USING_MOUSE || '', THINKING: actions.THINKING || '', READING: actions.READING || '', WRITING: actions.WRITING || '', TALKING: actions.TALKING || '', PHONE_CALL: actions.PHONE_CALL || '', STANDING_UP: actions.STAND_UP || ''
		});
	}

	function findSkinnedMeshes(model) {
		const meshes = [];
		model.traverse(object => {
			if (object.isSkinnedMesh && object.skeleton && object.skeleton.bones.length) meshes.push(object);
		});
		return meshes;
	}

	function prepareModelSkeletons(model, shareSkeleton) {
		const meshes = findSkinnedMeshes(model);
		const primaryMesh = meshes.find(mesh => mesh.name === 'Suit_Legs') || meshes[0];
		if (!primaryMesh) throw new Error('Model không có skinned mesh/skeleton hợp lệ.');
		if (shareSkeleton) meshes.forEach(mesh => { if (mesh !== primaryMesh) mesh.bind(primaryMesh.skeleton, mesh.bindMatrix); });
		return { primaryMesh, meshes: shareSkeleton ? [ primaryMesh ] : meshes, meshCount: meshes.length };
	}

	function compareSkeletons(reference, candidate) {
		const candidateByName = new Map(candidate.bones.map(bone => [bone.name, bone]));
		let matchingNames = 0; let matchingParents = 0;
		reference.bones.forEach(bone => {
			const match = candidateByName.get(bone.name); if (!match) return;
			matchingNames += 1;
			if ((!bone.parent && !match.parent) || (bone.parent && match.parent && bone.parent.name === match.parent.name)) matchingParents += 1;
		});
		const coverage = reference.bones.length ? matchingNames / reference.bones.length : 0;
		const hierarchy = matchingNames ? matchingParents / matchingNames : 0;
		return { matchingNames, referenceBones: reference.bones.length, coverage, hierarchy, compatible: coverage >= .9 && hierarchy >= .85 };
	}

	function sourceRigFromAnimationFBX(source) {
		const bones = [];
		source.traverse(object => { if (object.isBone) bones.push(object); });
		if (!bones.length) return null;
		source.updateMatrixWorld(true);
		// Animation-only FBX files have no SkinnedMesh. SkeletonUtils accepts an
		// Object3D carrying a Skeleton, so deltas are derived from the female
		// animation's own rest pose rather than copied from the male rig.
		source.skeleton = new global.THREE.Skeleton(bones);
		return source;
	}

	function humanoidBoneMap(skeleton) {
		const names = new Set(skeleton.bones.map(bone => bone.name)); const pick = (...choices) => choices.find(name => names.has(name)) || '';
		return {
			hips: pick('Hips'), spine: pick('Abdomen', 'Spine'), chest: pick('Chest', 'Torso'), neck: pick('Neck'), head: pick('Head'),
			leftShoulder: pick('ShoulderL'), leftUpperArm: pick('UpperArmL'), leftLowerArm: pick('LowerArmL'), leftHand: pick('HandL', 'WristL'),
			rightShoulder: pick('ShoulderR'), rightUpperArm: pick('UpperArmR'), rightLowerArm: pick('LowerArmR'), rightHand: pick('HandR', 'WristR'),
			leftUpperLeg: pick('UpperLegL'), leftLowerLeg: pick('LowerLegL'), leftFoot: pick('FootL'),
			rightUpperLeg: pick('UpperLegR'), rightLowerLeg: pick('LowerLegR'), rightFoot: pick('FootR')
		};
	}

	function retargetNameMap(targetSkeleton, sourceSkeleton) {
		const sourceNames = new Set(sourceSkeleton.bones.map(bone => bone.name)); const names = {};
		// Formal.fbx calls these joints HandL/R; the official female animation FBX
		// calls the same joints WristL/R. No left/right or upper/lower swap occurs.
		if (sourceNames.has('WristL')) names.HandL = 'WristL';
		if (sourceNames.has('WristR')) names.HandR = 'WristR';
		return names;
	}

	function retargetWorldSpaceClip(clip, targetMesh, sourceRig) {
		const THREE = global.THREE; const targetByName = new Map(targetMesh.skeleton.bones.map(bone => [bone.name, bone]));
		sourceRig.skeleton.pose(); sourceRig.updateMatrixWorld(true); targetMesh.skeleton.pose(); targetMesh.updateMatrixWorld(true);
		const converted = THREE.SkeletonUtils.retargetClip(targetMesh, sourceRig, clip, { hip: 'Hips', names: retargetNameMap(targetMesh.skeleton, sourceRig.skeleton), preservePosition: true, preserveHipPosition: true, useFirstFramePosition: true, fps: 30 });
		targetMesh.skeleton.pose(); targetMesh.updateMatrixWorld(true);
		const tracks = converted.tracks.reduce((out, track) => {
			const match = track.name.match(/^\.bones\[(.+)]\.quaternion$/); const target = match && targetByName.get(match[1]);
			// Controller owns world/root motion. Retarget only bone rotations; this
			// prevents source limb translations from collapsing the target skeleton.
			if (!target || [ 'FootL', 'FootR' ].indexOf(target.name) !== -1) return out;
			const next = track.clone(); next.name = target.uuid + '.quaternion'; out.push(next); return out;
		}, []);
		return new THREE.AnimationClip(clip.name, clip.duration, tracks);
	}

	function retargetAnimationClipsToPrimarySkeleton(clips, targetMeshes, sourceRig, retargetMode) {
		const THREE = global.THREE; const targets = Array.isArray(targetMeshes) ? targetMeshes : [ targetMeshes ]; const targetMesh = targets[0]; const skeleton = targetMesh.skeleton;
		if (retargetMode === 'Retargeted') {
			if (!sourceRig || !sourceRig.skeleton || !THREE.SkeletonUtils) return { clips: [], targetBoneNames: skeleton.bones.length, skippedTracks: 0, failed: true };
			const retargeted = clips.map(clip => {
				const tracks = [];
				targets.forEach(mesh => tracks.push(...retargetWorldSpaceClip(clip, mesh, sourceRig).tracks));
				return new THREE.AnimationClip(clip.name, clip.duration, tracks);
			}).filter(clip => clip.tracks.length);
			return { clips: retargeted, targetBoneNames: targets.reduce((count, mesh) => count + mesh.skeleton.bones.length, 0), skippedTracks: 0, failed: false };
		}
		const bindPoseBones = new Set([ 'FootL', 'FootR' ]); const targetsByName = new Map();
		skeleton.bones.forEach(bone => { if (!targetsByName.has(bone.name)) targetsByName.set(bone.name, bone); });
		let skippedTracks = 0;
		const retargetedClips = clips.map(clip => {
			const tracks = [];
			clip.tracks.forEach(track => {
				const match = track.name.match(/^(.+)\.(quaternion)$/);
				if (!match || match[1] === 'CharacterArmature' || bindPoseBones.has(match[1])) { skippedTracks += 1; return; }
				const target = targetsByName.get(match[1]); if (!target) { skippedTracks += 1; return; }
				const retargetedTrack = track.clone(); retargetedTrack.name = target.uuid + '.' + match[2]; tracks.push(retargetedTrack);
			});
			return new THREE.AnimationClip(clip.name, clip.duration, tracks);
		});
		return { clips: retargetedClips, targetBoneNames: targetsByName.size, skippedTracks, failed: false };
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
			this.scenario = null;
			this.init();
		}

		init() {
			if (!global.THREE || !global.THREE.FBXLoader || !global.LM_NPCAnimationController || !global.LM_NPCCharacterController) return this.showError('Không tải được Three.js hoặc FBXLoader.');
			this.scene = new global.THREE.Scene();
			this.scene.background = new global.THREE.Color(0x07121c);
			this.camera = new global.THREE.PerspectiveCamera(42, 1, 0.01, 100);
			this.renderer = new global.THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
			this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
			this.renderer.outputEncoding = global.THREE.sRGBEncoding;
			this.renderer.shadowMap.enabled = true;
			this.renderer.shadowMap.type = global.THREE.PCFSoftShadowMap;
			this.renderer.domElement.className = 'lm-npc-test__canvas';
			this.renderer.domElement.setAttribute('aria-label', 'NPC 3D. Kéo để quay camera, cuộn để zoom.');
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
			this.loadCharacters();
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
			this.addWorkstation('desk_01', new THREE.Vector3(1.6, 0, 0.8));
			this.addWorkstation('desk_02', new THREE.Vector3(-2.7, 0, 1.5));
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

		addWorkstation(deskId, deskPosition) {
			const THREE = global.THREE;
			const suffix = deskId.replace('desk_', ''); const chairId = 'chair_' + suffix; const computerId = 'computer_' + suffix;
			const group = new THREE.Group();
			group.name = deskId;
			group.userData = { id: deskId, type: 'workstation', actions: [ 'SIT', 'WORK' ] };
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
			monitor.name = computerId;
			monitor.userData = { id: computerId, type: 'computer', actions: [ 'READ_EMAIL', 'WRITE_EMAIL', 'MAKE_QUOTE', 'WORK' ] };
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
			chair.name = chairId;
			chair.userData = { id: chairId, type: 'chair', actions: [ 'SIT' ] };
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
				id: deskId,
				object: group,
				actions: [ 'SIT', 'WORK' ],
				chair: {
					id: chairId, object: chair, actions: [ 'SIT' ],
					approachPoint: new THREE.Vector3(chairWorld.x, 0, chairWorld.z + 0.72),
					sitPoint: new THREE.Vector3(chairWorld.x, 0, chairWorld.z + 0.06),
					sitRotation: Math.PI
				},
				computer: { id: computerId, object: monitor, actions: [ 'READ_EMAIL', 'WRITE_EMAIL', 'MAKE_QUOTE', 'WORK' ] }
			};
			this.workstations.set(workstation.id, workstation);
			this.addMarker(chairId + '.approachPoint', workstation.chair.approachPoint, 0x57e6ff);
			this.addMarker(chairId + '.sitPoint', workstation.chair.sitPoint, 0x63e89b);
			const rotationPoint = workstation.chair.sitPoint.clone().add(new THREE.Vector3(0, 0, -0.46));
			this.addMarker(chairId + '.sitRotation', rotationPoint, 0xffca63);
		}

		loadFBX(url) {
			return new Promise((resolve, reject) => new global.THREE.FBXLoader().load(url, resolve, undefined, reject));
		}

		loadModel(definition) {
			const url = versionedUrl(definition.model.url, this.root.dataset.npcVersion);
			if (definition.model.format === 'fbx') return this.loadFBX(url);
			if (definition.model.format === 'glb' || definition.model.format === 'gltf') return new Promise((resolve, reject) => new global.THREE.GLTFLoader().load(url, result => resolve(result.scene), undefined, reject));
			return Promise.reject(new Error('Định dạng model chưa được hỗ trợ.'));
		}

		loadAnimationAssets(definition) {
			this.animationAssetCache = this.animationAssetCache || new Map();
			const profile = definition.animation_profile || definition.id;
			if (this.animationAssetCache.has(profile)) return this.animationAssetCache.get(profile);
			const endpoint = this.root.dataset.npcCharactersEndpoint.replace(/\/$/, '') + '/' + encodeURIComponent(definition.id) + '/animations';
			const request = fetch(versionedUrl(endpoint, this.root.dataset.npcVersion), { credentials: 'same-origin' }).then(async response => {
				if (!response.ok) throw new Error('Không đọc được cấu hình chuyển động.');
				const config = await response.json(); const assets = {};
				await Promise.all(Object.keys(config).map(async action => {
					const asset = Array.isArray(config[action]) ? config[action][0] : null;
					if (!asset || asset.format !== 'fbx') return;
					const source = await this.loadFBX(versionedUrl(asset.url, this.root.dataset.npcVersion));
					const clip = asset.clip ? source.animations.find(item => item.name === asset.clip) : source.animations[0];
					if (clip) assets[action] = { asset, clip, sourceRig: sourceRigFromAnimationFBX(source) };
				})); return assets;
			});
			this.animationAssetCache.set(profile, request); return request;
		}

		async loadCharacters() {
			try {
				const response = await fetch(versionedUrl(this.root.dataset.npcCharactersEndpoint, this.root.dataset.npcVersion), { credentials: 'same-origin' });
				if (!response.ok) throw new Error('Không đọc được Character Registry.');
				this.characterDefinitions = await response.json(); this.characters = new Map(); this.populateCharacterSelector();
				const available = this.characterDefinitions.filter(definition => definition.model && definition.model.available);
				const install = async definition => { try { const [model, assets] = await Promise.all([this.loadModel(definition), this.loadAnimationAssets(definition)]); if (!this.destroyed) this.installCharacter(definition, model, assets); } catch (error) { global.console.error('[LM AI Office NPC] Không tải được ' + definition.id + ':', error); } };
				const reference = available.find(definition => definition.id === 'employee_001'); if (reference) await install(reference);
				await Promise.all(available.filter(definition => definition.id !== 'employee_001').map(install));
				if (!this.characters.size) throw new Error('Không có model nhân vật khả dụng.');
				this.evaluateSkeletonCompatibility();
				this.populateCharacterSelector(); this.setActiveCharacter(this.characters.has('employee_001') ? 'employee_001' : this.characters.keys().next().value); this.start();
			} catch (error) {
				global.console.error('[LM AI Office NPC] Không tải được Character Registry:', error);
				this.showError('Không tải được Character Registry hoặc model NPC. Mở Console để xem lỗi chi tiết.');
			}
		}

		installCharacter(definition, model, assets) {
			const THREE = global.THREE;
			// Employee 001 exports compatible duplicate rig data and can share one
			// skeleton. Formal.fbx instead has four separately-bound body meshes;
			// rebinding them to the head mesh corrupts skin matrices. Keep each female
			// mesh skeleton and emit retarget tracks for every one.
			const retargetMode = definition.retarget_mode || 'Direct';
			const skeletonSource = prepareModelSkeletons(model, retargetMode === 'Direct');
			const retargetedClips = [];
			const resolvedActions = {};
			let retargetFailed = false;
			Object.keys(assets).forEach(action => {
				const result = retargetAnimationClipsToPrimarySkeleton([assets[action].clip], skeletonSource.meshes, assets[action].sourceRig, retargetMode);
				if (result.failed) retargetFailed = true;
				const retargeted = result.clips[0];
				if (!retargeted || !retargeted.tracks.length) return;
				retargeted.name = '__action__' + action;
				retargetedClips.push(retargeted); resolvedActions[action] = retargeted.name;
			});
			if ((!resolvedActions.IDLE || !resolvedActions.WALKING) && retargetMode !== 'Retargeted') throw new Error('Cấu hình phải có Chờ việc và Đi bộ hợp lệ.');
			if (!resolvedActions.IDLE || !resolvedActions.WALKING) {
				const bindClip = new THREE.AnimationClip('__bind_rest__', 0, []);
				retargetedClips.push(bindClip); resolvedActions.IDLE = bindClip.name; resolvedActions.WALKING = bindClip.name; retargetFailed = true;
			}
			const clipTable = retargetedClips.map(clip => ({ name: clip.name, duration: Number(clip.duration.toFixed(3)), tracks: clip.tracks.length }));
			global.console.groupCollapsed('[LM AI Office NPC] animation library (' + retargetedClips.length + ')');
			global.console.table(clipTable);
			global.console.info('[LM AI Office NPC] Resolver đã load: ' + Object.keys(resolvedActions).join(', '));
			global.console.groupEnd();
			const animationMap = animationMapFrom(resolvedActions);
			global.console.log('[LM AI Office NPC] ANIMATION_MAP', animationMap);
			if (!animationMap.IDLE || !animationMap.WALKING) throw new Error('Không tự map được Idle/Walk. Clips đã được liệt kê trong Console và panel debug.');

			const character = new THREE.Group();
			character.name = definition.id;
			character.position.set(Number(definition.spawn && definition.spawn.x) || 0, Number(definition.spawn && definition.spawn.y) || 0, Number(definition.spawn && definition.spawn.z) || 0);
			// The Quaternius model faces +Z, which matches Object3D.lookAt().
			// Rotating it 180° makes the walking animation move backwards.
			model.traverse(object => {
				if (!object.isMesh) return;
				object.castShadow = true;
				object.receiveShadow = true;
				const materials = Array.isArray(object.material) ? object.material : [object.material];
				materials.forEach(material => { if (material) material.side = THREE.FrontSide; });
			});
			character.add(model);
			this.scene.add(character);
			this.placeModelOnFloor(model);
			this.addCharacterLabel(character, definition);
			const mixer = new THREE.AnimationMixer(model);
			const animationController = new global.LM_NPCAnimationController(mixer, retargetedClips, animationMap, { fadeDuration: 0.32 });
			const characterController = new global.LM_NPCCharacterController(character, animationController, { speed: 1.65, arrivalThreshold: 0.06, typingAvailable: Boolean(resolvedActions.TYPING), workstationResolver: id => this.workstations.get(id) });
			animationController.setState(global.LM_NPC_STATES.IDLE);
			const record = { id: definition.id, definition, character, model, mixer, animationController, characterController, clips: clipTable, primaryMesh: skeletonSource.primaryMesh, skeleton: skeletonSource.primaryMesh.skeleton, skeletonMeshes: skeletonSource.meshes, skeletonStatus: retargetFailed ? 'Không tương thích' : definition.skeleton_status, retargetStatus: retargetFailed ? 'Failed' : retargetMode, sourceRig: (assets.IDLE || Object.values(assets)[0] || {}).sourceRig || null, skeletonHelper: null };
			this.characters.set(definition.id, record);
			this.logSkeleton(record);
		}

		placeModelOnFloor(model) {
			const THREE = global.THREE;
			model.updateMatrixWorld(true);
			let box = new THREE.Box3().setFromObject(model);
			const height = box.getSize(new THREE.Vector3()).y;
			if (!height) throw new Error('Không thể xác định chiều cao model nhân vật.');
			// The test scene needs a full-body NPC with ample space around the markers.
			const scale = 1.45 / height;
			model.scale.setScalar(scale);
			model.updateMatrixWorld(true);
			box = new THREE.Box3().setFromObject(model);
			model.position.y -= box.min.y;
			model.updateMatrixWorld(true);
		}

		addCharacterLabel(character, definition) {
			const THREE = global.THREE; const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96;
			const context = canvas.getContext('2d'); context.fillStyle = 'rgba(5, 20, 31, .8)'; context.fillRect(8, 8, 240, 80); context.fillStyle = '#f2fbff'; context.font = 'bold 24px sans-serif'; context.textAlign = 'center'; context.fillText(definition.name, 128, 42); context.fillStyle = '#8cdaff'; context.font = '18px sans-serif'; context.fillText(definition.role, 128, 68);
			const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false })); label.position.set(0, 1.88, 0); label.scale.set(1.45, .55, 1); character.add(label);
		}

		populateCharacterSelector() {
			const select = this.root.querySelector('[data-npc-character-select]'); if (!select || !this.characterDefinitions) return;
			select.replaceChildren(); this.characterDefinitions.forEach(definition => { const option = document.createElement('option'); option.value = definition.id; option.textContent = definition.name + ' — ' + definition.role + (definition.model.available ? '' : ' (Chưa có model)'); option.disabled = !definition.model.available; select.appendChild(option); }); select.disabled = false;
		}

		setActiveCharacter(employeeId) {
			const record = this.characters.get(employeeId); if (!record) return;
			this.scenario = null; this.activeCharacterId = employeeId; this.character = record.character; this.model = record.model; this.mixer = record.mixer; this.animationController = record.animationController; this.characterController = record.characterController; this.status = record.definition.name + ' · Skeleton: ' + record.skeletonStatus;
			const select = this.root.querySelector('[data-npc-character-select]'); if (select) select.value = employeeId;
			this.setClipList(record.clips); this.setWorkstationAnimationScan([]); this.setBoneMap(record);
		}

		evaluateSkeletonCompatibility() {
			const reference = this.characters.get('employee_001'); if (!reference) return;
			this.characters.forEach(record => {
				if (record.id === reference.id) { record.skeletonStatus = 'Tương thích trực tiếp'; return; }
				const result = compareSkeletons(reference.skeleton, record.skeleton);
				record.skeletonStatus = result.compatible && record.definition.retarget_mode === 'Direct' ? 'Tương thích trực tiếp' : 'Cần retarget';
				global.console.info('[LM AI Office NPC] Skeleton ' + record.id + ': ' + record.skeletonStatus, result);
			});
		}

		logSkeleton(record) {
			const rows = record.skeleton.bones.map(bone => ({ bone: bone.name, parent: bone.parent && bone.parent.isBone ? bone.parent.name : '—', restPosition: bone.position.toArray().map(value => Number(value.toFixed(5))).join(', '), restRotation: bone.quaternion.toArray().map(value => Number(value.toFixed(5))).join(', ') }));
			global.console.groupCollapsed('[LM AI Office NPC] Skeleton ' + record.id + ' (' + rows.length + ' bones)');
			global.console.table(rows);
			if (record.sourceRig && record.sourceRig.skeleton) {
				const sourceRows = record.sourceRig.skeleton.bones.map(bone => ({ bone: bone.name, parent: bone.parent && bone.parent.isBone ? bone.parent.name : '—', restPosition: bone.position.toArray().map(value => Number(value.toFixed(5))).join(', '), restRotation: bone.quaternion.toArray().map(value => Number(value.toFixed(5))).join(', ') }));
				global.console.info('[LM AI Office NPC] Source animation skeleton (' + sourceRows.length + ' bones)'); global.console.table(sourceRows);
			}
			global.console.log('[LM AI Office NPC] Humanoid Bone Map', humanoidBoneMap(record.skeleton));
			global.console.groupEnd();
		}

		setBoneMap(record) {
			const list = this.root.querySelector('[data-npc-bone-map]'); if (!list) return;
			const targetMap = humanoidBoneMap(record.skeleton); const sourceMap = record.sourceRig && record.sourceRig.skeleton ? humanoidBoneMap(record.sourceRig.skeleton) : {};
			list.replaceChildren(); Object.keys(targetMap).forEach(key => {
				const item = document.createElement('li'); item.textContent = key + ': Source ' + (sourceMap[key] || '—') + ' → Target ' + (targetMap[key] || '—'); list.appendChild(item);
			});
		}

		showRestPose() {
			const record = this.characters.get(this.activeCharacterId); if (!record) return;
			this.scenario = null; record.characterController.target = null; record.mixer.stopAllAction(); record.animationController.currentAction = null; record.animationController.currentState = 'REST_POSE'; record.animationController.currentAnimation = 'Bind / Rest Pose';
			const posed = new Set(); (record.skeletonMeshes || [ record.primaryMesh ]).forEach(mesh => { if (!posed.has(mesh.skeleton)) { mesh.skeleton.pose(); posed.add(mesh.skeleton); } }); record.model.updateMatrixWorld(true); this.status = 'Đang xem tư thế gốc (không áp animation).';
		}

		toggleSkeleton() {
			const record = this.characters.get(this.activeCharacterId); if (!record) return;
			if (!record.skeletonHelper) { record.skeletonHelper = new global.THREE.SkeletonHelper(record.model); record.skeletonHelper.material.linewidth = 2; this.scene.add(record.skeletonHelper); }
			record.skeletonHelper.visible = !record.skeletonHelper.visible; this.status = record.skeletonHelper.visible ? 'Đang hiển thị bộ xương.' : 'Đã ẩn bộ xương.';
		}

		bindPanel() {
			const characterSelect = this.root.querySelector('[data-npc-character-select]');
			if (characterSelect) characterSelect.addEventListener('change', event => this.setActiveCharacter(event.target.value));
			this.root.querySelectorAll('[data-npc-action]').forEach(button => button.addEventListener('click', () => {
				const action = button.dataset.npcAction;
				if (!this.characterController) return;
				const workstation = this.workstations.get('desk_01');
				if (action === 'REST_POSE') { this.showRestPose(); return; }
				if (action === 'TOGGLE_SKELETON') { this.toggleSkeleton(); return; }
				if (action === 'PLAY_IDLE') { if (this.characters.get(this.activeCharacterId).retargetStatus === 'Failed') { this.showRestPose(); this.status = 'Lỗi chuyển động: bộ xương chưa tương thích.'; } else { this.characterController.stop(); this.status = 'Đang chạy Chờ việc.'; } return; }
				if (action === 'AUTO_WORK') { this.startNaturalWorkScenario(workstation); return; }
				this.scenario = null;
				if (action === 'GO_A' || action === 'GO_B' || action === 'GO_C') { const marker = this.markers[action.slice(-1)]; this.characterController.moveTo(marker); this.status = 'Đang đi tới Marker ' + action.slice(-1); return; }
				if (action === 'IDLE') { this.characterController.stop(); this.characterController.currentInteraction = null; this.characterController.targetObject = null; this.status = 'Đã chuyển Idle'; return; }
				if (action === 'GO_TO_DESK') { this.characterController.goToWorkstation(workstation); this.status = 'Đang đi tới chair_01.approachPoint'; return; }
				if (action === 'SIT') { const sitting = this.characterController.sit(workstation); this.status = sitting ? 'Đang phát chuyển động: Ngồi xuống' : 'Chưa có chuyển động: Ngồi xuống'; return; }
				if (action === 'WORK') { const typing = this.characterController.work(); this.status = typing ? 'Đang làm việc' : 'Typing animation không có · giữ Sitting Idle'; return; }
				if (action === 'STOP_WORK') { this.characterController.stopWork(); this.status = 'Dừng làm việc · Sitting Idle'; return; }
				if (action === 'STAND_UP') { const standing = this.characterController.standUp(workstation); this.status = standing ? 'Đang phát chuyển động: Đứng dậy' : 'Chưa có chuyển động: Đứng dậy'; }
			}));
		}

		randomDuration(minimum, maximum) { return minimum + Math.random() * (maximum - minimum); }

		availableScenarioSteps() {
			const states = global.LM_NPC_STATES;
			const definitions = [
				{ state: states.TYPING, label: 'Gõ bàn phím', minimum: 4.8, maximum: 7.2 },
				{ state: states.USING_MOUSE, label: 'Dùng chuột', minimum: 2.2, maximum: 3.8 },
				{ state: states.THINKING, label: 'Suy nghĩ', minimum: 2.8, maximum: 4.6 },
				{ state: states.READING, label: 'Đọc tài liệu', minimum: 3.6, maximum: 5.6 },
				{ state: states.WRITING, label: 'Viết tài liệu', minimum: 3.4, maximum: 5.2 }
			];
			return definitions.filter(step => this.animationController.hasAnimation(step.state));
		}

		startNaturalWorkScenario(workstation) {
			const states = global.LM_NPC_STATES;
			const available = this.availableScenarioSteps();
			if (!this.animationController.hasAnimation(states.SITTING_DOWN) || !this.animationController.hasAnimation(states.SITTING_IDLE)) {
				this.status = 'Không thể chạy tình huống: cần Ngồi xuống và Ngồi chờ.';
				return;
			}
			if (!available.length) { this.status = 'Không thể chạy tình huống: chưa có chuyển động làm việc tương thích.'; return; }
			this.characterController.stop();
			this.characterController.currentInteraction = null;
			this.characterController.targetObject = null;
			const preferred = [ states.TYPING, states.USING_MOUSE, states.TYPING, states.THINKING, states.READING, states.USING_MOUSE, states.TYPING ];
			const plan = preferred.map(state => available.find(step => step.state === state)).filter(Boolean);
			if (!plan.length) { this.status = 'Không thể tạo chuỗi hành động làm việc.'; return; }
			this.scenario = { phase: 'arriving', workstation, plan, index: 0, timer: 0 };
			this.characterController.goToWorkstation(workstation);
			this.status = 'Tình huống tự động: đang đi tới bàn làm việc.';
		}

		startScenarioStep() {
			const scenario = this.scenario;
			if (!scenario) return;
			const step = scenario.plan[scenario.index];
			if (!step) { scenario.phase = 'before-stand'; scenario.timer = this.randomDuration(1.4, 2.3); this.characterController.stopWork(); this.status = 'Tình huống tự động: hoàn tất công việc, chuẩn bị đứng dậy.'; return; }
			if (!this.characterController.performSeatedAction(step.state, 'computer_01')) { scenario.index += 1; this.startScenarioStep(); return; }
			scenario.phase = 'acting';
			scenario.timer = this.randomDuration(step.minimum, step.maximum);
			this.status = 'Tình huống tự động: ' + step.label + '.';
		}

		updateScenario(delta) {
			const scenario = this.scenario;
			if (!scenario) return;
			const states = global.LM_NPC_STATES;
			if (scenario.phase === 'arriving') {
				if (this.animationController.getState() === states.WAITING_AT_CHAIR) { this.status = 'Tình huống dừng: Chưa có chuyển động Ngồi xuống.'; this.scenario = null; return; }
				if (this.animationController.getState() === states.SITTING_IDLE && !this.characterController.getTarget()) { scenario.phase = 'before-action'; scenario.timer = this.randomDuration(.8, 1.5); this.status = 'Tình huống tự động: đã ngồi, bắt đầu công việc.'; }
				return;
			}
			if (scenario.phase === 'standing') {
				if (this.animationController.getState() === states.IDLE && !this.characterController.getTarget()) { this.status = 'Tình huống tự động đã hoàn tất · NPC đang Idle.'; this.scenario = null; }
				return;
			}
			scenario.timer -= delta;
			if (scenario.timer > 0) return;
			if (scenario.phase === 'before-action') { this.startScenarioStep(); return; }
			if (scenario.phase === 'acting') { this.characterController.stopWork(); scenario.index += 1; scenario.phase = 'between-actions'; scenario.timer = this.randomDuration(.65, 1.25); return; }
			if (scenario.phase === 'between-actions') { this.startScenarioStep(); return; }
			if (scenario.phase === 'before-stand') {
				if (!this.characterController.standUp(scenario.workstation)) { this.status = 'Tình huống kết thúc tại ghế: Chưa có chuyển động Đứng dậy.'; this.scenario = null; return; }
				scenario.phase = 'standing'; this.status = 'Tình huống tự động: đứng dậy và trở về Idle.';
			}
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
			if (missing && this.animationController) {
				const checks = [ [ global.LM_NPC_STATES.SITTING_DOWN, 'Ngồi xuống' ], [ global.LM_NPC_STATES.SITTING_IDLE, 'Ngồi chờ' ], [ global.LM_NPC_STATES.STANDING_UP, 'Đứng dậy' ], [ global.LM_NPC_STATES.TYPING, 'Gõ bàn phím' ], [ global.LM_NPC_STATES.USING_MOUSE, 'Dùng chuột' ], [ global.LM_NPC_STATES.THINKING, 'Suy nghĩ' ] ];
				const absent = checks.filter(check => !this.animationController.hasAnimation(check[0])).map(check => check[1]);
				missing.textContent = absent.length ? 'Thiếu: ' + absent.join(', ') + '.' : 'Đã có các chuyển động workstation chính.';
			}
		}

		start() { if (!this.animationFrame) this.animationFrame = global.requestAnimationFrame(time => this.tick(time)); }
			tick(time) {
			if (this.destroyed) return;
			this.animationFrame = global.requestAnimationFrame(next => this.tick(next));
			const delta = Math.min(0.05, this.previousTime ? (time - this.previousTime) / 1000 : 0);
			this.previousTime = time;
			if (this.characters) this.characters.forEach(record => { record.animationController.update(delta); record.characterController.update(delta); });
			this.updateScenario(delta);
			this.updatePanel();
			this.renderer.render(this.scene, this.camera);
		}

		updatePanel() {
			if (!this.characterController) return;
			const record = this.characters.get(this.activeCharacterId);
			const position = this.character.position;
			const target = this.characterController.getTarget();
			const value = (selector, text) => { const element = this.root.querySelector(selector); if (element) element.textContent = text; };
			value('[data-npc-character]', record.definition.id);
			value('[data-npc-skeleton]', record.skeletonStatus);
			value('[data-npc-retarget-profile]', record.definition.animation_profile || '—');
			value('[data-npc-source-skeleton]', record.sourceRig && record.sourceRig.skeleton ? record.sourceRig.skeleton.bones.length + ' bones' : 'Model native');
			value('[data-npc-target-skeleton]', record.skeleton.bones.length + ' bones');
			value('[data-npc-rest-pose-match]', record.retargetStatus === 'Direct' ? 'Có' : (record.retargetStatus === 'Failed' ? 'Không xác nhận' : 'Không — dùng retarget'));
			value('[data-npc-retarget]', record.retargetStatus);
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
			if (this.characters) this.characters.forEach(record => record.animationController.destroy());
			if (this.renderer) this.renderer.dispose();
		}
	}

	function boot(root) {
		if (root.dataset.npcReady) return;
		root.dataset.npcReady = '1';
		new NPCScene(root);
	}

	function bootAll() { document.querySelectorAll('[data-lm-npc-test]').forEach(boot); }
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAll); else bootAll();
	global.LM_NPCTestScene = { create: root => new NPCScene(root) };
})(window);
