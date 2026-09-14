import type { FastifyInstance, FastifyRequest } from 'fastify';

import { WEDDING_REGIONS, type ActivityEventName, type ActivitySurface } from '@weddingpick/domain';

import type { AppContext } from './context';
import { recordActivity, type ActivityRecord } from './activity-ledger';

/**
 * 서버가 이미 보고 있는 행동을 원장에 담는 자리.
 *
 * **화면을 고치지 않고 담는다.** 지금 RN 화면 스물몇 개가 동시에 다시 그려지는
 * 중이라(2026-09-14 개편), 화면마다 기록 한 줄을 넣어두면 그 화면이 다시 그려질
 * 때 함께 지워진다. 서버가 보는 것은 화면이 바뀌어도 그대로다 — 업체를 열면
 * `/v1/vendors/:vendorId`가 오고, Pick을 담으면 candidates POST가 온다.
 *
 * **`onResponse`다.** 응답은 이미 나갔고, 여기서 하는 일은 큐에 넣는 것뿐이라
 * 사용자가 기다리는 시간에 아무것도 더하지 않는다.
 *
 * **실패한 요청은 담지 않는다.** 2xx만 받는다 — 400으로 거절된 Pick은 담긴 적이
 * 없고, 담기면 원장이 일어나지 않은 일을 적게 된다.
 *
 * 화면 진입(`screen_view`)처럼 서버가 볼 수 없는 것은 앱이 직접 보낸다
 * (`POST /v1/activity/events`, routes/activity.ts).
 */

type Mapped = Omit<ActivityRecord, 'userId'> & {
  eventName: ActivityEventName;
  surface: ActivitySurface;
};

const REGIONS = new Set<string>(WEDDING_REGIONS);

/** 목록에 있는 지역만 받는다. 자유 입력은 2층에서 접을 수 없다. */
function knownRegion(value: unknown): string | null {
  return typeof value === 'string' && REGIONS.has(value.trim()) ? value.trim() : null;
}

function queryString(request: FastifyRequest, key: string): string | null {
  const query = request.query as Record<string, unknown> | undefined;
  const value = query?.[key];

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function param(request: FastifyRequest, key: string): string | null {
  const params = request.params as Record<string, unknown> | undefined;
  const value = params?.[key];

  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * 이 요청이 원장의 어느 줄인가. 아니면 null.
 *
 * 표는 라우트 **패턴**으로 가른다(`/v1/vendors/:vendorId`). 실제 주소로 가르면
 * 업체 id마다 다른 키가 되어 표가 맞지 않는다.
 */
function mapRequest(request: FastifyRequest): Mapped | null {
  const route = request.routeOptions.url;

  if (!route) return null;

  const method = request.method.toUpperCase();

  switch (`${method} ${route}`) {
    /*
     * 검색과 업종 고르기가 같은 주소로 온다. **말을 넣었으면 검색이고, 업종만
     * 골랐으면 업종 고르기다** — 화면에서도 그 둘은 다른 행동이다.
     */
    case 'GET /v1/vendors': {
      const q = queryString(request, 'q');
      const category = queryString(request, 'category');
      const region = knownRegion(queryString(request, 'region'));

      if (q) {
        return {
          eventName: 'search_submitted',
          surface: 'search',
          searchText: q,
          category,
          region,
        };
      }

      if (category) {
        return { eventName: 'category_selected', surface: 'search', category, region };
      }

      /*
       * 말도 업종도 없는 목록 조회는 담지 않는다. 화면이 새로 그려질 때마다 오는
       * 요청이라, 담으면 원장이 「사용자가 한 일」이 아니라 「화면이 한 일」이 된다.
       */
      return null;
    }

    case 'GET /v1/vendors/:vendorId': {
      const vendorId = param(request, 'vendorId');

      if (!vendorId) return null;

      return {
        eventName: 'vendor_viewed',
        surface: 'vendor',
        targetKind: 'vendor',
        targetId: vendorId,
      };
    }

    case 'GET /v1/vendors/compare': {
      const ids = queryString(request, 'ids');
      const count = ids ? new Set(ids.split(',').map((id) => id.trim()).filter(Boolean)).size : 0;

      // 몇 곳인지 모르면 담지 않는다. 0으로 적으면 없던 비교가 생긴다.
      if (count === 0) return null;

      return { eventName: 'compare_started', surface: 'pick', itemCount: count };
    }

    case 'POST /v1/weddings/:weddingId/candidates':
      return { eventName: 'pick_added', surface: 'pick' };

    case 'DELETE /v1/weddings/:weddingId/candidates/:candidateId':
      return { eventName: 'pick_removed', surface: 'pick' };

    case 'POST /v1/payment-proofs':
      return { eventName: 'report_submitted', surface: 'report' };

    case 'POST /v1/weddings/:weddingId/visit-notes':
      return { eventName: 'visit_note_written', surface: 'wedding_note' };

    /*
     * 온보딩 완료. 단계마다 오는 요청이 아니라 「완료」 한 번이라 단계는 마지막
     * 값으로 적는다 — 중간 단계는 앱이 직접 보낸다.
     */
    case 'POST /v1/me/setup':
      return { eventName: 'onboarding_step', surface: 'onboarding', step: ONBOARDING_LAST_STEP };

    case 'POST /v1/me/withdrawal':
      return { eventName: 'withdrawal_requested', surface: 'account' };

    default:
      return null;
  }
}

/**
 * 온보딩 마지막 단계. 화면은 5/5다(핸드오프 v3.21 — 예산이 4/5, 결과가 그다음).
 * 중간 단계를 앱이 보내면 1~4가 함께 남는다.
 */
const ONBOARDING_LAST_STEP = 5;

export function registerActivityHook(app: FastifyInstance, context: AppContext): void {
  app.addHook('onResponse', async (request, reply) => {
    /*
     * 로그인하지 않은 요청은 담지 않는다. 원장은 「회원의 활동」이고, 주인 없는
     * 줄은 대표님이 보실 자리에도 2층에도 쓸 데가 없다.
     */
    const userId = request.userId;

    if (!userId) return;
    if (reply.statusCode < 200 || reply.statusCode >= 300) return;

    const mapped = mapRequest(request);

    if (!mapped) return;

    recordActivity(context.pool, { ...mapped, userId });
  });
}
