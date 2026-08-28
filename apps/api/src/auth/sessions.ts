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
 */
export async function signIn(
  pool: Pool,
  identity: VerifiedIdentity,
  ttlDays: number
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
        `UPDATE identity.identities SET last_login_at = now(), email = COALESCE($3, email)
         WHERE provider = $1 AND subject = $2`,
        [identity.provider, identity.subject, identity.email ?? null]
      );
    } else {
      const created = await client.query<{ id: string }>(
        'INSERT INTO structured.users DEFAULT VALUES RETURNING id'
      );
      userId = created.rows[0]!.id;

      await client.query(
        `INSERT INTO identity.identities (user_id, provider, subject, email)
         VALUES ($1, $2, $3, $4)`,
        [userId, identity.provider, identity.subject, identity.email ?? null]
      );
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

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

/** 살아 있는 세션이면 사용자 id를, 아니면 null을 준다. */
export async function resolveSession(pool: Pool, token: string): Promise<string | null> {
  const { rows } = await pool.query<{ user_id: string }>(
    'SELECT user_id FROM identity.active_sessions WHERE token_hash = $1',
    [hashToken(token)]
  );

  return rows[0]?.user_id ?? null;
}

export async function signOut(pool: Pool, token: string): Promise<void> {
  await pool.query(
    'UPDATE identity.sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
    [hashToken(token)]
  );
}
