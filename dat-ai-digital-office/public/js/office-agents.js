(function (global) {
	'use strict';
	const humanGraphic = (agent) => {
		const c = new PIXI.Container(), shadow = new PIXI.Graphics(), legs = new PIXI.Graphics(), body = new PIXI.Graphics(), head = new PIXI.Graphics(), paper = new PIXI.Graphics();
		shadow.beginFill(0x000000,.24).drawEllipse(0,12,13,5).endFill(); legs.lineStyle(3,0x19314d,1).moveTo(-4,8).lineTo(-5,17).moveTo(4,8).lineTo(5,17); body.beginFill(PIXI.utils.string2hex(agent.color)).drawRoundedRect(-8,-2,16,15,5).endFill(); head.beginFill(0xf2c9a5).drawCircle(0,-10,7).endFill(); head.beginFill(0x162b45).drawArc(0,-11,7,Math.PI,Math.PI*2).endFill(); paper.beginFill(0xfff7d1).drawRect(9,-2,7,10).endFill(); paper.visible=false;
		c.addChild(shadow,legs,body,head,paper); c.hitArea=new PIXI.Circle(0,0,18); c.interactive=true; c.buttonMode=true; c._parts={legs,body,paper}; return c;
	};
	const aiGraphic = (agent) => {
		const c=new PIXI.Container(), glow=new PIXI.Graphics(), core=new PIXI.Graphics(), ring=new PIXI.Graphics(), trail=new PIXI.Graphics(); const color=PIXI.utils.string2hex(agent.color); glow.beginFill(color,.16).drawCircle(0,0,24).endFill(); core.beginFill(color,.95).drawCircle(0,9).endFill(); core.beginFill(0xffffff,.88).drawCircle(-3,6,3).endFill(); ring.lineStyle(1.5,color,.9).drawEllipse(0,8,16,7); trail.lineStyle(2,color,.6).moveTo(0,17).lineTo(-4,30).lineTo(3,37); c.addChild(glow,trail,ring,core); c.hitArea=new PIXI.Circle(0,7,25); c.interactive=true; c.buttonMode=true; c._parts={glow,ring,trail}; return c;
	};
	class OfficeAgent {
		constructor(data, position, onSelect) { this.data=Object.assign({},data); this.position=Object.assign({},position); this.target=null; this.path=[]; this.pathIndex=0; this.elapsed=Math.random()*3; this.carrying=false; this.graphics=data.type==='ai'?aiGraphic(data):humanGraphic(data); this.graphics.position.set(position.x,position.y); this.graphics.on('pointertap',()=>onSelect(this)); }
		moveTo(target, path) { this.target=target; this.path=path||[this.position,target]; this.pathIndex=0; this.data.status='walking'; this.carrying=Math.random()>.55 && this.data.type==='human'; if(this.graphics._parts.paper) this.graphics._parts.paper.visible=this.carrying; }
		update(delta) { this.elapsed+=delta; const p=this.graphics._parts; if(this.data.type==='ai'){ this.graphics.y=this.position.y+Math.sin(this.elapsed*2.4)*4; p.ring.rotation+=delta*1.4; p.glow.alpha=.55+Math.sin(this.elapsed*3)*.2; return; } if(this.data.status==='walking'&&this.pathIndex<this.path.length){ const next=this.path[this.pathIndex], dx=next.x-this.position.x,dy=next.y-this.position.y,d=Math.hypot(dx,dy),speed=this.data.speed*(this.data.type==='ai'?1.35:1); if(d<2){ this.position={x:next.x,y:next.y}; this.pathIndex++; if(this.pathIndex>=this.path.length){this.data.status=this.target&&this.target.sit?'typing':'working';this.carrying=false;p.paper.visible=false;} }else{const step=Math.min(d,speed*delta);this.position.x+=dx/d*step;this.position.y+=dy/d*step;this.graphics.scale.x=dx<0?-1:1; p.legs.rotation=Math.sin(this.elapsed*13)*.3;} } else { p.legs.rotation=Math.sin(this.elapsed*2)*.03; }
			this.graphics.position.set(this.position.x,this.position.y);
		}
	}
	global.DATAIOfficeAgent=OfficeAgent;
})(window);
