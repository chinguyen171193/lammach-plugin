(function (global) {
	'use strict';

	const TARGET_HEIGHT_METERS = 1.72;
	const EXPECTED_THREE_REVISION = '128';
	// This is the only allowed orientation adjustment. Verify it with the axes
	// helper after the reference asset is installed; never alter a bone to rotate.
	const MODEL_FORWARD_CORRECTION_RADIANS = 0;

	function versionedUrl(url, version) {
		return version ? url + (url.indexOf('?') === -1 ? '?' : '&') + 'ver=' + encodeURIComponent(version) : url;
	}

	function findSkinnedMeshes(model) {
		const meshes = [];
		model.traverse(object => { if (object.isSkinnedMesh && object.skeleton) meshes.push(object); });
		return meshes;
	}

	class OrbitCamera {
		constructor(camera, element) {
			this.camera = camera; this.element = element; this.target = new global.THREE.Vector3(0, 0.85, 0); this.radius = 5.8; this.theta = 0.6; this.phi = 1.08; this.pointer = null;
			this.onPointerDown = event => { this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, button: event.button }; this.element.setPointerCapture(event.pointerId); };
			this.onPointerMove = event => {
				if (!this.pointer || this.pointer.id !== event.pointerId) return;
				const dx = event.clientX - this.pointer.x; const dy = event.clientY - this.pointer.y; this.pointer.x = event.clientX; this.pointer.y = event.clientY;
				if (this.pointer.button === 2) this.pan(dx, dy); else { this.theta -= dx * 0.008; this.phi = Math.max(0.18, Math.min(Math.PI - 0.18, this.phi + dy * 0.008)); }
				this.update();
			};
			this.onPointerUp = event => { if (this.pointer && this.pointer.id === event.pointerId) this.pointer = null; };
			this.onWheel = event => { event.preventDefault(); this.radius = Math.max(3.2, Math.min(14, this.radius + event.deltaY * 0.008)); this.update(); };
			element.addEventListener('pointerdown', this.onPointerDown); element.addEventListener('pointermove', this.onPointerMove); element.addEventListener('pointerup', this.onPointerUp); element.addEventListener('pointercancel', this.onPointerUp); element.addEventListener('wheel', this.onWheel, { passive: false }); element.addEventListener('contextmenu', event => event.preventDefault()); this.update();
		}
		pan(dx, dy) {
			const amount = this.radius * 0.0015; const right = new global.THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0); right.y = 0; right.normalize().multiplyScalar(-dx * amount);
			const forward = new global.THREE.Vector3(); this.camera.getWorldDirection(forward); forward.y = 0; forward.normalize().multiplyScalar(-dy * amount); this.target.add(right).add(forward);
		}
		update() { this.camera.position.setFromSphericalCoords(this.radius, this.phi, this.theta).add(this.target); this.camera.lookAt(this.target); }
		destroy() { const e = this.element; e.removeEventListener('pointerdown', this.onPointerDown); e.removeEventListener('pointermove', this.onPointerMove); e.removeEventListener('pointerup', this.onPointerUp); e.removeEventListener('pointercancel', this.onPointerUp); e.removeEventListener('wheel', this.onWheel); }
	}

	class NPCScene {
		constructor(root) {
			this.root = root; this.canvasHost = root.querySelector('[data-npc-canvas]'); this.destroyed = false; this.previousTime = 0; this.frame = 0; this.restPoseReviewed = false; this.record = null;
			this.init();
		}

		init() {
			const dependencyError = this.checkDependencies();
			if (dependencyError) return this.showError(dependencyError);
			this.scene = new global.THREE.Scene(); this.scene.background = new global.THREE.Color(0x07121c);
			this.camera = new global.THREE.PerspectiveCamera(42, 1, 0.01, 100);
			this.renderer = new global.THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
			this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2)); this.renderer.outputEncoding = global.THREE.sRGBEncoding; this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = global.THREE.PCFSoftShadowMap; this.renderer.domElement.className = 'lm-npc-test__canvas'; this.canvasHost.appendChild(this.renderer.domElement);
			this.addTestStage(); this.orbit = new OrbitCamera(this.camera, this.renderer.domElement); this.bindPanel(); this.observeResize(); this.resize(); this.loadReferenceCharacter();
		}

		checkDependencies() {
			const format = this.root.dataset.npcModelFormat; const report = { expectedThreeRevision: EXPECTED_THREE_REVISION, threeRevision: global.THREE && global.THREE.REVISION || null, fflate: typeof global.fflate === 'object', fbxLoader: Boolean(global.THREE && global.THREE.FBXLoader), gltfLoader: Boolean(global.THREE && global.THREE.GLTFLoader), modelFormat: format };
			global.LM_NPC_DEPENDENCY_REPORT = report;
			global.console.log('THREE', report.threeRevision);
			global.console.info('[LM AI Office NPC] dependency check', report);
			if (!global.THREE) return 'Dependency failed: THREE is missing (public/js/vendor/three.min.js).';
			if (String(global.THREE.REVISION) !== EXPECTED_THREE_REVISION) return 'Dependency failed: THREE revision mismatch. Expected ' + EXPECTED_THREE_REVISION + ', received ' + global.THREE.REVISION + '.';
			if (global.__LM_AI_OFFICE_THREE_REVISION__ && global.__LM_AI_OFFICE_THREE_REVISION__ !== global.THREE.REVISION) return 'Dependency failed: more than one Three.js revision is active (' + global.__LM_AI_OFFICE_THREE_REVISION__ + ' and ' + global.THREE.REVISION + ').';
			global.__LM_AI_OFFICE_THREE_REVISION__ = global.THREE.REVISION;
			if (format === 'fbx' && typeof global.fflate !== 'object') return 'Dependency failed: fflate is missing (required by FBXLoader).';
			if (format === 'fbx' && !global.THREE.FBXLoader) return 'Dependency failed: FBXLoader is missing (public/js/vendor/FBXLoader.js).';
			if ((format === 'glb' || format === 'gltf') && !global.THREE.GLTFLoader) return 'Dependency failed: GLTFLoader is missing (public/js/vendor/GLTFLoader.js).';
			return '';
		}

		addTestStage() {
			const THREE = global.THREE; this.scene.add(new THREE.HemisphereLight(0xdaf3ff, 0x172530, 2.2));
			const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(4, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); this.scene.add(key);
			const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshStandardMaterial({ color: 0x183244, roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor, new THREE.GridHelper(18, 18, 0x35596d, 0x244250));
		}

		observeResize() { if ('ResizeObserver' in global) { this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.canvasHost); } else { this.resizeHandler = () => this.resize(); global.addEventListener('resize', this.resizeHandler); } }
		resize() { const width = this.canvasHost.clientWidth; const height = this.canvasHost.clientHeight; if (!width || !height || !this.renderer) return; this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height, false); }

		async loadReferenceCharacter() {
			if (this.root.dataset.npcModelAvailable !== 'true') return this.showError('Không thể tải asset từ Google Drive. Hãy đặt file model vào đường dẫn sau: ' + this.root.dataset.npcModelPath);
			try {
				const url = versionedUrl(this.root.dataset.npcModelUrl, this.root.dataset.npcVersion); const format = this.root.dataset.npcModelFormat;
				const result = await this.loadModel(url, format);
				if (this.destroyed) return;
				this.installReferenceCharacter(result.model, result.animations);
				this.start();
			} catch (error) {
				global.console.error('[LM AI Office NPC] REFERENCE_CHARACTER_V1 failed to load', error);
				this.showError('Không thể tải REFERENCE_CHARACTER_V1. Hãy kiểm tra file model tại: ' + this.root.dataset.npcModelPath);
			}
		}

		loadModel(url, format) {
			if (format === 'fbx' && global.THREE.FBXLoader) return new Promise((resolve, reject) => new global.THREE.FBXLoader().load(url, model => resolve({ model, animations: model.animations || [] }), undefined, reject));
			if ((format === 'glb' || format === 'gltf') && global.THREE.GLTFLoader) return new Promise((resolve, reject) => new global.THREE.GLTFLoader().load(url, gltf => resolve({ model: gltf.scene, animations: gltf.animations || [] }), undefined, reject));
			return Promise.reject(new Error('Character loader không hỗ trợ định dạng: ' + format));
		}

		installReferenceCharacter(importedCharacter, embeddedClips) {
			const THREE = global.THREE;
			const npcRoot = new THREE.Group(); npcRoot.name = 'NPCRoot';
			const modelContainer = new THREE.Group(); modelContainer.name = 'ModelContainer'; modelContainer.rotation.y = MODEL_FORWARD_CORRECTION_RADIANS;
			importedCharacter.name = 'ImportedCharacter'; modelContainer.add(importedCharacter); npcRoot.add(modelContainer); this.scene.add(npcRoot);
			importedCharacter.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
			const normalization = this.normalizeModel(modelContainer); const forwardAxes = new THREE.AxesHelper(0.45); forwardAxes.name = 'ModelForwardAxisDebug'; modelContainer.add(forwardAxes); const skeletonMeshes = findSkinnedMeshes(importedCharacter);
			const clips = embeddedClips.slice();
			this.record = { npcRoot, modelContainer, importedCharacter, skeletonMeshes, clips, skeletonHelper: null };
			this.renderDiagnostics(normalization, skeletonMeshes, clips);
			this.showStatus('READY — Model loaded successfully – rig detected – ' + clips.length + ' embedded animations.');
		}

		normalizeModel(modelContainer) {
			const THREE = global.THREE; modelContainer.updateMatrixWorld(true); const initialBox = new THREE.Box3().setFromObject(modelContainer); const originalHeight = initialBox.getSize(new THREE.Vector3()).y;
			if (!Number.isFinite(originalHeight) || originalHeight <= 0) throw new Error('Không đo được chiều cao model.');
			const scaleFactor = TARGET_HEIGHT_METERS / originalHeight; modelContainer.scale.setScalar(scaleFactor); modelContainer.updateMatrixWorld(true);
			const scaledBox = new THREE.Box3().setFromObject(modelContainer); modelContainer.position.y -= scaledBox.min.y; modelContainer.updateMatrixWorld(true);
			const finalHeight = new THREE.Box3().setFromObject(modelContainer).getSize(new THREE.Vector3()).y;
			global.console.info('[LM AI Office NPC] model normalization', { originalModelHeight: originalHeight, targetHeight: TARGET_HEIGHT_METERS, appliedRootScale: scaleFactor, finalWorldHeight: finalHeight, modelForwardCorrection: MODEL_FORWARD_CORRECTION_RADIANS });
			return { originalHeight, scaleFactor, finalHeight };
		}

		renderDiagnostics(normalization, meshes, clips) {
			const set = (selector, value) => { const node = this.root.querySelector(selector); if (node) node.textContent = value; };
			set('[data-npc-height]', normalization.originalHeight.toFixed(3) + 'm → ' + normalization.finalHeight.toFixed(3) + 'm (scale ' + normalization.scaleFactor.toFixed(5) + ')'); set('[data-npc-model-forward]', 'local +Z (blue debug axis)'); set('[data-npc-forward]', (MODEL_FORWARD_CORRECTION_RADIANS * 180 / Math.PI).toFixed(1) + '°');
			const boneCount = meshes.reduce((count, mesh) => count + mesh.skeleton.bones.length, 0); set('[data-npc-skeleton]', meshes.length ? boneCount + ' bones / ' + meshes.length + ' skinned mesh(es)' : 'Model không có skeleton');
			const clipList = this.root.querySelector('[data-npc-clips]'); clipList.innerHTML = clips.length ? clips.map(clip => '<li>' + this.escape(clip.name) + ' · ' + Number(clip.duration.toFixed(3)) + 's · ' + clip.tracks.length + ' tracks</li>').join('') : '<li>0 animations</li>';
			const boneList = this.root.querySelector('[data-npc-bones]'); const bones = meshes.length ? meshes[0].skeleton.bones : [];
			boneList.innerHTML = bones.length ? bones.map(bone => '<li>' + this.escape(bone.name) + (bone.parent && bone.parent.isBone ? ' ← ' + this.escape(bone.parent.name) : ' (root)') + '</li>').join('') : '<li>Không có skeleton.</li>';
			global.console.groupCollapsed('[LM AI Office NPC] embedded animation clips'); global.console.table(clips.map(clip => ({ name: clip.name, duration: clip.duration, tracks: clip.tracks.length }))); global.console.groupEnd();
		}

		escape(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }

		bindPanel() {
			this.root.querySelectorAll('[data-npc-action]').forEach(button => button.addEventListener('click', () => this.handleAction(button.dataset.npcAction)));
		}

		handleAction(action) {
			if (!this.record) return;
			if (action === 'REST_POSE') { this.showRestPose(); return; }
			if (!this.restPoseReviewed && action !== 'TOGGLE_SKELETON') { this.showStatus('Hãy chọn “Xem tư thế gốc” để kiểm tra skinning.'); return; }
			if (action === 'TOGGLE_SKELETON') { this.toggleSkeleton(); return; }
		}

		showRestPose() {
			this.record.skeletonMeshes.forEach(mesh => mesh.skeleton.pose()); this.record.importedCharacter.updateMatrixWorld(true); this.restPoseReviewed = true; this.setStateDisplay('REST POSE'); this.showStatus('READY — Rest pose đang hiển thị. Nếu hình bị biến dạng, dừng tại đây: Lỗi model hoặc skinning ở trạng thái gốc.');
		}

		toggleSkeleton() {
			if (this.record.skeletonHelper) { this.scene.remove(this.record.skeletonHelper); this.record.skeletonHelper = null; this.showStatus('Đã ẩn bộ xương.'); return; }
			if (!this.record.skeletonMeshes.length) return this.showStatus('Model không có skeleton để hiển thị.');
			this.record.skeletonHelper = new global.THREE.SkeletonHelper(this.record.importedCharacter); this.scene.add(this.record.skeletonHelper); this.showStatus('Đang hiện bộ xương. Chi tiết bone ở Developer panel.');
		}

		setStateDisplay(state) { const node = this.root.querySelector('[data-npc-state]'); if (node) node.textContent = state; }
		showStatus(message) { const node = this.root.querySelector('[data-npc-status]'); if (node) node.textContent = message; }
		showError(message) { const error = this.root.querySelector('[data-npc-error]'); error.textContent = message; error.hidden = false; this.showStatus(message); }

		start() { const tick = timestamp => { if (this.destroyed) return; this.frame = global.requestAnimationFrame(tick); this.previousTime = timestamp; if (this.record && this.record.skeletonHelper) this.record.skeletonHelper.update(); this.renderer.render(this.scene, this.camera); }; this.frame = global.requestAnimationFrame(tick); }
		destroy() { this.destroyed = true; global.cancelAnimationFrame(this.frame); if (this.resizeObserver) this.resizeObserver.disconnect(); if (this.resizeHandler) global.removeEventListener('resize', this.resizeHandler); if (this.orbit) this.orbit.destroy(); if (this.renderer) this.renderer.dispose(); }
	}

	function init() { document.querySelectorAll('[data-lm-npc-test]').forEach(root => { if (!root.__lmNpcScene) root.__lmNpcScene = new NPCScene(root); }); }
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
