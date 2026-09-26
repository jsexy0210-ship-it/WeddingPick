import type { Readable } from 'node:stream';

export type UploadTarget = {
  storageKey: string;
  uploadUrl: string;
  expiresAt: Date;
};

/**
 * 원본 파일 저장소.
 *
 * **브라우저가 올리는 파일은 전부 API를 지나 저장소에 쓴다**(2026-09-26). 카카오 Object
 * Storage의 서명 URL은 브라우저 CORS preflight에서 막힌다(e66dec7e) — 결제 증빙 · 상담 녹음 ·
 * 후기 사진이 같은 출처 API 경로로 올라온다. `createUploadTarget`은 이미 배포된 옛 앱과
 * 관리자 화면(웨딩피드 그림 · OG 카드)이 아직 부르는 자리라 남긴다.
 */
export type Storage = {
  /** @deprecated 브라우저에서 막힌다. 새 코드는 `upload` · `uploadStream`을 쓴다. */
  createUploadTarget(input: {
    storageKey: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<UploadTarget>;

  /** 인증된 문서 업로드를 저장소에 쓴다. */
  upload(storageKey: string, bytes: Buffer, mimeType: string): Promise<void>;

  /**
   * 요청 본문을 **메모리에 통째로 담지 않고** 그대로 흘려 보낸다 — 상담 녹음(100MB)처럼 큰 파일.
   *
   * `contentLength`는 본문 길이와 정확히 같아야 한다. S3는 길이를 모르는 흐름을 한 번의
   * PutObject로 받지 않는다. 부르는 쪽(`routes/stream-upload.ts`)이 요청의 Content-Length로
   * 길이를 정하고, 흐름이 그보다 길거나 짧으면 중간에 끊어 저장을 실패시킨다.
   */
  uploadStream(
    storageKey: string,
    body: Readable,
    input: { mimeType: string; contentLength: number }
  ): Promise<void>;

  /** 워커가 문서를 읽을 때. */
  download(storageKey: string): Promise<Buffer>;

  /** 승인된 공개 이미지 조회 URL. 서명 유효기간 동안만 접근 가능. */
  getPublicUrl(storageKey: string, expiresInSeconds: number): Promise<string>;

  /** 자동삭제가 지우는 대상. 서비스정책서 4번. */
  delete(storageKey: string): Promise<void>;
};
