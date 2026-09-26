import type { Storage, UploadTarget } from './port';

export type LocalStorage = Storage & {
  /** 테스트에서 파일 내용을 직접 넣는다. */
  put(storageKey: string, bytes: Buffer): void;
  /** 올릴 때 적은 형식. 시험이 «무엇으로 저장됐나»를 본다 — S3의 ContentType 자리다. */
  mimeTypeOf(storageKey: string): string | undefined;
};

/**
 * 개발·테스트용. 내용은 메모리에만 있고 서명도 하지 않는다.
 * 프로덕션에서 쓰면 안 된다.
 *
 * baseUrl은 이 서버가 실제로 듣는 주소여야 한다. 기본 포트를 박아두면 다른 포트로
 * 띄웠을 때 업로드 주소만 조용히 어긋난다.
 */
export function createLocalStorage(baseUrl = 'http://localhost:3000/dev-storage'): LocalStorage {
  const files = new Map<string, Buffer>();
  const mimeTypes = new Map<string, string>();

  return {
    async createUploadTarget({ storageKey, expiresInSeconds }): Promise<UploadTarget> {
      return {
        storageKey,
        uploadUrl: `${baseUrl}/${encodeURIComponent(storageKey)}`,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      };
    },

    async upload(storageKey, bytes, mimeType) {
      files.set(storageKey, bytes);
      mimeTypes.set(storageKey, mimeType);
    },

    /* 개발 · 시험용이라 모아서 담는다. 운영(s3)은 흘려 보낸다. 길이가 다르면 S3처럼 실패한다. */
    async uploadStream(storageKey, body, { mimeType, contentLength }) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);

      if (bytes.length !== contentLength) {
        throw new Error(`본문 길이가 다르다: ${bytes.length} ≠ ${contentLength}`);
      }

      files.set(storageKey, bytes);
      mimeTypes.set(storageKey, mimeType);
    },

    async download(storageKey) {
      const bytes = files.get(storageKey);

      if (!bytes) {
        throw new Error(`파일이 없다: ${storageKey}`);
      }

      return bytes;
    },

    async getPublicUrl(storageKey) {
      return `${baseUrl}/${encodeURIComponent(storageKey)}`;
    },

    async delete(storageKey) {
      files.delete(storageKey);
      mimeTypes.delete(storageKey);
    },

    put(storageKey, bytes) {
      files.set(storageKey, bytes);
    },

    mimeTypeOf(storageKey) {
      return mimeTypes.get(storageKey);
    },
  };
}
