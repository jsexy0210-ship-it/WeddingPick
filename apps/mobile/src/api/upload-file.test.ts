import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ApiError,
  CONSULTATION_UPLOAD_TIMEOUT_MS,
  UploadTimeoutError,
  clearReadCache,
  uploadConsultationAudioFile,
  uploadReviewMediaFile,
} from '@/api/client';
import { saveToken } from '@/api/session';

jest.mock('@/api/config', () => ({
  API_URL: 'http://localhost:3000',
  isServerConfigured: true,
}));

type Progress = { lengthComputable: boolean; loaded: number; total: number };

/**
 * 가짜 XMLHttpRequest — 앱이 **어디로 · 무엇을** 보내는지 받아 적고, 시험이 정한 답을 준다.
 * 웹과 RN이 같은 XHR 모양을 쓴다(`upload.onprogress` 포함).
 */
class FakeXHR {
  static sent: FakeXHR[] = [];
  static respond: (xhr: FakeXHR) => void = () => undefined;

  method = '';
  url = '';
  headers: Record<string, string> = {};
  timeout = 0;
  body: unknown;
  status = 0;
  responseText = '';
  upload: { onprogress: ((event: Progress) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  send(body: unknown) {
    this.body = body;
    FakeXHR.sent.push(this);
    FakeXHR.respond(this);
  }

  answer(status: number, text: string) {
    this.status = status;
    this.responseText = text;
    this.onload?.();
  }
}

const RECORD = {
  id: '11111111-1111-4111-8111-111111111111',
  weddingId: '22222222-2222-4222-8222-222222222222',
  vendorId: null,
  vendorLabel: null,
  status: 'SUPPORTED_WEDDING_CONSULTATION',
  category: null,
  confidence: null,
  common: {},
  categoryData: {},
  after: {},
  confirmedAt: null,
  audioDeletedAt: null,
  createdAt: '2026-09-26T00:00:00.000Z',
};

const originalXHR = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
const originalFetch = globalThis.fetch;

beforeEach(async () => {
  await AsyncStorage.clear();
  await saveToken('token');
  clearReadCache();
  FakeXHR.sent = [];
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = FakeXHR;
  /* 저장소로 바로 가는 fetch(서명 URL PUT)가 있으면 여기서 드러난다. */
  globalThis.fetch = jest.fn() as unknown as typeof fetch;
});

afterAll(() => {
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = originalXHR;
  globalThis.fetch = originalFetch;
});

/**
 * 2026-09-26 — 브라우저 → 카카오 Object Storage 서명 URL PUT이 CORS에서 막혔다. 녹음 · 후기 사진은
 * 같은 출처 API 경로로 올린다. 여기서 보는 것: 올리는 곳이 API 경로다 · 인증 · 형식이 붙는다 ·
 * 올라간 비율이 온다 · 413(Nginx HTML) · 시간 초과가 화면이 가를 수 있는 모양으로 온다.
 */
describe('같은 출처 파일 올리기', () => {
  it('상담 녹음은 API 경로에 PUT — 인증 · 형식이 붙고 올라간 비율이 온다', async () => {
    FakeXHR.respond = (xhr) => {
      xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
      xhr.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
      xhr.answer(200, JSON.stringify(RECORD));
    };
    const progress: number[] = [];
    const file = { size: 100 } as Blob;

    const record = await uploadConsultationAudioFile('/v1/consultations/c-1/audio', file, 'audio/m4a', {
      onProgress: (fraction) => progress.push(fraction),
    });

    expect(record.id).toBe(RECORD.id);
    const xhr = FakeXHR.sent[0]!;
    expect(xhr.method).toBe('PUT');
    expect(xhr.url).toBe('http://localhost:3000/v1/consultations/c-1/audio');
    expect(xhr.headers['content-type']).toBe('audio/m4a');
    expect(xhr.headers.authorization).toBe('Bearer token');
    expect(xhr.body).toBe(file);
    expect(xhr.timeout).toBe(CONSULTATION_UPLOAD_TIMEOUT_MS);
    expect(progress).toEqual([0.5, 1]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('운영 Nginx의 413(HTML 본문)은 상태 413의 ApiError로 온다 — 화면이 크기 문장으로 바꾼다', async () => {
    FakeXHR.respond = (xhr) => xhr.answer(413, '<html><body>413 Request Entity Too Large</body></html>');

    const failure = uploadConsultationAudioFile('/v1/consultations/c-1/audio', { size: 1 } as Blob, 'audio/m4a');

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status: 413 });
  });

  it('서버 거절 문장은 그대로 온다(415)', async () => {
    FakeXHR.respond = (xhr) =>
      xhr.answer(415, JSON.stringify({ error: { code: 'invalid_request', message: '이 형식의 녹음은 읽을 수 없어요.' } }));

    await expect(
      uploadConsultationAudioFile('/v1/consultations/c-1/audio', { size: 1 } as Blob, 'audio/m4a')
    ).rejects.toMatchObject({ status: 415, message: '이 형식의 녹음은 읽을 수 없어요.' });
  });

  it('시간이 넘으면 UploadTimeoutError', async () => {
    FakeXHR.respond = (xhr) => xhr.ontimeout?.();

    await expect(
      uploadConsultationAudioFile('/v1/consultations/c-1/audio', { size: 1 } as Blob, 'audio/m4a')
    ).rejects.toBeInstanceOf(UploadTimeoutError);
  });

  it('후기 사진은 API 경로에 POST — 서버가 지은 열쇠를 받는다', async () => {
    FakeXHR.respond = (xhr) =>
      xhr.answer(201, JSON.stringify({ storageKey: 'reviews/u/p.png', mimeType: 'image/png' }));

    const uploaded = await uploadReviewMediaFile({ size: 10 } as Blob, 'image/png');

    expect(uploaded).toEqual({ storageKey: 'reviews/u/p.png', mimeType: 'image/png' });
    const xhr = FakeXHR.sent[0]!;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('http://localhost:3000/v1/reviews/media');
    expect(xhr.headers['content-type']).toBe('image/png');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
