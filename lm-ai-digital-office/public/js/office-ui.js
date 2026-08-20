(function (global) {
	'use strict';

	class OfficeUI {
		constructor(root, config, bus, engine) {
			this.root = root;
			this.config = config;
			this.bus = bus;
			this.engine = engine;
			this.metrics = root.querySelector('[data-office-metrics]');
			this.logList = root.querySelector('[data-office-log-list]');
			this.card = root.querySelector('[data-office-agent-card]');
			this.modal = root.querySelector('[data-office-task-modal]');
			this.spritePlayer = null;
			this.bind();
			this.renderMetrics();
			this.renderLogs();
			bus.on('log', () => { this.renderLogs(); this.renderMetrics(); });
		}

		bind() {
			const find = selector => this.root.querySelector(selector);
			this.root.querySelectorAll('[data-office-action]').forEach(button => button.addEventListener('click', () => this.action(button.dataset.officeAction)));
			const filter = find('[data-office-filter]');
			if (filter) filter.addEventListener('change', () => this.renderLogs());
			const close = find('[data-office-close-task]');
			if (close) close.addEventListener('click', () => this.hideTask());
			const form = find('[data-office-task-form]');
			if (form) form.addEventListener('submit', event => this.submitTask(event));
			this.root.querySelectorAll('[data-office-toggle]').forEach(button => button.addEventListener('click', () => {
				const item = button.dataset.officeToggle === 'log' ? this.root.querySelector('[data-office-log]') : this.root.querySelector('[data-office-dashboard]');
				if (item) item.classList.toggle('is-open');
			}));
		}

		async action(action) {
			if (action === 'demo') this.engine.runDemo();
			if (action === 'zoom-in') this.engine.zoomBy(1.15);
			if (action === 'zoom-out') this.engine.zoomBy(.87);
			if (action === 'reset') this.engine.resetCamera();
			if (action === 'tour') this.engine.autoTour = !this.engine.autoTour;
			if (action === 'fullscreen') {
				if (!document.fullscreenElement) this.root.requestFullscreen && this.root.requestFullscreen();
				else document.exitFullscreen && document.exitFullscreen();
			}
			if (action === 'task') this.showTask();
			if (action === 'build') {
				if (this.engine.liveMode) this.engine.liveMode.deactivate();
				if (this.engine.buildMode) await this.engine.buildMode.activate();
				else this.bus.log({ actor: 'Hệ thống', department: 'ai_center', level: 'warning', message: 'Không thể bật Chế độ xây dựng.' });
			}
			if (action === 'activity') {
				if (this.engine.liveMode) {
					await this.engine.liveMode.activate();
				} else if (this.engine.buildMode) this.engine.buildMode.deactivate();
			}
			if (action === 'sound') {
				const key = 'datAiOfficeSound';
				localStorage.setItem(key, localStorage.getItem(key) === '1' ? '0' : '1');
				this.bus.log({ actor: 'LM Supervisor AI', department: 'ai_center', message: localStorage.getItem(key) === '1' ? 'Âm thanh đã bật.' : 'Âm thanh đã tắt.' });
			}
		}

		renderMetrics() {
			if (!this.metrics) return;
			const humans = this.engine.agents.filter(agent => agent.data.type === 'human').length;
			const ai = this.engine.agents.filter(agent => agent.data.type === 'ai').length;
			const active = this.engine.agents.filter(agent => ['working', 'typing', 'walking'].includes(agent.data.status)).length;
			this.metrics.innerHTML = [['Nhân viên online', humans], ['AI Agent', ai], ['Đang xử lý', active], ['Hoàn thành', this.engine.completed], ['Hiệu suất', this.engine.efficiency + '%'], ['Tiết kiệm', this.engine.saved + ' phút']].map(metric => `<div class="lm-ai-office__metric"><b>${metric[1]}</b><span>${metric[0]}</span></div>`).join('');
		}

		renderLogs() {
			if (!this.logList) return;
			const filter = this.root.querySelector('[data-office-filter]');
			const value = filter ? filter.value : 'all';
			this.logList.innerHTML = this.bus.logs.filter(log => value === 'all' || log.department === value || (value === 'ai' && /AI/.test(log.actor))).slice(0, 32).map(log => `<article class="lm-ai-office__entry" data-level="${this.escape(log.level)}"><time>${this.time(log.created_at)} — ${this.escape(log.actor)}</time>${this.escape(log.message)}</article>`).join('');
		}

		showAgent(agent) {
			const data = agent.data;
			if (this.spritePlayer) this.spritePlayer.destroy();
			this.card.hidden = false;
			this.card.dataset.agentState = this.spriteState(data.status);
			this.card.innerHTML = `<button class="lm-ai-office__close">×</button><div class="lm-agent-sprite" data-agent-sprite data-agent-id="${this.escape(data.id)}" data-sprite-id="${this.escape(data.sprite || '_placeholder')}" data-agent-state="${this.escape(data.status)}"><div class="lm-agent-sprite__surface" data-agent-sprite-surface></div><div class="lm-agent-sprite__fallback" aria-hidden="true"></div></div><h3>${this.escape(data.name)}</h3><p>${this.escape(data.role)} · ${this.escape(data.department)}</p><div class="lm-ai-office__row"><span>Trạng thái</span><b data-agent-status>${this.escape(data.status)}</b></div><div class="lm-ai-office__row"><span>Nhiệm vụ</span><b data-agent-task>${this.escape(data.task || 'Đang chờ')}</b></div><div class="lm-ai-office__row"><span>Tiến độ</span><b data-agent-progress-value>${Math.round(data.progress || 0)}%</b></div><div class="lm-ai-office__agent-progress"><i data-agent-progress-bar style="width:${Math.max(0, Math.min(100, Number(data.progress) || 0))}%"></i></div><p>Lịch sử: ${this.escape((data.history || []).join(' · '))}</p><button data-follow>Camera follow</button> <button data-move>Chuyển phòng</button>`;
			const sprite = this.card.querySelector('[data-agent-sprite]');
			if (sprite && global.LM_AgentSpritePlayer) {
				this.spritePlayer = global.LM_AgentSpritePlayer.create(sprite, { agentId: data.id, spriteId: data.sprite || '_placeholder', state: data.status, assetBase: (global.LM_AI_OFFICE || {}).agentAssetsUrl || '', assetVersion: (global.LM_AI_OFFICE || {}).agentAssetsVersion || '', scale: 1 });
			}
			this.card.querySelector('.lm-ai-office__close').onclick = () => this.closeAgent();
			this.card.querySelector('[data-follow]').onclick = () => this.engine.follow(agent);
			this.card.querySelector('[data-move]').onclick = () => this.engine.moveToNextRoom(agent);
		}

		closeAgent() {
			if (this.spritePlayer) this.spritePlayer.destroy();
			this.spritePlayer = null;
			this.card.hidden = true;
		}

		spriteState(state) {
			return ({ online: 'idle', waiting: 'idle', processing: 'working', typing: 'working', checking: 'reviewing', completed: 'done' })[state] || state || 'idle';
		}

		showTask() {
			if (!this.modal) return;
			this.modal.hidden = false;
			const departments = this.modal.querySelector('[data-office-departments]');
			const people = this.modal.querySelector('[data-office-assignees]');
			const workflows = this.modal.querySelector('[data-office-workflows]');
			departments.innerHTML = this.config.data.departments.map(department => `<option value="${department.id}">${this.escape(department.name)}</option>`).join('');
			people.innerHTML = this.engine.agents.map(agent => `<option value="${agent.data.id}">${this.escape(agent.data.name)}</option>`).join('');
			workflows.innerHTML = '<option value="">Không gắn workflow</option>' + this.config.data.workflows.map(workflow => `<option value="${workflow.id}">${this.escape(workflow.name)}</option>`).join('');
		}

		hideTask() { if (this.modal) this.modal.hidden = true; }

		async submitTask(event) {
			event.preventDefault();
			const data = Object.fromEntries(new FormData(event.currentTarget));
			try {
				const response = await fetch(global.LM_AI_OFFICE.restUrl + 'tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': global.LM_AI_OFFICE.nonce }, body: JSON.stringify(data) });
				if (!response.ok) throw new Error('Không thể lưu nhiệm vụ');
				this.engine.assignTask(data);
				global.updateAgentState && global.updateAgentState(data.assignee, 'working');
				global.updateAgentTask && global.updateAgentTask(data.assignee, data.title, 0);
				this.bus.log({ actor: 'LM Supervisor AI', department: data.department, level: 'success', message: 'Đã giao nhiệm vụ: ' + data.title });
				this.hideTask();
				event.currentTarget.reset();
			} catch (error) {
				this.bus.log({ actor: 'Hệ thống', department: 'ai_center', level: 'warning', message: error.message });
			}
		}

		time(value) { const date = new Date(value); return isNaN(date) ? 'Bây giờ' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
		escape(value) { const element = document.createElement('span'); element.textContent = value == null ? '' : String(value); return element.innerHTML; }
	}

	global.LMAIOfficeUI = OfficeUI;
})(window);
