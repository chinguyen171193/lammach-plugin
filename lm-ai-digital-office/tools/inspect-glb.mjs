#!/usr/bin/env node

/**
 * Inspect a binary glTF model without loading it in a renderer.
 *
 * Usage: node tools/inspect-glb.mjs path/to/model.glb
 */

import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2];

if (!input) {
	console.error('Usage: node tools/inspect-glb.mjs path/to/model.glb');
	process.exit(1);
}

const file = fs.readFileSync(input);

if (file.toString('ascii', 0, 4) !== 'glTF' || file.readUInt32LE(4) !== 2) {
	throw new Error('Only binary glTF 2.0 (.glb) files are supported.');
}

let offset = 12;
let document;
let binaryChunk = Buffer.alloc(0);

while (offset < file.length) {
	const length = file.readUInt32LE(offset);
	const type = file.readUInt32LE(offset + 4);
	const data = file.subarray(offset + 8, offset + 8 + length);
	offset += 8 + length;

	if (type === 0x4e4f534a) {
		document = JSON.parse(data.toString('utf8').replace(/\u0000+$/u, '').trim());
	} else if (type === 0x004e4942) {
		binaryChunk = data;
	}
}

if (!document) {
	throw new Error('The GLB has no JSON chunk.');
}

const accessors = document.accessors || [];
const nodes = document.nodes || [];
const meshes = document.meshes || [];
const skins = document.skins || [];
const morphTargets = new Set();
let triangles = 0;

meshes.forEach((mesh) => {
	const meshTargetNames = mesh.extras?.targetNames || [];
	meshTargetNames.forEach((name) => morphTargets.add(name));

	(mesh.primitives || []).forEach((primitive) => {
		const primitiveTargetNames = primitive.extras?.targetNames || [];
		primitiveTargetNames.forEach((name) => morphTargets.add(name));

		const targetCount = (primitive.targets || []).length;
		for (let index = 0; index < targetCount; index += 1) {
			morphTargets.add(meshTargetNames[index] || primitiveTargetNames[index] || `target_${index}`);
		}

		const count = primitive.indices !== undefined
			? accessors[primitive.indices]?.count || 0
			: accessors[primitive.attributes?.POSITION]?.count || 0;
		const mode = primitive.mode === undefined ? 4 : primitive.mode;

		if (mode === 4) {
			triangles += Math.floor(count / 3);
		} else if (mode === 5 || mode === 6) {
			triangles += Math.max(0, count - 2);
		}
	});
});

const jointIndexes = new Set(skins.flatMap((skin) => skin.joints || []));
const boneNames = [...jointIndexes].map((index) => nodes[index]?.name || `node_${index}`);
const facialBones = boneNames.filter((name) => /head|eye|jaw|mouth|lip|face|tongue|neck/i.test(name));

function imageDimensions(buffer) {
	if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
		return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), format: 'png' };
	}

	if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
		const type = buffer.toString('ascii', 12, 16);
		if (type === 'VP8X' && buffer.length >= 30) {
			return {
				width: 1 + buffer.readUIntLE(24, 3),
				height: 1 + buffer.readUIntLE(27, 3),
				format: 'webp',
			};
		}
	}

	if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
		let cursor = 2;
		while (cursor + 8 < buffer.length) {
			if (buffer[cursor] !== 0xff) {
				cursor += 1;
				continue;
			}
			const marker = buffer[cursor + 1];
			const length = buffer.readUInt16BE(cursor + 2);
			if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
				return { width: buffer.readUInt16BE(cursor + 7), height: buffer.readUInt16BE(cursor + 5), format: 'jpeg' };
			}
			cursor += 2 + Math.max(2, length);
		}
	}

	return { width: null, height: null, format: 'unknown' };
}

const images = (document.images || []).map((image, index) => {
	if (image.bufferView === undefined) {
		return { index, name: image.name || `image_${index}`, uri: image.uri || null };
	}

	const view = document.bufferViews?.[image.bufferView];
	const start = view?.byteOffset || 0;
	const end = start + (view?.byteLength || 0);
	return {
		index,
		name: image.name || `image_${index}`,
		bytes: Math.max(0, end - start),
		...imageDimensions(binaryChunk.subarray(start, end)),
	};
});

const report = {
	file: path.resolve(input),
	bytes: file.length,
	asset: document.asset || {},
	triangles,
	meshCount: meshes.length,
	primitiveCount: meshes.reduce((total, mesh) => total + (mesh.primitives || []).length, 0),
	nodeCount: nodes.length,
	skins: skins.map((skin, index) => ({
		index,
		name: skin.name || `skin_${index}`,
		jointCount: (skin.joints || []).length,
		skeleton: skin.skeleton === undefined ? null : nodes[skin.skeleton]?.name || `node_${skin.skeleton}`,
	})),
	boneNames,
	facialBones,
	meshNames: meshes.map((mesh, index) => mesh.name || `mesh_${index}`),
	morphTargets: [...morphTargets],
	animations: (document.animations || []).map((animation, index) => animation.name || `animation_${index}`),
	images,
};

console.log(JSON.stringify(report, null, 2));
