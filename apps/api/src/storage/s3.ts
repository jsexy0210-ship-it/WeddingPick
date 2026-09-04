import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { Storage } from './port';

/**
 * S3 호환 저장소. AWS 서울 리전을 기본으로 보지만 endpoint만 바꾸면 다른 S3 호환
 * 스토리지에도 붙는다.
 */

/** 단일 문서 페이지의 최대 파일 크기 (10MB) */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function createS3Storage(options: {
  bucket: string;
  region: string;
  endpoint?: string;
}): Storage {
  const client = new S3Client({
    region: options.region,
    ...(options.endpoint && {
      endpoint: options.endpoint,
      forcePathStyle: true,
      // AWS SDK v3.729+ 이후 PutObject에 체크섬을 자동으로 붙인다.
      // B2 등 비-AWS S3 호환 스토리지는 이 헤더를 거절하므로 비활성화한다.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  });

  return {
    async createUploadTarget({ storageKey, mimeType, expiresInSeconds }) {
      // PutObject 메타데이터로 최대 크기 제약 설정
      // 클라이언트가 이 크기를 초과하면 S3에서 요청 거절
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: storageKey,
          ContentType: mimeType,
          // 메타데이터로 최대 크기 전달 (클라이언트 검증용)
          Metadata: {
            'max-file-size': String(MAX_FILE_SIZE),
          },
        }),
        { expiresIn: expiresInSeconds }
      );

      return {
        storageKey,
        uploadUrl,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      };
    },

    async download(storageKey) {
      const result = await client.send(
        new GetObjectCommand({ Bucket: options.bucket, Key: storageKey })
      );

      if (!result.Body) {
        throw new Error(`파일이 비어 있다: ${storageKey}`);
      }

      return Buffer.from(await result.Body.transformToByteArray());
    },

    async delete(storageKey) {
      await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: storageKey }));
    },
  };
}
