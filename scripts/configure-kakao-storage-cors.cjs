'use strict';

const UPLOAD_ORIGIN = 'https://210.109.82.212';
const MAX_CORS_RULES = 10;
const VERIFY_ATTEMPTS = 30;
const VERIFY_INTERVAL_MS = 2000;

const UPLOAD_RULE = Object.freeze({
  AllowedOrigins: [UPLOAD_ORIGIN],
  AllowedMethods: ['PUT'],
  AllowedHeaders: ['Content-Type'],
  ExposeHeaders: ['ETag'],
  MaxAgeSeconds: 3600,
});

function withoutUploadOrigin(rule) {
  const origins = (rule.AllowedOrigins ?? []).filter((origin) => origin !== UPLOAD_ORIGIN);
  if (origins.length === (rule.AllowedOrigins ?? []).length) return rule;
  if (origins.length === 0) return null;
  return { ...rule, AllowedOrigins: origins };
}

/**
 * 카카오 Object Storage는 먼저 일치한 Origin 규칙만 검사한다. 업로드 규칙을 맨 앞에
 * 고정하고 뒤 규칙의 같은 Origin은 제거해야 오래된 GET 전용 규칙이 PUT을 가로막지 않는다.
 */
function planUploadCorsRules(currentRules = []) {
  const retained = currentRules.map(withoutUploadOrigin).filter(Boolean);
  const planned = [{ ...UPLOAD_RULE }, ...retained];

  if (planned.length > MAX_CORS_RULES) {
    throw new Error(`storage_cors_rule_limit_exceeded:${planned.length}`);
  }

  return planned;
}

function normalizeRule(rule) {
  return {
    AllowedOrigins: [...(rule.AllowedOrigins ?? [])].sort(),
    AllowedMethods: (rule.AllowedMethods ?? []).map((value) => value.toUpperCase()).sort(),
    AllowedHeaders: (rule.AllowedHeaders ?? []).map((value) => value.toLowerCase()).sort(),
    ExposeHeaders: (rule.ExposeHeaders ?? []).map((value) => value.toLowerCase()).sort(),
    MaxAgeSeconds: Number(rule.MaxAgeSeconds ?? 0),
  };
}

function sameRules(left, right) {
  return JSON.stringify(left.map(normalizeRule)) === JSON.stringify(right.map(normalizeRule));
}

function isMissingCors(error) {
  return (
    error?.name === 'NoSuchCORSConfiguration' ||
    error?.Code === 'NoSuchCORSConfiguration' ||
    error?.$metadata?.httpStatusCode === 404
  );
}

async function loadRules(client, bucket, GetBucketCorsCommand) {
  try {
    const response = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
    return response.CORSRules ?? [];
  } catch (error) {
    if (isMissingCors(error)) return [];
    throw error;
  }
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForAppliedRules(client, bucket, GetBucketCorsCommand, plannedRules) {
  for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt += 1) {
    const appliedRules = await loadRules(client, bucket, GetBucketCorsCommand);
    if (sameRules(appliedRules, plannedRules)) return;
    if (attempt < VERIFY_ATTEMPTS - 1) await wait(VERIFY_INTERVAL_MS);
  }
  throw new Error('storage_cors_readback_mismatch');
}

async function verifyPreflight(endpoint, bucket) {
  const target = new URL(endpoint);
  target.pathname = `/${encodeURIComponent(bucket)}/_weddingpick-cors-probe`;
  target.search = '';

  const response = await fetch(target, {
    method: 'OPTIONS',
    headers: {
      Origin: UPLOAD_ORIGIN,
      'Access-Control-Request-Method': 'PUT',
      'Access-Control-Request-Headers': 'content-type',
    },
  });

  const allowedOrigin = response.headers.get('access-control-allow-origin');
  const allowedMethods = (response.headers.get('access-control-allow-methods') ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase());
  const allowedHeaders = (response.headers.get('access-control-allow-headers') ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase());

  if (allowedOrigin !== UPLOAD_ORIGIN) throw new Error('storage_cors_origin_not_returned');
  if (!allowedMethods.includes('PUT')) throw new Error('storage_cors_put_not_returned');
  if (!allowedHeaders.includes('*') && !allowedHeaders.includes('content-type')) {
    throw new Error('storage_cors_content_type_not_returned');
  }
}

async function waitForPreflight(endpoint, bucket) {
  let lastError;
  for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt += 1) {
    try {
      await verifyPreflight(endpoint, bucket);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < VERIFY_ATTEMPTS - 1) await wait(VERIFY_INTERVAL_MS);
    }
  }
  throw lastError;
}

async function main() {
  const {
    S3Client,
    GetBucketCorsCommand,
    PutBucketCorsCommand,
    DeleteBucketCorsCommand,
  } = require('@aws-sdk/client-s3');

  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  const endpoint = process.env.S3_ENDPOINT;
  if (!bucket || !region || !endpoint) throw new Error('storage_cors_config_missing');

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const previousRules = await loadRules(client, bucket, GetBucketCorsCommand);
  const plannedRules = planUploadCorsRules(previousRules);
  let changed = false;

  try {
    if (!sameRules(previousRules, plannedRules)) {
      await client.send(
        new PutBucketCorsCommand({
          Bucket: bucket,
          CORSConfiguration: { CORSRules: plannedRules },
        })
      );
      changed = true;
    }

    await waitForAppliedRules(client, bucket, GetBucketCorsCommand, plannedRules);
    await waitForPreflight(endpoint, bucket);
    console.log(changed ? 'kakao_storage_upload_cors=updated' : 'kakao_storage_upload_cors=unchanged');
    console.log('kakao_storage_upload_preflight=ok');
  } catch (error) {
    if (changed) {
      try {
        if (previousRules.length > 0) {
          await client.send(
            new PutBucketCorsCommand({
              Bucket: bucket,
              CORSConfiguration: { CORSRules: previousRules },
            })
          );
        } else {
          await client.send(new DeleteBucketCorsCommand({ Bucket: bucket }));
        }
        console.error('kakao_storage_upload_cors=rolled_back');
      } catch (rollbackError) {
        console.error(`kakao_storage_upload_cors_rollback=failed:${rollbackError?.name ?? 'Error'}`);
      }
    }
    throw error;
  }
}

module.exports = {
  MAX_CORS_RULES,
  UPLOAD_ORIGIN,
  UPLOAD_RULE,
  planUploadCorsRules,
  sameRules,
};

if (process.env.WP_EXECUTE_STORAGE_CORS === '1') {
  main().catch((error) => {
    console.error(`kakao_storage_upload_cors=failed:${error?.message ?? error?.name ?? 'Error'}`);
    process.exitCode = 1;
  });
}
