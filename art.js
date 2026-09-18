/* Source art stays intact. These are texture-atlas regions, not regenerated images. */
const CourtArt = (() => {
  const regions = {
    lion:['collection',8,632,350,330],
    modeArcade:['ui',22,580,260,202], modeTime:['ui',292,580,260,202], modeSudden:['ui',558,580,259,202],
    classic:['collection',14,39,183,181], graffiti:['collection',195,38,172,182],
    royal:['collection',372,38,173,182], carnival:['collection',546,39,181,181],
    neon:['collection',724,38,180,182], fire:['collection',899,38,182,182],
    star:['collection',1076,39,177,181], crystal:['collection',1254,38,182,182],
    perfect:['effects',1151,713,287,183], combo:['effects',894,733,249,152]
  };
  const sheets = {};
  const ready = Promise.all(['collection','ui','effects'].map(name => new Promise(resolve => {
    const img = new Image(); sheets[name] = img;
    img.onload = resolve; img.onerror = resolve; img.src = `assets/atlas/${name}.png`;
  })));
  function paint(ctx, name, x, y, w, h) {
    const region = regions[name]; if (!region) return;
    const [sheet,sx,sy,sw,sh] = region, img = sheets[sheet];
    if (img?.naturalWidth) {
      ctx.save();
      if(['classic','graffiti','royal','carnival','neon','fire','star','crystal'].includes(name)) {
        ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.clip();
      }
      ctx.drawImage(img,sx,sy,sw,sh,x,y,w,h);ctx.restore();
    }
  }
  function canvas(name, size = 180) {
    const el = document.createElement('canvas'); const r=regions[name];
    el.width=size; el.height=r ? Math.round(size*r[4]/r[3]) : size;
    el.setAttribute('aria-hidden','true');
    ready.then(()=>paint(el.getContext('2d'),name,0,0,el.width,el.height)); return el;
  }
  ready.then(()=>document.querySelectorAll('canvas[data-art]').forEach(el=>{
    const r=regions[el.dataset.art]; if(!r)return;
    el.width=r[3];el.height=r[4];paint(el.getContext('2d'),el.dataset.art,0,0,el.width,el.height);
  }));
  return {ready,paint,canvas};
})();
