import json

with open("assets_base64.json","r") as f:
    b64=json.load(f)

# Convert to JSON string for JS
json_str=json.dumps(b64)

html = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>SPUDNIK ULTRA - With Keypad & Boss</title>
<link href="https://fonts.googleapis.com/css2?family=Bangers&family=Fredoka:wght@600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;user-select:none;-webkit-user-select:none;touch-action:none;}
body{background:#050510;overflow:hidden;font-family:'Fredoka',sans-serif;}
#wrap{position:relative;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,#1e1e45 0%,#050510 100%);}
canvas{display:block;background:#08081a;box-shadow:0 0 0 4px #000;border-radius:16px;max-width:100vw;max-height:100vh;}
#ui{position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;justify-content:space-between;padding:10px;max-width:900px;margin:0 auto;}
.top{display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;}
.stats{display:flex;gap:6px;flex-wrap:wrap;}
.pill{background:#fff;border:3px solid #000;border-radius:999px;padding:4px 10px;color:#000;font-weight:700;display:flex;align-items:center;gap:4px;box-shadow:3px 3px 0 #000;font-size:11px;}
.fuel{width:80px;height:10px;background:#000;border-radius:999px;overflow:hidden;border:2px solid #000;}
.fuelFill{height:100%;width:100%;background:linear-gradient(90deg,#00ff88,#ffe600);}
.hearts{display:flex;gap:3px;}
.h{width:20px;height:20px;background:#ff2e63;border:2px solid #000;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;transform:rotate(-45deg);position:relative;}
.h::after{content:'♥';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(45deg);color:#fff;font-size:10px;}
.h.empty{background:#222;} .h.empty::after{color:#444;}
.bottom{pointer-events:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:10px;}
/* KEYPAD */
#joystickBase{width:120px;height:120px;background:rgba(255,255,255,0.12);border:3px solid #000;border-radius:50%;position:relative;box-shadow:4px 4px 0 #000, inset 0 0 20px rgba(124,240,255,0.2);backdrop-filter:blur(4px);}
#joystickStick{width:54px;height:54px;background:#fff;border:3px solid #000;border-radius:50%;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);box-shadow:2px 2px 0 #000;display:flex;align-items:center;justify-content:center;font-size:18px;}
#rightPad{display:flex;gap:10px;align-items:flex-end;}
.padBtn{width:66px;height:66px;background:#fff;border:3px solid #000;border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:26px;box-shadow:4px 4px 0 #000;position:relative;cursor:pointer;transition:transform 0.08s;}
.padBtn:active{transform:scale(0.92);}
.padBtn small{position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);background:#000;color:#fff;font-size:8px;padding:2px 6px;border-radius:999px;white-space:nowrap;}
.cd{position:absolute;bottom:0;left:0;width:100%;background:rgba(0,0,0,0.7);border-radius:0 0 16px 16px;pointer-events:none;}
#menu,#over{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,5,16,0.96);pointer-events:auto;flex-direction:column;z-index:10;padding:16px;text-align:center;}
#over{display:none;}
.title{font-family:'Bangers';font-size:clamp(44px,9vw,84px);color:#ffb800;-webkit-text-stroke:3px #000;text-shadow:6px 6px 0 #000;line-height:0.9;letter-spacing:2px;}
.btn{background:#ffb800;border:4px solid #000;border-radius:999px;padding:12px 32px;font-family:'Bangers';font-size:30px;color:#000;cursor:pointer;box-shadow:6px 6px 0 #000;margin-top:16px;}
.btn:active{transform:translate(3px,3px);box-shadow:3px 3px 0 #000;}
.btn.s{background:#7cf0ff;font-size:20px;padding:8px 18px;margin-top:10px;}
.bigScore{font-family:'Bangers';font-size:58px;-webkit-text-stroke:2px #000;text-shadow:4px 4px 0 #000;}
.comboPop{position:absolute;left:50%;top:26%;transform:translateX(-50%);font-family:'Bangers';font-size:28px;color:#fff;-webkit-text-stroke:2px #000;text-shadow:4px 4px 0 #000;pointer-events:none;animation:combo 0.6s ease-out;z-index:5;}
@keyframes combo{0%{transform:translateX(-50%) scale(0.5) translateY(20px);opacity:0}50%{transform:translateX(-50%) scale(1.3);opacity:1}100%{transform:translateX(-50%) scale(1) translateY(-30px);opacity:0}}
.bossBar{position:absolute;top:60px;left:50%;transform:translateX(-50%);width:300px;height:14px;background:#000;border:3px solid #000;border-radius:999px;overflow:hidden;display:none;pointer-events:none;box-shadow:3px 3px 0 #000;}
.bossFill{height:100%;width:100%;background:linear-gradient(90deg,#ff2e63,#ff0000);}
</style>
</head>
<body>
<div id="wrap">
<canvas id="c" width="900" height="600"></canvas>
<div class="bossBar" id="bossBar"><div id="bossFill" class="bossFill"></div></div>
<div id="ui">
<div class="top">
<div class="stats">
<div class="pill">⏱ <span id="t">0.0</span></div>
<div class="pill">⭐ <span id="sc">0</span></div>
<div class="pill">🥫 <span id="cc">0</span> <span id="mult" style="background:#000;color:#ffe600;border-radius:999px;padding:1px 5px;font-size:9px;">x1</span></div>
<div class="pill" id="stationPill" style="display:none;background:#7cf0ff;">🛰 DOCKING <span id="dockPct">0%</span></div>
</div>
<div class="stats">
<div class="pill">FUEL <div class="fuel"><div id="ff" class="fuelFill"></div></div></div>
<div id="hearts" class="hearts"></div>
</div>
</div>
<div class="bottom">
<div id="joystickBase"><div id="joystickStick">🕹</div></div>
<div id="rightPad">
<div id="dashBtn" class="padBtn">💨<small>DASH</small><div id="dashCd" class="cd" style="height:0%"></div></div>
<div id="ab" class="padBtn">💋<small>MWAH</small><div id="abcd" class="cd" style="height:0%"></div></div>
</div>
</div>
</div>
<div id="menu">
<div class="title">SPUDNIK ULTRA</div>
<canvas id="prev" width="200" height="200" style="width:110px;height:110px;background:#fff;border:4px solid #000;border-radius:20px;box-shadow:6px 6px 0 #000;margin:12px;"></canvas>
<button id="play" class="btn">PLAY 🥔</button>
<div style="margin-top:10px;font-size:10px;opacity:0.6;color:#fff;">Joystick + Dash + Boss + Black Holes + Space Dock</div>
</div>
<div id="over">
<div class="title" style="font-size:50px;">SPUD DOWN!</div>
<div id="fs" class="bigScore">0</div>
<canvas id="overPrev" width="200" height="200" style="width:80px;height:80px;background:#fff;border:3px solid #000;border-radius:16px;margin:8px;"></canvas>
<div style="background:#fff;border:3px solid #000;border-radius:12px;padding:6px 12px;color:#000;font-size:11px;box-shadow:3px 3px 0 #000;">Time: <b id="ft">0</b> • Cans: <b id="fc">0</b> • Combo: <b id="fcombo">x1</b> • Docked: <b id="fdock">0</b></div>
<div style="display:flex;gap:8px;margin-top:10px;"><button id="retry" class="btn">RETRY</button><button id="toMenu" class="btn s">MENU</button></div>
</div>
</div>
<script>
const B64 = __B64JSON__;

function loadImg(src){return new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src;});}
let ASSETS={};
async function loadAll(){
  const groups={player:[],powerup:[],asteroid:[],enemy:[],effect:[],potato_float:[],ui:[]};
  for(const name in B64){
    const img=await loadImg(B64[name]);
    if(name.startsWith('player_')) groups.player[parseInt(name.split('_')[1])]=img;
    else if(name.startsWith('powerup_')) groups.powerup[parseInt(name.split('_')[1])]=img;
    else if(name.startsWith('asteroid_')) groups.asteroid[parseInt(name.split('_')[1])]=img;
    else if(name.startsWith('enemy_')) groups.enemy[parseInt(name.split('_')[1])]=img;
    else if(name.startsWith('effect_')) groups.effect[parseInt(name.split('_')[1])]=img;
    else if(name.startsWith('potato_float_')) groups.potato_float[parseInt(name.split('_')[1])]=img;
    else if(name.startsWith('ui_')) groups.ui[parseInt(name.split('_')[1])]=img;
  }
  ASSETS=groups;
}

const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d');
const W=900,H=600;
let keys={}, mouse={x:W/2,y:H/2,down:false};
let joy={x:0,y:0,active:false};
window.addEventListener('keydown',e=>{keys[e.code]=true;});
window.addEventListener('keyup',e=>keys[e.code]=false);
canvas.addEventListener('pointerdown',e=>{mouse.down=true;updM(e);});
canvas.addEventListener('pointerup',()=>mouse.down=false);
canvas.addEventListener('pointermove',updM);
function updM(e){
  const r=canvas.getBoundingClientRect();
  const sx=canvas.width/r.width, sy=canvas.height/r.height;
  mouse.x=(e.clientX-r.left)*sx;
  mouse.y=(e.clientY-r.top)*sy;
}
function resize(){
  const maxW=window.innerWidth-8, maxH=window.innerHeight-8;
  const ratio=W/H; let nw=maxW, nh=nw/ratio;
  if(nh>maxH){nh=maxH;nw=nh*ratio;}
  canvas.style.width=nw+'px'; canvas.style.height=nh+'px';
}
window.addEventListener('resize',resize); resize();

// JOYSTICK
const joyBase=document.getElementById('joystickBase');
const joyStick=document.getElementById('joystickStick');
let joyTouchId=null;
joyBase.addEventListener('pointerdown',e=>{
  joyTouchId=e.pointerId; joyBase.setPointerCapture(e.pointerId);
  handleJoy(e);
});
joyBase.addEventListener('pointermove',e=>{
  if(e.pointerId!==joyTouchId) return;
  handleJoy(e);
});
joyBase.addEventListener('pointerup',e=>{
  if(e.pointerId!==joyTouchId) return;
  joyTouchId=null; joy.x=0; joy.y=0; joy.active=false;
  joyStick.style.transform='translate(-50%,-50%)';
});
function handleJoy(e){
  const rect=joyBase.getBoundingClientRect();
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  let dx=e.clientX-cx, dy=e.clientY-cy;
  const dist=Math.hypot(dx,dy);
  const max=45;
  if(dist>max){dx=dx/dist*max; dy=dy/dist*max;}
  joyStick.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  joy.x=dx/max; joy.y=dy/max; joy.active=true;
}

let pFrame=0,pTimer=0;
const pCanvas=document.getElementById('prev');
const pCtx=pCanvas.getContext('2d');
const overPCanvas=document.getElementById('overPrev');
const overPCtx=overPCanvas.getContext('2d');
function drawPreview(){
  pTimer++; if(pTimer>12){pTimer=0;pFrame=(pFrame+1)%4;}
  pCtx.clearRect(0,0,200,200);
  if(ASSETS.player && ASSETS.player[pFrame]){
    const img=ASSETS.player[pFrame];
    const sc=Math.min(160/img.width,160/img.height);
    pCtx.drawImage(img,100-img.width*sc/2,100-img.height*sc/2,img.width*sc,img.height*sc);
  }
  const pf=Math.floor(Date.now()/250)%3;
  overPCtx.clearRect(0,0,200,200);
  if(ASSETS.potato_float && ASSETS.potato_float[pf]){
    const img=ASSETS.potato_float[pf];
    const sc=Math.min(150/img.width,150/img.height);
    overPCtx.drawImage(img,100-img.width*sc/2,100-img.height*sc/2 + Math.sin(Date.now()*0.005)*4,img.width*sc,img.height*sc);
  }
  requestAnimationFrame(drawPreview);
}

class Ent{constructor(x,y,w,h){this.x=x;this.y=y;this.w=w;this.h=h;this.vx=0;this.vy=0;this.dead=false;this.rot=0;this.rotSp=0;} get cx(){return this.x+this.w/2} get cy(){return this.y+this.h/2} collides(o){return this.x<o.x+o.w && this.x+this.w>o.x && this.y<o.y+o.h && this.y+this.h>o.y;}}
class Particle{constructor(x,y,vx,vy,life,col,size){this.x=x;this.y=y;this.vx=vx;this.vy=vy;this.life=life;this.max=life;this.col=col;this.size=size;} update(){this.x+=this.vx;this.y+=this.vy;this.vx*=0.98;this.vy*=0.98;this.life--;} draw(c){c.globalAlpha=this.life/this.max;c.fillStyle=this.col;c.beginPath();c.arc(this.x,this.y,this.size*this.life/this.max,0,Math.PI*2);c.fill();c.globalAlpha=1;}}

class Game{
  constructor(){this.reset();}
  reset(){
    this.player=new Ent(W/2-35,H-130,70,70);
    this.player.health=3; this.player.maxH=3; this.player.fuel=100;
    this.player.shield=0; this.player.speed=0; this.player.magnet=0; this.player.tilt=0;
    this.asteroids=[]; this.enemies=[]; this.powerups=[]; this.particles=[]; this.blasts=[]; this.explosions=[];
    this.blackHoles=[]; this.stations=[]; this.boss=null; this.bossBullets=[];
    this.stars=[]; for(let i=0;i<160;i++) this.stars.push({x:Math.random()*W,y:Math.random()*H,s:Math.random()*2+0.3,sp:Math.random()*1.2+0.2,tw:Math.random()*6});
    this.time=0; this.score=0; this.cans=0; this.combo=0; this.comboT=0; this.maxCombo=1; this.docked=0;
    this.blastCd=0; this.dashCd=0; this.shake=0; this.over=false; this.dockProgress=0;
    this.nextStation=10; this.nextBlackHole=15; this.nextBoss=30;
  }
  useBlast(){
    if(this.blastCd>0 || this.player.fuel<8 || this.over) return;
    this.blastCd=150; this.player.fuel-=8; this.shake=14;
    for(let i=0;i<22;i++){const a=Math.random()*6.28, sp=Math.random()*5+2; this.particles.push(new Particle(this.player.cx,this.player.cy,Math.cos(a)*sp,Math.sin(a)*sp,28,'#ff7eb3',6));}
    const R=170;
    [...this.asteroids,...this.enemies,...this.bossBullets].forEach(e=>{
      const dx=e.cx-this.player.cx, dy=e.cy-this.player.cy, d=Math.hypot(dx,dy);
      if(d<R+60){e.vx+=dx/d*9; e.vy+=dy/d*9; e.hp=(e.hp||1)-1; if(e.hp<=0 && !e.isBullet) this.boom(e,true); else if(e.isBullet) e.dead=true;}
    });
    if(this.boss){const dx=this.boss.cx-this.player.cx, dy=this.boss.cy-this.player.cy, d=Math.hypot(dx,dy); if(d<R+100){this.boss.hp-=2; this.shake=12;}}
    this.blasts.push({x:this.player.cx,y:this.player.cy,r:24,life:22});
  }
  useDash(){
    if(this.dashCd>0 || this.player.fuel<12 || this.over) return;
    this.dashCd=120; this.player.fuel-=12;
    const dirX=this.player.vx||0, dirY=this.player.vy||-1;
    const mag=Math.hypot(dirX,dirY)||1;
    this.player.vx+=dirX/mag*18; this.player.vy+=dirY/mag*18;
    this.player.speed=60;
    for(let i=0;i<16;i++){this.particles.push(new Particle(this.player.cx,this.player.cy,(Math.random()-0.5)*6,(Math.random()-0.5)*6,20,'#7cf0ff',4));}
  }
  boom(en,score){
    en.dead=true;
    if(score){this.score+=120*(1+Math.floor(this.combo/3)); this.combo++; this.comboT=140; this.maxCombo=Math.max(this.maxCombo,this.combo); this.showCombo();}
    this.explosions.push({x:en.cx,y:en.cy,frame:0,t:0,size:Math.max(en.w,en.h)*1.3});
    for(let i=0;i<14;i++){const a=Math.random()*6.28, sp=Math.random()*5+1; const col=en.isAst?'#a88c6a':'#ff4d6d'; this.particles.push(new Particle(en.cx,en.cy,Math.cos(a)*sp,Math.sin(a)*sp,32+Math.random()*18,col,Math.random()*4+2));}
    this.shake=Math.max(this.shake,7);
  }
  showCombo(){
    if(this.combo<3) return;
    const el=document.createElement('div'); el.className='comboPop'; el.textContent=`COMBO x${this.combo}!`;
    document.getElementById('wrap').appendChild(el); setTimeout(()=>el.remove(),600);
  }
  spawn(){
    const t=this.time;
    if(t>this.nextStation){this.nextStation=t+18+Math.random()*10; const sz=70; const s=new Ent(Math.random()*(W-sz),-sz,sz,sz); s.vy=1; s.type='station'; s.dockTime=0; this.stations.push(s);}
    if(t>this.nextBlackHole){this.nextBlackHole=t+12+Math.random()*12; const sz=60; const bh=new Ent(Math.random()*(W-sz),-sz,sz,sz); bh.vy=0.8; bh.type='bh'; bh.pull=0.18; this.blackHoles.push(bh);}
    if(t>this.nextBoss && !this.boss){this.nextBoss=t+45; const sz=120; const b=new Ent(W/2-sz/2,-sz,sz,sz); b.vy=0.6; b.type='boss'; b.hp=20; b.maxHp=20; b.shootT=0; b.dir=1; this.boss=b; document.getElementById('bossBar').style.display='block';}
    const astRate=0.022 + t*0.00016;
    const eneRate=0.008 + t*0.00008;
    const powRate=0.011;
    if(Math.random()<astRate){
      const sz=32+Math.random()*40;
      const a=new Ent(Math.random()*(W-sz),-sz,sz,sz);
      a.vy=2.2+Math.random()*3 + t*0.028; a.vx=(Math.random()-0.5)*1.8;
      a.rot=Math.random()*6.28; a.rotSp=(Math.random()-0.5)*0.09;
      a.type=Math.floor(Math.random()*ASSETS.asteroid.length); a.isAst=true; a.hp=1+Math.floor(t/16);
      this.asteroids.push(a);
    }
    if(Math.random()<eneRate){
      const sz=36+Math.random()*20;
      const e=new Ent(Math.random()*(W-sz),-sz,sz,sz);
      e.vy=1.6+Math.random()*2.4 + t*0.02; e.vx=(Math.random()-0.5)*1.3;
      e.type=Math.floor(Math.random()*ASSETS.enemy.length); e.hp=2;
      this.enemies.push(e);
    }
    if(Math.random()<powRate){
      const sz=34;
      const p=new Ent(Math.random()*(W-sz),-sz,sz,sz);
      p.vy=1.9+Math.random()*1.4; p.vx=(Math.random()-0.5)*1;
      p.type=Math.floor(Math.random()*3); p.bob=0;
      this.powerups.push(p);
    }
  }
  update(){
    if(this.over) return;
    this.time+=1/60; this.spawn();
    if(this.comboT>0) this.comboT--; else this.combo=0;
    this.player.fuel-=0.05 + (this.player.speed>0?0.08:0);
    if(this.player.fuel<=0){this.player.fuel=0; if(Math.random()<0.03) this.player.health-=0.018;}
    if(this.blastCd>0) this.blastCd--;
    if(this.dashCd>0) this.dashCd--;
    if(this.player.shield>0) this.player.shield--;
    if(this.player.speed>0) this.player.speed--;
    if(this.player.magnet>0) this.player.magnet--;
    let mx=0,my=0;
    if(keys['ArrowLeft']||keys['KeyA']) mx=-1;
    if(keys['ArrowRight']||keys['KeyD']) mx=1;
    if(keys['ArrowUp']||keys['KeyW']) my=-1;
    if(keys['ArrowDown']||keys['KeyS']) my=1;
    if(joy.active){mx+=joy.x*1.5; my+=joy.y*1.5;}
    if(mouse.down && !joy.active){const dx=mouse.x-this.player.cx, dy=mouse.y-this.player.cy; const d=Math.hypot(dx,dy); if(d>10){mx+=dx*0.02; my+=dy*0.02;}}
    const spd=this.player.speed>0?7.2:4.6;
    this.player.vx+=mx*0.8; this.player.vy+=my*0.8;
    this.player.vx*=0.86; this.player.vy*=0.86;
    const v=Math.hypot(this.player.vx,this.player.vy);
    if(v>spd){this.player.vx=this.player.vx/v*spd; this.player.vy=this.player.vy/v*spd;}
    // black hole pull
    this.blackHoles.forEach(bh=>{
      const dx=bh.cx-this.player.cx, dy=bh.cy-this.player.cy, d=Math.max(20,Math.hypot(dx,dy));
      const pull=bh.pull*900/(d*d)*60;
      this.player.vx+=dx/d*pull*0.08;
      this.player.vy+=dy/d*pull*0.08;
      if(d<28){this.player.health=0; this.gameOver();}
    });
    this.player.x+=this.player.vx; this.player.y+=this.player.vy;
    this.player.x=Math.max(0,Math.min(W-this.player.w,this.player.x));
    this.player.y=Math.max(0,Math.min(H-this.player.h,this.player.y));
    if(Math.abs(this.player.vx)>1.2) this.player.tilt=this.player.vx>0?3:2;
    else if(this.player.vy<-1) this.player.tilt=1;
    else this.player.tilt=0;
    this.stars.forEach(s=>{s.y+=s.sp + (this.player.speed>0?2.5:0); s.tw+=0.02; if(s.y>H){s.y=-5;s.x=Math.random()*W;}});
    // update entities with black hole pull
    const allMovable=[...this.asteroids,...this.enemies,...this.powerups,...this.bossBullets];
    allMovable.forEach(ent=>{
      this.blackHoles.forEach(bh=>{
        const dx=bh.cx-ent.cx, dy=bh.cy-ent.cy, d=Math.max(15,Math.hypot(dx,dy));
        const pull=bh.pull*700/(d*d)*60;
        ent.vx+=dx/d*pull*0.06; ent.vy+=dy/d*pull*0.06;
        if(d<20 && ent.isAst){ent.dead=true;}
      });
    });
    this.asteroids.forEach(a=>{a.x+=a.vx;a.y+=a.vy;a.rot+=a.rotSp; if(a.y>H+120) a.dead=true;});
    this.enemies.forEach(e=>{e.x+=e.vx;e.y+=e.vy; if(e.type===0){const dx=this.player.cx-e.cx, dy=this.player.cy-e.cy, d=Math.hypot(dx,dy); if(d<240){e.vx+=dx/d*0.09; e.vy+=dy/d*0.09;}} if(e.y>H+120) e.dead=true;});
    this.powerups.forEach(p=>{if(this.player.magnet>0){const dx=this.player.cx-p.cx, dy=this.player.cy-p.cy, d=Math.hypot(dx,dy); if(d<220){p.vx+=dx/d*0.32; p.vy+=dy/d*0.32;}} p.x+=p.vx; p.y+=p.vy; p.bob+=0.13; if(p.y>H+120) p.dead=true;});
    this.blackHoles.forEach(bh=>{bh.x+=bh.vx||0; bh.y+=bh.vy; bh.rot+=0.03; if(bh.y>H+100) bh.dead=true;});
    this.stations.forEach(st=>{st.y+=st.vy; st.rot+=0.01; if(st.y>H+100) st.dead=true;});
    // boss
    if(this.boss){
      const b=this.boss;
      b.x+=b.dir*1.2; b.y+=b.vy; b.shootT++;
      if(b.x<0||b.x>W-b.w) b.dir*=-1;
      if(b.y>80) b.vy*=0.92;
      if(b.shootT>70){b.shootT=0; for(let i=-1;i<=1;i++){const bul=new Ent(b.cx-6,b.cy+b.h/2,12,16); bul.vx=i*1.2 + (Math.random()-0.5)*0.5; bul.vy=3; bul.isBullet=true; bul.dead=false; this.bossBullets.push(bul);}}
      if(b.hp<=0){this.boom(b,true); this.score+=1000; this.boss=null; document.getElementById('bossBar').style.display='none'; for(let i=0;i<20;i++) this.particles.push(new Particle(b.cx,b.cy,(Math.random()-0.5)*8,(Math.random()-0.5)*8,40,'#ff2e63',5));}
      document.getElementById('bossFill').style.width=(b.hp/b.maxHp*100)+'%';
    }
    this.bossBullets.forEach(bl=>{bl.x+=bl.vx; bl.y+=bl.vy; if(bl.y>H+20) bl.dead=true; if(this.player.collides(bl) && this.player.shield<=0){bl.dead=true; this.player.health-=1; this.shake=12; if(this.player.health<=0) this.gameOver();} else if(this.player.collides(bl) && this.player.shield>0){bl.dead=true;}});
    this.blasts.forEach(b=>{b.life--; b.r+=7;}); this.blasts=this.blasts.filter(b=>b.life>0);
    this.explosions.forEach(ex=>{ex.t++; if(ex.t>5){ex.t=0; ex.frame++;}}); this.explosions=this.explosions.filter(ex=>ex.frame<4);
    this.particles.forEach(p=>p.update()); this.particles=this.particles.filter(p=>p.life>0);
    // docking
    let nearStation=false;
    this.stations.forEach(st=>{
      if(this.player.collides(st)){
        nearStation=true; st.dockTime++; this.dockProgress=Math.min(100,Math.floor(st.dockTime/60*100));
        document.getElementById('stationPill').style.display='flex';
        document.getElementById('dockPct').textContent=this.dockProgress+'%';
        if(st.dockTime>60){
          st.dead=true; this.docked++; this.player.fuel=100; this.player.health=this.player.maxH; this.player.shield=180; this.score+=500; this.particles.push(...Array(18).fill(0).map(()=>new Particle(this.player.cx,this.player.cy,(Math.random()-0.5)*4,(Math.random()-0.5)*4,36,'#7cf0ff',4)));
          document.getElementById('stationPill').style.display='none'; this.dockProgress=0;
        }
      }
    });
    if(!nearStation){this.stations.forEach(s=>s.dockTime=0); document.getElementById('stationPill').style.display='none'; this.dockProgress=0;}
    // collisions
    [...this.asteroids,...this.enemies].forEach(en=>{
      if(en.dead) return;
      if(this.player.collides(en)){
        if(this.player.shield>0){this.boom(en,true);}
        else{this.player.health-=1; this.player.fuel=Math.max(0,this.player.fuel-14); this.boom(en,false); this.shake=16; if(this.player.health<=0){this.gameOver();}}
      }
    });
    this.powerups.forEach(p=>{
      if(p.dead) return;
      if(this.player.collides(p)){
        p.dead=true; this.cans++; this.combo++; this.comboT=180; this.maxCombo=Math.max(this.maxCombo,this.combo);
        this.score+=180*(1+Math.floor(this.combo/3));
        this.player.fuel=Math.min(100,this.player.fuel+20);
        if(p.type===0){this.player.shield=300;}
        else if(p.type===1){this.player.health=Math.min(this.player.maxH,this.player.health+1);}
        else if(p.type===2){this.player.speed=360; this.player.magnet=360;}
        this.showCombo();
      }
    });
    this.asteroids=this.asteroids.filter(a=>!a.dead);
    this.enemies=this.enemies.filter(e=>!e.dead);
    this.powerups=this.powerups.filter(p=>!p.dead);
    this.blackHoles=this.blackHoles.filter(b=>!b.dead);
    this.stations=this.stations.filter(s=>!s.dead);
    this.bossBullets=this.bossBullets.filter(b=>!b.dead);
    this.score+= (0.22 + this.time*0.014)*(1+Math.floor(this.combo/3));
  }
  gameOver(){this.over=true; this.shake=24; for(let i=0;i<30;i++){const a=Math.random()*6.28, sp=Math.random()*6+2; this.particles.push(new Particle(this.player.cx,this.player.cy,Math.cos(a)*sp,Math.sin(a)*sp,48,'#ffb800',5));} document.getElementById('bossBar').style.display='none';}
  draw(){
    ctx.save();
    if(this.shake>0){ctx.translate((Math.random()-0.5)*this.shake,(Math.random()-0.5)*this.shake); this.shake*=0.9; if(this.shake<0.6) this.shake=0;}
    ctx.fillStyle='#08081a'; ctx.fillRect(0,0,W,H);
    const g=ctx.createRadialGradient(W*0.5,H*0.25,0,W*0.5,H*0.25,H);
    g.addColorStop(0,'rgba(130,90,255,0.18)'); g.addColorStop(0.6,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    this.stars.forEach(s=>{ctx.globalAlpha=0.6+Math.sin(s.tw)*0.4; ctx.fillStyle='#fff'; ctx.beginPath();ctx.arc(s.x,s.y,s.s,0,Math.PI*2);ctx.fill();});
    ctx.globalAlpha=1;
    // black holes
    this.blackHoles.forEach(bh=>{
      ctx.save(); ctx.translate(bh.cx,bh.cy); ctx.rotate(bh.rot);
      // outer glow
      const grad=ctx.createRadialGradient(0,0,0,0,0,40);
      grad.addColorStop(0,'rgba(0,0,0,1)'); grad.addColorStop(0.4,'rgba(80,0,120,0.8)'); grad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=grad; ctx.beginPath();ctx.arc(0,0,45,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#000'; ctx.strokeStyle='#7c4dff'; ctx.lineWidth=3; ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.fill();ctx.stroke();
      // ring
      ctx.strokeStyle='#ff00ff'; ctx.lineWidth=2; ctx.setLineDash([6,4]); ctx.beginPath();ctx.arc(0,0,32,0,Math.PI*2);ctx.stroke(); ctx.setLineDash([]);
      ctx.restore();
    });
    // stations - friendly dock
    this.stations.forEach(st=>{
      ctx.save(); ctx.translate(st.cx,st.cy); ctx.rotate(st.rot);
      ctx.fillStyle='#7cf0ff'; ctx.strokeStyle='#000'; ctx.lineWidth=3;
      ctx.fillRect(-st.w/2,-st.h/2,st.w,st.h); ctx.strokeRect(-st.w/2,-st.h/2,st.w,st.h);
      ctx.fillStyle='#fff'; ctx.font='bold 12px Fredoka'; ctx.textAlign='center'; ctx.fillText('DOCK',0,4);
      // docking indicator
      if(st.dockTime>0){ctx.fillStyle='#00ff88'; ctx.fillRect(-st.w/2,-st.h/2-10,st.w*st.dockTime/60,6);}
      ctx.restore();
    });
    this.particles.forEach(p=>p.draw(ctx));
    // tractor beam - connecting line to nearest powerup when magnet
    if(this.player.magnet>0 && this.powerups.length){
      let nearest=null, nd=9999;
      this.powerups.forEach(p=>{const d=Math.hypot(p.cx-this.player.cx,p.cy-this.player.cy); if(d<nd && d<220){nd=d; nearest=p;}});
      if(nearest){
        ctx.strokeStyle='rgba(124,240,255,0.6)'; ctx.lineWidth=2; ctx.setLineDash([8,6]);
        ctx.beginPath(); ctx.moveTo(this.player.cx,this.player.cy); ctx.lineTo(nearest.cx,nearest.cy); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle='rgba(124,240,255,0.3)'; ctx.beginPath(); ctx.arc(nearest.cx,nearest.cy,12+Math.sin(this.time*8)*3,0,Math.PI*2); ctx.fill();
      }
    }
    this.powerups.forEach(p=>{
      const bob=Math.sin(p.bob)*5;
      const img=ASSETS.powerup[p.type];
      if(img){ctx.shadowColor=['#2ecc71','#ff2e63','#f1c40f'][p.type]; ctx.shadowBlur=18; ctx.drawImage(img,p.x,p.y+bob,p.w,p.h); ctx.shadowBlur=0;}
    });
    this.asteroids.forEach(a=>{
      ctx.save(); ctx.translate(a.cx,a.cy); ctx.rotate(a.rot);
      const img=ASSETS.asteroid[a.type];
      if(img) ctx.drawImage(img,-a.w/2,-a.h/2,a.w,a.h);
      ctx.restore();
    });
    this.enemies.forEach(e=>{
      const img=ASSETS.enemy[e.type];
      if(img){const bob=Math.sin(this.time*3+e.x)*3; ctx.drawImage(img,e.x,e.y+bob,e.w,e.h);}
    });
    // boss - giant ketchup
    if(this.boss){
      const b=this.boss;
      ctx.save(); ctx.translate(b.cx,b.cy);
      // body - using enemy_0 enlarged with tint
      ctx.fillStyle='#cc0000'; ctx.strokeStyle='#000'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.roundRect(-b.w/2,-b.h/2,b.w,b.h,18); ctx.fill(); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.font='bold 20px Bangers'; ctx.textAlign='center'; ctx.fillText('BOSS',0,-10);
      ctx.fillStyle='#ffaaaa'; ctx.font='12px Fredoka'; ctx.fillText(`${b.hp}/${b.maxHp}`,0,12);
      // eyes angry
      ctx.fillStyle='#000'; ctx.beginPath();ctx.arc(-18,-18,8,0,6.28);ctx.arc(18,-18,8,0,6.28);ctx.fill();
      ctx.fillStyle='#fff'; ctx.beginPath();ctx.arc(-16,-20,3,0,6.28);ctx.arc(20,-20,3,0,6.28);ctx.fill();
      ctx.restore();
    }
    this.bossBullets.forEach(bl=>{
      ctx.fillStyle='#ff2e63'; ctx.strokeStyle='#000'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(bl.cx,bl.cy,bl.w/2,bl.h/2,0,0,6.28); ctx.fill(); ctx.stroke();
    });
    if(!this.over){
      ctx.save();
      if(this.player.shield>0){const pul=1+Math.sin(this.time*10)*0.08; ctx.globalAlpha=0.55; ctx.strokeStyle='#7cf0ff'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(this.player.cx,this.player.cy,(this.player.w/2+14)*pul,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;}
      if(this.player.tilt===1 || this.player.speed>0){
        const flameIdx=Math.floor(this.time*10)%2;
        const flame=ASSETS.effect[flameIdx];
        if(flame){const fw=30, fh=50; ctx.drawImage(flame,this.player.cx-fw/2,this.player.y+this.player.h-10,fw,fh);}
      }
      const scale=1+Math.floor(this.combo/6)*0.08; // lips grow with combo - fun
      const pImg=ASSETS.player[this.player.tilt] || ASSETS.player[0];
      if(pImg){
        ctx.translate(this.player.cx,this.player.cy);
        ctx.scale(scale,scale);
        ctx.drawImage(pImg,-this.player.w/2,-this.player.h/2,this.player.w,this.player.h);
      }
      ctx.restore();
    }
    this.blasts.forEach(b=>{
      ctx.globalAlpha=b.life/22*0.5;
      ctx.strokeStyle='#ff7eb3'; ctx.lineWidth=4; ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='rgba(255,126,179,0.12)'; ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;
    });
    this.explosions.forEach(ex=>{
      const img=ASSETS.effect[2+ex.frame];
      if(img) ctx.drawImage(img,ex.x-ex.size/2,ex.y-ex.size/2,ex.size,ex.size);
    });
    ctx.restore();
  }
}

let game=null;
function loop(){
  if(!game){requestAnimationFrame(loop);return;}
  game.update(); game.draw();
  document.getElementById('t').textContent=game.time.toFixed(1)+'s';
  document.getElementById('sc').textContent=Math.floor(game.score);
  document.getElementById('cc').textContent=game.cans;
  document.getElementById('mult').textContent='x'+(1+Math.floor(game.combo/3));
  document.getElementById('ff').style.width=game.player.fuel+'%';
  document.getElementById('ff').style.background=game.player.fuel<25?'linear-gradient(90deg,#ff2e63,#ff7e00)':'linear-gradient(90deg,#00ff88,#ffe600)';
  const hDiv=document.getElementById('hearts'); hDiv.innerHTML='';
  for(let i=0;i<game.player.maxH;i++){const d=document.createElement('div'); d.className='h'+(i>=Math.ceil(game.player.health)?' empty':''); hDiv.appendChild(d);}
  document.getElementById('abcd').style.height= game.blastCd>0 ? (game.blastCd/150*100)+'%' : '0%';
  document.getElementById('dashCd').style.height= game.dashCd>0 ? (game.dashCd/120*100)+'%' : '0%';
  if(game.over && document.getElementById('over').style.display==='none'){
    setTimeout(()=>{
      document.getElementById('over').style.display='flex';
      document.getElementById('fs').textContent=Math.floor(game.score);
      document.getElementById('ft').textContent=game.time.toFixed(1)+'s';
      document.getElementById('fc').textContent=game.cans;
      document.getElementById('fcombo').textContent='x'+game.maxCombo;
      document.getElementById('fdock').textContent=game.docked;
    },400);
  }
  requestAnimationFrame(loop);
}

async function init(){
  await loadAll();
  drawPreview();
  game=new Game();
  loop();
  window.addEventListener('keydown',e=>{
    if(e.code==='Space') game.useBlast();
    if(e.code==='ShiftLeft' || e.code==='KeyX') game.useDash();
  });
  document.getElementById('ab').addEventListener('pointerdown',()=>game.useBlast());
  document.getElementById('dashBtn').addEventListener('pointerdown',()=>game.useDash());
  document.getElementById('play').addEventListener('click',()=>{document.getElementById('menu').style.display='none'; game.reset(); document.getElementById('over').style.display='none';});
  document.getElementById('retry').addEventListener('click',()=>{document.getElementById('over').style.display='none'; game.reset();});
  document.getElementById('toMenu').addEventListener('click',()=>{document.getElementById('over').style.display='none'; document.getElementById('menu').style.display='flex'; game.reset();});
}
init();
</script>
</body>
</html>
"""

final_html = html.replace("__B64JSON__", json_str)

with open("index.html","w") as out:
    out.write(final_html)

print(f"Wrote ULTRA game: {len(final_html)/1024/1024:.2f} MB")
