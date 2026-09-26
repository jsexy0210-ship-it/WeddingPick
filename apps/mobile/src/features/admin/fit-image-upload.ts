import { Platform } from 'react-native';

/**
 * 관리자 화면이 그림을 올리기 전에 크기를 맞춘다.
 *
 * **왜 1MB 안쪽인가.** 관리자 그림은 이제 같은 origin의 API로 올라간다(브라우저 → 저장소
 * 서명 URL `PUT`은 운영에서 CORS로 막힌다 — e66dec7e · `docs/deployment.md` 「파일 저장소」).
 * 그 길목의 운영 Nginx가 `client_max_body_size`를 따로 적지 않아 기본값 1MB에서 요청을
 * 끊는다(`scripts/install-kakao-app-web.sh`). 그보다 크면 서버에 닿기도 전에 413이다.
 *
 * 링크 미리보기(`og-card.tsx`)가 같은 이유로 같은 일을 한다(fix-og-card 브랜치).
 */
export const ADMIN_UPLOAD_MAX_BYTES = 950 * 1024;

/** 서버가 받는 형식(`apps/api/src/routes/admin.ts` `WEDDING_FEED_IMAGE_TYPES`와 같다). */
export const ADMIN_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

/**
 * 너무 큰 그림을 웹에서 줄인다 — 너비 `maxWidth` · JPG. 줄여도 크면 그대로 돌려주고,
 * 크기 판정은 부르는 쪽이 한다(네이티브는 줄이지 않는다 — 관리자는 웹에서 쓴다).
 */
export async function fitImageForUpload(
  blob: Blob,
  mimeType: string,
  maxWidth = 1600
): Promise<{ blob: Blob; mimeType: string }> {
  if (blob.size <= ADMIN_UPLOAD_MAX_BYTES) return { blob, mimeType };
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return { blob, mimeType };
  }

  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) return { blob, mimeType };
  /* JPG에는 투명이 없다 — 투명한 자리가 검게 나가지 않게 흰 바탕을 먼저 깐다. */
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.9, 0.8, 0.7, 0.6]) {
    const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (out && out.size <= ADMIN_UPLOAD_MAX_BYTES) return { blob: out, mimeType: 'image/jpeg' };
  }

  return { blob, mimeType };
}

/**
 * 화면에 적을 오류 문장. 브라우저가 던지는 영문(`Failed to fetch`)과 상태 코드만 든
 * 기본 문장(`API … → 413`)은 그대로 보여주지 않는다 — 운영자가 무엇을 해야 할지 모른다.
 */
export function readableAdminError(error: unknown, fallback: string): string {
  if (error instanceof TypeError) return '서버에 닿지 못했어요. 연결을 확인하고 다시 시도해주세요.';
  if (error instanceof Error && / → 413$/.test(error.message)) {
    return '이미지가 너무 커요. 1MB 안쪽으로 줄여 다시 골라주세요.';
  }
  /* Nginx가 60초에 끊었다(`proxy_read_timeout`). 본문이 HTML이라 문장이 없다. */
  if (error instanceof Error && / → 50[24]$/.test(error.message)) {
    return '응답이 늦어 연결이 끊겼어요. 다시 눌러주세요.';
  }
  if (error instanceof Error && error.message && !/^API \//.test(error.message)) return error.message;
  return fallback;
}
