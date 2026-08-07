(function (global) {
	'use strict';

	const stateMap = {
		online: 'idle', waiting: 'idle', idle: 'idle',
		working: 'working', processing: 'working', typing: 'working',
		reviewing: 'reviewing', checking: 'reviewing',
		done: 'done', completed: 'done'
	};
	const configCache = new Map();
	const imageCache = new Map();
	const players = new Set();
	const registry = new Map();
	let animationFrame = 0;
	let previousTime = 0;

	const placeholderConfig = {
		id: '_placeholder', frameWidth: 320, frameHeight: 400,
		states: {
			idle: { image: '', frames: 6, fps: 4, loop: true },
			working: { image: '', frames: 8, fps: 8, loop: true },
			reviewing: { image: '', frames: 6, fps: 5, loop: true },
			done: { image: '', frames: 6, fps: 6, loop: false }
		}
	};

	function normalizedState(state) {
		return stateMap[String(state || 'idle').toLowerCase()] || 'idle';
	}

	function versionedUrl(url, version) {
		if (!version) return url;
		return url + (url.indexOf('?') === -1 ? '?' : '&') + 'ver=' + encodeURIComponent(version);
	}

	function imageUrl(baseUrl, spriteId, image, version) {
		return image ? versionedUrl(baseUrl.replace(/\/$/, '') + '/' + spriteId + '/' + image, version) : '';
	}

	function preloadImage(source) {
		if (!source) return Promise.resolve(false);
		if (!imageCache.has(source)) {
			imageCache.set(source, new Promise(resolve => {
				const image = new Image();
				image.onload = () => resolve(true);
				image.onerror = () => resolve(false);
				image.src = source;
			}));
		}
		return imageCache.get(source);
	}

	function startScheduler() {
		const hasActivePlayer = Array.from(players).some(player => player.needsScheduler());
		if (!animationFrame && !document.hidden && hasActivePlayer) {
			animationFrame = global.requestAnimationFrame(tick);
		}
	}

	function tick(time) {
		animationFrame = 0;
		const delta = Math.min(0.1, previousTime ? (time - previousTime) / 1000 : 0);
		previousTime = time;
		players.forEach(player => player.tick(delta));
		startScheduler();
	}

	document.addEventListener('visibilitychange', () => {
		previousTime = 0;
		players.forEach(player => player.syncAnimationState());
		if (!document.hidden) startScheduler();
	});

	class AgentSpritePlayer {
		constructor(element, options) {
			this.element = element;
			this.options = Object.assign({ state: 'idle', scale: 1, assetBase: '', assetVersion: '', agentId: '', spriteId: '_placeholder' }, options || {});
			this.agentId = this.options.agentId;
			this.spriteId = this.options.spriteId || '_placeholder';
			this.state = normalizedState(this.options.state);
			this.frame = 0;
			this.elapsed = 0;
			this.doneDelay = 0;
			this.running = true;
			this.inViewport = true;
			this.destroyed = false;
			this.config = placeholderConfig;
			this.sprite = this.element.querySelector('[data-agent-sprite-surface]') || this.element;
			this.element.style.setProperty('--agent-sprite-scale', Math.max(0.5, Number(this.options.scale) || 1));
			this.element.classList.add('dat-agent-sprite', 'is-loading');
			this.observe();
			this.register();
			this.loadConfig();
		}

		static getConfig(spriteId, assetBase, assetVersion) {
			const key = assetBase + ':' + spriteId + ':' + (assetVersion || '');
			if (!configCache.has(key)) {
				const url = versionedUrl(assetBase.replace(/\/$/, '') + '/' + spriteId + '/config.json', assetVersion);
				configCache.set(key, fetch(url, { credentials: 'same-origin' })
					.then(response => response.ok ? response.json() : Promise.reject(new Error('Không tìm thấy config sprite')))
					.catch(() => placeholderConfig));
			}
			return configCache.get(key);
		}

		static create(element, options) {
			return new AgentSpritePlayer(element, options);
		}

		async loadConfig() {
			this.config = await AgentSpritePlayer.getConfig(this.spriteId, this.options.assetBase, this.options.assetVersion);
			if (this.destroyed) return;
			this.element.style.setProperty('--agent-frame-ratio', (this.config.frameWidth || 320) + ' / ' + (this.config.frameHeight || 400));
			await this.preloadStates();
			if (this.destroyed) return;
			this.element.classList.remove('is-loading');
			this.applyState(this.state, true);
		}

		preloadStates() {
			if (this.config.placeholder || !this.config.states) return Promise.resolve();
			if (this.playbackMode(this.config.states[this.state]) === 'rig') return Promise.resolve();
			const sources = Object.keys(this.config.states).map(key => {
				const definition = this.config.states[key] || {};
				return imageUrl(this.options.assetBase, this.spriteId, definition.image, this.options.assetVersion);
			}).filter(Boolean);
			const stable = this.config.stableDisplay || {};
			const stableSource = imageUrl(this.options.assetBase, this.spriteId, stable.image, this.options.assetVersion);
			if (stableSource) sources.push(stableSource);
			return Promise.all(Array.from(new Set(sources)).map(preloadImage));
		}

		observe() {
			if ('IntersectionObserver' in global) {
				this.observer = new IntersectionObserver(entries => {
					this.inViewport = entries.some(entry => entry.isIntersecting);
					this.syncAnimationState();
					if (this.inViewport) startScheduler();
				}, { threshold: 0.05 });
				this.observer.observe(this.element);
			}
			if ('ResizeObserver' in global) {
				this.resizeObserver = new ResizeObserver(() => this.renderFrame());
				this.resizeObserver.observe(this.sprite);
			}
		}

		register() {
			players.add(this);
			if (this.agentId) {
				if (!registry.has(this.agentId)) registry.set(this.agentId, new Set());
				registry.get(this.agentId).add(this);
			}
			startScheduler();
		}

		applyState(state, force) {
			const nextState = normalizedState(state);
			if (!force && nextState === this.state && this.element.dataset.spriteInitialized === '1') return;
			this.state = nextState;
			const definition = this.config.states[this.state] || this.config.states.idle || placeholderConfig.states.idle;
			const visualDefinition = this.visualDefinition(definition);
			const frames = Math.max(1, Number(visualDefinition.frames) || 1);
			const playback = this.playbackMode(definition);
			this.frame = playback === 'stable' ? this.stableFrame(visualDefinition, frames) : 0;
			this.elapsed = 0;
			this.doneDelay = 0;
			const source = this.config.placeholder || playback === 'rig' ? '' : imageUrl(this.options.assetBase, this.spriteId, visualDefinition.image, this.options.assetVersion);
			this.element.dataset.spriteState = this.state;
			this.element.dataset.spritePlayback = playback;
			this.element.style.setProperty('--agent-frame-count', frames);
			this.element.style.setProperty('--agent-frame', String(this.frame));
			const rigReady = playback === 'rig' ? this.ensureRig() : false;
			if (playback !== 'rig') this.removeRig();
			this.sprite.style.backgroundImage = source ? 'url("' + source.replace(/"/g, '%22') + '")' : 'none';
			this.element.classList.toggle('has-sprite-image', Boolean(source));
			this.element.classList.toggle('has-agent-rig', rigReady);
			this.element.classList.toggle('is-stable-playback', playback === 'stable');
			this.element.dataset.spriteInitialized = '1';
			if (source) this.usePreloadedSource(source);
			else this.element.classList.toggle('is-sprite-ready', rigReady);
			this.renderFrame();
			this.syncCard();
			this.syncAnimationState();
			startScheduler();
		}

		ensureRig() {
			if (this.rigMounted) return true;
			if (!global.DAT_AgentRig || typeof global.DAT_AgentRig.markup !== 'function') return false;
			this.sprite.innerHTML = global.DAT_AgentRig.markup(this.spriteId);
			this.sprite.classList.add('is-agent-rig');
			this.rigMounted = true;
			return true;
		}

		removeRig() {
			if (!this.rigMounted) return;
			this.sprite.replaceChildren();
			this.sprite.classList.remove('is-agent-rig');
			this.rigMounted = false;
		}

		usePreloadedSource(source) {
			this.activeSource = source;
			preloadImage(source).then(loaded => {
				if (this.destroyed || this.activeSource !== source) return;
				if (loaded) {
					this.element.classList.add('is-sprite-ready');
					return;
				}
				this.element.classList.remove('has-sprite-image', 'is-sprite-ready');
				this.sprite.style.backgroundImage = 'none';
			});
		}

		loadState(state) {
			this.applyState(state);
			return this;
		}

		setState(state) {
			this.loadState(state);
			return this;
		}

		play() { this.running = true; this.syncAnimationState(); startScheduler(); return this; }
		pause() { this.running = false; this.syncAnimationState(); return this; }
		syncAnimationState() {
			this.element.classList.toggle('is-animation-paused', !this.running || !this.inViewport || document.hidden);
		}
		stop() {
			this.running = false;
			const definition = this.config.states[this.state] || this.config.states.idle;
			const visualDefinition = this.visualDefinition(definition);
			const frames = Math.max(1, Number(visualDefinition && visualDefinition.frames) || 1);
			const playback = this.playbackMode(definition);
			this.frame = playback === 'stable' ? this.stableFrame(visualDefinition, frames) : 0;
			this.renderFrame();
			this.syncAnimationState();
			return this;
		}

		frameDuration(definition, frame) {
			const durations = definition && Array.isArray(definition.frameDurations) ? definition.frameDurations : [];
			const configured = Number(durations[frame]);
			if (Number.isFinite(configured) && configured > 0) return configured;
			return 1000 / Math.max(1, Number(definition && definition.fps) || 1);
		}

		frameOffset(definition, frame) {
			const offsets = definition && Array.isArray(definition.frameOffsets) ? definition.frameOffsets : [];
			const offset = offsets[frame] || {};
			return {
				x: Number.isFinite(Number(offset.x)) ? Number(offset.x) : 0,
				y: Number.isFinite(Number(offset.y)) ? Number(offset.y) : 0
			};
		}

		playbackMode(definition) {
			const mode = String((definition && definition.playback) || this.config.playback || 'sprite').toLowerCase();
			return mode === 'stable' || mode === 'rig' ? mode : 'sprite';
		}

		needsScheduler() {
			if (this.destroyed || !this.running || !this.inViewport || document.hidden || !this.config.states) return false;
			const definition = this.config.states[this.state] || this.config.states.idle;
			const playback = this.playbackMode(definition);
			return playback === 'sprite' || this.state === 'done';
		}

		visualDefinition(definition) {
			const stable = this.config.stableDisplay || {};
			if (this.playbackMode(definition) !== 'stable' || !stable.image) return definition;
			return Object.assign({}, definition, {
				image: stable.image,
				frames: Math.max(1, Number(stable.frames) || 1),
				stableFrame: Math.max(0, Number(stable.frame) || 0)
			});
		}

		stableFrame(definition, frames) {
			const configured = Number(definition && definition.stableFrame);
			const frame = Number.isFinite(configured) ? Math.round(configured) : 0;
			return Math.max(0, Math.min(frames - 1, frame));
		}

		tick(delta) {
			if (this.destroyed || !this.running || !this.inViewport || document.hidden || !this.config.states) return;
			const definition = this.config.states[this.state] || this.config.states.idle;
			if (!definition) return;
			const frames = Math.max(1, Number(definition.frames) || 1);
			const elapsedMs = Math.max(0, delta * 1000);
			const playback = this.playbackMode(definition);
			if (playback === 'rig' || playback === 'stable') {
				if (!definition.loop && this.state === 'done') {
					this.doneDelay += elapsedMs;
					const holdLast = Math.max(1000, Number(definition.holdLast) || 1400);
					if (this.doneDelay >= holdLast) this.setState('idle');
				}
				return;
			}

			if (!definition.loop && this.frame === frames - 1) {
				this.doneDelay += elapsedMs;
				const holdLast = Math.max(1000, Number(definition.holdLast) || 1400);
				if (this.state === 'done' && this.doneDelay >= holdLast) this.setState('idle');
				return;
			}

			this.elapsed += elapsedMs;
			let changed = false;
			let safety = 0;
			while (safety < frames && this.elapsed >= this.frameDuration(definition, this.frame)) {
				this.elapsed -= this.frameDuration(definition, this.frame);
				if (this.frame < frames - 1) {
					this.frame++;
				} else if (definition.loop) {
					this.frame = 0;
				} else {
					this.elapsed = 0;
					break;
				}
				changed = true;
				safety++;
			}
			if (changed) this.renderFrame();
		}

		renderFrame() {
			const stateDefinition = this.config.states[this.state] || this.config.states.idle;
			if (this.playbackMode(stateDefinition) === 'rig') return;
			const definition = this.visualDefinition(stateDefinition);
			const frames = Math.max(1, Number(definition && definition.frames) || 1);
			const frameWidth = Math.max(1, Number(this.config.frameWidth) || 320);
			const frameHeight = Math.max(1, Number(this.config.frameHeight) || 400);
			const renderWidth = this.sprite.clientWidth || frameWidth;
			const renderHeight = this.sprite.clientHeight || frameHeight;
			const scaleX = renderWidth / frameWidth;
			const scaleY = renderHeight / frameHeight;
			const offset = this.frameOffset(definition, this.frame);
			const positionX = (-this.frame * frameWidth * scaleX) + (offset.x * scaleX);
			const positionY = offset.y * scaleY;
			this.element.style.setProperty('--agent-frame', this.frame);
			this.sprite.style.backgroundPosition = positionX + 'px ' + positionY + 'px';
			this.sprite.style.backgroundSize = (frameWidth * frames * scaleX) + 'px ' + (frameHeight * scaleY) + 'px';
		}

		syncCard() {
			const card = this.element.closest('[data-agent-card]');
			if (!card) return;
			card.dataset.agentState = this.state;
			const stateLabel = card.querySelector('[data-agent-status]');
			if (stateLabel) stateLabel.textContent = this.state;
		}

		destroy() {
			this.destroyed = true;
			players.delete(this);
			if (this.observer) this.observer.disconnect();
			if (this.resizeObserver) this.resizeObserver.disconnect();
			this.removeRig();
			if (this.agentId && registry.has(this.agentId)) registry.get(this.agentId).delete(this);
		}
	}

	function updateAgentState(agentId, state) {
		const current = registry.get(agentId);
		if (!current || !current.size) return false;
		current.forEach(player => player.setState(state));
		return true;
	}

	function updateAgentTask(agentId, taskName, progress) {
		const current = registry.get(agentId);
		if (!current || !current.size) return false;
		current.forEach(player => {
			const card = player.element.closest('[data-agent-card]');
			if (!card) return;
			const task = card.querySelector('[data-agent-task]');
			const value = card.querySelector('[data-agent-progress-value]');
			const bar = card.querySelector('[data-agent-progress-bar]');
			const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
			if (task) task.textContent = taskName || 'Đang chờ nhiệm vụ';
			if (value) value.textContent = Math.round(safeProgress) + '%';
			if (bar) bar.style.width = safeProgress + '%';
		});
		return true;
	}

	global.DAT_AgentSpritePlayer = AgentSpritePlayer;
	global.updateAgentState = updateAgentState;
	global.updateAgentTask = updateAgentTask;
})(window);
