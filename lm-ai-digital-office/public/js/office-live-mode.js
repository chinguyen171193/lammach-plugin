(function (global) {
	'use strict';

	// Live Mode deliberately uses the approved reference asset as a static
	// office worker. It does not retarget, edit, or share a skeleton.
	const TARGET_HEIGHT_METERS = 1.72;
	const DEFAULT_NPC = {
		id: 'reference_character_v1',
		name: 'Nhân viên 001',
		modelFormat: 'fbx',
		available: false,
		modelUrl: '',
		version: ''
	};

	function versionedUrl(url, version) {
		if (!version || !url) return url;
		return url + (url.indexOf('?') === -1 ? '?' : '&') + 'ver=' + encodeURIComponent(version);
	}

	function createEvent(name, detail) {
		try {
			return new global.CustomEvent(name, { bubbles: true, detail });
		} catch (error) {
			return null;
		}
	}

	function disposeObject(root) {
		if (!root) return;
		root.traverse(object => {
			if (object.geometry) object.geometry.dispose();
			const materials = Array.isArray(object.material) ? object.material : [object.material];
			materials.filter(Boolean).forEach(material => {
				Object.keys(material).forEach(key => {
					const value = material[key];
					if (value && value.isTexture) value.dispose();
				});
				material.dispose();
			});
		});
	}

	class OfficeLiveMode {
		constructor(engine) {
			this.engine = engine;
			this.root = engine.root;
			this.active = false;
			this.destroyed = false;
			this.scene = null;
			this.npc = null;
			this.loadPromise = null;
			this.activationToken = 0;
		}

		definition() {
			const configured = (global.LM_AI_OFFICE || {}).liveNpc || {};
			return Object.assign({}, DEFAULT_NPC, configured, {
				name: configured.name || DEFAULT_NPC.name,
				version: configured.version || (global.LM_AI_OFFICE || {}).agentAssetsVersion || ''
			});
		}

		async activate() {
			const token = ++this.activationToken;
			if (this.destroyed) return false;
			const buildMode = this.engine.buildMode;
			if (!buildMode || typeof buildMode.activateLive !== 'function') {
				this.report('warning', 'Không thể bật Live Mode 3D vì runtime văn phòng chưa sẵn sàng.');
				return false;
			}

			try {
				const result = await buildMode.activateLive();
				if (result === false || this.destroyed || token !== this.activationToken || !buildMode.scene) return false;
				this.active = true;
				this.root.classList.add('is-live-mode');
				await this.ensureNpc(buildMode);
				if (this.destroyed || token !== this.activationToken) return false;
				if (this.npc) this.npc.root.visible = true;
				this.dispatch(true);
				return true;
			} catch (error) {
				if (!this.destroyed && token === this.activationToken) {
					this.report('warning', 'Live Mode đã mở nhưng không tải được Nhân viên 001: ' + (error.message || error));
					this.dispatch(true, error);
				}
				// The saved office scene is still usable even when the optional
				// character asset cannot load. Keep it on screen rather than falling
				// back to Pixi and hiding the user's newly placed furniture.
				return this.active;
			}
		}

		deactivate() {
			++this.activationToken;
			this.active = false;
			this.root.classList.remove('is-live-mode');
			if (this.npc) this.npc.root.visible = false;
			const buildMode = this.engine.buildMode;
			if (buildMode && typeof buildMode.deactivateLive === 'function') buildMode.deactivateLive();
			this.dispatch(false);
		}

		async ensureNpc(buildMode) {
			if (!buildMode.scene) throw new Error('Three scene chưa được khởi tạo.');
			if (this.npc && this.scene === buildMode.scene) {
				// Furniture can change while the NPC is hidden in Build Mode. Recheck
				// its small list of safe spawn points on every return to Live Mode.
				this.positionNpc(buildMode, this.npc.root);
				return this.npc;
			}
			if (this.npc) this.removeNpc();
			this.scene = buildMode.scene;
			if (!this.loadPromise) {
				const promise = this.loadNpc(buildMode);
				this.loadPromise = promise;
				promise.catch(() => {
					if (this.loadPromise === promise) this.loadPromise = null;
				});
			}
			return this.loadPromise;
		}

		loadNpc(buildMode) {
			const definition = this.definition();
			if (!definition.available || !definition.modelUrl) return Promise.reject(new Error('Không tìm thấy REFERENCE_CHARACTER_V1.'));
			if (definition.modelFormat !== 'fbx') return Promise.reject(new Error('REFERENCE_CHARACTER_V1 cần định dạng FBX.'));
			if (!global.THREE || !global.THREE.FBXLoader) return Promise.reject(new Error('FBXLoader chưa sẵn sàng.'));

			return new Promise((resolve, reject) => {
				new global.THREE.FBXLoader().load(versionedUrl(definition.modelUrl, definition.version), source => {
					try {
						if (this.destroyed || !buildMode.scene || buildMode.scene !== this.scene) return resolve(null);
						const record = this.installNpc(buildMode, source, definition);
						this.npc = record;
						this.report('success', definition.name + ' đã xuất hiện trong Live Mode.');
						resolve(record);
					} catch (error) {
						reject(error);
					}
				}, undefined, reject);
			});
		}

		installNpc(buildMode, source, definition) {
			const THREE = global.THREE;
			const root = new THREE.Group();
			root.name = 'LMOfficeLiveNpc_' + definition.id;
			// Do not flash the NPC if a user switches back to Build Mode while the
			// FBX request is still in flight. activate() reveals it only after the
			// current mode transition has completed.
			root.visible = false;
			root.userData.lmOfficeLiveNpc = true;
			root.userData.npcId = definition.id;
			root.userData.npcName = definition.name;
			const modelContainer = new THREE.Group();
			modelContainer.name = 'LMOfficeLiveNpcModel';
			modelContainer.add(source);
			root.add(modelContainer);
			buildMode.scene.add(root);
			source.traverse(object => {
				if (object.isMesh) {
					object.castShadow = true;
					object.receiveShadow = true;
				}
			});

			modelContainer.updateMatrixWorld(true);
			const initialBox = new THREE.Box3().setFromObject(modelContainer);
			const originalHeight = initialBox.getSize(new THREE.Vector3()).y;
			if (!Number.isFinite(originalHeight) || originalHeight <= 0) {
				buildMode.scene.remove(root);
				throw new Error('Không đo được chiều cao của REFERENCE_CHARACTER_V1.');
			}
			const scale = TARGET_HEIGHT_METERS / originalHeight;
			modelContainer.scale.setScalar(scale);
			modelContainer.updateMatrixWorld(true);
			const scaledBox = new THREE.Box3().setFromObject(modelContainer);
			modelContainer.position.y -= scaledBox.min.y;
			modelContainer.updateMatrixWorld(true);
			const normalizedBox = new THREE.Box3().setFromObject(modelContainer);
			const spawn = this.positionNpc(buildMode, root);
			const label = this.createLabel(definition.name, normalizedBox.getSize(new THREE.Vector3()).y + 0.24);
			if (label) root.add(label);
			global.console.info('[LM AI Office Live Mode] NPC spawned', {
				id: definition.id,
				name: definition.name,
				originalHeight: Number(originalHeight.toFixed(3)),
				worldHeight: Number(normalizedBox.getSize(new THREE.Vector3()).y.toFixed(3)),
				rootScale: Number(scale.toFixed(6)),
				position: spawn
			});
			return { root, modelContainer, source, scene: buildMode.scene, definition };
		}

		positionNpc(buildMode, root) {
			const spawn = this.findSpawn(buildMode);
			root.position.set(spawn.x, 0, spawn.z);
			root.updateMatrixWorld(true);
			return spawn;
		}

		findSpawn(buildMode) {
			const candidates = [
				{ x: -3.2, z: -2.6 }, { x: 3.2, z: -2.6 }, { x: -3.2, z: 2.6 },
				{ x: 3.2, z: 2.6 }, { x: -5.2, z: 0 }, { x: 5.2, z: 0 },
				{ x: 0, z: -4.8 }, { x: 0, z: 4.8 }, { x: -7.5, z: -4.5 },
				{ x: 7.5, z: -4.5 }, { x: -7.5, z: 4.5 }, { x: 7.5, z: 4.5 }
			];
			const roots = buildMode.instances instanceof Map ? Array.from(buildMode.instances.values()) : [];
			const THREE = global.THREE;
			const clear = candidate => roots.every(root => {
				const box = new THREE.Box3().setFromObject(root);
				if (box.isEmpty()) return true;
				const padding = 0.85;
				return candidate.x < box.min.x - padding || candidate.x > box.max.x + padding || candidate.z < box.min.z - padding || candidate.z > box.max.z + padding;
			});
			return candidates.find(clear) || candidates[candidates.length - 1];
		}

		createLabel(text, height) {
			if (!global.THREE || !global.document) return null;
			const canvas = global.document.createElement('canvas');
			canvas.width = 512;
			canvas.height = 128;
			const context = canvas.getContext('2d');
			if (!context) return null;
			context.fillStyle = 'rgba(4, 15, 27, 0.78)';
			context.beginPath();
			if (context.roundRect) context.roundRect(12, 18, 488, 92, 36);
			else context.rect(12, 18, 488, 92);
			context.fill();
			context.fillStyle = '#dff8ff';
			context.font = '600 48px Arial';
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.fillText(text, 256, 64);
			const texture = new global.THREE.CanvasTexture(canvas);
			texture.encoding = global.THREE.sRGBEncoding;
			const material = new global.THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true });
			const label = new global.THREE.Sprite(material);
			label.name = 'LMOfficeLiveNpcLabel';
			label.position.set(0, height, 0);
			label.scale.set(1.4, 0.35, 1);
			return label;
		}

		removeNpc() {
			if (!this.npc) return;
			if (this.npc.scene) this.npc.scene.remove(this.npc.root);
			disposeObject(this.npc.root);
			this.npc = null;
			this.loadPromise = null;
		}

		report(level, message) {
			if (this.engine.bus && typeof this.engine.bus.log === 'function') {
				this.engine.bus.log({ actor: 'Live Mode', department: 'ai_center', level, message });
			}
		}

		dispatch(active, error) {
			const event = createEvent('lm-ai-office:live-mode', {
				active,
				npc: this.npc ? { id: this.npc.definition.id, name: this.npc.definition.name } : null,
				error: error ? String(error.message || error) : ''
			});
			if (event) this.root.dispatchEvent(event);
		}

		destroy() {
			if (this.destroyed) return;
			this.destroyed = true;
			++this.activationToken;
			this.active = false;
			this.root.classList.remove('is-live-mode');
			this.removeNpc();
		}
	}

	global.LMAIOfficeLiveMode = OfficeLiveMode;
})(window);
