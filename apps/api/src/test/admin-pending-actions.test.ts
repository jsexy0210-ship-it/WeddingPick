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

/*
 * **2026-09-16에 이 세 자리가 열렸다.** 대표 지시 — 「개인정보처리방침 이용약관
 * 마케팅 약관도 동일하게 내가 수정가능하도록 하고」. 전까지는 `termsUnavailable()`이
 * 셋 다 400으로 막았고, 이 시험은 그 막힘을 지키고 있었다.
 *
 * **막힘을 빼면서 시험을 지우지 않는다.** 이 시험이 실제로 보던 것은 「막혀 있는가」가
 * 아니라 «잘못된 입력이 DB까지 가지 않는가»였고, 그 위험은 편집이 열린 지금 더 커졌다.
 * 문서 이름은 주소에서 오고, 통과하면 그다음은 쓰기다.
 */
it.each([
  { method: 'POST' as const, url: '/v1/admin/terms', payload: { doc: 'no-such-doc' } },
  { method: 'PUT' as const, url: '/v1/admin/terms/no-such-doc/clauses/00000000-0000-4000-8000-000000000002' },
  { method: 'POST' as const, url: '/v1/admin/terms/no-such-doc/publish' },
])('$method $url은 DB에 닿기 전에 404다', async (request) => {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(error.toResponse());
    throw error;
  });
  registerAdminRoutes(app, { pool } as unknown as AppContext);
  try {
    const response = await app.inject(request);
    expect(response.statusCode).toBe(404);
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});

/*
 * 공개는 시행일을 받는다. 없이 보내면 DB에 닿기 전에 막힌다 — 표의 CHECK도 막지만
 * 제약 위반은 운영자에게 「내부 오류」로 보이고 무엇을 해야 하는지 말하지 않는다.
 */
it('시행일 없는 공개 요청은 DB에 닿지 않는다', async () => {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(error.toResponse());
    throw error;
  });
  registerAdminRoutes(app, { pool } as unknown as AppContext);
  try {
    const response = await app.inject({ method: 'POST', url: '/v1/admin/terms/terms/publish' });
    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: { message: string } }).error.message).toContain('시행일');
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});

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

it.each([
  'terms',
  'privacy',
  'marketing',
  'pick_verification',
  'consultation_recording',
  'contact_sharing',
])('%s는 약관 문서다', (value) => {
  expect(isDocType(value)).toBe(true);
});

/**
 * 막는 말은 **무엇이 되는지**를 말하는가(v3.27).
 *
 * 「~할 수 없어요」로 끝나면 운영자는 다음에 무엇을 할지 모른 채 화면을 닫는다.
 * 편집이 열린 뒤 남은 막음은 시행일 · 빈 초안 · 공개된 판이고, 셋 다 다음에 할
 * 일이 있는 자리다.
 */
it('공개를 막는 말은 다음에 할 일을 말한다', async () => {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) return reply.status(error.status).send(error.toResponse());
    throw error;
  });
  registerAdminRoutes(app, { pool } as unknown as AppContext);

  try {
    const response = await app.inject({ method: 'POST', url: '/v1/admin/terms/terms/publish' });
    const message = (response.json() as { error: { message: string } }).error.message;

    expect(message).toContain('정해주세요');
    expect(message).not.toMatch(/할 수 없어요\.?$|못해요\.?$/);
  } finally {
    await app.close();
  }
});
