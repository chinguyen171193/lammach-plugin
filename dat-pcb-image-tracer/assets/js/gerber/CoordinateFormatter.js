(function (global) {
	'use strict';

	function CoordinateFormatter(options) {
		options = options || {};
		this.integerDigits = options.integerDigits || 4;
		this.decimalDigits = options.decimalDigits || 6;
		this.scale = Math.pow(10, this.decimalDigits);
	}

	CoordinateFormatter.prototype.formatNumber = function (value) {
		var scaled = Math.round(Number(value || 0) * this.scale);
		var sign = scaled < 0 ? '-' : '';
		var digits = String(Math.abs(scaled));
		var min = this.integerDigits + this.decimalDigits;
		while (digits.length < min) digits = '0' + digits;
		return sign + digits;
	};

	CoordinateFormatter.prototype.xy = function (x, y) {
		return 'X' + this.formatNumber(x) + 'Y' + this.formatNumber(y);
	};

	CoordinateFormatter.prototype.x = function (value) {
		return 'X' + this.formatNumber(value);
	};

	CoordinateFormatter.prototype.y = function (value) {
		return 'Y' + this.formatNumber(value);
	};

	global.DATPCBGerberCoordinateFormatter = CoordinateFormatter;
})(window);
