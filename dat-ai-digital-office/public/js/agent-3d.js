(function (global) {
	'use strict';

	const instances = new Set();
	let animationFrame = 0;
	let previousTime = 0;

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
			const defaultStates = {
				idle: { clip: 'Idle', loop: true },
				walk: { clip: 'Walk', loop: true },
				reviewing: { clip: 'Idle_Neutral', loop: true },
				done: { clip: 'Wave', loop: false, afterState: 'idle' }
			};
			const defaults = {
				state: 'idle',
				stateMap: { idle: 'idle', working: 'walk', reviewing: 'reviewing', done: 'done' },
				states: defaultStates,
				startInBindPose: false,
				debug: false,
				cameraFill: 0.76,
				pixelRatio: 1.5,
				fadeDuration: 0.28,
				onError: null
			};
			this.options = Object.assign({}, defaults, options || {});
			this.options.stateMap = Object.assign({}, defaults.stateMap, (options && options.stateMap) || {});
			this.options.states = Object.assign({}, defaultStates, (options && options.states) || {});
			this.state = this.options.state;
			this.hasExternalStateChange = false;
			this.paused = false;
			this.debugPaused = false;
			this.destroyed = false;
			this.ready = false;
			this.debugListeners = [];
			this.boundsElapsed = 0;
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
			if (!global.THREE || !global.THREE.GLTFLoader || !global.DAT_Agent3DStateMachine || !this.webglAvailable()) {
				this.fail(new Error('Three.js, GLTFLoader hoặc WebGL không khả dụng'));
				return;
			}

			const THREE = global.THREE;
			this.scene = new THREE.Scene();
			this.camera = new THREE.PerspectiveCamera(30, 0.8, 0.01, 100);
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
			this.loadModel();
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
			this.floor = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.04, 48), floorMaterial);
			this.floor.receiveShadow = true;
			this.floor.position.y = -0.025;
			this.scene.add(this.floor);

			const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x4bddff, transparent: true, opacity: 0.4 });
			this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.01, 8, 64), ringMaterial);
			this.ring.rotation.x = Math.PI / 2;
			this.ring.position.y = 0.005;
			this.scene.add(this.ring);
		}

		load(url) {
			return new Promise((resolve, reject) => {
				new global.THREE.GLTFLoader().load(url, resolve, undefined, reject);
			});
		}

		async loadModel() {
			try {
				const model = await this.load(versionedUrl(this.options.modelUrl, this.options.assetVersion));
				if (!this.destroyed) this.installModel(model);
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

		isVisibleInHierarchy(object) {
			let current = object;
			while (current) {
				if (!current.visible) return false;
				current = current.parent;
			}
			return true;
		}

		computeSkinnedBounds() {
			const THREE = global.THREE;
			const box = new THREE.Box3();
			const vertex = new THREE.Vector3();
			let pointCount = 0;
			this.model.updateMatrixWorld(true);
			this.skinnedMeshes.forEach(mesh => {
				if (!this.isVisibleInHierarchy(mesh) || !mesh.geometry.attributes.position) return;
				mesh.skeleton.update();
				const count = mesh.geometry.attributes.position.count;
				for (let index = 0; index < count; index++) {
					vertex.fromBufferAttribute(mesh.geometry.attributes.position, index);
					mesh.boneTransform(index, vertex);
					vertex.applyMatrix4(mesh.matrixWorld);
					box.expandByPoint(vertex);
					pointCount++;
				}
			});
			return pointCount ? box : new THREE.Box3().setFromObject(this.model);
		}

		resetSkeletons() {
			this.skeletons.forEach(skeleton => skeleton.pose());
			this.model.updateMatrixWorld(true);
		}

		centerModelOnFloor() {
			this.model.position.set(0, 0, 0);
			this.model.rotation.set(0, -0.12, 0);
			this.model.scale.set(1, 1, 1);
			this.model.updateMatrixWorld(true);
			const box = this.computeSkinnedBounds();
			const center = box.getCenter(new global.THREE.Vector3());
			this.model.position.x -= center.x;
			this.model.position.y -= box.min.y;
			this.model.position.z -= center.z;
			this.model.updateMatrixWorld(true);
		}

		installModel(modelAsset) {
			const THREE = global.THREE;
			this.model = modelAsset.scene;
			this.animations = modelAsset.animations || [];
			this.targetMesh = this.findSkinnedMesh(this.model, 'Suit_Feet');
			if (!this.targetMesh || !this.targetMesh.skeleton || this.targetMesh.skeleton.bones.length !== 62) {
				throw new Error('Suit.gltf không đúng skeleton 62 joints');
			}
			if (!this.animations.some(clip => clip.name === 'Idle') || !this.animations.some(clip => clip.name === 'Walk')) {
				throw new Error('Suit.gltf thiếu native clip Idle hoặc Walk');
			}

			this.skinnedMeshes = [];
			const skeletonSet = new Set();
			this.model.traverse(object => {
				if (object.name === 'Pistol') object.visible = false;
				if (object.isSkinnedMesh) {
					this.skinnedMeshes.push(object);
					skeletonSet.add(object.skeleton);
				}
				if (object.isMesh) {
					object.castShadow = true;
					object.receiveShadow = true;
				}
			});
			this.skeletons = Array.from(skeletonSet);
			this.scene.add(this.model);
			this.resetSkeletons();
			this.centerModelOnFloor();

			this.mixer = new THREE.AnimationMixer(this.model);
			this.stateMachine = new global.DAT_Agent3DStateMachine(this.mixer, this.animations, this.options.states, { fadeDuration: this.options.fadeDuration });
			this.createHelpers();
			this.currentBounds = this.computeSkinnedBounds();
			if (this.options.debug) {
				this.printDiagnostics();
				this.createDebugControls();
			}

			if (this.options.startInBindPose && !this.hasExternalStateChange) this.resetBindPose(false);
			else this.playBusinessState(this.state, true);
			this.ready = true;
			this.container.closest('[data-agent-sprite]')?.classList.add('is-agent-3d-ready');
			this.resize();
			this.render();
			startScheduler();
		}

		createHelpers() {
			const THREE = global.THREE;
			this.skeletonHelper = new THREE.SkeletonHelper(this.model);
			this.skeletonHelper.visible = false;
			this.skeletonHelper.material.depthTest = false;
			this.skeletonHelper.material.transparent = true;
			this.skeletonHelper.material.opacity = 0.9;
			this.skeletonHelper.material.color.set(0xffc857);
			this.skeletonHelper.renderOrder = 8;
			this.scene.add(this.skeletonHelper);

			this.boxHelper = new THREE.Box3Helper(this.computeSkinnedBounds(), 0x4ce9a0);
			this.boxHelper.visible = false;
			this.boxHelper.material.depthTest = false;
			this.boxHelper.renderOrder = 9;
			this.scene.add(this.boxHelper);
		}

		plainVector(vector) {
			return vector.toArray().map(value => Number(value.toFixed(5)));
		}

		printDiagnostics() {
			const bones = this.targetMesh.skeleton.bones.map((bone, index) => ({
				index: index,
				name: bone.name,
				parent: bone.parent && bone.parent.isBone ? bone.parent.name : '(armature)',
				position: this.plainVector(bone.position).join(', '),
				quaternion: this.plainVector(bone.quaternion).join(', ')
			}));
			const clips = this.animations.map((clip, index) => ({ index: index, name: clip.name, duration: Number(clip.duration.toFixed(3)), tracks: clip.tracks.length }));
			const box = this.computeSkinnedBounds();
			global.console.groupCollapsed('[DAT AI Office 3D Debug] Suit.gltf bind pose');
			global.console.log('Root bone:', bones[0]);
			global.console.log('Model transform:', { position: this.plainVector(this.model.position), quaternion: this.plainVector(this.model.quaternion), scale: this.plainVector(this.model.scale) });
			global.console.log('Bounding box:', { min: this.plainVector(box.min), max: this.plainVector(box.max), size: this.plainVector(box.getSize(new global.THREE.Vector3())) });
			global.console.log('Bones (' + bones.length + '):');
			global.console.table(bones);
			global.console.log('Embedded animation clips (' + clips.length + '):');
			global.console.table(clips);
			global.console.groupEnd();
		}

		listen(element, event, callback) {
			element.addEventListener(event, callback);
			this.debugListeners.push(() => element.removeEventListener(event, callback));
		}

		createDebugControls() {
			const panel = document.createElement('div');
			panel.className = 'dat-agent-3d-debug';
			panel.setAttribute('aria-label', 'Điều khiển debug nhân vật 3D');

			const select = document.createElement('select');
			select.className = 'dat-agent-3d-debug__select';
			select.setAttribute('aria-label', 'Chọn animation nhúng sẵn');
			const bindOption = document.createElement('option');
			bindOption.value = '__bind__';
			bindOption.textContent = 'Bind pose';
			select.appendChild(bindOption);
			this.animations.forEach(clip => {
				const option = document.createElement('option');
				option.value = clip.name;
				option.textContent = clip.name;
				select.appendChild(option);
			});

			const skeletonLabel = document.createElement('label');
			const skeletonToggle = document.createElement('input');
			skeletonToggle.type = 'checkbox';
			skeletonLabel.append(skeletonToggle, document.createTextNode(' Xương'));

			const boundsLabel = document.createElement('label');
			const boundsToggle = document.createElement('input');
			boundsToggle.type = 'checkbox';
			boundsLabel.append(boundsToggle, document.createTextNode(' Bounds'));

			const pauseButton = document.createElement('button');
			pauseButton.type = 'button';
			pauseButton.textContent = 'Pause';
			const bindButton = document.createElement('button');
			bindButton.type = 'button';
			bindButton.textContent = 'Reset bind';
			const note = document.createElement('small');
			note.textContent = 'Suit không có Sit / Typing / Using Mouse';

			panel.append(select, skeletonLabel, boundsLabel, pauseButton, bindButton, note);
			const spriteContainer = this.container.closest('[data-agent-sprite]');
			if (spriteContainer && spriteContainer.parentNode) spriteContainer.parentNode.insertBefore(panel, spriteContainer.nextSibling);
			else this.container.appendChild(panel);
			this.debugPanel = panel;
			this.debugSelect = select;
			this.debugPauseButton = pauseButton;

			this.listen(select, 'change', () => {
				if (select.value === '__bind__') this.resetBindPose(true);
				else this.playNativeClip(select.value, true);
			});
			this.listen(skeletonToggle, 'change', () => {
				this.skeletonHelper.visible = skeletonToggle.checked;
				this.render();
			});
			this.listen(boundsToggle, 'change', () => {
				this.boxHelper.visible = boundsToggle.checked;
				this.refreshBounds(false);
				this.render();
			});
			this.listen(pauseButton, 'click', () => {
				this.debugPaused = !this.debugPaused;
				this.stateMachine.setPaused(this.debugPaused);
				pauseButton.textContent = this.debugPaused ? 'Play' : 'Pause';
			});
			this.listen(bindButton, 'click', () => this.resetBindPose(true));
		}

		visualState(state) {
			return this.options.stateMap[state] || state || 'idle';
		}

		playBusinessState(state, immediate) {
			const visual = this.visualState(state);
			this.debugPaused = false;
			this.stateMachine.setPaused(false);
			this.stateMachine.setState(visual, immediate);
			this.stateMachine.update(0);
			if (this.debugSelect) {
				const definition = this.options.states[visual];
				if (definition && definition.clip) this.debugSelect.value = definition.clip;
			}
			if (this.debugPauseButton) this.debugPauseButton.textContent = 'Pause';
			this.refreshBounds(true);
		}

		playNativeClip(clipName, fitCamera) {
			this.debugPaused = false;
			this.stateMachine.setPaused(false);
			this.stateMachine.currentState = '';
			this.stateMachine.playClip(clipName, { loop: true, immediate: false });
			this.stateMachine.update(0);
			if (this.debugSelect) this.debugSelect.value = clipName;
			if (this.debugPauseButton) this.debugPauseButton.textContent = 'Pause';
			this.refreshBounds(Boolean(fitCamera));
			startScheduler();
		}

		resetBindPose(fitCamera) {
			if (this.stateMachine) this.stateMachine.stop();
			this.resetSkeletons();
			this.debugPaused = false;
			if (this.stateMachine) this.stateMachine.setPaused(false);
			if (this.debugSelect) this.debugSelect.value = '__bind__';
			if (this.debugPauseButton) this.debugPauseButton.textContent = 'Pause';
			this.refreshBounds(Boolean(fitCamera));
			this.render();
		}

		setState(state) {
			this.state = state || 'idle';
			this.hasExternalStateChange = true;
			if (this.stateMachine) this.playBusinessState(this.state, false);
			return this;
		}

		setPaused(paused) {
			this.paused = Boolean(paused);
			if (!this.paused) startScheduler();
			return this;
		}

		refreshBounds(updateCamera) {
			if (!this.model) return;
			this.currentBounds = this.computeSkinnedBounds();
			if (this.boxHelper) this.boxHelper.box.copy(this.currentBounds);
			if (updateCamera) this.fitCamera(this.currentBounds);
		}

		fitCamera(box) {
			if (!box || box.isEmpty()) return;
			const THREE = global.THREE;
			const size = box.getSize(new THREE.Vector3());
			const center = box.getCenter(new THREE.Vector3());
			const fill = Math.min(0.82, Math.max(0.7, Number(this.options.cameraFill) || 0.76));
			const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
			const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.1, this.camera.aspect));
			const heightDistance = size.y / (2 * Math.tan(verticalFov / 2) * fill);
			const widthDistance = size.x / (2 * Math.tan(horizontalFov / 2) * 0.9);
			const distance = Math.max(heightDistance, widthDistance, 0.5) * 1.08;
			const direction = new THREE.Vector3(0.32, 0.08, 1).normalize();
			this.camera.position.copy(center).addScaledVector(direction, distance);
			this.camera.near = Math.max(0.01, distance - size.length() * 1.5);
			this.camera.far = distance + size.length() * 3;
			this.camera.lookAt(center);
			this.camera.updateProjectionMatrix();
			this.camera.updateMatrixWorld(true);
		}

		resize() {
			if (!this.renderer || !this.camera) return;
			const width = Math.max(1, this.container.clientWidth || 240);
			const height = Math.max(1, this.container.clientHeight || 300);
			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(width, height, false);
			if (this.currentBounds) this.fitCamera(this.currentBounds);
			this.render();
		}

		render() {
			if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
		}

		tick(delta) {
			if (!this.ready || this.destroyed) return;
			if (!this.debugPaused) this.stateMachine.update(delta);
			if (this.boxHelper && this.boxHelper.visible) {
				this.boundsElapsed += delta;
				if (this.boundsElapsed >= 0.2) {
					this.boundsElapsed = 0;
					this.refreshBounds(false);
				}
			}
			this.render();
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
			this.debugListeners.forEach(remove => remove());
			this.debugListeners = [];
			if (this.resizeObserver) this.resizeObserver.disconnect();
			if (this.stateMachine) this.stateMachine.destroy();
			if (this.mixer && this.model) this.mixer.uncacheRoot(this.model);
			this.disposeObject(this.model);
			this.disposeObject(this.floor);
			this.disposeObject(this.ring);
			this.disposeObject(this.skeletonHelper);
			this.disposeObject(this.boxHelper);
			if (this.renderer) {
				this.renderer.dispose();
				this.renderer.forceContextLoss();
				this.renderer.domElement.remove();
			}
			if (this.debugPanel) this.debugPanel.remove();
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
