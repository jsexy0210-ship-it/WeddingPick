import { ApiError, UploadTimeoutError, uploadReviewMediaFile } from '@/api/client';

import { REVIEW_PHOTO_TIMEOUT, REVIEW_PHOTO_TOO_LARGE, uploadReviewMedia } from './media-upload';

jest.mock('@/api/client', () => {
  class ApiError extends Error {
    code: string;
    status: number | null;
    constructor(code: string, message: string, status: number | null = null) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }
  class UploadTimeoutError extends Error {}
  return { ApiError, UploadTimeoutError, uploadReviewMediaFile: jest.fn() };
});

declare const global: { fetch: unknown };

const uploadFile = uploadReviewMediaFile as unknown as jest.Mock;
const PAGE = { id: 'p-1', source: 'library' as const, uri: 'blob:photo', mimeType: 'image/jpeg' };

/**
 * 후기 사진 — 2026-09-26부터 같은 출처 API(`POST /v1/reviews/media`)로 올린다. 서명 URL로 저장소에
 * 바로 올리던 길은 브라우저 CORS에서 막혔다.
 */
describe('후기 사진 올리기', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async () => ({ blob: async () => ({ size: 2048 }) }));
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('고른 사진을 API로 올리고 서버가 지은 열쇠를 후기에 싣는다 — 저장소로 바로 가지 않는다', async () => {
    uploadFile.mockResolvedValue({ storageKey: 'reviews/u/k.jpg', mimeType: 'image/jpeg' });

    await expect(uploadReviewMedia(PAGE)).resolves.toEqual({
      storageKey: 'reviews/u/k.jpg',
      mimeType: 'image/jpeg',
      rightsConfirmed: true,
    });
    expect(uploadFile).toHaveBeenCalledWith(expect.objectContaining({ size: 2048 }), 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('blob:photo');
  });

  it('10MB를 넘으면 올리지 않는다', async () => {
    fetchMock.mockResolvedValue({ blob: async () => ({ size: 10 * 1024 * 1024 + 1 }) });

    await expect(uploadReviewMedia(PAGE)).rejects.toThrow(REVIEW_PHOTO_TOO_LARGE);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('운영 Nginx 413 · 시간 초과는 한국어 이유로 바꾼다', async () => {
    uploadFile.mockRejectedValueOnce(new ApiError('internal', '서버와 통신하지 못했습니다.', 413));
    await expect(uploadReviewMedia(PAGE)).rejects.toThrow(REVIEW_PHOTO_TOO_LARGE);

    uploadFile.mockRejectedValueOnce(new UploadTimeoutError());
    await expect(uploadReviewMedia(PAGE)).rejects.toThrow(REVIEW_PHOTO_TIMEOUT);
  });
});
