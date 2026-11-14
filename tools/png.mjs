// Write RGBA bytes (w * h * 4) as a PNG, scaled up k times with hard pixels. Node only, no dependencies.
import zlib from "node:zlib";
import fs from "node:fs";

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const v of buf) c = TABLE[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4), sum = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type), data]);
  len.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, sum]);
};

export function writePng(path, rgba, w, h, k = 3) {
  const row = w * k * 4 + 1, raw = Buffer.alloc(row * h * k);
  for (let y = 0; y < h * k; y++)
    for (let x = 0; x < w * k; x++) {
      const s = (((y / k) | 0) * w + ((x / k) | 0)) * 4, d = y * row + 1 + x * 4;
      raw[d] = rgba[s]; raw[d + 1] = rgba[s + 1]; raw[d + 2] = rgba[s + 2]; raw[d + 3] = rgba[s + 3];
    }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w * k, 0);
  head.writeUInt32BE(h * k, 4);
  head[8] = 8;
  head[9] = 6;
  fs.writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
