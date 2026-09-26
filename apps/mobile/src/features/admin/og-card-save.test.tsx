import { Text, TextInput } from 'react-native';
import { G, Path, Rect } from 'react-native-svg';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { MARK_CHECK_PATH, MARK_HEART_PATH } from '@weddingpick/ui';
import { apiFetch } from '@/app/admin/_api';
import { AdminRoleProvider } from '@/app/admin/_role';
import { OG_CARD, OgCardPanel } from '@/app/admin/og-card';
import * as ImagePicker from 'expo-image-picker';

declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
};
const { join } = require('path') as { join: (...parts: string[]) => string };

/**
 * 링크 미리보기 — 「저장」을 누르면 그림을 올리고 저장한 뒤 모달이 닫힌다
 * (2026-09-26 대표 제보 「그림 등록이 안 된다」).
 *
 * 예전 화면은 그림을 고르는 순간 서명 URL로 저장소에 직접 올렸고(운영에서 CORS로 막혀
 * `Failed to fetch`), 「저장」은 문구만 저장하고 모달을 닫지 않았다. 여기서 보는 것:
 *  - 그림은 같은 origin의 API(`/og-image/file`)로 간다 — 서명 URL을 받지 않는다.
 *  - 저장이 끝나면 다시 읽고 모달을 닫는다.
 *  - 실패하면 모달을 닫지 않고 이유를 적는다.
 */
jest.mock('@/app/admin/_api', () => ({ apiFetch: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockedPicker = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
  typeof ImagePicker.launchImageLibraryAsync
>;

function view(overrides: Partial<{ ogTitle: string | null }> = {}, source: 'upload' | 'default' = 'default') {
  const meta = { ogTitle: '기본 제목', ogDescription: '기본 설명', ogImageUrl: null, ogImageAlt: '기본 그림 설명' };
  return {
    kind: 'app',
    effective: {
      ...meta,
      ogTitle: overrides.ogTitle ?? meta.ogTitle,
      ogImageUrl: source === 'upload' ? 'https://example.test/v1/site-meta/og-image?kind=app&v=2' : null,
    },
    defaults: meta,
    overrides: { ogTitle: overrides.ogTitle ?? null, ogDescription: null, ogImageUrl: null, ogImageAlt: null },
    updatedAt: null,
    publishRequestedAt: null,
    liveOgTitle: null,
    ogImageSource: source,
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function pressableAbove(node: ReactTestInstance): ReactTestInstance {
  let current: ReactTestInstance | null = node;
  while (current && typeof current.props.onPress !== 'function') current = current.parent;
  if (!current) throw new Error('눌리는 자리를 찾지 못했다.');
  return current;
}

function textNode(tree: ReactTestRenderer, label: string): ReactTestInstance | undefined {
  return tree.root.findAllByType(Text).find((node) => node.props.children === label);
}

async function press(tree: ReactTestRenderer, label: string): Promise<void> {
  const node = textNode(tree, label);
  if (!node) throw new Error(`「${label}」를 찾지 못했다.`);
  await act(async () => {
    pressableAbove(node).props.onPress();
  });
  await flush();
}

/** 모달이 열려 있는가 — 모달 안에만 있는 「그림 올리기」 단추로 본다. */
function modalOpen(tree: ReactTestRenderer): boolean {
  return Boolean(textNode(tree, '그림 올리기'));
}

async function renderPanel(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <AdminRoleProvider value="operator">
        <OgCardPanel />
      </AdminRoleProvider>
    );
  });
  await flush();
  return tree;
}

const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' });

beforeEach(() => {
  mockedPicker.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'blob:card', mimeType: 'image/png', width: 1200, height: 630, file: png as File }],
  } as unknown as ImagePicker.ImagePickerResult);
});

describe('링크 미리보기 — 저장하면 올리고 닫는다', () => {
  it('고른 그림을 같은 origin으로 올리고, 문구를 저장하고, 다시 읽은 뒤 모달을 닫는다', async () => {
    const calls: { path: string; method: string }[] = [];
    let saved = false;
    mockedFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      const method = options?.method ?? 'GET';
      calls.push({ path, method });
      if (method === 'PUT' && path.startsWith('/v1/admin/site-meta/og-image/file')) {
        saved = true;
        return view({}, 'upload');
      }
      if (method === 'PUT') return view({ ogTitle: '새 제목' }, 'upload');
      return saved ? view({ ogTitle: '새 제목' }, 'upload') : view();
    });

    const tree = await renderPanel();
    await press(tree, '앱용 미리보기 수정');
    expect(modalOpen(tree)).toBe(true);

    await press(tree, '그림 올리기');
    /* 고르기만 했다 — 아직 아무것도 보내지 않는다. */
    expect(calls.filter((call) => call.method !== 'GET')).toEqual([]);

    const title = tree.root.findAllByType(TextInput)[0]!;
    await act(async () => {
      title.props.onChangeText('새 제목');
    });

    await press(tree, '저장');

    /* 첫 줄은 화면을 처음 그릴 때의 조회다. 그 뒤가 「저장」 한 번이 부른 전부다. */
    expect(calls.slice(1)).toEqual([
      { path: '/v1/admin/site-meta/og-image/file?kind=app', method: 'PUT' },
      { path: '/v1/admin/site-meta?kind=app', method: 'PUT' },
      { path: '/v1/admin/site-meta?kind=app', method: 'GET' },
    ]);
    /* 서명 URL 길(옛 upload-target)은 부르지 않는다 — 운영 저장소가 CORS로 막는다. */
    expect(calls.some((call) => call.path.includes('upload-target'))).toBe(false);

    const upload = mockedFetch.mock.calls.find(([path]) => path.includes('/og-image/file'))!;
    expect(upload[1]).toMatchObject({ headers: { 'Content-Type': 'image/png' }, body: png });
    /* 문구 저장은 그림 주소 칸을 비워 보낸다 — 방금 올린 그림을 놓지 않게. */
    const textSave = mockedFetch.mock.calls.find(
      ([path, options]) => path === '/v1/admin/site-meta?kind=app' && options?.method === 'PUT'
    )!;
    expect(JSON.parse(String(textSave[1]!.body))).toMatchObject({ ogTitle: '새 제목', ogImageUrl: '' });

    expect(modalOpen(tree)).toBe(false);
    expect(textNode(tree, '저장했어요. 사이트에는 별도 배포 후 반영돼요.')).toBeTruthy();
  });

  it('올리기가 실패하면 모달을 닫지 않고 이유를 적는다 — 문구 저장으로 넘어가지 않는다', async () => {
    mockedFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method === 'PUT' && path.includes('/og-image/file')) {
        throw new Error('PNG · JPG · WebP 그림만 올릴 수 있어요.');
      }
      return view();
    });

    const tree = await renderPanel();
    await press(tree, '앱용 미리보기 수정');
    await press(tree, '그림 올리기');
    await press(tree, '저장');

    expect(modalOpen(tree)).toBe(true);
    expect(textNode(tree, 'PNG · JPG · WebP 그림만 올릴 수 있어요.')).toBeTruthy();
    expect(
      mockedFetch.mock.calls.some(
        ([path, options]) => path === '/v1/admin/site-meta?kind=app' && options?.method === 'PUT'
      )
    ).toBe(false);
  });

  it('그림은 올라갔는데 문구 저장이 실패하면 모달을 연 채 무엇이 됐는지 나눠 적고, 다시 눌러도 그림을 또 올리지 않는다', async () => {
    let failText = true;
    mockedFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      const method = options?.method ?? 'GET';
      if (method === 'PUT' && path.includes('/og-image/file')) return view({}, 'upload');
      if (method === 'PUT' && failText) throw new Error('API /v1/admin/site-meta?kind=app → 500');
      if (method === 'PUT') return view({}, 'upload');
      return view();
    });

    const tree = await renderPanel();
    await press(tree, '앱용 미리보기 수정');
    await press(tree, '그림 올리기');
    await press(tree, '저장');

    expect(modalOpen(tree)).toBe(true);
    expect(textNode(tree, '그림은 올렸어요. 문구를 저장하지 못했어요. 다시 저장해주세요.')).toBeTruthy();
    /* 서버는 이미 그 그림을 쓰고 있다 — 모달 안내도 그렇게 말한다. */
    expect(textNode(tree, '올린 그림을 쓰고 있어요.')).toBeTruthy();

    failText = false;
    await press(tree, '저장');

    const uploads = mockedFetch.mock.calls.filter(([path]) => path.includes('/og-image/file'));
    expect(uploads).toHaveLength(1);
    expect(modalOpen(tree)).toBe(false);
  });

  it('요청 본문 상한(413)에 걸리면 크기를 줄이라고 적는다', async () => {
    mockedFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method === 'PUT' && path.includes('/og-image/file')) {
        throw new Error('API /v1/admin/site-meta/og-image/file?kind=app → 413');
      }
      return view();
    });

    const tree = await renderPanel();
    await press(tree, '앱용 미리보기 수정');
    await press(tree, '그림 올리기');
    await press(tree, '저장');

    expect(modalOpen(tree)).toBe(true);
    expect(textNode(tree, '그림이 너무 커요. 1MB 안쪽으로 줄여 다시 골라주세요.')).toBeTruthy();
  });

  it('서버에 닿지 못하면 브라우저 영문 대신 한국어로 적고 모달을 연 채 둔다', async () => {
    mockedFetch.mockImplementation(async (path: string, options?: RequestInit) => {
      if (options?.method === 'PUT') throw new TypeError('Failed to fetch');
      return view();
    });

    const tree = await renderPanel();
    await press(tree, '앱용 미리보기 수정');
    await press(tree, '저장');

    expect(modalOpen(tree)).toBe(true);
    expect(textNode(tree, '서버에 닿지 못했어요. 연결을 확인하고 다시 저장해주세요.')).toBeTruthy();
    expect(textNode(tree, 'Failed to fetch')).toBeUndefined();
  });

  it('그림 형식이 아니면 고를 때 막는다', async () => {
    mockedFetch.mockResolvedValue(view());
    mockedPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'blob:x', mimeType: 'image/svg+xml', width: 10, height: 10 }],
    } as unknown as ImagePicker.ImagePickerResult);

    const tree = await renderPanel();
    await press(tree, '앱용 미리보기 수정');
    await press(tree, '그림 올리기');

    expect(textNode(tree, 'PNG · JPG · WebP 그림만 올릴 수 있어요.')).toBeTruthy();
    expect(mockedFetch.mock.calls.every(([, options]) => (options?.method ?? 'GET') === 'GET')).toBe(true);
  });
});

/*
 * 기본 카드 그림은 정본 `docs/design/React_Native/OG카드.svg`와 같아야 한다(2026-09-26 대표님 업로드).
 * 예전 미리보기는 코랄 칸에 「기본 그림」 글자만 있었다.
 */
describe('링크 미리보기 — 기본 카드 그림', () => {
  const canonical = readFileSync(join(__dirname, '../../../../../docs/design/React_Native/OG카드.svg'), 'utf8');

  it('크기 · 바탕색 · 마크 자리와 크기가 정본 SVG의 숫자와 같다', () => {
    expect(canonical).toContain(`width="${OG_CARD.width}" height="${OG_CARD.height}"`);
    expect(canonical).toContain(`<rect width="${OG_CARD.width}" height="${OG_CARD.height}" fill="${OG_CARD.background}"/>`);
    expect(canonical).toContain(
      `<svg x="${OG_CARD.markX}" y="${OG_CARD.markY}" width="${OG_CARD.markSize}" height="${OG_CARD.markSize}" viewBox="0 0 24 24" fill="none" stroke="${OG_CARD.mark}" stroke-width="1.9"`
    );
    expect(canonical).toContain(`<path d="${MARK_HEART_PATH}"/>`);
    expect(canonical).toContain(`<path d="${MARK_CHECK_PATH}"/>`);
  });

  it('올린 그림이 없으면 미리보기가 정본 카드를 그린다 — 글자로 대신하지 않는다', async () => {
    mockedFetch.mockResolvedValue(view());
    const tree = await renderPanel();

    const rect = tree.root.findAllByType(Rect)[0]!;
    expect(rect.props).toMatchObject({ width: 1200, height: 630, fill: '#FF6F61' });
    /* Svg는 안에 G를 하나 더 둔다 — 자리를 옮기는 G는 transform을 가진 쪽이다. */
    const group = tree.root.findAllByType(G).find((node) => node.props.transform)!;
    expect(group.props.transform).toBe('translate(456 160) scale(12)');
    const paths = group.findAllByType(Path).map((node) => [node.props.d, node.props.stroke]);
    expect(paths).toEqual([
      [MARK_HEART_PATH, '#FFFFFF'],
      [MARK_CHECK_PATH, '#FFFFFF'],
    ]);
    expect(textNode(tree, '기본 그림')).toBeUndefined();
  });
});
