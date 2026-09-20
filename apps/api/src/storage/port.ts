export type UploadTarget = {
  storageKey: string;
  uploadUrl: string;
  expiresAt: Date;
};

/**
 * 원본 파일 저장소.
 *
 * 브라우저 문서 업로드는 API가 인증과 크기를 확인한 뒤 저장소에 쓴다. 후기 이미지처럼
 * 직접 업로드가 필요한 곳은 서명 URL을 계속 사용할 수 있다.
 */
export type Storage = {
  createUploadTarget(input: {
    storageKey: string;
    mimeType: string;
    expiresInSeconds: number;
  }): Promise<UploadTarget>;

  /** 인증된 문서 업로드를 저장소에 쓴다. */
  upload(storageKey: string, bytes: Buffer, mimeType: string): Promise<void>;

  /** 워커가 문서를 읽을 때. */
  download(storageKey: string): Promise<Buffer>;

  /** 승인된 공개 이미지 조회 URL. 서명 유효기간 동안만 접근 가능. */
  getPublicUrl(storageKey: string, expiresInSeconds: number): Promise<string>;

  /** 자동삭제가 지우는 대상. 서비스정책서 4번. */
  delete(storageKey: string): Promise<void>;
};
