/* The supplied hoop artwork is a texture. Two complementary canvas masks let
   a scored ball pass behind the front iron and net without moving the board. */
const HoopArt = (() => {
  const foreground = [[745,660],[1177,657],[1145,774],[1080,1001],[829,1001],[805,788]];
  function path(g) {
    foreground.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();
  }
  function prepare(g,img,origin,c) {
    if(!img?.width)return false;
    g.save();g.translate(origin.x,origin.y);
    const scale=c.SPRITE_W/c.SOURCE_W;g.scale(scale,scale);return true;
  }
  function back(g,img,origin,c) {
    if(!prepare(g,img,origin,c))return;
    g.beginPath();g.rect(0,0,c.SOURCE_W,c.SOURCE_H);path(g);g.clip('evenodd');
    g.drawImage(img,0,0,c.SOURCE_W,c.SOURCE_H);g.restore();
  }
  function front(g,img,origin,c,hoop) {
    if(!prepare(g,img,origin,c))return;
    const scale=c.SPRITE_W/c.SOURCE_W, anchor=c.RIM.cy*c.SOURCE_H;
    g.translate((hoop.netSide||0)*.35/scale,anchor+hoop.flex/scale);
    g.scale(1,Math.max(.9,1+hoop.net/600));g.translate(0,-anchor);
    g.beginPath();path(g);g.clip();g.drawImage(img,0,0,c.SOURCE_W,c.SOURCE_H);g.restore();
  }
  return {back,front};
})();
