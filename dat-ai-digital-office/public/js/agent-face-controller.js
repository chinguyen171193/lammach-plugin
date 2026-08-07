(function (global) {
	'use strict';

	const EXPRESSIONS = {
		neutral: {},
		focused: {
			browDownLeft: 0.28,
			browDownRight: 0.28,
			eyeSquintLeft: 0.08,
			eyeSquintRight: 0.08
		},
		thinking: {
			browInnerUp: 0.34,
			browOuterUpLeft: 0.16,
			mouthPressLeft: 0.08,
			mouthPressRight: 0.08
		},
		happy: {
			mouthSmileLeft: 0.58,
			mouthSmileRight: 0.58,
			cheekSquintLeft: 0.16,
			cheekSquintRight: 0.16,
			eyeSquintLeft: 0.08,
			eyeSquintRight: 0.08
		},
		talking: {
			browInnerUp: 0.08,
			mouthSmileLeft: 0.08,
			mouthSmileRight: 0.08
		}
	};

	function smooth(current, target, speed, delta) {
		return current + (target - current) * (1 - Math.exp(-Math.max(0, speed) * Math.max(0, delta)));
	}

	class AgentFaceController {
		constructor(root, options) {
			if (!global.THREE || !root) throw new Error('FaceController cần Three.js và model hợp lệ');
			this.root = root;
			this.options = Object.assign({ expressionSpeed: 10, headSpeed: 6 }, options || {});
			this.bindings = new Map();
			this.meshes = [];
			this.expression = 'neutral';
			this.lookX = 0;
			this.lookY = 0;
			this.time = 0;
			this.blinkElapsed = -1;
			this.blinkDuration = 0.19;
			this.nextBlink = this.randomBlinkDelay();
			this.destroyed = false;
			this.collectRig();
			this.printDiagnostics();
		}

		collectRig() {
			this.root.traverse(object => {
				if (object.morphTargetDictionary && object.morphTargetInfluences) {
					this.meshes.push(object);
					Object.entries(object.morphTargetDictionary).forEach(([name, index]) => {
						if (!this.bindings.has(name)) this.bindings.set(name, []);
						this.bindings.get(name).push({ mesh: object, index: index });
					});
				}
			});

			this.headBone = this.root.getObjectByName('Head') || null;
			this.leftEyeBone = this.root.getObjectByName('LeftEye') || null;
			this.rightEyeBone = this.root.getObjectByName('RightEye') || null;
			this.headBaseQuaternion = this.headBone ? this.headBone.quaternion.clone() : null;
			this.headOffsetQuaternion = new global.THREE.Quaternion();
			this.headTargetQuaternion = new global.THREE.Quaternion();

			if (!this.bindings.has('eyeBlinkLeft') || !this.bindings.has('eyeBlinkRight')) {
				throw new Error('Model Face Preview thiếu morph target eyeBlinkLeft/eyeBlinkRight');
			}
		}

		randomBlinkDelay() {
			return 2.2 + Math.random() * 3.8;
		}

		setExpression(name) {
			this.expression = Object.prototype.hasOwnProperty.call(EXPRESSIONS, name) ? name : 'neutral';
			return this;
		}

		setLook(x, y) {
			this.lookX = Math.max(-1, Math.min(1, Number(x) || 0));
			this.lookY = Math.max(-1, Math.min(1, Number(y) || 0));
			return this;
		}

		blink() {
			this.blinkElapsed = 0;
			this.nextBlink = this.randomBlinkDelay();
			return this;
		}

		blinkWeight(delta) {
			if (this.blinkElapsed < 0) {
				this.nextBlink -= delta;
				if (this.nextBlink <= 0) this.blink();
				return 0;
			}

			this.blinkElapsed += delta;
			if (this.blinkElapsed >= this.blinkDuration) {
				this.blinkElapsed = -1;
				return 0;
			}
			return Math.sin(Math.PI * (this.blinkElapsed / this.blinkDuration));
		}

		desiredMorphs(delta) {
			const desired = Object.assign({}, EXPRESSIONS[this.expression] || {});
			const blink = this.blinkWeight(delta);
			desired.eyeBlinkLeft = blink;
			desired.eyeBlinkRight = blink;

			if (this.lookX < 0) {
				desired.eyeLookOutLeft = Math.abs(this.lookX) * 0.62;
				desired.eyeLookInRight = Math.abs(this.lookX) * 0.62;
			} else if (this.lookX > 0) {
				desired.eyeLookInLeft = this.lookX * 0.62;
				desired.eyeLookOutRight = this.lookX * 0.62;
			}

			if (this.lookY > 0) {
				desired.eyeLookUpLeft = this.lookY * 0.54;
				desired.eyeLookUpRight = this.lookY * 0.54;
			} else if (this.lookY < 0) {
				desired.eyeLookDownLeft = Math.abs(this.lookY) * 0.54;
				desired.eyeLookDownRight = Math.abs(this.lookY) * 0.54;
			}

			if (this.expression === 'talking') {
				const syllable = 0.18 + Math.pow(Math.sin(this.time * 8.2), 2) * 0.34;
				desired.jawOpen = syllable;
				desired.viseme_aa = syllable * 0.28;
			}

			return desired;
		}

		updateHead(delta) {
			if (!this.headBone || !this.headBaseQuaternion) return;
			const THREE = global.THREE;
			const pitch = THREE.MathUtils.degToRad(-this.lookY * 5.5);
			const yaw = THREE.MathUtils.degToRad(-this.lookX * 10);
			this.headOffsetQuaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
			this.headTargetQuaternion.copy(this.headBaseQuaternion).multiply(this.headOffsetQuaternion);
			const alpha = 1 - Math.exp(-this.options.headSpeed * Math.max(0, delta));
			this.headBone.quaternion.slerp(this.headTargetQuaternion, alpha);
		}

		update(delta) {
			if (this.destroyed) return;
			this.time += delta;
			const desired = this.desiredMorphs(delta);
			this.bindings.forEach((targets, name) => {
				const target = Object.prototype.hasOwnProperty.call(desired, name) ? desired[name] : 0;
				const speed = /^eyeBlink/u.test(name) ? 28 : this.options.expressionSpeed;
				targets.forEach(binding => {
					binding.mesh.morphTargetInfluences[binding.index] = smooth(
						binding.mesh.morphTargetInfluences[binding.index] || 0,
						target,
						speed,
						delta
					);
				});
			});
			this.updateHead(delta);
		}

		reset() {
			this.setExpression('neutral');
			this.setLook(0, 0);
			this.bindings.forEach(targets => targets.forEach(binding => {
				binding.mesh.morphTargetInfluences[binding.index] = 0;
			}));
			if (this.headBone && this.headBaseQuaternion) this.headBone.quaternion.copy(this.headBaseQuaternion);
		}

		printDiagnostics() {
			const meshes = this.meshes.map(mesh => ({
				mesh: mesh.name || '(unnamed)',
				morphTargets: Object.keys(mesh.morphTargetDictionary || {}).length
			}));
			global.console.groupCollapsed('[DAT AI Office Face Preview] Ready Player Me rig');
			global.console.log('Head bone:', this.headBone ? this.headBone.name : '(none)');
			global.console.log('Eye bones:', [this.leftEyeBone?.name || '(none)', this.rightEyeBone?.name || '(none)']);
			global.console.table(meshes);
			global.console.log('Morph targets (' + this.bindings.size + '):', Array.from(this.bindings.keys()));
			global.console.groupEnd();
		}

		destroy() {
			if (this.destroyed) return;
			this.reset();
			this.destroyed = true;
			this.bindings.clear();
			this.meshes = [];
		}
	}

	global.DAT_AgentFaceController = AgentFaceController;
})(window);
