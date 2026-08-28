import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { Storage } from './port';

/**
 * S3 호환 저장소. AWS 서울 리전을 기본으로 보지만 endpoint만 바꾸면 다른 S3 호환
 * 스토리지에도 붙는다.
 */
export function createS3Storage(options: {
  bucket: string;
  region: string;
  endpoint?: string;
}): Storage {
  const client = new S3Client({
    region: options.region,
    ...(options.endpoint && { endpoint: options.endpoint, forcePathStyle: true }),
  });

  return {
    async createUploadTarget({ storageKey, mimeType, expiresInSeconds }) {
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: storageKey,
          ContentType: mimeType,
        }),
        { expiresIn: expiresInSeconds }
      );

      return {
        storageKey,
        uploadUrl,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      };
    },

    async delete(storageKey) {
      await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: storageKey }));
    },
  };
}
