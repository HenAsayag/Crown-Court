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
