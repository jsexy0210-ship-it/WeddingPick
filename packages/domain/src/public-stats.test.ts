import {
  PUBLIC_STAT_SOURCE_URL_PATTERN,
  findUnlistedNumbers,
  formatStatFact,
  statSourceLine,
  type PublicStat,
} from './public-stats';
import { WEDDING_FEED_TOPICS, topicsMissingStats } from './wedding-feed';

const STAT: PublicStat = {
  key: 'seoul.marriage.count',
  label: '서울 혼인 건수',
  value: 36324,
  unit: '건',
  period: '2025년',
  sourceName: '서울특별시',
  sourceUrl: 'https://www.data.go.kr/data/15000000/fileData.do',
};

describe('공공 통계', () => {
  it('모델에게 건네는 줄은 천 단위 쉼표와 출처를 담는다', () => {
    expect(formatStatFact(STAT)).toBe('서울 혼인 건수: 36,324건 (2025년 · 서울특별시)');
  });

  it('넘긴 숫자와 기준 연도만 쓴 글은 통과한다', () => {
    expect(findUnlistedNumbers('2025년 서울 혼인은 36,324건이에요.', [STAT])).toEqual([]);
    expect(findUnlistedNumbers('36324건이에요.', [STAT])).toEqual([]);
  });

  it('넘기지 않은 숫자를 잡는다', () => {
    expect(findUnlistedNumbers('36,324건, 그중 30%가 봄이에요. 30%', [STAT])).toEqual(['30']);
    expect(findUnlistedNumbers('36,000건쯤이에요.', [STAT])).toEqual(['36000']);
  });

  it('출처 줄은 기관과 기준 시점을 한 번씩 적는다', () => {
    expect(statSourceLine([STAT, { ...STAT, key: 'other' }])).toBe(
      '출처: 서울특별시 2025년 (공공데이터포털)'
    );
  });

  it('출처 주소는 공공데이터포털 데이터 페이지만 받는다', () => {
    expect(PUBLIC_STAT_SOURCE_URL_PATTERN.test(STAT.sourceUrl)).toBe(true);
    expect(PUBLIC_STAT_SOURCE_URL_PATTERN.test('https://example.com/data/1/')).toBe(false);
  });
});

describe('통계 주제', () => {
  const statTopics = WEDDING_FEED_TOPICS.filter((topic) => topic.statKeys);

  it('통계가 표에 없으면 통계 주제를 뺀다', () => {
    expect(topicsMissingStats([])).toEqual(statTopics.map((topic) => topic.key));
  });

  it('통계가 다 들어오면 뺄 주제가 없다', () => {
    expect(topicsMissingStats(statTopics.flatMap((topic) => topic.statKeys ?? []))).toEqual([]);
  });
});
