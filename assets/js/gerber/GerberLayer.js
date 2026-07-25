(function (global) {
	'use strict';

	function GerberLayer(id, filename, options) {
		options = options || {};
		this.id = id;
		this.filename = filename;
		this.title = options.title || id;
		this.polarity = options.polarity || 'dark';
		this.operations = [];
		this.warnings = [];
	}

	GerberLayer.prototype.comment = function (text) {
		this.operations.push({ type: 'comment', text: String(text || '') });
	};

	GerberLayer.prototype.line = function (x1, y1, x2, y2, width) {
		this.operations.push({ type: 'line', x1: x1, y1: y1, x2: x2, y2: y2, width: width });
	};

	GerberLayer.prototype.flash = function (shape, x, y, params) {
		this.operations.push({ type: 'flash', shape: shape || 'circle', x: x, y: y, params: params || {} });
	};

	GerberLayer.prototype.region = function (points) {
		this.operations.push({ type: 'region', points: points || [] });
	};

	GerberLayer.prototype.isEmpty = function () {
		return !this.operations.some(function (op) {
			return op.type !== 'comment';
		});
	};

	global.DATPCBGerberLayer = GerberLayer;
})(window);
