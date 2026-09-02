import { createHash, randomBytes } from 'node:crypto';

import type { Pool } from 'pg';

import type { VerifiedIdentity } from './identity-provider';

/** 토큰 원문은 저장하지 않는다. DB가 유출돼도 세션을 되살릴 수 없다. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type Session = {
  token: string;
  userId: string;
  expiresAt: Date;
};

/**
 * 제공자가 확인해준 신원으로 계정을 찾거나 만들고 세션을 연다.
 *
 * 같은 사람이 다시 로그인하면 새 계정을 만들지 않는다 — (provider, subject)가 유일 키다.
 *
 * `operatorTtlDays`가 있으면 `is_operator`인 계정에 한해 그 기간을 쓴다.
 * 운영자가 자주 로그인하지 않아도 세션이 유지되도록 한다.
 */
export async function signIn(
  pool: Pool,
  identity: VerifiedIdentity,
  ttlDays: number,
  operatorTtlDays?: number
): Promise<Session> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query<{ user_id: string }>(
      'SELECT user_id FROM identity.identities WHERE provider = $1 AND subject = $2',
      [identity.provider, identity.subject]
    );

    let userId = existing.rows[0]?.user_id;

    if (userId) {
      await client.query(
        `UPDATE identity.identities SET
           last_login_at = now(), email = COALESCE($3, email),
           name = COALESCE($4, name), nickname = COALESCE($5, nickname),
           profile_image_url = COALESCE($6, profile_image_url), gender = COALESCE($7, gender),
           birthday = COALESCE($8, birthday), age_range = COALESCE($9, age_range),
           birth_year = COALESCE($10, birth_year), mobile = COALESCE($11, mobile)
         WHERE provider = $1 AND subject = $2`,
        identityValues(identity)
      );
    } else {
      const created = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );
      userId = created.rows[0]!.id;

      await client.query(
        `INSERT INTO identity.identities
           (user_id, provider, subject, email, name, nickname, profile_image_url, gender,
            birthday, age_range, birth_year, mobile)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [userId, ...identityValues(identity)]
      );
    }

    const socialDisplayName = (identity.profile?.nickname ?? identity.profile?.name)?.trim();
    if (socialDisplayName) {
      await client.query(
        `UPDATE structured.users
         SET display_name = left($2, 5)
         WHERE id = $1 AND display_name_user_set = false`,
        [userId, socialDisplayName]
      );
    }

    let effectiveTtlDays = ttlDays;

    if (operatorTtlDays !== undefined) {
      const { rows } = await client.query<{ is_operator: boolean }>(
        'SELECT is_operator FROM structured.users WHERE id = $1',
        [userId]
      );
      if (rows[0]?.is_operator) {
        effectiveTtlDays = operatorTtlDays;
      }
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + effectiveTtlDays * 24 * 60 * 60 * 1000);

    await client.query(
      'INSERT INTO identity.sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, hashToken(token), expiresAt]
    );

    await client.query('COMMIT');

    return { token, userId, expiresAt };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function identityValues(identity: VerifiedIdentity): Array<string | null> {
  return [
    identity.provider,
    identity.subject,
    identity.email ?? null,
    identity.profile?.name ?? null,
    identity.profile?.nickname ?? null,
    identity.profile?.profileImageUrl ?? null,
    identity.profile?.gender ?? null,
    identity.profile?.birthday ?? null,
    identity.profile?.ageRange ?? null,
    identity.profile?.birthYear ?? null,
    identity.profile?.mobile ?? null,
  ];
}

/**
 * 세션이 가리키는 사람.
 *
 * `activated`를 함께 준다. 통합정책 v3.13 §N-2가 **소셜 로그인 성공만으로 가입을
 * 끝내지 말라**고 정했고, 그러면 "세션은 있는데 가입은 안 끝난" 상태가 실제로
 * 생긴다. 그 상태를 여기서 한 번 읽어두지 않으면 라우트마다 다시 물어보게 되고,
 * 물어보는 것을 잊은 라우트가 바로 정책이 막으려던 구멍이 된다.
 */
export type SessionUser = { userId: string; activated: boolean };

export async function resolveSession(pool: Pool, token: string): Promise<SessionUser | null> {
  const { rows } = await pool.query<{ user_id: string; activated: boolean }>(
    `SELECT s.user_id,
            (a.id IS NOT NULL) AS activated
     FROM identity.active_sessions s
     LEFT JOIN structured.active_users a ON a.id = s.user_id
     WHERE s.token_hash = $1`,
    [hashToken(token)]
  );

  const row = rows[0];

  return row ? { userId: row.user_id, activated: row.activated } : null;
}

export async function signOut(pool: Pool, token: string): Promise<void> {
  await pool.query(
    'UPDATE identity.sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
    [hashToken(token)]
  );
}
