import { randomBytes } from 'node:crypto';

import type { Pool } from 'pg';

import { hashToken } from './sessions';

/**
 * 이메일 계정. 디자인 핸드오프 v3.12(WP-AUTH-002~007).
 *
 * 소셜 로그인은 제공자가 신원을 확인해주지만 이메일은 서버가 직접 비밀번호를
 * 본다. 그래서 `identity-provider.ts`의 `IdentityProvider`가 아니라 여기 따로 있다 —
 * 세션을 여는 것은 소셜과 같은 `sessions.ts`의 `signIn`이 한다(같은
 * identities 행을 쓰므로 계정·세션 규칙이 갈라지지 않는다).
 */

export type EmailAccount = { identityId: string; userId: string; passwordHash: string };

export async function findEmailAccount(pool: Pool, email: string): Promise<EmailAccount | null> {
  const { rows } = await pool.query<{ id: string; user_id: string; password_hash: string }>(
    `SELECT i.id, i.user_id, c.password_hash
     FROM identity.identities i
     JOIN identity.email_credentials c ON c.identity_id = i.id
     WHERE i.provider = 'email' AND i.subject = $1`,
    [email]
  );
  const row = rows[0];

  return row ? { identityId: row.id, userId: row.user_id, passwordHash: row.password_hash } : null;
}

/**
 * 계정만 만든다 — 세션은 열지 않는다. 만든 뒤 `signIn`이 이 identities 행을 찾아
 * 세션을 연다. 이미 있으면 false.
 */
export async function createEmailAccount(pool: Pool, email: string, passwordHash: string): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      "SELECT 1 FROM identity.identities WHERE provider = 'email' AND subject = $1",
      [email]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');

      return false;
    }

    const user = await client.query<{ id: string }>('INSERT INTO structured.users DEFAULT VALUES RETURNING id');
    const identity = await client.query<{ id: string }>(
      "INSERT INTO identity.identities (user_id, provider, subject, email) VALUES ($1, 'email', $2, $2) RETURNING id",
      [user.rows[0]!.id, email]
    );
    await client.query('INSERT INTO identity.email_credentials (identity_id, password_hash) VALUES ($1, $2)', [
      identity.rows[0]!.id,
      passwordHash,
    ]);

    await client.query('COMMIT');

    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** 메일 문구가 약속한 시간(WP-AUTH-006 "링크는 30분 동안 쓸 수 있어요"). */
export const PASSWORD_RESET_TTL_MINUTES = 30;

/** 재설정 토큰을 만든다. 원문을 돌려주고 DB에는 해시만 남긴다. */
export async function createPasswordReset(pool: Pool, identityId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

  await pool.query(
    'INSERT INTO identity.password_resets (identity_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [identityId, hashToken(token), expiresAt]
  );

  return token;
}

/**
 * 토큰으로 비밀번호를 바꾼다. 한 트랜잭션에서 토큰을 소진하고 해시를 바꾸고
 * 그 사람의 세션을 전부 끊는다 — 비밀번호를 바꾼 사람이 원한 것은 "지금 로그인돼
 * 있는 누군가"를 내보내는 것이기도 하다. 만료·사용됨·없음이면 false.
 */
export async function resetPasswordWithToken(pool: Pool, token: string, passwordHash: string): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const consumed = await client.query<{ identity_id: string; user_id: string }>(
      `UPDATE identity.password_resets r
       SET used_at = now()
       FROM identity.identities i
       WHERE r.token_hash = $1 AND r.used_at IS NULL AND r.expires_at > now() AND i.id = r.identity_id
       RETURNING r.identity_id, i.user_id`,
      [hashToken(token)]
    );
    const row = consumed.rows[0];

    if (!row) {
      await client.query('ROLLBACK');

      return false;
    }

    await client.query(
      `INSERT INTO identity.email_credentials (identity_id, password_hash) VALUES ($1, $2)
       ON CONFLICT (identity_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()`,
      [row.identity_id, passwordHash]
    );
    await client.query('UPDATE identity.sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
      row.user_id,
    ]);

    await client.query('COMMIT');

    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
