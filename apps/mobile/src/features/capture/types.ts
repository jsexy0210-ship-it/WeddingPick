/** 문서 한 장의 입력 경로. 사업계획서 7번의 세 가지 입력 방식과 대응한다. */
export type CapturedPageSource = 'camera' | 'library' | 'file';

/**
 * 촬영·선택된 문서 한 장.
 *
 * `uri`는 기기 안의 로컬 경로다. 개인정보 처리 파이프라인(서비스정책서 4번)과
 * 원본 문서 처리에 대한 법률 자문이 끝나기 전까지는 업로드하지 않는다.
 */
export type CapturedPage = {
  id: string;
  uri: string;
  mimeType: string;
  source: CapturedPageSource;
  /** 파일/사진에서 불러온 경우의 원본 파일명 */
  name?: string;
  sizeBytes?: number;
};

/** 아직 분석에 넘기지 않은, 작성 중인 문서 묶음. */
export type CaptureDraft = {
  pages: CapturedPage[];
};
