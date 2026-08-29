import { completeUpload, createUpload, ensureWedding } from '@/api/client';
import type { CapturedPage } from '@/features/capture/types';

/**
 * 촬영한 장들을 올리고 분석을 시작한다.
 *
 * 파일 본체는 API 서버를 거치지 않는다. 서명된 URL로 스토리지에 바로 올리므로
 * 계약서 원본이 지나는 경로가 하나 줄어든다.
 */
export async function uploadForAnalysis(pages: CapturedPage[]): Promise<{ analysisId: string }> {
  const { rawDocumentId, weddingId } = await uploadPages(pages, 'document');

  return completeUpload(rawDocumentId, weddingId);
}

/**
 * 결제내역을 올린다. 분석을 걸지 않는다.
 *
 * 견적서와 다른 길이다. 결제내역은 등록 화면이 값을 확인받은 뒤에 저장하므로,
 * 여기서는 원본만 올리고 id를 돌려준다. `kind`가 `payment_proof`라 **24시간 뒤에
 * 지워진다**(0022) — 종류를 등록할 때가 아니라 올릴 때 정하는 이유가 이것이다.
 */
export async function uploadPaymentProof(pages: CapturedPage[]): Promise<string> {
  const { rawDocumentId } = await uploadPages(pages, 'payment_proof');

  return rawDocumentId;
}

/**
 * 업체 관계자 인증의 사업자 증빙을 올린다.
 *
 * 견적서와 같은 `document`다 — 사람이 심사하는 원본이라 보관 기간도 같다.
 * 심사가 열려 있는 동안에는 파기 일정이 서지 않고(0038), 결론이 난 날부터
 * 30일을 센다.
 */
export async function uploadBusinessDocument(pages: CapturedPage[]): Promise<string> {
  const { rawDocumentId } = await uploadPages(pages, 'document');

  return rawDocumentId;
}

async function uploadPages(
  pages: CapturedPage[],
  kind: 'document' | 'payment_proof'
): Promise<{ rawDocumentId: string; weddingId: string }> {
  const weddingId = await ensureWedding();

  // 크기를 서버에 먼저 알려야 하므로 파일을 읽어둔다. 카메라로 찍은 장은 크기를 모른다.
  const files = await Promise.all(
    pages.map((page) => fetch(page.uri).then((response) => response.blob()))
  );

  const { rawDocumentId, uploads } = await createUpload({
    weddingId,
    kind,
    pages: pages.map((page, index) => ({
      mimeType: page.mimeType,
      sizeBytes: files[index]!.size,
    })),
  });

  await Promise.all(
    uploads.map(async (upload) => {
      const page = pages[upload.pageIndex]!;

      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': page.mimeType },
        body: files[upload.pageIndex]!,
      });

      if (!response.ok) {
        throw new Error(`업로드 실패 (${response.status})`);
      }
    })
  );

  return { rawDocumentId, weddingId };
}
