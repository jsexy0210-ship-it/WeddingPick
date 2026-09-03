import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

import type { AppContext } from './context';
import { ApiError } from './errors';
import { registerAdminRoutes } from './routes/admin';
import { registerAnalysisRoutes } from './routes/analyses';
import { registerCandidateRoutes } from './routes/candidates';
import { registerWeddingPlanRoutes } from './routes/wedding-plan';
import { registerWeddingEventRoutes } from './routes/wedding-events';
import { registerAuthRoutes } from './routes/auth';
import { registerDevStorageRoutes } from './routes/dev-storage';
import { registerDeviceRoutes } from './routes/devices';
import { registerDocumentRoutes } from './routes/documents';
import { registerInquiryRoutes } from './routes/inquiries';
import { registerMyReportRoutes } from './routes/my-reports';
import { registerNotificationRoutes } from './routes/notifications';
import { registerRebuttalRoutes } from './routes/rebuttals';
import { registerRewardRoutes } from './routes/rewards';
import { registerVendorClaimRoutes } from './routes/vendor-claims';
import { registerSettingsRoutes } from './routes/settings';
import { registerTasteRoutes } from './routes/taste';
import { registerWithdrawalRoutes } from './routes/withdrawal';
import { registerSignupRoutes } from './routes/signup';
import { registerPlannerRoutes } from './routes/planners';
import { registerPaymentProofRoutes } from './routes/payment-proofs';
import { registerPriceReportRoutes } from './routes/price-reports';
import { registerReviewRoutes } from './routes/reviews';
import { registerQuoteRoutes } from './routes/quotes';
import { registerRecommendationRoutes } from './routes/recommendations';
import { registerVendorRoutes } from './routes/vendors';
import { registerWeddingInfoRoutes } from './routes/wedding-info';
import { registerExpoRoutes } from './routes/expos';
import { registerWeddingInviteRoutes } from './routes/wedding-invites';
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

    /*
     * 요청이 잘못된 것은 서버 잘못이 아니다.
     *
     * Fastify가 본문 파싱·크기 초과 등에서 붙이는 statusCode를 그대로 쓴다. 이걸
     * 500으로 뭉개면 클라이언트가 고칠 수 있는 실수를 "잠시 후 다시" 라고 안내하고,
     * 진짜 장애가 같은 얼굴로 섞인다.
     */
    const status = (error as { statusCode?: unknown }).statusCode;

    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply
        .status(status)
        .send({ error: { code: 'invalid_request', message: '요청 형식이 올바르지 않습니다.' } });
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

  app.get('/health', async (_request, reply) => {
    // 프로세스가 살아 있는 것만으로는 배포 상태를 보장하지 않는다. DB까지
    // 확인해 Render 헬스체크가 실제로 요청을 처리할 수 있는 인스턴스만 통과시킨다.
    try {
      await context.pool.query('SELECT 1');
      return { ok: true, database: 'ok' as const };
    } catch {
      return reply.status(503).send({ ok: false, database: 'unavailable' as const });
    }
  });

  app.get('/', async () => ({
    name: 'WeddingPick API',
    health: '/health',
    version: 'v1',
  }));

  registerAuthRoutes(app, context);
  registerWeddingRoutes(app, context);
  registerDocumentRoutes(app, context);
  registerAnalysisRoutes(app, context);
  registerQuoteRoutes(app, context);
  registerVerificationRoutes(app, context);
  registerVendorRoutes(app, context);
  registerWeddingInfoRoutes(app, context);
  registerExpoRoutes(app, context);
  registerRecommendationRoutes(app, context);
  registerCandidateRoutes(app, context);
  registerWeddingPlanRoutes(app, context);
  registerWeddingEventRoutes(app, context);
  registerPlannerRoutes(app, context);
  registerInquiryRoutes(app, context);
  registerDeviceRoutes(app, context);
  registerPaymentProofRoutes(app, context);
  registerPriceReportRoutes(app, context);
  registerReviewRoutes(app, context);
  registerWeddingInviteRoutes(app, context);
  registerNotificationRoutes(app, context);
  registerRebuttalRoutes(app, context);
  registerVendorClaimRoutes(app, context);
  registerRewardRoutes(app, context);
  registerMyReportRoutes(app, context);
  registerSettingsRoutes(app, context);
  registerTasteRoutes(app, context);
  registerWithdrawalRoutes(app, context);
  registerSignupRoutes(app, context);
  registerDevStorageRoutes(app, context);
  registerAdminRoutes(app, context);

  // 정적 파일 서빙 (웹앱)
  const distDir = join(__dirname, '../../web/dist');
  if (existsSync(distDir)) {
   app.get('/*', async (_request, reply) => {
     const { readFile } = await import('node:fs/promises');
     try {
       const filePath = join(distDir, _request.url.split('?')[0]);
       // 정적 파일이 있으면 서빙, 없으면 index.html (SPA 라우팅)
       if (existsSync(filePath) && !filePath.includes('..')) {
         const content = await readFile(filePath);
         return reply.type('text/html').send(content);
       }
       // 기본: index.html
       const html = await readFile(join(distDir, 'index.html'));
       return reply.type('text/html').send(html);
     } catch {
       return reply.status(404).send('Not Found');
     }
   });
  }

  return app;
}
