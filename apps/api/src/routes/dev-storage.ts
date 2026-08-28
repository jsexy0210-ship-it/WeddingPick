import type { FastifyInstance } from 'fastify';

import type { AppContext } from '../context';
import type { LocalStorage } from '../storage/local';

/**
 * 개발용 파일 받는 곳.
 *
 * 로컬 저장소 드라이버일 때만 붙는다. 실제 서명 URL 대신 이 경로가 나가므로,
 * S3 없이도 업로드 흐름을 끝까지 돌려볼 수 있다. 인증하지 않고 파일을 받으므로
 * 프로덕션 드라이버(s3)에서는 아예 등록되지 않는다.
 */
export function registerDevStorageRoutes(app: FastifyInstance, context: AppContext): void {
  if (context.config.storage.driver !== 'local') {
    return;
  }

  const storage = context.storage as LocalStorage;

  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => {
    done(null, body);
  });

  app.put<{ Params: { key: string } }>('/dev-storage/:key', async (request, reply) => {
    storage.put(decodeURIComponent(request.params.key), request.body as Buffer);

    return reply.status(200).send({ ok: true });
  });
}
