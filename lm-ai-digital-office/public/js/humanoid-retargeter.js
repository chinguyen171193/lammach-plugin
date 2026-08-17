(function (global) {
	'use strict';

	const BONE_PLAN = Object.freeze([
		[ 'hips', 'Hips', 'hip', '' ],
		[ 'spine', 'Spine', 'spine_01', 'hips' ],
		[ 'spine1', 'Chest', 'spine_02', 'spine' ],
		[ 'spine2', 'UpperChest', 'spine_03', 'spine1' ],
		[ 'neck', 'Neck', 'neck', 'spine2' ],
		[ 'head', 'Head', 'head', 'neck' ],
		[ 'leftShoulder', 'LeftShoulder', 'shoulder_l', 'spine2' ],
		[ 'leftUpperArm', 'LeftArm', 'upperarm_l', 'leftShoulder' ],
		[ 'leftForeArm', 'LeftForeArm', 'lowerarm_l', 'leftUpperArm' ],
		[ 'leftHand', 'LeftHand', 'hand_l', 'leftForeArm' ],
		[ 'rightShoulder', 'RightShoulder', 'shoulder_r', 'spine2' ],
		[ 'rightUpperArm', 'RightArm', 'upperarm_r', 'rightShoulder' ],
		[ 'rightForeArm', 'RightForeArm', 'lowerarm_r', 'rightUpperArm' ],
		[ 'rightHand', 'RightHand', 'hand_r', 'rightForeArm' ],
		[ 'leftUpperLeg', 'LeftUpLeg', 'upperleg_l', 'hips' ],
		[ 'leftLowerLeg', 'LeftLeg', 'lowerleg_l', 'leftUpperLeg' ],
		[ 'leftFoot', 'LeftFoot', 'foot_l', 'leftLowerLeg' ],
		[ 'leftToe', 'LeftToes', 'ball_l', 'leftFoot' ],
		[ 'rightUpperLeg', 'RightUpLeg', 'upperleg_r', 'hips' ],
		[ 'rightLowerLeg', 'RightLeg', 'lowerleg_r', 'rightUpperLeg' ],
		[ 'rightFoot', 'RightFoot', 'foot_r', 'rightLowerLeg' ],
		[ 'rightToe', 'RightToes', 'ball_r', 'rightFoot' ],
		[ 'leftThumb1', 'LeftHandThumb1', 'thumb_01_l', 'leftHand' ],
		[ 'leftThumb2', 'LeftHandThumb2', 'thumb_02_l', 'leftThumb1' ],
		[ 'leftIndex1', 'LeftHandIndex1', 'index_01_l', 'leftHand' ],
		[ 'leftIndex2', 'LeftHandIndex2', 'index_02_l', 'leftIndex1' ],
		[ 'leftIndex3', 'LeftHandIndex3', 'index_03_l', 'leftIndex2' ],
		[ 'rightThumb1', 'RightHandThumb1', 'thumb_01_r', 'rightHand' ],
		[ 'rightThumb2', 'RightHandThumb2', 'thumb_02_r', 'rightThumb1' ],
		[ 'rightIndex1', 'RightHandIndex1', 'index_01_r', 'rightHand' ],
		[ 'rightIndex2', 'RightHandIndex2', 'index_02_r', 'rightIndex1' ],
		[ 'rightIndex3', 'RightHandIndex3', 'index_03_r', 'rightIndex2' ]
	]);

	function collectBones(root) {
		const bones = []; root.traverse(object => { if (object.isBone) bones.push(object); }); return bones;
	}

	function indexByName(bones) { return new Map(bones.map(bone => [ bone.name, bone ])); }
	function depth(bone) { let value = 0; while (bone && bone.parent && bone.parent.isBone) { value += 1; bone = bone.parent; } return value; }

	function quaternionTrackMap(clip) {
		const tracks = new Map();
		clip.tracks.forEach(track => { const match = track.name.match(/^(.+)\.quaternion$/); if (match) tracks.set(match[1], track); });
		return tracks;
	}

	function sampleQuaternion(track, time, fallback) {
		if (!track) return fallback.clone();
		const times = track.times; const values = track.values;
		if (time <= times[0]) return new global.THREE.Quaternion(values[0], values[1], values[2], values[3]);
		const last = times.length - 1;
		if (time >= times[last]) { const offset = last * 4; return new global.THREE.Quaternion(values[offset], values[offset + 1], values[offset + 2], values[offset + 3]); }
		let lower = 0; let upper = last;
		while (upper - lower > 1) { const middle = (lower + upper) >> 1; if (times[middle] <= time) lower = middle; else upper = middle; }
		const a = lower * 4; const b = upper * 4; const alpha = (time - times[lower]) / (times[upper] - times[lower]);
		return new global.THREE.Quaternion(values[a], values[a + 1], values[a + 2], values[a + 3]).slerp(new global.THREE.Quaternion(values[b], values[b + 1], values[b + 2], values[b + 3]), alpha);
	}

	class HumanoidRetargeter {
		buildMapping(sourceRoot, targetSkeleton) {
			const sourceByName = indexByName(collectBones(sourceRoot)); const targetByName = indexByName(targetSkeleton.bones);
			const bySemantic = new Map(); const report = [];
			BONE_PLAN.forEach(([ semantic, sourceName, targetName, parentSemantic ]) => {
				const source = sourceByName.get(sourceName); const target = targetByName.get(targetName); const expectedParent = parentSemantic ? bySemantic.get(parentSemantic) : null;
				const sourceHierarchy = Boolean(source) && (!expectedParent || source.parent === expectedParent.source);
				const targetHierarchy = Boolean(target) && (!expectedParent || target.parent === expectedParent.target);
				const valid = Boolean(source && target && sourceHierarchy && targetHierarchy);
				const entry = { semantic, source, target, parentSemantic, valid };
				bySemantic.set(semantic, entry);
				report.push({ semantic, source: sourceName, target: targetName, sourceParent: source && source.parent && source.parent.isBone ? source.parent.name : '(root)', targetParent: target && target.parent && target.parent.isBone ? target.parent.name : '(root)', status: valid ? 'PASS' : 'FAIL' });
			});
			const failures = report.filter(item => item.status === 'FAIL');
			if (failures.length) throw new Error('Humanoid bone mapping không hợp lệ: ' + failures.map(item => item.semantic).join(', '));
			global.console.table(report);
			return { entries: Array.from(bySemantic.values()).sort((a, b) => depth(a.target) - depth(b.target)), report, sourceBoneCount: sourceByName.size, targetBoneCount: targetSkeleton.bones.length };
		}

		retarget(sourceRoot, sourceClip, targetSkeleton) {
			if (!sourceClip || !sourceClip.tracks.length) throw new Error('Idle source không có animation clip.');
			sourceRoot.updateMatrixWorld(true); targetSkeleton.bones[0].parent.updateMatrixWorld(true);
			const mapping = this.buildMapping(sourceRoot, targetSkeleton); const sourceBones = collectBones(sourceRoot); const sourceTrackByName = quaternionTrackMap(sourceClip);
			const times = Array.from(new Set(mapping.entries.flatMap(entry => Array.from((sourceTrackByName.get(entry.source.name) || { times: [] }).times)))).sort((a, b) => a - b);
			if (!times.length) throw new Error('Idle source không có quaternion tracks cho humanoid mapping.');
			const sourceRestWorld = new Map(sourceBones.map(bone => [ bone, bone.getWorldQuaternion(new global.THREE.Quaternion()) ]));
			const targetRestWorld = new Map(mapping.entries.map(entry => [ entry.target, entry.target.getWorldQuaternion(new global.THREE.Quaternion()) ]));
			const output = new Map(mapping.entries.map(entry => [ entry.target, [] ]));

			times.forEach(time => {
				const localCurrent = new Map(sourceBones.map(bone => [ bone, sampleQuaternion(sourceTrackByName.get(bone.name), time, bone.quaternion) ]));
				const worldCurrent = new Map();
				const sourceWorld = bone => {
					if (worldCurrent.has(bone)) return worldCurrent.get(bone);
					const parent = bone.parent; const parentWorld = parent && parent.isBone ? sourceWorld(parent) : parent ? parent.getWorldQuaternion(new global.THREE.Quaternion()) : new global.THREE.Quaternion();
					const value = parentWorld.clone().multiply(localCurrent.get(bone)); worldCurrent.set(bone, value); return value;
				};
				const targetCurrentWorld = new Map();
				mapping.entries.forEach(entry => {
					const sourceDelta = sourceRestWorld.get(entry.source).clone().invert().multiply(sourceWorld(entry.source));
					const targetWorld = targetRestWorld.get(entry.target).clone().multiply(sourceDelta);
					const parent = entry.target.parent; const parentWorld = parent && targetCurrentWorld.has(parent) ? targetCurrentWorld.get(parent) : parent ? parent.getWorldQuaternion(new global.THREE.Quaternion()) : new global.THREE.Quaternion();
					const local = parentWorld.clone().invert().multiply(targetWorld).normalize(); targetCurrentWorld.set(entry.target, targetWorld); output.get(entry.target).push(local.x, local.y, local.z, local.w);
				});
			});

			const tracks = mapping.entries.map(entry => new global.THREE.QuaternionKeyframeTrack(entry.target.uuid + '.quaternion', times, output.get(entry.target)));
			const clip = new global.THREE.AnimationClip('Idle', sourceClip.duration, tracks);
			return { clip, mapping: mapping.report, sourceBoneCount: mapping.sourceBoneCount, targetBoneCount: mapping.targetBoneCount, rootMotion: 'X/Z removed: output contains rotation tracks only.' };
		}
	}

	global.LM_HumanoidRetargeter = HumanoidRetargeter;
})(window);
