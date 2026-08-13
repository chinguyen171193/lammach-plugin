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
				facePreview: null,
				appearance: null,
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
			this.viewMode = 'body';
			this.faceLoading = false;
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
			if (!global.THREE || !global.THREE.GLTFLoader || !global.LM_Agent3DStateMachine || !this.webglAvailable()) {
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
			this.renderer.domElement.className = 'lm-agent-3d__canvas';
			this.renderer.domElement.setAttribute('aria-label', 'LM Supervisor AI, nhân vật Quaternius 3D toàn thân');
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

		async showFacePreview() {
			const definition = this.options.facePreview || {};
			if (!definition.modelUrl || !global.LM_AgentFaceController || this.faceLoading || this.destroyed) return;

			if (!this.faceModel) {
				this.faceLoading = true;
				this.setFaceStatus('Đang tải mẫu khuôn mặt…');
				try {
					const asset = await this.load(versionedUrl(definition.modelUrl, this.options.assetVersion));
					if (this.destroyed) {
						this.disposeObject(asset.scene);
						return;
					}
					await this.installFaceModel(asset);
				} catch (error) {
					global.console.error('[LM AI Office Face Preview]', error);
					if (this.faceController) this.faceController.destroy();
					if (this.faceModel) {
						this.scene.remove(this.faceModel);
						this.disposeObject(this.faceModel);
					}
					this.faceController = null;
					this.faceModel = null;
					this.setFaceStatus('Không tải được mẫu khuôn mặt; Suit vẫn được giữ nguyên.');
					return;
				} finally {
					this.faceLoading = false;
				}
			}

			this.viewMode = 'face';
			this.debugPaused = false;
			this.model.visible = false;
			this.faceModel.visible = true;
			if (this.floor) this.floor.visible = false;
			if (this.ring) this.ring.visible = false;
			if (this.skeletonHelper) this.skeletonHelper.visible = false;
			if (this.boxHelper) this.boxHelper.visible = false;
			if (this.debugPanel) this.debugPanel.classList.add('is-face-preview');
			if (this.faceControls) this.faceControls.hidden = false;
			if (this.debugPauseButton) this.debugPauseButton.textContent = 'Pause face';
			this.faceController.reset();
			this.fitFaceCamera();
			this.setFaceStatus('Face Preview: Ready Player Me · ' + this.faceController.bindings.size + ' morph targets · không phát animation cơ thể');
			this.render();
			startScheduler();
		}

		async installFaceModel(modelAsset) {
			const THREE = global.THREE;
			this.faceModel = modelAsset.scene;
			this.faceAnimations = modelAsset.animations || [];
			this.faceModel.rotation.set(0, 0, 0);
			this.faceModel.position.set(0, 0, 0);
			this.faceModel.scale.set(1, 1, 1);
			this.faceModel.traverse(object => {
				// The official Visage sample is male but ships with carnival facewear
				// and a helmet. Hide only those verified accessory nodes so the
				// administrator can inspect the actual face and morph targets.
				if (object.name === 'Wolf3D_Facewear' || object.name === 'Wolf3D_Headwear') object.visible = false;
				if (object.isMesh) {
					object.castShadow = true;
					object.receiveShadow = true;
				}
			});
			this.scene.add(this.faceModel);
			try {
				await this.applyFaceTexture();
			} catch (error) {
				// A custom texture is optional. Keep the original GLB texture as a safe fallback.
				global.console.warn('[LM AI Office Face Preview] Không tải được texture tự vẽ, dùng texture gốc.', error);
			}
			this.faceModel.updateMatrixWorld(true);
			let box = new THREE.Box3().setFromObject(this.faceModel);
			const center = box.getCenter(new THREE.Vector3());
			this.faceModel.position.set(-center.x, -box.min.y, -center.z);
			this.faceModel.updateMatrixWorld(true);
			box = new THREE.Box3().setFromObject(this.faceModel);
			this.faceBounds = box;
			this.faceController = new global.LM_AgentFaceController(this.faceModel);
			this.printFaceDiagnostics();
		}

		loadTexture(url) {
			return new Promise((resolve, reject) => {
				new global.THREE.TextureLoader().load(url, resolve, undefined, reject);
			});
		}

		async applyFaceTexture() {
			const url = this.options.facePreview?.textureUrl;
			if (!url) return false;
			const texture = await this.loadTexture(versionedUrl(url, this.options.assetVersion));
			texture.encoding = global.THREE.sRGBEncoding;
			texture.flipY = false;
			let applied = false;
			this.faceModel.traverse(object => {
				if (!object.isMesh || object.name !== 'Wolf3D_Head') return;
				const original = Array.isArray(object.material) ? object.material[0] : object.material;
				if (!original) return;
				const material = original.clone();
				material.map = texture;
				material.needsUpdate = true;
				object.material = material;
				applied = true;
			});
			if (!applied) {
				texture.dispose();
				throw new Error('Không tìm thấy mesh Wolf3D_Head để áp texture');
			}
			this.faceTexture = texture;
			return true;
		}

		showBodyPreview() {
			if (!this.faceModel) return;
			this.viewMode = 'body';
			this.debugPaused = false;
			this.stateMachine.setPaused(false);
			this.faceController.reset();
			this.faceModel.visible = false;
			this.model.visible = true;
			if (this.floor) this.floor.visible = true;
			if (this.ring) this.ring.visible = true;
			if (this.debugPanel) this.debugPanel.classList.remove('is-face-preview');
			if (this.faceControls) this.faceControls.hidden = true;
			if (this.debugPauseButton) this.debugPauseButton.textContent = 'Pause';
			this.setFaceStatus('Suit toàn thân: animation cơ thể giữ nguyên');
			this.refreshBounds(true);
			this.render();
			startScheduler();
		}

		setFaceStatus(message) {
			if (this.faceStatus) this.faceStatus.textContent = message;
		}

		printFaceDiagnostics() {
			const THREE = global.THREE;
			const bones = [];
			const morphs = new Set();
			const meshes = [];
			this.faceModel.traverse(object => {
				if (object.isBone) bones.push(object.name || '(unnamed)');
				if (object.isMesh) {
					const names = Object.keys(object.morphTargetDictionary || {});
					names.forEach(name => morphs.add(name));
					meshes.push({ name: object.name || '(unnamed)', morphTargets: names.length });
				}
			});
			const box = this.faceBounds;
			global.console.groupCollapsed('[LM AI Office 3D Debug] Ready Player Me Face Preview');
			global.console.log('Bounding box:', {
				min: this.plainVector(box.min),
				max: this.plainVector(box.max),
				size: this.plainVector(box.getSize(new THREE.Vector3()))
			});
			global.console.log('Bones (' + bones.length + '):', bones);
			global.console.log('Embedded animation clips (' + this.faceAnimations.length + '):', this.faceAnimations.map(clip => clip.name));
			global.console.table(meshes);
			global.console.log('Morph targets (' + morphs.size + '):', Array.from(morphs));
			global.console.groupEnd();
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
			this.applyAppearance();
			this.scene.add(this.model);
			this.resetSkeletons();
			this.centerModelOnFloor();

			this.mixer = new THREE.AnimationMixer(this.model);
			this.stateMachine = new global.LM_Agent3DStateMachine(this.mixer, this.animations, this.options.states, { fadeDuration: this.options.fadeDuration });
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

		applyAppearance() {
			const appearance = this.options.appearance;
			if (!appearance) return;
			const colors = {
				Skin: appearance.skin_color,
				Hair: appearance.hair_color,
				Eyebrows: appearance.hair_color,
				Suit: appearance.suit_color,
				Tie: appearance.tie_color
			};
			this.model.traverse(object => {
				if (!object.isMesh) return;
				const materials = Array.isArray(object.material) ? object.material : [object.material];
				materials.forEach(material => {
					if (!material || !colors[material.name]) return;
					try {
						material.color.set(colors[material.name]);
						material.needsUpdate = true;
					} catch (error) { /* Invalid optional user colour: retain the model default. */ }
				});
			});
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
			global.console.groupCollapsed('[LM AI Office 3D Debug] Suit.gltf bind pose');
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
			panel.className = 'lm-agent-3d-debug';
			panel.setAttribute('aria-label', 'Điều khiển debug nhân vật 3D');

			const select = document.createElement('select');
			select.className = 'lm-agent-3d-debug__select';
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
			const faceButton = document.createElement('button');
			faceButton.type = 'button';
			faceButton.className = 'lm-agent-3d-debug__face-button';
			faceButton.textContent = 'Face Preview';
			faceButton.hidden = !(this.options.facePreview && this.options.facePreview.modelUrl && global.LM_AgentFaceController);
			const note = document.createElement('small');
			note.textContent = 'Suit không có Sit / Typing / Using Mouse';
			const faceStatus = document.createElement('small');
			faceStatus.className = 'lm-agent-3d-debug__face-status';
			faceStatus.textContent = 'Mẫu khuôn mặt chỉ tải khi bấm Face Preview';

			const faceControls = document.createElement('div');
			faceControls.className = 'lm-agent-face-debug';
			faceControls.hidden = true;
			const faceActions = [
				['Blink', () => this.faceController?.blink()],
				['Look ←', () => this.faceController?.setLook(-0.72, 0)],
				['Look •', () => this.faceController?.setLook(0, 0)],
				['Look →', () => this.faceController?.setLook(0.72, 0)],
				['Neutral', () => this.faceController?.setExpression('neutral')],
				['Focused', () => this.faceController?.setExpression('focused')],
				['Thinking', () => this.faceController?.setExpression('thinking')],
				['Happy', () => this.faceController?.setExpression('happy')],
				['Talking', () => this.faceController?.setExpression('talking')],
				['Toàn thân', () => this.showBodyPreview()]
			];
			faceActions.forEach(([label, action]) => {
				const button = document.createElement('button');
				button.type = 'button';
				button.textContent = label;
				this.listen(button, 'click', () => {
					action();
					if (label !== 'Toàn thân') {
						this.setFaceStatus('Face Preview · ' + label);
						startScheduler();
					}
				});
				faceControls.appendChild(button);
			});

			panel.append(select, skeletonLabel, boundsLabel, pauseButton, bindButton, faceButton, note, faceStatus, faceControls);
			const spriteContainer = this.container.closest('[data-agent-sprite]');
			if (spriteContainer && spriteContainer.parentNode) spriteContainer.parentNode.insertBefore(panel, spriteContainer.nextSibling);
			else this.container.appendChild(panel);
			this.debugPanel = panel;
			this.debugSelect = select;
			this.debugPauseButton = pauseButton;
			this.faceControls = faceControls;
			this.faceStatus = faceStatus;

			this.listen(select, 'change', () => {
				if (this.viewMode === 'face') this.showBodyPreview();
				if (select.value === '__bind__') this.resetBindPose(true);
				else this.playNativeClip(select.value, true);
			});
			this.listen(skeletonToggle, 'change', () => {
				if (this.viewMode === 'face') this.showBodyPreview();
				this.skeletonHelper.visible = skeletonToggle.checked;
				this.render();
			});
			this.listen(boundsToggle, 'change', () => {
				if (this.viewMode === 'face') this.showBodyPreview();
				this.boxHelper.visible = boundsToggle.checked;
				this.refreshBounds(false);
				this.render();
			});
			this.listen(pauseButton, 'click', () => {
				this.debugPaused = !this.debugPaused;
				if (this.viewMode === 'body') this.stateMachine.setPaused(this.debugPaused);
				pauseButton.textContent = this.debugPaused ? 'Play' : (this.viewMode === 'face' ? 'Pause face' : 'Pause');
				if (!this.debugPaused) startScheduler();
			});
			this.listen(bindButton, 'click', () => {
				if (this.viewMode === 'face') this.showBodyPreview();
				this.resetBindPose(true);
			});
			this.listen(faceButton, 'click', () => this.showFacePreview());
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

		fitFaceCamera() {
			if (!this.faceBounds || this.faceBounds.isEmpty()) return;
			const THREE = global.THREE;
			const size = this.faceBounds.getSize(new THREE.Vector3());
			const center = this.faceBounds.getCenter(new THREE.Vector3());
			const head = this.faceModel.getObjectByName('Head');
			const target = head ? head.getWorldPosition(new THREE.Vector3()) : center.clone();
			target.y -= size.y * 0.07;
			const previewHeight = Math.max(0.25, size.y * 0.4);
			const fill = Math.min(0.9, Math.max(0.72, Number(this.options.facePreview?.cameraFill) || 0.84));
			const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
			const distance = previewHeight / (2 * Math.tan(verticalFov / 2) * fill);
			this.camera.position.copy(target).add(new THREE.Vector3(0, 0.01, Math.max(0.42, distance)));
			this.camera.near = Math.max(0.01, distance * 0.2);
			this.camera.far = Math.max(10, distance + size.length() * 2);
			this.camera.lookAt(target);
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
			if (this.viewMode === 'face' && this.faceBounds) this.fitFaceCamera();
			else if (this.currentBounds) this.fitCamera(this.currentBounds);
			this.render();
		}

		render() {
			if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera);
		}

		tick(delta) {
			if (!this.ready || this.destroyed) return;
			if (!this.debugPaused && this.viewMode === 'body') this.stateMachine.update(delta);
			if (!this.debugPaused && this.viewMode === 'face' && this.faceController) this.faceController.update(delta);
			if (this.viewMode === 'body' && this.boxHelper && this.boxHelper.visible) {
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
			if (this.faceController) this.faceController.destroy();
			if (this.mixer && this.model) this.mixer.uncacheRoot(this.model);
			this.disposeObject(this.model);
			this.disposeObject(this.faceModel);
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

	global.LM_Agent3D = {
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
