(function (global) {
	'use strict';
	class OfficeEventBus {
		constructor(logs) { this.logs = (logs || []).slice(0, 50).reverse(); this.listeners = {}; }
		on(name, callback) { (this.listeners[name] = this.listeners[name] || []).push(callback); }
		emit(name, payload) { (this.listeners[name] || []).forEach(callback => callback(payload)); }
		log(entry) { const item = Object.assign({ actor: 'LM Supervisor AI', department: 'ai_center', level: 'info', message: '', created_at: new Date().toISOString() }, entry); this.logs.unshift(item); this.logs.length = Math.min(50, this.logs.length); this.emit('log', item); return item; }
	}
	global.LMAIOfficeEventBus = OfficeEventBus;
})(window);
