(function (global) {
	'use strict';

	function GerberWriter(options) {
		options = options || {};
		this.formatter = options.formatter || new global.DATPCBGerberCoordinateFormatter({ integerDigits: 4, decimalDigits: 6 });
	}

	GerberWriter.prototype.write = function (layer) {
		this.apertures = {};
		this.nextD = 10;
		var lines = [
			'G04 DAT PCB Image Tracer - ' + layer.title + '*',
			'%FSLAX46Y46*%',
			'%MOMM*%',
			'%LPD*%'
		];
		layer.operations.forEach(function (op) {
			this.collectAperture(op);
		}, this);
		Object.keys(this.apertures).forEach(function (key) {
			lines.push(this.apertures[key].definition);
		}, this);
		lines.push('G75*');
		lines.push('G01*');
		layer.operations.forEach(function (op) {
			this.writeOperation(lines, op);
		}, this);
		lines.push('M02*');
		return lines.join('\n') + '\n';
	};

	GerberWriter.prototype.collectAperture = function (op) {
		if (op.type === 'line') {
			this.aperture('circle', { diameter: Number(op.width || 0.15) });
		} else if (op.type === 'flash') {
			this.aperture(op.shape, op.params || {});
		}
	};

	GerberWriter.prototype.apertureKey = function (shape, params) {
		params = params || {};
		return [
			shape || 'circle',
			Number(params.diameter || 0).toFixed(6),
			Number(params.width || 0).toFixed(6),
			Number(params.height || 0).toFixed(6)
		].join(':');
	};

	GerberWriter.prototype.aperture = function (shape, params) {
		params = params || {};
		shape = shape || 'circle';
		var key = this.apertureKey(shape, params);
		if (this.apertures[key]) return this.apertures[key].code;
		var code = 'D' + this.nextD++;
		var definition;
		if (shape === 'rect' || shape === 'rectangle') {
			definition = '%' + 'ADD' + code.slice(1) + 'R,' + this.dec(Number(params.width || params.diameter || 1)) + 'X' + this.dec(Number(params.height || params.diameter || 1)) + '*%';
		} else if (shape === 'oval') {
			definition = '%' + 'ADD' + code.slice(1) + 'O,' + this.dec(Number(params.width || params.diameter || 1)) + 'X' + this.dec(Number(params.height || params.diameter || 1)) + '*%';
		} else {
			definition = '%' + 'ADD' + code.slice(1) + 'C,' + this.dec(Number(params.diameter || params.width || 1)) + '*%';
		}
		this.apertures[key] = { code: code, definition: definition };
		return code;
	};

	GerberWriter.prototype.dec = function (value) {
		return Number(value || 0).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
	};

	GerberWriter.prototype.writeOperation = function (lines, op) {
		if (op.type === 'comment') {
			lines.push('G04 ' + String(op.text || '').replace(/\*/g, '') + '*');
		} else if (op.type === 'line') {
			var d = this.aperture('circle', { diameter: Number(op.width || 0.15) });
			lines.push(d + '*');
			lines.push(this.formatter.xy(op.x1, op.y1) + 'D02*');
			lines.push(this.formatter.xy(op.x2, op.y2) + 'D01*');
		} else if (op.type === 'flash') {
			var params = op.params || {};
			var code = this.aperture(op.shape, params);
			lines.push(code + '*');
			lines.push(this.formatter.xy(op.x, op.y) + 'D03*');
		} else if (op.type === 'region') {
			this.writeRegion(lines, op.points || []);
		}
	};

	GerberWriter.prototype.writeRegion = function (lines, points) {
		if (!points.length) return;
		lines.push('G36*');
		lines.push(this.formatter.xy(points[0].x, points[0].y) + 'D02*');
		for (var i = 1; i < points.length; i++) {
			lines.push(this.formatter.xy(points[i].x, points[i].y) + 'D01*');
		}
		if (points.length > 2) {
			lines.push(this.formatter.xy(points[0].x, points[0].y) + 'D01*');
		}
		lines.push('G37*');
	};

	global.DATPCBGerberWriter = GerberWriter;
})(window);
