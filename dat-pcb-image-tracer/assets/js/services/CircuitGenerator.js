(function (global) {
	'use strict';

	// Produces editor-neutral JSON commands. It does not know about Canvas APIs.
	function CircuitGenerator() {}

	CircuitGenerator.prototype.generate = function (intent) {
		var ref = intent.component + '1';
		return {
			version: 'mock-1',
			prompt: intent.raw,
			commands: [
				{ type: 'ADD_COMPONENT', ref: ref, component: intent.component, value: intent.value, x: 20, y: 18 },
				{ type: 'ADD_COMPONENT', ref: 'J1', component: 'J', value: 'Input', x: 8, y: 18 },
				{ type: 'CONNECT', from: 'J1.1', to: ref + '.1' }
			]
		};
	};

	global.DATPCBCircuitGenerator = CircuitGenerator;
})(window);
