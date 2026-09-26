import { router } from 'expo-router';

import { dismissToOrReplace } from '@/features/navigation/depth-back';

declare const require: (id: string) => unknown;
declare const __dirname: string;
const { readFileSync } = require('node:fs') as { readFileSync: (path: string, encoding: 'utf8') => string };
const { join } = require('node:path') as { join: (...parts: string[]) => string };

/**
 * 로그인 → 약관 동의 → 초기 설정 → 홈이 **기록을 쌓지 않는가**(2026-09-26 대표 감사 1).
 *
 * 인증을 마친 사람이 뒤로가기로 `/login` · `/login/consent` · `/setup`에 돌아가지
 * 않으려면, 이 흐름의 모든 이동이 «교체»여야 한다. 흐름의 이동은 전부
 * `router.replace` 또는 `dismissToOrReplace`(= `router.dismissTo`, 대상이 스택에
 * 없으면 현재 화면을 교체 — expo-router 57 `dismissTo` 문서)다. `push` · `navigate` ·
 * `<Link>`가 끼면 그 자리에 화면이 하나 쌓인다 — 여기서 그것을 센다.
 *
 * **이 시험은 실제 스택을 돌리지 않는다.** expo-router 시험 도구가 요구하는
 * `@testing-library/react-native`가 저장소에 없다. 안드로이드 실기기에서 홈 도착 뒤
 * 뒤로가기가 앱 종료 안내로 이어지는지는 따로 확인해야 한다(NOT CHECKED).
 */
jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn(), replace: jest.fn() } }));

const APP = join(__dirname, '..', '..', 'app');
const FLOW_FILES = [
  join(APP, '_layout.tsx'),
  join(APP, 'login', 'index.tsx'),
  join(APP, 'login', 'consent.tsx'),
  join(APP, 'login', 'age-required.tsx'),
  join(APP, 'setup.tsx'),
  join(__dirname, 'finish-sign-in.ts'),
];

describe('가입 흐름은 화면을 쌓지 않는다', () => {
  it.each(FLOW_FILES.map((file) => [file.slice(file.lastIndexOf('/src/') + 1), file]))('%s — push · navigate · Link가 없다', (_label, file) => {
    const source = readFileSync(file, 'utf8');

    expect(source).not.toMatch(/router\.(push|navigate)\(/);
    expect(source).not.toMatch(/<Link\b/);
  });

  it('초기 설정은 어떤 뒤로가기에서도 /login으로 교체하지 않는다 — 세션이 없을 때만 보낸다', () => {
    const source = readFileSync(join(APP, 'setup.tsx'), 'utf8');
    const back = source.slice(source.indexOf("addEventListener('hardwareBackPress'"), source.indexOf('return () => subscription.remove();'));

    expect(back).not.toContain("'/login'");
  });

  it('완료 이동은 dismissTo(대상이 없으면 교체)로 간다', () => {
    dismissToOrReplace('/');
    expect(router.dismissTo).toHaveBeenCalledWith('/');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('dismissTo가 설 자리가 없으면 replace로 갈아 끼운다', () => {
    jest.mocked(router.dismissTo).mockImplementation(() => { throw new Error('no stack'); });
    dismissToOrReplace('/setup');
    expect(router.replace).toHaveBeenCalledWith('/setup');
  });
});
