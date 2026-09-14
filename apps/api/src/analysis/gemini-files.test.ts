import {
  INLINE_MAX_BYTES,
  deleteGeminiFile,
  needsFilesApi,
  uploadGeminiFile,
  waitUntilActive,
} from './gemini-files';

/**
 * 실제로 부르지 않는다. **무엇을 보내고 무엇을 받아 어떻게 푸는지**만 본다.
 */

const KEY = '시험용-가짜-키';

function install(impl: jest.Mock): jest.Mock {
  global.fetch = impl as unknown as typeof fetch;

  return impl;
}

const noSleep = async () => {};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('올릴지 말지', () => {
  it('한도 아래면 본문에 실어 보낸다', () => {
    expect(needsFilesApi(INLINE_MAX_BYTES)).toBe(false);
    expect(needsFilesApi(INLINE_MAX_BYTES + 1)).toBe(true);
  });

  it('한도를 20MB에 딱 붙이지 않는다', () => {
    /*
     * base64로 실으면 정확히 4/3배가 되고 지시문·스키마도 같은 요청에 들어간다.
     * 한도에 붙여 두면 **어떤 파일은 되고 어떤 파일은 안 되는** 상태가 된다.
     *
     * **이 시험이 처음 값을 잡았다.** 15MiB로 적었더니 base64로 정확히 20MiB라
     * 남는 자리가 0이었다. 시험을 고치지 않고 값을 12MiB로 내렸다.
     */
    const asBase64 = (INLINE_MAX_BYTES * 4) / 3;
    const limit = 20 * 1024 * 1024;

    expect(asBase64).toBeLessThan(limit);
    // 지시문·스키마가 들어갈 자리가 실제로 남아야 한다. 1MiB는 그것의 몇 배다.
    expect(limit - asBase64).toBeGreaterThan(1024 * 1024);
  });
});

describe('올리기', () => {
  it('키를 주소가 아니라 헤더로 보낸다', async () => {
    const fetchMock = install(
      jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ file: { name: 'files/abc', uri: 'https://x/files/abc' } }),
      })
    );

    await uploadGeminiFile({
      apiKey: KEY,
      bytes: Buffer.from('녹음'),
      mimeType: 'audio/m4a',
      displayName: '상담 녹음',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
  });

  it('파일 이름에 사용자·업체를 적지 않는다', async () => {
    /* 저쪽 목록에 남는 값이다. 누가 어느 업체와 상담했는지가 거기 적히면 안 된다. */
    const fetchMock = install(
      jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ file: { name: 'files/abc', uri: 'https://x/files/abc' } }),
      })
    );

    await uploadGeminiFile({
      apiKey: KEY,
      bytes: Buffer.from('녹음'),
      mimeType: 'audio/m4a',
      displayName: '상담 녹음',
    });

    const body = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as Uint8Array;

    expect(Buffer.from(body).toString('utf8')).toContain('상담 녹음');
  });

  it('거절당하면 본문을 메시지에 붙이지 않는다', async () => {
    install(jest.fn().mockResolvedValue({ ok: false, status: 413, json: async () => ({}) }));

    await expect(
      uploadGeminiFile({
        apiKey: KEY,
        bytes: Buffer.from('녹음'),
        mimeType: 'audio/m4a',
        displayName: '상담 녹음',
      })
    ).rejects.toThrow('413');
  });
});

describe('준비될 때까지 기다리기', () => {
  it('준비되기 전에는 부르지 않는다', async () => {
    /* 올린 직후는 PROCESSING이고 그대로 부르면 거절당한다 — 그 호출도 과금된다. */
    const fetchMock = install(
      jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'files/a', state: 'PROCESSING' }) })
        .mockResolvedValue({ ok: true, json: async () => ({ name: 'files/a', state: 'ACTIVE' }) })
    );

    await waitUntilActive({ apiKey: KEY, name: 'files/a', sleep: noSleep });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('저쪽이 못 읽으면 기다리지 않고 멈춘다', async () => {
    install(
      jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'files/a', state: 'FAILED', error: { message: '형식 오류' } }),
      })
    );

    await expect(
      waitUntilActive({ apiKey: KEY, name: 'files/a', sleep: noSleep })
    ).rejects.toThrow('형식 오류');
  });

  it('끝없이 기다리지 않는다', async () => {
    /* 워커가 한 파일에 붙잡히면 뒤의 녹음이 전부 대기한다. */
    install(
      jest.fn().mockResolvedValue({ ok: true, json: async () => ({ name: 'files/a', state: 'PROCESSING' }) })
    );

    await expect(
      waitUntilActive({ apiKey: KEY, name: 'files/a', timeoutMs: 0, sleep: noSleep })
    ).rejects.toThrow('시간 안에');
  });
});

describe('지우기', () => {
  it('지우면 참이다', async () => {
    install(jest.fn().mockResolvedValue({ ok: true, status: 200 }));

    expect(await deleteGeminiFile({ apiKey: KEY, name: 'files/a' })).toBe(true);
  });

  it('이미 없으면 지운 것과 같다', async () => {
    // 48시간이 지나 저쪽이 먼저 지웠을 수 있다. 그것은 실패가 아니다.
    install(jest.fn().mockResolvedValue({ ok: false, status: 404 }));

    expect(await deleteGeminiFile({ apiKey: KEY, name: 'files/a' })).toBe(true);
  });

  it('못 지우면 거짓을 돌려준다 — 삼키지 않는다', async () => {
    /*
     * 예외를 삼키고 성공으로 넘기면 「지웠다」가 사실이 아닌 채로 기록되고, 그
     * 뒤에 아무도 확인하지 않는다.
     */
    install(jest.fn().mockRejectedValue(new Error('연결이 끊겼다')));

    expect(await deleteGeminiFile({ apiKey: KEY, name: 'files/a' })).toBe(false);
  });
});
