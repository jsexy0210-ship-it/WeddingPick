export type UploadTarget = {
  storageKey: string;
  uploadUrl: string;
  expiresAt: Date;
};

/**
 * 원본 파일 저장소.
 *
 * 파일 본체는 API 서버를 거치지 않는다. 앱이 서명된 URL로 바로 올리므로 계약서 원본이
 * 지나는 경로가 하나 줄어든다.
 */
export type Storage = {
  createUploadTarget(input: {
    storageKey: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<UploadTarget>;

  /** 워커가 문서를 읽을 때. */
  download(storageKey: string): Promise<Buffer>;

  /** 승인된 공개 이미지 조회 URL. 서명 유효기간 동안만 접근 가능. */
  getPublicUrl(storageKey: string, expiresInSeconds: number): Promise<string>;

  /** 자동삭제가 지우는 대상. 서비스정책서 4번. */
  delete(storageKey: string): Promise<void>;
};
