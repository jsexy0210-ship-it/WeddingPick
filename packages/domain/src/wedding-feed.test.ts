import {
  WEDDING_FEED_ALL_TAB,
  WEDDING_FEED_LIMITS,
  WEDDING_FEED_PER_RUN,
  WEDDING_FEED_TARGET_PUBLISHED,
  WEDDING_FEED_TOPICS,
  buildFeedTabs,
  checkWeddingFeedInput,
  findUngroupedCategories,
  pickTopics,
  shouldGenerate,
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

describe('웨딩피드 — 탭과 카테고리', () => {
  const group = (id: string, sortOrder: number, active = true) => ({
    id,
    name: `탭${id}`,
    sortOrder,
    active,
  });
  const category = (
    name: string,
    groupId: string | null,
    sortOrder: number,
    active = true
  ) => ({ id: `c-${name}`, name, groupId, sortOrder, active });

  it('어느 탭에도 안 든 카테고리를 찾아낸다', () => {
    /*
     * **관리자가 알 수 있어야 한다.** 탭에서 떨어진 카테고리의 글은 「전체」에서만
     * 보이는데 오류도 안 나고 목록에서는 멀쩡해 보인다.
     */
    const found = findUngroupedCategories([
      category('예산', 'a', 1),
      category('허니문', null, 2),
      category('하객', null, 3),
    ]);

    expect(found.map((c) => c.name)).toEqual(['허니문', '하객']);
  });

  it('꺼 둔 카테고리는 탭이 없어도 세지 않는다', () => {
    // 꺼 둔 것은 앱에 안 나간다 — 늘 켜져 있는 경고는 아무도 읽지 않는다.
    expect(findUngroupedCategories([category('하객', null, 1, false)])).toEqual([]);
  });

  it('「전체」가 언제나 맨 앞이고 아무것도 거르지 않는다', () => {
    const tabs = buildFeedTabs(
      [group('a', 1)],
      [category('예산', 'a', 1)]
    );

    expect(tabs[0]!.key).toBe(WEDDING_FEED_ALL_TAB.key);
    expect(tabs[0]!.label).toBe('전체');
    expect(tabs[0]!.categories).toEqual([]);
  });

  it('탭은 순서대로 나오고 꺼진 탭은 빠진다', () => {
    const tabs = buildFeedTabs(
      [group('b', 2), group('a', 1), group('c', 3, false)],
      [category('예산', 'a', 1), category('계약', 'b', 1), category('허니문', 'c', 1)]
    );

    expect(tabs.map((t) => t.key)).toEqual([WEDDING_FEED_ALL_TAB.key, 'a', 'b']);
  });

  it('카테고리가 하나도 없는 탭은 그리지 않는다', () => {
    // 눌렀는데 늘 비어 있는 탭은 있는 것이 없는 것보다 나쁘다.
    const tabs = buildFeedTabs([group('a', 1), group('b', 2)], [category('예산', 'a', 1)]);

    expect(tabs.map((t) => t.key)).toEqual([WEDDING_FEED_ALL_TAB.key, 'a']);
  });

  it('탭 안의 카테고리는 순서대로 나오고 꺼진 것은 빠진다', () => {
    const tabs = buildFeedTabs(
      [group('a', 1)],
      [
        category('하객', 'a', 3),
        category('예산', 'a', 1),
        category('체크리스트', 'a', 2, false),
      ]
    );

    expect(tabs[1]!.categories).toEqual(['예산', '하객']);
  });

  it('자동 작성이 쓰는 카테고리 이름은 열둘이다', () => {
    /*
     * 표의 씨앗값(0421)이 이 목록에서 왔다. **글자 하나 다르면 그 주제로 쓴 글이
     * 어느 탭에도 안 붙는다** — 자동 작성은 화면을 거치지 않아서 고르기로 막을 수
     * 없고, 이 시험이 그 자리를 지킨다.
     */
    const names = [...new Set(WEDDING_FEED_TOPICS.map((t) => t.categoryLabel))];

    expect(names).toEqual([
      '예산',
      '체크리스트',
      '웨딩홀',
      '스튜디오',
      '드레스',
      '메이크업',
      '본식스냅',
      '헤어변형',
      '허니문',
      '계약',
      '준비 순서',
      '하객',
    ]);
  });
});
