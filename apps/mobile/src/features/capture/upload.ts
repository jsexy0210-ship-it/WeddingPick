import { completeUpload, createUpload, ensureWedding } from '@/api/client';
import type { CapturedPage } from '@/features/capture/types';

/**
 * 촬영한 장들을 올리고 분석을 시작한다.
 *
 * 파일 본체는 API 서버를 거치지 않는다. 서명된 URL로 스토리지에 바로 올리므로
 * 계약서 원본이 지나는 경로가 하나 줄어든다.
 */
export async function uploadForAnalysis(pages: CapturedPage[]): Promise<{ analysisId: string }> {
  const weddingId = await ensureWedding();

  // 크기를 서버에 먼저 알려야 하므로 파일을 읽어둔다. 카메라로 찍은 장은 크기를 모른다.
  const files = await Promise.all(
    pages.map((page) => fetch(page.uri).then((response) => response.blob()))
  );

  const { rawDocumentId, uploads } = await createUpload({
    weddingId,
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

  return completeUpload(rawDocumentId, weddingId);
}
