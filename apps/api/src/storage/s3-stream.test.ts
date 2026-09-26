import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';

import { createS3Storage } from './s3';

/**
 * 운영 드라이버(S3 호환 · 카카오 Object Storage)의 `uploadStream`이 **흐름을 그대로 한 번의 PUT으로**
 * 보내는지 본다 — 가짜 S3 끝점을 띄워 SDK가 실제로 보내는 요청을 받는다.
 *
 * 상담 녹음(100MB)을 API가 Buffer로 모으지 않는다는 약속은 이 드라이버가 길이를 알고 흐름을
 * 받아 줄 때만 참이다. SDK가 길이 모르는 흐름을 거절하거나 멀티파트로 바꾸면 여기서 깨진다.
 * 실제 카카오 저장소에 쓰는 시험은 아니다(운영 쓰기 금지) — 그 확인은 배포 뒤 몫이다.
 */
describe('S3 드라이버 흘려 보내기', () => {
  let server: Server;
  let seen: { method?: string; url?: string; headers: IncomingHttpHeaders; body: Buffer }[];

  const saved = { id: process.env.AWS_ACCESS_KEY_ID, secret: process.env.AWS_SECRET_ACCESS_KEY };

  beforeAll(async () => {
    process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
    seen = [];
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        seen.push({
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: Buffer.concat(chunks),
        });
        response.writeHead(200, { etag: '"test"' });
        response.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    process.env.AWS_ACCESS_KEY_ID = saved.id;
    process.env.AWS_SECRET_ACCESS_KEY = saved.secret;
    if (saved.id === undefined) delete process.env.AWS_ACCESS_KEY_ID;
    if (saved.secret === undefined) delete process.env.AWS_SECRET_ACCESS_KEY;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('길이와 형식을 붙여 흐름 하나를 PUT 한 번으로 보낸다', async () => {
    const { port } = server.address() as AddressInfo;
    const storage = createS3Storage({
      bucket: 'test-bucket',
      region: 'kr-central-2',
      endpoint: `http://127.0.0.1:${port}`,
    });
    const parts = [Buffer.alloc(64 * 1024, 1), Buffer.alloc(64 * 1024, 2), Buffer.from('끝')];
    const total = parts.reduce((sum, part) => sum + part.length, 0);

    await storage.uploadStream('consultations/u/c.m4a', Readable.from(parts), {
      mimeType: 'audio/m4a',
      contentLength: total,
    });

    expect(seen).toHaveLength(1);
    const put = seen[0]!;
    expect(put.method).toBe('PUT');
    expect(put.url?.split('?')[0]).toBe('/test-bucket/consultations/u/c.m4a');
    expect(put.headers['content-type']).toBe('audio/m4a');
    expect(put.headers['content-length']).toBe(String(total));
    /* 흐름은 미리 해시할 수 없다 — 본문 서명 없이(TLS 위) 보낸다. 멀티파트 · aws-chunked가 아니다. */
    expect(put.headers['x-amz-content-sha256']).toBe('UNSIGNED-PAYLOAD');
    expect(put.headers['content-encoding'] ?? '').not.toContain('aws-chunked');
    expect(put.body.equals(Buffer.concat(parts))).toBe(true);
  });
});
