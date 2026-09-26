/**
 * 화면 전환이 라우터 단위로 한 자리에서 정해지는지 센다(2026-09-26 대표 지시 「모든 전체 화면
 * 라우터 단위로 싹다 적용해」).
 *
 * 글로 적은 규칙은 다음 화면이 조용히 빠진다. 여기서 막는 것 셋:
 *   1. 스택을 그리는 `_layout.tsx`가 전부 `AppStack` + `useStackScreenOptions()`를 쓴다
 *      — expo-router `Stack`을 바로 부르면 웹에서 전환이 없는 스택으로 돌아간다.
 *   2. 머리가 풀팝업(X 닫기)인 라우트는 `modal`(아래에서 올라옴)이다.
 *   3. 부모 화면을 다시 그리고 시트를 띄우는 시트형 라우트는 `sheet`다 — 밀면 부모 사본이 끌려 나온다.
 */
import { STACK_ROUTE_TRANSITION, stackTransitionFor } from './stack-motion';
import { stackScreenOptions } from './transition-options';

declare const require: (id: string) => unknown;
declare const __dirname: string;

const { readFileSync, readdirSync, statSync, existsSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean };
  existsSync: (path: string) => boolean;
};
const { join, relative, dirname, sep } = require('path') as {
  join: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
  dirname: (path: string) => string;
  sep: string;
};

const APP = join(__dirname, '..', '..', 'app');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(APP).filter((path) => path.endsWith('.tsx') && !path.endsWith('.test.tsx'));

/** 파일을 감싸는 가장 가까운 레이아웃 폴더 기준의 라우트 이름(expo-router가 쓰는 이름). */
function routeName(file: string): string {
  let dir = dirname(file);
  while (!existsSync(join(dir, '_layout.tsx')) && dir !== APP) dir = dirname(dir);
  return relative(dir, file).split(sep).join('/').replace(/(\.web)?\.tsx$/, '');
}

const routes = files.filter((file) => {
  const rel = relative(APP, file).split(sep).join('/');
  const base = rel.split('/').pop() ?? '';
  return !base.startsWith('_') && !base.startsWith('+') && !rel.startsWith('admin/');
});

describe('stack transitions are decided per router', () => {
  it('스택 레이아웃은 전부 AppStack과 공용 화면 옵션을 쓴다', () => {
    const layouts = files.filter((file) => file.endsWith('_layout.tsx'));
    const stacks = layouts.filter((file) => /Stack/.test(readFileSync(file, 'utf8')));

    expect(stacks.length).toBeGreaterThanOrEqual(8);
    for (const file of stacks) {
      const content = readFileSync(file, 'utf8');
      expect({ file: relative(APP, file), stack: /<AppStack[\s>]/.test(content) }).toEqual({ file: relative(APP, file), stack: true });
      expect(content).toContain('useStackScreenOptions()');
      expect(content).not.toMatch(/import \{[^}]*\bStack\b[^}]*\} from 'expo-router'/);
    }
  });

  it('표에 적은 라우트 이름은 실제 라우트다', () => {
    const names = new Set(routes.map(routeName));
    const dirs = new Set(
      walk(APP)
        .filter((path) => path.endsWith('_layout.tsx'))
        .map((path) => relative(dirname(dirname(path)), dirname(path)))
    );

    for (const name of Object.keys(STACK_ROUTE_TRANSITION)) {
      expect({ name, exists: names.has(name) || dirs.has(name) }).toEqual({ name, exists: true });
    }
  });

  it('풀팝업 머리(X 닫기)인 라우트는 아래에서 올라온다', () => {
    const popups = routes.filter((file) => /variant="close"|<FullPopupHeader\b/.test(readFileSync(file, 'utf8')));

    expect(popups.map(routeName)).toEqual(expect.arrayContaining(['[vendorId]/consult', 'compare', '[id]/changelog']));
    for (const file of popups) {
      expect({ route: routeName(file), transition: stackTransitionFor(routeName(file)) }).toEqual({
        route: routeName(file),
        transition: 'modal',
      });
    }
  });

  it('부모 화면 위에 시트를 띄우는 시트형 라우트는 밀지 않는다', () => {
    const sheets = routes.filter((file) => /<BottomSheet\b[^>]*?\svisible(?=[\s/>])/s.test(readFileSync(file, 'utf8')));

    expect(sheets.map(routeName)).toEqual(expect.arrayContaining(['[id]/events/new', '[vendorId]/write-review']));
    for (const file of sheets) {
      expect({ route: routeName(file), transition: stackTransitionFor(routeName(file)) }).toEqual({
        route: routeName(file),
        transition: 'sheet',
      });
    }
  });

  it('나머지 화면은 오른쪽에서 밀려 들어오고, 네이티브는 OS 전환을 끄지 않는다', () => {
    expect(stackTransitionFor('[vendorId]/index')).toBe('push');
    expect(stackTransitionFor('profile')).toBe('push');

    const context = { background: '#FFFFFF', reduceMotion: false };
    for (const kind of ['push', 'modal', 'sheet', 'fade'] as const) {
      expect(stackScreenOptions(kind, context).animation).not.toBe('none');
      expect(stackScreenOptions(kind, context).headerShown).toBe(false);
    }
    expect(stackScreenOptions('modal', context).animation).toBe('slide_from_bottom');
    /* 「움직임 줄이기」 — 이동 없이 페이드. */
    expect(stackScreenOptions('push', { ...context, reduceMotion: true }).animation).toBe('fade');
  });
});
