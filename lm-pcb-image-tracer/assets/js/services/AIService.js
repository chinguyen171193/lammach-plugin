(function (global) {
	'use strict';

	// Public AI facade. Future OpenAI calls should be added here, not in the editor.
	function AIService(parser, generator) {
		this.parser = parser || new global.LMPCBPromptParser();
		this.generator = generator || new global.LMPCBCircuitGenerator();
	}

	AIService.prototype.generateCircuit = function (prompt, context) {
		if (global.LMPCBTracerStorage && global.LMPCBTracerStorage.generateComponent) {
			return global.LMPCBTracerStorage.generateComponent({
				prompt: prompt,
				side: context && context.side,
				x: context && context.x,
				y: context && context.y,
				board: context && context.board,
				file: context && context.file
			});
		}
		var intent = this.parser.parse(prompt);
		return Promise.resolve(this.generator.generate(intent));
	};

	global.LMPCBAIService = AIService;
	global.generateCircuit = function (prompt, context) {
		if (!global.LMPCBAIServiceInstance) {
			global.LMPCBAIServiceInstance = new AIService();
		}
		return global.LMPCBAIServiceInstance.generateCircuit(prompt, context);
	};
})(window);
