import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';

import type { AppContext } from './context';
import { ApiError } from './errors';
import { registerAnalysisRoutes } from './routes/analyses';
import { registerAuthRoutes } from './routes/auth';
import { registerDevStorageRoutes } from './routes/dev-storage';
import { registerDocumentRoutes } from './routes/documents';
import { registerQuoteRoutes } from './routes/quotes';
import { registerVerificationRoutes } from './routes/verification';
import { registerWeddingRoutes } from './routes/weddings';

export function buildServer(context: AppContext): FastifyInstance {
  const app = Fastify({ logger: false });

  // 허용 출처를 적어준 경우에만 CORS를 연다. 비워두면 브라우저에서 부를 수 없다.
  if (context.config.corsOrigins.length > 0) {
    app.register(cors, {
      origin: context.config.corsOrigins,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'],
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.status).send(error.toResponse());
    }

    if (error instanceof ZodError) {
      const details = Object.fromEntries(
        error.issues.map((issue) => [issue.path.join('.') || '_', issue.message])
      );

      return reply
        .status(400)
        .send({ error: { code: 'invalid_request', message: '요청 형식이 올바르지 않습니다.', details } });
    }

    app.log.error(error);

    // 안쪽 사정을 그대로 내보내지 않는다.
    return reply
      .status(500)
      .send({ error: { code: 'internal', message: '잠시 후 다시 시도해주세요.' } });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: 'not_found', message: '없는 경로입니다.' } })
  );

  app.get('/health', async () => ({ ok: true }));

  registerAuthRoutes(app, context);
  registerWeddingRoutes(app, context);
  registerDocumentRoutes(app, context);
  registerAnalysisRoutes(app, context);
  registerQuoteRoutes(app, context);
  registerVerificationRoutes(app, context);
  registerDevStorageRoutes(app, context);

  return app;
}
