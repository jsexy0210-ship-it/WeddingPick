import type { WithdrawalNotice, WithdrawalResult } from '@weddingpick/api-contract';
import {
  deletedOnWithdrawal,
  separatedOnWithdrawal,
  withdrawalDoneItems,
  withdrawalLead,
} from '@weddingpick/domain';
import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import { ApiError } from '../errors';
import { WithdrawalRefused, countForWithdrawal, withdraw } from '../withdrawal';

/**
 * 회원탈퇴. 디자인 핸드오프 WP-MY-008.
 *
 * **줄을 서버가 만든다.** 문구가 화면 · 이용약관 제12조 · 개인정보처리방침에서 같은
 * 말을 해야 하는데, 화면마다 조립하면 언젠가 갈라진다. 갈라진 뒤에는 어느 쪽이
 * 우리가 실제로 하는 일인지 아무도 답할 수 없다.
 */
export function registerWithdrawalRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get('/v1/me/withdrawal', auth, async (request): Promise<WithdrawalNotice> => {
    const counts = await countForWithdrawal(context.pool, currentUserId(request));

    return {
      lead: withdrawalLead(counts),
      hasPartner: counts.hasPartner,
      deleted: deletedOnWithdrawal(counts),
      separated: separatedOnWithdrawal(counts),
      done: withdrawalDoneItems(counts),
    };
  });

  app.post('/v1/me/withdrawal', auth, async (request): Promise<WithdrawalResult> => {
    const userId = currentUserId(request);

    /*
     * 완료 화면이 적을 줄을 **지우기 전에** 만든다. 지운 뒤에는 셀 것이 없다 —
     * 무엇을 했는지 말해주려면 하기 전에 세어둬야 한다.
     */
    const counts = await countForWithdrawal(context.pool, userId);
    const done = withdrawalDoneItems(counts);

    try {
      const { completed } = await withdraw(context, userId);

      return { completed, done };
    } catch (error) {
      if (error instanceof WithdrawalRefused) {
        throw new ApiError('invalid_request', error.message);
      }

      throw error;
    }
  });
}
