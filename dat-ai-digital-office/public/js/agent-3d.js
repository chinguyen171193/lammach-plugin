(function (global) {
	'use strict';

	const instances = new Set();
	let animationFrame = 0;
	let previousTime = 0;

	function clamp(value, minimum, maximum) {
		return Math.max(minimum, Math.min(maximum, value));
	}

	function damp(current, target, speed, delta) {
		return current + (target - current) * (1 - Math.exp(-speed * delta));
	}

	function startScheduler() {
		if (!animationFrame && !document.hidden && Array.from(instances).some(instance => !instance.paused && !instance.destroyed)) {
			animationFrame = global.requestAnimationFrame(tick);
		}
	}

	function tick(time) {
		animationFrame = 0;
		const delta = Math.min(0.05, previousTime ? (time - previousTime) / 1000 : 0);
		previousTime = time;
		instances.forEach(instance => {
			if (!instance.paused && !instance.destroyed) instance.tick(delta);
		});
		startScheduler();
	}

	document.addEventListener('visibilitychange', () => {
		previousTime = 0;
		if (!document.hidden) startScheduler();
	});

	class PCBEngineer3D {
		constructor(container, options) {
			this.container = container;
			this.options = Object.assign({ state: 'idle', pixelRatio: 1.5 }, options || {});
			this.state = this.options.state || 'idle';
			this.stateTime = 0;
			this.elapsed = Math.random() * 10;
			this.paused = false;
			this.destroyed = false;
			this.pose = {};
			this.targetPose = {};
			this.geometries = [];
			this.materials = [];
			this.init();
		}

		init() {
			if (!global.THREE || !this.webglAvailable()) throw new Error('WebGL không khả dụng');

			const THREE = global.THREE;
			this.scene = new THREE.Scene();
			this.camera = new THREE.PerspectiveCamera(27, 0.8, 0.1, 100);
			this.camera.position.set(4.6, 3.2, 7.8);
			this.camera.lookAt(0.05, 1.35, 0);

			this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
			this.renderer.setClearColor(0x000000, 0);
			this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, Number(this.options.pixelRatio) || 1.5));
			this.renderer.outputEncoding = THREE.sRGBEncoding;
			this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
			this.renderer.toneMappingExposure = 1.08;
			this.renderer.shadowMap.enabled = true;
			this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			this.renderer.domElement.className = 'dat-agent-3d__canvas';
			this.renderer.domElement.setAttribute('aria-label', 'Gerber AI, nhân vật kỹ sư PCB 3D toàn thân');
			this.container.replaceChildren(this.renderer.domElement);

			this.addLights();
			this.buildScene();
			this.resize();
			this.resizeObserver = 'ResizeObserver' in global ? new ResizeObserver(() => this.resize()) : null;
			if (this.resizeObserver) this.resizeObserver.observe(this.container);
			instances.add(this);
			this.setState(this.state, true);
			this.tick(0.016);
			startScheduler();
		}

		webglAvailable() {
			try {
				const canvas = document.createElement('canvas');
				return Boolean(global.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
			} catch (error) {
				return false;
			}
		}

		material(parameters) {
			const material = new global.THREE.MeshStandardMaterial(parameters);
			this.materials.push(material);
			return material;
		}

		geometry(geometry) {
			this.geometries.push(geometry);
			return geometry;
		}

		mesh(geometry, material, options) {
			const mesh = new global.THREE.Mesh(this.geometry(geometry), material);
			const settings = options || {};
			if (settings.position) mesh.position.set(settings.position[0], settings.position[1], settings.position[2]);
			if (settings.rotation) mesh.rotation.set(settings.rotation[0], settings.rotation[1], settings.rotation[2]);
			if (settings.scale) mesh.scale.set(settings.scale[0], settings.scale[1], settings.scale[2]);
			mesh.castShadow = settings.castShadow !== false;
			mesh.receiveShadow = settings.receiveShadow !== false;
			return mesh;
		}

		addLights() {
			const THREE = global.THREE;
			this.scene.add(new THREE.HemisphereLight(0xbfeaff, 0x071321, 1.8));
			const key = new THREE.DirectionalLight(0xffffff, 2.3);
			key.position.set(3.5, 6, 5);
			key.castShadow = true;
			key.shadow.mapSize.set(512, 512);
			this.scene.add(key);
			const rim = new THREE.PointLight(0x26e7c0, 2.1, 9);
			rim.position.set(-3, 2.8, -1.5);
			this.scene.add(rim);
			const screen = new THREE.PointLight(0x39cfff, 1.1, 4);
			screen.position.set(0.8, 1.7, 1.25);
			this.scene.add(screen);
		}

		buildScene() {
			const THREE = global.THREE;
			this.root = new THREE.Group();
			this.root.rotation.y = -0.08;
			this.scene.add(this.root);

			const skin = this.material({ color: 0xc9875e, roughness: 0.72, metalness: 0.02 });
			const skinLight = this.material({ color: 0xd99a70, roughness: 0.7 });
			const shirt = this.material({ color: 0x124f72, roughness: 0.58, metalness: 0.08 });
			const shirtDark = this.material({ color: 0x0a304b, roughness: 0.62 });
			const trousers = this.material({ color: 0x14243b, roughness: 0.76 });
			const shoe = this.material({ color: 0x111722, roughness: 0.48 });
			const hair = this.material({ color: 0x121923, roughness: 0.82 });
			const eye = this.material({ color: 0x101820, roughness: 0.35 });
			const white = this.material({ color: 0xf2f5f7, roughness: 0.5 });
			const metal = this.material({ color: 0x233c4d, roughness: 0.28, metalness: 0.78 });
			const black = this.material({ color: 0x07111b, roughness: 0.32, metalness: 0.36 });
			const chair = this.material({ color: 0x18364a, roughness: 0.62, metalness: 0.18 });
			const desk = this.material({ color: 0x1d4353, roughness: 0.44, metalness: 0.22 });
			const accent = this.material({ color: 0x29e1b4, emissive: 0x0b8067, emissiveIntensity: 0.9, roughness: 0.28, metalness: 0.32 });
			this.screenMaterial = this.material({ color: 0x0c5f7a, emissive: 0x0e91b8, emissiveIntensity: 1.25, roughness: 0.18, metalness: 0.24 });
			this.keyMaterial = this.material({ color: 0x4be5cc, emissive: 0x16a988, emissiveIntensity: 0.75, roughness: 0.24 });

			const floorMaterial = this.material({ color: 0x0c2635, transparent: true, opacity: 0.78, roughness: 0.88 });
			const floor = this.mesh(new THREE.CylinderGeometry(2.15, 2.15, 0.06, 64), floorMaterial, { position: [0, 0.03, 0], castShadow: false });
			this.root.add(floor);
			const ring = this.mesh(new THREE.TorusGeometry(1.82, 0.015, 8, 72), accent, { position: [0, 0.075, 0], rotation: [Math.PI / 2, 0, 0], castShadow: false });
			this.root.add(ring);

			this.buildChair(chair, metal);
			this.buildDesk(desk, metal, black, accent);
			this.buildCharacter({ skin, skinLight, shirt, shirtDark, trousers, shoe, hair, eye, white, accent });
		}

		buildChair(chairMaterial, metalMaterial) {
			const THREE = global.THREE;
			const chair = new THREE.Group();
			chair.position.set(-0.54, 0, -0.28);
			chair.add(this.mesh(new THREE.BoxGeometry(0.72, 0.82, 0.14), chairMaterial, { position: [0, 1.13, -0.18], rotation: [-0.12, 0, 0], scale: [1, 1, 1] }));
			chair.add(this.mesh(new THREE.BoxGeometry(0.72, 0.14, 0.68), chairMaterial, { position: [0, 0.78, 0.02] }));
			chair.add(this.mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.65, 14), metalMaterial, { position: [0, 0.42, 0], castShadow: true }));
			chair.add(this.mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.82, 12), metalMaterial, { position: [0, 0.13, 0], rotation: [0, 0, Math.PI / 2] }));
			[-0.4, 0.4].forEach(x => {
				chair.add(this.mesh(new THREE.SphereGeometry(0.075, 14, 10), metalMaterial, { position: [x, 0.1, 0] }));
			});
			this.root.add(chair);
		}

		buildDesk(deskMaterial, metalMaterial, blackMaterial, accentMaterial) {
			const THREE = global.THREE;
			const office = new THREE.Group();
			office.position.set(0.55, 0, 0.22);
			const top = this.mesh(new THREE.BoxGeometry(2.35, 0.13, 0.9), deskMaterial, { position: [0, 1.08, 0.16] });
			office.add(top);
			[-0.96, 0.96].forEach(x => {
				[-0.13, 0.5].forEach(z => office.add(this.mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.02, 12), metalMaterial, { position: [x, 0.53, z] })));
			});

			const monitor = new THREE.Group();
			monitor.position.set(0.52, 1.63, 0.03);
			monitor.rotation.y = -0.16;
			monitor.add(this.mesh(new THREE.BoxGeometry(1.08, 0.68, 0.08), blackMaterial, { position: [0, 0, 0] }));
			monitor.add(this.mesh(new THREE.BoxGeometry(0.94, 0.54, 0.018), this.screenMaterial, { position: [0, 0, 0.052], castShadow: false }));
			monitor.add(this.mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.36, 12), metalMaterial, { position: [0, -0.48, -0.01] }));
			monitor.add(this.mesh(new THREE.BoxGeometry(0.48, 0.055, 0.3), metalMaterial, { position: [0, -0.68, 0.02] }));
			office.add(monitor);

			this.keyboard = new THREE.Group();
			this.keyboard.position.set(-0.22, 1.18, 0.49);
			this.keyboard.rotation.x = -0.08;
			this.keyboard.add(this.mesh(new THREE.BoxGeometry(0.78, 0.055, 0.31), blackMaterial, { position: [0, 0, 0] }));
			for (let row = 0; row < 3; row++) {
				for (let column = 0; column < 9; column++) {
					const key = this.mesh(new THREE.BoxGeometry(0.055, 0.018, 0.047), this.keyMaterial, { position: [-0.29 + column * 0.073, 0.038, -0.08 + row * 0.07], castShadow: false });
					this.keyboard.add(key);
				}
			}
			office.add(this.keyboard);

			this.mouse = this.mesh(new THREE.SphereGeometry(0.105, 20, 12), blackMaterial, { position: [0.47, 1.2, 0.57], scale: [0.72, 0.34, 1] });
			office.add(this.mouse);

			this.pcb = new THREE.Group();
			this.pcb.position.set(0.96, 1.19, 0.43);
			this.pcb.rotation.set(-0.08, -0.2, -0.08);
			this.pcb.add(this.mesh(new THREE.BoxGeometry(0.43, 0.035, 0.31), accentMaterial, { position: [0, 0, 0] }));
			for (let i = 0; i < 8; i++) {
				this.pcb.add(this.mesh(new THREE.BoxGeometry(0.045, 0.025, 0.055), blackMaterial, { position: [-0.15 + (i % 4) * 0.1, 0.03, -0.08 + Math.floor(i / 4) * 0.16], castShadow: false }));
			}
			office.add(this.pcb);
			this.root.add(office);
		}

		buildCharacter(materials) {
			const THREE = global.THREE;
			const character = new THREE.Group();
			character.position.set(-0.53, 0, -0.02);
			this.character = character;

			const hips = this.mesh(new THREE.SphereGeometry(0.38, 24, 16), materials.trousers, { position: [0, 0.88, 0], scale: [1, 0.68, 0.78] });
			character.add(hips);

			this.torso = new THREE.Group();
			this.torso.position.set(0, 0.95, 0);
			this.torso.add(this.mesh(new THREE.SphereGeometry(0.48, 28, 20), materials.shirt, { position: [0, 0.48, 0], scale: [1, 1.28, 0.68] }));
			this.torso.add(this.mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.18, 18), materials.skin, { position: [0, 1.02, 0] }));
			const collarLeft = this.mesh(new THREE.ConeGeometry(0.12, 0.28, 3), materials.shirtDark, { position: [-0.12, 0.89, 0.27], rotation: [0, 0, 0.35], scale: [0.72, 1, 0.34] });
			const collarRight = this.mesh(new THREE.ConeGeometry(0.12, 0.28, 3), materials.shirtDark, { position: [0.12, 0.89, 0.27], rotation: [0, 0, -0.35], scale: [0.72, 1, 0.34] });
			this.torso.add(collarLeft, collarRight);
			const badge = this.mesh(new THREE.BoxGeometry(0.16, 0.09, 0.018), materials.white, { position: [0.22, 0.62, 0.32], rotation: [0, 0, -0.04], castShadow: false });
			this.torso.add(badge);

			this.head = new THREE.Group();
			this.head.position.set(0, 2.13, 0.02);
			const face = this.mesh(new THREE.SphereGeometry(0.34, 32, 24), materials.skinLight, { scale: [0.9, 1.08, 0.88] });
			this.head.add(face);
			const hairCap = this.mesh(new THREE.SphereGeometry(0.35, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.54), materials.hair, { position: [0, 0.07, -0.005], scale: [0.94, 1.05, 0.92] });
			this.head.add(hairCap);
			[-1, 1].forEach(side => {
				this.head.add(this.mesh(new THREE.SphereGeometry(0.065, 16, 12), materials.skinLight, { position: [side * 0.31, -0.02, 0] }));
			});
			this.leftEye = this.createEye(-0.105, materials.white, materials.eye);
			this.rightEye = this.createEye(0.105, materials.white, materials.eye);
			this.head.add(this.leftEye, this.rightEye);
			this.head.add(this.mesh(new THREE.SphereGeometry(0.045, 14, 10), materials.skin, { position: [0, -0.04, 0.3], scale: [0.65, 1, 0.65] }));
			this.head.add(this.mesh(new THREE.BoxGeometry(0.13, 0.025, 0.022), materials.hair, { position: [0, -0.17, 0.294], rotation: [0, 0, 0.02], castShadow: false }));

			this.leftArm = this.createArm(-0.39, materials.shirt, materials.skinLight, 'left');
			this.rightArm = this.createArm(0.39, materials.shirt, materials.skinLight, 'right');
			this.torso.add(this.leftArm.upper, this.rightArm.upper);
			character.add(this.torso, this.head);

			this.leftLeg = this.createLeg(-0.2, materials.trousers, materials.shoe);
			this.rightLeg = this.createLeg(0.2, materials.trousers, materials.shoe);
			character.add(this.leftLeg.upper, this.rightLeg.upper);
			character.add(this.mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.42, 14), materials.accent, { position: [0.47, 1.49, -0.02], rotation: [0, 0, -0.2], castShadow: false }));
			this.root.add(character);
		}

		createEye(x, whiteMaterial, eyeMaterial) {
			const THREE = global.THREE;
			const eye = new THREE.Group();
			eye.position.set(x, 0.035, 0.284);
			eye.add(this.mesh(new THREE.SphereGeometry(0.047, 16, 10), whiteMaterial, { scale: [1.25, 0.75, 0.36], castShadow: false }));
			eye.add(this.mesh(new THREE.SphereGeometry(0.022, 14, 10), eyeMaterial, { position: [0, 0, 0.038], scale: [0.8, 1, 0.4], castShadow: false }));
			return eye;
		}

		createArm(x, shirtMaterial, skinMaterial, side) {
			const THREE = global.THREE;
			const upper = new THREE.Group();
			upper.position.set(x, 0.75, 0);
			const upperMesh = this.mesh(new THREE.CylinderGeometry(0.115, 0.1, 0.5, 18), shirtMaterial, { position: [0, -0.25, 0] });
			upper.add(upperMesh);
			const fore = new THREE.Group();
			fore.position.set(0, -0.5, 0);
			fore.add(this.mesh(new THREE.CylinderGeometry(0.095, 0.075, 0.46, 18), skinMaterial, { position: [0, -0.23, 0] }));
			const hand = this.mesh(new THREE.SphereGeometry(0.105, 18, 14), skinMaterial, { position: [0, -0.49, 0], scale: [0.78, 1.02, 0.62] });
			fore.add(hand);
			upper.add(fore);
			return { upper, fore, hand, side };
		}

		createLeg(x, trouserMaterial, shoeMaterial) {
			const THREE = global.THREE;
			const upper = new THREE.Group();
			upper.position.set(x, 0.86, 0);
			upper.add(this.mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.62, 20), trouserMaterial, { position: [0, -0.31, 0] }));
			const lower = new THREE.Group();
			lower.position.set(0, -0.62, 0);
			lower.add(this.mesh(new THREE.CylinderGeometry(0.13, 0.105, 0.62, 18), trouserMaterial, { position: [0, -0.31, 0] }));
			lower.add(this.mesh(new THREE.SphereGeometry(0.15, 18, 12), shoeMaterial, { position: [0, -0.66, 0.08], scale: [0.92, 0.62, 1.48] }));
			upper.add(lower);
			return { upper, lower };
		}

		setState(state, immediate) {
			const allowed = ['idle', 'working', 'reviewing', 'done'];
			this.state = allowed.indexOf(state) >= 0 ? state : 'idle';
			this.stateTime = 0;
			if (immediate) {
				this.targetPose = this.calculatePose(0);
				this.pose = Object.assign({}, this.targetPose);
				this.applyPose();
			}
			return this;
		}

		calculatePose(time) {
			const natural = Math.sin(time * 1.17) * 0.55 + Math.sin(time * 0.43 + 1.8) * 0.45;
			const typing = Math.sin(time * 12.2) * 0.5 + Math.sin(time * 7.1 + 0.8) * 0.5;
			const mouse = Math.sin(time * 2.4) * 0.65 + Math.sin(time * 0.79 + 2.4) * 0.35;
			const base = {
				torsoX: -0.02, torsoY: 0, torsoZ: 0,
				headX: -0.03, headY: -0.12, headZ: 0,
				leftUpperX: -1.12, leftUpperY: 0.1, leftUpperZ: -0.2,
				leftForeX: -0.56, leftForeY: 0, leftForeZ: -0.04,
				rightUpperX: -1.08, rightUpperY: -0.12, rightUpperZ: 0.18,
				rightForeX: -0.35, rightForeY: 0, rightForeZ: 0.08,
				leftLegX: -1.2, leftLegZ: 0.03, leftLowerX: 1.28,
				rightLegX: -1.16, rightLegZ: -0.03, rightLowerX: 1.22,
				mouseX: 0, mouseZ: 0, pcbY: 0, pcbX: 0, pcbRotate: 0,
				breath: Math.sin(time * 1.65) * 0.012,
				screen: 1.15, keys: 0.55
			};

			if (this.state === 'working') {
				base.torsoX = -0.075 + natural * 0.006;
				base.headX = 0.08 + Math.sin(time * 0.74) * 0.035;
				base.headY = -0.28 + Math.sin(time * 0.39) * 0.09;
				base.headZ = natural * 0.018;
				base.leftUpperX = -1.26;
				base.leftUpperZ = -0.1 + typing * 0.035;
				base.leftForeX = -0.32 + typing * 0.12;
				base.leftForeZ = typing * 0.055;
				base.rightUpperX = -1.17;
				base.rightUpperZ = 0.25 + mouse * 0.025;
				base.rightForeX = -0.22 + mouse * 0.055;
				base.rightForeZ = 0.12 + mouse * 0.035;
				base.mouseX = mouse * 0.035;
				base.mouseZ = Math.sin(time * 1.31) * 0.018;
				base.screen = 1.25 + Math.sin(time * 2.1) * 0.22;
				base.keys = 0.8 + Math.abs(typing) * 0.7;
			}

			if (this.state === 'reviewing') {
				base.torsoX = -0.1;
				base.headX = 0.2 + Math.sin(time * 0.65) * 0.035;
				base.headY = -0.48 + Math.sin(time * 0.42) * 0.045;
				base.headZ = -0.035;
				base.leftUpperX = -1.08;
				base.leftForeX = -0.46;
				base.rightUpperX = -1.33;
				base.rightUpperZ = 0.04;
				base.rightForeX = -0.55;
				base.pcbY = 0.11 + Math.sin(time * 1.15) * 0.012;
				base.pcbX = -0.08;
				base.pcbRotate = Math.sin(time * 0.7) * 0.045;
				base.screen = 1.46;
				base.keys = 0.35;
			}

			if (this.state === 'done') {
				const settle = clamp(this.stateTime / 0.75, 0, 1);
				base.torsoX = -0.02;
				base.headX = -0.08;
				base.headY = 0.08;
				base.rightUpperX = -0.35 - settle * 0.25;
				base.rightUpperZ = -0.55;
				base.rightForeX = -0.42;
				base.rightForeZ = -0.38;
				base.screen = 1.75 + Math.sin(time * 4) * 0.18;
				base.keys = 0.25;
			}

			return base;
		}

		applyPose() {
			const pose = this.pose;
			this.torso.rotation.set(pose.torsoX, pose.torsoY, pose.torsoZ);
			this.torso.scale.y = 1 + pose.breath;
			this.head.rotation.set(pose.headX, pose.headY, pose.headZ);
			this.leftArm.upper.rotation.set(pose.leftUpperX, pose.leftUpperY, pose.leftUpperZ);
			this.leftArm.fore.rotation.set(pose.leftForeX, pose.leftForeY, pose.leftForeZ);
			this.rightArm.upper.rotation.set(pose.rightUpperX, pose.rightUpperY, pose.rightUpperZ);
			this.rightArm.fore.rotation.set(pose.rightForeX, pose.rightForeY, pose.rightForeZ);
			this.leftLeg.upper.rotation.set(pose.leftLegX, 0, pose.leftLegZ);
			this.leftLeg.lower.rotation.x = pose.leftLowerX;
			this.rightLeg.upper.rotation.set(pose.rightLegX, 0, pose.rightLegZ);
			this.rightLeg.lower.rotation.x = pose.rightLowerX;
			this.mouse.position.x = 0.47 + pose.mouseX;
			this.mouse.position.z = 0.57 + pose.mouseZ;
			this.pcb.position.x = 0.96 + pose.pcbX;
			this.pcb.position.y = 1.19 + pose.pcbY;
			this.pcb.rotation.z = -0.08 + pose.pcbRotate;
			this.screenMaterial.emissiveIntensity = pose.screen;
			this.keyMaterial.emissiveIntensity = pose.keys;
		}

		tick(delta) {
			if (this.destroyed || this.paused) return;
			this.elapsed += delta;
			this.stateTime += delta;
			this.targetPose = this.calculatePose(this.elapsed);
			Object.keys(this.targetPose).forEach(key => {
				const current = Number.isFinite(this.pose[key]) ? this.pose[key] : this.targetPose[key];
				this.pose[key] = damp(current, this.targetPose[key], key.indexOf('head') === 0 ? 5.5 : 8.5, delta);
			});
			const blinkPhase = (this.elapsed + 1.3) % 5.1;
			const blink = blinkPhase > 4.93 ? Math.max(0.08, Math.abs(blinkPhase - 5.015) * 11.5) : 1;
			this.leftEye.scale.y = blink;
			this.rightEye.scale.y = blink;
			this.applyPose();
			this.renderer.render(this.scene, this.camera);
		}

		resize() {
			if (!this.renderer || !this.container) return;
			const width = Math.max(1, this.container.clientWidth || 240);
			const height = Math.max(1, this.container.clientHeight || 300);
			this.camera.aspect = width / height;
			this.camera.updateProjectionMatrix();
			this.renderer.setSize(width, height, false);
			this.renderer.render(this.scene, this.camera);
		}

		setPaused(paused) {
			this.paused = Boolean(paused);
			if (!this.paused) startScheduler();
			return this;
		}

		destroy() {
			if (this.destroyed) return;
			this.destroyed = true;
			instances.delete(this);
			if (this.resizeObserver) this.resizeObserver.disconnect();
			this.geometries.forEach(geometry => geometry.dispose());
			this.materials.forEach(material => material.dispose());
			if (this.renderer) {
				this.renderer.dispose();
				this.renderer.forceContextLoss();
			}
			if (this.container) this.container.replaceChildren();
		}
	}

	function create(container, options) {
		if (!container || !global.THREE) return null;
		try {
			return new PCBEngineer3D(container, options);
		} catch (error) {
			if (global.console && typeof global.console.warn === 'function') global.console.warn('DAT AI Office 3D fallback:', error.message);
			return null;
		}
	}

	global.DAT_Agent3D = { create };
})(window);
