import type { CapturedPage } from '@/features/capture/types';
import type { DocumentType, VerificationLevel } from '@weddingpick/domain';

/** 저장된 문서 한 장. 촬영 단계의 CapturedPage와 같되 uri가 앱 저장소를 가리킨다. */
export type StoredPage = CapturedPage;

/**
 * 기기에 저장된 문서 묶음. 명세 3.2의 Quote가 서버에 생기기 전까지의 로컬 대응물이다.
 *
 * docType은 AI 문서분류가 정하는 값이라(사업계획서 27번) 분석을 붙이기 전에는 'unknown'이다.
 * 사용자에게 물어보지 않는다 — 제품 원칙 1.
 */
export type DocumentSet = {
  id: string;
  /** ISO 8601 */
  createdAt: string;
  label: string;
  docType: DocumentType;
  verificationLevel: VerificationLevel;
  pages: StoredPage[];
};
