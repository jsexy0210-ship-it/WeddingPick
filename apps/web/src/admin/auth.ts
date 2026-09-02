import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';

const REALM = 'weddingpick-admin';

/** 길이가 다르면 바로 비교가 끝나 시간 차이로 앞자리가 새어나간다. 길이부터 맞춘다. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

function unauthorized(reply: FastifyReply): void {
  reply.header('WWW-Authenticate', `Basic realm="${REALM}"`);
  reply.status(401).send('로그인이 필요해요.');
}

/**
 * HTTP Basic Auth. 계정은 `admin` 하나뿐이다.
 *
 * **읽기 전용 화면만 이 뒤에 둔다.** 지우거나 바꾸는 동작(Kill Switch·정책 편집·
 * 롤백 트리거 같은 것)은 계정 하나짜리 공유 비밀로 지킬 만한 것이 아니다 — 그건
 * 나중에 사람별 계정과 결정 기록(structured.decisions)이 갖춰진 뒤에 넣는다.
 */
export function requireAdmin(adminPassword: string) {
  return function (request: FastifyRequest, reply: FastifyReply, done: () => void): void {
    /* Fly.io 헬스체크는 인증 헤더를 보내지 않는다. 이 경로만 예외로 둔다. */
    if (request.url === '/health') {
      done();
      return;
    }

    const header = request.headers.authorization;

    if (!header?.startsWith('Basic ')) {
      unauthorized(reply);
      return;
    }

    const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');

    if (separatorIndex < 0) {
      unauthorized(reply);
      return;
    }

    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);

    if (!safeEqual(username, 'admin') || !safeEqual(password, adminPassword)) {
      unauthorized(reply);
      return;
    }

    done();
  };
}
