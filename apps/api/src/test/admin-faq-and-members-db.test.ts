import { DISCLOSURE_THRESHOLDS } from '@weddingpick/domain';

import { createTestApp, resetDatabase, signInAs, type TestApp } from './helpers';
import type { LocalStorage } from '../storage/local';

let test: TestApp;

const describeWithDb = process.env.DATABASE_URL ? describe : describe.skip;

/**
 * FAQ 관리와 회원 추이.
 *
 * **여기서 보는 것은 「200이 오는가」가 아니다.** FAQ 라우트 다섯은 전부터 등록돼
 * 있었고 전부 성공을 돌려줬다 — GET은 빈 배열, POST는 임의 id, 나머지는 204.
 * 저장 단추가 눌리고 아무것도 남지 않았다. 그래서 **화면이 부르는 그대로 불렀을 때
 * 다음 조회에 그것이 보이는가**를 본다.
 */
describeWithDb('관리자 — FAQ · 회원 추이', () => {
  beforeAll(async () => {
    await resetDatabase();
    test = await createTestApp();
  });

  afterAll(async () => {
    await test?.close();
  });

  beforeEach(resetDatabase);

  async function operator(subject = `operator-${Math.random()}`) {
    const session = await signInAs(test, subject);
    await test.pool.query('UPDATE structured.users SET is_operator = true WHERE id = $1', [
      session.userId,
    ]);
    return session;
  }

  type FaqItem = {
    id: string;
    key: string | null;
    category: string;
    question: string;
    answer: string;
    answerSource: string;
    order: number;
    published: boolean;
  };

  const list = async (headers: Record<string, string>) => {
    const response = await test.app.inject({ method: 'GET', url: '/v1/admin/faq', headers });

    expect(response.statusCode).toBe(200);

    return (response.json() as { items: FaqItem[] }).items;
  };

  it('등록 · 수정 · 삭제가 다음 조회에 그대로 보인다', async () => {
    const { headers } = await operator();

    const created = await test.app.inject({
      method: 'POST',
      url: '/v1/admin/faq',
      headers,
      payload: {
        category: '이용 안내',
        question: 'Pick 인증은 무엇인가요',
        answer: '금액을 알려주시면 구간을 보여드려요.',
        order: 2,
        published: true,
      },
    });

    expect(created.statusCode).toBe(200);

    const id = (created.json() as { id: string }).id;
    const afterCreate = (await list(headers)).find((item) => item.id === id);

    expect(afterCreate).toMatchObject({
      category: '이용 안내',
      question: 'Pick 인증은 무엇인가요',
      order: 2,
      published: true,
      /* 운영자가 등록한 항목에는 고정 이름이 없다 — 화면은 id로 연다. */
      key: null,
    });

    const updated = await test.app.inject({
      method: 'PUT',
      url: `/v1/admin/faq/${id}`,
      headers,
      payload: {
        category: '이용 안내',
        question: 'Pick 인증은 무엇인가요',
        answer: '고친 답이에요.',
        order: 5,
        published: false,
      },
    });

    expect(updated.statusCode).toBe(204);
    expect((await list(headers)).find((item) => item.id === id)).toMatchObject({
      answer: '고친 답이에요.',
      order: 5,
      published: false,
    });

    const removed = await test.app.inject({
      method: 'DELETE',
      url: `/v1/admin/faq/${id}`,
      headers,
    });

    expect(removed.statusCode).toBe(204);
    expect((await list(headers)).some((item) => item.id === id)).toBe(false);
  });

  /**
   * 코드에 있던 일곱이 표로 내려왔다(2026-09-16 대표 지시 — 「관리자 faq처럼 이미
   * 코드로 등록되어 있는것도 내가 직접 수정 삭제 가능하도록 하라고」).
   *
   * **여기서 붙드는 것은 「잠금이 풀렸는가」다.** 전에는 코드 항목이 `editable: false`로
   * 와서 수정·삭제가 400이었다. 하나(공개 기준 건수를 계산해 넣던 답) 때문에 일곱을
   * 다 잠가 둔 상태였고, 그 하나는 자리표시자로 옮겼다.
   */
  it('옮겨 온 일곱이 전부 있고 전부 고치고 지울 수 있다', async () => {
    const { headers } = await operator();
    const seeded = (await list(headers)).filter((item) => item.key !== null);

    expect(seeded.map((item) => item.key).sort()).toEqual([
      'original-image',
      'price-source',
      'review-hidden',
      'spouse',
      'vendor-rebuttal',
      'who-sees',
      'why-locked',
    ]);

    const target = seeded.find((item) => item.key === 'spouse')!;

    const updated = await test.app.inject({
      method: 'PUT',
      url: `/v1/admin/faq/${target.id}`,
      headers,
      payload: {
        category: target.category,
        question: target.question,
        answer: '고친 답이에요.',
        order: target.order,
        published: true,
      },
    });

    expect(updated.statusCode).toBe(204);

    const removed = await test.app.inject({
      method: 'DELETE',
      url: `/v1/admin/faq/${target.id}`,
      headers,
    });

    expect(removed.statusCode).toBe(204);
    expect((await list(headers)).some((item) => item.key === 'spouse')).toBe(false);
  });

  /**
   * 공개 기준 건수가 든 답 하나.
   *
   * 0230 마이그레이션이 코드 항목을 잠가 둔 이유가 이것이었다 — 문장에 수를 박아
   * 두면 기준이 바뀌는 날 표에 든 사본이 옛 수를 말하고, 문장이라서 아무도 고장으로
   * 보지 않는다. 표에 담은 것은 수가 아니라 자리표시자다.
   */
  it('기준 건수는 표가 아니라 코드에서 온다', async () => {
    const { headers } = await operator();
    const item = (await list(headers)).find((entry) => entry.key === 'price-source')!;

    /* 표에 담긴 것은 자리표시자 그대로다 — 수가 글자로 굳어 있지 않다. */
    expect(item.answerSource).toContain('{{limited}}');
    expect(item.answerSource).toContain('{{detailed}}');

    /* 보여줄 때는 코드의 기준으로 채워진다. */
    expect(item.answer).toContain(`${DISCLOSURE_THRESHOLDS.limited}건`);
    expect(item.answer).toContain(`${DISCLOSURE_THRESHOLDS.detailed}건`);
    expect(item.answer).not.toContain('{{');
  });

  /**
   * 없는 이름은 저장할 때 막는다.
   *
   * 통과시키면 `{{limitedd}}`가 그대로 사용자 화면에 실린다 — 글자라서 문구의
   * 일부로 읽히고 아무도 고장으로 보지 않는다.
   */
  it('채울 수 없는 자리를 적으면 저장을 막는다', async () => {
    const { headers } = await operator();

    const response = await test.app.inject({
      method: 'POST',
      url: '/v1/admin/faq',
      headers,
      payload: {
        category: '이용 안내',
        question: '오타가 든 질문',
        answer: '실 제보가 {{limitedd}}건 모이면 보여드려요.',
        order: 0,
        published: true,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { message: expect.stringContaining('limitedd') } });
  });

  /**
   * 사용자 화면이 읽는 자리.
   *
   * **비공개 항목이 새어 나가지 않는지**가 요점이다. 관리자 목록은 작성 중인 것까지
   * 보여주고 이쪽은 공개한 것만 내보낸다.
   */
  it('공개 조회는 공개한 것만 내보내고 자리를 채워서 준다', async () => {
    const { headers } = await operator();

    await test.app.inject({
      method: 'POST',
      url: '/v1/admin/faq',
      headers,
      payload: {
        category: '이용 안내',
        question: '아직 쓰는 중인 질문',
        answer: '아직 쓰는 중이에요.',
        order: 0,
        published: false,
      },
    });

    const response = await test.app.inject({ method: 'GET', url: '/v1/faq' });

    expect(response.statusCode).toBe(200);

    const items = (response.json() as { items: { key: string; answer: string }[] }).items;

    expect(items.some((item) => item.key === 'price-source')).toBe(true);
    expect(items.some((item) => item.answer === '아직 쓰는 중이에요.')).toBe(false);
    expect(items.find((item) => item.key === 'price-source')!.answer).not.toContain('{{');
  });

  it('회원 추이는 가입과 탈퇴를 그 칸에 세고, 누적에서는 탈퇴를 뺀다', async () => {
    const { headers, userId } = await operator();

    /* 오늘 가입한 계정 하나를 탈퇴 처리한다 — 가입 수는 남고 누적에서는 빠져야 한다. */
    const { rows } = await test.pool.query<{ id: string }>(
      'INSERT INTO structured.users (deleted_at) VALUES (now()) RETURNING id'
    );

    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/members-trend?bucket=day',
      headers,
    });

    expect(response.statusCode).toBe(200);

    const data = response.json() as {
      points: { at: string; signups: number; withdrawals: number; total: number }[];
      current: number;
    };
    const today = data.points.at(-1)!;

    expect(data.points).toHaveLength(14);
    /* 운영자 계정과 탈퇴 계정 둘이 오늘 들어왔다. */
    expect(today.signups).toBeGreaterThanOrEqual(2);
    /* 살아 있는 것은 운영자 하나뿐이다. */
    expect(today.total).toBe(1);
    expect(data.current).toBe(1);
    /*
     * 탈퇴도 그 칸에 센다(2026-09-15 대표 지시로 차트에 같이 그린다). 누적에서
     * 빠지는 것과는 다른 값이다 — 저쪽은 「몇 명이 남았나」이고 이쪽은 「그 칸에
     * 몇 명이 나갔나」다. 방금 만든 계정 하나가 오늘 나갔다.
     */
    expect(today.withdrawals).toBe(1);
    expect(rows[0]!.id).not.toBe(userId);
  });

  /**
   * 카드 그림 — 올리기부터 공개 조회까지.
   *
   * **여기까지 와야 「나온다」고 말할 수 있다.** 열쇠를 저장하는 것으로 끝내면,
   * 파일이 반쪽만 올라갔거나 공개 조회가 막혀 있어도 화면에는 「저장됨」이라고
   * 적힌다. 크롤러는 그 카드를 조용히 버린다.
   */
  it('올린 그림이 공개 주소로 그대로 나온다', async () => {
    const { headers } = await operator();

    const target = await test.app.inject({
      method: 'POST',
      url: '/v1/admin/site-meta/og-image/upload-target',
      headers,
      payload: { mimeType: 'image/png' },
    });

    expect(target.statusCode).toBe(200);

    const { storageKey } = target.json() as { storageKey: string };

    /* 화면은 서명 주소로 저장소에 바로 올린다. 시험에서는 드라이버에 직접 넣는다. */
    const bytes = Buffer.from('89504e470d0a1a0a', 'hex');

    (test.context.storage as LocalStorage).put(storageKey, bytes);

    const committed = await test.app.inject({
      method: 'PUT',
      url: '/v1/admin/site-meta/og-image',
      headers,
      payload: { storageKey },
    });

    expect(committed.statusCode).toBe(200);
    expect(committed.json()).toMatchObject({ ogImageSource: 'upload' });

    /* 카드에 실리는 주소에 `?v=`가 붙어야 새 그림이 새 주소로 나간다. */
    const view = committed.json() as { effective: { ogImageUrl: string } };

    expect(view.effective.ogImageUrl).toMatch(/\/v1\/site-meta\/og-image\?v=\d+$/);

    /* 공개 조회는 로그인 없이 그림을 그대로 내보낸다 — 크롤러는 로그인하지 못한다. */
    const served = await test.app.inject({ method: 'GET', url: '/v1/site-meta/og-image' });

    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toContain('image/png');
    expect(served.rawPayload).toEqual(bytes);

    const cleared = await test.app.inject({
      method: 'DELETE',
      url: '/v1/admin/site-meta/og-image',
      headers,
    });

    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toMatchObject({ ogImageSource: 'default' });
  });

  /* 2026-09-25 대표 지시 — 링크 미리보기 세 벌(app · invite · website)은 서로 섞이지 않는다. */
  it('미리보기 세 벌은 각자 저장되고 서로의 값을 쓰지 않는다', async () => {
    const { headers } = await operator();
    const titles = { app: '앱 카드 제목', invite: '초대 카드 제목', website: '웹사이트 카드 제목' } as const;

    for (const [kind, ogTitle] of Object.entries(titles)) {
      const saved = await test.app.inject({
        method: 'PUT',
        url: `/v1/admin/site-meta?kind=${kind}`,
        headers,
        payload: { ogTitle },
      });
      expect(saved.statusCode).toBe(200);
      expect(saved.json()).toMatchObject({ kind, effective: { ogTitle } });
    }

    for (const [kind, ogTitle] of Object.entries(titles)) {
      const read = await test.app.inject({ method: 'GET', url: `/v1/site-meta?kind=${kind}` });
      expect(read.json()).toMatchObject({ ogTitle });
    }

    /* 벌 이름이 없으면 웹사이트 벌이다 — 웹사이트 빌드 · 옛 번들의 호출과 같다. */
    expect((await test.app.inject({ method: 'GET', url: '/v1/site-meta' })).json()).toMatchObject({
      ogTitle: titles.website,
    });

    /* 초대용 그림을 올려도 다른 벌의 그림은 기본 그대로다. */
    const target = await test.app.inject({
      method: 'POST',
      url: '/v1/admin/site-meta/og-image/upload-target?kind=invite',
      headers,
      payload: { mimeType: 'image/png' },
    });
    const { storageKey } = target.json() as { storageKey: string };
    expect(storageKey).toMatch(/^site-meta\/og-invite-\d+\.png$/);
    (test.context.storage as LocalStorage).put(storageKey, Buffer.from('89504e470d0a1a0a', 'hex'));

    const committed = await test.app.inject({
      method: 'PUT',
      url: '/v1/admin/site-meta/og-image?kind=invite',
      headers,
      payload: { storageKey },
    });
    expect(committed.json()).toMatchObject({ kind: 'invite', ogImageSource: 'upload' });
    expect((committed.json() as { effective: { ogImageUrl: string } }).effective.ogImageUrl).toMatch(
      /\/v1\/site-meta\/og-image\?kind=invite&v=\d+$/
    );

    for (const kind of ['app', 'website']) {
      const view = await test.app.inject({ method: 'GET', url: `/v1/admin/site-meta?kind=${kind}`, headers });
      expect(view.json()).toMatchObject({ ogImageSource: 'default', effective: { ogImageUrl: null } });
    }
    expect((await test.app.inject({ method: 'GET', url: '/v1/site-meta/og-image?kind=invite' })).statusCode).toBe(200);
    expect((await test.app.inject({ method: 'GET', url: '/v1/site-meta/og-image?kind=app' })).statusCode).toBe(404);

    /* 모르는 벌 이름은 받지 않는다 — 조용히 웹사이트 벌을 덮어쓰지 않는다. */
    const unknown = await test.app.inject({
      method: 'PUT',
      url: '/v1/admin/site-meta?kind=landing',
      headers,
      payload: { ogTitle: '엉뚱한 제목' },
    });
    expect(unknown.statusCode).toBe(400);
  });

  it('구간 이름이 아니면 거부한다', async () => {
    const { headers } = await operator();
    const response = await test.app.inject({
      method: 'GET',
      url: '/v1/admin/members-trend?bucket=hour',
      headers,
    });

    expect(response.statusCode).toBe(400);
  });
});
