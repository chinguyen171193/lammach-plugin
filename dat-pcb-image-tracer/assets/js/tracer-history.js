(function (global) {
	'use strict';

	function clone(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function TracerHistory(limit) {
		this.limit = limit || 100;
		this.undoStack = [];
		this.redoStack = [];
	}

	TracerHistory.prototype.push = function (state) {
		this.undoStack.push(clone(state));
		if (this.undoStack.length > this.limit) {
			this.undoStack.shift();
		}
		this.redoStack = [];
	};

	TracerHistory.prototype.undo = function (current) {
		if (!this.undoStack.length) {
			return null;
		}
		this.redoStack.push(clone(current));
		return this.undoStack.pop();
	};

	TracerHistory.prototype.redo = function (current) {
		if (!this.redoStack.length) {
			return null;
		}
		this.undoStack.push(clone(current));
		return this.redoStack.pop();
	};

	global.DATPCBTracerHistory = TracerHistory;
	global.DATPCBTracerClone = clone;
})(window);
