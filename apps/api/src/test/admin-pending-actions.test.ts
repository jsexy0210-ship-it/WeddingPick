import Fastify from 'fastify';
import type { Pool } from 'pg';
import { DISCLOSURE_THRESHOLDS } from '@weddingpick/domain';
import { isDocType, policyRules, setPolicyRules } from '../admin-ops';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { registerAdminRoutes } from '../routes/admin';

// 권한은 기존 DB 통합시험에서 검사한다. 여기서는 운영자도 미연결 기능을 쓸 수 없는지 본다.
jest.mock('../auth/plugin', () => ({
  requireOperatorUser: () => async () => undefined,
  currentUserId: () => '00000000-0000-4000-8000-000000000001',
}));

const pool = { query: jest.fn(), connect: jest.fn() };

beforeEach(() => {
  pool.query.mockReset();
  pool.connect.mockReset();
});

it.each(['public_stage.stage1_min', 'public_stage.stage2_min', 'public_stage.stage3_min'])(
  '%s는 일반 규칙과 섞어 보내도 DB 쓰기 전에 거부한다', async (key) => {
    await expect(setPolicyRules(pool as unknown as Pool, [
      { key: 'automation.dlq_alert_size', value: '20' }, { key, value: '99' },
    ], 'operator')).rejects.toMatchObject({ code: 'invalid_request' });
    expect(pool.connect).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  },
);

it('공개 규칙은 DB에 다른 값이 남아 있어도 실제 공개 기준과 조회 제한을 표시한다', async () => {
  pool.query.mockResolvedValue({ rows: [{
    id: 'public_stage.stage1_min', key: 'public_stage.stage1_min', label: '공개 기준',
    description: '공개 기준', category: '공개', kind: 'number', value: '99', default_value: '99',
    last_changed_at: null, changed_by_name: null,
  }] });
  const data = await policyRules(pool as unknown as Pool);
  expect(data.policies[0]).toMatchObject({
    value: String(DISCLOSURE_THRESHOLDS.limited), readOnlyReason: expect.any(String),
  });
});

it.each([
  { method: 'POST' as const, url: '/v1/admin/terms' },
  { method: 'PUT' as const, url: '/v1/admin/terms/terms/clauses/00000000-0000-4000-8000-000000000002' },
  { method: 'POST' as const, url: '/v1/admin/terms/terms/publish' },
])('$method $url은 약관 연결 전 성공 응답이나 DB 변경을 만들지 않는다', async (request) => {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(error.toResponse());
    throw error;
  });
  registerAdminRoutes(app, { pool } as unknown as AppContext);
  try {
    const response = await app.inject(request);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { message: expect.stringContaining('연결한 뒤 열려요') } });
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});

/*
 * ───────────────────────────────────────────────────────────────────────────
 * 반례 검수 2026-09-11 — 「막았다」가 실제로 막는지 뚫어본 자리들.
 * ───────────────────────────────────────────────────────────────────────────
 */

/**
 * 이름을 살짝 비틀어 가드를 지나가는가.
 *
 * 가드는 키를 정확히 맞춰 본다. 뒤에 공백 하나를 붙이면 그 비교를 지나간다 —
 * 그때 막는 것은 **DB에 그 이름의 줄이 없다는 사실뿐**이다. `key` 열이 언젠가
 * citext가 되거나 누군가 `btrim`을 넣으면 그 마지막 방벽이 사라진다.
 * 그래서 「거부됐다」가 아니라 **DB에 아무것도 쓰이지 않았다**를 본다.
 */
it.each([
  'public_stage.stage1_min ',
  ' public_stage.stage1_min',
  'PUBLIC_STAGE.STAGE1_MIN',
  'Public_Stage.Stage1_Min',
  'public_stage.stage1_min\t',
])('%j로 비틀어도 공개 기준은 써지지 않는다', async (key) => {
  pool.query.mockResolvedValue({ rows: [] });
  pool.connect.mockRejectedValue(new Error('연결이 열리면 안 된다'));

  await expect(
    setPolicyRules(pool as unknown as Pool, [{ key, value: '99' }], 'operator')
  ).rejects.toBeDefined();

  const wrote = pool.query.mock.calls.some(([sql]) => /UPDATE\s+structured\.policy_rules/i.test(String(sql)));
  expect(wrote).toBe(false);
});

/**
 * 프로토타입 이름이 「공개 기준」 행세를 하는가.
 *
 * 객체 리터럴로 두면 `values['__proto__']`도 `values['toString']`도 undefined가
 * 아니다. 막는 쪽에서는 우연히 맞는 답이 나오지만, **조회 쪽에서는 함수가 값이 된다.**
 */
it.each(['__proto__', 'toString', 'constructor', 'valueOf'])(
  '%s는 공개 기준이 아니다 — 조회 값이 함수로 바뀌지 않는다',
  async (key) => {
    pool.query.mockResolvedValue({
      rows: [{
        id: key, key, label: '보통 규칙', description: '보통 규칙', category: '자동화',
        kind: 'number', value: '7', default_value: '7',
        last_changed_at: null, changed_by_name: null,
      }],
    });

    const data = await policyRules(pool as unknown as Pool);
    expect(data.policies[0]).toMatchObject({ value: '7', defaultValue: '7', readOnlyReason: null });
  }
);

/**
 * 주소 자리의 문서 이름도 마찬가지다.
 *
 * `value in DOC_LABEL`이면 `/v1/admin/terms/toString/publish`가 문서로 통과한다.
 * 지금은 바로 뒤에서 막히지만, 편집·공개가 열리는 날 그 길이 함께 열린다.
 */
it.each(['toString', 'constructor', '__proto__', 'valueOf', 'hasOwnProperty'])(
  '%s는 약관 문서가 아니다',
  (value) => {
    expect(isDocType(value)).toBe(false);
  }
);

it.each(['terms', 'privacy', 'marketing'])('%s는 약관 문서다', (value) => {
  expect(isDocType(value)).toBe(true);
});

/**
 * 막힌 자리가 **무엇이 되는지**를 말하는가(v3.27).
 *
 * 「~할 수 없어요」로 끝나면 운영자는 다음에 무엇을 할지 모른 채 화면을 닫는다.
 */
it('약관 편집·공개를 막는 말은 무엇이 되는지 먼저 말한다', async () => {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(error.toResponse());
    throw error;
  });
  registerAdminRoutes(app, { pool } as unknown as AppContext);

  try {
    const response = await app.inject({ method: 'POST', url: '/v1/admin/terms' });
    const message = (response.json() as { error: { message: string } }).error.message;

    expect(message).toContain('조회할 수 있어요');
    expect(message).not.toMatch(/할 수 없어요\.?$|못해요\.?$/);
  } finally {
    await app.close();
  }
});
