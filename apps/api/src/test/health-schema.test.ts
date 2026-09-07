import { schemaState } from '@weddingpick/db';

/**
 * `/health`가 스키마 상태를 함께 보고하는지.
 *
 * 연결되는 것과 쓸 수 있는 것은 다르다. `SELECT 1`만 보던 동안 운영 DB가 코드보다
 * 뒤에 있어도 헬스체크는 초록이었고 인증 API는 전부 500이었다. 확인 자체가 던져서
 * 서비스를 내리면 안 되므로, 조회 실패도 값으로 돌려주는지 함께 본다.
 */
describe('스키마 상태 보고', () => {
  it('밀린 마이그레이션을 pending으로 알린다', async () => {
    const state = await schemaState(async () => ({ rows: [{ version: '0001_init' }] }));

    expect(state.ok).toBe(false);
    expect(state.applied).toBe(1);
    expect(state.expected).toBeGreaterThan(1);
    expect(state.pending.length).toBe(state.expected - 1);
  });

  it('schema_migrations가 없어도 던지지 않고 상태로 돌려준다', async () => {
    const state = await schemaState(async () => {
      throw new Error('relation "public.schema_migrations" does not exist');
    });

    expect(state.ok).toBe(false);
    expect(state.applied).toBe(0);
    expect(state.error).toContain('schema_migrations');
  });
});
