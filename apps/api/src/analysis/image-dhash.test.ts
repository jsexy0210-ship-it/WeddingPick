import { encodeRgbPng as png } from '../test/png-fixture';
import { decodePngGray, imageDHash } from './image-dhash';
import { FEED_IMAGE_DUPLICATE_BITS, dHashFromGray, hammingDistanceHex } from './wedding-feed-diversity';

/**
 * PNG 지문 — 새 의존성 없이 `node:zlib`로 푼다. 시험도 PNG를 손으로 만든다(`test/png-fixture.ts`).
 * 필터 다섯 가지(0~4)를 줄마다 돌려 가며 써서 푸는 쪽이 다 맞는지 본다.
 */

const W = 96;
const H = 54;
const scene = (x: number, y: number): [number, number, number] => {
  const v = Math.round(128 + 100 * Math.sin(x / 9) * Math.cos(y / 7));
  return [v, Math.min(255, v + 10), Math.max(0, v - 10)];
};

describe('PNG 지문', () => {
  it('다섯 필터가 섞인 PNG를 픽셀 그대로 푼다', () => {
    const decoded = decodePngGray(png(W, H, scene));

    expect(decoded).not.toBeNull();
    expect(decoded!.width).toBe(W);
    expect(decoded!.height).toBe(H);
    for (const [x, y] of [[0, 0], [5, 1], [40, 2], [95, 3], [17, 4], [60, 53]] as const) {
      const [r, g, b] = scene(x, y);
      expect(decoded!.gray[y * W + x]).toBe(Math.round(0.299 * r + 0.587 * g + 0.114 * b));
    }
  });

  it('PNG에서 잰 지문은 같은 픽셀로 잰 지문과 같다', () => {
    const decoded = decodePngGray(png(W, H, scene))!;

    expect(imageDHash(png(W, H, scene), 'image/png')).toBe(dHashFromGray(decoded.gray, W, H));
  });

  it('같은 장면을 조금 밝게 다시 그린 PNG는 닮았다고 본다 · 좌우를 뒤집은 PNG는 아니다', () => {
    const base = imageDHash(png(W, H, scene), 'image/png')!;
    const brighter = imageDHash(png(W, H, (x, y) => scene(x, y).map((v) => Math.min(255, v + 15)) as [number, number, number]), 'image/png')!;
    const mirrored = imageDHash(png(W, H, (x, y) => scene(W - 1 - x, y)), 'image/png')!;

    expect(hammingDistanceHex(base, brighter)).toBeLessThanOrEqual(FEED_IMAGE_DUPLICATE_BITS);
    expect(hammingDistanceHex(base, mirrored)).toBeGreaterThan(FEED_IMAGE_DUPLICATE_BITS);
  });

  it('PNG가 아니거나 깨졌으면 지문 없이(null) — 그림 저장은 막지 않는다', () => {
    expect(imageDHash(Buffer.from([255, 216, 255, 224]), 'image/jpeg')).toBeNull();
    expect(imageDHash(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]), 'image/png')).toBeNull();
    expect(decodePngGray(Buffer.from('not a png'))).toBeNull();
  });
});
