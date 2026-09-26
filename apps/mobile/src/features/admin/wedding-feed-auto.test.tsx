import { Image, Text, TextInput } from 'react-native';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';

import { apiFetch } from '@/app/admin/_api';
import { AdminRoleProvider } from '@/app/admin/_role';
import { WeddingFeedPanel } from '@/app/admin/wedding-feed';
import * as ImagePicker from 'expo-image-picker';

/**
 * 웨딩피드 「자동 작성」 — 누르면 글과 이미지가 한 번에 채워진다(2026-09-26 대표 지시
 * 「자동 작성 버튼 클릭 시 내용과 이미지가 자동으로 생성되게 한다」).
 *
 * 여기서 보는 것:
 *  - 글 → 대표 썸네일 → 본문 이미지 순서로 부르고, 이미지는 방금 쓴 글 · 카테고리로 만든다.
 *  - 다시 누르면 방금 받은 제목을 피할 목록(`avoidTitles`)으로 보낸다.
 *  - 저장(`POST /v1/admin/wedding-feed`)은 하지 않는다 — 운영자가 읽고 올린다.
 *  - 실패하면 멈추고 한국어로 알리며, 이미 있던 값은 그대로 둔다.
 *  - 고른 그림은 같은 origin(`PUT …/image/file`)으로 올린다 — 서명 URL을 받지 않는다.
 */
jest.mock('@/app/admin/_api', () => ({ apiFetch: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));

const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockedPicker = ImagePicker.launchImageLibraryAsync as jest.MockedFunction<
  typeof ImagePicker.launchImageLibraryAsync
>;

const FEED = {
  posts: [],
  runs: [],
  remainingTopics: 17,
  nextSortOrder: 1,
  automation: { manualReady: true, scheduledEnabled: false },
};

const TAXONOMY = {
  groups: [{ id: '00000000-0000-4000-8000-0000000000a1', name: '업체·서비스', sortOrder: 0, active: true }],
  categories: [
    {
      id: '00000000-0000-4000-8000-0000000000b1',
      name: '웨딩홀',
      groupId: '00000000-0000-4000-8000-0000000000a1',
      sortOrder: 0,
      active: true,
      postCount: 3,
    },
  ],
  ungrouped: [],
};

const DRAFT = { title: '웨딩홀 조명 리허설에서 볼 것', summary: '입장 동선의 밝기를 먼저 확인해요.', body: '본문 첫 문단.\n\n본문 둘째 문단.' };

type Call = { path: string; method: string; body: unknown };

function route(overrides: Partial<Record<string, (call: Call) => unknown>> = {}) {
  const calls: Call[] = [];
  mockedFetch.mockImplementation(async (path: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET';
    const body =
      typeof options?.body === 'string' ? (JSON.parse(options.body) as unknown) : (options?.body ?? null);
    const call = { path, method, body };
    calls.push(call);
    const key = `${method} ${path.split('?')[0]}`;
    const override = overrides[key];
    if (override) return override(call);
    if (key === 'GET /v1/admin/wedding-feed') return FEED;
    if (key === 'GET /v1/admin/wedding-feed/taxonomy') return TAXONOMY;
    if (key === 'POST /v1/admin/wedding-feed/draft') return DRAFT;
    if (key === 'POST /v1/admin/wedding-feed/image/generate') {
      const kind = (body as { kind: string }).kind;
      return { storageKey: `wedding-feed/${kind}/gen.png`, imageUrl: `https://image.example/${kind}.png` };
    }
    throw new Error(`예상하지 않은 호출 ${key}`);
  });
  return calls;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function pressableAbove(node: ReactTestInstance): ReactTestInstance | null {
  let current: ReactTestInstance | null = node;
  while (current && typeof current.props.onPress !== 'function') current = current.parent;
  return current;
}

/**
 * 이름이 `label`인 «눌리는» 자리. 같은 글자가 표의 칸(카테고리 표의 「웨딩홀」)에도 있어서,
 * 눌리는 조상이 있는 것을 고른다.
 */
async function press(tree: ReactTestRenderer, label: string): Promise<void> {
  const target = tree.root
    .findAllByType(Text)
    .filter((node) => node.props.children === label)
    .map(pressableAbove)
    .find((node): node is ReactTestInstance => node !== null);
  if (!target) throw new Error(`눌리는 「${label}」를 찾지 못했다.`);
  await act(async () => {
    target.props.onPress();
  });
  await flush();
}

function allText(tree: ReactTestRenderer): string {
  return tree.root
    .findAllByType(Text)
    .map((node) => [node.props.children].flat().join(''))
    .join('\n');
}

function inputValues(tree: ReactTestRenderer): string[] {
  return tree.root.findAllByType(TextInput).map((node) => String(node.props.value ?? ''));
}

function imageUris(tree: ReactTestRenderer): string[] {
  return tree.root.findAllByType(Image).map((node) => (node.props.source as { uri: string }).uri);
}

async function openNewPost(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <AdminRoleProvider value="operator">
        <WeddingFeedPanel />
      </AdminRoleProvider>
    );
  });
  await flush();
  await press(tree, '+ 새 글');
  await press(tree, '웨딩홀');
  return tree;
}

describe('웨딩피드 자동 작성 — 글과 이미지를 한 번에', () => {
  it('글 → 대표 썸네일 → 본문 이미지를 차례로 채우고, 저장은 하지 않는다', async () => {
    const calls = route();
    const tree = await openNewPost();

    await press(tree, '자동 작성');

    const made = calls.filter((call) => call.method === 'POST');
    expect(made.map((call) => call.path)).toEqual([
      '/v1/admin/wedding-feed/draft',
      '/v1/admin/wedding-feed/image/generate',
      '/v1/admin/wedding-feed/image/generate',
    ]);
    expect(made[0]!.body).toEqual({ categoryLabel: '웨딩홀', avoidTitles: [] });
    expect(made[1]!.body).toEqual({ kind: 'thumbnail', ...DRAFT, categoryLabel: '웨딩홀' });
    expect(made[2]!.body).toEqual({ kind: 'body', ...DRAFT, categoryLabel: '웨딩홀' });

    expect(inputValues(tree)).toEqual(expect.arrayContaining([DRAFT.title, DRAFT.summary, DRAFT.body]));
    expect(imageUris(tree)).toEqual(['https://image.example/thumbnail.png', 'https://image.example/body.png']);
    /* 초안만 채운다 — 글을 만드는 POST(/v1/admin/wedding-feed)는 없다. */
    expect(calls.some((call) => call.method === 'POST' && call.path === '/v1/admin/wedding-feed')).toBe(false);
  });

  it('다시 누르면 방금 받은 제목을 피해 달라고 보낸다', async () => {
    const calls = route();
    const tree = await openNewPost();

    await press(tree, '자동 작성');
    await press(tree, '자동 작성');

    const drafts = calls.filter((call) => call.path === '/v1/admin/wedding-feed/draft');
    expect(drafts[1]!.body).toEqual({ categoryLabel: '웨딩홀', avoidTitles: [DRAFT.title] });
  });

  it('진행 중에는 지금 무엇을 만드는지 보여준다', async () => {
    let release!: (value: unknown) => void;
    route({
      'POST /v1/admin/wedding-feed/image/generate': () => new Promise((resolve) => (release = resolve)),
    });
    const tree = await openNewPost();

    await press(tree, '자동 작성');

    expect(allText(tree)).toContain('대표 썸네일을 만드는 중이에요 (2/3)');
    await act(async () => release({ storageKey: 'wedding-feed/thumbnail/a.png', imageUrl: 'https://image.example/a.png' }));
    await flush();
    expect(allText(tree)).toContain('본문 이미지를 만드는 중이에요 (3/3)');
  });

  it('글이 실패하면 한국어로 알리고 폼은 그대로 둔다 — 이미지는 부르지 않는다', async () => {
    const calls = route({
      'POST /v1/admin/wedding-feed/draft': () => {
        throw new Error('이 카테고리의 이전 글과 겹치는 초안만 나왔어요. 다시 눌러주세요.');
      },
    });
    const tree = await openNewPost();

    await press(tree, '자동 작성');

    expect(allText(tree)).toContain('자동 작성에 실패했어요. 이 카테고리의 이전 글과 겹치는 초안만 나왔어요. 다시 눌러주세요.');
    expect(inputValues(tree)).not.toContain(DRAFT.title);
    expect(calls.some((call) => call.path === '/v1/admin/wedding-feed/image/generate')).toBe(false);
  });

  it('이미지에서 실패하면 채운 글은 남기고 무엇이 안 됐는지 알린다', async () => {
    const calls = route({
      'POST /v1/admin/wedding-feed/image/generate': () => {
        throw new Error('API /v1/admin/wedding-feed/image/generate → 504');
      },
    });
    const tree = await openNewPost();

    await press(tree, '자동 작성');

    expect(inputValues(tree)).toEqual(expect.arrayContaining([DRAFT.title, DRAFT.summary]));
    expect(allText(tree)).toContain(
      '글은 채웠어요. 대표 썸네일을 만들지 못했어요 — 응답이 늦어 연결이 끊겼어요. 다시 눌러주세요. 「이미지 생성」으로 다시 만들 수 있어요.'
    );
    expect(calls.filter((call) => call.path === '/v1/admin/wedding-feed/image/generate')).toHaveLength(1);
  });
});

describe('웨딩피드 그림 올리기 — 같은 origin', () => {
  it('고른 그림은 서명 URL 없이 PUT …/image/file로 올린다', async () => {
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' });
    mockedPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'blob:feed', mimeType: 'image/png', width: 1200, height: 630, file: png as File }],
    } as unknown as ImagePicker.ImagePickerResult);
    const calls = route({
      'PUT /v1/admin/wedding-feed/image/file': () => ({
        storageKey: 'wedding-feed/thumbnail/up.png',
        imageUrl: 'https://image.example/up.png',
      }),
    });
    const tree = await openNewPost();

    await press(tree, '썸네일 올리기');

    const put = calls.find((call) => call.method === 'PUT');
    expect(put?.path).toBe('/v1/admin/wedding-feed/image/file?kind=thumbnail');
    expect(put?.body).toBe(png);
    expect(calls.some((call) => call.path.includes('upload-target'))).toBe(false);
    expect(imageUris(tree)).toContain('https://image.example/up.png');
  });
});
