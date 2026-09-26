import { VISIT_NOTE_AUDIO_CONSENT_VERSION, isVisitNoteAudioType } from '@weddingpick/domain';

import {
  ApiError,
  UploadTimeoutError,
  createConsultationUpload,
  uploadConsultationAudioFile,
  type UploadProgress,
} from '@/api/client';
import { pickConsultationAudio } from '@/features/capture/pickers';

/** 서버가 받는 녹음 한 개의 최대 크기. 운영 Nginx `/v1/consultations/`도 같은 값(100m)이다. */
export const CONSULTATION_AUDIO_MAX_BYTES = 100 * 1024 * 1024;

export const CONSULTATION_TOO_LARGE = `파일이 너무 커요. ${Math.floor(CONSULTATION_AUDIO_MAX_BYTES / 1024 / 1024)}MB까지 올릴 수 있어요.`;
export const CONSULTATION_TIMEOUT = '올리는 시간이 너무 길어졌어요. 연결을 확인하고 다시 올려주세요.';
export const CONSULTATION_WRONG_TYPE = '이 형식의 녹음은 읽을 수 없어요.';

export class ConsultationUploadError extends Error {}

export type ConsultationUploadResult = 'uploaded' | 'canceled';

/**
 * 상담 녹음 한 개를 고르고 올린다 — 웨딩노트 «상담기록» 빈 상자와 «상담 추가» 시트가 같이 쓴다.
 *
 * 고르는 창은 OS 파일 선택기다(`expo-document-picker` — 네이티브는 시스템 문서 선택기, 웹은
 * 브라우저 파일 입력). 고르다 닫으면 `'canceled'`. 크기가 넘치거나 올리기에 실패하면
 * `ConsultationUploadError`를 던진다 — 화면이 그 문구를 그대로 보여 준다.
 *
 * **올리는 길은 같은 출처 API 하나다**(2026-09-26). 올릴 자리(`POST /v1/consultations/uploads`)를
 * 받고, 본문을 그 `uploadPath`(`PUT …/audio`)에 올리면 서버가 저장소로 흘려 보내고 도착까지
 * 적는다. 서명 URL로 카카오 Object Storage에 바로 올리던 길은 브라우저 CORS에서 막혔다.
 * 네이티브는 CORS가 없지만 길을 둘로 두지 않는다 — 한쪽만 고장 나면 아무도 모른다.
 *
 * `onProgress`는 본문이 올라가는 비율(0~1)이다. 화면이 «올리는 중…» 옆에 %로 적는다.
 *
 * 동의 버전은 가입 때 받은 필수 동의(«상담 녹음 수집 · 이용», WP-AUTH-010)의 판이다.
 */
export async function uploadConsultationAudio(
  weddingId: string,
  options: { onProgress?: UploadProgress } = {}
): Promise<ConsultationUploadResult> {
  const picked = await pickConsultationAudio();
  if (!picked) return 'canceled';

  if (!isVisitNoteAudioType(picked.mimeType)) {
    throw new ConsultationUploadError(CONSULTATION_WRONG_TYPE);
  }

  if (picked.sizeBytes !== undefined && picked.sizeBytes > CONSULTATION_AUDIO_MAX_BYTES) {
    throw new ConsultationUploadError(CONSULTATION_TOO_LARGE);
  }

  try {
    const file = await fetch(picked.uri).then((response) => response.blob());
    if (file.size > CONSULTATION_AUDIO_MAX_BYTES) throw new ConsultationUploadError(CONSULTATION_TOO_LARGE);

    const target = await createConsultationUpload({
      weddingId,
      mimeType: picked.mimeType,
      byteSize: file.size,
      consentVersion: VISIT_NOTE_AUDIO_CONSENT_VERSION,
    });
    await uploadConsultationAudioFile(target.uploadPath, file, picked.mimeType, {
      onProgress: options.onProgress,
    });
    return 'uploaded';
  } catch (caught) {
    throw new ConsultationUploadError(consultationUploadMessage(caught));
  }
}

/**
 * 실패를 사람이 읽을 문장으로. 운영 Nginx가 먼저 막은 413은 본문이 HTML이라 서버 문장이 없다 —
 * 무엇이 막혔는지(크기)를 적는다. 시간이 넘으면 연결을 보라고 한다.
 */
export function consultationUploadMessage(caught: unknown): string {
  if (caught instanceof ConsultationUploadError) return caught.message;
  if (caught instanceof UploadTimeoutError) return CONSULTATION_TIMEOUT;
  if (caught instanceof ApiError && caught.status === 413) return CONSULTATION_TOO_LARGE;
  /* 서버 415는 왜 막혔는지(형식 · 처음 고른 형식과 다름)를 한국어로 준다. 문장이 없으면 형식 안내. */
  if (caught instanceof ApiError && caught.status === 415) {
    return caught.code === 'internal' ? CONSULTATION_WRONG_TYPE : caught.message;
  }
  if (caught instanceof Error && caught.message) return caught.message;
  return '녹음을 올리지 못했어요.';
}
