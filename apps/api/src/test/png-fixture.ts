import { deflateSync } from 'node:zlib';

/**
 * 시험용 PNG 만들기 — 그림 지문(dHash) 시험이 쓴다. 새 의존성 없이 `node:zlib`와 손으로
 * 짠 CRC32로 만든다(`zlib.crc32`는 Node 22.2부터라 CI 버전에 기대지 않는다).
 */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** RGB 8비트 PNG. 줄마다 필터를 0 → 1 → 2 → 3 → 4로 돌린다. */
export function encodeRgbPng(width: number, height: number, rgb: (x: number, y: number) => [number, number, number]): Buffer {
  const bpp = 3;
  const stride = width * bpp;
  const rows: Buffer[] = [];
  let previous = Buffer.alloc(stride);

  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };

  for (let y = 0; y < height; y += 1) {
    const line = Buffer.alloc(stride);
    for (let x = 0; x < width; x += 1) line.set(rgb(x, y), x * bpp);

    const filter = y % 5;
    const out = Buffer.alloc(stride + 1);
    out[0] = filter;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= bpp ? line[i - bpp]! : 0;
      const up = previous[i]!;
      const upLeft = i >= bpp ? previous[i - bpp]! : 0;
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter]!;
      out[i + 1] = (line[i]! - predictor) & 0xff;
    }
    rows.push(out);
    previous = line;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 깊이
  ihdr[9] = 2; // RGB

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
