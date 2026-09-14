import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { schemaState } from '@weddingpick/db';
import { FeatureDisabledError } from './kill-switches';
import { ZodError } from 'zod';

import type { AppContext } from './context';
import { ApiError } from './errors';
import { registerAdminAccountRoutes } from './routes/admin-accounts';
import { registerAdminLoginRoutes } from './routes/admin-login';
import { registerAdminRoutes } from './routes/admin';
import { registerAnalysisRoutes } from './routes/analyses';
import { registerAppRoutes } from './routes/app';
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
import { registerSiteMetaRoutes } from './routes/site-meta';
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
  /*
   * 로그를 켠다. 꺼두면 `app.log.error`가 아무 일도 하지 않아, 500이 나도
   * 배포 로그에 아무것도 남지 않는다 — 실제로 카카오 로그인이 500으로 막혔을 때
   * 서버에도 클라이언트에도 단서가 하나도 없었다.
   *
   * 기본은 `warn`이다. `info`로 두면 헬스체크 요청까지 매번 찍혀 정작 봐야 할
   * 오류가 묻힌다. 파고들 때만 LOG_LEVEL=info로 올린다.
   *
   * 토큰이 로그로 새지 않게 인증 헤더는 지운다. 값 자체를 남길 이유가 없다.
   */
  const app = Fastify({
    /*
     * **Render는 프록시 뒤에 있다.** 이것이 없으면 `request.ip`가 모든 요청에서
     * 프록시 주소 하나로 같아진다. 관리자 로그인의 밀어보기 방어가 IP로 세는데,
     * 그러면 남이 다섯 번 틀린 것 때문에 진짜 관리자가 기다리게 된다 — 방어가
     * 그대로 남을 막는 도구가 된다.
     */
    trustProxy: true,
    logger: {
      level: process.env.LOG_LEVEL ?? 'warn',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'headers.authorization', 'headers.cookie'],
    },
  });

  // 허용 출처를 적어준 경우에만 CORS를 연다. 비워두면 브라우저에서 부를 수 없다.
  if (context.config.corsOrigins.length > 0) {
    app.register(cors, {
      origin: context.config.corsOrigins,
      // 관리자 화면은 PATCH로 바꾼다(kill-switch·users·vendors·ads·policy-engine).
      // 빠져 있으면 preflight에서 전부 막혀 화면에서 아무것도 끌 수 없다.
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    });
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.status).send(error.toResponse());
    }

    /*
     * 관리자가 끈 기능이다. 고장이 아니라 지금 일부러 멈춰 둔 것이므로 500이 아니다 —
     * 500으로 내려주면 화면이 "다시 시도해주세요"라고 말하고, 다시 시도해도 같다.
     * 무엇을 껐는지는 로그에만 남긴다.
     */
    if (error instanceof FeatureDisabledError) {
      request.log.warn({ switchId: error.switchId }, '중지된 기능이 호출됐다');

      return reply
        .status(503)
        .send({ error: { code: 'feature_disabled', message: '지금은 사용할 수 없는 기능입니다.' } });
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

    request.log.error(error);

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

      /*
       * 연결되는 것과 쓸 수 있는 것은 다르다. `SELECT 1`만 보던 동안 운영 DB의
       * 스키마가 코드보다 뒤에 있어도 헬스체크는 초록이었고, 인증 API는 전부
       * 500이었다. 무엇이 밀렸는지 여기서 바로 보이게 한다.
       *
       * 밀렸다고 503을 주지는 않는다 — Render 헬스체크가 실패하면 인스턴스가
       * 계속 교체되어, 정작 확인하려던 것을 볼 수 없게 된다. 상태만 알리고
       * 판단은 사람이 한다.
       */
      const schema = await schemaState((sql) => context.pool.query(sql));

      if (!schema.ok) {
        app.log.warn(
          { applied: schema.applied, expected: schema.expected, pending: schema.pending.slice(0, 10) },
          '운영 DB 스키마가 코드보다 뒤에 있다'
        );
      }

      return { ok: true, database: 'ok' as const, schema };
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
  registerAppRoutes(app, context);
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
  registerSiteMetaRoutes(app, context);
  registerAdminLoginRoutes(app, context);
  registerTasteRoutes(app, context);
  registerWithdrawalRoutes(app, context);
  registerSignupRoutes(app, context);
  registerDevStorageRoutes(app, context);
  registerAdminRoutes(app, context);
  registerAdminAccountRoutes(app, context);

  // 정적 파일 서빙 (웹앱) - API는 이미 위에 등록되어 있으므로 마지막에 캐치올 추가
  app.get('/*', async (_request, reply) => {
   const { readFile } = await import('node:fs/promises');
   const { join } = await import('node:path');
   const { existsSync } = await import('node:fs');
    
   try {
     // 절대 경로로 dist 디렉터리 계산
     const distDir = join(process.cwd(), 'apps/web/dist');
     const reqPath = _request.url.split('?')[0] || '/';
     const filePath = join(distDir, reqPath.startsWith('/') ? reqPath.slice(1) : reqPath);
      
     // 경로 이탈 방지 및 정적 파일 확인
     if (!filePath.startsWith(distDir)) {
       return reply.status(404).send('Not Found');
     }
      
     if (existsSync(filePath)) {
       const content = await readFile(filePath);
       const ext = filePath.split('.').pop() || '';
       const mimeTypes: Record<string, string> = {
         html: 'text/html',
         js: 'application/javascript',
         css: 'text/css',
         json: 'application/json',
         svg: 'image/svg+xml',
         png: 'image/png',
         jpg: 'image/jpeg',
         ico: 'image/x-icon',
       };
       return reply.type(mimeTypes[ext] || 'application/octet-stream').send(content);
     }
      
     // 파일 없으면 index.html (SPA 라우팅)
     const html = await readFile(join(distDir, 'index.html'));
     return reply.type('text/html').send(html);
   } catch {
     return reply.status(404).send('Not Found');
   }
  });

  return app;
}
