(function (global) {
	'use strict';

	function request(path, options) {
		options = options || {};
		options.headers = options.headers || {};
		options.headers['X-WP-Nonce'] = global.DATPCBTracer.nonce;
		if (options.body && !(options.body instanceof FormData)) {
			options.headers['Content-Type'] = 'application/json';
			options.body = JSON.stringify(options.body);
		}
		return fetch(global.DATPCBTracer.restUrl + path, options).then(function (res) {
			return res.json().then(function (data) {
				if (!res.ok) {
					throw new Error((data && data.message) || 'REST error');
				}
				return data;
			});
		});
	}

	global.DATPCBTracerStorage = {
		list: function () { return request('/projects'); },
		create: function (data) { return request('/projects', { method: 'POST', body: data }); },
		read: function (id) { return request('/projects/' + encodeURIComponent(id)); },
		save: function (id, data) { return request('/projects/' + encodeURIComponent(id), { method: 'PUT', body: data }); },
		remove: function (id) { return request('/projects/' + encodeURIComponent(id), { method: 'DELETE' }); },
		duplicate: function (id) { return request('/projects/' + encodeURIComponent(id) + '/duplicate', { method: 'POST' }); },
		importProject: function (data) { return request('/import', { method: 'POST', body: { data: data } }); },
		generateComponent: function (data) {
			if (data && data.file) {
				var form = new FormData();
				form.append('prompt', data.prompt || '');
				form.append('side', data.side || 'top');
				form.append('x', data.x || 0);
				form.append('y', data.y || 0);
				form.append('board', JSON.stringify(data.board || {}));
				form.append('datasheet', data.file);
				return request('/ai/component', { method: 'POST', body: form });
			}
			return request('/ai/component', { method: 'POST', body: data });
		},
		upload: function (file) {
			var form = new FormData();
			form.append('file', file);
			return request('/upload', { method: 'POST', body: form });
		}
	};
})(window);
