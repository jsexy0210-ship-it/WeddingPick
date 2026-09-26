import {
  WEDDING_FEED_CATEGORY_LABELS,
  WEDDING_FEED_CHIPS,
  weddingFeedChipLabel,
  weddingFeedChipOf,
} from '@weddingpick/domain';

import { LOUNGE_CATEGORIES, loungeFeedMatches } from './lounge-reviews';

declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

const root = join(__dirname, '..', '..', '..', '..', '..');
const read = (...parts: string[]) => readFileSync(join(root, ...parts), 'utf8');

/**
 * 웨딩피드 칩 · 카테고리가 정본과 같은가(2026-09-26 대표 지적 — 「관리자 웨딩피드
 * 카테고리와 앱웹 카테고리와 정보가 전혀 다르다」).
 *
 * 목록은 domain 상수 하나이고 관리자 · 서버 · 앱이 그것을 본다. 상수를 세는 시험은
 * 늘 맞으므로 **정본 파일을 직접 읽어** 상수와 대조한다 — 정본이 바뀌면 여기서 깨진다.
 */
describe('웨딩피드 칩 — 정본 my.js 대조', () => {
  const canonMy = read('docs', 'design', 'React_Native', 'my.js');
  const canonHome = read('docs', 'design', 'React_Native', 'home.js');

  it('칩은 정본 my.js `cats`와 글자까지 같고 라운지가 그 줄을 그린다', () => {
    const line = canonMy.split('\n').find((l: string) => l.trim().startsWith('cats:')) ?? '';
    const canon = [...line.matchAll(/cat\('([^']+)'/g)].map((m) => m[1]);

    expect(canon).toEqual(['전체', '웨딩홀', '스드메', '본식', '예물 · 신혼', '예산']);
    expect(WEDDING_FEED_CHIPS.map((chip) => chip.label)).toEqual(canon);
    expect(LOUNGE_CATEGORIES).toEqual(canon);
  });

  it('정본 카드 배지(라운지 guides · relGuides · MY 스크랩 saved, 홈 feed)는 전부 고를 수 있는 카테고리다', () => {
    const lounge = [...canonMy.matchAll(/guide\('[^']+', IMG\.\w+, '([^']+)'/g)].map((m) => m[1]!);
    const home = [...canonHome.matchAll(/\{ category: '([^']+)'/g)].map((m) => m[1]!);

    expect(lounge).toEqual([
      '드레스', '예산', '일정', '스튜디오', // guides lg-1~4
      '예산', '일정', // relGuides rl-1~2
      '드레스', '예산', '일정', // saved sv-1~3
    ]);
    expect(home).toEqual(['예산', '체크리스트']);
    for (const badge of [...lounge, ...home]) expect(WEDDING_FEED_CATEGORY_LABELS).toContain(badge);
  });

  it('정본 카드는 배지와 다른 칩에 든다 — «드레스» 카드는 «스드메» 칩', () => {
    expect(weddingFeedChipLabel(weddingFeedChipOf('드레스')!)).toBe('스드메');
    expect(loungeFeedMatches('스드메', '드레스')).toBe(true);
    expect(loungeFeedMatches('스드메', '스튜디오')).toBe(true);
    // «일정» 칩은 정본에 없다 — 전체에서만 보인다.
    expect(LOUNGE_CATEGORIES.filter((chip) => loungeFeedMatches(chip, '일정'))).toEqual(['전체']);
  });
});
