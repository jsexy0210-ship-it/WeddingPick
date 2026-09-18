import type { FastifyInstance } from 'fastify';

import { currentUserId, requireUser } from '../auth/plugin';
import type { AppContext } from '../context';
import {
  listWeddingFeedScraps,
  removeWeddingFeedScrap,
  saveWeddingFeedScrap,
  weddingFeedScrapState,
} from '../scraps';

export function registerScrapRoutes(app: FastifyInstance, context: AppContext): void {
  const auth = { preHandler: requireUser(context) };

  app.get('/v1/me/scraps', auth, async (request) =>
    listWeddingFeedScraps(context.pool, context.storage, currentUserId(request))
  );

  app.get<{ Params: { postId: string } }>(
    '/v1/me/scraps/:postId',
    auth,
    async (request) =>
      weddingFeedScrapState(context.pool, currentUserId(request), request.params.postId)
  );

  app.put<{ Params: { postId: string } }>(
    '/v1/me/scraps/:postId',
    auth,
    async (request) =>
      saveWeddingFeedScrap(context.pool, currentUserId(request), request.params.postId)
  );

  app.delete<{ Params: { postId: string } }>(
    '/v1/me/scraps/:postId',
    auth,
    async (request) =>
      removeWeddingFeedScrap(context.pool, currentUserId(request), request.params.postId)
  );
}
