import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import strings from '../../../spec/strings.ko.json';
import { ogImageAlt, ogImageSvg } from './og-image';

const assets = join(__dirname, '..', 'public', 'assets');

describe('링크 미리보기 이미지', () => {
  /*
   * 이 테스트가 있는 이유. 예전 SVG는 「확인하고 · 비교해서 골라요」를 담고 있었는데
   * 그 문구는 사이트 어디에도 없었다. 링크를 공유하면 없는 말이 먼저 보였고,
   * 그림 안의 글자라 아무도 눈치채지 못했다.
   */
  it('저장된 SVG가 지금 문구로 만든 것과 같다', () => {
    const committed = readFileSync(join(assets, 'weddingpick-og.svg'), 'utf8');

    expect(committed).toBe(ogImageSvg());
  });

  it('그림의 글자가 spec의 카드 문구에서 온다', () => {
    const svg = ogImageSvg();

    for (const line of strings.webLanding.og.hero.split('\n')) {
      expect(svg).toContain(`>${line}<`);
    }
    expect(svg).toContain(`>${strings.webLanding.og.sub}<`);
    expect(svg).toContain(`>${strings.webLanding.brand}<`);
  });

  /** 이미지를 못 읽는 사람이 듣는 글은 그림에 적힌 글과 같아야 한다. */
  it('대체 텍스트가 그림의 글자와 같다', () => {
    expect(ogImageAlt()).toBe(`${strings.webLanding.brand} — ${strings.webLanding.og.hero.replace('\n', ' ')}`);
  });

  /** 크롤러가 읽는 것은 PNG다. 규격이 어긋나면 미리보기가 잘리거나 작게 나온다. */
  it('PNG가 1200×630이다', () => {
    const png = readFileSync(join(assets, 'weddingpick-og.png'));

    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});
