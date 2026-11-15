// CONTRACT: native-pixel enemy artwork and equipment, facing left. No gameplay state.
// Each drawing uses an ink contour, broad material planes and upper-left light.
const INK = '#17121f';
export const palettes = {
  orc: { i: INK, d: '#364332', g: '#596538', G: '#889344', h: '#bbc35f', a: '#462c27', A: '#704734', c: '#a7794c', C: '#c79c68', m: '#b5a080', M: '#e5d7ac', p: '#fff0c9', s: '#49565a', S: '#839392', w: '#c4cfbd', f: '#222326', F: '#394039' },
  golem: { i: INK, d: '#36352f', s: '#504c40', S: '#746e58', l: '#999077', L: '#bbb18e', h: '#e0d3a7', o: '#b44d21', O: '#ef8a28', y: '#ffcf64', m: '#3e4b29', M: '#748346', c: '#b0bd79', C: '#e4e7b6' },
  ogre: { i: INK, d: '#4c4e37', g: '#747956', G: '#9c9e6b', h: '#c0bd84', a: '#493029', A: '#75503c', c: '#a77d52', C: '#d3aa71', m: '#bcac8e', M: '#eee0b8', s: '#63685b', S: '#a8ad93' },
  gnome: { i: INK, r: '#8b303d', R: '#bd4a47', h: '#ec805b', d: '#92553f', s: '#cf9463', S: '#f2c78b', b: '#9f9e8d', B: '#ddd8bd', p: '#fff0d2', l: '#384c48', L: '#60776a', a: '#45302d', A: '#805b42', c: '#bd9760', w: '#c4cfbd' },
};

// Hand-placed stepped polygons; no sampling or tracing of reference pixels.
function drawing(w, h) {
  const rows = Array.from({ length: h }, () => Array(w).fill('.'));
  const dot = (x, y, key) => { if (x >= 0 && y >= 0 && x < w && y < h) rows[y][x] = key; };
  const rect = (x, y, width, height, key) => {
    for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) dot(xx, yy, key);
  };
  const line = (x0, y0, x1, y1, key) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let n = 0; n <= steps; n++) dot(Math.round(x0 + (x1 - x0) * n / (steps || 1)), Math.round(y0 + (y1 - y0) * n / (steps || 1)), key);
  };
  const poly = (points, key) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let inside = false;
      for (let a = 0, b = points.length - 1; a < points.length; b = a++) {
        const [ax, ay] = points[a], [bx, by] = points[b];
        if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
      }
      if (inside) dot(x, y, key);
    }
    points.forEach(([x, y], n) => line(x, y, ...points[(n + 1) % points.length], key));
  };
  const rock = (x, y, width, height, tone = 'S') => {
    poly([[x + 3,y],[x + width - 3,y],[x + width,y + 3],[x + width - 1,y + height - 2],[x + width - 4,y + height],[x + 2,y + height - 1],[x,y + height - 4],[x + 1,y + 2]], 'i');
    poly([[x + 3,y + 1],[x + width - 3,y + 1],[x + width - 1,y + 3],[x + width - 2,y + height - 3],[x + width - 4,y + height - 1],[x + 2,y + height - 2],[x + 1,y + height - 4],[x + 2,y + 3]], 's');
    poly([[x + 3,y + 1],[x + width - 3,y + 1],[x + width - 2,y + 3],[x + width - 4,y + height - 3],[x + 2,y + height - 3],[x + 2,y + 3]], tone);
    poly([[x + 3,y + 1],[x + width - 3,y + 1],[x + width - 2,y + 3],[x + width - 5,y + 4],[x + 2,y + 3]], 'l');
    line(x + 3,y + 1,x + width - 4,y + 1,'L');
    line(x + 2,y + 3,x + 2,y + Math.min(5,height - 3),'L');
    line(x + width - 2,y + 4,x + width - 3,y + height - 3,'d');
    if (height > 8) line(x + 4,y + height - 4,x + 6,y + height - 3,'s');
  };
  return { dot, rect, line, poly, rock, finish: () => rows.map(row => row.join('')) };
}

function orc() {
  const p = drawing(34, 38), { poly, rect, line, dot } = p;
  // Wide stance, folded leather boots and pale fur cuffs.
  poly([[9,25],[16,25],[15,34],[14,37],[4,37],[5,34],[8,33]], 'i');
  poly([[20,25],[26,25],[28,33],[30,35],[29,37],[20,37],[19,34]], 'i');
  poly([[10,26],[15,26],[13,32],[8,32]], 'G'); poly([[21,26],[25,26],[27,32],[21,32]], 'g');
  rect(7,32,8,3,'a'); rect(20,32,8,3,'a'); line(7,32,14,33,'m'); line(21,32,27,32,'m'); dot(8,32,'M'); dot(11,33,'M'); dot(22,32,'M'); dot(25,33,'m');
  line(6,35,12,35,'A'); line(21,35,28,35,'A'); dot(7,34,'c'); dot(22,34,'c'); line(9,34,13,34,'A'); line(23,34,26,34,'A'); dot(6,36,'c'); dot(22,36,'c');
  // Deltoids and forearms surround a broad tapering torso.
  poly([[9,9],[14,8],[22,8],[28,10],[31,14],[33,22],[30,25],[26,23],[24,19],[23,25],[10,25],[9,20],[6,25],[2,24],[1,21],[3,14],[6,11]], 'i');
  poly([[7,11],[12,10],[13,14],[9,17],[6,16],[4,20],[2,20],[4,14]], 'G');
  poly([[7,11],[11,11],[10,13],[5,15]], 'h');
  poly([[25,10],[28,12],[30,16],[27,18],[24,15]], 'g'); line(26,11,28,13,'G');
  poly([[10,13],[16,10],[22,11],[26,15],[23,24],[12,24],[9,19]], 'g');
  poly([[11,12],[16,11],[16,16],[12,17],[9,16]], 'G'); line(11,12,15,12,'h');
  poly([[18,11],[22,12],[24,15],[21,17],[18,16]], 'G'); line(19,12,22,13,'h');
  line(11,16,15,17,'d'); line(18,16,21,17,'d');
  rect(14,18,3,2,'G'); rect(18,18,3,2,'G'); rect(14,21,3,2,'G'); rect(18,21,2,2,'G');
  line(12,18,12,21,'d'); line(22,18,21,22,'d');
  poly([[3,19],[7,18],[8,21],[6,24],[3,23]], 'g'); line(3,20,4,22,'h');
  poly([[28,18],[31,18],[32,22],[29,23],[27,21]], 'G');
  // Leather wrist wrap leaves the gripping fingers exposed.
  line(3,18,7,19,'a'); line(3,19,6,20,'A'); dot(4,19,'c');
  // Broad cloth sash with its leather edge, fastening and a ragged tabard.
  poly([[24,9],[27,10],[23,16],[14,24],[11,23],[18,17]], 'a');
  poly([[24,10],[26,10],[22,16],[13,23],[12,22],[19,16]], 'M');
  line(24,11,20,16,'p'); dot(22,15,'m'); line(19,17,14,21,'m');
  rect(22,13,3,3,'s'); dot(23,13,'w'); dot(23,14,'c'); dot(24,15,'w');
  poly([[10,23],[24,23],[27,30],[22,31],[17,30],[10,31],[8,29]], 'a');
  line(10,25,24,25,'A'); line(11,27,10,29,'c'); line(23,27,24,29,'A');
  poly([[14,25],[21,25],[21,31],[19,33],[18,31],[16,33],[14,30]], 'm');
  poly([[14,26],[18,26],[18,30],[16,32],[15,29]], 'M'); line(16,26,16,29,'p');
  rect(10,23,14,2,'a'); line(11,23,23,23,'c'); rect(16,23,3,2,'C'); dot(17,24,'a');
  // Small angled head: black knot, low brow, nose and heavy underbite.
  poly([[14,3],[20,3],[23,6],[21,10],[18,12],[14,10],[12,7]], 'i');
  poly([[14,5],[19,4],[21,6],[20,9],[16,10],[13,8]], 'G');
  line(14,5,18,5,'h'); line(13,6,16,6,'d'); dot(14,7,'p'); dot(18,7,'i');
  rect(12,8,3,1,'G'); rect(14,9,7,2,'f'); dot(14,9,'p'); dot(19,9,'M'); dot(16,10,'F'); rect(16,11,4,1,'f'); dot(17,12,'i');
  rect(17,1,4,3,'f'); rect(18,0,2,1,'i'); dot(18,1,'F'); rect(16,3,5,1,'i');
  return p.finish();
}

function golem() {
  const p = drawing(44, 50), { rock, line, poly, dot } = p;
  // Asymmetric ankle, knee and thigh stones leave daylight between the legs.
  rock(10,30,10,11); rock(25,30,9,11,'l');
  rock(9,38,10,9,'l'); rock(27,38,9,9);
  rock(6,44,13,5); rock(26,44,13,5,'l');
  rock(6,16,8,14); rock(31,17,8,13);
  rock(10,13,25,17); rock(15,27,15,9);
  rock(2,10,14,13,'S'); rock(29,10,13,13);
  // Separate breast stones, ribs and waist plates, never one rectangular slab.
  rock(11,12,14,11,'S'); rock(23,13,11,11,'S');
  poly([[13,14],[20,14],[23,17],[21,20],[14,18]],'l'); line(14,14,19,14,'L');
  line(15,17,20,19,'s'); line(26,16,30,15,'l');
  rock(15,22,9,7); rock(24,23,7,6,'l');
  rock(17,29,10,6,'l');
  line(11,39,14,40,'d'); dot(14,41,'s'); line(29,40,31,42,'d');
  // Small embedded head and deep glowing eye sockets.
  rock(17,4,12,10); rock(19,2,8,4,'l');
  line(18,7,22,7,'i'); line(24,7,27,7,'i'); line(19,8,21,8,'O'); line(24,8,26,8,'O');
  dot(20,8,'y'); dot(25,8,'y'); line(21,10,24,10,'d');
  // Branching molten seams follow the fractured plates across the torso.
  for (const [x0,y0,x1,y1] of [[14,18,20,20],[20,20,24,22],[24,22,21,25],[21,25,24,29],[24,29,21,32],[24,22,29,20]]) {
    line(x0,y0 + 1,x1,y1 + 1,'d'); line(x0,y0,x1,y1,'O');
  }
  dot(21,21,'y'); dot(23,23,'y'); dot(22,27,'y');
  // Moss droops over the right shoulder beneath a pale mineral cluster.
  poly([[30,10],[33,8],[39,10],[40,14],[37,15],[35,14],[34,17],[32,14],[30,14]], 'm');
  line(31,11,37,11,'M'); dot(33,10,'c'); dot(37,12,'M'); dot(32,13,'M'); dot(35,13,'c'); dot(34,15,'M'); dot(38,14,'M');
  poly([[33,10],[32,5],[34,2],[37,7],[36,11]], 'i');
  poly([[34,9],[33,5],[34,3],[36,7],[35,10]], 'c'); line(34,4,34,7,'C');
  poly([[36,11],[37,4],[40,1],[41,5],[39,11]], 'i');
  poly([[37,10],[38,5],[40,3],[40,6],[38,10]], 'c'); line(38,5,39,4,'C');
  return p.finish();
}

function fist() {
  const p = drawing(18, 24), { rock, line, dot } = p;
  rock(4,0,11,11,'S'); rock(1,8,16,14,'S');
  line(4,13,4,17,'d'); line(8,12,8,17,'d'); line(12,12,12,16,'d');
  dot(4,11,'l'); dot(8,11,'L'); dot(12,11,'l'); dot(2,18,'s'); dot(15,18,'d'); line(4,19,5,20,'s'); line(10,19,11,20,'s');
  return p.finish();
}

function gnome() {
  const p = drawing(18, 22), { poly, rect, line, dot } = p;
  poly([[5,17],[8,17],[8,21],[2,21],[3,19]],'i'); poly([[11,17],[14,17],[16,21],[10,21]],'i');
  rect(4,19,3,1,'A'); rect(11,19,3,1,'A');
  poly([[5,10],[12,10],[15,13],[16,17],[12,18],[6,18],[2,16],[3,12]],'i');
  poly([[5,11],[12,12],[14,16],[10,17],[5,16],[3,15]],'l'); line(4,13,6,12,'L');
  rect(5,16,8,1,'a'); dot(9,16,'c'); dot(2,14,'S');
  poly([[6,5],[12,5],[13,10],[10,13],[5,11],[3,8]],'i');
  rect(5,7,7,3,'s'); line(5,7,9,7,'S'); rect(3,9,3,1,'S'); dot(5,8,'i'); dot(9,8,'i');
  poly([[5,10],[8,11],[12,10],[12,13],[9,16],[6,14]],'b');
  poly([[5,10],[7,11],[11,11],[9,14],[7,13]],'B'); line(6,10,6,12,'p');
  poly([[3,6],[6,3],[9,0],[11,1],[11,4],[14,6],[13,7],[3,7]],'i');
  poly([[4,6],[7,3],[9,1],[10,2],[10,4],[12,6]],'r'); line(5,5,9,2,'R'); line(5,6,11,6,'h'); dot(8,4,'h'); line(10,4,11,5,'r');
  return p.finish();
}

function ogre() {
  const p = drawing(36,42), { poly, rect, line, dot } = p;
  poly([[9,30],[16,31],[15,40],[13,41],[3,41],[3,38],[7,36]],'i');
  poly([[22,31],[29,30],[31,37],[34,38],[33,41],[23,41]],'i');
  poly([[9,32],[14,33],[12,38],[5,39],[8,36]],'g'); poly([[23,32],[28,32],[30,38],[25,39]],'g');
  line(6,39,12,39,'G'); line(25,39,31,39,'G');
  poly([[11,9],[24,9],[31,12],[34,20],[35,27],[31,29],[27,25],[28,32],[23,35],[12,35],[7,31],[8,25],[4,29],[0,26],[1,17],[5,12]],'i');
  poly([[6,13],[12,11],[11,19],[7,23],[5,27],[2,25],[3,18]],'g');
  poly([[5,15],[8,13],[10,13],[9,17],[5,20]],'G'); line(5,15,8,14,'h'); line(4,21,6,20,'d'); line(3,24,5,24,'G');
  poly([[25,11],[30,14],[32,20],[33,26],[30,27],[27,21],[24,19]],'g');
  poly([[12,11],[23,11],[27,18],[27,29],[23,33],[12,33],[8,29],[9,19]],'g');
  poly([[12,13],[18,12],[17,18],[11,19]],'G'); poly([[20,13],[24,15],[25,19],[20,18]],'G');
  poly([[12,21],[18,19],[24,22],[25,28],[20,31],[13,30],[10,26]],'G');
  line(13,22,17,21,'h'); dot(19,27,'d'); line(10,19,15,19,'d'); line(21,19,25,20,'d'); line(28,18,30,19,'d'); line(30,23,31,25,'G');
  poly([[10,29],[26,29],[29,34],[24,35],[20,34],[15,36],[8,34]],'a');
  line(10,30,26,30,'c'); rect(17,30,3,2,'C'); dot(18,31,'a'); line(12,32,11,34,'A'); line(24,32,25,34,'A');
  poly([[12,2],[20,1],[24,5],[24,10],[20,14],[13,13],[10,9],[10,5]],'i');
  poly([[13,3],[20,2],[22,5],[22,10],[19,12],[14,11],[11,8]],'g');
  line(13,3,18,3,'G'); rect(12,6,4,1,'d'); rect(19,6,3,1,'d'); dot(13,7,'M'); dot(20,7,'M');
  rect(10,8,5,2,'G'); line(14,10,21,10,'d'); dot(14,10,'M'); dot(21,10,'M'); dot(15,11,'M');
  line(12,2,16,1,'a'); line(17,1,20,2,'a');
  return p.finish();
}

function axe() {
  const p = drawing(15,32), { poly, line } = p;
  line(7,3,7,31,'i'); line(8,3,8,31,'a'); line(7,9,7,30,'c');
  poly([[1,0],[4,3],[6,4],[8,4],[11,3],[13,0],[14,4],[14,9],[12,13],[9,10],[7,9],[5,10],[2,13],[0,9],[0,4]],'i');
  poly([[1,2],[4,5],[6,5],[6,8],[4,9],[2,11],[1,8]],'S');
  poly([[9,5],[11,4],[13,2],[13,9],[12,11],[10,9],[9,8]],'s');
  line(2,4,3,6,'w'); line(11,5,12,4,'S'); line(1,3,1,8,'w'); line(2,9,2,10,'w'); line(13,3,13,8,'w'); line(12,9,12,10,'S');
  line(7,4,7,9,'S'); line(8,5,8,8,'w');
  return p.finish();
}
function shield() {
  const p = drawing(17,19), { poly, line, rect, dot } = p;
  poly([[5,0],[11,0],[15,3],[16,7],[16,12],[13,17],[10,18],[5,18],[1,14],[0,9],[1,4]],'i');
  poly([[5,1],[11,1],[14,4],[15,8],[15,12],[12,16],[10,17],[5,17],[2,13],[1,9],[2,5]],'s');
  poly([[5,2],[10,2],[13,5],[14,9],[13,13],[10,16],[6,16],[3,13],[2,9],[3,5]],'a');
  line(5,3,4,13,'c'); line(6,3,6,15,'A'); line(9,3,9,15,'A'); line(12,5,12,12,'A');
  line(4,2,2,5,'w'); line(2,6,2,8,'S'); dot(5,1,'w'); dot(11,2,'S'); dot(13,14,'S');
  poly([[7,6],[10,7],[11,10],[9,12],[6,11],[5,8]],'i');
  rect(7,7,3,4,'s'); line(7,7,9,7,'w'); dot(6,8,'S'); dot(8,8,'S');
  return p.finish();
}
export const sprites = { gnome: gnome(), orc: orc(), ogre: ogre(), golem: golem() };
export const equipment = { axe: axe(), shield: shield(), fist: fist() };
