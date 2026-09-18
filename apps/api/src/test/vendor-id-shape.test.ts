import { createTestApp, resetDatabase, type TestApp } from './helpers';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * 주소의 업체 id가 UUID 꼴이 아닐 때.
 *
 * **운영에서 500이 났다**(2026-09-17 01:49 KST). 빈 문자열이 `structured.vendors.id`에
 * 그대로 들어가 PostgreSQL이 `22P02 invalid input syntax for type uuid: ""`로 던졌고,
 * 그것이 잡히지 않고 500으로 올라갔다.
 *
 * **없는 업체와 같은 답을 준다.** 사용자에게는 둘 다 「그 업체는 없다」이고, 하나는
 * 404인데 하나는 500이면 고칠 곳을 찾는 사람이 서버가 고장 난 줄 안다.
 *
 * 로그인 없이 부른다 — 이 세 길은 전부 비로그인도 열린다. 꼴 검사는 그보다 앞이다.
 */
describeWithDb('업체 id 꼴', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  /** 운영 로그의 그 값(빈 문자열)과, 사람이 주소를 잘못 친 꼴. */
  const badIds = ['', '%20', 'undefined', 'null', '123', '가온예식홀'];

  const paths = (id: string) => [
    `/v1/vendors/${id}`,
    `/v1/vendors/${id}/conditions`,
    `/v1/vendors/${id}/reviews`,
    `/v1/vendors/${id}/static-map`,
  ];

  it('꼴이 아닌 id는 500이 아니라 404다', async () => {
    for (const id of badIds) {
      for (const url of paths(id)) {
        const response = await test.app.inject({ method: 'GET', url });

        // 라우터가 아예 안 받는 것(404)도 맞는 답이다. 막아야 하는 것은 500이다.
        expect([response.statusCode, url, id]).toEqual([404, url, id]);
      }
    }
  });

  it('꼴은 맞지만 없는 업체도 같은 404다', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';

    for (const url of paths(missing)) {
      const response = await test.app.inject({ method: 'GET', url });

      expect([response.statusCode, url]).toEqual([404, url]);
    }
  });
});
