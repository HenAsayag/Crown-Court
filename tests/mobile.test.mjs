import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../mobile.js',import.meta.url),'utf8');
function mobile(requestFullscreen) {
  const button=()=>({textContent:'',attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v;},
    addEventListener(k,v){this.events[k]=v;}});
  const normal=[button(),button(),button()],full=[button()],status={textContent:''};
  const classes=new Set(),styles={},events={};
  const root={clientWidth:390,classList:{add:v=>classes.add(v)},
    style:{setProperty:(k,v)=>styles[k]=v},requestFullscreen};
  const context={document:{documentElement:root,getElementById:()=>status,
    querySelectorAll:s=>s==='[data-fullscreen]'?full:normal,addEventListener(){}},
    window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener:(k,v)=>events[k]=v},
    navigator:{},screen:{},setTimeout:()=>1,clearTimeout(){}};
  vm.runInNewContext(source,context);
  return {normal,full,status,classes,styles,events,root};
}
test('iPhone browser play needs no fullscreen API and synchronizes every entry button',()=>{
  const m=mobile();m.normal[0].events.click();
  assert.ok(m.classes.has('browser-play'));
  for(const b of m.normal)assert.equal(b.attrs['aria-pressed'],'true');
  assert.ok(m.status.textContent.includes('no fullscreen needed'));
  assert.equal(Number(m.styles['--browser-play-scale']),390/844);
  m.root.clientWidth=844;m.events.resize();
  assert.equal(Number(m.styles['--browser-play-scale']),1);
});
test('browser play never requests fullscreen even if a browser offers it',()=>{
  let calls=0;const m=mobile(()=>{calls++;});
  m.normal[1].events.click();m.normal[2].events.click();assert.equal(calls,0);
});
test('missing or rejected fullscreen leaves the browser-play option available',async()=>{
  for(const request of [undefined,()=>Promise.reject(Error('denied'))]){
    const m=mobile(request);await m.full[0].events.click();
    assert.ok(m.status.textContent.includes('Play without fullscreen'));
    assert.equal(m.full[0].disabled,false);
    m.normal[0].events.click();assert.ok(m.classes.has('browser-play'));
  }
});
