(function (global) {
	'use strict';

	/** Moves NPCRoot in world space. Skeletons and animation tracks never move it. */
	class NPCCharacterController {
		constructor(npcRoot, animationController, options) {
			this.npcRoot = npcRoot;
			this.animationController = animationController;
			this.speed = Number((options || {}).speed) || 1.55;
			this.arrivalThreshold = Number((options || {}).arrivalThreshold) || 0.05;
			this.state = global.LM_NPC_STATES.IDLE;
			this.destination = null;
			this.direction = new global.THREE.Vector3();
		}

		setState(state) {
			if (state !== global.LM_NPC_STATES.IDLE && state !== global.LM_NPC_STATES.WALKING) throw new Error('NPC state không hợp lệ: ' + state);
			this.state = state;
			this.animationController.playAction(state);
		}

		moveTo(target) { this.destination = target.clone(); this.faceTarget(this.destination); this.setState(global.LM_NPC_STATES.WALKING); }

		faceTarget(target) {
			const lookAt = new global.THREE.Vector3(target.x, this.npcRoot.position.y, target.z);
			if (lookAt.distanceToSquared(this.npcRoot.position) > 0.000001) this.npcRoot.lookAt(lookAt);
		}

		stop() { this.destination = null; this.setState(global.LM_NPC_STATES.IDLE); }

		update(delta) {
			if (!this.destination) return;
			this.direction.subVectors(this.destination, this.npcRoot.position);
			this.direction.y = 0;
			const distance = this.direction.length();
			if (distance <= this.arrivalThreshold) { this.stop(); return; }
			this.direction.multiplyScalar(1 / distance);
			this.faceTarget(this.destination);
			this.npcRoot.position.addScaledVector(this.direction, Math.min(this.speed * delta, distance));
		}
	}

	global.LM_NPCCharacterController = NPCCharacterController;
})(window);
