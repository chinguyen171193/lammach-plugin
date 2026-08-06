(function (global) {
	'use strict';

	function GerberExporter(options) {
		this.options = options || {};
		this.formatter = new global.DATPCBGerberCoordinateFormatter({ integerDigits: 4, decimalDigits: 6 });
		this.gerberWriter = new global.DATPCBGerberWriter({ formatter: this.formatter });
		this.excellonWriter = new global.DATPCBExcellonWriter({ formatter: this.formatter });
		this.zip = new global.DATPCBGerberZip();
	}

	GerberExporter.prototype.exportProject = function (project) {
		var clean = this.clone(project);
		var geometry = new global.DATPCBGeometryExporter(clean).export();
		var files = [];
		Object.keys(geometry.layers).forEach(function (key) {
			var layer = geometry.layers[key];
			files.push({ name: layer.filename, content: this.gerberWriter.write(layer) });
		}, this);
		files.push({ name: 'drill.TXT', content: this.excellonWriter.write(geometry.drillHoles) });
		files.push({ name: 'export_report.txt', content: this.report(clean, geometry.warnings, files) });
		return {
			fileName: this.zipName(clean),
			files: files,
			warnings: geometry.warnings,
			blob: this.zip.create(files)
		};
	};

	GerberExporter.prototype.clone = function (project) {
		return JSON.parse(JSON.stringify(project || {}));
	};

	GerberExporter.prototype.zipName = function (project) {
		var name = (project.project && project.project.name) || (project.project && project.project.code) || 'PCB_Project';
		name = String(name).trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_');
		return (name || 'PCB_Project') + '_Gerber.zip';
	};

	GerberExporter.prototype.report = function (project, warnings, files) {
		var lines = [
			'DAT PCB Image Tracer Gerber Export',
			'Project: ' + (((project.project || {}).name) || ''),
			'Format: RS-274X, metric, FSLAX46Y46',
			'Files:',
		];
		files.forEach(function (file) {
			lines.push('- ' + file.name);
		});
		lines.push('');
		lines.push('Warnings:');
		if (warnings.length) {
			warnings.forEach(function (warning) { lines.push('- ' + warning); });
		} else {
			lines.push('- None');
		}
		lines.push('');
		lines.push('Notes:');
		lines.push('- Text is exported as simple stroke outlines.');
		lines.push('- Solder mask files contain pad/via openings generated from copper features.');
		lines.push('- Unsupported future geometry is skipped with warnings where possible.');
		return lines.join('\n') + '\n';
	};

	global.DATPCBGerberExporter = GerberExporter;
})(window);
