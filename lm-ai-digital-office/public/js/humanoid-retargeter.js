(function (global) {
	'use strict';

	/* Explicit parents validate each source rig without assuming it has the same
	 * spine, neck, or shoulder count as Claudia. Unmapped target bones stay at rest. */
	const SOURCE_PROFILES = Object.freeze([
		{
			id: 'kenney-animated-characters-2',
			entries: [
				[ 'hips', 'Hips', 'hip', '', '' ], [ 'spine', 'Spine', 'spine_01', 'Hips', 'hip' ], [ 'spine1', 'Chest', 'spine_02', 'Spine', 'spine_01' ], [ 'spine2', 'UpperChest', 'spine_03', 'Chest', 'spine_02' ], [ 'neck', 'Neck', 'neck', 'UpperChest', 'spine_03' ], [ 'head', 'Head', 'head', 'Neck', 'neck' ],
				[ 'leftShoulder', 'LeftShoulder', 'shoulder_l', 'UpperChest', 'spine_03' ], [ 'leftUpperArm', 'LeftArm', 'upperarm_l', 'LeftShoulder', 'shoulder_l' ], [ 'leftForeArm', 'LeftForeArm', 'lowerarm_l', 'LeftArm', 'upperarm_l' ], [ 'leftHand', 'LeftHand', 'hand_l', 'LeftForeArm', 'lowerarm_l' ],
				[ 'rightShoulder', 'RightShoulder', 'shoulder_r', 'UpperChest', 'spine_03' ], [ 'rightUpperArm', 'RightArm', 'upperarm_r', 'RightShoulder', 'shoulder_r' ], [ 'rightForeArm', 'RightForeArm', 'lowerarm_r', 'RightArm', 'upperarm_r' ], [ 'rightHand', 'RightHand', 'hand_r', 'RightForeArm', 'lowerarm_r' ],
				[ 'leftUpperLeg', 'LeftUpLeg', 'upperleg_l', 'Hips', 'hip' ], [ 'leftLowerLeg', 'LeftLeg', 'lowerleg_l', 'LeftUpLeg', 'upperleg_l' ], [ 'leftFoot', 'LeftFoot', 'foot_l', 'LeftLeg', 'lowerleg_l' ], [ 'leftToe', 'LeftToes', 'ball_l', 'LeftFoot', 'foot_l' ],
				[ 'rightUpperLeg', 'RightUpLeg', 'upperleg_r', 'Hips', 'hip' ], [ 'rightLowerLeg', 'RightLeg', 'lowerleg_r', 'RightUpLeg', 'upperleg_r' ], [ 'rightFoot', 'RightFoot', 'foot_r', 'RightLeg', 'lowerleg_r' ], [ 'rightToe', 'RightToes', 'ball_r', 'RightFoot', 'foot_r' ],
				[ 'leftThumb1', 'LeftHandThumb1', 'thumb_01_l', 'LeftHand', 'hand_l' ], [ 'leftThumb2', 'LeftHandThumb2', 'thumb_02_l', 'LeftHandThumb1', 'thumb_01_l' ], [ 'leftIndex1', 'LeftHandIndex1', 'index_01_l', 'LeftHand', 'hand_l' ], [ 'leftIndex2', 'LeftHandIndex2', 'index_02_l', 'LeftHandIndex1', 'index_01_l' ], [ 'leftIndex3', 'LeftHandIndex3', 'index_03_l', 'LeftHandIndex2', 'index_02_l' ],
				[ 'rightThumb1', 'RightHandThumb1', 'thumb_01_r', 'RightHand', 'hand_r' ], [ 'rightThumb2', 'RightHandThumb2', 'thumb_02_r', 'RightHandThumb1', 'thumb_01_r' ], [ 'rightIndex1', 'RightHandIndex1', 'index_01_r', 'RightHand', 'hand_r' ], [ 'rightIndex2', 'RightHandIndex2', 'index_02_r', 'RightHandIndex1', 'index_01_r' ], [ 'rightIndex3', 'RightHandIndex3', 'index_03_r', 'RightHandIndex2', 'index_02_r' ]
			]
		},
		{
			id: 'kaykit-rig-medium',
			entries: [
				[ 'hips', 'hips', 'hip', 'root', '' ], [ 'spine', 'spine', 'spine_01', 'hips', 'hip' ], [ 'spine2', 'chest', 'spine_03', 'spine', 'spine_02' ], [ 'head', 'head', 'head', 'chest', 'neck' ],
				[ 'leftUpperArm', 'upperarml', 'upperarm_l', 'chest', 'shoulder_l' ], [ 'leftForeArm', 'lowerarml', 'lowerarm_l', 'upperarml', 'upperarm_l' ], [ 'leftHand', 'handl', 'hand_l', 'wristl', 'lowerarm_l' ],
				[ 'rightUpperArm', 'upperarmr', 'upperarm_r', 'chest', 'shoulder_r' ], [ 'rightForeArm', 'lowerarmr', 'lowerarm_r', 'upperarmr', 'upperarm_r' ], [ 'rightHand', 'handr', 'hand_r', 'wristr', 'lowerarm_r' ],
				[ 'leftUpperLeg', 'upperlegl', 'upperleg_l', 'hips', 'hip' ], [ 'leftLowerLeg', 'lowerlegl', 'lowerleg_l', 'upperlegl', 'upperleg_l' ], [ 'leftFoot', 'footl', 'foot_l', 'lowerlegl', 'lowerleg_l' ], [ 'leftToe', 'toesl', 'ball_l', 'footl', 'foot_l' ],
				[ 'rightUpperLeg', 'upperlegr', 'upperleg_r', 'hips', 'hip' ], [ 'rightLowerLeg', 'lowerlegr', 'lowerleg_r', 'upperlegr', 'upperleg_r' ], [ 'rightFoot', 'footr', 'foot_r', 'lowerlegr', 'lowerleg_r' ], [ 'rightToe', 'toesr', 'ball_r', 'footr', 'foot_r' ]
			]
		}
	]);

	function collectBones(root) { const bones = []; root.traverse(object => { if (object.isBone) bones.push(object); }); return bones; }
	function collectSourceBones(root) { let skeleton = null; root.traverse(object => { if (!skeleton && object.isSkinnedMesh && object.skeleton) skeleton = object.skeleton; }); return skeleton ? skeleton.bones : collectBones(root); }
	function indexByName(bones) { return new Map(bones.map(bone => [ bone.name, bone ])); }
	function parentBoneName(bone) { return bone && bone.parent && bone.parent.isBone ? bone.parent.name : '(root)'; }
	function depth(bone) { let value = 0; while (bone && bone.parent && bone.parent.isBone) { value += 1; bone = bone.parent; } return value; }
	function quaternionTrackMap(clip) { const tracks = new Map(); clip.tracks.forEach(track => { const match = track.name.match(/^(.+)\.quaternion$/); if (match) tracks.set(match[1], track); }); return tracks; }

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
			const sourceBones = collectSourceBones(sourceRoot); const sourceByName = indexByName(sourceBones); const targetByName = indexByName(targetSkeleton.bones);
			const profile = SOURCE_PROFILES.find(candidate => candidate.entries.every(entry => sourceByName.has(entry[1])));
			if (!profile) throw new Error('Không tìm thấy source skeleton profile đã được xác thực cho animation này.');
			const report = []; const entries = profile.entries.map(([ semantic, sourceName, targetName, sourceParentName, targetParentName ]) => {
				const source = sourceByName.get(sourceName); const target = targetByName.get(targetName); const sourceHierarchy = Boolean(source) && (!sourceParentName || parentBoneName(source) === sourceParentName); const targetHierarchy = Boolean(target) && (!targetParentName || parentBoneName(target) === targetParentName); const valid = Boolean(source && target && sourceHierarchy && targetHierarchy);
				report.push({ semantic, source: sourceName, target: targetName, sourceParent: parentBoneName(source), targetParent: parentBoneName(target), status: valid ? 'PASS' : 'FAIL' }); return { semantic, source, target, valid };
			});
			const failures = report.filter(item => item.status === 'FAIL'); if (failures.length) throw new Error('Humanoid bone mapping không hợp lệ: ' + failures.map(item => item.semantic).join(', '));
			global.console.table(report);
			return { entries: entries.sort((a, b) => depth(a.target) - depth(b.target)), report, profile: profile.id, sourceBones, sourceBoneCount: sourceBones.length, targetBoneCount: targetSkeleton.bones.length };
		}

		retarget(sourceRoot, sourceClip, targetSkeleton, outputName) {
			if (!sourceClip || !sourceClip.tracks.length) throw new Error('Source không có animation clip.');
			sourceRoot.updateMatrixWorld(true); targetSkeleton.bones[0].parent.updateMatrixWorld(true);
			const mapping = this.buildMapping(sourceRoot, targetSkeleton); const sourceBones = mapping.sourceBones; const sourceTrackByName = quaternionTrackMap(sourceClip);
			const times = Array.from(new Set(mapping.entries.flatMap(entry => Array.from((sourceTrackByName.get(entry.source.name) || { times: [] }).times)))).sort((a, b) => a - b);
			if (!times.length) throw new Error('Source không có quaternion tracks cho humanoid mapping.');
			const sourceRestLocal = new Map(sourceBones.map(bone => [ bone, bone.quaternion.clone() ]));
			const targetRestLocal = new Map(mapping.entries.map(entry => [ entry.target, entry.target.quaternion.clone() ]));
			const sourceRestWorld = new Map(sourceBones.map(bone => [ bone, bone.getWorldQuaternion(new global.THREE.Quaternion()) ]));
			const targetRestWorld = new Map(mapping.entries.map(entry => [ entry.target, entry.target.getWorldQuaternion(new global.THREE.Quaternion()) ]));
			const sourceToTargetLocal = new Map(mapping.entries.map(entry => [ entry, targetRestWorld.get(entry.target).clone().invert().multiply(sourceRestWorld.get(entry.source)).normalize() ]));
			const output = new Map(mapping.entries.map(entry => [ entry.target, [] ]));
			const angularReport = mapping.entries.map(entry => {
				const correction = sourceToTargetLocal.get(entry); let maxDeltaDeg = 0;
				times.forEach(time => { const delta = sourceRestLocal.get(entry.source).clone().invert().multiply(sampleQuaternion(sourceTrackByName.get(entry.source.name), time, sourceRestLocal.get(entry.source))).normalize(); maxDeltaDeg = Math.max(maxDeltaDeg, global.THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(delta.w))))); });
				const restOffsetDeg = global.THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(correction.w))));
				return { source: entry.source.name, target: entry.target.name, restOffsetDeg: Number(restOffsetDeg.toFixed(2)), currentDeltaDeg: Number(maxDeltaDeg.toFixed(2)), flag: maxDeltaDeg > 150 ? 'CHECK >150°' : 'OK' };
			});

			times.forEach(time => {
				mapping.entries.forEach(entry => {
					// The delta stays in source LOCAL bone space. Convert its basis using
					// each bone's bind/rest world orientation, then restore target LOCAL rest.
					const sourceAnimatedLocal = sampleQuaternion(sourceTrackByName.get(entry.source.name), time, sourceRestLocal.get(entry.source));
					const sourceLocalDelta = sourceRestLocal.get(entry.source).clone().invert().multiply(sourceAnimatedLocal).normalize();
					const correction = sourceToTargetLocal.get(entry); const convertedDelta = correction.clone().multiply(sourceLocalDelta).multiply(correction.clone().invert()).normalize();
					const targetAnimatedLocal = targetRestLocal.get(entry.target).clone().multiply(convertedDelta).normalize();
					output.get(entry.target).push(targetAnimatedLocal.x, targetAnimatedLocal.y, targetAnimatedLocal.z, targetAnimatedLocal.w);
				});
			});

			global.console.table(angularReport);
			const tracks = mapping.entries.map(entry => new global.THREE.QuaternionKeyframeTrack(entry.target.uuid + '.quaternion', times, output.get(entry.target))); const clip = new global.THREE.AnimationClip(outputName || sourceClip.name, sourceClip.duration, tracks);
			return { clip, mapping: mapping.report, sourceProfile: mapping.profile, sourceBoneCount: mapping.sourceBoneCount, targetBoneCount: mapping.targetBoneCount, angularReport, rootMotion: 'X/Z removed: output contains rotation tracks only.' };
		}
	}

	global.LM_HumanoidRetargeter = HumanoidRetargeter;
})(window);
