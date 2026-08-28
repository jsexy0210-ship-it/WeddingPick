import type { Storage, UploadTarget } from './port';

/**
 * 개발·테스트용. 서명하지 않고 그럴듯한 URL만 돌려준다.
 * 실제 파일은 저장되지 않으므로 프로덕션에서 쓰면 안 된다.
 */
export function createLocalStorage(baseUrl = 'http://localhost:3000/dev-storage'): Storage {
  const uploaded = new Set<string>();

  return {
    async createUploadTarget({ storageKey, expiresInSeconds }): Promise<UploadTarget> {
      uploaded.add(storageKey);

      return {
        storageKey,
        uploadUrl: `${baseUrl}/${encodeURIComponent(storageKey)}`,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      };
    },

    async delete(storageKey) {
      uploaded.delete(storageKey);
    },
  };
}
