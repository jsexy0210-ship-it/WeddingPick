import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { currentUserId, requireOperatorUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { newEventId, recordDecision } from '../decisions';
import { ApiError, notFound } from '../errors';

export function registerAdminUserStateRoutes(app: FastifyInstance, context: AppContext): void {
  for (const action of ['suspend', 'resume'] as const) {
    app.post(`/v1/admin/users/:userId/${action}`, { preHandler: requireOperatorUser(context) }, async (request) => {
      const userId = z.string().uuid().parse((request.params as { userId: string }).userId);
      const { reason } = z.object({ reason: z.string().trim().min(1).max(1000) }).parse(request.body);
      const client = await context.pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query<{ deleted_at: Date | null; protected: boolean }>(
          `SELECT u.deleted_at, (u.is_operator OR EXISTS (
             SELECT 1 FROM structured.admin_accounts a WHERE a.user_id = u.id
           ) OR EXISTS (SELECT 1 FROM identity.identities i WHERE i.user_id = u.id AND i.provider = 'admin')) AS protected
           FROM structured.users u WHERE u.id = $1 FOR UPDATE`, [userId]
        );
        const target = rows[0];
        if (!target) throw notFound('회원');
        if (target.protected) throw new ApiError('forbidden', '관리자 상태는 관리자 계정에서 변경해주세요.');
        if (target.deleted_at) throw new ApiError('conflict', '탈퇴 접수된 계정은 정지 상태를 바꿀 수 없어요.');
        const { rows: updated } = await client.query<{ suspended_at: Date | null }>(
          'UPDATE structured.users SET suspended_at = $2 WHERE id = $1 RETURNING suspended_at',
          [userId, action === 'suspend' ? new Date() : null]
        );
        if (action === 'suspend') await client.query(
          'UPDATE identity.sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]
        );
        await recordDecision(client, {
          eventId: newEventId(), workflow: 'user_account', step: action, subjectKind: 'user', subjectId: userId,
          decider: { kind: 'human', userId: currentUserId(request) }, decision: action,
          reasonCode: reason, evidence: [],
        });
        await client.query('COMMIT');
        return { suspendedAt: updated[0]!.suspended_at?.toISOString() ?? null };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    });
  }
}
