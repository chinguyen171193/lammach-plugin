(function (global) {
	'use strict';

	/**
	 * Animation-only state machine. It has no knowledge of WordPress, cards,
	 * tasks, progress, or the Agent dashboard.
	 */
	class Agent3DStateMachine {
		constructor(mixer, clips, options) {
			this.mixer = mixer;
			this.clips = clips || {};
			this.options = Object.assign({ fadeDuration: 0.32 }, options || {});
			this.actions = new Map();
			this.currentAction = null;
			this.currentState = '';
			this.seated = false;
			this.finishedHandler = null;
			this.destroyed = false;
			this.requireClips(['idle', 'walk', 'sitEnter', 'sitIdle', 'stand']);
		}

		requireClips(names) {
			const missing = names.filter(name => !this.clips[name]);
			if (missing.length) {
				throw new Error('Thiếu animation 3D: ' + missing.join(', '));
			}
		}

		action(name) {
			if (!this.actions.has(name)) {
				this.actions.set(name, this.mixer.clipAction(this.clips[name]));
			}
			return this.actions.get(name);
		}

		clearFinishedHandler() {
			if (!this.finishedHandler) return;
			this.mixer.removeEventListener('finished', this.finishedHandler);
			this.finishedHandler = null;
		}

		onFinished(action, callback) {
			this.clearFinishedHandler();
			this.finishedHandler = event => {
				if (event.action !== action || this.destroyed) return;
				this.clearFinishedHandler();
				callback();
			};
			this.mixer.addEventListener('finished', this.finishedHandler);
		}

		prepareAction(action, loop) {
			action.enabled = true;
			action.paused = false;
			action.reset();
			action.setEffectiveTimeScale(1);
			action.setEffectiveWeight(1);
			action.clampWhenFinished = !loop;
			action.setLoop(loop ? global.THREE.LoopRepeat : global.THREE.LoopOnce, loop ? Infinity : 1);
			return action;
		}

		transition(name, loop, immediate) {
			const next = this.prepareAction(this.action(name), loop);
			next.play();

			if (this.currentAction && this.currentAction !== next) {
				if (immediate) {
					this.currentAction.stop();
				} else {
					this.currentAction.crossFadeTo(next, this.options.fadeDuration, true);
				}
			}

			this.currentAction = next;
			return next;
		}

		playLoop(name, state, immediate) {
			this.clearFinishedHandler();
			this.currentState = state;
			this.transition(name, true, immediate);
		}

		playSit(immediate) {
			this.currentState = 'sit';
			if (this.seated) {
				this.playLoop('sitIdle', 'sit', immediate);
				return;
			}
			const enter = this.transition('sitEnter', false, immediate);
			this.onFinished(enter, () => {
				this.seated = true;
				if (this.currentState === 'sit') this.playLoop('sitIdle', 'sit', false);
			});
		}

		playStand(nextState, immediate) {
			this.currentState = 'stand';
			const exit = this.transition('stand', false, immediate);
			this.onFinished(exit, () => {
				this.seated = false;
				this.setState(nextState || 'idle', false);
			});
		}

		setState(state, immediate) {
			if (this.destroyed) return;
			const next = ['idle', 'walk', 'sit', 'stand'].indexOf(state) >= 0 ? state : 'idle';
			if (!immediate && next === this.currentState && next !== 'stand') return;

			if ((next === 'idle' || next === 'walk') && this.seated) {
				this.playStand(next, immediate);
				return;
			}

			if (next === 'sit') {
				this.playSit(immediate);
				return;
			}

			if (next === 'stand') {
				this.playStand('idle', immediate);
				return;
			}

			this.seated = false;
			this.playLoop(next, next, immediate);
		}

		update(delta) {
			if (!this.destroyed) this.mixer.update(delta);
		}

		destroy() {
			if (this.destroyed) return;
			this.destroyed = true;
			this.clearFinishedHandler();
			this.mixer.stopAllAction();
			this.actions.clear();
		}
	}

	global.DAT_Agent3DStateMachine = Agent3DStateMachine;
})(window);
