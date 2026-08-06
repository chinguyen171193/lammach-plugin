(function (global) {
	'use strict';

	var LayerMapper = {
		layerDefinitions: [
			{ id: 'topCopper', filename: 'top_copper.GTL', title: 'Top Copper' },
			{ id: 'bottomCopper', filename: 'bottom_copper.GBL', title: 'Bottom Copper' },
			{ id: 'topMask', filename: 'top_solder_mask.GTS', title: 'Top Solder Mask' },
			{ id: 'bottomMask', filename: 'bottom_solder_mask.GBS', title: 'Bottom Solder Mask' },
			{ id: 'topSilk', filename: 'top_silkscreen.GTO', title: 'Top Silkscreen' },
			{ id: 'bottomSilk', filename: 'bottom_silkscreen.GBO', title: 'Bottom Silkscreen' },
			{ id: 'outline', filename: 'board_outline.GKO', title: 'Board Outline' }
		],

		createLayers: function () {
			var out = {};
			this.layerDefinitions.forEach(function (def) {
				out[def.id] = new global.DATPCBGerberLayer(def.id, def.filename, { title: def.title });
			});
			return out;
		},

		copperLayerForObject: function (obj) {
			if (obj.type === 'via') return 'both';
			if (obj.layer === 'bottom_copper' || (obj.geometry && obj.geometry.side === 'bottom')) return 'bottomCopper';
			return 'topCopper';
		},

		maskLayersForObject: function (obj) {
			if (obj.type === 'via') return ['topMask', 'bottomMask'];
			if (obj.layer === 'bottom_copper' || (obj.geometry && obj.geometry.side === 'bottom')) return ['bottomMask'];
			return ['topMask'];
		},

		// Truoc day nhanh dau kiem tra 'bottom_silk' - mot khoa lop CHUA TUNG ton
		// tai trong schema - nen no la code chet, chi con geometry.side chay that.
		// Gio in lua co lop rieng that su nen kiem tra dung ten lop, van giu
		// geometry.side lam duong lui cho vat the cu con nam tren lop 'annotation'.
		silkLayerForObject: function (obj) {
			if (obj.layer === 'silk_bottom') return 'bottomSilk';
			if (obj.layer === 'silk_top') return 'topSilk';
			if (obj.geometry && obj.geometry.side === 'bottom') return 'bottomSilk';
			return 'topSilk';
		}
	};

	global.DATPCBGerberLayerMapper = LayerMapper;
})(window);
