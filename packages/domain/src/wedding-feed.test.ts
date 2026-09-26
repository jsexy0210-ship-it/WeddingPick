import { PREPARATION_GROUPS, VENDOR_CATEGORY_LABEL } from './vendor';
import {
  WEDDING_FEED_CATEGORIES,
  WEDDING_FEED_CATEGORY_LABELS,
  WEDDING_FEED_CHIPS,
  WEDDING_FEED_LIMITS,
  WEDDING_FEED_PER_RUN,
  WEDDING_FEED_TABS,
  WEDDING_FEED_TARGET_PUBLISHED,
  WEDDING_FEED_TOPICS,
  checkWeddingFeedInput,
  pickTopics,
  shouldGenerate,
  weddingFeedChipOf,
  weddingFeedMatchesChip,
  type WeddingFeedInput,
} from './wedding-feed';

const ok: WeddingFeedInput = {
  categoryLabel: '예산',
  title: '스드메 예산을 넘기지 않는 법',
  summary: '한 줄 요약',
  body: '본문',
  imageKey: null,
  bodyImageKey: null,
  status: 'draft',
  sortOrder: 0,
};

describe('웨딩피드 — 들어온 글 검사', () => {
  it('제대로 된 글은 통과한다', () => {
    expect(checkWeddingFeedInput(ok)).toEqual([]);
  });

  it('빈 칸을 잡는다', () => {
    const problems = checkWeddingFeedInput({ ...ok, title: '   ' });

    expect(problems).toEqual([{ field: 'title', message: '비어 있어요' }]);
  });

  it('긴 제목을 잡는다', () => {
    // 카드에서 잘려 보이는데 목록에서는 멀쩡해 보인다 — 그래서 들어올 때 막는다.
    const problems = checkWeddingFeedInput({ ...ok, title: '가'.repeat(WEDDING_FEED_LIMITS.title + 1) });

    expect(problems).toEqual([{ field: 'title', message: `${WEDDING_FEED_LIMITS.title}자를 넘겨요` }]);
  });

  it('요약과 본문은 비어도 되지만 길면 막는다', () => {
    expect(checkWeddingFeedInput({ ...ok, summary: '', body: '' })).toEqual([]);
    expect(checkWeddingFeedInput({ ...ok, body: '가'.repeat(WEDDING_FEED_LIMITS.body + 1) })).toEqual([
      { field: 'body', message: `${WEDDING_FEED_LIMITS.body}자를 넘겨요` },
    ]);
  });
});

describe('웨딩피드 — 주제 고르기', () => {
  it('이미 쓴 주제는 빼고 준다', () => {
    const first = WEDDING_FEED_TOPICS[0]!.key;
    const picked = pickTopics([first], 2);

    expect(picked.map((t) => t.key)).not.toContain(first);
    expect(picked).toHaveLength(2);
  });

  it('다 썼으면 빈 배열이다', () => {
    // 억지로 채우면 같은 이야기가 두 번 올라간다 — 쌓이지 않은 것보다 나쁘다.
    expect(pickTopics(WEDDING_FEED_TOPICS.map((t) => t.key), 2)).toEqual([]);
  });

  it('주제 키가 겹치지 않는다', () => {
    const keys = WEDDING_FEED_TOPICS.map((t) => t.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('업종 이름은 정본을 쓴다', () => {
    const labels = WEDDING_FEED_TOPICS.map((t) => t.categoryLabel);

    // CLAUDE.md 2026-09-11 — 본식스냅 · 헤어변형. 결정사는 2026-09-24 대표 지시로 뺐다.
    expect(labels).toContain('본식스냅');
    expect(labels).toContain('헤어변형');
    expect(labels).not.toContain('결정사');
    expect(labels).not.toContain('스냅');
    expect(labels).not.toContain('헤메');
    expect(labels).not.toContain('플래너');
  });
});

describe('웨딩피드 — 언제 자동 작성이 도는가', () => {
  it('공개된 글이 충분하면 안 돈다', () => {
    expect(
      shouldGenerate({ publishedCount: WEDDING_FEED_TARGET_PUBLISHED, draftCount: 0, usedTopics: [] })
    ).toBe(false);
  });

  it('검토를 기다리는 초안이 쌓여 있으면 안 돈다', () => {
    // 계속 써 내면 검토가 더 밀린다.
    expect(
      shouldGenerate({ publishedCount: 0, draftCount: WEDDING_FEED_PER_RUN, usedTopics: [] })
    ).toBe(false);
  });

  it('쓸 주제가 남아 있지 않으면 안 돈다', () => {
    expect(
      shouldGenerate({
        publishedCount: 0,
        draftCount: 0,
        usedTopics: WEDDING_FEED_TOPICS.map((t) => t.key),
      })
    ).toBe(false);
  });

  it('모자라고 주제가 남았으면 돈다', () => {
    expect(shouldGenerate({ publishedCount: 1, draftCount: 0, usedTopics: [] })).toBe(true);
  });
});

/**
 * 칩과 카테고리 — 관리자와 앱이 함께 보는 목록 하나(2026-09-26 대표 지적 「관리자 웨딩피드
 * 카테고리와 앱웹 카테고리와 정보가 전혀 다르다」).
 *
 * 칩이 정본 my.js `cats`와 글자까지 같은지는 정본 파일을 직접 읽는 앱 쪽 시험이 센다
 * (`apps/mobile/src/features/community/lounge-reviews.test.ts`) — 이 패키지는 파일을 못 읽는다.
 */
describe('웨딩피드 — 칩과 카테고리', () => {
  it('칩 키는 준비 현황 그룹 키와 같고, 업종 카테고리는 그 그룹에 든다', () => {
    const groupKeys = PREPARATION_GROUPS.map((group) => group.key);

    expect(WEDDING_FEED_CHIPS.map((chip) => chip.key)).toEqual(['all', ...groupKeys, 'budget']);

    for (const category of WEDDING_FEED_CATEGORIES) {
      if (category.vendorCategory === null) continue;
      const group = PREPARATION_GROUPS.find((g) => g.categories.includes(category.vendorCategory));

      expect({ label: category.label, chip: category.chip }).toEqual({
        label: category.label,
        chip: group?.key,
      });
    }
  });

  it('업종 카테고리 이름은 업종 이름과 같은 글자다', () => {
    for (const category of WEDDING_FEED_CATEGORIES) {
      if (category.vendorCategory === null) continue;
      expect(category.label).toBe(VENDOR_CATEGORY_LABEL[category.vendorCategory]);
    }
  });

  it('이름과 키가 겹치지 않는다', () => {
    const labels = WEDDING_FEED_CATEGORIES.map((c) => c.label);
    const keys = WEDDING_FEED_CATEGORIES.map((c) => c.key);

    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('은퇴·옛 이름은 목록에 없다', () => {
    // 결정사는 2026-09-24 대표 지시(0433). 준비 순서는 정본 이름 «일정»으로 옮겼다(0442).
    for (const gone of ['결정사', '준비 순서', '스냅', '헤메', '플래너']) {
      expect(WEDDING_FEED_CATEGORY_LABELS).not.toContain(gone);
    }
  });

  it('칩이 없는 카테고리는 넷이고 «전체»에서만 보인다', () => {
    const chipless = WEDDING_FEED_CATEGORIES.filter((c) => c.chip === null).map((c) => c.label);

    expect(chipless).toEqual(['체크리스트', '일정', '하객', '계약']);
    for (const label of chipless) {
      expect(WEDDING_FEED_CHIPS.filter((chip) => weddingFeedMatchesChip(chip.key, label)).map((c) => c.key)).toEqual(['all']);
    }
  });

  it('칩은 묶음 안 카테고리만 남긴다', () => {
    expect(weddingFeedMatchesChip('sdm', '드레스')).toBe(true);
    expect(weddingFeedMatchesChip('sdm', '웨딩홀')).toBe(false);
    expect(weddingFeedMatchesChip('goods', '허니문')).toBe(true);
    expect(weddingFeedMatchesChip('ceremony', '본식스냅')).toBe(true);
    expect(weddingFeedMatchesChip('budget', '예산')).toBe(true);
    // 목록 밖 이름 — 뒤 공백 하나라도 — 은 «전체»에서만 보인다.
    expect(weddingFeedChipOf('웨딩홀 ')).toBeNull();
    expect(weddingFeedMatchesChip('start', '웨딩홀 ')).toBe(false);
    expect(weddingFeedMatchesChip('all', '웨딩홀 ')).toBe(true);
  });

  it('공개 목록의 tabs는 칩 줄 그대로다 — 「전체」가 맨 앞이고 거르지 않는다', () => {
    expect(WEDDING_FEED_TABS.map((tab) => tab.label)).toEqual(WEDDING_FEED_CHIPS.map((c) => c.label));
    expect(WEDDING_FEED_TABS[0]).toEqual({ key: 'all', label: '전체', categories: [] });
    expect(WEDDING_FEED_TABS.find((tab) => tab.key === 'sdm')!.categories).toEqual([
      '스튜디오',
      '드레스',
      '메이크업',
      '헤어변형',
    ]);

    // 칩이 있는 카테고리는 탭 하나에만 든다 — 둘에 들면 같은 글이 칩 둘에 뜬다.
    const placed = WEDDING_FEED_TABS.flatMap((tab) => tab.categories);

    expect(new Set(placed).size).toBe(placed.length);
    expect(placed.sort()).toEqual(
      WEDDING_FEED_CATEGORIES.filter((c) => c.chip !== null).map((c) => c.label).sort()
    );
  });

  it('자동 작성 주제는 전부 목록 안의 이름을 쓴다', () => {
    /*
     * 자동 작성은 화면을 거치지 않아서 고르기로 막을 수 없다. 글자 하나 다르면 그 주제로
     * 쓴 글이 어느 칩에도 안 붙는다. 타입이 한 번 막고 이 시험이 한 번 더 본다.
     */
    for (const topic of WEDDING_FEED_TOPICS) {
      expect(WEDDING_FEED_CATEGORY_LABELS).toContain(topic.categoryLabel);
    }
  });

  it('목록 밖 이름은 들어올 때 막는다', () => {
    expect(checkWeddingFeedInput({ ...ok, categoryLabel: '결정사' })).toEqual([
      { field: 'categoryLabel', message: '목록에 없는 카테고리예요' },
    ]);
    expect(checkWeddingFeedInput({ ...ok, categoryLabel: '웨딩홀 ' })).toEqual([
      { field: 'categoryLabel', message: '목록에 없는 카테고리예요' },
    ]);
    for (const label of WEDDING_FEED_CATEGORY_LABELS) {
      expect(checkWeddingFeedInput({ ...ok, categoryLabel: label })).toEqual([]);
    }
  });
});
