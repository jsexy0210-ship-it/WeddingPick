import type { IncomingMessage } from 'node:http';
import { Readable, Transform, type TransformCallback, pipeline } from 'node:stream';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { Storage } from '../storage/port';

/**
 * 같은 출처 파일 올리기 — 앱이 API에 파일 본문을 그대로 `PUT`/`POST`하면 API가 인증 · 형식 ·
 * 크기를 확인하고 저장소로 **흘려 보낸다**(2026-09-26).
 *
 * **왜 서명 URL이 아닌가.** 카카오 Object Storage의 서명 URL은 브라우저 CORS preflight에서
 * 막힌다 — 결제 증빙에서 먼저 드러났다(e66dec7e · `docs/deployment.md` «파일 저장소»). 상담
 * 녹음과 후기 사진도 같은 길이었다. 네이티브 앱은 CORS가 없어 서명 URL로도 올라가지만, 길을
 * 둘로 두면 한쪽만 고장 나도 모른다 — 웹과 네이티브가 같은 경로를 쓴다.
 *
 * **메모리에 통째로 담지 않는다.** 상담 녹음은 100MB까지다. 본문을 Buffer로 모으면 올리는
 * 사람 몇 명이면 API 프로세스가 메모리를 다 쓴다. 본문 흐름을 저장소 PUT에 바로 잇고,
 * 길이는 Content-Length로 미리 정한다(S3가 길이를 모르는 흐름을 한 번에 받지 않는다).
 *
 * 운영 Nginx가 이 경로의 본문 상한과 시간 제한을 따로 연다(`scripts/install-kakao-app-web.sh`).
 * 기본 1MB면 서버에 닿기 전에 413으로 막힌다.
 */

/**
 * 올리기 경로를 **따로 떼어 낸 범위**에 붙인다 — `pattern`에 맞는 본문은 읽지 않고 흐름 그대로
 * 핸들러에 넘기고, `UploadRejected`는 그 상태 코드(411 · 413 · 415)와 문장 그대로 답한다.
 *
 * 범위를 떼는 이유: 파서를 전역에 붙이면 다른 경로가 같은 형식을 받을 때(관리자 그림 등)
 * 서로 부딪힌다. 여기 붙인 파서와 오류 처리는 이 범위의 경로에만 걸린다. 그 밖의 오류는
 * 바깥(서버 공통) 오류 처리로 그대로 올려 보낸다.
 */
/** 다른 라우트 파일이 전역에 붙이는 문자열 파서(그림 · 서류). 올리기 범위 안에서는 걷어 낸다. */
const INHERITED_BUFFER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'] as const;

export function registerUploadScope(
  app: FastifyInstance,
  pattern: RegExp,
  maxBytes: number,
  routes: (scope: FastifyInstance) => void
): void {
  void app.register(async (scope) => {
    /*
     * 바깥에 같은 형식의 **문자열** 파서가 있으면 Fastify는 정규식보다 그것을 먼저 고른다 —
     * 링크 미리보기(`site-meta.ts`)가 그림 형식을 전역에 자기 상한으로 붙여, 후기 사진이 이
     * 범위의 상한 · 문장 대신 그쪽 413으로 막혔다(2026-09-26 8차 통합). 이 범위 안에서만 걷는다.
     */
    for (const type of INHERITED_BUFFER_TYPES) {
      if (pattern.test(type) && scope.hasContentTypeParser(type)) scope.removeContentTypeParser(type);
    }
    scope.addContentTypeParser(pattern, (_request, payload, done) => done(null, payload));
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof UploadRejected) return sendRejection(reply, error);
      throw error;
    });
    /*
     * **본문을 다 읽기 전에 답하면(401 · 404 · 415 …) 남은 본문을 먼저 받아서 버린다.**
     *
     * Nginx는 위로 보내는 요청에 `Connection: close`를 붙인다. 그러면 Node는 답을 보내자마자
     * 소켓을 닫고, 아직 본문을 쓰던 Nginx는 EPIPE를 맞아 우리 답 대신 **502**를 낸다 — 렌더한 운영
     * Nginx 설정으로 재 보니 거절의 절반쯤이 502로 바뀌었다. 상한 안의 본문은 끝까지 받고 답한다.
     * 상한을 넘는다고 알린 본문은 받지 않고 끊는다(운영에서는 Nginx가 같은 상한으로 먼저 막는다).
     */
    scope.addHook('onSend', async (request, reply) => {
      if (!(await discardBody(request.raw, maxBytes))) reply.header('connection', 'close');
    });
    routes(scope);
  });
}

/**
 * 아직 안 읽은 요청 본문을 끝까지 받아 버린다. 끝까지 받았거나 받을 것이 없으면 true.
 * 상한을 넘는다고 알렸거나 길이를 모르면 받지 않는다(false) — 끊어야 한다.
 */
async function discardBody(raw: IncomingMessage, maxBytes: number): Promise<boolean> {
  if (raw.readableEnded || raw.destroyed) return true;

  const declared = Number(raw.headers['content-length']);
  if (!Number.isSafeInteger(declared) || declared > maxBytes) return false;

  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    /* 보내다 멈춘 사람을 끝없이 기다리지 않는다. */
    const timer = setTimeout(done, 60_000);
    raw.once('end', done);
    raw.once('close', done);
    raw.once('error', done);
    raw.resume();
  });

  return raw.readableEnded;
}

/** 받지 않는 올리기. 상태 코드가 이유를 말한다 — 앱이 413 · 415를 문장으로 바꾼다. */
export class UploadRejected extends Error {
  constructor(
    readonly status: 400 | 411 | 413 | 415,
    message: string
  ) {
    super(message);
    this.name = 'UploadRejected';
  }
}

export type ReceivedUpload = {
  body: Readable;
  /** 요청 머리의 형식(매개변수를 뗀 소문자). 저장소의 ContentType이 된다. */
  mimeType: string;
  contentLength: number;
  /** 세던 흐름이 스스로 끊었으면(알린 길이 초과 · 모자람) 그 이유. 저장이 실패한 뒤 이것부터 본다. */
  rejection(): UploadRejected | null;
};

/** `audio/mp4; codecs=mp4a` → `audio/mp4` */
export function essenceOf(contentType: string | undefined): string {
  return (contentType ?? '').split(';')[0]!.trim().toLowerCase();
}

/**
 * 받기 전에 본다 — 형식(415) · 길이 표시(411) · 상한(413) · 빈 파일(400).
 *
 * 통과하면 본문 흐름을 **세면서** 넘긴다. 알린 길이보다 길면 상한에 걸린 것처럼 끊고(413),
 * 짧으면(연결이 끊김) 저장을 실패시킨다(400). 반쯤 올라간 파일이 «올렸어요»로 남지 않는다.
 */
export function receiveUpload(
  request: FastifyRequest,
  rules: {
    allowed: readonly string[];
    maxBytes: number;
    wrongType: string;
    tooLarge: string;
  }
): ReceivedUpload {
  const mimeType = essenceOf(request.headers['content-type']);

  if (!rules.allowed.includes(mimeType)) {
    throw new UploadRejected(415, rules.wrongType);
  }

  const body = request.body as unknown;

  /*
   * 다른 곳이 같은 형식의 Buffer 파서를 전역에 붙였으면 본문이 Buffer로 온다(개발 저장소 `*` ·
   * 문서 `application/octet-stream`). 그때도 같은 길로 받는다 — 이미 상한 안에서 읽힌 것이다.
   */
  if (Buffer.isBuffer(body)) {
    if (body.length === 0) throw new UploadRejected(400, '올릴 파일이 비어 있어요.');
    if (body.length > rules.maxBytes) throw new UploadRejected(413, rules.tooLarge);
    return {
      body: Readable.from([body]),
      mimeType,
      contentLength: body.length,
      rejection: () => null,
    };
  }

  if (!(body instanceof Readable)) {
    throw new UploadRejected(415, rules.wrongType);
  }

  const declared = request.headers['content-length'];

  if (declared === undefined) {
    throw new UploadRejected(411, '파일 크기를 알 수 없어요. 다시 올려주세요.');
  }

  const contentLength = Number(declared);

  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    throw new UploadRejected(400, '파일 크기를 알 수 없어요. 다시 올려주세요.');
  }
  if (contentLength === 0) throw new UploadRejected(400, '올릴 파일이 비어 있어요.');
  if (contentLength > rules.maxBytes) throw new UploadRejected(413, rules.tooLarge);

  let seen = 0;
  let stopped: UploadRejected | null = null;

  const counted = new Transform({
    transform(chunk: Buffer, _encoding, callback: TransformCallback) {
      seen += chunk.length;
      if (seen > contentLength || seen > rules.maxBytes) {
        stopped = new UploadRejected(413, rules.tooLarge);
        callback(stopped);
        return;
      }
      callback(null, chunk);
    },
    flush(callback: TransformCallback) {
      if (seen !== contentLength) {
        stopped = new UploadRejected(400, '파일이 다 올라오지 않았어요. 다시 올려주세요.');
        callback(stopped);
        return;
      }
      callback();
    },
  });

  /*
   * 올리던 사람이 끊으면 원본 흐름의 오류가 저장소 쪽 흐름까지 가서 PUT이 실패한다(대기로 남지
   * 않는다). 그 실패는 거절이 아니라 오류로 둔다 — 저장소 장애와 같은 얼굴이지만, 운영에서는
   * Nginx가 본문을 다 받은 뒤에 넘겨서(`proxy_request_buffering on`) 여기까지 오지 않는다.
   */
  pipeline(body, counted, () => undefined);

  return { body: counted, mimeType, contentLength, rejection: () => stopped };
}

/** 받은 흐름을 저장소에 쓴다. 세던 흐름이 스스로 끊었으면 그 거절(413 · 400)로 답한다. */
export async function storeUpload(
  storage: Storage,
  storageKey: string,
  upload: ReceivedUpload
): Promise<void> {
  try {
    await storage.uploadStream(storageKey, upload.body, {
      mimeType: upload.mimeType,
      contentLength: upload.contentLength,
    });
  } catch (error) {
    /* 저장소가 도중에 실패하면 세던 흐름과 요청까지 멈춘다 — 받다 만 본문을 붙잡고 있지 않는다. */
    upload.body.destroy();
    throw upload.rejection() ?? error;
  }
}

/** 거절을 보낸다. 남은 본문은 범위의 `onSend`가 받아서 버린 뒤에 나간다. */
export function sendRejection(reply: FastifyReply, rejection: UploadRejected): FastifyReply {
  return reply
    .status(rejection.status)
    .send({ error: { code: 'invalid_request', message: rejection.message } });
}
