(function (global) {
	'use strict';
	class OfficePathfinding {
		constructor(width, height, cell) { this.width = width; this.height = height; this.cell = cell || 40; this.cols = Math.ceil(width / this.cell); this.rows = Math.ceil(height / this.cell); this.blocked = new Set(); }
		key(x, y) { return x + ':' + y; }
		blockRect(x, y, w, h) { const startX = Math.floor(x / this.cell), endX = Math.floor((x + w) / this.cell), startY = Math.floor(y / this.cell), endY = Math.floor((y + h) / this.cell); for (let iy = startY; iy <= endY; iy++) for (let ix = startX; ix <= endX; ix++) this.blocked.add(this.key(ix, iy)); }
		point(pos) { return { x: Math.max(0, Math.min(this.cols - 1, Math.floor(pos.x / this.cell))), y: Math.max(0, Math.min(this.rows - 1, Math.floor(pos.y / this.cell))) }; }
		world(node) { return { x: node.x * this.cell + this.cell / 2, y: node.y * this.cell + this.cell / 2 }; }
		find(from, to) {
			const start = this.point(from), goal = this.point(to), open = [start], came = new Map(), costs = new Map([[this.key(start.x, start.y), 0]]), score = new Map([[this.key(start.x, start.y), this.distance(start, goal)]]), closed = new Set();
			while (open.length) {
				open.sort((a, b) => (score.get(this.key(a.x, a.y)) || Infinity) - (score.get(this.key(b.x, b.y)) || Infinity)); const current = open.shift(), currentKey = this.key(current.x, current.y);
				if (current.x === goal.x && current.y === goal.y) { const path = []; let step = current; while (step) { path.unshift(this.world(step)); step = came.get(this.key(step.x, step.y)); } return path; }
				closed.add(currentKey);
				[[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => { const next = { x: current.x + dx, y: current.y + dy }, key = this.key(next.x, next.y); if (next.x < 0 || next.y < 0 || next.x >= this.cols || next.y >= this.rows || this.blocked.has(key) || closed.has(key)) return; const tentative = (costs.get(currentKey) || 0) + 1; if (tentative < (costs.get(key) || Infinity)) { came.set(key, current); costs.set(key, tentative); score.set(key, tentative + this.distance(next, goal)); if (!open.some(n => n.x === next.x && n.y === next.y)) open.push(next); } });
			}
			return [from, to];
		}
		distance(a,b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
	}
	global.LMAIOfficePathfinding = OfficePathfinding;
})(window);
