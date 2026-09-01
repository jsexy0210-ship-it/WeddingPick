/**
 * Object Storage 연결 테스트 스크립트.
 *
 * 업로드 → 다운로드 → 삭제 순서로 실제 동작을 확인한다.
 * 환경변수 STORAGE_DRIVER / S3_* / AWS_* 가 올바르면 성공한다.
 *
 * 사용: DATABASE_URL 없이도 돈다 — 저장소만 본다.
 */
import { createS3Storage } from '../apps/api/src/storage/s3.js';

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.S3_REGION;
const ENDPOINT = process.env.S3_ENDPOINT;

if (!BUCKET || !REGION) {
  console.error('S3_BUCKET, S3_REGION 이 필요합니다.');
  process.exit(1);
}

const storage = createS3Storage({ bucket: BUCKET, region: REGION, endpoint: ENDPOINT });

const TEST_KEY = `_test/${Date.now()}.txt`;
const CONTENT = Buffer.from(`weddingpick-storage-test ${new Date().toISOString()}`);

console.log(`버킷  : ${BUCKET}`);
console.log(`엔드포인트: ${ENDPOINT ?? '(AWS 기본)'}`);
console.log(`키    : ${TEST_KEY}`);

// ── 업로드 URL 생성 ──────────────────────────────────────────────
const target = await storage.createUploadTarget({
  storageKey: TEST_KEY,
  mimeType: 'text/plain',
  expiresInSeconds: 60,
});
console.log('\n[1] 서명된 업로드 URL 생성 성공');

// ── 서명 URL로 실제 업로드 ───────────────────────────────────────
const uploadResp = await fetch(target.uploadUrl, {
  method: 'PUT',
  headers: { 'content-type': 'text/plain' },
  body: CONTENT,
});
if (!uploadResp.ok) {
  const text = await uploadResp.text();
  console.error(`[2] 업로드 실패 ${uploadResp.status}: ${text}`);
  process.exit(1);
}
console.log('[2] 업로드 성공');

// ── 다운로드 ─────────────────────────────────────────────────────
const downloaded = await storage.download(TEST_KEY);
if (downloaded.toString() !== CONTENT.toString()) {
  console.error('[3] 다운로드 내용 불일치');
  process.exit(1);
}
console.log('[3] 다운로드·내용 일치 확인');

// ── 삭제 ─────────────────────────────────────────────────────────
await storage.delete(TEST_KEY);
console.log('[4] 삭제 완료');

console.log('\n✔ Object Storage 연결 테스트 통과');
