(function (global) {
	'use strict';

	/**
	 * Animation-only state machine for clips embedded in the loaded model.
	 * It has no knowledge of WordPress, cards, tasks, progress, or debug UI.
	 */
	class Agent3DStateMachine {
		constructor(mixer, animations, states, options) {
			this.mixer = mixer;
			this.options = Object.assign({ fadeDuration: 0.28 }, options || {});
			this.states = states || {};
			this.clips = new Map((animations || []).map(clip => [clip.name, clip]));
			this.actions = new Map();
			this.currentAction = null;
			this.currentState = '';
			this.currentClip = '';
			this.finishedHandler = null;
			this.destroyed = false;
			this.validateStates();
		}

		validateStates() {
			const missing = [];
			Object.keys(this.states).forEach(state => {
				const clipName = this.states[state] && this.states[state].clip;
				if (clipName && !this.clips.has(clipName)) missing.push(state + ': ' + clipName);
			});
			if (missing.length) throw new Error('Thiếu animation nhúng sẵn: ' + missing.join(', '));
		}

		clipNames() {
			return Array.from(this.clips.keys());
		}

		action(clipName) {
			if (!this.clips.has(clipName)) throw new Error('Không tìm thấy native clip: ' + clipName);
			if (!this.actions.has(clipName)) {
				this.actions.set(clipName, this.mixer.clipAction(this.clips.get(clipName)));
			}
			return this.actions.get(clipName);
		}

		clearFinishedHandler() {
			if (!this.finishedHandler) return;
			this.mixer.removeEventListener('finished', this.finishedHandler);
			this.finishedHandler = null;
		}

		onFinished(action, callback) {
			this.clearFinishedHandler();
			this.finishedHandler = event => {
				if (this.destroyed || event.action !== action) return;
				this.clearFinishedHandler();
				callback();
			};
			this.mixer.addEventListener('finished', this.finishedHandler);
		}

		playClip(clipName, settings) {
			if (this.destroyed) return;
			const options = Object.assign({ loop: true, immediate: false, afterState: '' }, settings || {});
			const next = this.action(clipName);
			next.enabled = true;
			next.paused = false;
			next.reset();
			next.setEffectiveTimeScale(1);
			next.setEffectiveWeight(1);
			next.clampWhenFinished = !options.loop;
			next.setLoop(options.loop ? global.THREE.LoopRepeat : global.THREE.LoopOnce, options.loop ? Infinity : 1);
			next.play();

			if (this.currentAction && this.currentAction !== next) {
				if (options.immediate) this.currentAction.stop();
				else this.currentAction.crossFadeTo(next, this.options.fadeDuration, true);
			}

			this.clearFinishedHandler();
			this.currentAction = next;
			this.currentClip = clipName;
			if (!options.loop && options.afterState) {
				this.onFinished(next, () => this.setState(options.afterState, false));
			}
		}

		setState(state, immediate) {
			if (this.destroyed) return;
			const definition = this.states[state] || this.states.idle;
			if (!definition || !definition.clip) throw new Error('State 3D không hợp lệ: ' + state);
			if (!immediate && state === this.currentState) return;
			this.currentState = state;
			this.playClip(definition.clip, {
				loop: definition.loop !== false,
				immediate: Boolean(immediate),
				afterState: definition.afterState || ''
			});
		}

		stop() {
			if (this.destroyed) return;
			this.clearFinishedHandler();
			this.mixer.stopAllAction();
			this.currentAction = null;
			this.currentState = '';
			this.currentClip = '';
		}

		setPaused(paused) {
			this.mixer.timeScale = paused ? 0 : 1;
		}

		update(delta) {
			if (!this.destroyed) this.mixer.update(delta);
		}

		destroy() {
			if (this.destroyed) return;
			this.stop();
			this.destroyed = true;
			this.actions.clear();
		}
	}

	global.DAT_Agent3DStateMachine = Agent3DStateMachine;
})(window);
