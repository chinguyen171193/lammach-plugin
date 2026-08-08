(function (global) {
	'use strict';

	/** Moves a character group in world space; it deliberately has no mixer logic. */
	class NPCCharacterController {
		constructor(character, animationController, options) {
			this.character = character;
			this.animationController = animationController;
			this.speed = Number((options || {}).speed) || 1.6;
			this.arrivalThreshold = Number((options || {}).arrivalThreshold) || 0.055;
			this.target = null;
			this._direction = new global.THREE.Vector3();
		}

		moveTo(target) {
			this.target = target.clone();
			this.faceTarget(this.target);
			this.animationController.setState(global.DAT_NPC_STATES.WALKING);
		}

		faceTarget(target) {
			const lookAt = new global.THREE.Vector3(target.x, this.character.position.y, target.z);
			if (lookAt.distanceToSquared(this.character.position) > 0.000001) this.character.lookAt(lookAt);
		}

		stop() {
			this.target = null;
			this.animationController.setState(global.DAT_NPC_STATES.IDLE);
		}

		update(delta) {
			if (!this.target) return;
			this._direction.subVectors(this.target, this.character.position);
			this._direction.y = 0;
			const distance = this._direction.length();
			if (distance <= this.arrivalThreshold) {
				this.character.position.x = this.target.x;
				this.character.position.z = this.target.z;
				this.stop();
				return;
			}
			this._direction.multiplyScalar(1 / distance);
			this.faceTarget(this.target);
			const distanceThisFrame = Math.min(this.speed * delta, distance);
			this.character.position.addScaledVector(this._direction, distanceThisFrame);
		}

		getTarget() { return this.target ? this.target.clone() : null; }
	}

	global.DAT_NPCCharacterController = NPCCharacterController;
})(window);
