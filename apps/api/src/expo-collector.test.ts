import { createTestApp, resetDatabase, type TestApp } from './test/helpers';
import {
  getLatestExpoCollectionRun,
  runExpoCollection,
  type ExpoCandidate,
} from './expo-collector';

let test: TestApp;
const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

function candidate(overrides: Partial<ExpoCandidate> = {}): ExpoCandidate {
  return {
    eventName: '2099 서울 웨딩페어',
    canonicalEventName: '서울 웨딩페어',
    aliases: [],
    organizer: '테스트 주최사',
    host: null,
    startDate: '2099-10-10',
    endDate: '2099-10-11',
    openingHours: '10:00~18:00',
    province: '서울',
    city: '서울시',
    district: '강남구',
    venueName: '테스트 컨벤션',
    address: '서울 강남구 테스트로 1',
    eventCategories: ['종합 웨딩박람회'],
    admissionFee: null,
    reservationRequired: true,
    reservationUrl: 'https://example.com/expo/apply',
    benefitsSummary: ['사전 등록 안내'],
    description: '공식 일정에서 확인한 테스트 행사',
    officialWebsiteUrl: 'https://example.com/expo',
    officialSnsUrls: [],
    discoveryUrls: ['https://example.com/search'],
    verificationUrls: ['https://example.com/expo'],
    status: 'UPCOMING',
    confidence: 'OFFICIAL_CONFIRMED',
    confidenceScore: 95,
    adminReviewRequired: false,
    reviewReason: [],
    sourceNote: '주최사 공식 홈페이지',
    thumbnailCandidateUrl: 'https://example.com/expo/poster.jpg',
    thumbnailSourceUrl: 'https://example.com/expo',
    ...overrides,
  };
}

describeWithDb('박람회 지속 수집', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  it('공식 확인 후보를 신규 등록하고 실행 이력을 성공으로 남긴다', async () => {
    const result = await runExpoCollection({
      pool: test.pool,
      discover: async () => [candidate()],
      model: 'test-gemini',
      trigger: 'manual',
    });

    expect(result).toMatchObject({
      skipped: false,
      discovered: 1,
      created: 1,
      updated: 0,
      duplicates: 0,
    });

    const { rows } = await test.pool.query<{
      thumbnail_url: string | null;
      thumbnail_candidate_url: string | null;
      thumbnail_rights: string | null;
      admin_review_required: boolean;
    }>(
      `SELECT thumbnail_url, thumbnail_candidate_url, thumbnail_rights, admin_review_required
       FROM structured.expos`
    );

    expect(rows).toEqual([
      {
        thumbnail_url: null,
        thumbnail_candidate_url: 'https://example.com/expo/poster.jpg',
        thumbnail_rights: null,
        admin_review_required: false,
      },
    ]);

    await expect(getLatestExpoCollectionRun(test.pool)).resolves.toMatchObject({
      status: 'success',
      discovered: 1,
      created: 1,
    });
  });

  it('같은 신청 URL의 행사를 다시 찾으면 중복 INSERT하지 않고 UPDATE한다', async () => {
    await runExpoCollection({
      pool: test.pool,
      discover: async () => [candidate()],
      model: 'test-gemini',
      trigger: 'manual',
    });

    const second = await runExpoCollection({
      pool: test.pool,
      discover: async () => [
        candidate({
          benefitsSummary: ['사전 등록 안내', '변경된 혜택'],
          description: '공식 페이지에서 내용이 갱신됨',
        }),
      ],
      model: 'test-gemini',
      trigger: 'manual',
    });

    expect(second).toMatchObject({ created: 0, updated: 1 });

    const { rows } = await test.pool.query<{ count: string; benefits: unknown }>(
      `SELECT count(*) OVER ()::text AS count, benefits FROM structured.expos`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe('1');
    expect(rows[0]?.benefits).toEqual(['사전 등록 안내', '변경된 혜택']);

    const changes = await test.pool.query<{ change_type: string }>(
      `SELECT change_type FROM structured.expo_change_log WHERE change_type = 'BENEFIT_CHANGED'`
    );
    expect(changes.rows).toHaveLength(1);
  });

  it('신뢰도가 낮은 후보는 검수 대기로 저장하고 사용자 목록에서 숨긴다', async () => {
    await runExpoCollection({
      pool: test.pool,
      discover: async () => [
        candidate({
          eventName: '2099 확인 필요 웨딩페어',
          reservationUrl: 'https://example.com/review/apply',
          officialWebsiteUrl: null,
          verificationUrls: [],
          discoveryUrls: ['https://example.com/social/post'],
          confidence: 'SOCIAL_ONLY',
          confidenceScore: 55,
          adminReviewRequired: true,
          reviewReason: ['SNS 한 곳에서만 확인'],
        }),
      ],
      model: 'test-gemini',
      trigger: 'manual',
    });

    const stored = await test.pool.query<{ admin_review_required: boolean }>(
      `SELECT admin_review_required FROM structured.expos`
    );
    expect(stored.rows[0]?.admin_review_required).toBe(true);

    const response = await test.app.inject({ method: 'GET', url: '/v1/expos' });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ items: unknown[] }>().items).toEqual([]);
  });

  it('대표 이미지 URL만 넣어서는 공개되지 않고 권리 상태를 확인해야 노출된다', async () => {
    await runExpoCollection({
      pool: test.pool,
      discover: async () => [candidate()],
      model: 'test-gemini',
      trigger: 'manual',
    });

    await test.pool.query(
      `UPDATE structured.expos
       SET thumbnail_url = 'https://example.com/expo/public.jpg'
       WHERE title = '2099 서울 웨딩페어'`
    );

    const before = await test.app.inject({ method: 'GET', url: '/v1/expos' });
    expect(before.statusCode).toBe(200);
    expect(before.json<{ items: { thumbnailUrl: string | null }[] }>().items[0]?.thumbnailUrl).toBeNull();

    await test.pool.query(
      `UPDATE structured.expos
       SET thumbnail_rights = 'OFFICIAL_PUBLIC'
       WHERE title = '2099 서울 웨딩페어'`
    );

    const after = await test.app.inject({ method: 'GET', url: '/v1/expos' });
    expect(after.statusCode).toBe(200);
    expect(after.json<{ items: { thumbnailUrl: string | null }[] }>().items[0]?.thumbnailUrl)
      .toBe('https://example.com/expo/public.jpg');
  });
});
