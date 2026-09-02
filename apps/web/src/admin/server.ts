import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { requireAdmin } from './auth';
import { renderAiCostPage } from './pages/ai-cost';
import { renderAuditLogPage } from './pages/audit-log';
import { renderAutomationPage } from './pages/automation';
import { renderBriefingPage } from './pages/briefing';
import { renderDataImportPage } from './pages/data-import';
import { renderHomePage } from './pages/home';
import { renderImagesPage } from './pages/images';
import { renderPriceStatsPage } from './pages/price-stats';
import { renderRewardsPage } from './pages/rewards';
import { renderReviewsPage } from './pages/reviews';
import { renderUsersPage } from './pages/users';
import { renderVendorInquiriesPage } from './pages/vendor-inquiries';
import { renderVendorsPage } from './pages/vendors';
import { renderVocPage } from './pages/voc';

export type AdminServerContext = {
  pool: Pool;
  adminPassword: string;
};

/**
 * 관리자 웹 서버. `apps/api/src/server.ts`와 같은 자리 — 라우트를 한곳에 모아
 * 등록한다. 이 서버가 여는 것은 다섯 개 읽기 전용 화면뿐이다.
 */
export function buildAdminServer(context: AdminServerContext): FastifyInstance {
  const app = Fastify({ logger: false });

  app.addHook('preHandler', requireAdmin(context.adminPassword));

  app.get('/health', async () => ({ ok: true }));

  app.get('/', async (_request, reply) => {
    reply.type('text/html').send(await renderHomePage(context.pool));
  });

  app.get('/briefing', async (_request, reply) => {
    reply.type('text/html').send(await renderBriefingPage(context.pool));
  });

  app.get('/automation', async (_request, reply) => {
    reply.type('text/html').send(await renderAutomationPage(context.pool));
  });

  app.get<{ Querystring: { event?: string } }>('/audit-log', async (request, reply) => {
    reply.type('text/html').send(await renderAuditLogPage(context.pool, request.query.event));
  });

  app.get('/users', async (_request, reply) => {
    reply.type('text/html').send(await renderUsersPage(context.pool));
  });

  app.get('/data-import', async (_request, reply) => {
    reply.type('text/html').send(await renderDataImportPage(context.pool));
  });

  app.get('/price-stats', async (_request, reply) => {
    reply.type('text/html').send(await renderPriceStatsPage(context.pool));
  });

  app.get('/vendors', async (_request, reply) => {
    reply.type('text/html').send(await renderVendorsPage(context.pool));
  });

  app.get('/images', async (_request, reply) => {
    reply.type('text/html').send(await renderImagesPage(context.pool));
  });

  app.get('/voc', async (_request, reply) => {
    reply.type('text/html').send(await renderVocPage(context.pool));
  });

  app.get('/reviews', async (_request, reply) => {
    reply.type('text/html').send(await renderReviewsPage(context.pool));
  });

  app.get('/vendor-inquiries', async (_request, reply) => {
    reply.type('text/html').send(await renderVendorInquiriesPage(context.pool));
  });

  app.get('/rewards', async (_request, reply) => {
    reply.type('text/html').send(await renderRewardsPage(context.pool));
  });

  app.get('/ai-cost', async (_request, reply) => {
    reply.type('text/html').send(await renderAiCostPage(context.pool));
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).type('text/html').send('<p>없는 경로예요. <a href="/">관리자 홈으로</a></p>');
  });

  return app;
}
