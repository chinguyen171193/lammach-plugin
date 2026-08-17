(function (global) {
	'use strict';

	const STATES = Object.freeze({ IDLE: 'IDLE', WALKING: 'WALKING' });

	/** Owns one AnimationMixer for one imported character. */
	class NPCAnimationController {
		constructor(model, clips, actionMap, options) {
			this.mixer = new global.THREE.AnimationMixer(model);
			this.clips = new Map((clips || []).map(clip => [clip.name, clip]));
			this.actionMap = Object.assign({}, actionMap || {});
			this.fadeDuration = Number((options || {}).fadeDuration) || 0.3;
			this.actions = new Map();
			this.currentAction = null;
			this.currentName = '';
		}

		hasAction(name) { return Boolean(this.actionMap[name] && this.clips.has(this.actionMap[name])); }

		playAction(name) {
			const clipName = this.actionMap[name];
			if (!clipName || !this.clips.has(clipName)) return false;
			if (this.currentName === name) return true;
			let next = this.actions.get(clipName);
			if (!next) { next = this.mixer.clipAction(this.clips.get(clipName)); this.actions.set(clipName, next); }
			next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).setLoop(global.THREE.LoopRepeat, Infinity).play();
			if (this.currentAction && this.currentAction !== next) this.currentAction.crossFadeTo(next, this.fadeDuration, true);
			this.currentAction = next;
			this.currentName = name;
			return true;
		}

		stop() { this.mixer.stopAllAction(); this.currentAction = null; this.currentName = ''; }
		update(delta) { this.mixer.update(delta); }
		destroy() { this.stop(); this.actions.clear(); }
	}

	global.LM_NPCAnimationController = NPCAnimationController;
	global.LM_NPC_STATES = STATES;
})(window);
