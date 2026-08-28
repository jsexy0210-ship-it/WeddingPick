import type { Storage, UploadTarget } from './port';

export type LocalStorage = Storage & {
  /** 테스트에서 파일 내용을 직접 넣는다. */
  put(storageKey: string, bytes: Buffer): void;
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

  return {
    async createUploadTarget({ storageKey, expiresInSeconds }): Promise<UploadTarget> {
      return {
        storageKey,
        uploadUrl: `${baseUrl}/${encodeURIComponent(storageKey)}`,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      };
    },

    async download(storageKey) {
      const bytes = files.get(storageKey);

      if (!bytes) {
        throw new Error(`파일이 없다: ${storageKey}`);
      }

      return bytes;
    },

    async delete(storageKey) {
      files.delete(storageKey);
    },

    put(storageKey, bytes) {
      files.set(storageKey, bytes);
    },
  };
}
