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
})(jQuery);
