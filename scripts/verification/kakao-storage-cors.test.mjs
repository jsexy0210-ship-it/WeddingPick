import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  MAX_CORS_RULES,
  UPLOAD_ORIGIN,
  UPLOAD_RULE,
  planUploadCorsRules,
} = require('../configure-kakao-storage-cors.cjs');

test('브라우저 결제 증빙 PUT에 필요한 Origin, 메서드, 헤더를 좁게 허용한다', () => {
  assert.deepEqual(UPLOAD_RULE, {
    AllowedOrigins: ['https://210.109.82.212'],
    AllowedMethods: ['PUT'],
    AllowedHeaders: ['Content-Type'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 3600,
  });
});

test('업로드 규칙을 먼저 두고 다른 Origin의 기존 정책은 보존한다', () => {
  const oldRule = {
    AllowedOrigins: [UPLOAD_ORIGIN, 'https://admin.example.com'],
    AllowedMethods: ['GET'],
    AllowedHeaders: ['*'],
  };
  const wildcardRule = { AllowedOrigins: ['*'], AllowedMethods: ['GET'] };

  assert.deepEqual(planUploadCorsRules([oldRule, wildcardRule]), [
    { ...UPLOAD_RULE },
    { ...oldRule, AllowedOrigins: ['https://admin.example.com'] },
    wildcardRule,
  ]);
});

test('카카오 스토리지의 최대 규칙 수를 넘기면 기존 정책을 덮어쓰지 않는다', () => {
  const rules = Array.from({ length: MAX_CORS_RULES }, (_, index) => ({
    AllowedOrigins: [`https://origin-${index}.example.com`],
    AllowedMethods: ['GET'],
  }));

  assert.throws(() => planUploadCorsRules(rules), /storage_cors_rule_limit_exceeded/);
});

test('API 배포가 버킷 정책 적용과 preflight 검증을 호출한다', () => {
  const workflow = readFileSync('.github/workflows/deploy-kakao-api.yml', 'utf8');
  const wrapper = readFileSync('scripts/configure-kakao-storage-cors.sh', 'utf8');
  const runtime = readFileSync('scripts/configure-kakao-storage-cors.cjs', 'utf8');

  assert.match(workflow, /bash scripts\/configure-kakao-storage-cors\.sh/);
  assert.match(workflow, /configure-kakao-storage-cors\\\.\(sh\|cjs\)/);
  assert.match(wrapper, /docker exec -i/);
  assert.match(runtime, /Access-Control-Request-Method': 'PUT'/);
  assert.match(runtime, /Access-Control-Request-Headers': 'content-type'/);
  assert.match(runtime, /kakao_storage_upload_preflight=ok/);
});
