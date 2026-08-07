(function (global) {
	'use strict';

	const stateMap = {
		online: 'idle', waiting: 'idle', idle: 'idle',
		working: 'working', processing: 'working', typing: 'working',
		reviewing: 'reviewing', checking: 'reviewing',
		done: 'done', completed: 'done'
	};
	const configCache = new Map();
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

	function imageUrl(baseUrl, spriteId, image) {
		return image ? baseUrl.replace(/\/$/, '') + '/' + spriteId + '/' + image : '';
	}

	function startScheduler() {
		if (!animationFrame && !document.hidden && players.size) {
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
		if (!document.hidden) startScheduler();
	});

	class AgentSpritePlayer {
		constructor(element, options) {
			this.element = element;
			this.options = Object.assign({ state: 'idle', scale: 1, assetBase: '', agentId: '', spriteId: '_placeholder' }, options || {});
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

		static getConfig(spriteId, assetBase) {
			const key = assetBase + ':' + spriteId;
			if (!configCache.has(key)) {
				const url = assetBase.replace(/\/$/, '') + '/' + spriteId + '/config.json';
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
			this.config = await AgentSpritePlayer.getConfig(this.spriteId, this.options.assetBase);
			if (this.destroyed) return;
			this.element.style.setProperty('--agent-frame-ratio', (this.config.frameWidth || 320) + ' / ' + (this.config.frameHeight || 400));
			this.element.classList.remove('is-loading');
			this.applyState(this.state);
		}

		observe() {
			if (!('IntersectionObserver' in global)) return;
			this.observer = new IntersectionObserver(entries => {
				this.inViewport = entries.some(entry => entry.isIntersecting);
				if (this.inViewport) startScheduler();
			}, { threshold: 0.05 });
			this.observer.observe(this.element);
		}

		register() {
			players.add(this);
			if (this.agentId) {
				if (!registry.has(this.agentId)) registry.set(this.agentId, new Set());
				registry.get(this.agentId).add(this);
			}
			startScheduler();
		}

		applyState(state) {
			this.state = normalizedState(state);
			this.frame = 0;
			this.elapsed = 0;
			this.doneDelay = 0;
			const definition = this.config.states[this.state] || this.config.states.idle || placeholderConfig.states.idle;
			const frames = Math.max(1, Number(definition.frames) || 1);
			const source = this.config.placeholder ? '' : imageUrl(this.options.assetBase, this.spriteId, definition.image);
			this.element.dataset.spriteState = this.state;
			this.element.style.setProperty('--agent-frame-count', frames);
			this.element.style.setProperty('--agent-frame', '0');
			this.sprite.style.backgroundSize = (frames * 100) + '% 100%';
			this.sprite.style.backgroundPosition = '0 0';
			this.sprite.style.backgroundImage = source ? 'url("' + source.replace(/"/g, '%22') + '")' : 'none';
			this.element.classList.toggle('has-sprite-image', Boolean(source));
			if (source) this.preload(source);
			this.syncCard();
			startScheduler();
		}

		preload(source) {
			const image = new Image();
			image.onload = () => { if (!this.destroyed) this.element.classList.add('is-sprite-ready'); };
			image.onerror = () => { if (!this.destroyed) { this.element.classList.remove('has-sprite-image', 'is-sprite-ready'); this.sprite.style.backgroundImage = 'none'; } };
			image.src = source;
		}

		loadState(state) {
			this.applyState(state);
			return this;
		}

		setState(state) {
			this.loadState(state);
			return this;
		}

		play() { this.running = true; startScheduler(); return this; }
		pause() { this.running = false; return this; }
		stop() { this.running = false; this.frame = 0; this.renderFrame(); return this; }

		tick(delta) {
			if (this.destroyed || !this.running || !this.inViewport || document.hidden || !this.config.states) return;
			const definition = this.config.states[this.state] || this.config.states.idle;
			if (!definition) return;
			const frames = Math.max(1, Number(definition.frames) || 1);
			const fps = Math.max(1, Number(definition.fps) || 1);
			this.elapsed += delta;
			if (this.elapsed < 1 / fps) return;
			this.elapsed = 0;
			if (this.frame < frames - 1) {
				this.frame++;
			} else if (definition.loop) {
				this.frame = 0;
			} else if (this.state === 'done') {
				this.doneDelay += 1 / fps;
				if (this.doneDelay >= 1.2) this.setState('idle');
			}
			this.renderFrame();
		}

		renderFrame() {
			const definition = this.config.states[this.state] || this.config.states.idle;
			const frames = Math.max(1, Number(definition && definition.frames) || 1);
			const position = frames > 1 ? (this.frame / (frames - 1)) * 100 : 0;
			this.element.style.setProperty('--agent-frame', this.frame);
			this.sprite.style.backgroundPosition = position + '% 0';
			this.sprite.style.backgroundSize = (frames * 100) + '% 100%';
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
