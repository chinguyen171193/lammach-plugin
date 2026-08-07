(function (global) {
	'use strict';

	let instance = 0;

	const profiles = {
		'supervisor-ai': { variant: 'supervisor', shirt: '#173d68', accent: '#55dcff', skin: '#d89b72', hair: '#17202d' },
		'sale-ai': { variant: 'sale', shirt: '#b9dced', accent: '#55dcff', skin: '#e3ad87', hair: '#20242d' },
		'pcb-engineer': { variant: 'pcb', shirt: '#17486a', accent: '#43e0b3', skin: '#d89b72', hair: '#17202d' }
	};

	function screenMarkup(variant, accent) {
		if (variant === 'supervisor') {
			return `<g class="dat-agent-rig__screens">
				<g transform="translate(30 112)"><rect width="76" height="67" rx="6" fill="#071523" stroke="${accent}" stroke-opacity=".55"/><rect x="7" y="8" width="62" height="46" rx="3" fill="#0b3650"/><path class="dat-agent-rig__screen-data" d="M14 43l11-12 10 7 12-21 13 13" fill="none" stroke="${accent}" stroke-width="3"/><path d="M22 67h38M41 55v12" stroke="#4e6879" stroke-width="4"/></g>
				<g transform="translate(109 95)"><rect width="88" height="76" rx="6" fill="#071523" stroke="${accent}" stroke-opacity=".7"/><rect x="8" y="9" width="72" height="52" rx="3" fill="#0b3650"/><circle class="dat-agent-rig__screen-data" cx="30" cy="34" r="13" fill="none" stroke="${accent}" stroke-width="4" stroke-dasharray="44 18"/><path d="M45 25h27M45 34h20M45 43h24M29 76h40M49 61v15" stroke="#5a7383" stroke-width="4"/></g>
				<g transform="translate(200 114)"><rect width="76" height="65" rx="6" fill="#071523" stroke="${accent}" stroke-opacity=".55"/><rect x="7" y="8" width="62" height="44" rx="3" fill="#0b3650"/><path class="dat-agent-rig__screen-data" d="M14 38h9V25h10v20h10V18h10v27h9" fill="none" stroke="${accent}" stroke-width="3"/><path d="M20 65h38M39 52v13" stroke="#4e6879" stroke-width="4"/></g>
			</g>`;
		}

		return `<g class="dat-agent-rig__screens" transform="translate(174 105)">
			<rect width="99" height="80" rx="7" fill="#071523" stroke="${accent}" stroke-opacity=".65"/>
			<rect x="8" y="9" width="83" height="56" rx="3" fill="#0b314a"/>
			${variant === 'pcb' ? `<path class="dat-agent-rig__screen-data" d="M18 23h18v12h17v-8h24v24H60v8H30V48H18z" fill="none" stroke="${accent}" stroke-width="2.5"/><circle cx="36" cy="35" r="3" fill="${accent}"/><circle cx="60" cy="51" r="3" fill="${accent}"/>` : `<path class="dat-agent-rig__screen-data" d="M18 22h54M18 31h38M18 40h48M18 49h31" stroke="${accent}" stroke-width="4" stroke-linecap="round"/><circle cx="77" cy="49" r="7" fill="none" stroke="${accent}" stroke-width="3"/>`}
			<path d="M30 80h40M50 65v15" stroke="#526e80" stroke-width="5"/>
		</g>`;
	}

	function accessoryMarkup(variant, accent) {
		if (variant === 'sale') {
			return `<g class="dat-agent-rig__role-detail"><path d="M107 132c0-22 14-37 34-37s35 15 35 37" fill="none" stroke="${accent}" stroke-width="5"/><rect x="103" y="127" width="8" height="25" rx="4" fill="${accent}"/><rect x="173" y="127" width="8" height="25" rx="4" fill="${accent}"/><path d="M178 148c-2 13-11 17-23 17" fill="none" stroke="${accent}" stroke-width="3"/><circle cx="153" cy="165" r="4" fill="${accent}"/></g>`;
		}
		if (variant === 'pcb') {
			return `<g class="dat-agent-rig__pcb-board" transform="translate(197 239) rotate(-7)"><rect width="48" height="29" rx="4" fill="#08765e" stroke="${accent}" stroke-width="2"/><path d="M7 8h15v6h18M8 21h9v-5h24" fill="none" stroke="#8fffd7" stroke-width="2"/><circle cx="9" cy="8" r="2.5" fill="#d7b646"/><circle cx="39" cy="21" r="2.5" fill="#d7b646"/></g>`;
		}
		return `<g class="dat-agent-rig__role-detail" transform="translate(219 206)"><circle r="18" fill="#0a263a" stroke="${accent}" stroke-width="2"/><path class="dat-agent-rig__screen-data" d="M-9 3l6-7 5 4 8-10" fill="none" stroke="${accent}" stroke-width="3"/></g>`;
	}

	function markup(spriteId) {
		const profile = profiles[spriteId] || profiles['supervisor-ai'];
		const id = `dat-agent-rig-${++instance}`;
		const isSale = profile.variant === 'sale';

		return `<svg class="dat-agent-rig dat-agent-rig--${profile.variant}" viewBox="0 0 320 400" role="img" aria-label="Nhân vật Agent hoạt hình">
			<defs>
				<linearGradient id="${id}-desk" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#29485d"/><stop offset="1" stop-color="#102434"/></linearGradient>
				<linearGradient id="${id}-shirt" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${profile.shirt}"/><stop offset="1" stop-color="#0b2238"/></linearGradient>
				<filter id="${id}-glow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
			</defs>
			<ellipse cx="160" cy="357" rx="126" ry="17" fill="#000" opacity=".28"/>
			<g class="dat-agent-rig__chair"><rect x="63" y="152" width="63" height="128" rx="25" fill="#152a3b" stroke="#355168" stroke-width="5"/><path d="M91 276v62M66 346h52M74 335l-20 17M108 335l21 17" stroke="#334e61" stroke-width="8" stroke-linecap="round"/></g>
			${screenMarkup(profile.variant, profile.accent)}
			<g class="dat-agent-rig__legs"><path d="M119 245c2 30 17 55 24 85" fill="none" stroke="#172d48" stroke-width="24" stroke-linecap="round"/><path d="M151 244c13 28 22 55 20 84" fill="none" stroke="#11243b" stroke-width="24" stroke-linecap="round"/><path d="M133 334h28M161 334h29" stroke="#241f22" stroke-width="12" stroke-linecap="round"/></g>
			<g class="dat-agent-rig__body"><path d="M103 181c12-14 50-17 63 2l14 67H91z" fill="url(#${id}-shirt)" stroke="#43627a" stroke-width="3"/><path d="M111 205h49" stroke="${profile.accent}" stroke-opacity=".35" stroke-width="3"/></g>
			<g class="dat-agent-rig__head">
				<ellipse cx="135" cy="143" rx="31" ry="37" fill="${profile.skin}"/>
				${isSale ? `<path d="M104 145c-2-35 15-52 34-52 31 0 42 27 31 65l-12-4c6-28-1-45-20-46-14 0-23 13-23 37z" fill="${profile.hair}"/><path d="M107 134c-8 25-3 55 15 67" fill="none" stroke="${profile.hair}" stroke-width="13" stroke-linecap="round"/>` : `<path d="M105 137c1-31 15-44 34-44 22 0 34 13 34 34-15-11-36-14-62-5z" fill="${profile.hair}"/>`}
				<g class="dat-agent-rig__eyes"><ellipse cx="126" cy="143" rx="3" ry="2" fill="#14202b"/><ellipse cx="148" cy="143" rx="3" ry="2" fill="#14202b"/></g>
				<path d="M131 158c6 4 12 4 17 0" fill="none" stroke="#985f53" stroke-width="2" stroke-linecap="round"/>
			</g>
			${accessoryMarkup(profile.variant, profile.accent)}
			<g class="dat-agent-rig__arm dat-agent-rig__arm--left"><path d="M108 193c-7 21 4 42 32 51" fill="none" stroke="${profile.shirt}" stroke-width="18" stroke-linecap="round"/><circle cx="142" cy="245" r="9" fill="${profile.skin}"/></g>
			<g class="dat-agent-rig__arm dat-agent-rig__arm--right"><path d="M158 191c17 14 24 32 31 51" fill="none" stroke="${profile.shirt}" stroke-width="18" stroke-linecap="round"/><circle cx="191" cy="245" r="9" fill="${profile.skin}"/></g>
			<g class="dat-agent-rig__desk"><path d="M52 250h214l27 28H78z" fill="url(#${id}-desk)" stroke="#3b5a6c" stroke-width="3"/><path d="M82 278v68M263 278v68" stroke="#172b3a" stroke-width="16"/><path d="M76 347h30M247 347h30" stroke="#294457" stroke-width="8" stroke-linecap="round"/><rect x="127" y="244" width="68" height="8" rx="4" fill="#071521"/><path class="dat-agent-rig__keyboard-light" d="M134 248h53" stroke="${profile.accent}" stroke-width="2" stroke-dasharray="5 4"/></g>
			<g class="dat-agent-rig__mouse" transform="translate(205 249)"><ellipse rx="10" ry="6" fill="#071521"/><path d="M0-5v5" stroke="${profile.accent}" stroke-width="2"/></g>
			<circle class="dat-agent-rig__status-light" cx="278" cy="273" r="4" fill="${profile.accent}" filter="url(#${id}-glow)"/>
		</svg>`;
	}

	global.DAT_AgentRig = { markup };
})(window);
