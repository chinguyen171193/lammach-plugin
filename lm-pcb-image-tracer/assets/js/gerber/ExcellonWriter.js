(function (global) {
	'use strict';

	function ExcellonWriter(options) {
		options = options || {};
		this.formatter = options.formatter || new global.LMPCBGerberCoordinateFormatter({ integerDigits: 4, decimalDigits: 6 });
	}

	ExcellonWriter.prototype.write = function (holes) {
		holes = holes || [];
		var tools = this.buildTools(holes);
		var lines = [
			'M48',
			'; LM PCB Image Tracer Excellon drill',
			'METRIC,TZ'
		];
		tools.forEach(function (tool, index) {
			lines.push('T' + (index + 1) + 'C' + Number(tool.diameter).toFixed(3));
		});
		lines.push('%');
		tools.forEach(function (tool, index) {
			lines.push('T' + (index + 1));
			tool.holes.forEach(function (hole) {
				lines.push(this.formatter.xy(hole.x, hole.y));
			}, this);
		}, this);
		lines.push('M30');
		return lines.join('\n') + '\n';
	};

	ExcellonWriter.prototype.buildTools = function (holes) {
		var map = {};
		holes.forEach(function (hole) {
			var diameter = Number(hole.diameter || 0);
			if (diameter <= 0) return;
			var key = diameter.toFixed(3);
			if (!map[key]) map[key] = { diameter: diameter, holes: [] };
			map[key].holes.push(hole);
		});
		return Object.keys(map).sort(function (a, b) { return Number(a) - Number(b); }).map(function (key) {
			return map[key];
		});
	};

	global.LMPCBExcellonWriter = ExcellonWriter;
})(window);
