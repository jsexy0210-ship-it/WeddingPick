import {
  EARLY_STAGE_AFTER_DAYS,
  FINAL_STAGE_WITHIN_DAYS,
  STAGE_FEED_SUBJECT_TOPIC,
  categoryLeadDays,
  preparationStage,
  rankFeedForStage,
  type PreparationStageInput,
  type StageRankablePost,
} from './preparation-stage';
import { PREPARATION_CATEGORIES, VENDOR_CATEGORY_LABEL, type VendorCategory } from './vendor';
import { WEDDING_FEED_TOPICS } from './wedding-feed';

const stage = (input: Partial<PreparationStageInput>) =>
  preparationStage({ daysLeft: null, decided: [], picking: [], ...input });

type Post = StageRankablePost & { id: string };

/** 자동 작성 주제마다 한 편 — 운영에서 쌓이는 모양 그대로(카테고리는 그 주제의 것). */
const TOPIC_POSTS: Post[] = WEDDING_FEED_TOPICS.map((topic) => ({
  id: topic.key,
  categoryLabel: topic.categoryLabel,
  topic: topic.key,
}));

const ids = (posts: readonly Post[]) => posts.map((post) => post.id);
const top2 = (input: Partial<PreparationStageInput>, posts: readonly Post[] = TOPIC_POSTS) =>
  ids(rankFeedForStage(posts, stage(input)).slice(0, 2));

describe('준비 단계 — 임시 일정의 경계', () => {
  it('경계는 기본 할 일의 임시 날짜에서 읽는다 — 웨딩홀 계약 D-300 · 식순 확정 D-30', () => {
    expect(EARLY_STAGE_AFTER_DAYS).toBe(300);
    expect(FINAL_STAGE_WITHIN_DAYS).toBe(30);
  });

  it('업종마다 가장 이른 임시 날짜를 쓴다 — 웨딩홀은 잔금(D-7)이 아니라 계약(D-300)', () => {
    expect(categoryLeadDays('hall')).toBe(300);
    expect(categoryLeadDays('snap')).toBe(240);
    expect(categoryLeadDays('dress')).toBe(180);
    expect(categoryLeadDays('studio')).toBe(150);
    expect(categoryLeadDays('goods')).toBe(120);
    expect(categoryLeadDays('honeymoon')).toBe(120);
    expect(categoryLeadDays('invitation')).toBe(75);
    expect(categoryLeadDays('makeup')).toBe(60);
  });

  it('기본 할 일이 없는 업종은 임시 날짜가 없다 — 지어내지 않는다', () => {
    expect(categoryLeadDays('hair')).toBeNull();
    expect(categoryLeadDays('bouquet')).toBeNull();
    expect(categoryLeadDays('dowry')).toBeNull();
  });
});

describe('준비 단계 — 어느 단계인가', () => {
  it('아무것도 안 정했고 D-301이면 시작 전, D-300이면 웨딩홀', () => {
    expect(stage({ daysLeft: 301 }).key).toBe('early');
    expect(stage({ daysLeft: 300 }).key).toBe('start');
  });

  it('예식일이 없고 아무것도 안 정했으면 시작 전이다', () => {
    expect(stage({}).key).toBe('early');
  });

  it('D-400이어도 웨딩홀 후보를 담는 중이면 웨딩홀 단계다', () => {
    expect(stage({ daysLeft: 400, picking: ['hall'] }).key).toBe('start');
  });

  it('D-31은 업종 단계, D-30 · D-0은 마지막 확인, D-1 지나면 끝', () => {
    const decided: VendorCategory[] = ['hall'];

    expect(stage({ daysLeft: 31, decided }).key).toBe('sdm');
    expect(stage({ daysLeft: 30, decided }).key).toBe('final');
    expect(stage({ daysLeft: 0, decided }).key).toBe('final');
    expect(stage({ daysLeft: -1, decided }).key).toBe('after');
  });

  it('D-30 안쪽이면 웨딩홀을 안 정했어도 마지막 확인이 먼저다', () => {
    expect(stage({ daysLeft: 20 }).key).toBe('final');
  });

  it('D-120 · 웨딩홀만 정했으면 스드메 — 지금 업종은 스튜디오', () => {
    const result = stage({ daysLeft: 120, decided: ['hall'] });

    expect(result.key).toBe('sdm');
    expect(result.current).toBe('studio');
  });

  it('임시 날짜가 온 미정 업종을 이른 것부터 적는다', () => {
    expect(stage({ daysLeft: 120, decided: ['hall'] }).due).toEqual([
      'snap',
      'dress',
      'studio',
      'goods',
      'honeymoon',
    ]);
    expect(stage({ daysLeft: 300 }).due).toEqual(['hall']);
    expect(stage({ daysLeft: 301 }).due).toEqual([]);
    expect(stage({}).due).toEqual([]);
  });

  it('지금 업종은 홈 히어로와 같은 규칙이다 — 후보를 담는 중인 업종이 먼저', () => {
    const result = stage({ daysLeft: 200, picking: ['dress'] });

    expect(result.current).toBe('dress');
    expect(result.key).toBe('sdm');
  });

  it('웨딩홀 · 스드메를 다 정했으면 본식 준비, 그다음은 예물 · 신혼', () => {
    const sdmDone: VendorCategory[] = ['hall', 'studio', 'dress', 'makeup', 'hair'];

    expect(stage({ daysLeft: 150, decided: sdmDone }).key).toBe('ceremony');
    expect(
      stage({ daysLeft: 150, decided: [...sdmDone, 'snap', 'bouquet', 'invitation'] }).key
    ).toBe('goods');
  });

  it('다 정했으면 마무리 — 예식일이 없어도 같다', () => {
    const all = [...PREPARATION_CATEGORIES];

    expect(stage({ daysLeft: 100, decided: all }).key).toBe('wrapup');
    expect(stage({ decided: all }).key).toBe('wrapup');
    expect(stage({ decided: all }).current).toBeNull();
  });

  it('준비 업종이 아닌 값(기타 · 더는 고르지 않는 업종)은 세지 않는다', () => {
    expect(stage({ daysLeft: 400, decided: ['etc', 'wedding_info_company'] }).key).toBe('early');
  });

  it('정한 업종을 담는 중으로 다시 세지 않는다', () => {
    const result = stage({ daysLeft: 200, decided: ['hall'], picking: ['hall'] });

    expect(result.current).toBe('studio');
  });
});

describe('준비 단계 — 웨딩피드 카테고리는 상수를 거쳐 읽는다', () => {
  it('업종이 아닌 카테고리는 전부 자동 작성 주제에 있다', () => {
    for (const key of Object.values(STAGE_FEED_SUBJECT_TOPIC)) {
      expect(WEDDING_FEED_TOPICS.some((topic) => topic.key === key)).toBe(true);
    }
  });

  it('단계가 부르는 토픽은 전부 자동 작성 주제에 있다', () => {
    const inputs: Partial<PreparationStageInput>[] = [
      {},
      { daysLeft: 300 },
      { daysLeft: 120, decided: ['hall'] },
      { daysLeft: 150, decided: ['hall', 'studio', 'dress', 'makeup', 'hair'] },
      { daysLeft: 20 },
      { daysLeft: 100, decided: [...PREPARATION_CATEGORIES] },
    ];

    for (const input of inputs) {
      const result = stage(input);

      for (const match of result.feed) {
        if ('topic' in match) {
          expect(WEDDING_FEED_TOPICS.some((topic) => topic.key === match.topic)).toBe(true);
        }
      }
      for (const key of result.staleTopics) {
        expect(WEDDING_FEED_TOPICS.some((topic) => topic.key === key)).toBe(true);
      }
    }
  });
});

describe('준비 단계 — 웨딩피드 줄 세우기', () => {
  it('시작 전(D-400 · 아무것도 안 정함) — 준비 순서와 웨딩홀 비용 글이 먼저', () => {
    expect(top2({ daysLeft: 400 })).toEqual(['schedule-order', 'budget-hall']);
  });

  it('웨딩홀 단계(D-300 · 아무것도 안 정함) — 웨딩홀 글, 그다음 하객', () => {
    expect(top2({ daysLeft: 300 })).toEqual(['hall-visit', 'guest-count']);
  });

  it('스드메 단계(D-120 · 웨딩홀 정함) — 스튜디오 글과 스드메 예산 글', () => {
    expect(top2({ daysLeft: 120, decided: ['hall'] })).toEqual(['studio-pick', 'budget-sdm']);
  });

  it('마지막 확인(D-20) — 한 달 전 체크리스트와 하객', () => {
    const ranked = ids(rankFeedForStage(TOPIC_POSTS, stage({ daysLeft: 20 })));

    expect(ranked.slice(0, 2)).toEqual(['checklist-1m', 'guest-count']);
    // 4개월 전 체크리스트는 철 지났다 — 카테고리가 맞아도 맞는 글들보다 뒤다.
    expect(ranked.indexOf('checklist-4m')).toBeGreaterThan(ranked.indexOf('contract-check'));
  });

  it('단계가 다르면 순서가 다르다', () => {
    const early = top2({ daysLeft: 400 });
    const sdm = top2({ daysLeft: 120, decided: ['hall'] });
    const final = top2({ daysLeft: 20 });

    expect(new Set([early.join(), sdm.join(), final.join()]).size).toBe(3);
  });

  it('빼지 않는다 — 들어온 글 수 그대로 나간다', () => {
    const ranked = rankFeedForStage(TOPIC_POSTS, stage({ daysLeft: 120, decided: ['hall'] }));

    expect(ranked).toHaveLength(TOPIC_POSTS.length);
    expect(new Set(ids(ranked))).toEqual(new Set(ids(TOPIC_POSTS)));
  });

  it('단계를 모르면(비회원 · 웨딩 없음) 원래 순서 그대로', () => {
    expect(ids(rankFeedForStage(TOPIC_POSTS, null))).toEqual(ids(TOPIC_POSTS));
  });

  it('예식일이 지났으면 원래 순서 그대로', () => {
    expect(ids(rankFeedForStage(TOPIC_POSTS, stage({ daysLeft: -3 })))).toEqual(ids(TOPIC_POSTS));
  });

  it('맞는 글이 하나도 없으면 원래 순서(최신) 그대로 — 섹션이 비지 않는다', () => {
    const posts: Post[] = [
      { id: 'a', categoryLabel: '운영 소식', topic: null },
      { id: 'b', categoryLabel: '운영 공지', topic: null },
    ];

    expect(ids(rankFeedForStage(posts, stage({ daysLeft: 120, decided: ['hall'] })))).toEqual(['a', 'b']);
  });

  it('직접 쓴 글(토픽 없음)도 카테고리로 걸린다 — 뒤 공백이 붙어도', () => {
    const posts: Post[] = [
      { id: 'latest', categoryLabel: '운영 소식', topic: null },
      { id: 'manual-hall', categoryLabel: `${VENDOR_CATEGORY_LABEL.hall} `, topic: null },
    ];

    expect(ids(rankFeedForStage(posts, stage({ daysLeft: 300 })))).toEqual(['manual-hall', 'latest']);
  });

  it('같은 카테고리 두 장보다 서로 다른 두 가지가 먼저다', () => {
    const hall = VENDOR_CATEGORY_LABEL.hall;
    const guests = WEDDING_FEED_TOPICS.find((topic) => topic.key === 'guest-count')!.categoryLabel;
    const posts: Post[] = [
      { id: 'hall-1', categoryLabel: hall, topic: null },
      { id: 'hall-2', categoryLabel: hall, topic: null },
      { id: 'guests', categoryLabel: guests, topic: null },
      { id: 'other', categoryLabel: '운영 소식', topic: null },
    ];

    expect(ids(rankFeedForStage(posts, stage({ daysLeft: 300 })))).toEqual([
      'hall-1',
      'guests',
      'hall-2',
      'other',
    ]);
  });

  it('같은 자리끼리는 원래 순서(운영자 순서 · 최신)를 지킨다', () => {
    const hall = VENDOR_CATEGORY_LABEL.hall;
    const posts: Post[] = [
      { id: 'newer', categoryLabel: hall, topic: null },
      { id: 'older', categoryLabel: hall, topic: null },
    ];

    expect(ids(rankFeedForStage(posts, stage({ daysLeft: 300 })))).toEqual(['newer', 'older']);
  });
});
