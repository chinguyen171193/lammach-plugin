(function (global) {
	'use strict';

	/** Moves a character group in world space; it deliberately has no mixer logic. */
	class NPCCharacterController {
		constructor(character, animationController, options) {
			this.character = character;
			this.animationController = animationController;
			this.speed = Number((options || {}).speed) || 1.6;
			this.arrivalThreshold = Number((options || {}).arrivalThreshold) || 0.055;
			this.typingAvailable = Boolean((options || {}).typingAvailable);
			this.workstationResolver = (options || {}).workstationResolver || null;
			this.target = null;
			this.targetObject = null;
			this.currentInteraction = null;
			this.onArrive = null;
			this.faceMovement = true;
			this.alignment = null;
			this._direction = new global.THREE.Vector3();
		}

		moveTo(target, options) {
			const settings = options || {};
			this.target = target.clone();
			this.onArrive = settings.onArrive || null;
			this.faceMovement = settings.faceMovement !== false;
			this.moveSpeed = Number(settings.speed) || this.speed;
			if (this.faceMovement) this.faceTarget(this.target);
			this.animationController.setState(settings.state || global.LM_NPC_STATES.WALKING);
		}

		faceTarget(target) {
			const lookAt = new global.THREE.Vector3(target.x, this.character.position.y, target.z);
			if (lookAt.distanceToSquared(this.character.position) > 0.000001) this.character.lookAt(lookAt);
		}

		stop() {
			this.target = null;
			this.onArrive = null;
			this.moveSpeed = this.speed;
			this.alignment = null;
			this.animationController.setState(global.LM_NPC_STATES.IDLE);
		}

		alignTo(rotation, onComplete) {
			this.target = null;
			this.alignment = { rotation, onComplete: onComplete || null };
			this.animationController.setState(global.LM_NPC_STATES.ALIGNING_TO_CHAIR);
		}

		goToWorkstation(workstation) {
			if (typeof workstation === 'string' && this.workstationResolver) workstation = this.workstationResolver(workstation);
			if (!workstation || !workstation.chair) throw new Error('Workstation không có chair interaction metadata.');
			this.currentInteraction = workstation.id;
			this.targetObject = workstation.id;
			this.moveTo(workstation.chair.approachPoint, {
				onArrive: () => this.alignTo(workstation.chair.sitRotation, () => this.sit(workstation))
			});
		}

		sit(workstation) {
			if (typeof workstation === 'string' && this.workstationResolver) workstation = this.workstationResolver(workstation);
			if (!workstation || !workstation.chair) return;
			if (!this.animationController.hasAnimation(global.LM_NPC_STATES.SITTING_DOWN)) { this.animationController.setState(global.LM_NPC_STATES.WAITING_AT_CHAIR); return false; }
			this.currentInteraction = workstation.id;
			this.targetObject = workstation.chair.id;
			this.character.rotation.y = workstation.chair.sitRotation;
			this.moveTo(workstation.chair.sitPoint, {
				state: global.LM_NPC_STATES.SITTING_DOWN,
				speed: 0.72,
				faceMovement: false,
				onArrive: () => this.animationController.setState(global.LM_NPC_STATES.SITTING_IDLE)
			}); return true;
		}

		work() {
			return this.performSeatedAction(global.LM_NPC_STATES.TYPING, 'computer_01');
		}

		performSeatedAction(state, targetObject) {
			if (!this.currentInteraction || !this.animationController.hasAnimation(state)) return false;
			this.targetObject = targetObject || 'computer_01';
			this.animationController.setState(state);
			return true;
		}

		stopWork() {
			if (!this.currentInteraction) return;
			this.targetObject = 'chair_01';
			this.animationController.setState(global.LM_NPC_STATES.SITTING_IDLE);
		}

		standUp(workstation) {
			if (typeof workstation === 'string' && this.workstationResolver) workstation = this.workstationResolver(workstation);
			if (!workstation || !workstation.chair || !this.animationController.hasAnimation(global.LM_NPC_STATES.STANDING_UP)) return false;
			this.targetObject = workstation.chair.id;
			this.animationController.setState(global.LM_NPC_STATES.STANDING_UP);
			this.moveTo(workstation.chair.approachPoint, {
				state: global.LM_NPC_STATES.STANDING_UP,
				speed: 0.72,
				faceMovement: false,
				onArrive: () => {
					this.currentInteraction = null;
					this.targetObject = null;
					this.animationController.setState(global.LM_NPC_STATES.IDLE);
				}
			}); return true;
		}

		update(delta) {
			if (this.alignment) {
				const difference = global.THREE.MathUtils.euclideanModulo(this.alignment.rotation - this.character.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
				const step = Math.sign(difference) * Math.min(Math.abs(difference), delta * 7);
				this.character.rotation.y += step;
				if (Math.abs(difference) <= 0.02) {
					const callback = this.alignment.onComplete;
					this.character.rotation.y = this.alignment.rotation;
					this.alignment = null;
					if (callback) callback();
				}
			}
			if (!this.target) return;
			this._direction.subVectors(this.target, this.character.position);
			this._direction.y = 0;
			const distance = this._direction.length();
			if (distance <= this.arrivalThreshold) {
				this.character.position.x = this.target.x;
				this.character.position.z = this.target.z;
				const callback = this.onArrive;
				this.target = null;
				this.onArrive = null;
				if (callback) callback(); else this.stop();
				return;
			}
			this._direction.multiplyScalar(1 / distance);
			if (this.faceMovement) this.faceTarget(this.target);
			const distanceThisFrame = Math.min(this.moveSpeed * delta, distance);
			this.character.position.addScaledVector(this._direction, distanceThisFrame);
		}

		getTarget() { return this.target ? this.target.clone() : null; }
	}

	global.LM_NPCCharacterController = NPCCharacterController;
})(window);
