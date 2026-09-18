#!/usr/bin/env bash
set -euo pipefail

container="${KAKAO_API_CONTAINER:-weddingpick-api}"
probe_id="${WP_STORAGE_PROBE_RUN_ID:-manual-$(date -u +%Y%m%dT%H%M%SZ)}"

if [[ ! "$probe_id" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo 'Storage probe id contains unsupported characters.' >&2
  exit 1
fi

sudo -n docker inspect "$container" >/dev/null

sudo -n docker exec -i \
  -e WP_STORAGE_PROBE_RUN_ID="$probe_id" \
  "$container" node <<'NODE'
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function bodyToBuffer(body) {
  if (!body) throw new Error('empty_get_body');
  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function keyStillExists(client, bucket, key) {
  const result = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: key,
    MaxKeys: 5,
  }));
  return (result.Contents ?? []).some((item) => item.Key === key);
}

async function main() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION;
  const endpoint = process.env.S3_ENDPOINT;
  const probeId = process.env.WP_STORAGE_PROBE_RUN_ID;
  if (!bucket || !region || !endpoint || !probeId) {
    throw new Error('storage_probe_config_missing');
  }

  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  const key = `_weddingpick-smoke/storage-rw/${probeId}.txt`;
  const expected = Buffer.from(`weddingpick-storage-smoke:${probeId}\n`, 'utf8');
  let objectMayExist = false;
  let primaryError = null;
  let cleanupError = null;

  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: expected,
      ContentType: 'text/plain; charset=utf-8',
      CacheControl: 'no-store',
    }));
    objectMayExist = true;
    console.log('kakao_storage_put=ok');

    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const actual = await bodyToBuffer(result.Body);
    if (!expected.equals(actual)) throw new Error('storage_probe_body_mismatch');
    console.log('kakao_storage_get=ok');
  } catch (error) {
    primaryError = error;
  } finally {
    if (objectMayExist) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        console.log('kakao_storage_delete=ok');

        let remains = true;
        for (let attempt = 0; attempt < 6; attempt += 1) {
          remains = await keyStillExists(client, bucket, key);
          if (!remains) break;
          await sleep(1000);
        }
        if (remains) throw new Error('storage_probe_cleanup_incomplete');
        console.log('kakao_storage_cleanup=ok');
      } catch (error) {
        cleanupError = error;
      }
    }
  }

  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
}

main().catch((error) => {
  console.error('kakao_storage_rw_probe=failed:' + (error?.name || 'Error'));
  process.exitCode = 1;
});
NODE
