(function (global) {
	'use strict';

	const STATES = Object.freeze({ IDLE: 'IDLE', WALKING: 'WALKING' });

	/** Keeps AnimationMixer state transitions separate from character movement. */
	class NPCAnimationController {
		constructor(mixer, clips, animationMap, options) {
			this.mixer = mixer;
			this.clips = new Map((clips || []).map(clip => [clip.name, clip]));
			this.animationMap = Object.assign({}, animationMap);
			this.fadeDuration = Number((options || {}).fadeDuration) || 0.32;
			this.actions = new Map();
			this.currentAction = null;
			this.currentState = '';
			this.currentAnimation = '';
		}

		action(clipName) {
			if (!this.clips.has(clipName)) throw new Error('Không tìm thấy animation clip: ' + clipName);
			if (!this.actions.has(clipName)) this.actions.set(clipName, this.mixer.clipAction(this.clips.get(clipName)));
			return this.actions.get(clipName);
		}

		setState(state) {
			if (!STATES[state]) throw new Error('NPC state không hợp lệ: ' + state);
			if (state === this.currentState) return;
			const clipName = this.animationMap[state];
			if (!clipName) throw new Error('Chưa map animation cho ' + state);
			const next = this.action(clipName);
			next.reset();
			next.enabled = true;
			next.setEffectiveTimeScale(1);
			next.setEffectiveWeight(1);
			next.setLoop(global.THREE.LoopRepeat, Infinity);
			next.play();
			if (this.currentAction && this.currentAction !== next) this.currentAction.crossFadeTo(next, this.fadeDuration, true);
			this.currentAction = next;
			this.currentState = state;
			this.currentAnimation = clipName;
		}

		update(delta) { this.mixer.update(delta); }
		getState() { return this.currentState || STATES.IDLE; }
		getAnimation() { return this.currentAnimation || '—'; }
		destroy() { this.mixer.stopAllAction(); this.actions.clear(); }
	}

	global.DAT_NPCAnimationController = NPCAnimationController;
	global.DAT_NPC_STATES = STATES;
})(window);
