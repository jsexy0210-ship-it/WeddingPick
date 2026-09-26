import type { Pool, PoolClient } from 'pg';

import { consentDocKind, type ConsentItem } from '@weddingpick/domain';

type Queryable = Pool | PoolClient;

/**
 * 이 동의가 «어느 판»에 대한 동의였는가.
 *
 * 2026-09-16 대표 지시로 약관 본문이 표로 왔다(0422). 그전까지 동의 기록이 든 것은
 * 코드에 박힌 글자(`draft-2026-09-01`)뿐이었고 표와 이어져 있지 않아, **사용자가
 * 동의한 글이 실제로 어느 행이었는지 댈 수 없었다.**
 *
 * 법적 문서라 그것을 댈 수 있어야 한다는 것이 FAQ와 다른 점이다. 고치면 그만인
 * 글이 아니라, 누가 무엇에 동의했는지가 남아야 한다.
 *
 * **판 이름은 바꾸지 않고 «가리키기»만 더한다.** `user_consents.terms_version`은
 * `routes/signup.ts`의 `loadState`가 `consentVersion(item)`과 맞춰 보는 값이라,
 * 표의 판 이름으로 바꾸면 방금 동의한 사람이 동의하지 않은 것으로 읽힌다. 두 이름을
 * 하나로 합치는 것은 출시 게이트(`packages/domain/src/release-gate.ts`)까지 걸린
 * 일이라 따로 정한다.
 *
 * **공개된 판이 없으면 `null`이다.** 초안을 가리키게 하면 그 뒤 초안이 고쳐지면서
 * 동의한 글이 소리 없이 바뀐다 — 0422의 트리거가 그것을 막고, 여기서는 애초에
 * 가리키지 않는다.
 *
 * **항목 이름과 문서 종류는 같지 않다**(2026-09-26). `pick_certification`의 글은
 * `pick_verification`, `contact_share`의 글은 `contact_sharing`이고, 만 14세 ·
 * 야간 알림은 글이 없다. 이름을 그대로 `terms_doc_kind`로 바꾸면 enum에 없는 값이라
 * 쿼리가 터진다 — `consentDocKind`로 옮기고, 글이 없으면 묻지 않는다.
 */
export async function publishedVersionId(
  db: Queryable,
  item: ConsentItem
): Promise<string | null> {
  const doc = consentDocKind(item);

  if (doc === null) return null;

  const { rows } = await db.query<{ id: string }>(
    `SELECT id
     FROM structured.terms_versions
     WHERE doc = $1::terms_doc_kind AND published_at IS NOT NULL
     ORDER BY published_at DESC
     LIMIT 1`,
    [doc]
  );

  return rows[0]?.id ?? null;
}
