(function (global) {
	'use strict';

	const STATES = Object.freeze({
		IDLE: 'IDLE',
		WALKING: 'WALKING',
		ALIGNING_TO_CHAIR: 'ALIGNING_TO_CHAIR',
		WAITING_AT_CHAIR: 'WAITING_AT_CHAIR',
		SITTING_DOWN: 'SITTING_DOWN',
		SITTING_IDLE: 'SITTING_IDLE',
		WORKING: 'WORKING',
		TYPING: 'TYPING',
		USING_MOUSE: 'USING_MOUSE',
		THINKING: 'THINKING',
		READING: 'READING',
		WRITING: 'WRITING',
		TALKING: 'TALKING',
		PHONE_CALL: 'PHONE_CALL',
		STANDING_UP: 'STANDING_UP'
	});

	const EMPLOYEE_ANIMATION_STATE = Object.freeze({
		idle: 'Idle',
		walking: 'Walk',
		sitting: 'SittingIdle',
		typing: 'Typing',
		using_mouse: 'Mouse',
		working: 'Working',
		talking: 'Talking'
	});

	const PLAY_ANIMATION_ALIASES = Object.freeze({
		idle: STATES.IDLE,
		walk: STATES.WALKING,
		walking: STATES.WALKING,
		sit: STATES.SITTING_IDLE,
		sitting: STATES.SITTING_IDLE,
		sittingidle: STATES.SITTING_IDLE,
		typing: STATES.TYPING,
		mouse: STATES.USING_MOUSE,
		usingmouse: STATES.USING_MOUSE,
		using_mouse: STATES.USING_MOUSE,
		working: STATES.WORKING,
		talking: STATES.TALKING
	});

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

		setState(state, options) {
			if (!STATES[state]) throw new Error('NPC state không hợp lệ: ' + state);
			if (state === this.currentState) return true;
			const allowFallback = !options || options.allowFallback !== false;
			const clipName = this.animationMap[state] || (allowFallback ? this.animationMap.IDLE : '');
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
			this.currentAnimation = clipName + (this.animationMap[state] ? '' : ' (fallback Idle)');
			return true;
		}

		hasAnimation(state) { return Boolean(this.animationMap[state]); }

		stateFromAnimationName(name) {
			const key = String(name || '').replace(/[\s-]/g, '').toLowerCase();
			return PLAY_ANIMATION_ALIASES[key] || PLAY_ANIMATION_ALIASES[String(name || '').toLowerCase()] || '';
		}

		playAnimation(name) {
			const state = this.stateFromAnimationName(name);
			if (!state || !this.hasAnimation(state)) return false;
			return this.setState(state, { allowFallback: false });
		}

		update(delta) { this.mixer.update(delta); }
		getState() { return this.currentState || STATES.IDLE; }
		getAnimation() { return this.currentAnimation || '—'; }
		destroy() { this.mixer.stopAllAction(); this.actions.clear(); }
	}

	global.LM_NPCAnimationController = NPCAnimationController;
	global.LM_NPC_STATES = STATES;
	global.LM_EMPLOYEE_ANIMATION_STATE = EMPLOYEE_ANIMATION_STATE;
})(window);
