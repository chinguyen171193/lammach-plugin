(function (global) {
	'use strict';
	function boot(root){try{const config=JSON.parse(root.dataset.officeConfig);if(!global.PIXI)throw new Error('PixiJS chưa tải được.');if(!global.LMAIOfficeEngine)throw new Error('Office Engine chưa tải được.');const office=new global.LMAIOfficeEngine(root,config);office.start();root.dataset.officeState='running';}catch(error){console.error('LM AI Office:',error);const stage=root.querySelector('.lm-ai-office__stage');if(stage)stage.innerHTML='<p style="padding:24px;color:#fff">Không thể khởi tạo văn phòng số: '+String(error.message||error)+'</p>';root.dataset.officeReady='';}}
	function init(){document.querySelectorAll('.lm-ai-office[data-office-config]').forEach(root=>{if(!root.dataset.officeReady){root.dataset.officeReady='1';boot(root);}});}
	if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
	global.LM_AI_Office_Init=init;
})(window);
