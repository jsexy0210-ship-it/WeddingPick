import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * 앱 밖으로 나가지 않는지 «센다».
 *
 * 2026-09-15 대표 지시 — 「인앱에서 웹 새창 또는 이동 시 앱을 탈출하게 된다.
 * 하여 iframe 껍데기 씌워서 웨딩픽 앱 밖으로 나가지 못하게 한다」 ·
 * 「서비스이용약관 개인정보처리방침 약관 관련된것도 다 In-App Browser 형태로
 * 변경한다」(CLAUDE.md 「앱 밖으로 나가지 않는다」).
 *
 * **글로 적은 규칙은 깨진다.** 약관 줄 하나에 `Linking.openURL`을 적는 것은
 * 한 줄이고, 그 한 줄이 앱을 떠나게 만든다. 리뷰가 매번 그 한 줄을 잡아주길
 * 바라는 대신 여기서 센다 — `no-claude.test.ts`와 같은 꼴이다.
 *
 * 세는 것은 **앱을 떠나는 호출이 어디에 있느냐**다. 앱을 떠나는 방법은 셋뿐이고
 * (`window.open` · `Linking.openURL` · `WebBrowser.openBrowserAsync`), 그 셋을
 * 부를 수 있는 파일을 못으로 박아 둔다. 새 화면이 자기 손으로 부르면 여기서
 * 걸린다.
 *
 * **`apps/api`에 두는 이유는 여기가 저장소를 훑는 게이트들의 자리이기 때문이다** —
 * `typography.test.ts` · `badge-box.test.ts` · `pick-language.test.ts`가 전부
 * 앱 화면 규칙을 여기서 센다. `apps/mobile`의 타입 설정은 노드 API를 쓰지 않는다.
 */
const ROOT = join(__dirname, '..', '..', '..', '..');

/** 앱을 떠나는 세 가지 호출. 문자 그대로 찾는다 — `window.opener`는 걸리지 않는다. */
const LEAVE_CALLS = ['window.open(', 'Linking.openURL(', 'WebBrowser.openBrowserAsync('];

/**
 * 앱을 떠나는 호출을 쥐어도 되는 자리.
 *
 * `open-external.ts`  무엇으로 열지 정하는 것이 **이 파일의 일**이다. 네이티브의
 *                     인앱 브라우저, 「넘기는 자리」(지도 · 달력)의
 *                     `Linking.openURL`, 남의 사이트를 누른 순간 여는 새 탭이
 *                     여기 있다.
 * `in-app-web-shell`  껍데기가 `load`를 못 받았을 때 사람이 누르는 새 창 단추.
 *                     빈 칸을 보여주고 끝내지 않기 위해 남긴 자리다.
 */
const ALLOWED = [
  'apps/mobile/src/features/open-external.ts',
  'apps/mobile/src/features/in-app-web/in-app-web-shell.tsx',
];

/**
 * 약관 · 방침을 여는 화면들. 대표 지시가 이름으로 짚은 자리다.
 *
 * 이 화면들은 `openExternal` «만» 부른다 — 무엇으로 열지는 그 함수 하나가 정한다.
 *
 * `login/index.tsx`는 v3.29(2026-09-23 정본)에서 뺐다 — WP-AUTH-010 약관 동의
 * 화면으로 일원화되면서 로그인 화면 자체는 더 이상 약관 링크를 보여주지 않는다.
 * 그 약관 동의 화면(`login/consent.tsx`)이 여는 상세(WP-AUTH-011, `terms-detail-modal.tsx`)는
 * `openExternal`로 브라우저를 여는 대신 **완전히 인앱 네이티브 풀팝업**이라 애초에
 * 앱을 떠나지 않는다 — "브라우저를 안 나간다"보다 강한 "브라우저 자체를 안 연다"라
 * `LEGAL_SCREENS`(=openExternal 사용처 목록)에 넣을 대상이 아니다. `LEAVE_CALLS`
 * 검사(아래)는 여전히 저장소 전체를 훑으므로 이 둘 중 어느 화면이 직접
 * `Linking.openURL`·`window.open`을 부르면 그대로 걸린다.
 *
 * **판단 필요**: CLAUDE.md 2026-09-15 대표 지시가 `login/index.tsx`를 이름으로
 * 짚었던 근거 문서(그 네 화면)가 이 변경으로 하나 줄어든다 — 대표님 확인 필요.
 */
const LEGAL_SCREENS = [
  /*
   * MY 「약관」 두 행은 이제 앱 화면(WP-MY-015 · 015b, docs/design/React_Native/my.jsx:894 · 914)을
   * 연다. 그 화면이 원문을 WebView/iframe으로 담고, 우리 사이트 밖 링크만 `openExternal`로 넘긴다.
   */
  'apps/mobile/src/features/settings/policy-document-screen.tsx',
  // `my/privacy.tsx`(방침 요약)는 2026-09-25 정본 밖 화면 삭제로 없어졌다.
];

/**
 * 저장소에서 문자열을 찾아 「파일:줄」로 돌려준다.
 *
 * **주석은 세지 않는다.** 왜 이렇게 됐는지를 적어 둔 문단이 여러 파일에 있고,
 * 그것까지 잡으면 근거를 적을 수 없게 된다. 잡을 것은 실제로 부르는 줄이다.
 */
function callSites(needle: string, paths: string[]): string[] {
  try {
    const out = execFileSync(
      'grep',
      ['-rnF', '--include=*.ts', '--include=*.tsx', needle, ...paths],
      { cwd: ROOT, encoding: 'utf8' }
    );

    return out
      .split('\n')
      .filter(Boolean)
      .filter((line) => !/\.(?:test|spec)\.tsx?:/.test(line))
      .filter((line) => !line.includes('stay-in-app.test.ts'))
      .filter((line) => {
        /* `path:line:내용`에서 내용만 떼어 본다. */
        const body = line.split(':').slice(2).join(':').trim();

        return !(body.startsWith('*') || body.startsWith('//') || body.startsWith('/*'));
      });
  } catch {
    /* grep은 아무것도 못 찾으면 1로 끝난다. 그것이 우리가 바라는 결과다. */
    return [];
  }
}

/** `path:line:...`에서 파일 경로만. */
function fileOf(site: string): string {
  return site.split(':')[0] ?? site;
}

describe('앱 밖으로 나가지 않는다', () => {
  it.each(LEGAL_SCREENS)('%s가 앱을 떠나는 호출을 직접 하지 않는다', (screen) => {
    const sites = LEAVE_CALLS.flatMap((call) => callSites(call, [screen]));

    expect(sites).toEqual([]);
  });

  it.each(LEGAL_SCREENS)('%s가 바깥 주소를 openExternal로 연다', (screen) => {
    expect(callSites('openExternal(', [screen]).length).toBeGreaterThan(0);
  });

  it.each(LEAVE_CALLS)('`%s`을 부르는 곳이 정해진 두 파일뿐이다', (call) => {
    const offenders = callSites(call, ['apps/mobile/src'])
      .filter((site) => !ALLOWED.includes(fileOf(site)));

    expect(offenders).toEqual([]);
  });

  /**
   * 넘기는 자리는 **부르는 쪽이 말한다**(`openExternal(url, { handOff: true })`).
   * 주소를 보고 가르지 않는 이유는 새 주소가 생길 때마다 새기 때문이다.
   *
   * 여기 적힌 셋은 CLAUDE.md가 예외로 못박은 자리다 — 지도 둘과 달력 하나.
   * 넷째가 생기면 이 시험이 먼저 묻는다.
   */
  it('앱 밖으로 넘기는 자리는 지도와 달력뿐이다', () => {
    const files = [...new Set(callSites('handOff: true', ['apps/mobile/src']).map(fileOf))].sort();

    expect(files).toEqual([
      'apps/mobile/src/app/(tabs)/search/expo/[expoId]/calendar.tsx',
      'apps/mobile/src/app/(tabs)/wedding/[id]/map.tsx',
      'apps/mobile/src/features/search/vendor-location.tsx',
    ]);
  });

  /**
   * 우리 사이트를 iframe에서 막는 헤더를 켜면 약관 화면이 **빈 칸**이 된다
   * (CLAUDE.md — 2026-09-15 재서 확인). 보안 헤더를 더하는 변경이 이 줄을
   * 밟고 지나가지 않게 여기서 센다.
   */
  it('우리 응답에 iframe을 막는 헤더를 걸지 않는다', () => {
    const sites = [
      ...callSites('X-Frame-Options', ['apps', 'packages', 'infra']),
      ...callSites('frame-ancestors', ['apps', 'packages', 'infra']),
    ];

    expect(sites).toEqual([]);
  });
});
