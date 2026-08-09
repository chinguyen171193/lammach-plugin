(function ($) {
	'use strict';
	$(document).on('click', '[data-animation-select]', function () {
		const form = $(this).closest('form');
		const frame = wp.media({ title: 'Chọn tệp chuyển động', button: { text: 'Chọn tệp' }, multiple: false });
		frame.on('select', function () {
			const file = frame.state().get('selection').first().toJSON();
			const extension = String(file.filename || '').split('.').pop().toLowerCase();
			if ([ 'fbx', 'glb', 'gltf' ].indexOf(extension) === -1) { window.alert('Chỉ hỗ trợ tệp FBX, GLB hoặc GLTF.'); return; }
			form.find('[data-animation-attachment]').val(file.id);
			form.find('[data-animation-file]').text(file.filename || file.title);
			form.find('button[type=submit]').prop('disabled', false);
		});
		frame.open();
	});
	function versioned(url) { const version = window.DAT_AI_OFFICE_ANIMATION_PREVIEW.version; return url + (url.indexOf('?') === -1 ? '?' : '&') + 'ver=' + encodeURIComponent(version); }
	function loadFBX(url) { return new Promise((resolve, reject) => new window.THREE.FBXLoader().load(versioned(url), resolve, undefined, reject)); }
	function primaryMesh(model) { let selected = null; model.traverse(object => { if (object.isSkinnedMesh && object.skeleton && (!selected || object.name === 'Suit_Legs')) selected = object; }); return selected; }
	function retarget(clip, skeleton) { const targets = new Map(skeleton.bones.map(bone => [bone.name, bone])); const tracks = []; clip.tracks.forEach(track => { const match = track.name.match(/^(.+)\.(quaternion)$/); if (!match || [ 'CharacterArmature', 'FootL', 'FootR' ].indexOf(match[1]) !== -1 || !targets.has(match[1])) return; const next = track.clone(); next.name = targets.get(match[1]).uuid + '.quaternion'; tracks.push(next); }); return new window.THREE.AnimationClip('preview', clip.duration, tracks); }
	class PreviewOrbitCamera {
		constructor(camera, element) { this.camera = camera; this.element = element; this.target = new window.THREE.Vector3(0, .82, 0); this.radius = 5.8; this.theta = .68; this.phi = 1.12; this.pointer = null; this.bind(); this.update(); }
		bind() { this.down = event => { this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }; this.element.setPointerCapture(event.pointerId); }; this.move = event => { if (!this.pointer || this.pointer.id !== event.pointerId) return; this.theta -= (event.clientX - this.pointer.x) * .008; this.phi = Math.max(.2, Math.min(Math.PI - .2, this.phi + (event.clientY - this.pointer.y) * .008)); this.pointer.x = event.clientX; this.pointer.y = event.clientY; this.update(); }; this.up = event => { if (this.pointer && this.pointer.id === event.pointerId) this.pointer = null; }; this.wheel = event => { event.preventDefault(); this.radius = Math.max(3.1, Math.min(11, this.radius + event.deltaY * .008)); this.update(); }; this.element.addEventListener('pointerdown', this.down); this.element.addEventListener('pointermove', this.move); this.element.addEventListener('pointerup', this.up); this.element.addEventListener('pointercancel', this.up); this.element.addEventListener('wheel', this.wheel, { passive: false }); }
		update() { this.camera.position.setFromSphericalCoords(this.radius, this.phi, this.theta).add(this.target); this.camera.lookAt(this.target); }
		destroy() { this.element.removeEventListener('pointerdown', this.down); this.element.removeEventListener('pointermove', this.move); this.element.removeEventListener('pointerup', this.up); this.element.removeEventListener('pointercancel', this.up); this.element.removeEventListener('wheel', this.wheel); }
	}
	let preview = null;
	let previewRequest = 0;
	function destroyPreview() { previewRequest += 1; if (!preview) return; cancelAnimationFrame(preview.frame); preview.orbit.destroy(); preview.renderer.dispose(); preview.host.replaceChildren(); preview = null; }
	async function openPreview(button) {
		const modal = $('[data-animation-preview-modal]'); const host = modal.find('[data-animation-preview-canvas]')[0]; const status = modal.find('[data-animation-preview-status]');
		if (!/\.fbx(?:$|[?])/i.test(button.dataset.animationUrl)) { alert('Xem thử trong bước này hỗ trợ FBX. Tệp GLB/GLTF đã được lưu nhưng cần loader preview tương ứng.'); return; }
		destroyPreview(); const request = ++previewRequest; modal.prop('hidden', false); modal.find('[data-animation-preview-title]').text('Xem thử: ' + button.dataset.animationLabel); status.text('Đang tải nhân vật và chuyển động…');
		try {
			const [model, source] = await Promise.all([loadFBX(DAT_AI_OFFICE_ANIMATION_PREVIEW.modelUrl), loadFBX(button.dataset.animationUrl)]);
			if (request !== previewRequest) return;
			const mesh = primaryMesh(model); if (!mesh) throw new Error('Model không có skeleton hợp lệ.');
			model.traverse(item => { if (item.isSkinnedMesh && item !== mesh) item.bind(mesh.skeleton, item.bindMatrix); if (item.isMesh) { item.castShadow = true; } });
			const sourceClip = button.dataset.animationClip ? source.animations.find(item => item.name === button.dataset.animationClip) : source.animations[0];
			if (!sourceClip) throw new Error('Tệp không có animation clip.'); const clip = retarget(sourceClip, mesh.skeleton); if (!clip.tracks.length) throw new Error('Cần chuyển xương: không tìm thấy xương tương thích.');
			const THREE = window.THREE, scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, .01, 100), renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputEncoding = THREE.sRGBEncoding; host.appendChild(renderer.domElement);
			scene.add(new THREE.HemisphereLight(0xe5f8ff, 0x1b2633, 2.4)); const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(3, 5, 4); scene.add(light); const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0x263b49 })); floor.rotation.x = -Math.PI / 2; scene.add(floor); scene.add(model);
			let box = new THREE.Box3().setFromObject(model), height = box.getSize(new THREE.Vector3()).y; model.scale.setScalar(1.65 / height); model.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(model); model.position.y -= box.min.y;
			const mixer = new THREE.AnimationMixer(model), orbit = new PreviewOrbitCamera(camera, renderer.domElement); mixer.clipAction(clip).play(); const resize = () => { const width = host.clientWidth || 560, height = host.clientHeight || 390; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); orbit.update(); }; resize(); let last = 0; const tick = now => { if (!preview) return; preview.frame = requestAnimationFrame(tick); mixer.update(Math.min(.05, last ? (now - last) / 1000 : 0)); last = now; renderer.render(scene, camera); }; preview = { host, renderer, orbit, frame: requestAnimationFrame(tick) }; status.text('Đang phát: ' + (sourceClip.name || 'Animation') + '. Kéo để xoay, lăn chuột để phóng to/thu nhỏ.');
		} catch (error) { if (request === previewRequest) status.text('Lỗi: ' + (error.message || 'Không thể xem thử animation.')); }
	}
	$(document).on('click', '[data-animation-preview]', function () { openPreview(this); });
	$(document).on('click', '[data-animation-preview-close]', function () { $('[data-animation-preview-modal]').prop('hidden', true); destroyPreview(); });
})(jQuery);
