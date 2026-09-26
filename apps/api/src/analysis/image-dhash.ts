import { inflateSync } from 'node:zlib';

import { dHashFromGray } from './wedding-feed-diversity';

/**
 * 그림 지문(dHash)을 서버에서 잰다 — 새 의존성 없이, `node:zlib`만으로.
 *
 * **PNG만 읽는다.** 웨딩피드 이미지 모델(`gemini-2.5-flash-image`)이 PNG로 돌려준다
 * (2026-09-25 a276d9ed 이후 저장된 키가 전부 `.png`). JPEG · WebP를 순수 코드로 풀려면
 * 디코더를 통째로 짜야 해서 두지 않았다 — 그 형식이 오면 지문 없이(null) 저장하고
 * 계획(장소 · 구도 · 색 …)만으로 다르게 만든다. 로그에 남긴다.
 */

type Png = { width: number; height: number; gray: Uint8Array };

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** 한 픽셀이 차지하는 채널 수. 색 형식 번호는 PNG 명세 그대로다. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);

  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * PNG를 회색조 픽셀로 푼다. 못 읽는 꼴(깊이 8·16 밖 · 격행 · 깨진 파일)은 null이다 —
 * 지문은 «있으면 쓰는» 값이라, 못 잰다고 그림 저장을 막지 않는다.
 */
export function decodePngGray(bytes: Buffer): Png | null {
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(SIGNATURE)) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = -1;
  let interlace = 0;
  let palette: Buffer | null = null;
  const data: Buffer[] = [];

  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;

    if (end + 4 > bytes.length) return null;

    if (type === 'IHDR') {
      width = bytes.readUInt32BE(start);
      height = bytes.readUInt32BE(start + 4);
      depth = bytes[start + 8]!;
      colorType = bytes[start + 9]!;
      interlace = bytes[start + 12]!;
    } else if (type === 'PLTE') {
      palette = bytes.subarray(start, end);
    } else if (type === 'IDAT') {
      data.push(bytes.subarray(start, end));
    } else if (type === 'IEND') {
      break;
    }
    offset = end + 4;
  }

  const channels = CHANNELS[colorType];

  if (!channels || width < 1 || height < 1 || interlace !== 0) return null;
  if (depth !== 8 && depth !== 16) return null;
  if (colorType === 3 && (!palette || depth !== 8)) return null;
  /* 그림 한 장이 이보다 크면 모델 응답이 아니다 — 메모리를 지킨다. */
  if (width * height > 40_000_000) return null;

  let raw: Buffer;

  try {
    raw = inflateSync(Buffer.concat(data));
  } catch {
    return null;
  }

  const bytesPerPixel = (channels * depth) / 8;
  const stride = width * bytesPerPixel;

  if (raw.length < height * (stride + 1)) return null;

  const current = Buffer.alloc(stride);
  const previous = Buffer.alloc(stride);
  const gray = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    const filter = raw[rowStart]!;

    for (let i = 0; i < stride; i += 1) {
      const x = raw[rowStart + 1 + i]!;
      const left = i >= bytesPerPixel ? current[i - bytesPerPixel]! : 0;
      const up = previous[i]!;
      const upLeft = i >= bytesPerPixel ? previous[i - bytesPerPixel]! : 0;
      let value: number;

      switch (filter) {
        case 0: value = x; break;
        case 1: value = x + left; break;
        case 2: value = x + up; break;
        case 3: value = x + ((left + up) >> 1); break;
        case 4: value = x + paeth(left, up, upLeft); break;
        default: return null;
      }
      current[i] = value & 0xff;
    }

    for (let px = 0; px < width; px += 1) {
      /* 16비트면 윗바이트만 본다 — 지문에는 256단계면 충분하다. */
      const sample = (channel: number) => current[px * bytesPerPixel + channel * (depth / 8)]!;
      let r: number;
      let g: number;
      let b: number;

      if (colorType === 3) {
        const index = current[px]! * 3;
        r = palette![index] ?? 0;
        g = palette![index + 1] ?? 0;
        b = palette![index + 2] ?? 0;
      } else if (channels >= 3) {
        r = sample(0);
        g = sample(1);
        b = sample(2);
      } else {
        r = g = b = sample(0);
      }
      gray[y * width + px] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    current.copy(previous);
  }

  return { width, height, gray };
}

/** 그림의 지문. 못 재면 null. */
export function imageDHash(bytes: Buffer, mimeType: string): string | null {
  if (mimeType !== 'image/png') return null;
  const png = decodePngGray(bytes);

  return png ? dHashFromGray(png.gray, png.width, png.height) : null;
}
