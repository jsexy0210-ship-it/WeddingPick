import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import * as DocumentPicker from 'expo-document-picker';

import { ApiError, UploadTimeoutError, createConsultationUpload, uploadConsultationAudioFile } from '@/api/client';

import { ConsultUploadPrompt } from './consult-upload-prompt';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('@/api/client', () => {
  class ApiError extends Error {
    code: string;
    status: number | null;
    constructor(code: string, message: string, status: number | null = null) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }
  class UploadTimeoutError extends Error {}
  return {
    ApiError,
    UploadTimeoutError,
    createConsultationUpload: jest.fn(),
    uploadConsultationAudioFile: jest.fn(),
  };
});

declare const require: (id: string) => unknown;
declare const __dirname: string;
declare const global: { fetch: unknown };
const { readFileSync } = require('node:fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

const getDocumentAsync = DocumentPicker.getDocumentAsync as unknown as jest.Mock;
const createUpload = createConsultationUpload as unknown as jest.Mock;
const uploadFile = uploadConsultationAudioFile as unknown as jest.Mock;

function flush() {
  return act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
}

/**
 * 2026-09-26 대표 지시 — 상담기록 빈 상자 「녹음 파일을 올려주세요」를 누르면 OS 파일 선택기가
 * 바로 열리고, 첫 녹음이 올라가면 상자가 사라진다.
 */
describe('상담기록 빈 상자 — 누르면 OS 파일 선택기', () => {
  let view: ReactTestRenderer | null = null;
  afterEach(() => {
    if (view) act(() => view!.unmount());
    view = null;
  });

  function render(props: Partial<React.ComponentProps<typeof ConsultUploadPrompt>> = {}) {
    const onUploaded = jest.fn();
    const onMessage = jest.fn();
    act(() => {
      view = create(
        <ConsultUploadPrompt weddingId="w-1" onUploaded={onUploaded} onMessage={onMessage} {...props} />
      );
    });
    return { onUploaded, onMessage };
  }

  const prompt = () => view!.root.findAll((node) => node.props.testID === 'consult-upload-prompt' && typeof node.props.onPress === 'function');

  it('누르면 중간 시트 없이 녹음 파일 선택기(audio/*)를 연다 — 닫으면 상자는 그대로다', async () => {
    getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    const { onUploaded, onMessage } = render();

    expect(prompt()).toHaveLength(1);
    await act(async () => {
      prompt()[0]!.props.onPress();
    });
    await flush();

    expect(getDocumentAsync).toHaveBeenCalledWith(expect.objectContaining({ type: 'audio/*', multiple: false }));
    expect(createUpload).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
    expect(prompt()).toHaveLength(1);
  });

  const PICKED = { uri: 'file:///rec.m4a', mimeType: 'audio/mp4', name: 'rec.m4a', size: 1024 };
  const TARGET = {
    consultationId: 'c-1',
    uploadPath: '/v1/consultations/c-1/audio',
    uploadUrl: 'https://upload.example/put',
  };

  /** 고른 파일을 Blob으로 읽는 fetch만 흉내 낸다 — 저장소로 바로 가는 PUT이 있으면 드러난다. */
  function withFileFetch() {
    const fetchMock = jest.fn(async (_url: string, _init?: { method?: string }) => ({ blob: async () => ({ size: 1024 }) }));
    const originalFetch = global.fetch;
    global.fetch = fetchMock;
    return { fetchMock, restore: () => (global.fetch = originalFetch) };
  }

  async function press() {
    await act(async () => {
      prompt()[0]!.props.onPress();
    });
    await flush();
  }

  it('첫 녹음을 같은 출처 경로로 올리면 상자가 사라지고 목록을 다시 읽는다 — 저장소 서명 URL로는 안 보낸다', async () => {
    getDocumentAsync.mockResolvedValue({ canceled: false, assets: [PICKED] });
    createUpload.mockResolvedValue(TARGET);
    uploadFile.mockResolvedValue({ id: 'c-1' });
    const { fetchMock, restore } = withFileFetch();

    try {
      const { onUploaded, onMessage } = render();
      await press();

      expect(createUpload).toHaveBeenCalledWith(expect.objectContaining({ weddingId: 'w-1', mimeType: 'audio/mp4', byteSize: 1024 }));
      expect(uploadFile).toHaveBeenCalledWith('/v1/consultations/c-1/audio', expect.anything(), 'audio/mp4', expect.objectContaining({ onProgress: expect.any(Function) }));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('file:///rec.m4a');
      expect(fetchMock).not.toHaveBeenCalledWith('https://upload.example/put', expect.anything());
      expect(onMessage).toHaveBeenCalledWith('녹음을 올렸어요');
      expect(onUploaded).toHaveBeenCalledTimes(1);
      expect(prompt()).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('올리는 동안 «올리는 중…» 옆에 올라간 비율을 적는다', async () => {
    getDocumentAsync.mockResolvedValue({ canceled: false, assets: [PICKED] });
    createUpload.mockResolvedValue(TARGET);
    let finish: () => void = () => undefined;
    uploadFile.mockImplementation(
      (_path: string, _file: unknown, _type: string, options: { onProgress: (fraction: number) => void }) =>
        new Promise((resolve) => {
          options.onProgress(0.42);
          finish = () => resolve({ id: 'c-1' });
        })
    );
    const { restore } = withFileFetch();

    try {
      render();
      await press();

      const texts = view!.root.findAll((node) => typeof node.props.children === 'string').map((node) => node.props.children);
      expect(texts).toContain('올리는 중… 42%');

      await act(async () => finish());
      await flush();
    } finally {
      restore();
    }
  });

  it('웹 브라우저가 붙이는 다른 이름(audio/x-m4a)은 서버가 받는 이름으로 바꿔 보낸다', async () => {
    getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ ...PICKED, mimeType: 'audio/x-m4a' }] });
    createUpload.mockResolvedValue(TARGET);
    uploadFile.mockResolvedValue({ id: 'c-1' });
    const { restore } = withFileFetch();

    try {
      render();
      await press();

      expect(createUpload).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'audio/m4a' }));
      expect(uploadFile).toHaveBeenCalledWith(expect.any(String), expect.anything(), 'audio/m4a', expect.anything());
    } finally {
      restore();
    }
  });

  it('읽을 수 없는 형식(audio/webm)은 올리기 전에 이유를 알린다', async () => {
    getDocumentAsync.mockResolvedValue({ canceled: false, assets: [{ ...PICKED, mimeType: 'audio/webm', name: 'rec.webm' }] });
    const { onMessage } = render();
    await press();

    expect(createUpload).not.toHaveBeenCalled();
    expect(onMessage).toHaveBeenCalledWith('이 형식의 녹음은 읽을 수 없어요.');
    expect(prompt()).toHaveLength(1);
  });

  it.each([
    ['운영 Nginx 413', () => new ApiError('internal', '서버와 통신하지 못했습니다.', 413), '파일이 너무 커요. 100MB까지 올릴 수 있어요.'],
    ['시간 초과', () => new UploadTimeoutError(), '올리는 시간이 너무 길어졌어요. 연결을 확인하고 다시 올려주세요.'],
  ])('%s — 한국어 이유를 알리고 상자는 남는다', async (_name, error, message) => {
    getDocumentAsync.mockResolvedValue({ canceled: false, assets: [PICKED] });
    createUpload.mockResolvedValue(TARGET);
    uploadFile.mockRejectedValue(error());
    const { restore } = withFileFetch();

    try {
      const { onUploaded, onMessage } = render();
      await press();

      expect(onMessage).toHaveBeenCalledWith(message);
      expect(onUploaded).not.toHaveBeenCalled();
      expect(prompt()).toHaveLength(1);
    } finally {
      restore();
    }
  });

  it('너무 큰 파일은 올리지 않고 이유를 알린다 — 상자는 남는다', async () => {
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///big.wav', mimeType: 'audio/wav', name: 'big.wav', size: 200 * 1024 * 1024 }],
    });
    const { onUploaded, onMessage } = render();
    await act(async () => {
      prompt()[0]!.props.onPress();
    });
    await flush();

    expect(createUpload).not.toHaveBeenCalled();
    expect(onMessage).toHaveBeenCalledWith('파일이 너무 커요. 100MB까지 올릴 수 있어요.');
    expect(onUploaded).not.toHaveBeenCalled();
    expect(prompt()).toHaveLength(1);
  });

  it('웨딩노트는 기록이 한 건이라도 있으면 상자를 그리지 않는다', () => {
    const screen = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'wedding', 'index.tsx'), 'utf8');
    expect(screen).toMatch(/records\.length === 0 \? \(\s*<ConsultUploadPrompt weddingId=\{weddingId\} onUploaded=\{onUploaded\}/);
    expect(screen).toContain('onUploaded={load}');
    /* 헤더 «상담 추가» 시트도 같은 올리기 함수를 쓴다. */
    const sheet = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'wedding', '[id]', 'consultations', 'upload.tsx'), 'utf8');
    expect(sheet).toContain('uploadConsultationAudio(id, { onProgress: setProgress })');
  });
});
