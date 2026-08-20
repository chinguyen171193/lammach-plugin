(function ($, global) {
	'use strict';

	let preview = null;
	let previewRequest = 0;

	function extension(file) {
		const value = String(file.filename || file.url || '');
		const match = value.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
		return match ? match[1].toLowerCase() : '';
	}

	function setText(selector, value) {
		const element = document.querySelector(selector);
		if (element) element.textContent = value;
	}

	function resetMetrics() {
		setText('[data-asset-size-x]', '—');
		setText('[data-asset-size-y]', '—');
		setText('[data-asset-size-z]', '—');
		setText('[data-asset-mesh-count]', '—');
		setText('[data-asset-material-count]', '—');
		setText('[data-asset-texture-count]', '—');
	}

	class PreviewOrbitCamera {
		constructor(camera, element, target, radius) {
			this.camera = camera;
			this.element = element;
			this.target = target.clone();
			this.radius = radius;
			this.theta = 0.7;
			this.phi = 1.05;
			this.pointer = null;
			this.bind();
			this.update();
		}

		bind() {
			this.down = event => {
				if (event.button !== 0) return;
				event.preventDefault();
				this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
				if (this.element.setPointerCapture) this.element.setPointerCapture(event.pointerId);
			};
			this.move = event => {
				if (!this.pointer || this.pointer.id !== event.pointerId) return;
				event.preventDefault();
				this.theta -= (event.clientX - this.pointer.x) * 0.008;
				this.phi = Math.max(0.18, Math.min(Math.PI - 0.18, this.phi + (event.clientY - this.pointer.y) * 0.008));
				this.pointer.x = event.clientX;
				this.pointer.y = event.clientY;
				this.update();
			};
			this.up = event => {
				if (this.pointer && this.pointer.id === event.pointerId) this.pointer = null;
			};
			this.wheel = event => {
				event.preventDefault();
				this.zoom(event.deltaY * 0.008);
			};
			this.element.addEventListener('pointerdown', this.down);
			this.element.addEventListener('pointermove', this.move);
			this.element.addEventListener('pointerup', this.up);
			this.element.addEventListener('pointercancel', this.up);
			this.element.addEventListener('wheel', this.wheel, { passive: false });
		}

		update() {
			this.camera.position.setFromSphericalCoords(this.radius, this.phi, this.theta).add(this.target);
			this.camera.lookAt(this.target);
		}

		rotate(amount) {
			this.theta += amount;
			this.update();
		}

		zoom(amount) {
			this.radius = Math.max(0.3, Math.min(100, this.radius + amount));
			this.update();
		}

		reset() {
			this.theta = 0.7;
			this.phi = 1.05;
			this.update();
		}

		destroy() {
			this.element.removeEventListener('pointerdown', this.down);
			this.element.removeEventListener('pointermove', this.move);
			this.element.removeEventListener('pointerup', this.up);
			this.element.removeEventListener('pointercancel', this.up);
			this.element.removeEventListener('wheel', this.wheel);
		}
	}

	function disposePreview() {
		previewRequest += 1;
		if (!preview) return;
		global.cancelAnimationFrame(preview.frame);
		if (preview.resizeObserver) preview.resizeObserver.disconnect();
		if (preview.orbit) preview.orbit.destroy();
		if (preview.renderer) preview.renderer.dispose();
		if (preview.host) preview.host.replaceChildren();
		preview = null;
	}

	function countModelResources(model) {
		const materials = new Set();
		const textures = new Set();
		let meshes = 0;
		model.traverse(object => {
			if (!object.isMesh) return;
			meshes += 1;
			const list = Array.isArray(object.material) ? object.material : [object.material];
			list.filter(Boolean).forEach(material => {
				materials.add(material);
				Object.keys(material).forEach(key => {
					const value = material[key];
					if (value && value.isTexture) textures.add(value);
				});
			});
		});
		return { meshes, materials: materials.size, textures: textures.size };
	}

	function modelBounds(model) {
		const THREE = global.THREE;
		model.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(model);
		if (box.isEmpty()) throw new Error('Không đo được bounding box của model.');
		return box;
	}

	function renderMetrics(model) {
		const THREE = global.THREE;
		const box = modelBounds(model);
		const size = box.getSize(new THREE.Vector3());
		const resources = countModelResources(model);
		setText('[data-asset-size-x]', size.x.toFixed(3) + ' m');
		setText('[data-asset-size-y]', size.y.toFixed(3) + ' m');
		setText('[data-asset-size-z]', size.z.toFixed(3) + ' m');
		setText('[data-asset-mesh-count]', String(resources.meshes));
		setText('[data-asset-material-count]', String(resources.materials));
		setText('[data-asset-texture-count]', String(resources.textures));
		return box;
	}

	function resizePreview() {
		if (!preview || !preview.host || !preview.renderer) return;
		const width = preview.host.clientWidth || 620;
		const height = preview.host.clientHeight || 390;
		preview.renderer.setSize(width, height, false);
		preview.camera.aspect = width / height;
		preview.camera.updateProjectionMatrix();
		preview.orbit.update();
	}

	async function openPreview(button) {
		const modal = document.querySelector('[data-asset-preview-modal]');
		const host = document.querySelector('[data-asset-preview-canvas]');
		const status = document.querySelector('[data-asset-preview-status]');
		const url = button.dataset.assetPreviewUrl || '';
		if (!modal || !host) return;
		if (!global.THREE || !global.THREE.GLTFLoader) {
			global.alert('Không thể xem thử vì Three.js hoặc GLTFLoader chưa được tải.');
			return;
		}
		if (!url || !/\.glb(?:$|[?#])/i.test(url)) {
			global.alert('Phiên bản hiện tại chỉ hỗ trợ tệp GLB.');
			return;
		}

		disposePreview();
		const request = ++previewRequest;
		modal.hidden = false;
		resetMetrics();
		if (status) status.textContent = 'Đang kiểm tra model…';

		try {
			const THREE = global.THREE;
			const scene = new THREE.Scene();
			scene.background = new THREE.Color(0x07121c);
			const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 10000);
			const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
			renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
			renderer.outputEncoding = THREE.sRGBEncoding;
			renderer.shadowMap.enabled = true;
			renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			renderer.domElement.className = 'lm-ai-office-asset-preview__webgl';
			host.appendChild(renderer.domElement);
			scene.add(new THREE.HemisphereLight(0xd8f4ff, 0x18242e, 2.2));
			const key = new THREE.DirectionalLight(0xffffff, 2.2);
			key.position.set(4, 7, 5);
			key.castShadow = true;
			key.shadow.mapSize.set(1024, 1024);
			scene.add(key);
			const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x1a3446, roughness: 0.94 }));
			floor.rotation.x = -Math.PI / 2;
			floor.receiveShadow = true;
			scene.add(floor, new THREE.GridHelper(40, 40, 0x3e748d, 0x244757));

			const gltf = await new Promise((resolve, reject) => new THREE.GLTFLoader().load(url, resolve, undefined, reject));
			if (request !== previewRequest) return;
			const model = gltf.scene;
			const form = button.closest('[data-asset-form]');
			const scaleInput = form ? form.querySelector('[name="default_scale"]') : null;
			const previewScale = Math.max(0.01, Number(scaleInput && scaleInput.value) || 1);
			model.scale.setScalar(previewScale);
			model.traverse(object => {
				if (object.isMesh) {
					object.castShadow = true;
					object.receiveShadow = true;
				}
			});
			scene.add(model);
			const box = renderMetrics(model);
			const size = box.getSize(new THREE.Vector3());
			const center = box.getCenter(new THREE.Vector3());
			const radius = Math.max(2.6, size.length() * 1.55);
			const orbit = new PreviewOrbitCamera(camera, renderer.domElement, center, radius);
			preview = { host, scene, camera, renderer, model, orbit, floorOffset: 0, frame: 0, resizeObserver: null };
			resizePreview();
			if ('ResizeObserver' in global) {
				preview.resizeObserver = new ResizeObserver(resizePreview);
				preview.resizeObserver.observe(host);
			}
			let previous = 0;
			const tick = now => {
				if (!preview || request !== previewRequest) return;
				preview.frame = global.requestAnimationFrame(tick);
				previous = now;
				preview.renderer.render(preview.scene, preview.camera);
			};
			preview.frame = global.requestAnimationFrame(tick);
			if (status) status.textContent = 'Sẵn sàng. Kéo để xoay camera, lăn chuột để zoom.' + (previewScale !== 1 ? ' Bản xem thử đang dùng tỷ lệ mặc định ' + previewScale + '.' : '');
		} catch (error) {
			if (request !== previewRequest) return;
			if (status) status.textContent = 'Lỗi mô hình: ' + (error && error.message ? error.message : 'Không thể tải GLB.');
		}
	}

	function applyFloorAlignment() {
		if (!preview || !preview.model) return;
		try {
			const box = modelBounds(preview.model);
			preview.model.position.y -= box.min.y;
			preview.floorOffset = preview.model.position.y;
			renderMetrics(preview.model);
			const input = document.querySelector('[data-asset-floor-offset]');
			if (input) {
				input.value = preview.floorOffset.toFixed(4);
				input.dispatchEvent(new Event('change', { bubbles: true }));
			}
			const status = document.querySelector('[data-asset-preview-status]');
			if (status) status.textContent = 'Đã đặt đáy model xuống sàn. floorOffset = ' + preview.floorOffset.toFixed(4) + ' m; nhấn Lưu để giữ giá trị.';
		} catch (error) {
			const status = document.querySelector('[data-asset-preview-status]');
			if (status) status.textContent = 'Lỗi mô hình: không thể đặt xuống sàn.';
		}
	}

	$(document).on('click', '[data-asset-select-model]', function () {
		const form = $(this).closest('[data-asset-form]');
		const frame = global.wp.media({ title: 'Tải mô hình GLB', button: { text: 'Dùng model này' }, multiple: false });
		frame.on('select', function () {
			const file = frame.state().get('selection').first().toJSON();
			if (extension(file) !== 'glb') {
				global.alert('Phiên bản hiện tại chỉ hỗ trợ tệp GLB.');
				return;
			}
			form.find('[data-asset-model-id]').val(file.id || '');
			form.find('[data-asset-model-label]').text(file.filename || file.title || 'Model GLB đã chọn');
			form.find('[data-asset-preview]').first().attr('data-asset-preview-url', file.url || '').prop('disabled', !file.url);
		});
		frame.open();
	});

	$(document).on('click', '[data-asset-select-thumbnail]', function () {
		const form = $(this).closest('[data-asset-form]');
		const frame = global.wp.media({ title: 'Chọn ảnh đại diện', button: { text: 'Dùng ảnh này' }, multiple: false, library: { type: 'image' } });
		frame.on('select', function () {
			const image = frame.state().get('selection').first().toJSON();
			form.find('[data-asset-thumbnail-id]').val(image.id || '');
			form.find('[data-asset-thumbnail-label]').text(image.filename || image.title || 'Ảnh đại diện đã chọn');
			const previewImage = form.find('[data-asset-thumbnail-preview]');
			previewImage.attr('src', image.sizes && image.sizes.medium ? image.sizes.medium.url : image.url || '').prop('hidden', false);
		});
		frame.open();
	});

	$(document).on('click', '[data-asset-preview]', function () { openPreview(this); });
	$(document).on('click', '[data-asset-preview-close]', function () {
		const modal = document.querySelector('[data-asset-preview-modal]');
		if (modal) modal.hidden = true;
		disposePreview();
	});
	$(document).on('click', '[data-asset-preview-floor]', applyFloorAlignment);
	$(document).on('click', '[data-asset-preview-control]', function () {
		if (!preview || !preview.orbit) return;
		const action = this.dataset.assetPreviewControl;
		if (action === 'rotate-left') preview.orbit.rotate(0.35);
		if (action === 'rotate-right') preview.orbit.rotate(-0.35);
		if (action === 'zoom-in') preview.orbit.zoom(-Math.max(0.35, preview.orbit.radius * 0.12));
		if (action === 'zoom-out') preview.orbit.zoom(Math.max(0.35, preview.orbit.radius * 0.12));
		if (action === 'reset') preview.orbit.reset();
	});
})(jQuery, window);
