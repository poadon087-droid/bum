import json, base64, glob, os

# Load base64 data
with open("assets_base64.json","r") as f:
    b64data=json.load(f)

# Build JS object literal
# We'll create a JS file content
html_template = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>SPUDNIK - Potato Survival</title>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Bangers&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;user-select:none;-webkit-user-select:none;}
body{background:#060610;overflow:hidden;font-family:'Fredoka',sans-serif;touch-action:none;}
#wrap{position:relative;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,#1e1e40 0%,#060610 100%);}
canvas{background:#08081a;display:block;box-shadow:0 0 0 4px #000;border-radius:16px;max-width:100vw;max-height:100vh;}
#ui{position:absolute;inset:0;pointer-events:none;display:flex;flex-direction:column;justify-content:space-between;padding:12px;max-width:900px;margin:0 auto;}
.top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.stats{display:flex;gap:6px;flex-wrap:wrap;}
.pill{background:#fff;border:3px solid #000;border-radius:999px;padding:5px 12px;color:#000;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:3px 3px 0 #000;font-size:12px;}
.fuel{width:90px;height:10px;background:#000;border-radius:999px;overflow:hidden;border:2px solid #000;}
.fuelFill{height:100%;width:100%;background:linear-gradient(90deg,#00ff88,#ffe600);}
.hearts{display:flex;gap:4px;}
.h{width:22px;height:22px;background:#ff2e63;border:2px solid #000;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;transform:rotate(-45deg);position:relative;}
.h::after{content:'♥';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(45deg);color:#fff;font-size:12px;}
.h.empty{background:#222;} .h.empty::after{color:#444;}
.bottom{display:flex;justify-content:flex-end;align-items:flex-end;}
.ability{width:62px;height:62px;background:#fff;border:3px solid #000;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:4px 4px 0 #000;position:relative;cursor:pointer;pointer-events:auto;}
.ability:active{transform:scale(0.92);}
.cd{position:absolute;bottom:0;left:0;width:100%;background:rgba(0,0,0,0.7);border-radius:0 0 14px 14px;}
#menu,#over{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,6,16,0.94);pointer-events:auto;flex-direction:column;z-index:10;padding:20px;text-align:center;}
#over{display:none;}
.title{font-family:'Bangers';font-size:clamp(48px,10vw,90px);color:#ffb800;-webkit-text-stroke:3px #000;text-shadow:6px 6px 0 #000;letter-spacing:2px;line-height:0.9;}
.btn{background:#ffb800;border:4px solid #000;border-radius:999px;padding:12px 32px;font-family:'Bangers';font-size:30px;color:#000;cursor:pointer;box-shadow:6px 6px 0 #000;margin-top:18px;}
.btn:active{transform:translate(3px,3px);box-shadow:3px 3px 0 #000;}
.btn.s{background:#7cf0ff;font-size:22px;padding:10px 20px;}
.bigScore{font-family:'Bangers';font-size:60px;-webkit-text-stroke:2px #000;text-shadow:4px 4px 0 #000;}
.comboPop{position:absolute;left:50%;top:28%;transform:translateX(-50%);font-family:'Bangers';font-size:30px;color:#fff;-webkit-text-stroke:2px #000;text-shadow:4px 4px 0 #000;pointer-events:none;animation:combo 0.6s ease-out;}
@keyframes combo{0%{transform:translateX(-50%) scale(0.5) translateY(20px);opacity:0}50%{transform:translateX(-50%) scale(1.2);opacity:1}100%{transform:translateX(-50%) scale(1) translateY(-20px);opacity:0}}
</style>
</head>
<body>
<div id="wrap">
<canvas id="c" width="900" height="600"></canvas>
<div id="ui">
<div class="top">
<div class="stats">
<div class="pill">⏱ <span id="t">0.0</span></div>
<div class="pill">⭐ <span id="sc">0</span></div>
<div class="pill">🥫 <span id="cc">0</span> <span id="mult" style="background:#000;color:#ffe600;border-radius:999px;padding:2px 6px;font-size:10px;">x1</span></div>
</div>
<div class="stats">
<div class="pill">FUEL <div class="fuel"><div id="ff" class="fuelFill"></div></div></div>
<div id="hearts" class="hearts"></div>
</div>
</div>
<div class="bottom">
<div id="ab" class="ability">💋<div id="abcd" class="cd" style="height:0%"></div></div>
</div>
</div>
<div id="menu">
<div class="title">SPUDNIK</div>
<canvas id="prev" width="200" height="200" style="width:110px;height:110px;background:#fff;border:4px solid #000;border-radius:20px;box-shadow:6px 6px 0 #000;margin:14px;"></canvas>
<button id="play" class="btn">PLAY 🥔</button>
</div>
<div id="over">
<div class="title" style="font-size:54px;">SPUD DOWN!</div>
<div id="fs" class="bigScore">0</div>
<div style="margin:8px 0;"><canvas id="overPrev" width="200" height="200" style="width:90px;height:90px;background:#fff;border:3px solid #000;border-radius:16px;"></canvas></div>
<div style="background:#fff;border:3px solid #000;border-radius:12px;padding:8px 14px;color:#000;font-size:12px;box-shadow:4px 4px 0 #000;">Time: <b id="ft">0</b> • Cans: <b id="fc">0</b> • Combo: <b id="fcombo">x1</b></div>
<div style="display:flex;gap:10px;margin-top:12px;"><button id="retry" class="btn">RETRY</button><button id="toMenu" class="btn s">MENU</button></div>
</div>
</div>
<script>
const B64 = __B64JSON__;

function loadImg(src){return new Promise((res,rej)=>{const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src;});}
let ASSETS={};
async function loadAll(){
  for(const k in B64){
    const parts=k.split('_');
    // group by prefix
    // e.g., player_0 -> group player
  }
  // reorganize by type
  const groups={player:[],powerup:[],asteroid:[],enemy:[],effect:[],potato_float:[],ui:[]};
  for(const name in B64){
    const src=B64[name];
    const img=await loadImg(src);
    if(name.startsWith('player_')) groups.player[parseInt(name.split('_')[1])]=img;
    else if(name.startsWith('powerup_')) groups.powerup[parseInt(name.split('_')[1])]=img;
    else if(name.startsWith('asteroid_')) groups.asteroid[parseInt(name.split('_')[1])]=img;
    else if(name.startsWith('enemy_')) groups.enemy[parseInt(name.split('_')[1])]=img;
    else if(name.startsWith('effect_')) groups.effect[parseInt(name.split('_')[1])]=img;
    else if(name.startsWith('potato_float_')) groups.potato_float[parseInt(name.split('_')[1])]=img;
    else if(name.startsWith('ui_')) groups.ui[parseInt(name.split('_')[1])]=img;
  }
  ASSETS=groups;
  console.log('Loaded cropped transparent assets',ASSETS);
}

const canvas=document.getElementById('c');
const ctx=canvas.getContext('2d');
const W=900,H=600;
let keys={}, mouse={x:W/2,y:H/2,down:false};
window.addEventListener('keydown',e=>{keys[e.code]=true; if(['Space','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();});
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
  const maxW=window.innerWidth-12, maxH=window.innerHeight-12;
  const ratio=W/H;
  let nw=maxW, nh=nw/ratio;
  if(nh>maxH){nh=maxH;nw=nh*ratio;}
  canvas.style.width=nw+'px';
  canvas.style.height=nh+'px';
}
window.addEventListener('resize',resize); resize();

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
    this.stars=[]; for(let i=0;i<150;i++) this.stars.push({x:Math.random()*W,y:Math.random()*H,s:Math.random()*2+0.3,sp:Math.random()*1.2+0.2,tw:Math.random()*6});
    this.time=0; this.score=0; this.cans=0; this.combo=0; this.comboT=0; this.maxCombo=1;
    this.blastCd=0; this.shake=0; this.over=false;
  }
  useBlast(){
    if(this.blastCd>0 || this.player.fuel<8 || this.over) return;
    this.blastCd=150; this.player.fuel-=8; this.shake=14;
    for(let i=0;i<22;i++){const a=Math.random()*Math.PI*2, sp=Math.random()*5+2; this.particles.push(new Particle(this.player.cx,this.player.cy,Math.cos(a)*sp,Math.sin(a)*sp,28,'#ff7eb3',6));}
    const R=160;
    [...this.asteroids,...this.enemies].forEach(e=>{
      const dx=e.cx-this.player.cx, dy=e.cy-this.player.cy, d=Math.hypot(dx,dy);
      if(d<R+60){e.vx+=dx/d*8; e.vy+=dy/d*8; e.hp=(e.hp||1)-1; if(e.hp<=0) this.boom(e,true);}
    });
    this.blasts.push({x:this.player.cx,y:this.player.cy,r:24,maxR:R,life:22});
  }
  boom(en,score){
    en.dead=true;
    if(score){this.score+=120*(1+Math.floor(this.combo/3)); this.combo++; this.comboT=140; this.maxCombo=Math.max(this.maxCombo,this.combo); this.showCombo();}
    this.explosions.push({x:en.cx,y:en.cy,frame:0,t:0,size:Math.max(en.w,en.h)*1.2});
    for(let i=0;i<14;i++){const a=Math.random()*Math.PI*2, sp=Math.random()*5+1; const col=en.isAst?'#a88c6a':'#ff4d6d'; this.particles.push(new Particle(en.cx,en.cy,Math.cos(a)*sp,Math.sin(a)*sp,32+Math.random()*18,col,Math.random()*4+2));}
    this.shake=Math.max(this.shake,7);
  }
  showCombo(){
    if(this.combo<3) return;
    const el=document.createElement('div'); el.className='comboPop'; el.textContent=`COMBO x${this.combo}!`;
    document.getElementById('wrap').appendChild(el); setTimeout(()=>el.remove(),600);
  }
  spawn(){
    const t=this.time;
    const astRate=0.022 + t*0.00014;
    const eneRate=0.007 + t*0.00007;
    const powRate=0.01;
    if(Math.random()<astRate){
      const sz=34+Math.random()*42;
      const a=new Ent(Math.random()*(W-sz),-sz,sz,sz);
      a.vy=2.2+Math.random()*3 + t*0.025; a.vx=(Math.random()-0.5)*1.6;
      a.rot=Math.random()*6.28; a.rotSp=(Math.random()-0.5)*0.09;
      a.type=Math.floor(Math.random()*ASSETS.asteroid.length); a.isAst=true; a.hp=1+Math.floor(t/18);
      this.asteroids.push(a);
    }
    if(Math.random()<eneRate){
      const sz=38+Math.random()*20;
      const e=new Ent(Math.random()*(W-sz),-sz,sz,sz);
      e.vy=1.6+Math.random()*2.2 + t*0.018; e.vx=(Math.random()-0.5)*1.2;
      e.type=Math.floor(Math.random()*ASSETS.enemy.length); e.hp=2;
      this.enemies.push(e);
    }
    if(Math.random()<powRate){
      const sz=36;
      const p=new Ent(Math.random()*(W-sz),-sz,sz,sz);
      p.vy=1.9+Math.random()*1.3; p.vx=(Math.random()-0.5)*0.9;
      p.type=Math.floor(Math.random()*3); p.bob=0;
      this.powerups.push(p);
    }
  }
  update(){
    if(this.over) return;
    this.time+=1/60; this.spawn();
    if(this.comboT>0) this.comboT--; else this.combo=0;
    this.player.fuel-=0.045 + (this.player.speed>0?0.07:0);
    if(this.player.fuel<=0){this.player.fuel=0; if(Math.random()<0.025) this.player.health-=0.015;}
    if(this.blastCd>0) this.blastCd--;
    if(this.player.shield>0) this.player.shield--;
    if(this.player.speed>0) this.player.speed--;
    if(this.player.magnet>0) this.player.magnet--;
    let mx=0,my=0;
    if(keys['ArrowLeft']||keys['KeyA']) mx=-1;
    if(keys['ArrowRight']||keys['KeyD']) mx=1;
    if(keys['ArrowUp']||keys['KeyW']) my=-1;
    if(keys['ArrowDown']||keys['KeyS']) my=1;
    if(mouse.down){const dx=mouse.x-this.player.cx, dy=mouse.y-this.player.cy; const d=Math.hypot(dx,dy); if(d>10){mx=dx*0.018; my=dy*0.018;}}
    const spd=this.player.speed>0?6.8:4.4;
    this.player.vx+=mx*0.75; this.player.vy+=my*0.75;
    this.player.vx*=0.86; this.player.vy*=0.86;
    const v=Math.hypot(this.player.vx,this.player.vy);
    if(v>spd){this.player.vx=this.player.vx/v*spd; this.player.vy=this.player.vy/v*spd;}
    this.player.x+=this.player.vx; this.player.y+=this.player.vy;
    this.player.x=Math.max(0,Math.min(W-this.player.w,this.player.x));
    this.player.y=Math.max(0,Math.min(H-this.player.h,this.player.y));
    if(Math.abs(this.player.vx)>1.2) this.player.tilt=this.player.vx>0?3:2;
    else if(this.player.vy<-1) this.player.tilt=1;
    else this.player.tilt=0;
    this.stars.forEach(s=>{s.y+=s.sp + (this.player.speed>0?2.5:0); s.tw+=0.02; if(s.y>H){s.y=-5;s.x=Math.random()*W;}});
    this.asteroids.forEach(a=>{a.x+=a.vx;a.y+=a.vy;a.rot+=a.rotSp; if(a.y>H+120) a.dead=true;});
    this.enemies.forEach(e=>{e.x+=e.vx;e.y+=e.vy; if(e.type===0){const dx=this.player.cx-e.cx, dy=this.player.cy-e.cy, d=Math.hypot(dx,dy); if(d<240){e.vx+=dx/d*0.09; e.vy+=dy/d*0.09;}} if(e.y>H+120) e.dead=true;});
    this.powerups.forEach(p=>{if(this.player.magnet>0){const dx=this.player.cx-p.cx, dy=this.player.cy-p.cy, d=Math.hypot(dx,dy); if(d<200){p.vx+=dx/d*0.28; p.vy+=dy/d*0.28;}} p.x+=p.vx; p.y+=p.vy; p.bob+=0.13; if(p.y>H+120) p.dead=true;});
    this.blasts.forEach(b=>{b.life--; b.r+=7;}); this.blasts=this.blasts.filter(b=>b.life>0);
    this.explosions.forEach(ex=>{ex.t++; if(ex.t>5){ex.t=0; ex.frame++;}}); this.explosions=this.explosions.filter(ex=>ex.frame<4);
    this.particles.forEach(p=>p.update()); this.particles=this.particles.filter(p=>p.life>0);
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
    this.score+= (0.18 + this.time*0.012)*(1+Math.floor(this.combo/3));
  }
  gameOver(){this.over=true; this.shake=22; for(let i=0;i<28;i++){const a=Math.random()*6.28, sp=Math.random()*6+2; this.particles.push(new Particle(this.player.cx,this.player.cy,Math.cos(a)*sp,Math.sin(a)*sp,48,'#ffb800',5));}}
  draw(){
    ctx.save();
    if(this.shake>0){ctx.translate((Math.random()-0.5)*this.shake,(Math.random()-0.5)*this.shake); this.shake*=0.9; if(this.shake<0.6) this.shake=0;}
    ctx.fillStyle='#08081a'; ctx.fillRect(0,0,W,H);
    const g=ctx.createRadialGradient(W*0.5,H*0.25,0,W*0.5,H*0.25,H);
    g.addColorStop(0,'rgba(130,90,255,0.18)'); g.addColorStop(0.6,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    this.stars.forEach(s=>{ctx.globalAlpha=0.6+Math.sin(s.tw)*0.4; ctx.fillStyle='#fff'; ctx.beginPath();ctx.arc(s.x,s.y,s.s,0,Math.PI*2);ctx.fill();});
    ctx.globalAlpha=1;
    this.particles.forEach(p=>p.draw(ctx));
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
    if(!this.over){
      ctx.save();
      if(this.player.shield>0){const pul=1+Math.sin(this.time*10)*0.08; ctx.globalAlpha=0.55; ctx.strokeStyle='#7cf0ff'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(this.player.cx,this.player.cy,(this.player.w/2+14)*pul,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;}
      if(this.player.tilt===1 || this.player.speed>0){
        const flameIdx=Math.floor(this.time*10)%2;
        const flame=ASSETS.effect[flameIdx];
        if(flame){const fw=30, fh=50; ctx.drawImage(flame,this.player.cx-fw/2,this.player.y+this.player.h-10,fw,fh);}
      }
      const pImg=ASSETS.player[this.player.tilt] || ASSETS.player[0];
      if(pImg) ctx.drawImage(pImg,this.player.x,this.player.y,this.player.w,this.player.h);
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
  if(game.over && document.getElementById('over').style.display==='none'){
    setTimeout(()=>{
      document.getElementById('over').style.display='flex';
      document.getElementById('fs').textContent=Math.floor(game.score);
      document.getElementById('ft').textContent=game.time.toFixed(1)+'s';
      document.getElementById('fc').textContent=game.cans;
      document.getElementById('fcombo').textContent='x'+game.maxCombo;
    },400);
  }
  requestAnimationFrame(loop);
}

async function init(){
  await loadAll();
  drawPreview();
  game=new Game();
  loop();
  window.addEventListener('keydown',e=>{if(e.code==='Space') game.useBlast();});
  document.getElementById('ab').addEventListener('pointerdown',()=>game.useBlast());
  document.getElementById('play').addEventListener('click',()=>{document.getElementById('menu').style.display='none'; game.reset(); document.getElementById('over').style.display='none';});
  document.getElementById('retry').addEventListener('click',()=>{document.getElementById('over').style.display='none'; game.reset();});
  document.getElementById('toMenu').addEventListener('click',()=>{document.getElementById('over').style.display='none'; document.getElementById('menu').style.display='flex'; game.reset();});
}
init();
</script>
</body>
</html>
"""

# inject json
with open("assets_base64.json","r") as f:
    json_str=f.read()

final_html = html_template.replace("__B64JSON__", json_str)

with open("index.html","w") as out:
    out.write(final_html)

print(f"Wrote final embedded game: {len(final_html)/1024/1024:.2f} MB")
