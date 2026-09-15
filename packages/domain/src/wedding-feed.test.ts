import {
  WEDDING_FEED_LIMITS,
  WEDDING_FEED_PER_RUN,
  WEDDING_FEED_TARGET_PUBLISHED,
  WEDDING_FEED_TOPICS,
  checkWeddingFeedInput,
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

    // CLAUDE.md 2026-09-11 — 본식스냅 · 헤어변형 · 결정사.
    expect(labels).toContain('본식스냅');
    expect(labels).toContain('헤어변형');
    expect(labels).toContain('결정사');
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
