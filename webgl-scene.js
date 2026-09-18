/* GPU scene: static artwork is uploaded once; geometry and effects move on the GPU.
   Canvas is used only to prepare masked artwork and text textures, never a game frame. */
function drawWebGL(r, dt) {
  if (!r.begin(cv.width, cv.height, SCALE, Shake.x, Shake.y)) return;
  const court = equippedCourt(), backdrop = IMG.courtsAtlas || IMG[court.img];
  if (backdrop?.width) {
    const sw = 1206, sh = 337, scale = Math.max((W + 16) / sw, (H + 16) / sh);
    r.sprite(backdrop, (W - sw * scale) / 2, (H - sh * scale) / 2, sw * scale, sh * scale,
      {sx:330, sy:[0,344,686][court.panel], sw, sh});
  } else r.rect(0, 0, W, H, '#2a1820');
  r.rect(0, 0, W, H, court.tint);
  // A small cached grading texture, stretched by the GPU to any screen size.
  r.sprite(webGLGrade(), 0, 0, W, H);
  const origin = hoopOrigin(), c = CONFIG.HOOP, layers = HoopArt.layers(IMG.hoop, c);
  const width = c.SPRITE_W, height = c.SOURCE_H * width / c.SOURCE_W;
  if (layers) r.sprite(layers.back, origin.x, origin.y, width, height);
  drawWebGLGuide(r);
  for (const o of objs) {
    if (!o.alive) continue;
    drawWebGLTrail(r, o);
    if (o.kind === 'ball') drawWebGLBall(r, o);
    else if (o.kind === 'bomb') drawWebGLBomb(r, o);
    else drawWebGLCrown(r, o);
  }
  if (layers) {
    const anchor = c.RIM.cy * height, stretch = Math.max(.9, 1 + hoop.net / 600);
    r.sprite(layers.front, origin.x + (hoop.netSide || 0) * .35,
      origin.y + anchor + hoop.flex - anchor * stretch, width, height * stretch);
  }
  const rimY = hoop.y + hoop.flex;
  if (hoop.pulse > 0) {
    const k = hoop.pulse / CONFIG.JUICE.SCORE_PULSE;
    r.ellipse(hoop.x, rimY, rimRX() * (1 + (1-k)*1.5), rimRY() * (1+(1-k)*3.2), '#ffc83d', k*.85, 3+9*k, true);
    r.glow(hoop.x, rimY+18, rimRX()*1.3, '#fff0be', k*.55);
    if (hoop.clean) r.sprite(CourtArt.texture('perfect'), hoop.x-110, rimY-148-(1-k)*30, 220, 140, {alpha:k});
  }
  if (hoop.wide > 1) r.ellipse(hoop.x, rimY, rimRX(), rimRY()*1.6, '#8ef5a0', .85, 5);
  drawWebGLParticles(r);
  drawWebGLTrick(r, dt);
  for (const p of POPS) {
    const k = p.t / p.life;
    r.text(p.text, p.x, p.y-CONFIG.JUICE.POP_RISE*easeOutCubic(k), {
      size:p.size, color:p.c, font:FONT, scale:k<.15?easeOutBack(k/.15):1,
      alpha:k>.68?1-(k-.68)/.32:1});
  }
  if (G.overtime) {
    r.rect(0,0,W,H,'#ffc83d',.10+.05*Math.sin(G.elapsed*5));
    r.text('OVERTIME  '+Math.ceil(G.overtimeT), W/2,210,{size:26,color:'#ffd23f',font:FONT});
  }
  r.end();
}

let webGLGradeTexture;
function webGLGrade() {
  if (webGLGradeTexture) return webGLGradeTexture;
  const canvas=document.createElement('canvas'); canvas.width=1; canvas.height=256;
  const g=canvas.getContext('2d'), gradient=g.createLinearGradient(0,0,0,256);
  for (const [stop,alpha] of [[0,.55],[.22,.08],[.78,.05],[1,.6]]) gradient.addColorStop(stop,`rgba(8,3,10,${alpha})`);
  g.fillStyle=gradient; g.fillRect(0,0,1,256);
  return webGLGradeTexture=canvas;
}

function drawWebGLGuide(r) {
  const o=stroke.grab;
  if (!o || o.kind!=='ball' || G.state!==ST.PLAY) return;
  const v=strokeVelocity(), sw=CONFIG.SWIPE;
  if(nowSec()-(stroke.pts.at(-1)?.t || 0)>.12 || v.sp<sw.RELEASE_MIN)return;
  const power=Math.min(v.sp*sw.RELEASE_POWER*equippedBall().power,sw.MAX_IMPULSE);
  let x=o.x,y=o.y,vx=v.vx/v.sp*power,vy=v.vy/v.sp*power-power*sw.LIFT;
  const b=boardRect();
  for(let i=0;i<24;i++){
    vy+=CONFIG.PHYSICS.GRAVITY*o.grav*.025;x+=vx*.025;y+=vy*.025;
    if(y>H || x<o.r || x>W-o.r)break;
    if(x+o.r>b.x && x-o.r<b.x+b.w && y+o.r>b.y && y-o.r<b.y+b.h)break;
    if([-1,1].some(s=>Math.hypot(x-hoop.x-s*rimRX(),y-hoop.y-hoop.flex)<o.r+CONFIG.HOOP.LIP_R))break;
    r.ellipse(x,y,3.5-i*.07,3.5-i*.07,'#ffe79a',(1-i/24)*.8);
  }
}

function drawWebGLTrail(r,o) {
  for(let i=0;i<o.trail.length;i++) {
    const t=i/o.trail.length,p=o.trail[i],radius=p.r*(.3+t*.7);
    r.ellipse(p.x,p.y,radius,radius,o.kind==='bomb'?'#ff7043':'#ffd23f',t*.45,0,true);
  }
  const image=o.kind==='ball'?IMG[equippedBall().trail]:o.kind==='bomb'?IMG.trailSmoke:IMG.trailWarm;
  if(image?.width && o.trail.length>4) {
    const speed=Math.hypot(o.vx,o.vy),len=clamp(speed*.12,90,260);
    r.sprite(image,o.x,o.y,len,len*.44,{anchorX:10/len,anchorY:.5,
      rotation:Math.atan2(o.vy,o.vx)+Math.PI,alpha:clamp(speed/2400,0,.85),additive:true});
  }
}

function drawWebGLBall(r,o) {
  const def=equippedBall(),level=styleLevel(o),speed=Math.hypot(o.vx,o.vy);
  r.ellipse(o.x+5,o.y+o.r*.82,o.r*.9,o.r*.32,'#000',.28);
  if(level>0) {
    const col=CONFIG.STYLE.COLOURS[level],pulse=.6+.4*Math.sin(G.elapsed*(6+level*2)+o.id);
    r.glow(o.x,o.y,o.r*(1.7+level*.16),col,.3+.06*level);
    r.ellipse(o.x,o.y,o.r+7+pulse*4,o.r+7+pulse*4,col,.55+.08*level,2+level*.7,true);
    if(!o.dying && Math.random()<.12*level) spawnP({x:o.x+rand(-o.r,o.r),y:o.y+rand(-o.r,o.r),
      vx:rand(-40,40),vy:rand(-90,-20),r:rand(2,4.5),life:rand(.25,.5),c:col,g:-40});
  }
  if(o.comboCarrier && G.combo>0) r.glow(o.x,o.y,o.r*1.65,'#ffc83d',.45);
  const image=def.art?CourtArt.texture(def.art):(IMG[def.sprite]||IMG.ball);
  const pop=o.age<.22?easeOutBack(clamp(o.age/.22,0,1)):1;
  const stretch=1+clamp(speed/5200,0,.26),land=o.squash>0?1-o.squash*.35:1;
  // Affine flight squash is independent of the texture's spin.
  if(image?.width) r.sprite(image,o.x,o.y,o.r*2*pop,o.r*2*pop,{anchorX:.5,anchorY:.5,rotation:o.rot,
    stretchX:stretch,stretchY:land/stretch,stretchRotation:Math.atan2(o.vy,o.vx)});
  else r.ellipse(o.x,o.y,o.r*pop,o.r*pop,'#e07a2b');
  if(level>0 && !o.dying) r.text('x'+styleMult(o).toFixed(1),o.x,o.y+o.r+16,
    {size:15+level,color:CONFIG.STYLE.COLOURS[level],font:FONT,stroke:5});
  if(o.held) r.ellipse(o.x,o.y,o.r+12,o.r+12,'#fff4e0',.95,4);
  if(o.alleyOop) {
    const radius=o.r+9+Math.sin(G.elapsed*12)*3;
    r.ellipse(o.x,o.y,radius,radius,'#b98cff',.9,4);
  }
}

function drawWebGLBomb(r,o) {
  const radius=o.r,pulse=.5+.5*Math.sin(G.elapsed*9+o.id);
  r.ellipse(o.x,o.y,radius+10+pulse*5,radius+10+pulse*5,'#ff3b5c',.35+.45*pulse,4+pulse*3);
  r.ellipse(o.x,o.y,radius,radius,'#11131a');
  r.glow(o.x-radius*.32,o.y-radius*.38,radius*.9,'#737b8d',.55);
  r.ellipse(o.x,o.y,radius,radius,'#07080b',1,5);
  const skull=radius*.44;
  r.ellipse(o.x,o.y-skull*.18,skull,skull,'#f5f5f5');
  r.rect(o.x-skull*.52,o.y+skull*.52,skull*1.04,skull*.5,'#f5f5f5');
  for(const side of [-1,1]) r.ellipse(o.x+side*skull*.38,o.y-skull*.24,skull*.3,skull*.3,'#0a0b0f');
  r.rect(o.x-skull*.12,o.y+skull*.18,skull*.24,skull*.3,'#0a0b0f');
  for(const side of [-.34,.18]) r.rect(o.x+side*skull,o.y+skull*.6,skull*.16,skull*.34,'#0a0b0f');
  r.rect(o.x-radius*.26,o.y-radius*1.18,radius*.52,radius*.38,'#ffc83d');
  for(let i=0;i<9;i++) {
    const t=i/8;
    r.ellipse(o.x+radius*(.84*t*(1-t)+.16*t*t),o.y-radius*(1.16+.92*t-.22*t*t),2.5,2.5,'#c9a227');
  }
  r.glow(o.x+radius*.16,o.y-radius*1.86,(6+pulse*5)*2.2,'#ffb340',1);
}

function drawWebGLCrown(r,o) {
  const image=IMG['crown'+o.tier[0].toUpperCase()+o.tier.slice(1)]||IMG.crown,d=o.r*2.3;
  r.glow(o.x,o.y,d*.9,o.tier==='gold'?'#ffd23c':o.tier==='silver'?'#e1ebfa':'#e18c46',.45);
  if(image?.width)r.sprite(image,o.x,o.y,d,d*140/163,{anchorX:.5,anchorY:.5,rotation:Math.sin(G.elapsed*3+o.id)*.22});
}

function drawWebGLParticles(r) {
  for(const p of P) {
    const k=1-p.t/p.life;
    if(p.shape==='sprite' && p.img) {
      const s=p.r*(.55+(1-k)*.85);
      r.sprite(p.img,p.x,p.y,s,s,{anchorX:.5,anchorY:.5,rotation:p.rot,alpha:Math.min(1,k*1.6),additive:true});
    } else if(p.shape==='rect' || p.shape==='spark') {
      const spark=p.shape==='spark';
      r.sprite(webGLWhite(),p.x,p.y,spark?p.r*3.4*k:p.r*2,spark?p.r*.6:p.r,
        {anchorX:spark?0:.5,anchorY:.5,rotation:spark?Math.atan2(p.vy,p.vx):p.rot,alpha:k,color:p.c});
    } else r.ellipse(p.x,p.y,p.r*k,p.r*k,p.c,k);
  }
}
let webGLWhiteTexture;
function webGLWhite() {
  if(webGLWhiteTexture)return webGLWhiteTexture;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const g=canvas.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,1,1);
  return webGLWhiteTexture=canvas;
}

function drawWebGLTrick(r,dt) {
  if(trickCall.t<=0)return;
  trickCall.t=Math.max(0,trickCall.t-dt);
  const k=1-trickCall.t/trickCall.life,out=clamp((k-.78)/.22,0,1);
  const scale=easeOutBack(clamp(k/.18,0,1))*(1-out*.25),alpha=1-out;
  if(IMG.sparkle?.width)r.sprite(IMG.sparkle,210,H-110,300*scale,300*scale,
    {anchorX:.5,anchorY:.5,rotation:k*1.2,alpha:alpha*.85,additive:true});
  r.text(trickCall.name,210,H-110,{size:46,color:trickCall.colour,scale,alpha,font:FONT,stroke:11});
}
