(function (global) {
	'use strict';

	function stateLabel(state) {
		return { idle: 'Đang chờ', working: 'Đang làm việc', reviewing: 'Đang rà soát', done: 'Hoàn thành' }[state] || state;
	}

	function addLog(message, type) {
		const log = document.querySelector('[data-dat-ai-demo-log]');
		if (log) log.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' — ' + message;
		if (!global.DAT_AI_OFFICE_ADMIN || !global.DAT_AI_OFFICE_ADMIN.restNonce) return;
		global.fetch(global.DAT_AI_OFFICE_ADMIN.restUrl + 'events', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': global.DAT_AI_OFFICE_ADMIN.restNonce },
			body: JSON.stringify({ type: type || 'new_gerber', title: 'Demo Agent', department: 'pcb', priority: 'normal', message: message })
		}).catch(() => {});
	}

	function initSprites() {
		if (!global.DAT_AgentSpritePlayer || !global.DAT_AI_OFFICE_ADMIN) return;
		document.querySelectorAll('[data-agent-sprite]').forEach(element => {
			if (element.dataset.spriteReady) return;
			element.dataset.spriteReady = '1';
			global.DAT_AgentSpritePlayer.create(element, {
				agentId: element.dataset.agentId,
				spriteId: element.dataset.spriteId,
				state: element.dataset.agentState,
				assetBase: global.DAT_AI_OFFICE_ADMIN.agentAssetsUrl,
				assetVersion: global.DAT_AI_OFFICE_ADMIN.agentAssetsVersion,
				scale: 1
			});
		});
	}

	function wait(milliseconds) {
		return new Promise(resolve => global.setTimeout(resolve, milliseconds));
	}

	async function runDemo(button) {
		if (button.dataset.running) return;
		button.dataset.running = '1';
		button.disabled = true;
		const agentId = 'ai_1';
		global.updateAgentState(agentId, 'idle');
		global.updateAgentTask(agentId, 'Đang theo dõi hoạt động công ty', 0);
		addLog('DAT Supervisor AI đang ở trạng thái ' + stateLabel('idle') + '.', 'new_customer');
		await wait(2000);
		global.updateAgentState(agentId, 'working');
		addLog('DAT Supervisor AI bắt đầu điều phối hoạt động.', 'production_started');
		for (let progress = 10; progress <= 80; progress += 10) {
			global.updateAgentTask(agentId, 'Điều phối các phòng ban', progress);
			await wait(1000);
		}
		await wait(1000);
		global.updateAgentState(agentId, 'reviewing');
		addLog('DAT Supervisor AI đang rà soát dashboard.', 'production_completed');
		await wait(4000);
		global.updateAgentState(agentId, 'done');
		global.updateAgentTask(agentId, 'Đã hoàn thành phiên điều phối', 100);
		addLog('DAT Supervisor AI đã hoàn thành phiên điều phối.', 'production_completed');
		await wait(2000);
		global.updateAgentState(agentId, 'idle');
		global.updateAgentTask(agentId, 'Đang chờ nhiệm vụ tiếp theo', 0);
		addLog('Demo hoàn tất. DAT Supervisor AI quay lại trạng thái chờ.', 'production_completed');
		button.disabled = false;
		delete button.dataset.running;
	}

	document.addEventListener('DOMContentLoaded', () => {
		initSprites();
		const button = document.querySelector('[data-dat-ai-demo-agents]');
		if (button) button.addEventListener('click', () => runDemo(button));
	});
})(window);
