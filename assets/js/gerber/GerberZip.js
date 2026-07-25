(function (global) {
	'use strict';

	function GerberZip() {}

	GerberZip.prototype.create = function (files) {
		var encoder = new TextEncoder();
		var entries = [];
		var offset = 0;
		var chunks = [];
		files.forEach(function (file) {
			var nameBytes = encoder.encode(file.name);
			var data = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
			var crc = this.crc32(data);
			var local = this.localHeader(nameBytes, data.length, crc);
			chunks.push(local, data);
			entries.push({ nameBytes: nameBytes, size: data.length, crc: crc, offset: offset });
			offset += local.length + data.length;
		}, this);
		var centralStart = offset;
		entries.forEach(function (entry) {
			var central = this.centralHeader(entry);
			chunks.push(central);
			offset += central.length;
		}, this);
		var end = this.endRecord(entries.length, offset - centralStart, centralStart);
		chunks.push(end);
		return new Blob(chunks, { type: 'application/zip' });
	};

	GerberZip.prototype.localHeader = function (nameBytes, size, crc) {
		var out = new Uint8Array(30 + nameBytes.length);
		var view = new DataView(out.buffer);
		view.setUint32(0, 0x04034b50, true);
		view.setUint16(4, 20, true);
		view.setUint16(6, 0, true);
		view.setUint16(8, 0, true);
		this.setDosTime(view, 10);
		view.setUint32(14, crc, true);
		view.setUint32(18, size, true);
		view.setUint32(22, size, true);
		view.setUint16(26, nameBytes.length, true);
		view.setUint16(28, 0, true);
		out.set(nameBytes, 30);
		return out;
	};

	GerberZip.prototype.centralHeader = function (entry) {
		var out = new Uint8Array(46 + entry.nameBytes.length);
		var view = new DataView(out.buffer);
		view.setUint32(0, 0x02014b50, true);
		view.setUint16(4, 20, true);
		view.setUint16(6, 20, true);
		view.setUint16(8, 0, true);
		view.setUint16(10, 0, true);
		this.setDosTime(view, 12);
		view.setUint32(16, entry.crc, true);
		view.setUint32(20, entry.size, true);
		view.setUint32(24, entry.size, true);
		view.setUint16(28, entry.nameBytes.length, true);
		view.setUint16(30, 0, true);
		view.setUint16(32, 0, true);
		view.setUint16(34, 0, true);
		view.setUint16(36, 0, true);
		view.setUint32(38, 0, true);
		view.setUint32(42, entry.offset, true);
		out.set(entry.nameBytes, 46);
		return out;
	};

	GerberZip.prototype.endRecord = function (count, centralSize, centralOffset) {
		var out = new Uint8Array(22);
		var view = new DataView(out.buffer);
		view.setUint32(0, 0x06054b50, true);
		view.setUint16(8, count, true);
		view.setUint16(10, count, true);
		view.setUint32(12, centralSize, true);
		view.setUint32(16, centralOffset, true);
		view.setUint16(20, 0, true);
		return out;
	};

	GerberZip.prototype.setDosTime = function (view, offset) {
		var now = new Date();
		var time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
		var date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
		view.setUint16(offset, time, true);
		view.setUint16(offset + 2, date, true);
	};

	GerberZip.prototype.crc32 = function (data) {
		if (!GerberZip.table) GerberZip.table = this.makeCrcTable();
		var crc = 0 ^ -1;
		for (var i = 0; i < data.length; i++) {
			crc = (crc >>> 8) ^ GerberZip.table[(crc ^ data[i]) & 0xff];
		}
		return (crc ^ -1) >>> 0;
	};

	GerberZip.prototype.makeCrcTable = function () {
		var table = [];
		for (var n = 0; n < 256; n++) {
			var c = n;
			for (var k = 0; k < 8; k++) {
				c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
			}
			table[n] = c >>> 0;
		}
		return table;
	};

	global.DATPCBGerberZip = GerberZip;
})(window);
