(function (global) {
	'use strict';

	// Public AI facade. Future OpenAI calls should be added here, not in the editor.
	function AIService(parser, generator) {
		this.parser = parser || new global.DATPCBPromptParser();
		this.generator = generator || new global.DATPCBCircuitGenerator();
	}

	AIService.prototype.generateCircuit = function (prompt, context) {
		if (global.DATPCBTracerStorage && global.DATPCBTracerStorage.generateComponent) {
			return global.DATPCBTracerStorage.generateComponent({
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

	global.DATPCBAIService = AIService;
	global.generateCircuit = function (prompt, context) {
		if (!global.DATPCBAIServiceInstance) {
			global.DATPCBAIServiceInstance = new AIService();
		}
		return global.DATPCBAIServiceInstance.generateCircuit(prompt, context);
	};
})(window);
