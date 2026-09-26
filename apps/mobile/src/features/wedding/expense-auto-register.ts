import type { MyReport, RegisterPaymentProofResponse } from '@weddingpick/api-contract';
import { manwon } from '@weddingpick/domain';

import { Platform } from 'react-native';

import { ApiError, createUpload, grantPaymentConsent, registerPaymentProof, uploadDocumentPage } from '@/api/client';
import type { CapturedPage } from '@/features/capture/types';

import { ourWedding as copy, report as R } from '../../../../../spec/strings.ko.json';
import { noteMonthDay } from './note-format';

/** 서버가 받는 한 장의 최대 크기(`createUploadRequestSchema` · documents.ts `MAX_FILE_SIZE`). */
export const PAYMENT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * 올리기 전에 이 크기 안으로 줄인다 — 운영 Nginx의 요청 본문 기본 상한이 1MB라서 그보다 크면
 * 서버에 닿기도 전에 413으로 막힌다(관리자 OG 카드와 같은 값 · `scripts/install-kakao-app-web.sh`).
 * 긴 변 2000px JPG면 영수증 글자가 읽히면서 이 안에 들어간다. 줄이는 것은 웹(canvas)만 된다 —
 * 네이티브는 이미지 가공 모듈이 없어 원본을 보내고, 그 길은 Nginx `/v1/documents/` 10MB 설정이 받는다.
 */
export const PAYMENT_PHOTO_UPLOAD_BYTES = 950 * 1024;
const PAYMENT_PHOTO_LONG_EDGE = 2000;

/** 서버가 받는 사진 형식(`uploadMimeTypeSchema` 중 사진). PDF는 카메라에서 나오지 않는다. */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/heic'] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

export class ExpensePhotoError extends Error {}

function photoType(mimeType: string): PhotoType | null {
  const normalized = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.toLowerCase();
  return (PHOTO_TYPES as readonly string[]).includes(normalized) ? (normalized as PhotoType) : null;
}

/**
 * 예산 추가 «자동 등록(Pick 인증)» — 찍은 사진 한 장을 올리고 등록한다(2026-09-26 대표 지시).
 *
 * 서버 길은 #535가 앱 화면을 지울 때 그대로 남겨 둔 것이다 — 새 서버 코드도, 새 Gemini 호출
 * 파일도 없다(`gemini-scope.test.ts`):
 *
 *   1. 동의(최초 1회)  `POST /v1/me/payment-consent` — 동의 안내를 본 사람만 여기 온다
 *   2. 원본 자리       `POST /v1/documents/uploads` `kind: payment_proof` — 24시간 뒤 지워진다
 *   3. 올리기          `PUT /v1/documents/:id/pages/0`
 *   4. 등록            `POST /v1/payment-proofs` — 서버가 읽는다(`gemini-payment-reader`).
 *                      읽었으면 `accepted`로 지출내역에 «Pick 인증» 줄이 바로 선다
 *                      (`wedding_expenses` 뷰 · `source = payment_proof`). 못 읽었으면
 *                      `pending_review` — 어디에도 안 들어가고 검수를 기다린다
 *
 * 금액 · 업체 · 날짜를 앱이 보내지 않는다 — 받을 자리가 계약에 없다. 화면은 서버가 읽은 값을
 * 보여 줄 뿐이다.
 */
export async function registerExpensePhoto({
  weddingId,
  photo,
  grantConsent,
}: {
  weddingId: string;
  photo: CapturedPage;
  /** 이번에 동의 안내를 보고 «동의하고 계속»을 눌렀다 — 서버에 동의를 먼저 남긴다. */
  grantConsent: boolean;
}): Promise<RegisterPaymentProofResponse> {
  const mimeType = photoType(photo.mimeType);
  if (!mimeType) throw new ExpensePhotoError('사진(JPG · PNG · HEIC)만 올릴 수 있어요.');
  /* 웹은 아래에서 줄이므로 원본 크기로 미리 막지 않는다. */
  if (Platform.OS !== 'web' && photo.sizeBytes !== undefined && photo.sizeBytes > PAYMENT_PHOTO_MAX_BYTES) {
    throw tooLarge();
  }

  /* 동의를 서버에 남긴 뒤에 올린다. 화면만 지나가게 두면 «동의했다»는 사실이 어디에도 없다. */
  if (grantConsent) await grantPaymentConsent();

  const original = await fetch(photo.uri).then((response) => response.blob());
  const file = await fitPhotoForUpload(original, mimeType);
  if (file.blob.size > PAYMENT_PHOTO_MAX_BYTES) throw tooLarge();

  try {
    const target = await createUpload({
      weddingId,
      kind: 'payment_proof',
      pages: [{ mimeType: file.mimeType, sizeBytes: file.blob.size }],
    });
    for (const upload of target.uploads) {
      await uploadDocumentPage(upload.uploadPath, file.blob);
    }

    return await registerPaymentProof({ rawDocumentId: target.rawDocumentId });
  } catch (caught) {
    /* 운영 Nginx 본문 상한(413)은 본문이 HTML이라 서버 문장이 없다 — 무엇을 하면 되는지 적는다. */
    if (caught instanceof ApiError && caught.status === 413) {
      throw new ExpensePhotoError('사진이 너무 커요. 한 번 더 찍어주세요.');
    }
    throw caught;
  }
}

/**
 * 웹에서 큰 사진을 줄인다 — 긴 변 2000px · JPG, 품질을 내려 가며 `PAYMENT_PHOTO_UPLOAD_BYTES` 안에
 * 드는 첫 값. 이미 작거나 웹이 아니거나 줄일 수 없으면 그대로 돌려준다(크기 판정은 부르는 쪽).
 * 관리자 OG 카드(`admin/og-card.tsx` `fitForUpload`)와 같은 방식이다.
 */
export async function fitPhotoForUpload(
  blob: Blob,
  mimeType: PhotoType
): Promise<{ blob: Blob; mimeType: PhotoType }> {
  if (blob.size <= PAYMENT_PHOTO_UPLOAD_BYTES) return { blob, mimeType };
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return { blob, mimeType };
  }

  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, PAYMENT_PHOTO_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return { blob, mimeType };
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let smallest: Blob | null = null;
    for (const quality of [0.85, 0.75, 0.65, 0.55]) {
      const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!out) continue;
      if (out.size <= PAYMENT_PHOTO_UPLOAD_BYTES) return { blob: out, mimeType: 'image/jpeg' };
      if (!smallest || out.size < smallest.size) smallest = out;
    }
    return smallest && smallest.size < blob.size ? { blob: smallest, mimeType: 'image/jpeg' } : { blob, mimeType };
  } catch {
    /* 브라우저가 이 형식(HEIC 등)을 못 그리면 원본 그대로 — 서버가 받는 형식이다. */
    return { blob, mimeType };
  }
}

function tooLarge(): ExpensePhotoError {
  return new ExpensePhotoError(
    `사진이 너무 커요. ${Math.floor(PAYMENT_PHOTO_MAX_BYTES / 1024 / 1024)}MB까지 올릴 수 있어요.`
  );
}

export type AutoResultField = {
  label: string;
  value: string;
  /** 정본 `mergedFields` 딱지 — 읽은 칸 «읽었어요», 사람이 볼 칸 «확인 필요». */
  tag: string;
  needsCheck: boolean;
};

/**
 * 서버가 읽은 값을 칸 셋으로 — 정본 WP-NOTE-007 `mergedFields`(항목 · 낸 금액)의 «읽었어요 ·
 * 확인 필요» 딱지 모양. 날짜는 2026-09-26 지시(「금액 · 업체 · 날짜 자동 입력」)로 더했다.
 * 못 읽은 칸은 값을 지어내지 않는다 — 딱지 «확인 필요», 칸에는 «확인하고 있어요».
 */
export function autoResultFields(result: RegisterPaymentProofResponse): AutoResultField[] {
  const pending = new Set<string>(result.pendingFields);
  const row = (label: string, field: string, value: string | null): AutoResultField => {
    const needsCheck = pending.has(field) || value === null;
    return {
      label,
      value: value ?? copy['expense.autoPendingValue'],
      tag: needsCheck ? R['tag.needCheck'] : R['tag.read'],
      needsCheck,
    };
  };

  return [
    row(R['field.vendor'], 'merchantName', result.merchantName?.trim() || null),
    row(R['field.amount'], 'paidAmount', result.paidAmount === null ? null : manwon(result.paidAmount)),
    row(R['field.date'], 'paidAt', result.paidAt === null ? null : noteMonthDay(result.paidAt)),
  ];
}

/**
 * 올렸는데 아직 못 읽은 Pick 인증(`pending_review`) — 지출에는 검수가 끝나야 들어가서 지출내역
 * 맨 위에 «확인 중» 줄로 따로 세운다. 내 제보(`GET /v1/me/reports`)의 `needsCheck`가 그 값이다.
 */
export function pendingProofs(reports: readonly MyReport[]): MyReport[] {
  return reports.filter((report) => report.kind === 'payment_proof' && report.needsCheck);
}

/**
 * 결과 화면 한 줄 — 이 결제가 총예산을 넘겨 서버가 총예산을 넘은 만큼 늘렸으면 «총예산을 N만원
 * 늘렸어요»(2026-09-26 대표 결정 「초과되는 금액만큼 총 예산도 늘려」 · 서버 `budget-raise.ts`).
 * 안 늘렸거나 이 칸을 모르는 옛 서버면 null — 줄을 그리지 않는다.
 */
export function budgetRaiseNotice(result: Pick<RegisterPaymentProofResponse, 'budgetRaise'>): string | null {
  const raise = result.budgetRaise;
  if (!raise || !(raise.raisedBy > 0)) return null;
  return copy['expense.budgetRaised'].replace('{amount}', manwon(raise.raisedBy));
}
