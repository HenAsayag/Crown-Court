import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

// Run the actual engine with inert DOM/audio adapters; no browser state or player save is touched.
const source=readFileSync(new URL('../game.js',import.meta.url),'utf8').replace(/boot\(\);\s*$/,'');
const gpuScene=readFileSync(new URL('../webgl-scene.js',import.meta.url),'utf8');
export function engine(gpu=null){
  const noop=()=>{};
  const drawing=new Proxy({createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop})},{get:(t,k)=>t[k]||noop});
  const element=()=>({style:{},classList:{add:noop,remove:noop,toggle:noop},dataset:{},children:[],value:'',textContent:'',
    addEventListener:noop,setAttribute:noop,appendChild:noop,remove:noop,focus:noop,querySelector:()=>element(),
    querySelectorAll:()=>[],getContext:()=>drawing,getBoundingClientRect:()=>({x:0,y:0,left:0,top:0,width:1280,height:720})});
  const elements=new Map();
  const document={getElementById:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)},
    querySelectorAll:()=>[],createElement:element,addEventListener:noop,hidden:false};
  const context=vm.createContext({document,window:{addEventListener:noop,removeEventListener:noop},navigator:{},
    localStorage:{getItem:()=>null,setItem:noop},performance:{now:()=>1000},requestAnimationFrame:noop,
    setTimeout:()=>1,clearTimeout:noop,structuredClone,console,Math:Object.create(Math),CourtArt:{paint:noop},
    CourtGL:gpu?{create:()=>gpu}:undefined,assert});
  vm.runInContext('Math.random=()=>.5;',context);
  vm.runInContext(source,context);
  vm.runInContext(gpuScene,context);
  vm.runInContext('startRun("time"); G.spawnT=999;',context);
  return code=>vm.runInContext(code,context);
}

test('waves run at 70% of the old frequency throughout the difficulty ramp',()=>{
  engine()(`
    for(const [difficulty,oldInterval] of [[0,1.08],[.5,.81],[1,.54]]) {
      G.difficulty=difficulty;
      for(const overtime of [false,true]) {
        G.overtime=overtime;
        const previous=oldInterval*(overtime?.72:1);
        assert.ok(Math.abs(previous/spawnInterval()-.7)<1e-9);
      }
    }
  `);
});

test('held upward tosses are gentler and bounded while near-hoop flicks retain power',()=>{
  engine()(`
    const o=makeObject('ball',hoop.x,hoop.y+100,0,0);o.spin=0;
    const v={vx:0,vy:-1000,sp:1000};
    const soft=heldLaunch(o,v),flick=shotVelocity(o,v,CONFIG.SWIPE.POWER);
    assert.ok(soft.vy < -500 && soft.vy > -550);
    assert.ok(Math.abs(soft.vy)<Math.abs(flick.vy)*.7);
    const fast=heldLaunch(o,{vx:0,vy:-10000,sp:10000});
    assert.ok(Math.abs(fast.vy)<=1093);
  `);
});

for(const [id,start,path] of [
  ['crossover',[800,300],[[920,300],[680,300],[920,300]]],
  ['doublepump',[800,400],[[800,280],[800,430],[800,280]]],
  ['orbit',[900,300],Array.from({length:48},(_,i)=>[800+100*Math.cos((i+1)*Math.PI/24),300+100*Math.sin((i+1)*Math.PI/24)])]
]) test(id+' rewards an actual carried gesture and a downward finish exactly once',()=>{
  engine()(`
    const o=makeObject('ball',${start[0]},${start[1]},0,0);objs.push(o);
    grabObject(o,{x:o.x,y:o.y});
    for(const [x,y] of ${JSON.stringify(path)})dragTo({x,y});
    assert.equal(o.handTricks['${id}'],true);
    assert.equal(G.score,0);
    dragTo({x:hoop.x,y:hoop.y-80});dragTo({x:hoop.x,y:hoop.y+30});
    assert.equal(G.dunks,1);assert.equal(G.trickCounts['${id}'],1);
    assert.ok(G.score>CONFIG.SCORE.DUNK);
    const points=G.score;scoreDunk(o);assert.equal(G.score,points);
    assert.equal(pickGrab({x:o.x,y:o.y}),null);
  `);
});

test('finger jitter and pointer circles blocked by the board earn no handling bonus',()=>{
  engine()(`
    const o=makeObject('ball',800,300,0,0);objs.push(o);grabObject(o,{x:o.x,y:o.y});
    for(let i=0;i<120;i++)dragTo({x:800+5*Math.cos(i),y:300+5*Math.sin(i)});
    assert.equal(Object.keys(o.handTricks).length,0);
    const b=boardRect();o.x=b.x+b.w+o.r+1;o.y=b.y+80;
    grabObject(o,{x:o.x,y:o.y});
    for(let i=0;i<60;i++)dragTo({x:b.x-200+100*Math.cos(i),y:o.y+5*Math.sin(i)});
    assert.equal(Object.keys(o.handTricks).length,0);
  `);
});

test('retraced straight lines are not a 360, but a circle after repositioning is',()=>{
  engine()(`
    const o=makeObject('ball',800,300,0,0);objs.push(o);grabObject(o,{x:o.x,y:o.y});
    for(const [x,y] of [[1000,300],[800,300],[800,100],[800,300]])dragTo({x,y});
    assert.ok(!o.handTricks.orbit);
    o.x=1050;o.y=300;grabObject(o,{x:o.x,y:o.y});dragTo({x:900,y:300});
    for(let i=1;i<=48;i++)dragTo({x:800+100*Math.cos(i*Math.PI/24),y:300+100*Math.sin(i*Math.PI/24)});
    assert.equal(o.handTricks.orbit,true);
  `);
});

test('self alley-oop requires real airtime and an elevated recatch before scoring',()=>{
  engine()(`
    const o=makeObject('ball',hoop.x,hoop.y+100,0,0);o.spin=0;objs.push(o);
    grabObject(o,{x:o.x,y:o.y});
    stroke.pts=[{x:o.x,y:o.y+60,t:.94},{x:o.x,y:o.y,t:1}];releaseGrab();
    for(let i=0;i<18;i++){G.elapsed+=1/60;stepObjects(1/60);}
    assert.equal(G.dunks,0);assert.ok(o.y<hoop.y+10);
    grabObject(o,{x:o.x,y:o.y});assert.equal(o.handTricks.selfoop,true);
    dragTo({x:hoop.x,y:hoop.y-60});dragTo({x:hoop.x,y:hoop.y+20});
    assert.equal(G.trickCounts.selfoop,1);assert.equal(G.dunks,1);
  `);
});

test('immediate recatches and ordinary falling catches are not self alley-oops',()=>{
  engine()(`
    const o=makeObject('ball',800,500,0,0);objs.push(o);grabObject(o,{x:o.x,y:o.y});
    stroke.pts=[{x:800,y:560,t:.94},{x:800,y:500,t:1}];releaseGrab();
    grabObject(o,{x:o.x,y:o.y});assert.ok(!o.handTricks.selfoop);
    o.held=false;G.elapsed+=1;o.y=300;
    grabObject(o,{x:o.x,y:o.y});assert.ok(!o.handTricks.selfoop);
  `);
});

test('a separate flick invalidates a pending self alley-oop release',()=>{
  engine()(`
    const o=makeObject('ball',800,500,0,0);objs.push(o);grabObject(o,{x:o.x,y:o.y});
    stroke.pts=[{x:800,y:560,t:.94},{x:800,y:500,t:1}];releaseGrab();
    assert.ok(o.toss);G.elapsed+=1;o.y=550;
    applySwipe(o,o.x,o.y,{vx:0,vy:-1000,sp:1000});
    G.elapsed+=.3;o.y=300;grabObject(o,{x:o.x,y:o.y});
    assert.ok(!o.handTricks.selfoop);
  `);
});

test('score and explosion haptics are distinct, protected from taps, and optional',()=>{
  engine()(`
    const pulses=[];navigator.vibrate=p=>{pulses.push(p);return true;};SAVE.muted=false;
    const o=makeObject('ball',hoop.x,hoop.y,0,300);o.manual=true;scoreDunk(o);
    assert.equal(pulses.at(-1),28);haptic(6);assert.equal(pulses.length,1);
    const bomb=makeObject('bomb',800,300,0,0);detonate(bomb,true);
    assert.equal(JSON.stringify(pulses.at(-1)),'[120,45,160]');
    haptic(28,1);assert.equal(pulses.length,2);
    SAVE.muted=true;haptic(90,2);assert.equal(pulses.length,2);
    SAVE.muted=false;delete navigator.vibrate;haptic(90,2);
    navigator.vibrate=()=>{throw Error('unsupported');};haptic(90,2);
  `);
});
test('WebGL scene keeps the ball between the backboard and front net without changing score',()=>{
  const run=engine();
  run(`
    const calls=[];
    const r={begin:()=>true,end:()=>calls.push('end'),rect:()=>{},ellipse:()=>{},glow:()=>{},text:()=>{},
      sprite:image=>{if(image)calls.push(image.name)}};
    CourtArt.texture=()=>({width:100,name:'ball'});
    globalThis.HoopArt={layers:()=>({back:{name:'back'},front:{name:'net'}})};
    IMG.hoop={width:1448};
    const o=makeObject('ball',hoop.x,hoop.y,0,0);o.age=1;objs.push(o);
    const before=G.score;drawWebGL(r,0);
    assert.ok(calls.indexOf('back')<calls.indexOf('ball'));
    assert.ok(calls.indexOf('ball')<calls.indexOf('net'));
    assert.equal(calls.at(-1),'end');assert.equal(G.score,before);
  `);
});

test('WebGL scene skips all rendering during GPU context loss',()=>{
  const run=engine();
  run(`drawWebGL({begin:()=>false},.016);`);
});

test('GPU loss blocks new games and resume until graphics are restored',()=>{
  const gpu={lost:false},run=engine(gpu);
  run('pause();');gpu.lost=true;
  run(`resume();assert.equal(G.state,ST.PAUSED);startRun('arcade');assert.equal(G.mode,'time');`);
  gpu.lost=false;run('resume();assert.equal(G.state,ST.PLAY);');
});

test('a downward ball scores once and keeps falling through the net',()=>{
  const run=engine();
  run(`const o=makeObject('ball',hoop.x,hoop.y-8,0,400);o.swiped=true;objs.push(o);stepObjects(.05);
    assert.equal(G.dunks,1);assert.ok(o.scored);assert.ok(o.dying>0);
    const points=G.score;checkThroughRim(o,hoop.y-1);scoreDunk(o);assert.equal(G.score,points);`);
});
test('upward entry and a ball wider than the opening do not score',()=>{
  const run=engine();
  run(`const up=makeObject('ball',hoop.x,hoop.y-1,0,-400);checkThroughRim(up,hoop.y+10);assert.equal(G.dunks,0);
    const edge=makeObject('ball',hoop.x+rimRX()-10,hoop.y+1,0,300);checkThroughRim(edge,hoop.y-2);assert.equal(G.dunks,0);`);
});
test('high speed shots bounce off the board without tunnelling',()=>{
  const run=engine();
  run(`const b=boardRect();const o=makeObject('ball',b.x+b.w+100,b.y+80,-2400,0);o.spin=0;objs.push(o);stepObjects(.05);
    assert.ok(o.hitBoard>0);assert.ok(o.vx>0);assert.ok(o.x-o.r>=b.x+b.w-.01);assert.equal(G.dunks,0);`);
});
test('the physical rim rejects a fast off-centre shot',()=>{
  const run=engine();
  run(`const o=makeObject('ball',hoop.x+rimRX(),hoop.y-85,0,2400);o.spin=0;objs.push(o);stepObjects(.05);
    assert.ok(o.hitRim>0);assert.ok(o.vy<0);assert.equal(G.dunks,0);`);
});
test('held balls cannot teleport across the board or sideways through the rim',()=>{
  const run=engine();
  run(`const b=boardRect();const o=makeObject('ball',b.x+b.w+100,b.y+80,0,0);objs.push(o);grabObject(o,{x:o.x,y:o.y});
    dragTo({x:b.x-100,y:o.y});assert.ok(o.x-o.r>=b.x+b.w-.01);assert.equal(G.dunks,0);
    o.x=hoop.x+rimRX()+90;o.y=hoop.y;dragTo({x:hoop.x,y:hoop.y});
    assert.ok(o.x>hoop.x+rimRX());assert.equal(G.dunks,0);`);
});
test('a deliberate downward hand dunk enters through the opening',()=>{
  const run=engine();
  run(`const o=makeObject('ball',hoop.x,hoop.y-80,0,0);objs.push(o);grabObject(o,{x:o.x,y:o.y});
    stroke.pts=[{x:hoop.x,y:hoop.y-80,t:.97},{x:hoop.x,y:hoop.y+40,t:1}];
    dragTo({x:hoop.x,y:hoop.y+40});assert.equal(G.dunks,1);assert.ok(o.manual);assert.equal(stroke.grab,null);`);
});
test('stopping before release drops the ball without stale velocity',()=>{
  const run=engine();
  run(`const o=makeObject('ball',400,300,1200,-1200);objs.push(o);grabObject(o,{x:400,y:300});
    stroke.pts=[{x:400,y:300,t:.1}];releaseGrab();assert.equal(o.vx,0);assert.equal(o.vy,0);`);
});
test('pause releases the held ball and freezes gameplay time',()=>{
  const run=engine();
  run(`const o=makeObject('ball',400,300,0,0);objs.push(o);grabObject(o,{x:400,y:300});pause();
    const elapsed=G.elapsed,time=G.timeLeft;update(20);assert.equal(G.elapsed,elapsed);assert.equal(G.timeLeft,time);
    assert.equal(stroke.grab,null);assert.equal(o.held,false);resume();assert.equal(G.state,ST.PLAY);`);
});
test('Soft Touch changes restitution without resizing the hoop',()=>{
  const run=engine();
  run(`const radius=rimRX();G.helperActive='soft';hoop.wide=1.5;assert.equal(rimRX(),radius);
    const o=makeObject('ball',hoop.x-rimRX(),hoop.y-40,0,500);collideHoop(o);
    assert.ok(Math.abs(o.vy)<200);assert.equal(rimRX(),radius);`);
});
test('the buzzer grace period is bounded even with a ball still airborne',()=>{
  const run=engine();
  run(`G.timeLeft=0;G.buzzerT=1.19;const o=makeObject('ball',300,100,0,100);objs.push(o);update(.02);
    assert.ok(G.ended);assert.equal(G.state,ST.OVER);`);
});

test('a hand dunk counts when the latest movement turns down but averaged velocity still points up',()=>{
  const run=engine();
  run(`const o=makeObject('ball',hoop.x,hoop.y-8,0,0);objs.push(o);grabObject(o,{x:o.x,y:o.y});
    stroke.pts=[{x:hoop.x,y:hoop.y+100,t:.93},{x:hoop.x,y:hoop.y-8,t:.99},{x:hoop.x,y:hoop.y+12,t:1}];
    dragTo({x:hoop.x,y:hoop.y+12});assert.equal(G.dunks,1,'visually descending through the opening must count despite stale upward velocity');`);
});

test('the ball cannot pass inside the net after a rim deflection without a make',()=>{
  const run=engine();
  run(`let missed=[];
    for(const offset of [48,54,60,66,72,78])for(const vx of [-400,-250,-100,0]) {
      startRun('time');G.spawnT=999;
      const o=makeObject('ball',hoop.x+offset,hoop.y-60,vx,650);o.spin=0;o.swiped=true;objs.push(o);
      for(let frame=0;frame<35 && o.alive && !o.scored;frame++){
        stepObjects(1/120);
        if(o.y>hoop.y+12 && o.y<hoop.y+55 && Math.abs(o.x-hoop.x)<rimRX()-o.r-CONFIG.HOOP.LIP_R && !o.scored){missed.push({offset,vx,x:o.x-hoop.x,y:o.y-hoop.y});break;}
      }
    }
    assert.equal(missed.length,0,JSON.stringify(missed));`);
});

test('clear shots score at 20, 30, 60 and 120 FPS for every ball size',()=>{
  const run=engine();
  run(`for(const ball of BALLS)for(const fps of [20,30,60,120])for(const offset of [-25,0,25]){
    SAVE.ball=ball.id;startRun('time');G.spawnT=999;
    const o=makeObject('ball',hoop.x+offset,hoop.y-70,0,1800);o.spin=0;o.swiped=true;objs.push(o);
    for(let i=0;i<fps && !o.scored && o.alive;i++)stepObjects(1/fps);
    assert.equal(G.dunks,1,ball.id+' at '+fps+' FPS, offset '+offset);
  }`);
});

test('all ball variants rise from the right into a catchable arc without auto-scoring',()=>{
  const run=engine();
  run(`for(const ball of BALLS)for(const width of [936,1280,1728]){
    W=width;SAVE.ball=ball.id;startRun('time');G.spawnT=999;
    const o=throwObject('ball');assert.ok(o.x>W*.70);assert.ok(o.vx<0);assert.ok(o.vy<0);
    let apex=o.y;
    for(let i=0;i<300 && o.alive;i++){stepObjects(1/120);apex=Math.min(apex,o.y);}
    assert.ok(apex>100 && apex<340,'catchable apex '+apex);assert.equal(G.dunks,0);
  }`);
});

test('a ball nudged down through the opening by another ball scores once',()=>{
  const run=engine();
  run(`const lower=makeObject('ball',hoop.x,hoop.y-2,0,100);
    const upper=makeObject('ball',hoop.x,hoop.y-60,0,0);objs.push(lower,upper);
    collideObjects(.016);assert.equal(G.dunks,1);assert.ok(lower.scored);
    collideObjects(.016);assert.equal(G.dunks,1);`);
});

test('incoming balls reach the central catching lane on wide screens',()=>{
  const run=engine();
  run(`for(const width of [1280,1728]){
    W=width;startRun('time');const o=throwObject('ball');
    while(o.vy<0 && o.alive)stepObjects(1/120);
    assert.ok(o.x<W*.70,'apex stayed too far right: '+o.x+' / '+W);
    assert.ok(o.x>hoop.x+rimRX()+o.r,'toss should still need a player shot');
  }`);
});

test('a normal leftward flick from the catching lane reaches the basket',()=>{
  const run=engine();
  run(`const o=makeObject('ball',820,400,0,0);o.spin=0;objs.push(o);
    applySwipe(o,o.x,o.y,{vx:-900,vy:-180,sp:Math.hypot(900,180)});
    for(let i=0;i<300 && o.alive && !o.scored;i++)stepObjects(1/120);
    assert.equal(G.dunks,1,'ordinary hoop-directed flick should be playable');`);
});

test('QA: clean entries score exactly once across modes, skins, frame rates and speeds',()=>{
  const run=engine();
  run(`let count=0;
    for(const mode of ['time','arcade','sudden'])for(const ball of BALLS)
    for(const fps of [20,60,120])for(const speed of [180,900,2200])for(const offset of [-22,0,22]){
      SAVE.ball=ball.id;startRun(mode);G.spawnT=999;
      const o=makeObject('ball',hoop.x+offset,hoop.y-24,0,speed);o.spin=0;o.swiped=true;objs.push(o);
      for(let i=0;i<fps*2 && o.alive && !o.scored;i++)stepObjects(1/fps);
      assert.equal(G.dunks,1,JSON.stringify({mode,ball:ball.id,fps,speed,offset}));
      const score=G.score;checkThroughRim(o,hoop.y-1);scoreDunk(o);
      assert.equal(G.dunks,1);assert.equal(G.score,score);count++;
    }
    assert.equal(count,3*BALLS.length*3*3*3);`);
});

test('QA: hoop-directed flicks remain playable across court widths, skins and frame rates',()=>{
  const run=engine();
  run(`let misses=[];
    for(const width of [936,1280,1728])for(const ball of BALLS)for(const fps of [20,60,120])
    for(const speed of [600,900,1200]){
      W=width;SAVE.ball=ball.id;startRun('time');G.spawnT=999;
      const o=makeObject('ball',W*.68,400,0,0);o.spin=0;objs.push(o);
      applySwipe(o,o.x,o.y,{vx:-speed,vy:-speed*.2,sp:Math.hypot(speed,speed*.2)});
      for(let i=0;i<fps*3 && o.alive && !o.scored;i++)stepObjects(1/fps);
      if(G.dunks!==1)misses.push({width,ball:ball.id,fps,speed});
    }
    assert.deepEqual(misses,[]);`);
});

test('QA: upward entry, outside entry and a ball already below the rim do not score',()=>{
  const run=engine();
  run(`for(const mode of ['time','arcade','sudden'])for(const ball of BALLS){
    SAVE.ball=ball.id;startRun(mode);
    const up=makeObject('ball',hoop.x,hoop.y-5,0,-400);checkThroughRim(up,hoop.y+5);
    const outside=makeObject('ball',hoop.x+rimRX()+60,hoop.y+5,0,400);checkThroughRim(outside,hoop.y-5);
    const below=makeObject('ball',hoop.x,hoop.y+50,0,400);checkThroughRim(below,hoop.y+20);
    assert.equal(G.dunks,0);assert.equal(G.score,0);
  }`);
});

test('QA: taps, reverse throws, near-rim dunks and bomb swipes are not auto-aimed',()=>{
  const run=engine();
  run(`for(const [kind,x,y,vx,vy] of [['ball',820,400,900,-180],['ball',820,400,-100,0],
    ['ball',hoop.x+50,hoop.y-90,-400,700],['bomb',820,400,-900,-180]]){
    const o=makeObject(kind,x,y,0,0),sp=Math.hypot(vx,vy),v={vx,vy,sp};
    const launch=shotVelocity(o,v,CONFIG.SWIPE.POWER);
    const impulse=Math.min(sp*CONFIG.SWIPE.POWER*(kind==='ball'?equippedBall().power:1),CONFIG.SWIPE.MAX_IMPULSE);
    assert.ok(Math.abs(launch.vx-vx/sp*impulse)<.00001);
    assert.ok(Math.abs(launch.vy-(vy/sp*impulse-impulse*CONFIG.SWIPE.LIFT))<.00001);
  }`);
});

test('QA: the shared shot guide matches the actual held release trajectory',()=>{
  for(const helper of [null,'magnet']){
  const run=engine();
  run(`G.helperActive=${JSON.stringify(helper)};
    const o=makeObject('ball',820,400,0,0);objs.push(o);grabObject(o,{x:o.x,y:o.y});
    stroke.pts=[{x:856,y:407.2,t:.96},{x:820,y:400,t:1}];stroke.turn=.3;
    const points=shotGuidePoints();assert.ok(points.length>8);releaseGrab();
    for(const p of points){stepObjects(.025);assert.ok(Math.hypot(o.x-p.x,o.y-p.y)<.01);}
  `);
  }
});

test('QA: contact-completed baskets preserve the alley-oop bonus',()=>{
  const run=engine();
  run(`const lower=makeObject('ball',hoop.x,hoop.y-2,0,100);
    const upper=makeObject('ball',hoop.x,hoop.y-60,0,800);upper.lastSwipeT=G.elapsed;
    objs.push(lower,upper);collideObjects(.016);
    assert.equal(G.dunks,1);assert.ok(lower.alleyOop);assert.equal(G.trickCounts.alley,1);`);
});
