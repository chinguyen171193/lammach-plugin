(function (global) {
	'use strict';

	const instances = new Set();
	let animationFrame = 0;
	let previousTime = 0;

	// GLTFLoader removes punctuation from node names (for example Shoulder.L
	// becomes ShoulderL), so this map uses the runtime names, not raw JSON names.
	const boneMap = {
		Root: 'root',
		Hips: 'pelvis',
		Abdomen: 'spine_01',
		Torso: 'spine_02',
		Chest: 'spine_03',
		Neck: 'neck_01',
		Head: 'Head',
		ShoulderL: 'clavicle_l',
		UpperArmL: 'upperarm_l',
		LowerArmL: 'lowerarm_l',
		WristL: 'hand_l',
		ShoulderR: 'clavicle_r',
		UpperArmR: 'upperarm_r',
		LowerArmR: 'lowerarm_r',
		WristR: 'hand_r',
		UpperLegL: 'thigh_l',
		LowerLegL: 'calf_l',
		FootL: 'foot_l',
		PTL: 'ball_l',
		UpperLegR: 'thigh_r',
		LowerLegR: 'calf_r',
		FootR: 'foot_r',
		PTR: 'ball_r'
	};

	['Index', 'Middle', 'Ring', 'Pinky'].forEach(finger => {
		['L', 'R'].forEach(side => {
			const suffix = side.toLowerCase();
			for (let joint = 1; joint <= 4; joint++) {
				boneMap[finger + joint + side] = finger.toLowerCase() + '_0' + joint + (joint === 4 ? '_leaf_' : '_') + suffix;
			}
		});
	});

	['L', 'R'].forEach(side => {
		const suffix = side.toLowerCase();
		for (let joint = 1; joint <= 3; joint++) {
			boneMap['Thumb' + joint + side] = 'thumb_0' + joint + '_' + suffix;
		}
	});

	function versionedUrl(url, version) {
		if (!version) return url;
		return url + (url.indexOf('?') === -1 ? '?' : '&') + 'ver=' + encodeURIComponent(version);
	}

	function startScheduler() {
		const active = Array.from(instances).some(instance => !instance.paused && !instance.destroyed && instance.ready);
		if (!animationFrame && !document.hidden && active) animationFrame = global.requestAnimationFrame(tick);
	}

	function tick(time) {
		animationFrame = 0;
		const delta = Math.min(0.05, previousTime ? (time - previousTime) / 1000 : 0);
		previousTime = time;
		instances.forEach(instance => {
			if (!instance.paused && !instance.destroyed && instance.ready) instance.tick(delta);
		});
		startScheduler();
	}

	document.addEventListener('visibilitychange', () => {
		previousTime = 0;
		if (!document.hidden) startScheduler();
	});

	class QuaterniusAgent3D {
		constructor(container, options) {
			this.container = container;
			const defaults = {
				state: 'idle',
				stateMap: { idle: 'idle', working: 'walk', reviewing: 'sit', done: 'stand' },
				clips: {
					idle: 'Idle_Loop',
					walk: 'Walk_Loop',
					sitEnter: 'Sitting_Enter',
					sitIdle: 'Sitting_Idle_Loop',
					stand: 'Sitting_Exit'
				},
				pixelRatio: 1.5,
				fadeDuration: 0.32,
				onError: null
			};
			this.options = Object.assign({}, defaults, options || {});
			this.options.stateMap = Object.assign({}, defaults.stateMap, (options && options.stateMap) || {});
			this.options.clips = Object.assign({}, defaults.clips, (options && options.clips) || {});
			this.state = this.options.state;
			this.paused = false;
			this.destroyed = false;
			this.ready = false;
			this.init();
		}

		webglAvailable() {
			try {
				const canvas = document.createElement('canvas');
				return Boolean(global.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
			} catch (error) {
				return false;
			}
		}

		init() {
			if (!global.THREE || !global.THREE.GLTFLoader || !global.THREE.SkeletonUtils || !global.DAT_Agent3DStateMachine || !this.webglAvailable()) {
				this.fail(new Error('Three.js hoặc WebGL không khả dụng'));
				return;
			}

			const THREE = global.THREE;
			this.scene = new THREE.Scene();
			this.camera = new THREE.PerspectiveCamera(30, 0.8, 0.05, 100);
			this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
			this.renderer.setClearColor(0x000000, 0);
			this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, Number(this.options.pixelRatio) || 1.5));
			this.renderer.outputEncoding = THREE.sRGBEncoding;
			this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
			this.renderer.toneMappingExposure = 1.08;
			this.renderer.shadowMap.enabled = true;
			this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			this.renderer.domElement.className = 'dat-agent-3d__canvas';
			this.renderer.domElement.setAttribute('aria-label', 'DAT Supervisor AI, nhân vật Quaternius 3D toàn thân');
			this.renderer.domElement.addEventListener('webglcontextlost', event => {
				event.preventDefault();
				this.fail(new Error('WebGL context bị mất'));
			}, { once: true });
			this.container.replaceChildren(this.renderer.domElement);

			this.addLights();
			this.addOfficeStage();
			this.resize();
			this.resizeObserver = 'ResizeObserver' in global ? new ResizeObserver(() => this.resize()) : null;
			if (this.resizeObserver) this.resizeObserver.observe(this.container);
			instances.add(this);
			this.loadAssets();
		}

		addLights() {
			const THREE = global.THREE;
			this.scene.add(new THREE.HemisphereLight(0xd7f2ff, 0x07111d, 1.8));
			const key = new THREE.DirectionalLight(0xffffff, 2.2);
			key.position.set(3.5, 6, 4.5);
			key.castShadow = true;
			key.shadow.mapSize.set(512, 512);
			this.scene.add(key);
			const rim = new THREE.PointLight(0x41ddff, 1.8, 9);
			rim.position.set(-3, 3, -2);
			this.scene.add(rim);
		}

		addOfficeStage() {
			const THREE = global.THREE;
			const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x0a2637, roughness: 0.82, metalness: 0.1, transparent: true, opacity: 0.9 });
			this.floor = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.055, 48), floorMaterial);
			this.floor.receiveShadow = true;
			this.floor.position.y = -0.035;
			this.scene.add(this.floor);

			const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x4bddff, transparent: true, opacity: 0.42 });
			this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.012, 8, 64), ringMaterial);
			this.ring.rotation.x = Math.PI / 2;
			this.ring.position.y = 0.005;
			this.scene.add(this.ring);

			const chairMaterial = new THREE.MeshStandardMaterial({ color: 0x173247, roughness: 0.72, metalness: 0.12 });
			const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x2c5266, roughness: 0.35, metalness: 0.7 });
			this.chair = new THREE.Group();
			const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.62), chairMaterial);
			seat.position.set(0, 0.55, -0.18);
			const back = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.82, 0.12), chairMaterial);
			back.position.set(0, 0.95, -0.47);
			back.rotation.x = -0.08;
			const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.5, 12), metalMaterial);
			stem.position.set(0, 0.28, -0.18);
			this.chair.add(seat, back, stem);
			this.chair.visible = false;
			this.scene.add(this.chair);
		}

		load(url) {
			return new Promise((resolve, reject) => {
				new global.THREE.GLTFLoader().load(url, resolve, undefined, reject);
			});
		}

		async loadAssets() {
			try {
				const modelUrl = versionedUrl(this.options.modelUrl, this.options.assetVersion);
				const animationUrl = versionedUrl(this.options.animationUrl, this.options.assetVersion);
				const loaded = await Promise.all([this.load(modelUrl), this.load(animationUrl)]);
				if (this.destroyed) return;
				this.installModel(loaded[0], loaded[1]);
			} catch (error) {
				this.fail(error);
			}
		}

		findSkinnedMesh(root, preferredName) {
			let preferred = null;
			let first = null;
			root.traverse(object => {
				if (!object.isSkinnedMesh) return;
				if (!first) first = object;
				if (object.name === preferredName) preferred = object;
			});
			return preferred || first;
		}

		findClip(animations, name) {
			const clip = animations.find(candidate => candidate.name === name);
			if (!clip) throw new Error('Không tìm thấy animation thật: ' + name);
			return clip;
		}

		retargetClips(targetMesh, sourceMesh, animations) {
			const clips = {};
			const hips = targetMesh.skeleton.bones.find(bone => bone.name === 'Hips');
			if (!hips) throw new Error('Skeleton Suit không có bone Hips');
			const hipsRestPosition = hips.position.clone();
			const mappedBones = targetMesh.skeleton.bones.filter(bone => {
				const sourceName = boneMap[bone.name];
				return sourceName && global.THREE.SkeletonUtils.getBoneByName(sourceName, sourceMesh.skeleton);
			});
			if (mappedBones.length < 50) throw new Error('Skeleton không tương thích: chỉ ánh xạ được ' + mappedBones.length + ' bones');

			Object.keys(this.options.clips).forEach(key => {
				const sourceClip = this.findClip(animations, this.options.clips[key]);
				const converted = global.THREE.SkeletonUtils.retargetClip(targetMesh, sourceMesh, sourceClip, {
					fps: 30,
					hip: 'pelvis',
					names: boneMap,
					preservePosition: true,
					preserveHipPosition: false,
					useFirstFramePosition: true
				});
				const hipTrack = converted.tracks.find(track => track.name === '.bones[Hips].position');
				if (hipTrack) {
					for (let index = 0; index < hipTrack.values.length; index += 3) {
						hipTrack.values[index] = hipsRestPosition.x;
						hipTrack.values[index + 1] += hipsRestPosition.y;
						hipTrack.values[index + 2] = hipsRestPosition.z;
					}
				}
				converted.name = sourceClip.name;
				clips[key] = converted;
			});

			targetMesh.skeleton.pose();
			targetMesh.updateMatrixWorld(true);
			return clips;
		}

		installModel(modelAsset, animationAsset) {
			const THREE = global.THREE;
			modelAsset.scene.updateMatrixWorld(true);
			animationAsset.scene.updateMatrixWorld(true);
			const targetMesh = this.findSkinnedMesh(modelAsset.scene, 'Suit_Feet');
			const sourceMesh = this.findSkinnedMesh(animationAsset.scene, 'Mannequin_1');
			if (!targetMesh || !sourceMesh) throw new Error('Không tìm thấy SkinnedMesh yêu cầu');
			if (!targetMesh.skeleton || targetMesh.skeleton.bones.length !== 62) throw new Error('Suit.gltf không đúng skeleton 62 joints đã kiểm tra');
			if (!sourceMesh.skeleton || sourceMesh.skeleton.bones.length !== 65) throw new Error('UAL1_Standard.glb không đúng skeleton 65 joints đã kiểm tra');

			const clips = this.retargetClips(targetMesh, sourceMesh, animationAsset.animations);
			this.model = modelAsset.scene;
			this.model.traverse(object => {
				if (object.name === 'Pistol') object.visible = false;
				if (object.isMesh) {
					object.castShadow = true;
					object.receiveShadow = true;
				}
			});
			this.normalizeModel();
			this.scene.add(this.model);

			this.targetMesh = targetMesh;
			this.mixer = new THREE.AnimationMixer(this.targetMesh);
			this.stateMachine = new global.DAT_Agent3DStateMachine(this.mixer, clips, { fadeDuration: this.options.fadeDuration });
			const initialVisualState = this.visualState(this.state);
			this.chair.visible = initialVisualState === 'sit' || initialVisualState === 'stand';
			this.stateMachine.setState(initialVisualState, true);
			this.disposeObject(animationAsset.scene);
			this.ready = true;
			this.container.closest('[data-agent-sprite]')?.classList.add('is-agent-3d-ready');
			this.resize();
			this.tick(0);
			startScheduler();
		}

		normalizeModel() {
			const THREE = global.THREE;
			const initialBox = new THREE.Box3().setFromObject(this.model);
			const initialSize = initialBox.getSize(new THREE.Vector3());
			const scale = 2.55 / Math.max(0.001, initialSize.y);
			this.model.scale.setScalar(scale);
			this.model.updateMatrixWorld(true);

			const box = new THREE.Box3().setFromObject(this.model);
			const center = box.getCenter(new THREE.Vector3());
			this.model.position.x -= center.x;
			this.model.position.y -= box.min.y;
			this.model.position.z -= center.z;
			this.model.rotation.y = -0.12;
			this.model.updateMatrixWorld(true);

			this.camera.position.set(3.35, 2.05, 6.4);
			this.camera.lookAt(0, 1.25, 0);
		}

		visualState(state) {
			return this.options.stateMap[state] || state || 'idle';
		}

		setState(state) {
			this.state = state || 'idle';
			if (this.stateMachine) {
				const visual = this.visualState(this.state);
				this.chair.visible = visual === 'sit' || visual === 'stand';
				this.stateMachine.setState(visual, false);
			}
			return this;
		}

		setPaused(paused) {
			this.paused = Boolean(paused);
			if (!this.paused) startScheduler();
			return this;
		}

		resize() {
			if (!this.renderer || !this.camera) return;
			const width = Math.max(1, this.container.clientWidth || 240);
			const height = Math.max(1, this.container.clientHeight || 300);
			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(width, height, false);
		}

		tick(delta) {
			if (!this.ready || this.destroyed) return;
			this.stateMachine.update(delta);
			this.renderer.render(this.scene, this.camera);
		}

		disposeObject(root) {
			if (!root) return;
			const materials = new Set();
			root.traverse(object => {
				if (object.geometry) object.geometry.dispose();
				if (Array.isArray(object.material)) object.material.forEach(material => materials.add(material));
				else if (object.material) materials.add(object.material);
			});
			materials.forEach(material => {
				Object.keys(material).forEach(key => {
					if (material[key] && material[key].isTexture) material[key].dispose();
				});
				material.dispose();
			});
		}

		fail(error) {
			if (this.destroyed) return;
			this.container.closest('[data-agent-sprite]')?.classList.add('is-agent-3d-error');
			if (typeof this.options.onError === 'function') this.options.onError(error);
		}

		destroy() {
			if (this.destroyed) return;
			this.destroyed = true;
			instances.delete(this);
			if (this.resizeObserver) this.resizeObserver.disconnect();
			if (this.stateMachine) this.stateMachine.destroy();
			if (this.mixer && this.targetMesh) this.mixer.uncacheRoot(this.targetMesh);
			this.disposeObject(this.model);
			this.disposeObject(this.floor);
			this.disposeObject(this.ring);
			this.disposeObject(this.chair);
			if (this.renderer) {
				this.renderer.dispose();
				this.renderer.forceContextLoss();
				this.renderer.domElement.remove();
			}
		}
	}

	global.DAT_Agent3D = {
		create(container, options) {
			try {
				return new QuaterniusAgent3D(container, options);
			} catch (error) {
				if (options && typeof options.onError === 'function') options.onError(error);
				return null;
			}
		}
	};
})(window);
