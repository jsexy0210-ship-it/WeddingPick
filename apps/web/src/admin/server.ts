import Fastify, { type FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

import { requireAdmin } from './auth';
import { renderAuditLogPage } from './pages/audit-log';
import { renderAutomationPage } from './pages/automation';
import { renderBriefingPage } from './pages/briefing';
import { renderHomePage } from './pages/home';
import { renderUsersPage } from './pages/users';

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

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).type('text/html').send('<p>없는 경로예요. <a href="/">관리자 홈으로</a></p>');
  });

  return app;
}
