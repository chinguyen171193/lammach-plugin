(function (global) {
	'use strict';

	// Converts free text into a small intent object for the mock generator.
	function PromptParser() {}

	PromptParser.prototype.parse = function (prompt) {
		var text = String(prompt || '').trim();
		var lower = text.toLowerCase();
		return {
			raw: text,
			component: lower.indexOf('capacitor') !== -1 || lower.indexOf(' tụ') !== -1 ? 'C' : 'R',
			value: lower.indexOf('10k') !== -1 ? '10k' : (lower.indexOf('100n') !== -1 ? '100nF' : '1k')
		};
	};

	global.DATPCBPromptParser = PromptParser;
})(window);
