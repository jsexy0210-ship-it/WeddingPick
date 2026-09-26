import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { router } from 'expo-router';

import { ErrorView } from '@weddingpick/ui';

import { SubScreenStatus } from '@/features/settings/my-kit';

/**
 * 2026-09-26 대표 감사 — MY 하위 화면의 «불러오기 실패»에 나갈 길이 없었다. 화면마다
 * `return <ErrorView … />`로 헤더 없이 통째로 바꿔 그렸기 때문이다(알림 · 프로필 · Pick
 * 인증내역 · 내가 쓴 후기 · 문의 내역). 정본(`React_Native/common.js`)에 오류 화면 전용
 * «돌아가기»가 없어 새 단추를 만들지 않고, 공통 껍데기 `SubScreenStatus`가 헤더 Back을 남긴다.
 */

let mockPathname = '/my/notifications';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), dismissTo: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => false) },
  usePathname: () => mockPathname,
  useLocalSearchParams: () => ({}),
  useNavigation: () => ({ setOptions: jest.fn(), addListener: () => () => undefined }),
}));

/** 테스트 러너(CommonJS)의 전역. 앱 번들에는 들어가지 않는다. */
declare const require: (id: string) => any;
declare const __dirname: string;

const { readdirSync, readFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const myDir = join(__dirname, '..', '..', 'app', '(tabs)', 'my');

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry: { isDirectory: () => boolean; name: string }) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name.endsWith('.tsx') && entry.name !== '_layout.tsx' && entry.name !== 'index.tsx' ? [path] : [];
  });
}

let tree: ReactTestRenderer | null = null;

afterEach(async () => {
  if (tree) await act(async () => tree?.unmount());
  tree = null;
});

describe('MY 하위 화면 — 불러오는 중 · 불러오기 실패에도 헤더 Back이 있다', () => {
  it('SubScreenStatus는 제목과 Depth Back 헤더를 그리고, Back은 MY 부모로 간다', async () => {
    mockPathname = '/my/notifications';
    const retry = jest.fn();

    await act(async () => {
      tree = create(
        <SubScreenStatus title="알림">
          <ErrorView message="알림을 불러오지 못했어요" onRetry={retry} />
        </SubScreenStatus>
      );
    });

    const texts = tree!.root.findAll((node) => typeof node.props?.children === 'string').map((node) => node.props.children);
    expect(texts).toContain('알림');
    expect(texts).toContain('알림을 불러오지 못했어요');

    const back = tree!.root.findAll((node) => node.props?.accessibilityLabel === '뒤로' && typeof node.props?.onPress === 'function')[0];
    expect(back).toBeDefined();
    await act(async () => back!.props.onPress());
    expect(router.dismissTo).toHaveBeenCalledWith('/my');
  });

  it('MY 하위 라우트 파일은 오류 · 로딩을 SubScreenStatus 안에서만 그린다', () => {
    const offenders: string[] = [];

    for (const file of routeFiles(myDir)) {
      const source: string = readFileSync(file, 'utf8');
      const pattern = /<(ErrorView|DelayedLoadingView)\b/g;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(source)) !== null) {
        const before = source.slice(Math.max(0, match.index - 240), match.index);
        const opened = before.lastIndexOf('<SubScreenStatus');
        const closed = before.lastIndexOf('</SubScreenStatus>');
        if (opened === -1 || closed > opened) offenders.push(`${relative(myDir, file)} · ${match[1]}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
