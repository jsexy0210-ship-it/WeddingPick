import type { Pool, PoolClient } from 'pg';

/**
 * 기능 중지 스위치를 읽는 쪽.
 *
 * 관리자 화면의 스위치가 실제로 무언가를 끄게 하는 자리다. 지금까지는 `admin.ts`
 * 안의 Map을 껐다 켤 뿐 그 값을 보는 코드가 한 곳도 없었다 — 껐다고 표시돼도
 * 기능은 계속 돌았다.
 *
 * **꺼진 기능은 조용히 성공하지 않는다.** 던져서 멈춘다. 「0건 처리했다」로 끝나면
 * 끈 사람도 안 끈 사람도 화면에서 구분할 수 없고, 그것이 이 스위치가 있는 이유를
 * 통째로 없앤다.
 */
export class FeatureDisabledError extends Error {
  constructor(readonly switchId: string) {
    super(`기능이 관리자에 의해 중지돼 있다: ${switchId}`);
    this.name = 'FeatureDisabledError';
  }
}

type Queryable = Pick<Pool | PoolClient, 'query'>;

/**
 * 꺼져 있으면 던진다. 표나 행이 없으면 **켜진 것으로 본다** — 0095가 아직 적용되지
 * 않은 DB에서 모든 기능이 멈추는 것이 스위치 하나가 안 듣는 것보다 나쁘다.
 * 조회 자체가 실패한 것과 「꺼져 있다」는 구분해서 다룬다.
 */
export async function featureEnabled(db: Queryable, id: string): Promise<boolean> {
  const { rows } = await db.query<{ enabled: boolean }>(
    'SELECT enabled FROM structured.kill_switches WHERE id = $1',
    [id]
  );

  return rows[0]?.enabled !== false;
}

/**
 * 던지는 쪽. 이미 「막혔다」를 표현할 자리가 있는 호출자(분석 워커의 `blocked`처럼)는
 * `featureEnabled`를 쓰고, 그런 자리가 없는 곳은 이걸 써서 멈춘다.
 */
export async function assertFeatureEnabled(db: Queryable, id: string): Promise<void> {
  if (!(await featureEnabled(db, id))) {
    throw new FeatureDisabledError(id);
  }
}
